"""graph/nodes retrieve, grade, no_evidence and the retry loop (fake LLMs, fake hybrid_search)."""

import pytest
from langgraph.graph import END, START, StateGraph

from app.baseline.naive import NO_EVIDENCE_TEXT
from app.graph.drugs import CatalogCache
from app.graph.nodes.grade import after_grade, grade, make_grade
from app.graph.nodes.no_evidence import URDU_NO_EVIDENCE, no_evidence
from app.graph.nodes.retrieve import CANDIDATES, make_retrieve, retrieve
from app.graph.nodes.rewrite import make_rewrite
from app.graph.state import AgentState
from app.rag.retrieve import TOP_K
from app.rag.search import SearchHit
from tests.fakes.llm import FakeFastLLM
from tests.fakes.rag import FakeRag, chunk_row
from tests.unit.graph.test_rewrite import seeded_db


def hits(n: int, drug: str = "albuterol") -> list[SearchHit]:
    return [
        SearchHit(f"chunk-{i}", f"text {i}", drug, "Indications", i, None, 1 / (60 + i))
        for i in range(1, n + 1)
    ]


def grades(*answers: str) -> str:
    return '{"grades": [' + ", ".join(f'"{a}"' for a in answers) + "]}"


# ---------- retrieve ----------


async def test_retrieve_embeds_the_rewritten_query_and_uses_the_filter():
    rag = FakeRag(seeded_db())
    rag.rows = [chunk_row(i, "albuterol") for i in range(1, 10)]
    state = {
        "question": "Ventolin kis liye hai?",
        "rewritten_query": "albuterol uses",
        "drug_filter": "albuterol",
        "timings": {"retrieve": 5},
    }
    update = await retrieve(state, deps=rag.deps())
    assert rag.embedder.calls == ["albuterol uses"]
    assert rag.searches[0]["drug_filter"] == "albuterol"
    assert rag.searches[0]["match_count"] == CANDIDATES
    assert len(update["candidates"]) == CANDIDATES
    assert update["timings"]["retrieve"] >= 5  # a second run adds to the first


async def test_retrieve_without_filter_searches_everything():
    rag = FakeRag(seeded_db())
    await retrieve({"question": "q", "rewritten_query": "q"}, deps=rag.deps())
    assert rag.searches[0]["drug_filter"] is None


# ---------- grade ----------


async def test_grade_keeps_only_relevant_chunks_in_order():
    llm = FakeFastLLM(grades("no", "yes", "no", "yes"))
    state = {
        "question": "kya ye safe hai?",
        "rewritten_query": "albuterol safety",
        "candidates": hits(4),
    }
    update = await grade(state, llm=llm)
    assert [c.chunk_id for c in update["graded_chunks"]] == ["chunk-2", "chunk-4"]
    assert update["tokens"] == 120
    assert "English search query: albuterol safety" in llm.prompt()
    assert "[4] albuterol / Indications" in llm.prompt()


async def test_grade_passes_at_most_top_k():
    update = await grade(
        {"question": "q", "candidates": hits(6)}, llm=FakeFastLLM(grades(*["yes"] * 6))
    )
    assert len(update["graded_chunks"]) == TOP_K


@pytest.mark.parametrize(
    "bad_reply",
    [
        "All of them look relevant.",  # no JSON
        grades("yes", "no"),  # 2 grades for 3 chunks
        '{"grades": ["maybe", "yes", "no"]}',  # not yes / no
    ],
)
async def test_grader_parse_failure_keeps_all_chunks(bad_reply):
    update = await grade({"question": "q", "candidates": hits(3)}, llm=FakeFastLLM(bad_reply))
    assert len(update["graded_chunks"]) == 3


async def test_grade_without_candidates_makes_no_llm_call():
    llm = FakeFastLLM("never used")
    update = await grade({"question": "q", "candidates": []}, llm=llm)
    assert llm.calls == [] and update["graded_chunks"] == [] and update["tokens"] == 0


def test_after_grade():
    assert after_grade({"graded_chunks": hits(1), "rewrite_count": 2}) == "generate"
    assert after_grade({"graded_chunks": [], "rewrite_count": 1}) == "rewrite"
    assert after_grade({"graded_chunks": [], "rewrite_count": 2}) == "no_evidence"


# ---------- no_evidence ----------


@pytest.mark.parametrize(
    ("language", "text"),
    [
        ("en", NO_EVIDENCE_TEXT["en"]),
        ("roman_urdu", NO_EVIDENCE_TEXT["roman_urdu"]),
        ("urdu", URDU_NO_EVIDENCE),
    ],
)
def test_no_evidence_in_the_user_language(language, text):
    update = no_evidence({"question": "q", "language": language})
    assert update == {
        "answer": text,
        "citations": [],
        "route": "no_evidence",
        "product_results": [],  # no cards under an unanswered knowledge question
    }


