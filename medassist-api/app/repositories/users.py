"""Read-only lookups on the shop's users table (custom auth table)."""

from uuid import UUID

from supabase import AsyncClient


async def get_user(db: AsyncClient, user_id: UUID) -> dict | None:
    """The public.users row (id, name, role, is_active), or None if there is none."""
    res = await (
        db.table("users")
        .select("id, name, role, is_active")
        .eq("id", str(user_id))
        .maybe_single()
        .execute()
    )
    return res.data if res and res.data else None
