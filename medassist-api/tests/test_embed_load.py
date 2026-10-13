"""Embeddings + load. No network or DB: Gemini = httpx.MockTransport, Supabase = FakeSupabase."""

import json
import math

import httpx
import pytest

from app.ingest.load import load, read_chunks
from app.rag.embed import BATCH_SIZE, Embedder, l2_normalize
from tests.fakes import FakeSupabase

DIM = 8
KEY = "secret-test-key"


class FakeGemini:
    """Answers batchEmbedContents with a deterministic vector per text; can fail first N calls."""

    def __init__(self, dim: int = DIM, fail_first: int = 0, status: int = 429) -> None:
        self.dim, self.fail_first, self.status = dim, fail_first, status
        self.calls: list[dict] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.calls.append({"body": body, "headers": request.headers, "url": str(request.url)})
        if len(self.calls) <= self.fail_first:
            return httpx.Response(self.status, json={"error": "busy"})
        vectors = [
            {"values": [float(len(r["content"]["parts"][0]["text"]) + i) for i in range(self.dim)]}
            for r in body["requests"]
        ]
        return httpx.Response(200, json={"embeddings": vectors})

    def embedder(self, cache_dir=None, dim: int = DIM) -> Embedder:
        client = httpx.AsyncClient(transport=httpx.MockTransport(self.handler))
        return Embedder(
            client, KEY, "gemini-embedding-001", dim, cache_dir=cache_dir, delay=0, retry_wait=0
        )


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


# ---------- embed.py ----------


def test_l2_normalize():
    v = l2_normalize([3.0, 4.0])
    assert v == pytest.approx([0.6, 0.8])
    assert l2_normalize([0.0, 0.0]) == [0.0, 0.0]


async def test_documents_are_batched_normalised_and_typed():
    gemini = FakeGemini()
    texts = [f"chunk {i}" for i in range(BATCH_SIZE + 5)]
    vectors = await gemini.embedder().embed_documents(texts)

    assert len(vectors) == len(texts)
    assert [len(c["body"]["requests"]) for c in gemini.calls] == [BATCH_SIZE, 5]
    assert all(math.isclose(math.fsum(x * x for x in v), 1.0) for v in vectors)
    req = gemini.calls[0]["body"]["requests"][0]
    assert req["taskType"] == "RETRIEVAL_DOCUMENT" and req["outputDimensionality"] == DIM
    assert req["model"] == "models/gemini-embedding-001"


async def test_query_uses_query_task_type():
    gemini = FakeGemini()
    v = await gemini.embedder().embed_query("can I take ibuprofen with warfarin?")
    assert len(v) == DIM
    assert gemini.calls[0]["body"]["requests"][0]["taskType"] == "RETRIEVAL_QUERY"


async def test_key_goes_in_header_never_in_url_or_error():
    gemini = FakeGemini(fail_first=99, status=400)
    with pytest.raises(httpx.HTTPStatusError) as err:
        await gemini.embedder().embed_documents(["x"])
    assert gemini.calls[0]["headers"]["x-goog-api-key"] == KEY
    assert KEY not in gemini.calls[0]["url"]
    assert KEY not in str(err.value)
    assert len(gemini.calls) == 1  # 400 is not retried


async def test_retry_on_429_and_5xx_then_success():
    for status in (429, 503):
        gemini = FakeGemini(fail_first=2, status=status)
        vectors = await gemini.embedder().embed_documents(["a", "b"])
        assert len(vectors) == 2 and len(gemini.calls) == 3


async def test_cache_hit_makes_no_api_call(tmp_path):
    texts = ["one", "two", "three"]
    first = FakeGemini()
    v1 = await first.embedder(cache_dir=tmp_path).embed_documents(texts)
    assert len(first.calls) == 1

    second = FakeGemini()
    emb = second.embedder(cache_dir=tmp_path)
    v2 = await emb.embed_documents([*texts, "four"])
    assert v2[:3] == v1
    assert emb.cache_hits == 3
    assert [len(c["body"]["requests"]) for c in second.calls] == [1]  # only "four"


async def test_wrong_size_vector_is_never_cached(tmp_path):
    bad = FakeGemini(dim=DIM - 1)
    await bad.embedder(cache_dir=tmp_path, dim=DIM).embed_documents(["x"])
    assert list(tmp_path.iterdir()) == []


# ---------- load.py ----------


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


# ---------- daily free-tier quota ----------


def daily_quota_429() -> httpx.Response:
    """Google's real 429 shape when the per-DAY free-tier quota is used up."""
    return httpx.Response(
        429,
        json={
            "error": {
                "code": 429,
                "details": [
                    {
                        "violations": [
                            {
                                "quotaId": "EmbedContentRequestsPerDayPerUserPerProjectPerModel"
                                "-FreeTier",
                                "quotaValue": "1000",
                            }
                        ]
                    },
                    {"retryDelay": "7200s"},
                ],
            }
        },
    )


class DailyLimitGemini(FakeGemini):
    """Embeds at most `allowed` texts, then answers with the daily-quota 429."""

    def __init__(self, allowed: int) -> None:
        super().__init__()
        self.allowed = allowed

    def handler(self, request: httpx.Request) -> httpx.Response:
        n = len(json.loads(request.content)["requests"])
        if n > self.allowed:
            self.calls.append({"body": json.loads(request.content)})
            return daily_quota_429()
        self.allowed -= n
        return super().handler(request)


async def test_daily_quota_stops_at_once_without_retries():
    from app.rag.embed import DailyQuotaExceeded

    gemini = DailyLimitGemini(allowed=0)
    with pytest.raises(DailyQuotaExceeded) as err:
        await gemini.embedder().embed_documents(["x"])
    assert len(gemini.calls) == 1  # a per-day 429 is never retried
    assert err.value.retry_after_s == 7200


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


async def test_per_minute_429_is_still_retried():
    gemini = FakeGemini(fail_first=1, status=429)  # body has no PerDay quota -> per minute
    assert len(await gemini.embedder().embed_documents(["a"])) == 1
    assert len(gemini.calls) == 2
