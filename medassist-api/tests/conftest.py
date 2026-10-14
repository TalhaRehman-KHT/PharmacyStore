"""Shared fixtures. Tests use fake settings and never read .env or call Supabase."""

import os
import time
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app import config
from tests.fakes import FakeSupabase
from tests.fakes.rag import FakeRag

TEST_ENV = {
    "APP_ENV": "dev",
    "APP_VERSION": "0.0.0-test",
    "SUPABASE_URL": "http://supabase.test",
    "SUPABASE_SERVICE_KEY": "test-service-key",
    "GROQ_API_KEY": "test-groq-key",
    "GEMINI_API_KEY": "test-gemini-key",
    "SUPABASE_JWT_SECRET": "test-jwt-secret-at-least-32-bytes-long",
}

# The real values, saved before they are replaced; only tests/integration reads them.
REAL_ENV = {name: os.environ.get(name) for name in TEST_ENV}

# Must happen before app.main is imported, because it builds the app at import time.
config.Settings.model_config["env_file"] = None
os.environ.update(TEST_ENV)
config.get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """The limiter is module-level and in-memory; start every test with a fresh budget."""
    from app.rate_limit import limiter

    limiter.reset()
    yield


@pytest.fixture
def db() -> FakeSupabase:
    fake = FakeSupabase()
    fake.register_answer_escalation()
    return fake


@pytest.fixture
def rag(db) -> FakeRag:
    """Fake embedder / reranker / answer LLM on the in-memory `db` (set rows / reply per test)."""
    return FakeRag(db)


@pytest.fixture
def client(monkeypatch, db, rag):
    """TestClient with the lifespan running; the app's Supabase client is the in-memory `db`
    and the RAG dependencies are `rag`'s fakes (no network)."""
    from app import main
    from app.api.deps import get_rag
    from app.db import client as db_client

    async def fake_create_db(_settings):
        return db

    monkeypatch.setattr(db_client, "create_db", fake_create_db)
    config.get_settings.cache_clear()
    app = main.create_app()
    app.dependency_overrides[get_rag] = rag.deps
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def supabase_mode(monkeypatch):
    """Run a test with AUTH_MODE=supabase (JWT). Request it before `client`."""
    monkeypatch.setenv("AUTH_MODE", "supabase")
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


@pytest.fixture
def make_user(db):
    """Seed a public.users row and return (user_id, auth headers): make_user("vendor").

    The headers work in both auth modes: X-User-Id (app_user_id) and a bearer token (supabase).
    """

    def _make(role: str = "user", name: str = "Ali Khan", is_active: bool = True):
        row = db.seed("users", name=name, role=role, is_active=is_active)
        return row["id"], {**bearer(make_token(row["id"])), "X-User-Id": row["id"]}

    return _make


def make_token(sub=None, *, exp_in=3600, aud="authenticated", secret=None, **claims) -> str:
    """HS256 token signed like a Supabase access token (test secret by default)."""
    now = int(time.time())
    payload = {
        "sub": str(sub or uuid4()),
        "aud": aud,
        "exp": now + exp_in,
        "iat": now,
        "role": "authenticated",
        **claims,
    }
    return jwt.encode(payload, secret or TEST_ENV["SUPABASE_JWT_SECRET"], algorithm="HS256")


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def set_role(monkeypatch):
    """Mock the public.users role lookup: set_role("vendor")."""
    from app.security import auth

    def _set(role):
        async def fake_fetch(_db, _user_id):
            return role

        monkeypatch.setattr(auth, "fetch_user_role", fake_fetch)

    return _set
