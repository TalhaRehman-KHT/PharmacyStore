"""/ask, /ask/stream, rate limit, validation and auth on every route.

GET /sessions/{id}/messages is covered in tests/unit/repositories/test_messages_repo.py.
"""

from uuid import uuid4

import pytest

from app.errors import BUSY_MESSAGE
from app.graph.answer import DAILYMED_SEARCH, NO_EVIDENCE_TEXT
from app.graph.nodes.escalate import ESCALATION_TEXT
from app.graph.nodes.guard import EMERGENCY_TEXT
from app.llm.providers import AllProvidersBusy
from app.services import chat
from tests.fakes.rag import REPLY
from tests.unit.api.helpers import ask, messages_of, parse_sse
from tests.unit.graph.test_generate_build import SAFE

SID = uuid4()
ROUTES = [
    ("post", "/ask", {"question": "What is paracetamol?"}),
    ("post", "/ask/stream", {"question": "What is paracetamol?"}),
    ("get", "/sessions", None),
    ("get", f"/sessions/{SID}/messages", None),
    ("delete", "/sessions", None),
    ("post", f"/messages/{SID}/feedback", {"rating": 1}),
    ("get", "/escalations", None),
    ("post", f"/escalations/{SID}/reply", {"reply": "Take it after food, twice a day."}),
    ("get", "/insights", None),
]


# ---------- auth on every route ----------


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_every_route_needs_a_token(client, method, path, body):
    res = client.request(method, path, json=body)

    assert res.status_code == 401
    assert res.json() == {"status": 401, "message": "Missing X-User-Id header"}


# ---------- /ask ----------


def test_ask_creates_session_and_two_messages(client, db, make_user):
    user_id, headers = make_user()
    question = "What are the common side effects of ibuprofen tablets?"

    res = ask(client, headers, question)

    assert res.status_code == 200
    body = res.json()
    assert body["answer"] == "".join(REPLY)
    assert body["citations"] == [
        {
            "n": 1,
            "drug": "acetaminophen",
            "section": "Warnings",
            "url": DAILYMED_SEARCH.format(drug="acetaminophen"),
        }
    ]
    meta = body["meta"]
    assert meta["route"] == "knowledge"
    assert meta["tokens"] == 480  # agent: guard + router + grade + answer (120 each)
    assert meta["escalated"] is False
    assert "escalationStatus" not in meta  # None fields are dropped
    assert isinstance(meta["latencyMs"], int)

    [session] = db.rows("chat_sessions")
    assert session["id"] == meta["sessionId"]
    assert session["user_id"] == user_id
    assert session["title"] == question[: chat.TITLE_LENGTH]

    user_msg, bot_msg = messages_of(db, session["id"])
    assert (user_msg["role"], user_msg["content"]) == ("user", question)
    assert bot_msg["role"] == "assistant"
    assert bot_msg["id"] == meta["messageId"]
    assert (bot_msg["route"], bot_msg["variant"]) == ("knowledge", "agent")
    assert bot_msg["latency_ms"] == meta["latencyMs"]
    assert bot_msg["tokens"] == 480  # guard + router + grade + answer
    assert bot_msg["citations"] == body["citations"]


