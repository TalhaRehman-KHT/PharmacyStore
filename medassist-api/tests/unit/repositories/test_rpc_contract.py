"""RPC calls must use the LIVE parameter names (docs/DB_SCHEMA.md); the fake rejects any other."""

import pytest

from app.errors import Conflict
from app.repositories import escalations
from app.repositories.escalations import EscalationScope
from tests.fakes import RPC_PARAMS, FakeError

ALL = EscalationScope(all_access=True)


def _seed_escalation(db) -> tuple[dict, dict]:
    user = db.seed("users", name="Ali Khan", role="user", is_active=True)
    pharmacist = db.seed("users", name="Sara", role="vendor", is_active=True)
    session = db.seed("chat_sessions", user_id=user["id"])
    message = db.seed(
        "chat_messages", session_id=session["id"], user_id=user["id"], role="assistant", content="x"
    )
    esc = db.seed(
        "escalations",
        message_id=message["id"],
        session_id=session["id"],
        user_id=user["id"],
        question="kitni dose?",
        reason="personal_dosing",
    )
    return esc, pharmacist


def test_live_signature_is_recorded():
    assert RPC_PARAMS["answer_escalation"] == ("p_id", "p_pharmacist", "p_reply")


async def test_old_parameter_names_fail(db):
    esc, pharmacist = _seed_escalation(db)
    old = {"p_escalation_id": esc["id"], "p_pharmacist_id": pharmacist["id"], "p_reply": "Hi"}

    with pytest.raises(FakeError, match="live signature"):
        await db.rpc("answer_escalation", old).execute()
    assert db.rows("escalations")[0]["status"] == "pending"


async def test_one_wrong_name_fails(db):
    esc, pharmacist = _seed_escalation(db)
    params = {"p_id": esc["id"], "p_pharmacist_id": pharmacist["id"], "p_reply": "Hi"}

    with pytest.raises(FakeError):
        await db.rpc("answer_escalation", params).execute()


async def test_unknown_rpc_fails(db):
    with pytest.raises(FakeError, match="no known live signature"):
        await db.rpc("does_not_exist", {}).execute()


async def test_repository_uses_live_names(db):
    esc, pharmacist = _seed_escalation(db)

    await escalations.answer_escalation(
        db, esc["id"], pharmacist["id"], "Please see a doctor.", ALL
    )

    row = db.rows("escalations")[0]
    assert row["status"] == "answered"
    assert row["pharmacist_id"] == pharmacist["id"]
    reply = [m for m in db.rows("chat_messages") if m["role"] == "pharmacist"]
    assert len(reply) == 1
    assert reply[0]["user_id"] == esc["user_id"]  # owned by the customer, not the pharmacist


async def test_repository_second_answer_conflicts(db):
    esc, pharmacist = _seed_escalation(db)
    await escalations.answer_escalation(db, esc["id"], pharmacist["id"], "First", ALL)

    with pytest.raises(Conflict):
        await escalations.answer_escalation(db, esc["id"], pharmacist["id"], "Second", ALL)


async def test_empty_reply_rejected_like_live(db):
    esc, pharmacist = _seed_escalation(db)

    params = {"p_id": esc["id"], "p_pharmacist": pharmacist["id"], "p_reply": " "}

    with pytest.raises(FakeError, match="must not be empty"):
        await db.rpc("answer_escalation", params).execute()
