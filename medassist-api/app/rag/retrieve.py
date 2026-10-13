"""Retrieve pipeline: question + its vector -> the best chunks.

Default: hybrid_search (vector + keyword, RRF) top 20 -> FlashRank rerank -> top k.
rerank=False: vector-only search (empty keyword text), top k, no reranker.
Used by eval/retrieval_smoke.py now and by graph/nodes/retrieve.py later (Stage 6).
"""

from typing import Any

from app.rag.search import DEFAULT_MATCH_COUNT, SearchHit, hybrid_search

TOP_K = 5


async def retrieve(
    db: Any,
    reranker: Any,
    query: str,
    vector: list[float],
    *,
    rerank: bool = True,
    top_k: int = TOP_K,
) -> list[SearchHit]:
    """Best chunks first, at most top_k."""
    if not rerank:
        return await hybrid_search(db, vector, "", match_count=top_k)
    hits = await hybrid_search(db, vector, query, match_count=DEFAULT_MATCH_COUNT)
    return await reranker.rerank(query, hits, top_n=top_k)