def test_agent_product_question_returns_cards(client, db, make_user, rag):
    """route product: no label search, no answer LLM; the shop card is in meta and stored."""
    _, headers = make_user()
    vendor = db.seed("users", name="Vendor", role="vendor", is_active=True)
    pharmacy = db.seed("pharmacies", vendor_id=vendor["id"], name="City Pharmacy", is_active=True)
    med = db.seed("medicines", name="Panadol 500mg", generic_name="paracetamol", image_url=None)
    db.seed(
        "medicine_batches",
        medicine_id=med["id"],
        pharmacy_id=pharmacy["id"],
        quantity=5,
        expiry_date="2999-01-01",
        selling_price=45,
    )
    db.seed(
        "drug_synonyms", brand_name="Panadol", generic_name="paracetamol", us_name="acetaminophen"
    )
    rag.fast_replies = [
        SAFE,
        '{"route": "product", "language": "roman_urdu"}',
        '{"query": "acetaminophen"}',
    ]

    res = ask(client, headers, "Panadol stock mein hai?")

    body = res.json()
    assert body["meta"]["route"] == "product"
    [card] = body["meta"]["products"]
    assert (card["name"], card["price"], card["inStock"]) == ("Panadol 500mg", 45.0, True)
    assert card["pharmacyName"] == "City Pharmacy"
    assert body["answer"].startswith("Hamari shop mein:")
    assert "$45.00" in body["answer"]
    assert body["citations"] == []
    assert rag.llms == [] and rag.embedder.calls == []
    assert db.rows("chat_messages")[-1]["products"][0]["batchId"] == card["batchId"]


def test_agent_out_of_scope_needs_no_search(client, db, make_user, rag):
    _, headers = make_user()
    rag.fast_replies = [SAFE, '{"route": "out_of_scope", "language": "en"}']

    body = ask(client, headers, "What is the weather today?").json()

    assert body["meta"]["route"] == "out_of_scope"
    assert body["answer"].startswith("I can only help with medicines")
    assert "products" not in body["meta"]
    assert len(rag.fast_llms) == 2 and rag.llms == [] and rag.embedder.calls == []


def test_ask_reuses_own_session(client, db, make_user):
    _, headers = make_user()
    session_id = ask(client, headers).json()["meta"]["sessionId"]

    res = ask(client, headers, "And for children?", sessionId=session_id)

    assert res.status_code == 200
    assert res.json()["meta"]["sessionId"] == session_id
    assert len(db.rows("chat_sessions")) == 1
    assert len(messages_of(db, session_id)) == 4


@pytest.mark.parametrize("path", ["/ask", "/ask/stream"])
def test_ask_with_other_users_session_returns_404(client, db, make_user, path):
    _, alice = make_user(name="Alice")
    _, bob = make_user(name="Bob")
    alice_session = ask(client, alice).json()["meta"]["sessionId"]

    res = client.post(path, json={"question": "hi", "sessionId": alice_session}, headers=bob)

    assert res.status_code == 404
    assert res.json() == {"status": 404, "message": "Session not found"}
    assert len(messages_of(db, alice_session)) == 2  # nothing written into Alice's chat


def test_dosing_question_escalates_with_pharmacy(client, db, make_user, rag):
    user_id, headers = make_user()
    vendor = db.seed("users", name="Vendor", role="vendor", is_active=True)
    pharmacy = db.seed("pharmacies", vendor_id=vendor["id"], name="City Pharmacy")

    rag.fast_replies = ['{"route": "knowledge", "language": "roman_urdu"}', '{"query": ""}']

    res = ask(client, headers, "Panadol kitni dose?", pharmacyId=pharmacy["id"])

    assert res.status_code == 200
    meta = res.json()["meta"]
    assert meta["route"] == "escalated"
    assert meta["escalated"] is True
    assert meta["escalationReason"] == "personal_dosing"
    assert meta["escalationStatus"] == "pending"
    # general label info (cited), then the pharmacist note; the guard rule needed no LLM
    general, note = res.json()["answer"].split("\n\n")
    assert general == "".join(REPLY) and note == ESCALATION_TEXT["roman_urdu"]
    assert [c["n"] for c in res.json()["citations"]] == [1]

    [esc] = db.rows("escalations")
    assert esc["message_id"] == meta["messageId"]
    assert esc["session_id"] == meta["sessionId"]
    assert esc["user_id"] == user_id
    assert esc["reason"] == "personal_dosing"
    assert esc["status"] == "pending"
    assert esc["pharmacy_id"] == pharmacy["id"]