def test_no_evidence_without_language_uses_the_keyword_detector():
    update = no_evidence({"question": "kya metformin se sar dard hota hai?"})
    assert update["answer"] == NO_EVIDENCE_TEXT["roman_urdu"]


# ---------- the loop: rewrite -> retrieve -> grade -> generate | rewrite | no_evidence ----------


class Loop:
    """rewrite -> retrieve -> grade -> (generate | rewrite | no_evidence), with fakes.
    `generate` is a stand-in here (the real one comes in G4)."""

    def __init__(self, grade_replies: list[str], rewrite_reply: str = "") -> None:
        self.rag = FakeRag(seeded_db())
        self.rag.rows = [chunk_row(i, "albuterol", "Indications") for i in range(1, 4)]
        self.rewrite_llms: list[FakeFastLLM] = []
        self.grade_llm = FakeFastLLM(*grade_replies)
        self.generated: list[AgentState] = []

        def new_rewrite_llm():
            self.rewrite_llms.append(FakeFastLLM(rewrite_reply or "{}"))
            return self.rewrite_llms[-1]

        async def generate(state: AgentState) -> dict:
            self.generated.append(state)
            return {"answer": "cited answer [1]", "route": "knowledge"}

        g = StateGraph(AgentState)
        g.add_node("rewrite", make_rewrite(new_rewrite_llm, self.rag.db, CatalogCache()))
        g.add_node("retrieve", make_retrieve(self.rag.deps()))
        g.add_node("grade", make_grade(lambda: self.grade_llm))
        g.add_node("generate", generate)
        g.add_node("no_evidence", no_evidence)
        g.add_edge(START, "rewrite")
        g.add_edge("rewrite", "retrieve")
        g.add_edge("retrieve", "grade")
        g.add_conditional_edges("grade", after_grade)
        g.add_edge("generate", END)
        g.add_edge("no_evidence", END)
        self.graph = g.compile()

    async def run(self, question: str, language: str = "en") -> AgentState:
        return await self.graph.ainvoke(
            {"question": question, "language": language, "route": "knowledge"}
        )


BROADER = '{"query": "albuterol indications and usage bronchospasm", "drugs": ["albuterol"]}'


async def test_relevant_path_goes_to_generate():
    loop = Loop([grades("yes", "no", "yes")])
    final = await loop.run("What is Ventolin used for?")
    assert final["route"] == "knowledge" and final["answer"] == "cited answer [1]"
    assert [c.chunk_id for c in final["graded_chunks"]] == ["chunk-1", "chunk-3"]
    assert final["rewrite_count"] == 1
    assert len(loop.rag.searches) == 1 and loop.rag.searches[0]["drug_filter"] == "albuterol"
    assert loop.rewrite_llms[0].calls == []  # plain English: no rewrite LLM call
    assert final["tokens"] == 120  # the grader only
    assert set(final["timings"]) == {"rewrite", "retrieve", "grade"}


async def test_one_retry_then_success():
    loop = Loop([grades("no", "no", "no"), grades("no", "yes", "no")], BROADER)
    final = await loop.run("What is Ventolin used for?")
    assert final["route"] == "knowledge"
    assert [c.chunk_id for c in final["graded_chunks"]] == ["chunk-2"]
    assert final["rewrite_count"] == 2
    assert [s["drug_filter"] for s in loop.rag.searches] == ["albuterol", None]  # broader
    assert loop.rag.embedder.calls == [
        "What is Ventolin used for? (albuterol)",
        "albuterol indications and usage bronchospasm",
    ]
    assert final["tokens"] == 3 * 120  # grade, rewrite (retry), grade
    assert len(loop.grade_llm.calls) == 2


async def test_two_failed_rounds_end_in_no_evidence():
    loop = Loop([grades("no", "no", "no")], BROADER)
    final = await loop.run("Ventolin kis liye hai?", language="roman_urdu")
    assert final["route"] == "no_evidence"
    assert final["answer"] == NO_EVIDENCE_TEXT["roman_urdu"]
    assert final["citations"] == []
    assert final["rewrite_count"] == 2
    assert len(loop.rag.searches) == 2  # never a third round
    assert loop.generated == []


async def test_nothing_found_twice_ends_in_no_evidence_without_grader_calls():
    loop = Loop(["never used"], BROADER)
    loop.rag.rows = []
    final = await loop.run("What is Ventolin used for?")
    assert final["route"] == "no_evidence"
    assert loop.grade_llm.calls == []
    assert len(loop.rag.searches) == 2


async def test_grader_parse_failure_in_the_loop_keeps_all_chunks():
    loop = Loop(["Sure, they are all relevant!"])
    final = await loop.run("What is Ventolin used for?")
    assert final["route"] == "knowledge"
    assert len(final["graded_chunks"]) == 3
    assert final["rewrite_count"] == 1  # no retry
