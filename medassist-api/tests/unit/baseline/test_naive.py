"""app/baseline/naive.py with fake embedder, search, reranker and LLM (no network)."""

from langchain_core.messages import HumanMessage

from app.baseline import naive
from tests.fakes import FakeSupabase
from tests.fakes.rag import FakeRag, chunk_row

URL = "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=abc"


def make_rag(rows=None, reply=("Answer [1].",)) -> FakeRag:
    rag = FakeRag(FakeSupabase())
    if rows is not None:
        rag.rows = rows
    rag.reply = reply
    return rag


async def run(rag: FakeRag, question: str = "ibuprofen with warfarin?"):
    items = [item async for item in naive.answer_stream(question, rag.deps())]
    *pieces, result = items
    assert isinstance(result, naive.RagAnswer)
    assert all(isinstance(p, str) for p in pieces)
    return pieces, result


def test_used_numbers_keeps_valid_markers_in_first_use_order():
    text = "A [3] b [1][3] c [9] d [0] e [2]."
    assert naive.used_numbers(text, 3) == [3, 1, 2]
    assert naive.used_numbers("no markers", 5) == []


async def test_pipeline_embeds_searches_20_and_prompts_with_numbered_chunks():
    rows = [chunk_row(i, "ibuprofen", "Warnings", f"text {i}") for i in range(1, 8)]
    rag = make_rag(rows)

    await run(rag, "ibuprofen with warfarin?")

    assert rag.embedder.calls == ["ibuprofen with warfarin?"]
    [search] = rag.searches
    assert search["match_count"] == 20
    assert search["query_text"] == "ibuprofen with warfarin?"
    human = rag.llms[0].messages[-1]
    assert isinstance(human, HumanMessage)
    assert "[5] ibuprofen / Warnings\ntext 5" in human.content
    assert "[6]" not in human.content  # reranked to top 5


async def test_only_used_citations_with_document_url():
    rows = [
        chunk_row(1, "ibuprofen", "Warnings"),
        chunk_row(2, "warfarin", "Drug Interactions"),
        chunk_row(3, "ibuprofen", "Dosage"),
    ]
    rag = make_rag(rows, reply=("Bleeding risk rises [2]", " and GI bleeding [1][2]."))
    rag.db.seed("drug_documents", generic_name="ibuprofen", source_url=URL)
    rag.db.seed("drug_documents", generic_name="warfarin", source_url=None)

    pieces, result = await run(rag)

    assert result.route == "knowledge"
    assert result.text == "Bleeding risk rises [2] and GI bleeding [1][2]."
    assert "".join(pieces) == result.text
    assert [(c.n, c.drug, c.section, c.url) for c in result.citations] == [
        (1, "ibuprofen", "Warnings", URL),
        (2, "warfarin", "Drug Interactions", naive.DAILYMED_SEARCH.format(drug="warfarin")),
    ]
    assert result.tokens == 120


async def test_text_is_held_back_until_first_citation_then_streams_live():
    rag = make_rag(reply=("Para", "cetamol ", "is safe [", "1]", " at label", " doses."))

    pieces, _ = await run(rag)

    assert pieces == ["Paracetamol is safe [1]", " at label", " doses."]


async def test_no_chunks_skips_the_llm():
    rag = make_rag(rows=[])

    pieces, result = await run(rag)

    assert pieces == [naive.NO_EVIDENCE_TEXT["en"]]
    assert (result.route, result.citations, result.tokens) == ("no_evidence", [], None)
    assert rag.llms == []


async def test_answer_without_valid_citation_becomes_no_evidence():
    rag = make_rag(reply=("The labels I have ", "do not cover this [7]."))

    pieces, result = await run(rag)

    assert pieces == [naive.NO_EVIDENCE_TEXT["en"]]  # the model's words were never shown
    assert result.text == naive.NO_EVIDENCE_TEXT["en"]
    assert result.route == "no_evidence"
    assert result.tokens == 120  # the call still cost tokens


async def test_roman_urdu_question_gets_roman_urdu_text_and_language_line():
    rag = make_rag(rows=[])
    pieces, _ = await run(rag, "kya metformin se sar dard hota hai?")
    assert pieces == [naive.NO_EVIDENCE_TEXT["roman_urdu"]]

    rag = make_rag()
    await run(rag, "kya paracetamol se jigar ko nuqsan hota hai?")
    assert "Reply language: Roman Urdu only" in rag.llms[0].messages[-1].content


def test_search_text_adds_the_previous_customer_question():
    history = [("user", "Is Panadol safe?"), ("assistant", "Yes [1]."), ("pharmacist", "ok")]
    assert naive.search_text("and for kids?", history) == "Is Panadol safe?\nand for kids?"
    assert naive.search_text("q", []) == "q"
