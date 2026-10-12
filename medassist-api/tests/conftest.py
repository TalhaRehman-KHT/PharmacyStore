"""Shared fixtures. Tests use fake settings and never read .env or call Supabase."""

import os
import time
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app import config
from tests.fakes import FakeSupabase

TEST_ENV = {
    "APP_ENV": "dev",
    "APP_VERSION": "0.0.0-test",
    "SUPABASE_URL": "http://supabase.test",
    "SUPABASE_SERVICE_KEY": "test-service-key",
    "GROQ_API_KEY": "test-groq-key",
    "GEMINI_API_KEY": "test-gemini-key",
    "SUPABASE_JWT_SECRET": "test-jwt-secret-at-least-32-bytes-long",
}

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
def client(monkeypatch, db):
    """TestClient with the lifespan running; the app's Supabase client is the in-memory `db`."""
    from app import main
    from app.db import client as db_client

    async def fake_create_db(_settings):
        return db

    monkeypatch.setattr(db_client, "create_db", fake_create_db)
    config.get_settings.cache_clear()
    with TestClient(main.create_app()) as test_client:
        yield test_client


@pytest.fixture
def make_user(db):
    """Seed a public.users row and return (user_id, auth headers): make_user("vendor")."""

    def _make(role: str = "user", name: str = "Ali Khan", is_active: bool = True):
        row = db.seed("users", name=name, role=role, is_active=is_active)
        return row["id"], bearer(make_token(row["id"]))

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
