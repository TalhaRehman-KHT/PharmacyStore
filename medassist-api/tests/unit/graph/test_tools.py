"""graph/nodes/tools.py: product search, alternatives and the tools node on a FakeSupabase shop."""

from datetime import date

import pytest

from app.graph.drugs import CatalogCache, load_catalog
from app.graph.nodes.tools import (
    MAX_PRODUCTS,
    find_alternatives,
    make_tools,
    search_products,
    search_words,
    shop_names,
    tools,
)
from tests.fakes.supabase import FakeSupabase
from tests.unit.graph.test_rewrite import seeded_db

TODAY = date(2026, 10, 15)
LATER = "2027-06-30"


class Shop:
    """A small shop: 3 pharmacies (one inactive), paracetamol in 3 brands, ibuprofen, metformin."""

    def __init__(self, db: FakeSupabase | None = None) -> None:
        self.db = db or FakeSupabase()
        self.city = self.pharmacy("City Pharmacy")
        self.home = self.pharmacy("Home Pharmacy")
        self.closed = self.pharmacy("Closed Pharmacy", is_active=False)

        self.panadol = self.medicine("Panadol 500mg", "Paracetamol", image_url="https://img/p.png")
        self.calpol = self.medicine("Calpol 500mg", "paracetamol")
        self.disprol = self.medicine("Disprol", "Paracetamol")
        self.brufen = self.medicine("Brufen 400mg", "Ibuprofen")
        self.glucophage = self.medicine("Glucophage 500mg", "Metformin")

    def pharmacy(self, name: str, is_active: bool = True) -> str:
        return self.db.seed(
            "pharmacies", vendor_id="v", name=name, license_number="L", address="a", city="c",
            is_active=is_active,
        )["id"]

    def medicine(self, name: str, generic: str | None, **extra) -> str:
        return self.db.seed("medicines", name=name, generic_name=generic, **extra)["id"]

    def batch(self, medicine: str, pharmacy: str, price, qty=10, expiry=LATER) -> str:
        return self.db.seed(
            "medicine_batches", medicine_id=medicine, pharmacy_id=pharmacy, batch_number="B",
            expiry_date=expiry, selling_price=price, quantity=qty,
        )["id"]


@pytest.fixture
def shop() -> Shop:
    return Shop()


def test_search_words_keep_only_safe_first_words():
    assert search_words(["Metformin Hydrochloride", "Panadol", "panadol extra", "ab", ""]) == [
        "metformin",
        "panadol",
    ]
    # filter syntax cannot get through: only [a-z0-9-] from the start of the name
    assert search_words(["x),name.eq.y", "*", "co-amoxiclav,drop"]) == ["co-amoxiclav"]


async def test_cheapest_valid_batch_with_pharmacy_name(shop):
    shop.batch(shop.brufen, shop.city, 80)
    cheap = shop.batch(shop.brufen, shop.home, 70)
    shop.batch(shop.brufen, shop.home, 10, qty=0)  # empty
    shop.batch(shop.brufen, shop.home, 11, expiry="2026-10-15")  # expires today: not sold
    shop.batch(shop.brufen, shop.home, 12, expiry="2025-01-01")  # expired
    shop.batch(shop.brufen, shop.closed, 5)  # inactive pharmacy
    shop.batch(shop.brufen, shop.home, None)  # no price

    [card] = await search_products(shop.db, "ibuprofen", today=TODAY)
    assert card.model_dump(by_alias=True, exclude_none=True) == {
        "batchId": cheap,
        "medicineId": shop.brufen,
        "name": "Brufen 400mg",
        "genericName": "Ibuprofen",
        "price": 70.0,
        "currency": "USD",
        "inStock": True,
        "pharmacyId": shop.home,
        "pharmacyName": "Home Pharmacy",
    }


async def test_customer_pharmacy_is_preferred_over_cheaper_stock(shop):
    shop.batch(shop.brufen, shop.home, 70)
    mine = shop.batch(shop.brufen, shop.city, 80)
    [card] = await search_products(shop.db, "Brufen", pharmacy_id=shop.city, today=TODAY)
    assert card.batch_id == mine and card.pharmacy_name == "City Pharmacy"


