"""FlashRank reranker: reduce the top 20 retrieved chunks to the top 5.

A small cross-encoder (runs on the CPU, no API call) reads the question and each chunk together,
which judges relevance better than RRF alone. The model (~4 MB) is downloaded on first use into
data/flashrank/ and loaded only once per process.
"""

import asyncio
from dataclasses import replace
from typing import Any

from app.paths import DATA_DIR
from app.rag.search import SearchHit

DEFAULT_TOP_N = 5
MODEL_NAME = "ms-marco-TinyBERT-L-2-v2"  # FlashRank's default (~4 MB)
STRONG_MODEL_NAME = "ms-marco-MiniLM-L-12-v2"  # bigger cross-encoder (~34 MB), compared in S4
CACHE_DIR = DATA_DIR / "flashrank"


class Reranker:
    """Wraps a flashrank.Ranker. Tests pass a fake `ranker` with the same rerank(request) method."""

    def __init__(
        self, ranker: Any = None, top_n: int = DEFAULT_TOP_N, model_name: str = MODEL_NAME
    ) -> None:
        self._ranker = ranker
        self.top_n = top_n
        self.model_name = model_name

    def _get_ranker(self) -> Any:
        if self._ranker is None:
            from flashrank import Ranker  # heavy import (onnxruntime): only when first needed

            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            self._ranker = Ranker(model_name=self.model_name, cache_dir=str(CACHE_DIR))
        return self._ranker

    def rerank_sync(
        self, query: str, hits: list[SearchHit], top_n: int | None = None
    ) -> list[SearchHit]:
        """The best `top_n` hits by cross-encoder score, each with rerank_score set."""
        if not hits:
            return []
        from flashrank import RerankRequest

        passages = [{"id": i, "text": h.content} for i, h in enumerate(hits)]
        results = self._get_ranker().rerank(RerankRequest(query=query, passages=passages))
        ranked = sorted(results, key=lambda r: float(r["score"]), reverse=True)
        return [
            replace(hits[r["id"]], rerank_score=float(r["score"]))
            for r in ranked[: top_n or self.top_n]
        ]

    async def rerank(
        self, query: str, hits: list[SearchHit], top_n: int | None = None
    ) -> list[SearchHit]:
        """Same as rerank_sync, in a worker thread so the event loop is not blocked."""
        return await asyncio.to_thread(self.rerank_sync, query, hits, top_n)
