"""Application settings loaded from environment variables and .env."""

# settings from env
from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration. Field names map to UPPER_CASE env variables."""

    # Empty values (e.g. `OPENFDA_API_KEY=`) count as unset, so defaults and "missing" checks apply.
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", env_ignore_empty=True, extra="ignore"
    )

    app_env: Literal["dev", "prod"] = "dev"
    app_version: str = "0.1.0"

    supabase_url: str
    supabase_service_key: SecretStr
    supabase_jwt_secret: SecretStr | None = None

    # app_user_id: trust the X-User-Id header like the main app does (docs/ARCHITECTURE.md s.4).
    # supabase: verify a Supabase JWT (kept for when the main app gets real login).
    auth_mode: Literal["app_user_id", "supabase"] = "app_user_id"
    # Staff roles in public.users. All-access roles see every escalation; vendor-scoped
    # roles only their own pharmacy's (scoping itself is R10).
    staff_all_access_roles: list[str] = ["admin", "doctor"]
    staff_vendor_roles: list[str] = ["vendor"]

    groq_api_key: SecretStr
    gemini_api_key: SecretStr
    openfda_api_key: SecretStr | None = None
    langsmith_api_key: SecretStr | None = None

    # Groq ids checked with GET /openai/v1/models (2026-10-14); llama-3.x ids are no longer listed.
    # All three chat models have the same free limits (8000 tokens/min, 1000 requests/day); qwen
    # cited most precisely in the S4 comparison. The backup model runs when the main one is busy.
    groq_fast_model: str = "openai/gpt-oss-20b"
    groq_answer_model: str = "qwen/qwen3.8-27b"
    groq_backup_model: str | None = "openai/gpt-oss-20b"
    gemini_embed_model: str = "gemini-embedding-001"
    # gemini-3.8-flash: 503/504 (overloaded) on 2026-10-14; 2.5-flash: 404 for new users.
    gemini_fallback_model: str = "gemini-3.5-flash"
    embed_dim: int = 768

    # Retrieval (S4, PROGRESS.md "Observations"): vector-only had the best Recall@5 and MRR;
    # no FlashRank model beat plain hybrid, so reranking is off unless RERANK_ENABLED=true.
    retrieval_mode: Literal["vector", "hybrid"] = "vector"
    rerank_enabled: bool = False
    rerank_model: str = "ms-marco-MiniLM-L-12-v2"

    cors_origins: list[str] = ["http://localhost:5173"]
    rate_limit: str = "20/hour"


@lru_cache
def get_settings() -> Settings:
    """Load settings once. Raises a readable error naming missing or invalid variables."""
    try:
        return Settings()
    except ValidationError as exc:
        names = sorted({str(err["loc"][0]).upper() for err in exc.errors() if err["loc"]})
        raise RuntimeError(
            "Missing or invalid settings: " + ", ".join(names) + ". Check medassist-api/.env "
            "(see .env.example)."
        ) from None