async def test_matches_name_or_generic_case_insensitive(shop):
    for med in (shop.panadol, shop.calpol, shop.disprol):
        shop.batch(med, shop.city, 50)
    by_generic = await search_products(shop.db, "PARACETAMOL", today=TODAY)
    assert [c.name for c in by_generic] == ["Calpol 500mg", "Disprol", "Panadol 500mg"]
    by_brand = await search_products(shop.db, "panadol", today=TODAY)
    assert [c.name for c in by_brand] == ["Panadol 500mg"]
    assert by_brand[0].image_url == "https://img/p.png"


async def test_in_stock_first_and_at_most_max_products(shop):
    shop.batch(shop.disprol, shop.city, 50)
    shop.batch(shop.panadol, shop.city, 55)
    shop.medicine("Paracetamol Syrup", "Paracetamol")  # never stocked
    cards = await search_products(shop.db, "paracetamol", today=TODAY)
    assert len(cards) == MAX_PRODUCTS
    assert [c.in_stock for c in cards] == [True, True, False]


async def test_out_of_stock_card_gets_in_stock_alternatives(shop):
    shop.batch(shop.calpol, shop.city, 40)
    shop.batch(shop.disprol, shop.home, 30)
    [card] = await search_products(shop.db, "Panadol", today=TODAY)
    assert card.in_stock is False
    assert card.batch_id is None and card.price is None and card.pharmacy_name is None
    assert [a.name for a in card.alternatives] == ["Disprol", "Calpol 500mg"]  # cheapest first
    assert all(a.in_stock and a.batch_id for a in card.alternatives)


async def test_out_of_stock_without_alternatives(shop):
    [card] = await search_products(shop.db, "metformin", today=TODAY)
    assert card.in_stock is False and card.alternatives is None


async def test_find_alternatives_same_generic_only_and_excludes(shop):
    shop.batch(shop.panadol, shop.city, 45)
    shop.batch(shop.calpol, shop.city, 40)
    shop.batch(shop.brufen, shop.city, 10)  # other generic
    alts = await find_alternatives(
        shop.db, "paracetamol", exclude_ids=[shop.calpol], currency="PKR", today=TODAY
    )
    assert [(a.name, a.currency) for a in alts] == [("Panadol 500mg", "PKR")]


async def test_find_alternatives_prefers_customer_pharmacy(shop):
    shop.batch(shop.calpol, shop.city, 40)
    shop.batch(shop.disprol, shop.home, 60)
    alts = await find_alternatives(shop.db, "Paracetamol", pharmacy_id=shop.home, today=TODAY)
    assert [a.name for a in alts] == ["Disprol", "Calpol 500mg"]


@pytest.mark.parametrize("name", ["", "  ", "x", "%", "*"])
async def test_nothing_to_search_makes_no_query(shop, name):
    before = shop.db.queries
    assert await search_products(shop.db, name, today=TODAY) == []
    if name.strip() != "x":
        assert await find_alternatives(shop.db, name, today=TODAY) == []
    assert shop.db.queries == before


async def test_tools_are_read_only(shop):
    shop.batch(shop.panadol, shop.city, 45)
    before = {t: [dict(r) for r in rows] for t, rows in shop.db.tables.items()}
    await search_products(shop.db, ["acetaminophen", "panadol", "paracetamol"], today=TODAY)
    assert shop.db.tables == before


# ---------- the node ----------


async def test_shop_names_add_brands_and_local_generics():
    catalog = await load_catalog(seeded_db())
    assert shop_names(catalog, ["acetaminophen", "albuterol"]) == [
        "acetaminophen",
        "panadol",
        "paracetamol",
        "albuterol",
        "salbutamol",
        "ventolin",
    ]


async def test_tools_node_finds_shop_products_for_us_names():
    shop = Shop(seeded_db())  # same db: synonyms + shop tables
    batch = shop.batch(shop.panadol, shop.city, 45)
    catalog = await load_catalog(shop.db)
    update = await tools(
        {"question": "Is Panadol in stock?", "drug_names": ["acetaminophen"], "timings": {}},
        db=shop.db,
        catalog=catalog,
        currency="USD",
    )
    names = [c.name for c in update["product_results"]]
    assert names[0] == "Panadol 500mg" and update["product_results"][0].batch_id == batch
    assert "tools" in update["timings"]


async def test_tools_node_without_drugs_returns_nothing():
    shop = Shop(seeded_db())
    node = make_tools(shop.db, CatalogCache(), "USD")
    update = await node({"question": "what do you sell?"})
    assert update["product_results"] == []
