"""graph/nodes generate + out_of_scope, the product text, and the wired graph (graph/build.py)
end to end with fake LLMs, a fake hybrid_search and a fake shop: every route."""

import pytest

from app.config import Settings
from app.graph import build
from app.graph.answer import NO_EVIDENCE_TEXT, RagAnswer
from app.graph.nodes.generate import generate
from app.graph.nodes.no_evidence import no_evidence
from app.graph.nodes.out_of_scope import OUT_OF_SCOPE_TEXT, out_of_scope
from app.graph.nodes.tools import product_text
from app.rag.search import SearchHit
from app.schemas.chat import ProductCard
from tests.fakes.rag import REPLY, FakeLLM, FakeRag, chunk_row
from tests.unit.graph.test_rewrite import seeded_db
from tests.unit.graph.test_tools import Shop


def hits(n: int, drug: str = "ibuprofen") -> list[SearchHit]:
    return [
        SearchHit(f"chunk-{i}", f"text {i}", drug, "Drug Interactions", i, None, 1 / (60 + i))
        for i in range(1, n + 1)
    ]


def card(name: str, *, price: float | None = 45, alternatives=None) -> ProductCard:
    in_stock = price is not None
    return ProductCard(
        batch_id="b-1" if in_stock else None,
        medicine_id=f"m-{name}",
        name=name,
        price=price,
        in_stock=in_stock,
        pharmacy_id="p-1" if in_stock else None,
        pharmacy_name="City Pharmacy" if in_stock else None,
        alternatives=alternatives,
    )


class Emitted(list):
    def __call__(self, piece: str) -> None:
        self.append(piece)


# ---------- product text ----------


def test_product_text_lists_cards_with_price_and_pharmacy():
    alt = card("Calpol 500mg", price=30)
    text = product_text(
        [card("Panadol 500mg"), card("Disprol", price=None, alternatives=[alt])], "en", asked=True
    )
    assert text.splitlines() == [
        "In our shop:",
        "- Panadol 500mg: in stock, $45.00 at City Pharmacy.",
        "- Disprol: out of stock right now. Same medicine available: Calpol 500mg.",
    ]


def test_product_text_in_roman_urdu_and_urdu():
    assert product_text([card("Panadol")], "roman_urdu", asked=True).splitlines()[1] == (
        "- Panadol: stock mein hai, $45.00 (City Pharmacy)."
    )
    assert product_text([], "urdu", asked=True) == "یہ دوا ابھی ہماری شاپ میں نہیں ملی۔"


def test_product_text_without_cards():
    assert product_text([], "en", asked=True).startswith("I could not find this medicine")
    assert product_text([], "en", asked=False).startswith("Which medicine")  # no name given


def test_other_currency_keeps_its_code():
    other = card("Panadol").model_copy(update={"currency": "PKR"})
    assert "PKR 45.00" in product_text([other], "en", asked=True)


# ---------- generate ----------


async def test_generate_streams_a_cited_answer_after_the_first_marker():
    rag = FakeRag(seeded_db())
    emitted = Emitted()
    state = {"question": "Brufen with warfarin?", "language": "en", "route": "knowledge",
             "graded_chunks": hits(2), "timings": {}}

    update = await generate(state, llm_factory=rag.deps().answer_llm, db=rag.db, emit=emitted)

    assert update["answer"] == "".join(REPLY)
    assert update["route"] == "knowledge"
    assert [c.n for c in update["citations"]] == [1]
    assert update["tokens"] == 120
    assert emitted == [REPLY[0] + REPLY[1], REPLY[2]]  # held back until "[1]"


async def test_generate_without_a_citation_shows_no_evidence_and_streams_nothing():
    rag = FakeRag(seeded_db())
    rag.reply = ("Ibuprofen is fine with everything.",)
    emitted = Emitted()
    state = {"question": "q", "language": "en", "route": "knowledge", "graded_chunks": hits(1)}

    update = await generate(state, llm_factory=rag.deps().answer_llm, db=rag.db, emit=emitted)

    assert update["answer"] == NO_EVIDENCE_TEXT["en"]
    assert update["route"] == "no_evidence"
    assert update["citations"] == [] and emitted == []


async def test_generate_asks_for_the_users_language():
    llm = FakeLLM(REPLY)
    state = {"question": "کیا بروفن محفوظ ہے؟", "language": "urdu", "route": "knowledge",
             "graded_chunks": hits(1)}

    await generate(state, llm_factory=lambda: llm, db=seeded_db())

    assert "Reply language: Urdu (Urdu script) only" in llm.messages[-1].content


