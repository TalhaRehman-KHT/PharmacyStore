"""Routes through the real app: FakeSupabase as the database, real token verification.

GET /sessions/{id}/messages is covered in test_messages_repo.py (it needs get_messages).
"""

import json
from uuid import uuid4

import pytest

from app.services import chat, placeholder

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
]
REPLY = {"reply": "Please take it after food, twice a day."}


def ask(client, headers, question="What is paracetamol?", **body):
    return client.post("/ask", json={"question": question, **body}, headers=headers)


def parse_sse(text: str) -> list[tuple[str, object]]:
    """[(event, data)] from an SSE body; comment lines (pings) are ignored."""
    events = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        name, data = None, []
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[len("event:") :].strip()
            elif line.startswith("data:"):
                data.append(line[len("data:") :].strip())
        if name:
            events.append((name, json.loads("\n".join(data))))
    return events


def messages_of(db, session_id: str) -> list[dict]:
    return [m for m in db.rows("chat_messages") if m["session_id"] == session_id]


def assistant_message(db, client, headers) -> dict:
    """Ask once and return the stored assistant message row."""
    session_id = ask(client, headers).json()["meta"]["sessionId"]
    return next(m for m in messages_of(db, session_id) if m["role"] == "assistant")


def escalate(db, client, headers) -> dict:
    """Ask a dosing question and return the escalation row it created."""
    ask(client, headers, "Mujhe kitni dose leni chahiye?")
    return db.rows("escalations")[-1]


# ---------- auth on every route ----------


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_every_route_needs_a_token(client, method, path, body):
    res = client.request(method, path, json=body)

    assert res.status_code == 401
    assert res.json() == {"status": 401, "message": "Missing bearer token"}


# ---------- /ask ----------


def test_ask_creates_session_and_two_messages(client, db, make_user):
    user_id, headers = make_user()
    question = "What are the common side effects of ibuprofen tablets?"

    res = ask(client, headers, question)

    assert res.status_code == 200
    body = res.json()
    assert body["answer"] == placeholder.ANSWER
    assert body["citations"] == []
    meta = body["meta"]
    assert meta["route"] == "knowledge"
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


def test_ask_variant_is_stored(client, db, make_user):
    _, headers = make_user()

    res = client.post("/ask?variant=naive", json={"question": "hi"}, headers=headers)

    assert res.status_code == 200
    assert db.rows("chat_messages")[-1]["variant"] == "naive"


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


def test_dosing_question_escalates_with_pharmacy(client, db, make_user):
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

    [esc] = db.rows("escalations")
    assert esc["message_id"] == meta["messageId"]
    assert esc["session_id"] == meta["sessionId"]
    assert esc["user_id"] == user_id
    assert esc["reason"] == "personal_dosing"
    assert esc["status"] == "pending"
    assert esc["pharmacy_id"] == pharmacy["id"]


def test_pregnancy_question_escalates_without_pharmacy(client, db, make_user):
    _, headers = make_user()

    ask(client, headers, "Can I take this while pregnant?")

    [esc] = db.rows("escalations")
    assert esc["reason"] == "pregnancy_or_child"
    assert esc["pharmacy_id"] is None


def test_unknown_pharmacy_returns_422(client, db, make_user):
    _, headers = make_user()

    res = ask(client, headers, "kitni dose?", pharmacyId=str(uuid4()))

    assert res.status_code == 422
    assert res.json() == {"status": 422, "message": "pharmacyId: unknown pharmacy"}
    assert db.rows("chat_messages") == []


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

    assert "".join(data["text"] for name, data in events if name == "token") == placeholder.ANSWER
    assert events[-3][1] == []
    meta = events[-2][1]
    assert {"messageId", "sessionId", "route", "escalated", "latencyMs"} <= set(meta)
    assert not any("_" in key for key in meta)
    assert events[-1][1] == {}

    assert meta["messageId"] == messages_of(db, meta["sessionId"])[-1]["id"]


def test_stream_failure_sends_error_event(client, make_user, monkeypatch):
    _, headers = make_user()

    async def boom(*_args, **_kwargs):
        raise RuntimeError("model down")

    monkeypatch.setattr(chat, "answer_question", boom)

    res = client.post("/ask/stream", json={"question": "hi"}, headers=headers)

    assert parse_sse(res.text) == [
        ("error", {"status": 500, "message": "Internal server error"})
    ]


# ---------- sessions ----------


def test_list_sessions_only_own_newest_first(client, make_user):
    _, alice = make_user(name="Alice")
    _, bob = make_user(name="Bob")
    first = ask(client, alice, "first question").json()["meta"]["sessionId"]
    second = ask(client, alice, "second question").json()["meta"]["sessionId"]
    ask(client, bob, "bob's question")

    res = client.get("/sessions", headers=alice)

    assert res.status_code == 200
    data = res.json()
    assert [s["id"] for s in data] == [second, first]
    assert set(data[0]) == {"id", "title", "createdAt", "updatedAt"}


