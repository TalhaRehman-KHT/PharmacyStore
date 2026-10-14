"""rag/embed.py. No network: Gemini = httpx.MockTransport."""

import math

import httpx
import pytest

from app.rag.embed import BATCH_SIZE, DailyQuotaExceeded, l2_normalize
from tests.fakes.gemini import DIM, KEY, DailyLimitGemini, FakeGemini


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


async def test_daily_quota_stops_at_once_without_retries():
    gemini = DailyLimitGemini(allowed=0)
    with pytest.raises(DailyQuotaExceeded) as err:
        await gemini.embedder().embed_documents(["x"])
    assert len(gemini.calls) == 1  # a per-day 429 is never retried
    assert err.value.retry_after_s == 7200


async def test_per_minute_429_is_still_retried():
    gemini = FakeGemini(fail_first=1, status=429)  # body has no PerDay quota -> per minute
    assert len(await gemini.embedder().embed_documents(["a"])) == 1
    assert len(gemini.calls) == 2
