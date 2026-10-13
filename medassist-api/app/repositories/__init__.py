"""Data access. Plain async functions taking `db`; no FastAPI imports.

The service role key bypasses RLS, so every customer query filters by the verified user_id.
`Repos` bundles the functions around one client so routes can take a single dependency.
"""

from uuid import UUID

from supabase import AsyncClient

from app.repositories import escalations, feedback, messages, pharmacies, sessions


class Repos:
    """All repositories bound to one database client."""

    def __init__(self, db: AsyncClient) -> None:
        self.db = db

    # sessions
    async def list_sessions(self, user_id: UUID):
        return await sessions.list_sessions(self.db, user_id)

    async def create_session(self, user_id: UUID, title: str):
        return await sessions.create_session(self.db, user_id, title)

    async def assert_session_owned(self, user_id: UUID, session_id: UUID) -> None:
        await sessions.assert_owned(self.db, user_id, session_id)

    async def delete_all_sessions(self, user_id: UUID) -> None:
        await sessions.delete_all_sessions(self.db, user_id)

    # messages
    async def add_message(self, **kwargs) -> dict:
        return await messages.add_message(self.db, **kwargs)

    async def get_messages(self, user_id: UUID, session_id: UUID):
        return await messages.get_messages(self.db, user_id, session_id)

    # feedback
    async def upsert_feedback(self, user_id: UUID, message_id: UUID, rating: int, comment):
        await feedback.upsert_feedback(self.db, user_id, message_id, rating, comment)

    # escalations
    async def create_escalation(self, **kwargs) -> dict:
        return await escalations.create_escalation(self.db, **kwargs)

    async def escalation_scope(self, user_id: UUID, role: str | None):
        return await escalations.load_scope(self.db, user_id, role)

    async def list_escalations(self, status, scope):
        return await escalations.list_escalations(self.db, status, scope)

    async def answer_escalation(
        self, escalation_id: UUID, pharmacist_id: UUID, reply: str, scope
    ) -> None:
        await escalations.answer_escalation(self.db, escalation_id, pharmacist_id, reply, scope)

    async def get_insights(self, scope):
        return await escalations.get_insights(self.db, scope)

    # pharmacies (read-only shop table)
    async def pharmacy_exists(self, pharmacy_id: UUID) -> bool:
        return await pharmacies.pharmacy_exists(self.db, pharmacy_id)