def test_delete_sessions_removes_only_own_history(client, db, make_user):
    alice_id, alice = make_user(name="Alice")
    bob_id, bob = make_user(name="Bob")
    alice_msg = assistant_message(db, client, alice)
    client.post(f"/messages/{alice_msg['id']}/feedback", json={"rating": 1}, headers=alice)
    escalate(db, client, alice)
    ask(client, bob)

    res = client.delete("/sessions", headers=alice)

    assert res.status_code == 204
    for table in ("chat_sessions", "chat_messages", "escalations", "feedback"):
        assert all(r["user_id"] != alice_id for r in db.rows(table)), table
    assert len([s for s in db.rows("chat_sessions") if s["user_id"] == bob_id]) == 1


# ---------- feedback ----------


def test_feedback_vote_then_change(client, db, make_user):
    user_id, headers = make_user()
    msg = assistant_message(db, client, headers)
    url = f"/messages/{msg['id']}/feedback"

    assert client.post(url, json={"rating": 1}, headers=headers).status_code == 204
    res = client.post(url, json={"rating": -1, "comment": "wrong drug"}, headers=headers)

    assert res.status_code == 204
    [vote] = db.rows("feedback")
    assert (vote["user_id"], vote["rating"], vote["comment"]) == (user_id, -1, "wrong drug")


def test_feedback_on_other_users_message_returns_404(client, db, make_user):
    _, alice = make_user(name="Alice")
    _, bob = make_user(name="Bob")
    msg = assistant_message(db, client, alice)

    res = client.post(f"/messages/{msg['id']}/feedback", json={"rating": -1}, headers=bob)

    assert res.status_code == 404
    assert res.json() == {"status": 404, "message": "Message not found"}
    assert db.rows("feedback") == []


@pytest.mark.parametrize("which", ["user_message", "missing"])
def test_feedback_on_non_assistant_or_missing_message_returns_404(client, db, make_user, which):
    _, headers = make_user()
    session_id = ask(client, headers).json()["meta"]["sessionId"]
    user_msg = messages_of(db, session_id)[0]
    message_id = user_msg["id"] if which == "user_message" else str(uuid4())

    res = client.post(f"/messages/{message_id}/feedback", json={"rating": 1}, headers=headers)

    assert res.status_code == 404


# ---------- escalations ----------


def test_customer_cannot_use_escalations(client, db, make_user):
    _, customer = make_user()
    esc = escalate(db, client, customer)

    assert client.get("/escalations", headers=customer).status_code == 403
    res = client.post(f"/escalations/{esc['id']}/reply", json=REPLY, headers=customer)
    assert res.status_code == 403
    assert db.rows("escalations")[0]["status"] == "pending"


def test_list_escalations_shows_first_name_and_sources(client, db, make_user):
    _, customer = make_user(name="Ali Khan")
    _, vendor = make_user("vendor", name="Sara")
    esc = escalate(db, client, customer)
    cited = [{"n": 1, "drug": "paracetamol", "section": "Dosage", "url": "https://x.test"}]
    next(m for m in db.rows("chat_messages") if m["id"] == esc["message_id"])["citations"] = cited

    res = client.get("/escalations", headers=vendor)

    assert res.status_code == 200
    [item] = res.json()
    assert item["id"] == esc["id"]
    assert item["customerFirstName"] == "Ali"
    assert item["question"] == "Mujhe kitni dose leni chahiye?"
    assert item["reason"] == "personal_dosing"
    assert item["status"] == "pending"
    assert item["sources"] == cited
    assert "reply" not in item
    assert client.get("/escalations?status=answered", headers=vendor).json() == []


def test_reply_answers_and_adds_pharmacist_message(client, db, make_user):
    customer_id, customer = make_user()
    vendor_id, vendor = make_user("vendor", name="Sara")
    esc = escalate(db, client, customer)

    res = client.post(f"/escalations/{esc['id']}/reply", json=REPLY, headers=vendor)

    assert res.status_code == 204
    row = db.rows("escalations")[0]
    assert (row["status"], row["pharmacist_id"], row["reply"]) == (
        "answered",
        vendor_id,
        REPLY["reply"],
    )
    reply_msg = messages_of(db, esc["session_id"])[-1]
    assert (reply_msg["role"], reply_msg["user_id"]) == ("pharmacist", customer_id)
    answered = client.get("/escalations?status=answered", headers=vendor).json()
    assert [e["reply"] for e in answered] == [REPLY["reply"]]


def test_second_reply_returns_409(client, db, make_user):
    _, customer = make_user()
    _, vendor = make_user("vendor")
    _, admin = make_user("admin")
    esc = escalate(db, client, customer)
    url = f"/escalations/{esc['id']}/reply"
    client.post(url, json=REPLY, headers=vendor)

    res = client.post(url, json={"reply": "A different answer entirely."}, headers=admin)

    assert res.status_code == 409
    assert res.json() == {"status": 409, "message": "Escalation already answered"}
    assert db.rows("escalations")[0]["reply"] == REPLY["reply"]


def test_reply_to_unknown_escalation_returns_404(client, make_user):
    _, vendor = make_user("vendor")

    res = client.post(f"/escalations/{uuid4()}/reply", json=REPLY, headers=vendor)

    assert res.status_code == 404
    assert res.json() == {"status": 404, "message": "Escalation not found"}


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
