"""graph/nodes guard (rules + fast-LLM classifier), emergency and escalate, and the guard paths
through the wired graph (graph/build.py) with fake LLMs."""

import pytest

from app.graph import build
from app.graph.answer import NO_EVIDENCE_TEXT
from app.graph.nodes.escalate import ESCALATION_TEXT, escalate, escalation_pharmacy
from app.graph.nodes.guard import EMERGENCY_TEXT, classify, emergency, guard, rule_category
from app.graph.nodes.no_evidence import URDU_NO_EVIDENCE
from tests.fakes.llm import FakeFastLLM
from tests.fakes.rag import REPLY, FakeRag, chunk_row
from tests.unit.graph.test_generate_build import SAFE, card, router, run, shop  # noqa: F401

# ---------- layer 1: rules (app/safety/keywords.yaml) ----------


@pytest.mark.parametrize(
    ("question", "category"),
    [
        # emergency
        ("maine 20 goliyan kha li", "emergency"),
        ("Maine 15 tablets kha li hain", "emergency"),
        ("I took an overdose of Panadol", "emergency"),
        ("I took too many sleeping pills", "emergency"),
        ("mere bachay ne dawa nigal li", "emergency"),
        ("My son swallowed my blood pressure pills", "emergency"),
        ("I have chest pain after taking amlodipine", "emergency"),
        ("mujhe seene mein dard ho raha hai", "emergency"),
        ("mujhe saans nahi aa rahi", "emergency"),
        ("My lips are swelling after amoxicillin", "emergency"),
        ("I want to kill myself", "emergency"),
        # personal dosing (English)
        ("What DOSE for my son?", "personal_dosing"),
        ("How much ibuprofen should I take?", "personal_dosing"),
        ("How many tablets of Panadol can I take in a day?", "personal_dosing"),
        ("How often should I take amoxicillin?", "personal_dosing"),
        ("What dose of cetirizine for my child?", "personal_dosing"),  # dosing comes first
        ("Can I take another Panadol?", "personal_dosing"),
        ("Dose for a 20 kg kid?", "personal_dosing"),
        # personal dosing (Roman Urdu)
        ("Panadol kitni leni hai?", "personal_dosing"),
        ("Mujhe azithromycin kitni dose leni chahiye?", "personal_dosing"),
        ("Panadol kitni dafa le sakte hain?", "personal_dosing"),
        ("bachay ko brufen syrup kitna dena hai?", "personal_dosing"),
        ("mere bachay ko kitni dose deni hai?", "personal_dosing"),
        ("din mein kitni goliyan le sakta hoon?", "personal_dosing"),
        ("kitni dose, I am pregnant", "personal_dosing"),  # first category wins
        # prescription only
        ("Can I buy amoxicillin without a prescription?", "prescription_only"),
        ("Do I need a prescription for azithromycin?", "prescription_only"),
        ("kya xanax bina prescription mil sakti hai?", "prescription_only"),
        # pregnancy / breastfeeding / child
        ("Can I take it while pregnant?", "pregnancy_or_child"),
        ("Kya pregnancy mein amlodipine le sakte hain?", "pregnancy_or_child"),
        ("main hamil hoon, brufen le sakti hoon?", "pregnancy_or_child"),
        ("Is metformin safe during breastfeeding?", "pregnancy_or_child"),
        ("Is it ok when breast-feeding?", "pregnancy_or_child"),
        ("bachay ko doodh pilati hoon, panadol le sakti hoon?", "pregnancy_or_child"),
        ("Is cetirizine safe for children?", "pregnancy_or_child"),
        ("5 saal ke bachay ko brufen de sakte hain?", "pregnancy_or_child"),
        # general information: no rule, the LLM decides
        ("What happens in an atenolol overdose?", None),
        ("What are the symptoms of paracetamol overdose?", None),
        ("What is the usual adult dose of amoxicillin?", None),
        ("How many tablets are in one pack?", None),
        ("Panadol kitni der mein asar karti hai?", None),
        ("ciprofloxacin ke saath doodh pi sakte hain?", None),
        ("What are the side effects of amoxicillin?", None),
        ("Can I take ibuprofen with food?", None),
        ("Can amlodipine cause chest pain?", None),
        ("kya amlodipine se seene me dard hota hai?", None),  # "me" = "in", not a person
        ("kya amlodipine se paon soojh jatay hain?", None),
    ],
)
def test_rule_category(question, category):
    assert rule_category(question) == category


