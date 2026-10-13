"""Integration fixtures: the REAL Supabase, used only with RUN_INTEGRATION=1.

Safety: tests touch only rows they create, for ITEST_USER_EMAIL's user, prefixed `[itest]`.
Values are read from medassist-api/.env and the real environment; they are never printed.
"""

import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from pydantic import ValidationError
from supabase import AsyncClient, acreate_client

from app.config import Settings
from app.db.client import create_db
from tests.conftest import REAL_ENV

PREFIX = "[itest]"
ROOT = Path(__file__).resolve().parents[2]


def pytest_collection_modifyitems(config, items):
    if os.environ.get("RUN_INTEGRATION") == "1":
        return
    skip = pytest.mark.skip(reason="integration test: set RUN_INTEGRATION=1 to run")
    for item in items:
        if item.get_closest_marker("integration"):
            item.add_marker(skip)


def real_values() -> dict[str, str]:
    """.env values with the real environment on top (the root conftest replaced os.environ)."""
    values = {k: v for k, v in dotenv_values(ROOT / ".env").items() if v}
    values.update({k: v for k, v in REAL_ENV.items() if v})
    return values


@pytest.fixture
def real_settings() -> Settings:
    values = real_values()
    # Without these the fake test values left in os.environ would be used instead.
    missing = [n for n in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY") if n not in values]
    if missing:
        pytest.skip("integration settings missing: " + ", ".join(missing))
    try:
        return Settings(_env_file=None, **{k.lower(): v for k, v in values.items()})
    except ValidationError as exc:
        names = sorted({str(err["loc"][0]).upper() for err in exc.errors() if err["loc"]})
        pytest.skip("integration settings missing or invalid: " + ", ".join(names))


@pytest.fixture
async def live_db(real_settings) -> AsyncClient:
    """Service-role client, created the same way the app creates it."""
    return await create_db(real_settings)


@pytest.fixture
async def anon_db(real_settings) -> AsyncClient:
    """Client with the browser's anon key; skips when SUPABASE_ANON_KEY is not set."""
    key = real_values().get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not key:
        pytest.skip("SUPABASE_ANON_KEY not set")
    return await acreate_client(real_settings.supabase_url, key)


@pytest.fixture
async def itest_user(live_db) -> str:
    """Id of an existing, active public.users row named by ITEST_USER_EMAIL."""
    email = os.environ.get("ITEST_USER_EMAIL")
    if not email:
        pytest.skip("ITEST_USER_EMAIL not set")
    res = await live_db.table("users").select("id, is_active").eq("email", email).execute()
    if not res.data or not res.data[0]["is_active"]:
        pytest.skip("ITEST_USER_EMAIL does not match an active public.users row")
    return res.data[0]["id"]


async def _delete_itest_sessions(db: AsyncClient, user_id: str) -> None:
    """Delete only this user's `[itest]` sessions; messages, escalations and feedback cascade."""
    await (
        db.table("chat_sessions")
        .delete()
        .eq("user_id", user_id)
        .like("title", f"{PREFIX}%")
        .execute()
    )


@pytest.fixture
async def itest_cleanup(live_db, itest_user):
    """Clean before (leftovers of a crashed run) and after every test."""
    await _delete_itest_sessions(live_db, itest_user)
    try:
        yield
    finally:
        await _delete_itest_sessions(live_db, itest_user)
