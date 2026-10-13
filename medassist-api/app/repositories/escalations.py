"""Pharmacist escalation queue."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from supabase import AsyncClient

from app.config import get_settings
from app.errors import Conflict, NotFound
from app.repositories.mappers import escalation_out
from app.schemas.common import EscalationReason, EscalationStatus
from app.schemas.escalation import EscalationOut, InsightsOut

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


@dataclass(frozen=True)
class EscalationScope:
    """Which escalations a staff user may see and answer.

    all_access (admin, doctor): every row.
    Otherwise (vendor): rows of their own pharmacies plus general questions (pharmacy_id NULL),
    so a general question can be answered even when there is no admin (R13 BUG-R1).
    """

    all_access: bool
    pharmacy_ids: tuple[str, ...] = ()

    def allows(self, pharmacy_id: str | None) -> bool:
        return self.all_access or pharmacy_id is None or pharmacy_id in self.pharmacy_ids


async def load_scope(db: AsyncClient, user_id: UUID, role: str | None) -> EscalationScope:
    """Build the caller's scope once per request (one query for vendors, none for admins)."""
    if role in get_settings().staff_all_access_roles:
        return EscalationScope(all_access=True)
    res = await db.table("pharmacies").select("id").eq("vendor_id", str(user_id)).execute()
    return EscalationScope(all_access=False, pharmacy_ids=tuple(r["id"] for r in res.data))


def _scoped(query, scope: EscalationScope):
    """Add the vendor filter: own pharmacies OR no pharmacy (`in_` alone never matches NULL)."""
    if scope.all_access:
        return query
    parts = ["pharmacy_id.is.null"]
    if scope.pharmacy_ids:
        parts.append(f"pharmacy_id.in.({','.join(scope.pharmacy_ids)})")
    return query.or_(",".join(parts))


async def list_escalations(
    db: AsyncClient, status: EscalationStatus, scope: EscalationScope
) -> list[EscalationOut]:
    """Escalations with this status inside the caller's scope, newest first.

    Three queries whatever the queue size (escalations, customer names, citations).
    """
    query = (
        db.table("escalations")
        .select("id, message_id, user_id, question, reason, status, reply, answered_at, created_at")
        .eq("status", status)
    )
    res = await _scoped(query, scope).order("created_at", desc=True).limit(QUEUE_LIMIT).execute()
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
    db: AsyncClient,
    escalation_id: UUID,
    pharmacist_id: UUID,
    reply: str,
    scope: EscalationScope,
) -> None:
    """Answer a pending escalation (atomic RPC from sql/008).

    NotFound if the id does not exist or is outside the caller's scope (the same answer, so a
    vendor cannot learn that another pharmacy's escalation exists); Conflict if already answered.
    """
    res = await (
        db.table("escalations")
        .select("id, pharmacy_id")
        .eq("id", str(escalation_id))
        .limit(1)
        .execute()
    )
    if not res.data or not scope.allows(res.data[0].get("pharmacy_id")):
        raise NotFound("Escalation not found")

    # Parameter names must match the live function exactly (docs/DB_SCHEMA.md).
    answered = await db.rpc(
        "answer_escalation",
        {"p_id": str(escalation_id), "p_pharmacist": str(pharmacist_id), "p_reply": reply},
    ).execute()
    if not answered.data:
        raise Conflict("Escalation already answered")


async def get_insights(
    db: AsyncClient, scope: EscalationScope, now: datetime | None = None
) -> InsightsOut:
    """Pending escalations and unhelpful answers (last 7 days) inside the caller's scope.

    Feedback has no pharmacy, so for a vendor "unhelpful" counts only escalated answers in
    their scope (own pharmacies + general questions). Admin and doctor count every -1 rating.
    """
    since = ((now or datetime.now(UTC)) - timedelta(days=7)).isoformat()

    # 1. Pending escalations in scope.
    pending = await _scoped(
        db.table("escalations").select("id, message_id").eq("status", "pending"), scope
    ).execute()

    # 2. Recent -1 ratings (vendors: only on their escalated answers).
    query = db.table("feedback").select("id").eq("rating", -1).gte("created_at", since)
    if not scope.all_access:
        escalated = await _scoped(db.table("escalations").select("message_id"), scope).execute()
        message_ids = list({r["message_id"] for r in escalated.data})
        if not message_ids:
            return InsightsOut(unhelpful_last_7_days=0, pending_count=len(pending.data))
        query = query.in_("message_id", message_ids)
    unhelpful = await query.execute()

    return InsightsOut(unhelpful_last_7_days=len(unhelpful.data), pending_count=len(pending.data))
