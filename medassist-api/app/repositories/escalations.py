"""Pharmacist escalation queue."""

from uuid import UUID

from supabase import AsyncClient

from app.errors import Conflict, NotFound
from app.repositories.mappers import escalation_out
from app.schemas.common import EscalationReason, EscalationStatus
from app.schemas.escalation import EscalationOut

QUEUE_LIMIT = 100


async def create_escalation(
    db: AsyncClient,
    *,
    message_id: UUID,
    session_id: UUID,
    user_id: UUID,
    question: str,
    reason: EscalationReason,
    pharmacy_id: UUID | None = None,
) -> dict:
    """Queue a question for a pharmacist. message_id is the assistant message that escalated."""
    res = await (
        db.table("escalations")
        .insert(
            {
                "message_id": str(message_id),
                "session_id": str(session_id),
                "user_id": str(user_id),
                "question": question,
                "reason": reason,
                "pharmacy_id": str(pharmacy_id) if pharmacy_id else None,
            }
        )
        .execute()
    )
    return res.data[0]


async def list_escalations(db: AsyncClient, status: EscalationStatus) -> list[EscalationOut]:
    """Escalations with this status, newest first. Three queries whatever the queue size.

    TODO(3.4): scope by pharmacy (vendors see only their pharmacy's escalations).
    """
    res = await (
        db.table("escalations")
        .select("id, message_id, user_id, question, reason, status, reply, answered_at, created_at")
        .eq("status", status)
        .order("created_at", desc=True)
        .limit(QUEUE_LIMIT)
        .execute()
    )
    rows = res.data
    if not rows:
        return []

    user_ids = list({r["user_id"] for r in rows})
    users = await db.table("users").select("id, name").in_("id", user_ids).execute()
    names = {u["id"]: u.get("name") for u in users.data}

    message_ids = list({r["message_id"] for r in rows})
    messages = (
        await db.table("chat_messages").select("id, citations").in_("id", message_ids).execute()
    )
    citations = {m["id"]: m.get("citations") or [] for m in messages.data}

    return [
        escalation_out(r, names.get(r["user_id"]), citations.get(r["message_id"], []))
        for r in rows
    ]


async def answer_escalation(
    db: AsyncClient, escalation_id: UUID, pharmacist_id: UUID, reply: str
) -> None:
    """Answer a pending escalation (atomic RPC from sql/008).

    NotFound if the id does not exist; Conflict if it was already answered.
    """
    res = await (
        db.table("escalations").select("id").eq("id", str(escalation_id)).limit(1).execute()
    )
    if not res.data:
        raise NotFound("Escalation not found")

    # Parameter names must match the live function exactly (docs/DB_SCHEMA.md).
    answered = await db.rpc(
        "answer_escalation",
        {"p_id": str(escalation_id), "p_pharmacist": str(pharmacist_id), "p_reply": reply},
    ).execute()
    if not answered.data:
        raise Conflict("Escalation already answered")
