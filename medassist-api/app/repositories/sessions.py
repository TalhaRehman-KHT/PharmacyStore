"""Chat sessions. Every query is filtered by the caller's verified user_id."""

from uuid import UUID

from supabase import AsyncClient

from app.errors import NotFound
from app.repositories.mappers import session_out
from app.schemas.chat import ChatSessionOut

SESSION_LIMIT = 50


async def list_sessions(db: AsyncClient, user_id: UUID) -> list[ChatSessionOut]:
    """The caller's sessions, most recently active first (at most 50)."""
    res = await (
        db.table("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", str(user_id))
        .order("updated_at", desc=True)
        .limit(SESSION_LIMIT)
        .execute()
    )
    return [session_out(row) for row in res.data]


async def create_session(db: AsyncClient, user_id: UUID, title: str) -> ChatSessionOut:
    row = {"user_id": str(user_id), "title": title}
    res = await db.table("chat_sessions").insert(row).execute()
    return session_out(res.data[0])


async def assert_owned(db: AsyncClient, user_id: UUID, session_id: UUID) -> None:
    """Raise NotFound unless the session exists and belongs to user_id."""
    res = await (
        db.table("chat_sessions")
        .select("id")
        .eq("id", str(session_id))
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFound("Session not found")


async def delete_all_sessions(db: AsyncClient, user_id: UUID) -> None:
    """Delete the caller's sessions; messages, feedback and escalations go with them (cascade)."""
    await db.table("chat_sessions").delete().eq("user_id", str(user_id)).execute()
