"""/ask, /ask/stream, rate limit, validation and auth on every route.

GET /sessions/{id}/messages is covered in tests/unit/repositories/test_messages_repo.py.
"""

from uuid import uuid4

import pytest

from app.baseline import naive
from app.errors import BUSY_MESSAGE
from app.llm.providers import AllProvidersBusy
from app.services import chat, precheck
from tests.fakes.rag import REPLY
from tests.unit.api.helpers import ask, messages_of, parse_sse

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
            "url": naive.DAILYMED_SEARCH.format(drug="acetaminophen"),
        }
    ]
    meta = body["meta"]
    assert meta["route"] == "knowledge"
    assert meta["tokens"] == 120
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
    assert (bot_msg["route"], bot_msg["variant"]) == ("knowledge", "naive")
    assert bot_msg["latency_ms"] == meta["latencyMs"]
    assert bot_msg["tokens"] == 120
    assert bot_msg["citations"] == body["citations"]


def test_ask_variant_is_stored(client, db, make_user):
    _, headers = make_user()

    res = client.post("/ask?variant=naive", json={"question": "hi"}, headers=headers)

    assert res.status_code == 200
    assert db.rows("chat_messages")[-1]["variant"] == "naive"


@pytest.mark.parametrize("variant", ["rewrite", "agent"])
def test_variant_not_built_yet_returns_422(client, db, make_user, variant):
    _, headers = make_user()

    res = client.post(f"/ask?variant={variant}", json={"question": "hi"}, headers=headers)

    assert res.status_code == 422
    assert res.json()["message"] == f"variant: '{variant}' is not available yet"
    assert db.rows("chat_messages") == []


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

    res = ask(client, headers, "Panadol kitni dose?", pharmacyId=pharmacy["id"])

    assert res.status_code == 200
    meta = res.json()["meta"]
    assert meta["route"] == "escalated"
    assert meta["escalated"] is True
    assert meta["escalationReason"] == "personal_dosing"
    assert meta["escalationStatus"] == "pending"
    assert res.json()["answer"] == precheck.ESCALATION_TEXT["roman_urdu"]  # "kitni" question
    assert res.json()["citations"] == []
    assert rag.llms == [] and rag.embedder.calls == []  # no retrieval, no LLM

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

    assert res.json()["answer"] == precheck.ESCALATION_TEXT["en"]  # English only

    [esc] = db.rows("escalations")
    assert esc["reason"] == "pregnancy_or_child"
    assert esc["pharmacy_id"] is None


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
    assert "[1]" not in messages[2].content  # old citation markers removed
    assert "<question>\nAnd for children?\n</question>" in messages[3].content
    # the follow-up is searched together with the previous question
    assert rag.embedder.calls[-1] == "What is paracetamol?\nAnd for children?"


def test_history_is_only_from_the_same_session(client, db, make_user, rag):
    _, headers = make_user()
    ask(client, headers, "What is paracetamol?")

    ask(client, headers, "What is aspirin?")  # new session

    assert [type(m).__name__ for m in rag.llms[-1].messages] == ["SystemMessage", "HumanMessage"]


# ---------- rate limit ----------


def test_21st_ask_in_an_hour_returns_429(client, make_user):
    _, headers = make_user()
    for _ in range(20):
        assert ask(client, headers).status_code == 200

    res = ask(client, headers)

    assert res.status_code == 429
    body = res.json()
    assert body["status"] == 429
    assert body["message"] == "Too many questions. Please try again later."
    retry_after = int(res.headers["Retry-After"])
    assert 1 <= retry_after <= 3600
    assert body["retryAfterSec"] == retry_after


def test_stream_shares_the_ask_budget_per_user(client, make_user):
    _, alice = make_user(name="Alice")
    _, bob = make_user(name="Bob")
    for _ in range(20):
        ask(client, alice)

    assert client.post("/ask/stream", json={"question": "hi"}, headers=alice).status_code == 429
    assert ask(client, bob).status_code == 200  # the limit is per user, not global


# ---------- /ask/stream ----------


def test_stream_event_order_and_camel_case(client, db, make_user):
    _, headers = make_user()

    res = client.post("/ask/stream", json={"question": "What is paracetamol?"}, headers=headers)

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(res.text)
    names = [name for name, _ in events]
    tokens = names.count("token")
    assert tokens >= 2
    assert names == ["token"] * tokens + ["citations", "meta", "done"]

    tokens_text = [data["text"] for name, data in events if name == "token"]
    assert "".join(tokens_text) == "".join(REPLY)
    # held back until the first [n], then live: the 1st event carries the first two pieces
    assert tokens_text == [REPLY[0] + REPLY[1], REPLY[2]]
    assert [c["n"] for c in events[-3][1]] == [1]
    meta = events[-2][1]
    assert {"messageId", "sessionId", "route", "escalated", "latencyMs"} <= set(meta)
    assert not any("_" in key for key in meta)
    assert events[-1][1] == {}

    assert meta["messageId"] == messages_of(db, meta["sessionId"])[-1]["id"]


def test_stream_failure_sends_error_event(client, make_user, monkeypatch):
    _, headers = make_user()

    async def boom(*_args, **_kwargs):
        raise RuntimeError("model down")
        yield  # an async generator, like chat.answer_stream

    monkeypatch.setattr(chat, "answer_stream", boom)

    res = client.post("/ask/stream", json={"question": "hi"}, headers=headers)

    assert parse_sse(res.text) == [
        ("error", {"status": 500, "message": "Internal server error"})
    ]


def test_llm_failure_after_tokens_sends_error_event(client, db, make_user, rag):
    _, headers = make_user()
    rag.error, rag.fail_after = RuntimeError("groq dropped"), 2

    res = client.post("/ask/stream", json={"question": "hi"}, headers=headers)

    events = parse_sse(res.text)
    assert events[0] == ("token", {"text": REPLY[0] + REPLY[1]})
    assert events[-1] == ("error", {"status": 500, "message": "Internal server error"})
    assert [m["role"] for m in db.rows("chat_messages")] == ["user"]  # no half answer stored


def test_no_chunks_gives_no_evidence(client, db, make_user, rag):
    _, headers = make_user()
    rag.rows = []

    res = client.post("/ask/stream", json={"question": "hi"}, headers=headers)

    events = parse_sse(res.text)
    text = "".join(data["text"] for name, data in events if name == "token")
    assert text == naive.NO_EVIDENCE_TEXT["en"]
    assert events[-3] == ("citations", [])
    assert events[-2][1]["route"] == "no_evidence"
    assert "tokens" not in events[-2][1]
    assert rag.llms == []
    assert db.rows("chat_messages")[-1]["route"] == "no_evidence"


# ---------- validation ----------


def test_invalid_body_returns_422(client, make_user):
    _, headers = make_user()
    res = client.post("/ask", json={"question": "   "}, headers=headers)

    assert res.status_code == 422
    assert res.json()["status"] == 422


def test_invalid_query_returns_422(client, make_user):
    _, headers = make_user("admin")
    res = client.post("/ask?variant=magic", json={"question": "hi"}, headers=headers)
    assert res.status_code == 422
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
