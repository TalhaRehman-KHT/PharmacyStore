"""Thumbs up / down on assistant messages. One vote per user per message."""

from uuid import UUID

from supabase import AsyncClient

from app.errors import NotFound


async def upsert_feedback(
    db: AsyncClient, user_id: UUID, message_id: UUID, rating: int, comment: str | None
) -> None:
    """Save or replace the caller's vote.

    The message must be an assistant message in one of the caller's sessions; anything else
    (missing, someone else's, a user message) is NotFound.
    """
    res = await (
        db.table("chat_messages")
        .select("id")
        .eq("id", str(message_id))
        .eq("user_id", str(user_id))
        .eq("role", "assistant")
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFound("Message not found")

    await (
        db.table("feedback")
        .upsert(
            {
                "message_id": str(message_id),
                "user_id": str(user_id),
                "rating": rating,
                "comment": comment,
            },
            on_conflict="message_id,user_id",
        )
        .execute()
    )
