"""Chat messages. jsonb columns (citations, products) are stored in the API's camelCase shape."""

from uuid import UUID

from supabase import AsyncClient

from app.repositories.mappers import message_out
from app.repositories.sessions import assert_owned
from app.schemas.chat import ChatMessageOut, Citation, ProductCard
from app.schemas.common import Role, Route, Variant


async def add_message(
    db: AsyncClient,
    *,
    session_id: UUID,
    user_id: UUID,
    role: Role,
    content: str,
    route: Route | None = None,
    citations: list[Citation] | None = None,
    products: list[ProductCard] | None = None,
    variant: Variant | None = None,
    latency_ms: int | None = None,
    tokens: int | None = None,
) -> dict:
    """Insert one message and return the stored row."""
    row = {
        "session_id": str(session_id),
        "user_id": str(user_id),
        "role": role,
        "content": content,
        "route": route,
        "citations": [c.model_dump(mode="json", by_alias=True) for c in citations or []],
        "products": [
            p.model_dump(mode="json", by_alias=True, exclude_none=True) for p in products or []
        ],
        "variant": variant,
        "latency_ms": latency_ms,
        "tokens": tokens,
    }
    res = await db.table("chat_messages").insert(row).execute()
    return res.data[0]


async def recent_messages(db: AsyncClient, session_id: UUID, limit: int) -> list[tuple[str, str]]:
    """The last `limit` messages of a session as (role, content), oldest first (one query).
    The caller has already checked that the session belongs to the user."""
    res = await (
        db.table("chat_messages")
        .select("role, content, created_at")
        .eq("session_id", str(session_id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [(r["role"], r["content"]) for r in reversed(res.data or [])]


async def get_messages(db: AsyncClient, user_id: UUID, session_id: UUID) -> list[ChatMessageOut]:
    """Messages of one of the caller's sessions, oldest first.

    At most 4 queries, whatever the number of messages (see .local/LEARNING.md "get_messages"):
    1. ownership check, 2. messages, 3. the caller's feedback, 4. escalations.
    Another user's session raises NotFound, exactly like a session that does not exist.
    """
    # 1. Ownership. The service key skips RLS, so this check is what keeps chats private.
    await assert_owned(db, user_id, session_id)

    # 2. All messages of the session, oldest first.
    res = await (
        db.table("chat_messages")
        .select("id, session_id, role, content, route, citations, products, latency_ms, created_at")
        .eq("session_id", str(session_id))
        .order("created_at")
        .execute()
    )
    rows = res.data

    # Only assistant answers can be rated or escalated.
    answer_ids = [row["id"] for row in rows if row["role"] == "assistant"]
    ratings: dict[str, int] = {}
    escalations: dict[str, dict] = {}

    if answer_ids:
        # 3. The caller's ratings for all answers in ONE query (not one query per message).
        res = await (
            db.table("feedback")
            .select("message_id, rating")
            .eq("user_id", str(user_id))
            .in_("message_id", answer_ids)
            .execute()
        )
        ratings = {row["message_id"]: row["rating"] for row in res.data}

        # 4. Escalations for all answers in ONE query.
        res = await (
            db.table("escalations")
            .select("message_id, reason, status")
            .in_("message_id", answer_ids)
            .execute()
        )
        escalations = {row["message_id"]: row for row in res.data}

    # Join in Python: look up each message's rating and escalation by id.
    return [
        message_out(row, ratings.get(row["id"]), escalations.get(row["id"])) for row in rows
    ]