# ---------- layer 2: classifier ----------


async def test_a_rule_hit_skips_the_llm():
    made = []
    assert await classify("maine 20 goliyan kha li", llm_factory=made.append) == ("emergency", 0)
    assert made == []  # no LLM was even created


async def test_no_rule_asks_the_llm_with_the_earlier_chat():
    llm = FakeFastLLM('```json\n{"category": "pregnancy_or_child"}\n```')
    history = [("user", "Is ibuprofen safe?"), ("assistant", "Yes, mostly [1].")]

    assert await classify("and for my wife expecting?", history, llm_factory=lambda: llm) == (
        "pregnancy_or_child",
        120,
    )
    assert "Earlier chat:\nuser: Is ibuprofen safe?" in llm.prompt()
    assert llm.prompt().endswith("Message: and for my wife expecting?")


async def test_an_unreadable_reply_counts_as_safe():
    llm = FakeFastLLM("I think it is fine")
    assert await classify("hello there", llm_factory=lambda: llm) == ("safe", 120)


async def test_without_an_llm_only_the_rules_run():
    assert await classify("What happens in an overdose?") == ("safe", 0)


async def test_guard_node_sets_safety_and_reason():
    update = await guard(
        {"question": "Mujhe kitni dose leni chahiye?"},
        llm_factory=lambda: FakeFastLLM('{"category": "safe"}'),
    )
    assert update["safety"] == "personal_dosing"
    assert update["escalation_reason"] == "personal_dosing"
    assert update["tokens"] == 0 and "guard" in update["timings"]

    llm = FakeFastLLM('{"category": "emergency"}')
    update = await guard({"question": "I feel faint"}, llm_factory=lambda: llm)
    assert update["safety"] == "emergency"
    assert update["escalation_reason"] is None  # an emergency is not queued for a pharmacist


# ---------- emergency and escalate nodes ----------


@pytest.mark.parametrize("language", ["en", "roman_urdu", "urdu"])
def test_emergency_is_a_fixed_text(language):
    update = emergency({"question": "x", "language": language})
    assert update == {"answer": EMERGENCY_TEXT[language], "citations": [], "route": "emergency"}


def test_emergency_language_from_keywords_before_the_router_ran():
    assert emergency({"question": "maine 20 goliyan kha li hain"})["answer"] == (
        EMERGENCY_TEXT["roman_urdu"]
    )


def test_escalate_puts_the_note_after_the_cited_answer():
    state = {"question": "q", "language": "en", "route": "knowledge", "answer": "Info [1]."}
    update = escalate(state)
    assert update["answer"] == f"Info [1].\n\n{ESCALATION_TEXT['en']}"
    assert update["route"] == "escalated"


def test_escalate_without_evidence_is_the_note_only():
    state = {"question": "q", "language": "urdu", "route": "no_evidence"}
    state["answer"] = URDU_NO_EVIDENCE
    assert escalate(state)["answer"] == ESCALATION_TEXT["urdu"]


def test_escalate_without_evidence_keeps_the_product_text():
    answer = f"{NO_EVIDENCE_TEXT['en']}\n\nIn our shop:\n- Panadol: in stock."
    state = {"question": "q", "language": "en", "route": "no_evidence", "answer": answer}
    expected = f"In our shop:\n- Panadol: in stock.\n\n{ESCALATION_TEXT['en']}"
    assert escalate(state)["answer"] == expected


