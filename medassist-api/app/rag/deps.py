"""Everything an answer pipeline needs, created once at startup (app/main.py lifespan).

Tests build a RagDeps with fakes (tests/fakes/rag.py) instead of real API clients.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import Settings
from app.llm.providers import LLM, get_llm
from app.rag.embed import embedder_from_settings
from app.rag.rerank import Reranker


@dataclass(frozen=True)
class RagDeps:
    db: Any  # async Supabase client (hybrid_search RPC, drug_documents)
    embedder: Any  # embed_query(text) -> vector; .model = embedding model name
    reranker: Any  # rerank(query, hits, top_n) -> hits
    answer_llm: Callable[[], LLM]  # a NEW LLM per request (LLM.last_usage is per call)


def create_rag_deps(db: Any, settings: Settings, http: httpx.AsyncClient) -> RagDeps:
    """Real dependencies: Gemini query embeddings, FlashRank (loaded on first use), Groq answers."""
    return RagDeps(
        db=db,
        embedder=embedder_from_settings(http, settings, cache_dir=None),
        reranker=Reranker(),
        answer_llm=lambda: get_llm("answer", settings),
    )