def test_pregnancy_question_escalates_without_pharmacy(client, db, make_user):
    _, headers = make_user()

    res = ask(client, headers, "Can I take this while pregnant?")

    assert res.json()["answer"].endswith(ESCALATION_TEXT["en"])  # English only

    [esc] = db.rows("escalations")
    assert esc["reason"] == "pregnancy_or_child"
    assert esc["pharmacy_id"] is None


def test_emergency_gets_the_fixed_text_and_no_escalation(client, db, make_user, rag):
    _, headers = make_user()

    res = ask(client, headers, "maine 20 goliyan kha li")

    body = res.json()
    assert body["meta"]["route"] == "emergency"
    assert body["answer"] == EMERGENCY_TEXT["roman_urdu"]
    assert body["meta"]["escalated"] is False
    assert db.rows("escalations") == []
    assert rag.llms == [] and rag.embedder.calls == []


def test_unknown_pharmacy_returns_422(client, db, make_user):
    _, headers = make_user()

    res = ask(client, headers, "kitni dose?", pharmacyId=str(uuid4()))

    assert res.status_code == 422
    assert res.json() == {"status": 422, "message": "pharmacyId: unknown pharmacy"}
    assert db.rows("chat_messages") == []


def test_earlier_turns_go_into_the_prompt(client, db, make_user, rag):
    _, headers = make_user()
    session_id = ask(client, headers, "What is paracetamol?").json()["meta"]["sessionId"]

    ask(client, headers, "And for children?", sessionId=session_id)

    messages = rag.llms[-1].messages
    roles = [type(m).__name__ for m in messages]
    assert roles == ["SystemMessage", "HumanMessage", "AIMessage", "HumanMessage"]
    assert messages[1].content == "What is paracetamol?"
    assert "<question>\nAnd for children?\n</question>" in messages[3].content
    # agent: the rewrite step sees the earlier chat (it turns "And for children?" into a query)
    rewrite_prompt = rag.fast_llms[-2].prompt()
    assert "Earlier chat:" in rewrite_prompt and "What is paracetamol?" in rewrite_prompt


def test_no_chunks_gives_no_evidence(client, db, make_user, rag):
    _, headers = make_user()
    rag.rows = []

    res = client.post("/ask/stream", json={"question": "hi"}, headers=headers)

    events = parse_sse(res.text)
    text = "".join(data["text"] for name, data in events if name == "token")
    assert text == NO_EVIDENCE_TEXT["en"]
    assert events[-3] == ("citations", [])
    assert events[-2][1]["route"] == "no_evidence"
    assert len(rag.embedder.calls) == 2  # first query + one broader retry
    assert rag.llms == []  # no answer LLM
    assert db.rows("chat_messages")[-1]["route"] == "no_evidence"


# ---------- validation ----------


def test_invalid_body_returns_422(client, make_user):
    _, headers = make_user()
    res = client.post("/ask", json={"question": "   "}, headers=headers)

    assert res.status_code == 422
    assert res.json()["status"] == 422


def test_invalid_query_returns_422(client, make_user):
    _, headers = make_user("admin")
    assert client.get("/escalations?status=closed", headers=headers).status_code == 422


# ---------- every LLM busy (S4) ----------


def test_all_providers_busy_gives_429_with_retry_after(client, db, make_user, rag):
    _, headers = make_user()
    rag.error = AllProvidersBusy(17)

    res = ask(client, headers)

    assert res.status_code == 429
    assert res.headers["Retry-After"] == "17"
    assert res.json() == {"status": 429, "message": BUSY_MESSAGE, "retryAfterSec": 17}


def test_all_providers_busy_in_stream_sends_429_event(client, db, make_user, rag):
    _, headers = make_user()
    rag.error = AllProvidersBusy(17)

    res = client.post("/ask/stream", json={"question": "hi"}, headers=headers)

    assert parse_sse(res.text) == [
        ("error", {"status": 429, "message": BUSY_MESSAGE, "retryAfterSec": 17})
    ]
