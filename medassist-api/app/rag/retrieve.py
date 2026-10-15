"""Retrieve pipeline: question + its vector -> the best chunks.

Modes (S4 measured them on eval/retrieval_smoke.csv, see PROGRESS.md "Observations"):
  vector         vector-only search (empty keyword text), top k
  hybrid         hybrid_search (vector + keyword, RRF), top k
  hybrid_rerank  hybrid_search top 20 -> cross-encoder reranker -> top k
The app picks hybrid_rerank only when settings.rerank_enabled is true (rag/deps.py).
"""

from typing import Any, Literal

from app.rag.model_guard import ensure_db_model
from app.rag.search import DEFAULT_MATCH_COUNT, SearchHit, hybrid_search

TOP_K = 4  # chunks in the prompt (S4: 4 instead of 5 keeps one answer under Groq's token budget)
Mode = Literal["vector", "hybrid", "hybrid_rerank"]


async def retrieve(
    db: Any,
    reranker: Any,
    query: str,
    vector: list[float],
    *,
    mode: Mode = "hybrid",
    top_k: int = TOP_K,
    embed_model: str | None = None,
    drug_filter: str | None = None,
) -> list[SearchHit]:
    """Best chunks first, at most top_k. embed_model = the model that made `vector`: the search
    refuses (EmbeddingModelMismatch) when the DB holds vectors of another model.
    drug_filter = search only the chunks of this drug (drug_chunks.drug_name), None = all."""
    if embed_model is not None:
        await ensure_db_model(db, embed_model)
    if mode == "vector":
        return await hybrid_search(db, vector, "", match_count=top_k, drug_filter=drug_filter)
    if mode == "hybrid":
        return await hybrid_search(db, vector, query, match_count=top_k, drug_filter=drug_filter)
    hits = await hybrid_search(
        db, vector, query, match_count=DEFAULT_MATCH_COUNT, drug_filter=drug_filter
    )
    return await reranker.rerank(query, hits, top_n=top_k)
