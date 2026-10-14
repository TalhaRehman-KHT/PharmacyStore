"""ingest/load.py. No network or DB: Gemini = httpx.MockTransport, Supabase = FakeSupabase."""

import json

import pytest

from app.ingest.load import load, read_chunks, select_drugs
from app.rag.model_guard import EmbeddingModelMismatch
from tests.fakes import FakeSupabase
from tests.fakes.gemini import DIM, DailyLimitGemini, FakeGemini


def chunk_row(label_id: str, i: int, text: str = "text") -> dict:
    doc = {
        "label_id": label_id,
        "generic_name": f"drug-{label_id}",
        "brand_names": ["Brand"],
        "source_url": "https://example.test",
        "effective_date": "2024-03-15",
    }
    return {
        "document": doc,
        "label_id": label_id,
        "drug_name": doc["generic_name"],
        "section": "Warnings",
        "chunk_index": i,
        "content": f"Drug: {doc['generic_name']} | Section: Warnings\n{text} {i}",
        "metadata": {"field": "warnings"},
    }


def docs_of(counts: dict[str, int]) -> dict[str, list[dict]]:
    return {label: [chunk_row(label, i) for i in range(n)] for label, n in counts.items()}


async def test_load_writes_documents_and_chunks():
    db = FakeSupabase()
    report = await load(db, FakeGemini().embedder(), docs_of({"L1": 3, "L2": 2}))

    assert (report.documents, report.chunks_in_file, report.inserted) == (2, 5, 5)
    assert [d["label_id"] for d in db.rows("drug_documents")] == ["L1", "L2"]
    chunks = db.rows("drug_chunks")
    assert len(chunks) == 5 and all(len(c["embedding"]) == DIM for c in chunks)
    l1 = next(d["id"] for d in db.rows("drug_documents") if d["label_id"] == "L1")
    assert sorted(c["chunk_index"] for c in chunks if c["document_id"] == l1) == [0, 1, 2]
    assert set(chunks[0]) >= {"section", "drug_name", "content", "metadata"}


async def test_rerun_is_idempotent_and_leaves_no_stale_chunks(tmp_path):
    db = FakeSupabase()
    await load(db, FakeGemini().embedder(cache_dir=tmp_path), docs_of({"L1": 4, "L2": 2}))
    doc_ids = [d["id"] for d in db.rows("drug_documents")]

    gemini = FakeGemini()
    report = await load(db, gemini.embedder(cache_dir=tmp_path), docs_of({"L1": 4, "L2": 2}))
    assert len(db.rows("drug_documents")) == 2 and len(db.rows("drug_chunks")) == 6
    assert [d["id"] for d in db.rows("drug_documents")] == doc_ids  # upsert, not a new row
    assert gemini.calls == [] and report.cache_hits == 6  # second run costs no quota

    # L1 re-chunked into fewer chunks: the old chunks 2 and 3 must disappear
    await load(db, FakeGemini().embedder(cache_dir=tmp_path), docs_of({"L1": 2}))
    l1 = doc_ids[0]
    assert sorted(c["chunk_index"] for c in db.rows("drug_chunks") if c["document_id"] == l1) == [
        0,
        1,
    ]
    assert len(db.rows("drug_chunks")) == 4


async def test_dry_run_writes_nothing():
    db = FakeSupabase()
    gemini = FakeGemini()
    report = await load(db, gemini.embedder(), docs_of({"L1": 3}), dry_run=True)
    assert report.dry_run and report.embedded == 3 and report.inserted == 0
    assert db.queries == 0 and db.tables == {}
    assert len(gemini.calls) == 1


async def test_only_rows_with_the_right_dimension_are_inserted():
    db = FakeSupabase()
    report = await load(db, FakeGemini(dim=DIM - 1).embedder(dim=DIM), docs_of({"L1": 3}))
    assert report.embedded == 0 and report.skipped_bad_dim == 3 and report.inserted == 0
    assert db.rows("drug_chunks") == []


def test_read_chunks_groups_by_label_and_limits(tmp_path):
    path = tmp_path / "chunks.jsonl"
    rows = [chunk_row("A", 0), chunk_row("A", 1), chunk_row("B", 0), chunk_row("C", 0)]
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    assert {k: len(v) for k, v in read_chunks(path).items()} == {"A": 2, "B": 1, "C": 1}
    assert list(read_chunks(path, limit=2)) == ["A", "B"]


async def test_every_row_stores_the_embedding_model():
    db = FakeSupabase()
    await load(db, FakeGemini().embedder(), docs_of({"L1": 2}))
    metas = [c["metadata"] for c in db.rows("drug_chunks")]
    assert metas == [{"field": "warnings", "embedding_model": "gemini-embedding-001"}] * 2


async def test_legacy_rows_are_rewritten_with_the_model_tag(tmp_path):
    db = FakeSupabase()
    await load(db, FakeGemini().embedder(cache_dir=tmp_path), docs_of({"L1": 2}))
    for c in db.rows("drug_chunks"):
        c["metadata"].pop("embedding_model")  # as loaded before F5
    gemini = FakeGemini()
    await load(db, gemini.embedder(cache_dir=tmp_path), docs_of({"L1": 2}))
    assert gemini.calls == []  # backfill from the cache: no quota
    assert all(c["metadata"]["embedding_model"] for c in db.rows("drug_chunks"))


async def test_another_model_in_the_db_stops_before_any_api_call():
    db = FakeSupabase()
    db.seed("drug_chunks", document_id="X", chunk_index=0, metadata={"embedding_model": "other"})
    gemini = FakeGemini()
    with pytest.raises(EmbeddingModelMismatch):
        await load(db, gemini.embedder(), docs_of({"L1": 2}))
    assert gemini.calls == [] and db.rows("drug_documents") == []


def test_select_drugs_by_generic_name():
    docs = {
        "A": [chunk_row("A", 0)],
        "B": [chunk_row("B", 0)],
        "C": [chunk_row("C", 0)],
    }
    picked, unknown = select_drugs(docs, ["DRUG-C", " drug-a", "nope", ""])
    assert list(picked) == ["A", "C"]  # file order, case-insensitive
    assert unknown == ["nope"]


async def test_quota_stop_loads_only_fully_embedded_documents_then_resumes(tmp_path):
    db = FakeSupabase()
    docs = docs_of({"L1": 3, "L2": 3, "L3": 3})

    # day 1: batches of 3 texts; quota allows 4 texts -> only batch 1 (L1) succeeds
    emb = DailyLimitGemini(allowed=4).embedder(cache_dir=tmp_path)
    emb.batch_size = 3
    report = await load(db, emb, docs)
    assert report.quota_stop and report.quota_reset_s == 7200
    assert (report.documents_loaded, report.documents_waiting) == (1, 2)
    assert [d["label_id"] for d in db.rows("drug_documents")] == ["L1"]  # never half a label
    assert len(db.rows("drug_chunks")) == 3

    # day 2: same command, quota reset -> cache for L1, API for the rest, everything loaded
    gemini = FakeGemini()
    report = await load(
        db, gemini.embedder(cache_dir=tmp_path), docs_of({"L1": 3, "L2": 3, "L3": 3})
    )
    assert not report.quota_stop and report.cache_hits == 3
    assert (report.documents_loaded, report.documents_waiting) == (3, 0)
    assert len(db.rows("drug_documents")) == 3 and len(db.rows("drug_chunks")) == 9
