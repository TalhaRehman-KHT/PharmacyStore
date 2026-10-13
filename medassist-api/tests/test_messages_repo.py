"""get_messages contract. These FAIL until get_messages (written by hand) is implemented.

See the docstring of app.repositories.messages.get_messages.
"""

from uuid import UUID, uuid4

import pytest

from app.errors import NotFound
from app.repositories.messages import get_messages
from tests.conftest import bearer, make_token


def _session(db, user_id: str) -> str:
    return db.seed("chat_sessions", user_id=user_id, title="Paracetamol")["id"]


def _turn(db, session_id: str, user_id: str, n: int) -> tuple[dict, dict]:
    """One user question + one assistant answer."""
    q = db.seed(
        "chat_messages", session_id=session_id, user_id=user_id, role="user", content=f"q{n}"
    )
    a = db.seed(
        "chat_messages",
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=f"a{n}",
        route="knowledge",
        variant="agent",
        latency_ms=120,
        citations=[{"n": 1, "drug": "paracetamol", "section": "Uses", "url": "https://x.test"}],
    )
    return q, a


async def test_other_users_session_raises_not_found(db):
    alice, bob = str(uuid4()), str(uuid4())
    session_id = _session(db, alice)
    _turn(db, session_id, alice, 1)

    with pytest.raises(NotFound):
        await get_messages(db, UUID(bob), UUID(session_id))


async def test_missing_session_raises_not_found(db):
    with pytest.raises(NotFound):
        await get_messages(db, uuid4(), uuid4())


async def test_messages_oldest_first(db):
    user = str(uuid4())
    session_id = _session(db, user)
    other_session = _session(db, user)
    for n in range(3):
        _turn(db, session_id, user, n)
    _turn(db, other_session, user, 99)

    out = await get_messages(db, UUID(user), UUID(session_id))

    assert [m.content for m in out] == ["q0", "a0", "q1", "a1", "q2", "a2"]
    assert all(str(m.session_id) == session_id for m in out)
    assert [m.created_at for m in out] == sorted(m.created_at for m in out)


async def test_rating_and_escalation_attached(db):
    user = str(uuid4())
    session_id = _session(db, user)
    q1, a1 = _turn(db, session_id, user, 1)
    _q2, a2 = _turn(db, session_id, user, 2)
    db.seed("feedback", message_id=a1["id"], user_id=user, rating=-1)
    db.seed(
        "escalations",
        message_id=a2["id"],
        session_id=session_id,
        user_id=user,
        question="q2",
        reason="personal_dosing",
        status="answered",
    )

    out = {str(m.id): m for m in await get_messages(db, UUID(user), UUID(session_id))}

    first, second = out[a1["id"]], out[a2["id"]]
    assert first.feedback == -1
    assert first.meta.escalated is False
    assert first.meta.escalation_status is None
    assert second.feedback is None
    assert second.meta.escalated is True
    assert second.meta.escalation_reason == "personal_dosing"
    assert second.meta.escalation_status == "answered"
    assert second.meta.latency_ms == 120
    assert second.citations[0].drug == "paracetamol"
    assert out[q1["id"]].meta is None  # user messages carry no meta


async def test_only_callers_rating_is_attached(db):
    user = str(uuid4())
    session_id = _session(db, user)
    _q, a = _turn(db, session_id, user, 1)
    db.seed("feedback", message_id=a["id"], user_id=str(uuid4()), rating=1)

    out = await get_messages(db, UUID(user), UUID(session_id))

    assert out[1].feedback is None


async def test_query_count_does_not_grow_with_messages(db):
    def seed_turns(turns: int) -> tuple[str, str]:
        user = str(uuid4())
        session_id = _session(db, user)
        for n in range(turns):
            _q, a = _turn(db, session_id, user, n)
            db.seed("feedback", message_id=a["id"], user_id=user, rating=1)
        return user, session_id

    small_user, small_session = seed_turns(1)  # 2 messages
    big_user, big_session = seed_turns(10)  # 20 messages

    before = db.queries
    await get_messages(db, UUID(small_user), UUID(small_session))
    small = db.queries - before
    before = db.queries
    await get_messages(db, UUID(big_user), UUID(big_session))
    big = db.queries - before

    assert small == big
    assert big <= 4


# ---------- route: GET /sessions/{id}/messages ----------


def test_route_returns_camel_case_for_owner(client, db):
    user = uuid4()
    session_id = _session(db, str(user))
    _turn(db, session_id, str(user), 1)

    res = client.get(f"/sessions/{session_id}/messages", headers=bearer(make_token(user)))

    assert res.status_code == 200
    question, answer = res.json()
    assert set(question) == {"id", "sessionId", "role", "content", "createdAt"}
    assert answer["meta"]["latencyMs"] == 120
    assert answer["meta"]["sessionId"] == session_id


def test_route_returns_404_for_other_user(client, db):
    session_id = _session(db, str(uuid4()))

    res = client.get(f"/sessions/{session_id}/messages", headers=bearer(make_token()))

    assert res.status_code == 404
    assert res.json() == {"status": 404, "message": "Session not found"}
