"""Async wrapper around the hybrid_search RPC (vector + keyword, RRF).

The SQL lives in sql/006_hybrid_search.sql; only the service role may execute it. PostgREST finds
the function by its parameter NAMES, so the dict keys below must match the live signature
(docs/DB_SCHEMA.md).
"""

from dataclasses import dataclass
from typing import Any

DEFAULT_MATCH_COUNT = 20  # candidates for the reranker (Decisions: rerank 20 -> 5)


@dataclass(frozen=True)
class SearchHit:
    """One chunk returned by hybrid_search. A rank is None when that list did not find the chunk."""

    chunk_id: str
    content: str
    drug_name: str
    section: str
    vector_rank: int | None
    keyword_rank: int | None
    rrf_score: float
    rerank_score: float | None = None  # filled in by app.rag.rerank


async def hybrid_search(
    db: Any,
    query_embedding: list[float],
    query_text: str,
    *,
    match_count: int = DEFAULT_MATCH_COUNT,
    drug_filter: str | None = None,
) -> list[SearchHit]:
    """Best chunks first. An empty query_text means vector-only search (no keyword hits)."""
    res = await db.rpc(
        "hybrid_search",
        {
            "query_embedding": query_embedding,
            "query_text": query_text,
            "match_count": match_count,
            "drug_filter": drug_filter,
        },
    ).execute()
    return [
        SearchHit(
            chunk_id=str(row["chunk_id"]),
            content=row["content"],
            drug_name=row["drug_name"],
            section=row["section"],
            vector_rank=row["vector_rank"],
            keyword_rank=row["keyword_rank"],
            rrf_score=float(row["rrf_score"]),
        )
        for row in res.data or []
    ]
