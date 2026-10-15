"""ingest/resume.py: what embed-load --resume skips and in which order (FakeSupabase)."""

from app.ingest.load import load
from app.ingest.resume import PRIORITY, done_labels, pending, prioritize
from tests.fakes import FakeSupabase
from tests.fakes.gemini import DailyLimitGemini, FakeGemini
from tests.unit.ingest.test_load import chunk_row

MODEL = "gemini-embedding-001"


def named(label: str, drug: str, n: int) -> list[dict]:
    rows = [chunk_row(label, i) for i in range(n)]
    for r in rows:
        r["drug_name"] = r["document"]["generic_name"] = drug
    return rows


def test_priority_drugs_first_then_alphabetical():
    docs = {
        "A": named("A", "zinc", 1),
        "B": named("B", "losartan", 1),
        "C": named("C", "amlodipine", 1),
        "D": named("D", "Ibuprofen", 1),
        "E": named("E", "metformin", 1),
    }
    order = [c[0]["drug_name"] for c in prioritize(docs).values()]
    assert order == ["Ibuprofen", "metformin", "losartan", "amlodipine", "zinc"]
    assert PRIORITY[:3] == ("ibuprofen", "metformin", "omeprazole")


async def test_done_means_every_chunk_in_db_with_this_model(tmp_path):
    db = FakeSupabase()
    docs = {"L1": named("L1", "aspirin", 2), "L2": named("L2", "atenolol", 2)}
    await load(db, FakeGemini().embedder(cache_dir=tmp_path), docs)
    assert await done_labels(db, docs, MODEL) == {"L1", "L2"}

    l2 = next(d["id"] for d in db.rows("drug_documents") if d["label_id"] == "L2")
    rows = [c for c in db.rows("drug_chunks") if c["document_id"] == l2]
    rows[0]["metadata"].pop("embedding_model")  # legacy row -> not done with this model
    rows[1]["embedding"] = None
    assert await done_labels(db, docs, MODEL) == {"L1"}
    assert await done_labels(db, docs, "other-model") == set()

    # the file now has more chunks for L1 (re-chunked): not done any more
    docs["L1"] = named("L1", "aspirin", 3)
    assert await done_labels(db, docs, MODEL) == set()


async def test_resume_twice_costs_nothing_and_adds_no_rows(tmp_path):
    db = FakeSupabase()
    docs = {"L1": named("L1", "aspirin", 3), "L2": named("L2", "ibuprofen", 3)}

    # day 1: quota for 4 texts, batches of 3 -> only the first (priority) document is loaded
    emb = DailyLimitGemini(allowed=4).embedder(cache_dir=tmp_path)
    emb.batch_size = 3
    todo = await pending(db, docs, MODEL)
    assert list(todo) == ["L2", "L1"]  # ibuprofen first
    day1 = await load(db, emb, todo)
    assert day1.quota_stop and (day1.documents_loaded, day1.chunks_waiting) == (1, 3)
    assert [d["label_id"] for d in db.rows("drug_documents")] == ["L2"]

    # day 2: only aspirin is left; ibuprofen is not even sent to the embedder
    todo = await pending(db, docs, MODEL)
    assert list(todo) == ["L1"]
    gemini = FakeGemini()
    day2 = await load(db, gemini.embedder(cache_dir=tmp_path), todo)
    assert (day2.documents_loaded, day2.chunks_waiting, day2.cache_hits) == (1, 0, 0)

    # day 3: nothing to do; no rows were duplicated
    assert await pending(db, docs, MODEL) == {}
    assert len(db.rows("drug_documents")) == 2 and len(db.rows("drug_chunks")) == 6
