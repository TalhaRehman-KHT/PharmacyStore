"""Application settings loaded from environment variables and .env."""

# settings from env
from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, ValidationError, field_validator, model_validator
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

    # app_user_id: trust the X-User-Id header like the main app does (CLAUDE.md "Hard rules").
    # supabase: verify a Supabase JWT (kept for when the main app gets real login).
    auth_mode: Literal["app_user_id", "supabase"] = "app_user_id"
    # Staff roles in public.users. All-access roles see every escalation; vendor-scoped
    # roles only their own pharmacy's (scoping itself is R10).
    staff_all_access_roles: list[str] = ["admin", "doctor"]
    staff_vendor_roles: list[str] = ["vendor"]

    groq_api_key: SecretStr
    gemini_api_key: SecretStr
    openfda_api_key: SecretStr | None = None
    langsmith_api_key: SecretStr | None = None  # set -> every agent node is traced (graph/build.py)
    langsmith_project: str = "medassist"

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

    # Retrieval (S4, on scripts/golden/questions.csv): vector-only had the best Recall@5 and MRR;
    # no FlashRank model beat plain hybrid, so reranking is off unless RERANK_ENABLED=true.
    retrieval_mode: Literal["vector", "hybrid"] = "vector"
    rerank_enabled: bool = False
    rerank_model: str = "ms-marco-MiniLM-L-12-v2"

    # Currency of medicine_batches.selling_price. The shop shows "$" and Stripe charges USD
    # (Server STRIPE_CURRENCY default), so product cards use the same.
    shop_currency: str = "USD"

    # Number in the fixed emergency text (guard.py) and the answer prompt. 1122 = Rescue (Pakistan).
    emergency_number: str = "1122"

    cors_origins: list[str] = ["http://localhost:5173"]
    # Questions per user, counted from chat_messages (app/rate_limit.py), so the limit survives
    # restarts and is shared by every container. Syntax "<n>/<second|minute|hour|day>".
    rate_limit: str = "20/hour"
    # Coarse per-IP abuse guard over the whole API (in memory, per process).
    ip_rate_limit: str = "60/minute"

    # Production
    log_level: str = "INFO"
    enable_docs: bool = False  # /docs + /openapi.json in prod (always on in dev)
    api_prefix: str = ""  # e.g. "/medassist" when a load balancer routes by path

    @field_validator("api_prefix")
    @classmethod
    def _prefix(cls, value: str) -> str:
        """'' or '/name' (leading slash added, trailing slash removed)."""
        value = value.strip().strip("/")
        return f"/{value}" if value else ""

    @model_validator(mode="after")
    def _prod_rules(self) -> "Settings":
        """In prod the browser origins must be real, explicit sites."""
        if self.app_env == "prod":
            bad = [o for o in self.cors_origins if "*" in o or "localhost" in o or "127.0.0.1" in o]
            if not self.cors_origins or bad:
                raise ValueError(
                    "CORS_ORIGINS must list the real site origins in prod (no localhost, no *)"
                )
        return self

    @property
    def docs_enabled(self) -> bool:
        return self.app_env == "dev" or self.enable_docs


@lru_cache
def get_settings() -> Settings:
    """Load settings once. Raises a readable error naming missing or invalid variables."""
    try:
        return Settings()
    except ValidationError as exc:
        names = sorted({str(err["loc"][0]).upper() for err in exc.errors() if err["loc"]})
        rules = [str(err["msg"]) for err in exc.errors() if not err["loc"]]  # _prod_rules
        raise RuntimeError(
            "Missing or invalid settings: " + ", ".join(names + rules) + ". Check "
            "medassist-api/.env (see .env.example)."
        ) from None
