"""Checks against the REAL database.

Run: RUN_INTEGRATION=1 ITEST_USER_EMAIL=<email> pytest -m integration -q
"""

from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from tests.integration.conftest import PREFIX, ROOT

pytestmark = pytest.mark.integration

MEDASSIST_TABLES = [
    "chat_sessions",
    "chat_messages",
    "escalations",
    "feedback",
    "drug_documents",
    "drug_chunks",
    "drug_synonyms",
]


def documented_columns(table: str) -> list[str]:
    """Column names of `table` as listed in docs/DB_SCHEMA.md (generated from the live DB)."""
    path = ROOT / "docs" / "DB_SCHEMA.md"
    if not path.exists():
        pytest.skip("docs/DB_SCHEMA.md missing: run python -m scripts.snapshot_schema")
    columns, inside = [], False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("### "):
            inside = line[4:].strip() == table
        elif inside and line.startswith("| ") and not line.startswith(("| column", "| ---")):
            columns.append(line.split("|")[1].strip())
    assert columns, f"{table} not found in docs/DB_SCHEMA.md"
    return columns


async def seed_conversation(db, user_id: str, title: str) -> dict:
    """Session + user question + assistant answer + pending escalation, all `[itest]`."""
    session = (
        await db.table("chat_sessions")
        .insert({"user_id": user_id, "title": f"{PREFIX} {title}"})
        .execute()
    ).data[0]
    question, answer = (
        await db.table("chat_messages")
        .insert(
            [
                {"session_id": session["id"], "user_id": user_id, "role": "user",
                 "content": f"{PREFIX} kitni dose"},
                {"session_id": session["id"], "user_id": user_id, "role": "assistant",
                 "content": f"{PREFIX} answer", "route": "escalated", "variant": "agent"},
            ]
        )
        .execute()
    ).data
    escalation = (
        await db.table("escalations")
        .insert(
            {"message_id": answer["id"], "session_id": session["id"], "user_id": user_id,
             "question": f"{PREFIX} kitni dose", "reason": "personal_dosing"}
        )
        .execute()
    ).data[0]
    return {"session": session, "question": question, "answer": answer, "escalation": escalation}


@pytest.mark.parametrize("table", MEDASSIST_TABLES)
async def test_medassist_tables_expose_documented_columns(live_db, table):
    columns = documented_columns(table)

    res = await live_db.table(table).select(",".join(columns)).limit(1).execute()

    assert isinstance(res.data, list)


async def test_session_delete_cascades(live_db, itest_user, itest_cleanup):
    seeded = await seed_conversation(live_db, itest_user, "cascade")
    feedback = (
        await live_db.table("feedback")
        .insert({"message_id": seeded["answer"]["id"], "user_id": itest_user, "rating": 1})
        .execute()
    ).data[0]

    await live_db.table("chat_sessions").delete().eq("id", seeded["session"]["id"]).execute()

    children = {
        "chat_messages": [seeded["question"]["id"], seeded["answer"]["id"]],
        "escalations": [seeded["escalation"]["id"]],
        "feedback": [feedback["id"]],
    }
    for table, ids in children.items():
        res = await live_db.table(table).select("id").in_("id", ids).execute()
        assert res.data == [], f"{table} rows survived the session delete"


async def test_answer_escalation_rpc(live_db, itest_user, itest_cleanup):
    seeded = await seed_conversation(live_db, itest_user, "rpc")
    params = {
        "p_id": seeded["escalation"]["id"],
        "p_pharmacist": itest_user,
        "p_reply": f"{PREFIX} pharmacist reply",
    }

    first = await live_db.rpc("answer_escalation", params).execute()
    second = await live_db.rpc("answer_escalation", params).execute()

    assert first.data == seeded["escalation"]["id"]
    assert second.data is None
    replies = (
        await live_db.table("chat_messages")
        .select("user_id, content")
        .eq("session_id", seeded["session"]["id"])
        .eq("role", "pharmacist")
        .execute()
    ).data
    assert replies == [{"user_id": itest_user, "content": params["p_reply"]}]


async def test_drug_synonyms_seeded(live_db):
    res = await live_db.table("drug_synonyms").select("id", count="exact").limit(1).execute()

    assert res.count is not None and res.count >= 17, "run sql/005_seed_synonyms.sql"


async def test_anon_key_cannot_reach_private_data(anon_db):
    """The browser's anon key must not answer escalations or read chat messages."""
    try:
        res = await anon_db.rpc(
            "answer_escalation",
            {"p_id": str(uuid4()), "p_pharmacist": str(uuid4()), "p_reply": f"{PREFIX} x"},
        ).execute()
    except APIError:
        pass  # permission denied / function not exposed: expected
    else:
        pytest.fail(f"anon key could call answer_escalation (returned {res.data!r})")

    try:
        res = await anon_db.table("chat_messages").select("*").limit(1).execute()
    except APIError:
        return
    assert res.data == [], "anon key can read chat_messages"
