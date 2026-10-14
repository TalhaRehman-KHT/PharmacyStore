"""app/rag/model_guard.py + repositories.knowledge.chunk_inventory (FakeSupabase, no network)."""

from collections import Counter

import pytest

from app.rag import model_guard as g
from app.repositories import knowledge
from tests.fakes import FakeSupabase

MODEL = "gemini-embedding-001"


def seed_chunks(db: FakeSupabase, models: list[str | None]) -> None:
    for i, m in enumerate(models):
        meta = {"field": "warnings"} if m is None else {"field": "warnings", g.MODEL_KEY: m}
        db.seed("drug_chunks", document_id="D1", chunk_index=i, metadata=meta)


def test_same_model_and_legacy_rows_pass():
    g.check_models(Counter({MODEL: 5, None: 3}), MODEL)
    g.check_models(Counter(), MODEL)


def test_other_model_raises_with_names_and_counts():
    with pytest.raises(g.EmbeddingModelMismatch, match=r"local-768 \(2 chunks\).*'gemini"):
        g.check_models(Counter({MODEL: 5, "local-768": 2}), MODEL)


async def test_db_models_pages_through_all_rows(monkeypatch):
    monkeypatch.setattr(knowledge, "PAGE", 2)
    db = FakeSupabase()
    seed_chunks(db, [MODEL, MODEL, None, MODEL, "other"])
    assert await g.db_models(db) == Counter({MODEL: 3, None: 1, "other": 1})
    assert db.queries == 3  # pages of 2, 2, 1


async def test_ensure_db_model_checks_once_per_process(monkeypatch):
    monkeypatch.setattr(g, "_checked", set())
    db = FakeSupabase()
    seed_chunks(db, [MODEL, None])
    await g.ensure_db_model(db, MODEL)
    await g.ensure_db_model(db, MODEL)
    assert db.queries == 1


async def test_ensure_db_model_refuses_a_mixed_db(monkeypatch):
    monkeypatch.setattr(g, "_checked", set())
    db = FakeSupabase()
    seed_chunks(db, [MODEL, "other"])
    with pytest.raises(g.EmbeddingModelMismatch):
        await g.ensure_db_model(db, MODEL)
    with pytest.raises(g.EmbeddingModelMismatch):  # a failed check is not remembered
        await g.ensure_db_model(db, MODEL)
