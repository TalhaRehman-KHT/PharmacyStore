"""GET/DELETE /sessions and POST /messages/{id}/feedback."""

from uuid import uuid4

import pytest

from tests.unit.api.helpers import ask, assistant_message, escalate, messages_of

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