async def test_generate_product_route_uses_no_llm():
    llms = []
    state = {"question": "Panadol stock hai?", "language": "roman_urdu", "route": "product",
             "drug_names": ["acetaminophen"], "product_results": [card("Panadol 500mg")]}

    update = await generate(state, llm_factory=lambda: llms.append(1), db=seeded_db())

    assert llms == []
    assert update["route"] == "product"
    assert update["answer"].startswith("Hamari shop mein:")
    assert update["tokens"] == 0 and update["citations"] == []


async def test_generate_both_puts_the_product_text_after_the_cited_answer():
    rag = FakeRag(seeded_db())
    state = {"question": "Brufen with Panadol?", "language": "en", "route": "both",
             "graded_chunks": hits(1), "drug_names": ["ibuprofen", "acetaminophen"],
             "product_results": [card("Panadol 500mg")]}

    update = await generate(state, llm_factory=rag.deps().answer_llm, db=rag.db)

    answer, products = update["answer"].split("\n\n")
    assert answer == "".join(REPLY)
    assert products.startswith("In our shop:")
    assert update["route"] == "both"


# ---------- out of scope / no evidence ----------


@pytest.mark.parametrize("language", ["en", "roman_urdu", "urdu"])
def test_out_of_scope_answers_in_the_users_language(language):
    update = out_of_scope({"question": "weather?", "language": language})
    assert update == {"answer": OUT_OF_SCOPE_TEXT[language], "citations": []}


def test_no_evidence_for_both_still_lists_the_products():
    state = {"question": "q", "language": "en", "route": "both", "drug_names": ["acetaminophen"],
             "product_results": [card("Panadol 500mg")]}
    update = no_evidence(state)
    assert update["answer"].startswith(NO_EVIDENCE_TEXT["en"] + "\n\nIn our shop:")
    assert update["route"] == "no_evidence"
    assert "product_results" not in update  # cards kept


def test_no_evidence_for_knowledge_drops_the_cards():
    state = {"question": "q", "language": "en", "route": "knowledge",
             "product_results": [card("Panadol 500mg")]}
    update = no_evidence(state)
    assert update["answer"] == NO_EVIDENCE_TEXT["en"]
    assert update["product_results"] == []


# ---------- edges ----------


@pytest.mark.parametrize(
    ("route", "count", "expected"),
    [
        ("product", 1, ["tools"]),
        ("both", 1, ["tools", "retrieve"]),  # parallel
        ("both", 2, ["retrieve"]),  # the retry does not search the shop again
    ],
)
def test_after_rewrite(route, count, expected):
    assert build.after_rewrite({"route": route, "rewrite_count": count}) == expected


def test_after_rewrite_knowledge_searches_the_shop_only_for_named_drugs():
    named = {"route": "knowledge", "rewrite_count": 1, "drug_names": ["ibuprofen"]}
    assert build.after_rewrite(named) == ["tools", "retrieve"]
    assert build.after_rewrite({**named, "drug_names": []}) == ["retrieve"]
    assert build.after_rewrite({**named, "rewrite_count": 2}) == ["retrieve"]


def test_after_router_and_after_tools():
    assert build.after_router({"route": "out_of_scope"}) == "out_of_scope"
    assert build.after_router({"route": "both"}) == "rewrite"
    assert build.after_tools({"route": "product"}) == "generate"
    assert build.after_tools({"route": "both"}) == build.END


def test_graph_is_compiled_once():
    assert build.agent_graph() is build.agent_graph()


# ---------- the whole graph ----------


SAFE = '{"category": "safe"}'  # the guard's reply: every fast-LLM reply list starts with it


def router(route: str, language: str = "en") -> str:
    return f'{{"route": "{route}", "language": "{language}"}}'


async def run(rag: FakeRag, question: str, **kwargs) -> tuple[list[str], RagAnswer]:
    pieces, result = [], None
    async for item in build.stream_agent(question, rag.deps(), **kwargs):
        if isinstance(item, RagAnswer):
            result = item
        else:
            pieces.append(item)
    assert result is not None
    return pieces, result


@pytest.fixture
def shop() -> Shop:
    shop = Shop(seeded_db())  # synonyms + loaded drugs + shop tables in one fake DB
    shop.batch(shop.panadol, shop.city, 45)
    return shop


async def test_agent_knowledge_route(shop):
    rag = FakeRag(shop.db)
    rag.rows = [chunk_row(1, "ibuprofen", "Adverse Reactions")]
    rag.fast_replies = [SAFE, router("knowledge"), '{"grades": ["yes"]}']

    pieces, result = await run(rag, "What are the side effects of Brufen?")

    assert result.route == "knowledge"
    assert "".join(pieces) == result.text == "".join(REPLY)
    assert [c.drug for c in result.citations] == ["ibuprofen"]
    # a named drug: the shop was searched in parallel; card only, no product text
    [brufen] = result.products
    assert (brufen.name, brufen.in_stock) == ("Brufen 400mg", False)
    assert "shop" not in result.text
    assert result.tokens == 480  # guard + router + grade + answer; no rewrite LLM (English)
    assert rag.embedder.calls == ["What are the side effects of Brufen? (ibuprofen)"]
    assert rag.searches[0]["drug_filter"] == "ibuprofen"


