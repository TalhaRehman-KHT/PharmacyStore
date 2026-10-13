"""Read-only access to the shop's medicines table (input for the drug list)."""

from supabase import AsyncClient

PAGE_SIZE = 1000  # PostgREST returns at most 1000 rows per request


async def fetch_medicines(db: AsyncClient) -> list[dict]:
    """All medicines rows (id, name, generic_name), paged. Read-only."""
    rows: list[dict] = []
    start = 0
    while True:
        res = await (
            db.table("medicines")
            .select("id,name,generic_name")
            .order("id")
            .range(start, start + PAGE_SIZE - 1)
            .execute()
        )
        rows.extend(res.data)
        if len(res.data) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE
