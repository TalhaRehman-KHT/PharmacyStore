"""Read-only lookups on the shop's pharmacies table."""

from uuid import UUID

from supabase import AsyncClient


async def pharmacy_exists(db: AsyncClient, pharmacy_id: UUID) -> bool:
    """True when a pharmacy with this id exists."""
    res = await db.table("pharmacies").select("id").eq("id", str(pharmacy_id)).limit(1).execute()
    return bool(res.data)


async def vendor_pharmacy_ids(db: AsyncClient, vendor_id: UUID) -> tuple[str, ...]:
    """Ids of the pharmacies owned by this vendor (empty when none)."""
    res = await db.table("pharmacies").select("id").eq("vendor_id", str(vendor_id)).execute()
    return tuple(r["id"] for r in res.data)
