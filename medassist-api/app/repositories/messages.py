"""Chat messages. jsonb columns (citations, products) are stored in the API's camelCase shape."""

from uuid import UUID

from supabase import AsyncClient

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
    }
    res = await db.table("chat_messages").insert(row).execute()
    return res.data[0]


async def get_messages(db: AsyncClient, user_id: UUID, session_id: UUID) -> list[ChatMessageOut]:
    """Messages of one of the caller's sessions, oldest first.

    TODO(Talha): written by hand. Contract (tests/test_messages_repo.py):
    - Confirm the session belongs to user_id, else raise app.errors.NotFound
      (sessions.assert_owned does this).
    - Fetch the session's messages ordered by created_at ascending.
    - Attach this user's feedback rating (feedback.rating where user_id = caller) per message.
    - Attach escalation status per message with ONE extra query for all message ids
      (escalations where message_id in (...)), so the query count does not grow with the
      number of messages.
    - Build each item with app.repositories.mappers.message_out(row, rating, escalation).
    """
    raise NotImplementedError("get_messages is written by hand (see docstring)")
