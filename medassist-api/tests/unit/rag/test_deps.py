"""app/rag/deps.py: which retrieval mode and reranker the settings give."""

import httpx
from pydantic import SecretStr

from app.config import Settings
from app.rag.deps import create_rag_deps, retrieval_mode


def settings(**kw) -> Settings:
    return Settings(
        supabase_url="https://x.supabase.co",
        supabase_service_key=SecretStr("k"),
        groq_api_key=SecretStr("g"),
        gemini_api_key=SecretStr("m"),
        _env_file=None,
        **kw,
    )


def test_default_is_vector_without_reranker():
    s = settings()
    deps = create_rag_deps(None, s, httpx.AsyncClient())
    assert retrieval_mode(s) == deps.retrieval_mode == "vector"
    assert deps.reranker is None


def test_rerank_enabled_uses_the_configured_model():
    s = settings(rerank_enabled=True, rerank_model="ms-marco-MiniLM-L-12-v2")
    deps = create_rag_deps(None, s, httpx.AsyncClient())
    assert deps.retrieval_mode == "hybrid_rerank"
    assert deps.reranker.model_name == "ms-marco-MiniLM-L-12-v2"


def test_hybrid_mode_from_settings():
    assert retrieval_mode(settings(retrieval_mode="hybrid")) == "hybrid"
