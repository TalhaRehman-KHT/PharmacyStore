"""Everything an answer pipeline needs, created once at startup (app/main.py lifespan)."""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import Settings
from app.graph.drugs import CatalogCache
from app.llm.providers import LLM, get_llm
from app.rag.embed import embedder_from_settings
from app.rag.rerank import Reranker
from app.rag.retrieve import Mode


@dataclass(frozen=True)
class RagDeps:
    db: Any  # async Supabase client (hybrid_search RPC, drug_documents)
    embedder: Any  # embed_query(text) -> vector; .model = embedding model name
    reranker: Any  # rerank(query, hits, top_n) -> hits; None when reranking is off
    answer_llm: Callable[[], LLM]  # a NEW LLM per request (LLM.last_usage is per call)
    retrieval_mode: Mode = "vector"
    # agent only: the fast LLM of router / rewrite / grade, the drug catalog, SHOP_CURRENCY
    fast_llm: Callable[[], LLM] | None = None
    catalog: CatalogCache = field(default_factory=CatalogCache)
    shop_currency: str = "USD"


def retrieval_mode(settings: Settings) -> Mode:
    """hybrid_rerank when RERANK_ENABLED, else RETRIEVAL_MODE (vector or hybrid)."""
    return "hybrid_rerank" if settings.rerank_enabled else settings.retrieval_mode


def create_rag_deps(db: Any, settings: Settings, http: httpx.AsyncClient) -> RagDeps:
    """Real dependencies: Gemini query embeddings, FlashRank only when enabled (loaded on first
    use), Groq answers with fallbacks."""
    return RagDeps(
        db=db,
        embedder=embedder_from_settings(http, settings, cache_dir=None),
        reranker=Reranker(model_name=settings.rerank_model) if settings.rerank_enabled else None,
        answer_llm=lambda: get_llm("answer", settings),
        retrieval_mode=retrieval_mode(settings),
        fast_llm=lambda: get_llm("fast", settings),
        shop_currency=settings.shop_currency,
    )
