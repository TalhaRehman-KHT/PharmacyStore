"""Tests for app/rag/retrieve.py (fake search and reranker, no database)."""

from app.rag import retrieve as r
from app.rag.search import SearchHit


def hit(i: int) -> SearchHit:
    return SearchHit(str(i), "text", "aspirin", "Warnings", i, None, 0.1)


async def test_default_is_hybrid_top_20_then_rerank_to_top_k(monkeypatch):
    seen = []

    async def fake_search(db, vector, text, *, match_count, drug_filter=None):
        seen.append((text, match_count))
        return [hit(i) for i in range(match_count)]

    class FakeReranker:
        async def rerank(self, query, hits, top_n=None):
            seen.append(("rerank", query, len(hits), top_n))
            return list(reversed(hits))[:top_n]

    monkeypatch.setattr(r, "hybrid_search", fake_search)
    out = await r.retrieve(None, FakeReranker(), "q", [0.0], top_k=3)
    assert seen == [("q", 20), ("rerank", "q", 20, 3)]
    assert [h.chunk_id for h in out] == ["19", "18", "17"]


async def test_rerank_false_is_vector_only_without_reranker(monkeypatch):
    seen = []

    async def fake_search(db, vector, text, *, match_count, drug_filter=None):
        seen.append((text, match_count))
        return [hit(i) for i in range(match_count)]

    monkeypatch.setattr(r, "hybrid_search", fake_search)
    out = await r.retrieve(None, None, "q", [0.0], rerank=False)
    assert seen == [("", r.TOP_K)]
    assert len(out) == r.TOP_K
