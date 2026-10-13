"""Offline tests for eval/retrieval_smoke.py (no Gemini, no database)."""

import json

from app.rag.search import SearchHit
from eval import retrieval_smoke as rs

Q = rs.Question("Can Panadol damage the liver?", "en", "acetaminophen", "Warnings")


def hit(drug: str, section: str, text: str = "Drug: x | Section: y\nbody") -> SearchHit:
    return SearchHit("id", text, drug, section, 1, None, 0.1)


def test_questions_file_has_20_rows_14_en_6_roman_urdu():
    qs = rs.read_questions()
    assert len(qs) == 20
    assert sum(q.language == "en" for q in qs) == 14
    assert sum(q.language == "roman_urdu" for q in qs) == 6
    assert any("500 mg" in q.question for q in qs)


def test_hit_needs_drug_and_section_inside_top_k():
    hits = [
        hit("acetaminophen", "Dosage and Administration"),  # right drug, wrong section
        hit("aspirin", "Warnings"),  # right section, wrong drug
        hit("Acetaminophen", "Warnings"),  # drug compare ignores case
    ]
    assert rs.first_hit_rank(hits, Q) == 3
    assert rs.first_hit_rank(hits, Q, k=2) is None


def test_score_recall_and_mrr():
    outs = [
        rs.Outcome(Q, "vector", 1, []),
        rs.Outcome(Q, "vector", 4, []),
        rs.Outcome(Q, "vector", None, []),
        rs.Outcome(Q, "vector", None, []),
    ]
    recall, mrr = rs.score(outs)
    assert recall == 0.5
    assert mrr == (1 + 0.25) / 4
    assert rs.score([]) == (0.0, 0.0)


async def test_query_vectors_cached_so_rerun_costs_no_call(tmp_path):
    calls = []

    async def embed(text):
        calls.append(text)
        return [0.1, 0.2]

    cache = tmp_path / "q.json"
    first = await rs.query_vectors([Q, Q], embed, "m", 2, cache)
    again = await rs.query_vectors([Q], embed, "m", 2, cache)
    assert first == [[0.1, 0.2], [0.1, 0.2]] and again == [[0.1, 0.2]]
    assert calls == [Q.question]  # one API call in total
    assert len(json.loads(cache.read_text("utf-8"))) == 1


async def test_pipelines_vector_uses_empty_text_and_hybrid_is_reranked(monkeypatch):
    seen = []

    async def fake_search(db, vector, text, *, match_count, drug_filter=None):
        seen.append((text, match_count))
        if text == "":
            return [hit("aspirin", "Warnings")] * 5  # vector only: a miss
        return [hit("aspirin", "Warnings")] * 19 + [hit("acetaminophen", "Warnings")]

    class FakeReranker:
        async def rerank(self, query, hits, top_n=None):
            return list(reversed(hits))[:top_n]  # puts the right chunk first

    monkeypatch.setattr(rs, "hybrid_search", fake_search)
    vec, hyb = await rs.run_pipelines(None, FakeReranker(), Q, [0.0])
    assert seen == [("", rs.K), (Q.question, 20)]
    assert (vec.mode, vec.rank) == ("vector", None)
    assert (hyb.mode, hyb.rank) == ("hybrid_rerank", 1)


def test_report_lists_groups_and_misses_with_top_3():
    ur = rs.Question("Panadol se liver kharab?", "roman_urdu", "acetaminophen", "Warnings")
    header = "Drug: aspirin | Section: Warnings\n"
    top = [hit("aspirin", "Warnings", f"{header}chunk {i}") for i in "abcd"]
    outs = [
        rs.Outcome(Q, "vector", 2, []),
        rs.Outcome(Q, "hybrid_rerank", 1, []),
        rs.Outcome(ur, "vector", None, top),
        rs.Outcome(ur, "hybrid_rerank", 1, []),
    ]
    md = rs.build_report(outs, "partial load")
    assert "partial load" in md
    assert "| vector only | all | 2 | 0.50 | 0.25 |" in md
    assert "| hybrid + rerank | roman_urdu | 1 | 1.00 | 1.00 |" in md
    assert "chunk c" in md and "chunk d" not in md  # only the top 3 of a miss
