"""Download one FDA drug label per drug from the openFDA API into data/raw/.

Input: data/drugs.txt (one US generic name per line, from `drug-list`).
Output, under data/:
- raw/<slug>.json: {"drug", "query", "downloaded_at", "label"} where label is one openFDA result
- missing.txt: drugs with no US label (local brands such as domperidone are expected here)

Already downloaded drugs are skipped unless force=True, so a re-run costs no requests.
Without OPENFDA_API_KEY openFDA allows 1000 requests/day and 240/minute, enough for ~66 drugs.
The key is sent as a query parameter and never written to disk or printed.
"""

import asyncio
import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.ingest.make_drug_list import DATA_DIR

LABEL_URL = "https://api.fda.gov/drug/label.json"
CANDIDATES = 10  # labels fetched per query; the best one is kept
DELAY_SEC = 0.3  # pause between drugs (stays far below 240 requests/minute)

# Sections that make a label useful for answers; used to rank candidate labels.
USEFUL_FIELDS = (
    "boxed_warning",
    "indications_and_usage",
    "dosage_and_administration",
    "contraindications",
    "warnings_and_cautions",
    "warnings",
    "adverse_reactions",
    "drug_interactions",
    "use_in_specific_populations",
)


@dataclass
class DownloadResult:
    downloaded: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)


def slug(drug: str) -> str:
    """File name for a drug: 'folic acid' -> 'folic-acid'."""
    return re.sub(r"[^a-z0-9]+", "-", drug.lower()).strip("-")


def queries(drug: str) -> list[str]:
    """openFDA search strings, strictest first.

    1. the whole generic_name equals the drug ("ACETAMINOPHEN"), so combinations are not picked
    2. the drug is a phrase inside generic_name (finds "AMOXICILLIN AND CLAVULANATE POTASSIUM")
    """
    name = drug.strip().replace('"', "")
    return [
        f'openfda.generic_name.exact:"{name.upper()}"',
        f'openfda.generic_name:"{name}"',
    ]


def _score(label: dict, drug: str) -> tuple:
    """Rank a candidate: exact generic match, then more useful sections, then the newest label."""
    generics = [g.lower() for g in label.get("openfda", {}).get("generic_name", [])]
    exact = drug.lower() in generics
    sections = sum(1 for f in USEFUL_FIELDS if label.get(f))
    return (exact, sections, label.get("effective_time", ""))


def pick_label(results: list[dict], drug: str) -> dict | None:
    """The best label of one search, or None when there are no results."""
    return max(results, key=lambda r: _score(r, drug)) if results else None


def _retryable(exc: BaseException) -> bool:
    """Retry on network errors, 429 (rate limit) and 5xx; never on 404 (= no match)."""
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return code == 429 or code >= 500
    return isinstance(exc, httpx.TransportError)


async def search(
    client: httpx.AsyncClient, query: str, api_key: str | None, *, retry_wait: float = 2.0
) -> list[dict]:
    """One openFDA search. A 404 means "no match": an empty list, not an error."""
    params = {"search": query, "limit": CANDIDATES}
    if api_key:
        params["api_key"] = api_key
    async for attempt in AsyncRetrying(
        retry=retry_if_exception(_retryable),
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=retry_wait, max=30),
        reraise=True,
    ):
        with attempt:
            res = await client.get(LABEL_URL, params=params)
            if res.status_code == 404:
                return []
            if res.is_error:
                # Our own message: httpx's default one contains the full URL, including api_key.
                raise httpx.HTTPStatusError(
                    f"openFDA {res.status_code} for {query!r}", request=res.request, response=res
                )
            return res.json().get("results", [])
    return []  # not reached: tenacity either returns above or re-raises


async def fetch_label(
    client: httpx.AsyncClient, drug: str, api_key: str | None, *, retry_wait: float = 2.0
) -> tuple[str, dict] | None:
    """Try each query until one finds a label. Returns (query, label) or None."""
    for query in queries(drug):
        label = pick_label(await search(client, query, api_key, retry_wait=retry_wait), drug)
        if label:
            return query, label
    return None


def read_drugs(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip() and not line.startswith("#")]


async def download(
    client: httpx.AsyncClient,
    drugs: list[str],
    raw_dir: Path,
    *,
    api_key: str | None = None,
    force: bool = False,
    delay: float = DELAY_SEC,
    retry_wait: float = 2.0,
) -> DownloadResult:
    """Download a label for each drug into raw_dir. Errors other than 'not found' stop the run."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    result = DownloadResult()
    for i, drug in enumerate(drugs):
        target = raw_dir / f"{slug(drug)}.json"
        if target.exists() and not force:
            result.skipped.append(drug)
            continue
        if i and delay:
            await asyncio.sleep(delay)
        found = await fetch_label(client, drug, api_key, retry_wait=retry_wait)
        if not found:
            result.missing.append(drug)
            continue
        query, label = found
        record = {
            "drug": drug,
            "query": query,
            "downloaded_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "label": label,
        }
        target.write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
        result.downloaded.append(drug)
    return result


async def run(
    *, api_key: str | None = None, force: bool = False, limit: int | None = None
) -> DownloadResult:
    """CLI entry: data/drugs.txt -> data/raw/*.json + data/missing.txt."""
    drugs = read_drugs(DATA_DIR / "drugs.txt")[:limit]
    async with httpx.AsyncClient(timeout=30) as client:
        result = await download(client, drugs, DATA_DIR / "raw", api_key=api_key, force=force)
    (DATA_DIR / "missing.txt").write_text(
        "".join(f"{d}\n" for d in sorted(result.missing)), encoding="utf-8"
    )
    return result
