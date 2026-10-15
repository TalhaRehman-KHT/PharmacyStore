"""graph/nodes/tools.py against the REAL shop tables (read-only: nothing is written).

Run: RUN_INTEGRATION=1 pytest -m integration -q tests/integration/test_live_products.py
"""

from datetime import date

import pytest

from app.graph.nodes.tools import find_alternatives, search_products, search_words

pytestmark = pytest.mark.integration


async def test_search_products_on_the_real_shop(live_db, real_settings):
    """Every in-stock card points at a batch that is really sellable (checked again row by row)."""
    res = await (
        live_db.table("medicine_batches")
        .select("medicine_id")
        .gt("quantity", 0)
        .gt("expiry_date", date.today().isoformat())
        .limit(1)
        .execute()
    )
    if not res.data:
        pytest.skip("no medicine in stock in the shop")
    med = (
        await live_db.table("medicines")
        .select("id,name,generic_name")
        .eq("id", res.data[0]["medicine_id"])
        .single()
        .execute()
    ).data
    if not search_words([med["name"]]):
        pytest.skip("first stocked medicine has no searchable name")

    before = await live_db.table("medicine_batches").select("id,quantity").execute()
    cards = await search_products(live_db, med["name"], currency=real_settings.shop_currency)
    assert cards, f"no card for {med['name']!r}"
    assert any(c.medicine_id == med["id"] for c in cards)

    for card in [c for c in cards if c.in_stock]:
        batch = (
            await live_db.table("medicine_batches")
            .select("medicine_id,pharmacy_id,quantity,expiry_date,selling_price")
            .eq("id", card.batch_id)
            .single()
            .execute()
        ).data
        assert batch["medicine_id"] == card.medicine_id
        assert batch["pharmacy_id"] == card.pharmacy_id and card.pharmacy_name
        assert batch["quantity"] > 0 and batch["expiry_date"] > date.today().isoformat()
        assert float(batch["selling_price"]) == card.price
        assert card.currency == real_settings.shop_currency

    if med["generic_name"]:
        alts = await find_alternatives(live_db, med["generic_name"], exclude_ids=[med["id"]])
        assert all(a.in_stock and a.medicine_id != med["id"] for a in alts)

    after = await live_db.table("medicine_batches").select("id,quantity").execute()
    assert after.data == before.data  # read-only


async def test_unknown_medicine_finds_nothing(live_db):
    assert await search_products(live_db, "zzqxnotamedicine") == []
