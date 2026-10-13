"""Embedding calls (Gemini, 768 dimensions) for queries and chunks.

Model: gemini-embedding-001 (settings.gemini_embed_model). It supports task types, so chunks
are embedded as RETRIEVAL_DOCUMENT and user questions as RETRIEVAL_QUERY. Vectors smaller than
3072 are not normalised by the API, so we L2-normalise them here (cosine search expects length 1).

Free tier: at most 1000 texts per day per model. When Google says that DAILY quota is used up,
we stop at once (DailyQuotaExceeded, no retries); the cache keeps the progress, so running the same
command the next day continues where it stopped.

Document vectors are cached in data/embed_cache/ by sha256 of (model, dim, task, text): a re-run of
embed-load, or a run after a crash, costs no API quota for chunks that were already embedded.
"""

import asyncio
import hashlib
import json
import math
import re
from pathlib import Path

import httpx
from tenacity import AsyncRetrying, retry_if_exception, stop_after_attempt, wait_exponential

from app.paths import DATA_DIR

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents"
BATCH_SIZE = 100  # API limit: at most 100 texts per batchEmbedContents request
CACHE_DIR = DATA_DIR / "embed_cache"
DOCUMENT = "RETRIEVAL_DOCUMENT"
QUERY = "RETRIEVAL_QUERY"


def l2_normalize(vector: list[float]) -> list[float]:
    """Scale a vector to length 1 (a zero vector stays as it is)."""
    norm = math.sqrt(sum(v * v for v in vector))
    return [v / norm for v in vector] if norm else list(vector)


class DailyQuotaExceeded(Exception):
    """The free-tier daily quota is used up. Waiting minutes does not help, only the next day."""

    def __init__(self, retry_after_s: float | None) -> None:
        self.retry_after_s = retry_after_s
        hours = f"~{retry_after_s / 3600:.1f} h" if retry_after_s else "the next day"
        super().__init__(f"Gemini daily embed quota used up; it resets in {hours}")


def _daily_quota_reset(res: httpx.Response) -> float | None:
    """Seconds until reset when a 429 is the per-DAY quota, else None (a per-minute 429 is retried).

    Google's error body names the quota ("...RequestsPerDay...") and a retryDelay ("21103s").
    """
    if res.status_code != 429:
        return None
    try:
        error = res.json().get("error")
    except ValueError:
        return None
    details = error.get("details", []) if isinstance(error, dict) else []
    per_day = any(
        "PerDay" in str(v.get("quotaId", "")) for d in details for v in d.get("violations", [])
    )
    if not per_day:
        return None
    delay = next((str(d["retryDelay"]) for d in details if "retryDelay" in d), "")
    match = re.fullmatch(r"([\d.]+)s", delay)
    return float(match.group(1)) if match else 0.0


def _retryable(exc: BaseException) -> bool:
    """Retry on network errors, 429 (rate limit / quota per minute) and 5xx."""
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return code == 429 or code >= 500
    return isinstance(exc, httpx.TransportError)


class Embedder:
    """Gemini embeddings with batching, retry, a small pause between batches and a disk cache.

    `api_calls` and `cache_hits` count what happened, for the embed-load report and the tests.
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        model: str,
        dim: int,
        *,
        cache_dir: Path | None = CACHE_DIR,
        delay: float = 1.0,
        retry_wait: float = 2.0,
        batch_size: int = BATCH_SIZE,
    ) -> None:
        self.client = client
        self.api_key = api_key
        self.model = model
        self.dim = dim
        self.cache_dir = cache_dir
        self.delay = delay
        self.retry_wait = retry_wait
        self.batch_size = min(batch_size, BATCH_SIZE)
        self.api_calls = 0
        self.cache_hits = 0

    # ---------- public ----------

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """One normalised vector per chunk text, in the same order. Cached on disk."""
        out: list[list[float] | None] = [self._cache_get(t) for t in texts]
        self.cache_hits += sum(v is not None for v in out)
        todo = [i for i, v in enumerate(out) if v is None]
        for start in range(0, len(todo), self.batch_size):
            if start:
                await asyncio.sleep(self.delay)  # be gentle with the per-minute quota
            idx = todo[start : start + self.batch_size]
            vectors = await self._call([texts[i] for i in idx], DOCUMENT)
            for i, vector in zip(idx, vectors, strict=True):
                out[i] = vector
                self._cache_put(texts[i], vector)
        return out  # type: ignore[return-value]  # every slot is filled above

    def cached(self, text: str) -> list[float] | None:
        """The cached document vector of `text`, or None (no API call)."""
        return self._cache_get(text)

    async def embed_query(self, text: str) -> list[float]:
        """Vector for a user question (not cached: questions rarely repeat exactly)."""
        return (await self._call([text], QUERY))[0]

    # ---------- API ----------

    async def _call(self, texts: list[str], task: str) -> list[list[float]]:
        """One batchEmbedContents request (with retry). The key is a header, never in the URL."""
        body = {
            "requests": [
                {
                    "model": f"models/{self.model}",
                    "content": {"parts": [{"text": t}]},
                    "taskType": task,
                    "outputDimensionality": self.dim,
                }
                for t in texts
            ]
        }
        url = API_URL.format(model=self.model)
        async for attempt in AsyncRetrying(
            retry=retry_if_exception(_retryable),
            stop=stop_after_attempt(8),
            wait=wait_exponential(multiplier=self.retry_wait, max=60),
            reraise=True,
        ):
            with attempt:
                self.api_calls += 1
                res = await self.client.post(
                    url, json=body, headers={"x-goog-api-key": self.api_key}
                )
                reset = _daily_quota_reset(res)
                if reset is not None:
                    raise DailyQuotaExceeded(reset or None)  # not retryable: stop right away
                if res.is_error:
                    # Our own short message: no URL, no headers, so no key can leak into logs.
                    raise httpx.HTTPStatusError(
                        f"Gemini embed {res.status_code} ({len(texts)} texts)",
                        request=res.request,
                        response=res,
                    )
                embeddings = res.json().get("embeddings", [])
                if len(embeddings) != len(texts):
                    raise ValueError(f"Gemini returned {len(embeddings)} vectors for {len(texts)}")
                return [l2_normalize(e["values"]) for e in embeddings]
        return []  # not reached: tenacity either returns above or re-raises

    # ---------- cache ----------

    def _cache_path(self, text: str) -> Path | None:
        if self.cache_dir is None:
            return None
        key = hashlib.sha256(f"{self.model}|{self.dim}|{DOCUMENT}|{text}".encode()).hexdigest()
        return self.cache_dir / f"{key}.json"

    def _cache_get(self, text: str) -> list[float] | None:
        path = self._cache_path(text)
        if path is None or not path.exists():
            return None
        vector = json.loads(path.read_text("utf-8"))
        return vector if len(vector) == self.dim else None  # a wrong cached size is re-embedded

    def _cache_put(self, text: str, vector: list[float]) -> None:
        path = self._cache_path(text)
        if path is None or len(vector) != self.dim:
            return  # never cache a vector of the wrong size
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(vector), encoding="utf-8")