async def test_agent_product_route_shows_a_real_card_without_search(shop):
    rag = FakeRag(shop.db)
    rag.fast_replies = [SAFE, router("product", "roman_urdu"), '{"query": "acetaminophen stock"}']

    pieces, result = await run(rag, "Panadol stock hai?", pharmacy_id=shop.city)

    assert result.route == "product"
    first = result.products[0]
    assert (first.name, first.in_stock, first.price) == ("Panadol 500mg", True, 45.0)
    assert first.pharmacy_name == "City Pharmacy"
    assert "".join(pieces) == result.text
    assert result.text.startswith("Hamari shop mein:\n- Panadol 500mg: stock mein hai, $45.00")
    assert rag.embedder.calls == [] and rag.llms == []  # no label search, no answer LLM


async def test_agent_both_route_runs_tools_and_retrieval(shop):
    rag = FakeRag(shop.db)
    rag.rows = [chunk_row(1, "ibuprofen", "Drug Interactions")]
    rag.fast_replies = [
        SAFE,
        router("both", "roman_urdu"),
        '{"query": "ibuprofen acetaminophen together", "drugs": []}',
        '{"grades": ["yes"]}',
    ]

    pieces, result = await run(rag, "Brufen aur Panadol ek saath le sakte hain?")

    assert result.route == "both"
    assert [c.n for c in result.citations] == [1]
    assert result.products[0].name == "Panadol 500mg"
    answer, products = result.text.split("\n\n")
    assert answer == "".join(REPLY)
    assert products.startswith("Hamari shop mein:")
    assert "".join(pieces) == result.text  # LLM text live, then the product lines


async def test_agent_both_without_evidence_retries_once_and_keeps_products(shop):
    rag = FakeRag(shop.db)
    rag.rows = []
    rag.fast_replies = [SAFE, router("both"), '{"query": "broader query"}']

    _, result = await run(rag, "Is Panadol safe with alcohol, and do you have it?")

    assert result.route == "no_evidence"
    assert result.text.startswith(NO_EVIDENCE_TEXT["en"])
    assert "Panadol 500mg: in stock" in result.text
    assert len(rag.embedder.calls) == 2  # first query + one broader retry
    assert result.citations == [] and rag.llms == []


async def test_agent_knowledge_without_evidence_shows_no_cards(shop):
    rag = FakeRag(shop.db)
    rag.rows = []
    rag.fast_replies = [SAFE, router("knowledge"), '{"query": "broader query"}']

    _, result = await run(rag, "Can I take Panadol with alcohol?")

    assert result.route == "no_evidence"
    assert result.text == NO_EVIDENCE_TEXT["en"]
    assert result.products == []


async def test_agent_out_of_scope_route(shop):
    rag = FakeRag(shop.db)
    rag.fast_replies = [SAFE, router("out_of_scope", "roman_urdu")]

    pieces, result = await run(rag, "aaj mausam kaisa hai?")

    assert result.route == "out_of_scope"
    assert result.text == OUT_OF_SCOPE_TEXT["roman_urdu"] == "".join(pieces)
    assert len(rag.fast_llms) == 2 and rag.embedder.calls == [] and rag.llms == []
    assert result.tokens == 240  # guard + router


async def test_run_agent_returns_only_the_answer(shop):
    rag = FakeRag(shop.db)
    rag.fast_replies = [SAFE, router("out_of_scope")]
    result = await build.run_agent("tell me a joke", rag.deps())
    assert result.text == OUT_OF_SCOPE_TEXT["en"]


# ---------- tracing ----------


def test_tracing_only_with_an_api_key(monkeypatch):
    for name in ("LANGSMITH_TRACING", "LANGSMITH_API_KEY", "LANGSMITH_PROJECT"):
        monkeypatch.delenv(name, raising=False)
    base = {"supabase_url": "u", "supabase_service_key": "k", "groq_api_key": "g",
            "gemini_api_key": "m", "_env_file": None}

    assert build.enable_tracing(Settings(**base)) is False
    assert "LANGSMITH_TRACING" not in build.os.environ

    assert build.enable_tracing(Settings(**base, langsmith_api_key="ls-test")) is True
    assert build.os.environ["LANGSMITH_TRACING"] == "true"
    assert build.os.environ["LANGSMITH_PROJECT"] == "medassist"
