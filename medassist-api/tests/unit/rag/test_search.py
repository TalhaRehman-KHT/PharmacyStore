"""hybrid_search wrapper (live parameter names, row mapping) and the reranker (order, top_n)."""

import pytest

from app.rag.rerank import Reranker
from app.rag.search import SearchHit, hybrid_search
from tests.fakes import RPC_PARAMS, FakeError

ROW = {
    "chunk_id": "11111111-1111-1111-1111-111111111111",
    "content": "Ibuprofen may increase the risk of bleeding with warfarin.",
    "drug_name": "ibuprofen",
    "section": "drug_interactions",
    "vector_rank": 2,
    "keyword_rank": None,
    "rrf_score": 1 / 62,
}


def _register(db, rows):
    calls = []

    def handler(params):
        calls.append(params)
        return rows

    db.rpc_handlers["hybrid_search"] = handler
    return calls


def test_live_signature_is_recorded():
    assert RPC_PARAMS["hybrid_search"] == (
        "query_embedding",
        "query_text",
        "match_count",
        "drug_filter",
    )


async def test_wrapper_sends_live_parameter_names(db):
    calls = _register(db, [])

    await hybrid_search(db, [0.1] * 768, "warfarin", match_count=7, drug_filter="ibuprofen")

    assert calls == [
        {
            "query_embedding": [0.1] * 768,
            "query_text": "warfarin",
            "match_count": 7,
            "drug_filter": "ibuprofen",
        }
    ]


async def test_wrapper_defaults(db):
    calls = _register(db, [])

    await hybrid_search(db, [0.0], "")

    assert calls[0]["match_count"] == 20
    assert calls[0]["drug_filter"] is None
    assert calls[0]["query_text"] == ""


async def test_wrong_parameter_name_fails(db):
    _register(db, [])
    with pytest.raises(FakeError, match="live signature"):
        await db.rpc("hybrid_search", {"embedding": [0.0], "query": "x"}).execute()


async def test_rows_are_mapped_to_typed_hits(db):
    _register(db, [ROW, {**ROW, "chunk_id": "c2", "vector_rank": None, "keyword_rank": 1}])

    hits = await hybrid_search(db, [0.0], "warfarin")

    assert hits[0] == SearchHit(
        chunk_id=ROW["chunk_id"],
        content=ROW["content"],
        drug_name="ibuprofen",
        section="drug_interactions",
        vector_rank=2,
        keyword_rank=None,
        rrf_score=pytest.approx(1 / 62),
    )
    assert hits[1].vector_rank is None and hits[1].keyword_rank == 1
    assert hits[0].rerank_score is None


async def test_no_rows_gives_empty_list(db):
    _register(db, None)
    assert await hybrid_search(db, [0.0], "x") == []


class FakeRanker:
    """Scores a passage by how often 'warfarin' appears; returns results unsorted on purpose."""

    def __init__(self):
        self.requests = []

    def rerank(self, request):
        self.requests.append(request)
        return [{"id": p["id"], "score": p["text"].count("warfarin")} for p in request.passages]


def _hit(i: int, text: str) -> SearchHit:
    return SearchHit(f"c{i}", text, "ibuprofen", "warnings", i, None, 1 / (60 + i))


async def test_reranker_orders_by_score_and_keeps_top_n():
    hits = [_hit(1, "no match"), _hit(2, "warfarin warfarin"), _hit(3, "warfarin")]
    ranker = FakeRanker()

    out = await Reranker(ranker, top_n=2).rerank("ibuprofen with warfarin", hits)

    assert [h.chunk_id for h in out] == ["c2", "c3"]
    assert [h.rerank_score for h in out] == [2.0, 1.0]
    assert out[0].rrf_score == hits[1].rrf_score  # the rest of the hit is unchanged
    assert ranker.requests[0].query == "ibuprofen with warfarin"


async def test_reranker_default_top_n_is_5():
    hits = [_hit(i, "warfarin " * i) for i in range(1, 9)]

    out = await Reranker(FakeRanker()).rerank("q", hits)

    assert [h.chunk_id for h in out] == ["c8", "c7", "c6", "c5", "c4"]


async def test_reranker_empty_input_skips_the_model():
    ranker = FakeRanker()
    assert await Reranker(ranker).rerank("q", []) == []
    assert ranker.requests == []
