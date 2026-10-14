"""Gemini embeddings API stand-in (httpx.MockTransport). No network."""

import json

import httpx

from app.rag.embed import Embedder

DIM = 8
KEY = "secret-test-key"


class FakeGemini:
    """Answers batchEmbedContents with a deterministic vector per text; can fail first N calls."""

    def __init__(self, dim: int = DIM, fail_first: int = 0, status: int = 429) -> None:
        self.dim, self.fail_first, self.status = dim, fail_first, status
        self.calls: list[dict] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.calls.append({"body": body, "headers": request.headers, "url": str(request.url)})
        if len(self.calls) <= self.fail_first:
            return httpx.Response(self.status, json={"error": "busy"})
        vectors = [
            {"values": [float(len(r["content"]["parts"][0]["text"]) + i) for i in range(self.dim)]}
            for r in body["requests"]
        ]
        return httpx.Response(200, json={"embeddings": vectors})

    def embedder(self, cache_dir=None, dim: int = DIM) -> Embedder:
        client = httpx.AsyncClient(transport=httpx.MockTransport(self.handler))
        return Embedder(
            client, KEY, "gemini-embedding-001", dim, cache_dir=cache_dir, delay=0, retry_wait=0
        )


def daily_quota_429() -> httpx.Response:
    """Google's real 429 shape when the per-DAY free-tier quota is used up."""
    return httpx.Response(
        429,
        json={
            "error": {
                "code": 429,
                "details": [
                    {
                        "violations": [
                            {
                                "quotaId": "EmbedContentRequestsPerDayPerUserPerProjectPerModel"
                                "-FreeTier",
                                "quotaValue": "1000",
                            }
                        ]
                    },
                    {"retryDelay": "7200s"},
                ],
            }
        },
    )


class DailyLimitGemini(FakeGemini):
    """Embeds at most `allowed` texts, then answers with the daily-quota 429."""

    def __init__(self, allowed: int) -> None:
        super().__init__()
        self.allowed = allowed

    def handler(self, request: httpx.Request) -> httpx.Response:
        n = len(json.loads(request.content)["requests"])
        if n > self.allowed:
            self.calls.append({"body": json.loads(request.content)})
            return daily_quota_429()
        self.allowed -= n
        return super().handler(request)
