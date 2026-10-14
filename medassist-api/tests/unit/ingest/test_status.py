"""app/ingest/status.py (FakeSupabase; kb_counts is faked because it uses head/count queries)."""

from app.ingest import status
from app.repositories.knowledge import KbCounts
from tests.fakes import FakeSupabase
from tests.unit.ingest.test_load import docs_of

MODEL = "gemini-embedding-001"


async def test_status_counts_remaining_and_models(monkeypatch):
    async def fake_counts(db):
        return KbCounts(documents=1, chunks=3, with_embedding=3)

    monkeypatch.setattr(status, "kb_counts", fake_counts)
    db = FakeSupabase()
    d1 = db.seed("drug_documents", label_id="L1", generic_name="drug-L1")
    for i, m in enumerate([MODEL, MODEL, None]):
        meta = {} if m is None else {"embedding_model": m}
        db.seed("drug_chunks", document_id=d1["id"], chunk_index=i, metadata=meta)

    s = await status.embed_status(db, docs_of({"L1": 3, "L2": 4, "L3": 2}))
    assert (s.documents_file, s.chunks_file, s.chunks_waiting) == (3, 9, 6)
    assert s.loaded == ["drug-L1"] and s.waiting == ["drug-L2", "drug-L3"]
    assert s.models == {MODEL: 2, None: 1}

    text = status.render(s, MODEL)
    assert "remaining: 2" in text and "remaining: 6" in text
    assert "untagged (pre-F5): 1" in text and "WARNING" not in text
    s.models["other"] = 1
    assert "WARNING: other models in the DB: other" in status.render(s, MODEL)