def test_escalation_pharmacy_request_first_then_product_card():
    cards = [card("Out", price=None), card("Panadol 500mg")]  # in stock card: pharmacy p-1
    assert escalation_pharmacy({"pharmacy_id": "p-9", "product_results": cards}) == "p-9"
    assert escalation_pharmacy({"pharmacy_id": None, "product_results": cards}) == "p-1"
    assert escalation_pharmacy({}) is None


# ---------- edges ----------


def test_guard_edges():
    assert build.after_guard({"safety": "emergency"}) == "emergency"
    assert build.after_guard({"safety": "personal_dosing"}) == "router"
    assert build.after_guard({"safety": "safe"}) == "router"
    # a risky question is never refused as out of scope
    risky = {"route": "out_of_scope", "escalation_reason": "personal_dosing"}
    assert build.after_router(risky) == "rewrite"
    assert build.after_answer({"escalation_reason": "pregnancy_or_child"}) == "escalate"
    assert build.after_answer({"escalation_reason": None}) == build.END


# ---------- the whole graph ----------


async def test_agent_emergency_is_fixed_text_without_search_or_llm(shop):  # noqa: F811
    rag = FakeRag(shop.db)

    pieces, result = await run(rag, "maine 20 goliyan kha li")

    assert result.route == "emergency"
    assert result.text == EMERGENCY_TEXT["roman_urdu"] == "".join(pieces)
    assert result.citations == [] and result.escalation_reason is None
    assert rag.fast_llms == [] and rag.embedder.calls == [] and rag.llms == []  # rule hit


async def test_agent_llm_emergency(shop):  # noqa: F811
    rag = FakeRag(shop.db)
    rag.fast_replies = ['{"category": "emergency"}']

    _, result = await run(rag, "my father collapsed after his tablets")

    assert result.route == "emergency"
    assert len(rag.fast_llms) == 1 and rag.embedder.calls == []


async def test_agent_risky_question_gets_cited_general_info_and_escalates(shop):  # noqa: F811
    rag = FakeRag(shop.db)
    rag.rows = [chunk_row(1, "ibuprofen", "Pediatric Use")]
    rag.fast_replies = [
        router("knowledge", "roman_urdu"),
        '{"query": "ibuprofen children dose", "drugs": []}',
        '{"grades": ["yes"]}',
    ]

    pieces, result = await run(rag, "mere bachay ko Brufen ki kitni dose deni hai?")

    assert result.route == "escalated"
    assert result.escalation_reason == "personal_dosing"
    general, note = result.text.split("\n\n")
    assert general == "".join(REPLY) and note == ESCALATION_TEXT["roman_urdu"]
    assert [c.drug for c in result.citations] == ["ibuprofen"]  # general label info, cited
    assert "".join(pieces) == result.text  # LLM text live, then the note
    assert result.pharmacy_id is None  # no request pharmacy, Brufen card is out of stock


async def test_agent_risky_pharmacy_from_the_product_card(shop):  # noqa: F811
    rag = FakeRag(shop.db)
    rag.rows = []
    rag.fast_replies = [router("both"), '{"query": "broader query"}']

    _, result = await run(rag, "Is Panadol safe while pregnant, and do you have it?")

    assert result.route == "escalated"
    assert result.escalation_reason == "pregnancy_or_child"
    assert result.text.startswith("In our shop:\n- Panadol 500mg: in stock")
    assert result.text.endswith(ESCALATION_TEXT["en"])
    assert result.pharmacy_id == shop.city  # pharmacy of the in-stock card


async def test_agent_safe_question_is_not_escalated(shop):  # noqa: F811
    rag = FakeRag(shop.db)
    rag.rows = [chunk_row(1, "atenolol", "Overdosage")]
    rag.fast_replies = [SAFE, router("knowledge"), '{"grades": ["yes"]}']

    _, result = await run(rag, "What happens in an atenolol overdose?")

    assert result.route == "knowledge"
    assert result.escalation_reason is None
