"""Tools node: read-only product functions (stock, price, alternatives) on the shop's tables.

The ONLY place product data is read (CLAUDE.md). Fixed, parameterised PostgREST queries, SELECT
only: no LLM ever writes SQL, and nothing here inserts, updates or deletes. The LLM never sees a
table; it only gets the product cards these functions return.

Three small queries instead of one join (the fake DB and the real one behave the same way):
1. medicines whose name or generic_name contains a search word
2. their medicine_batches that can be sold: quantity > 0, expiry_date after today, a price
3. the pharmacies of those batches that are active

Per medicine the card shows ONE batch, the one the cart will use: the customer's pharmacy
(pharmacy_id of the request) first, then the cheapest, then the one that expires first.
Out of stock: no batch / price, plus up to MAX_ALTERNATIVES in-stock medicines with the same
generic name.
"""

import re
import time
from collections.abc import Awaitable, Callable, Iterable
from datetime import date

from supabase import AsyncClient

from app.graph.drugs import CatalogCache, DrugCatalog
from app.graph.state import AgentLanguage, AgentState, add_timing
from app.schemas.chat import ProductCard

MAX_PRODUCTS = 3  # cards under one answer
MAX_ALTERNATIVES = 2  # per out-of-stock card
MAX_MATCHES = 20  # medicines rows read per search
MAX_TERMS = 8  # search words per search (names + brands)
_WORD = re.compile(r"[a-z0-9][a-z0-9-]{2,}")  # safe inside a PostgREST filter string


def search_words(names: Iterable[str]) -> list[str]:
    """The first word of each name, lower case, letters / digits / '-' only, >= 3 characters:
    "Metformin Hydrochloride" -> "metformin", "Panadol Extra" -> "panadol". Only these words
    reach the filter string, so a name can never change the query."""
    out: list[str] = []
    for name in names:
        m = _WORD.match(" ".join(str(name).lower().split()))
        if m and m.group() not in out:
            out.append(m.group())
    return out[:MAX_TERMS]


async def _sellable_batches(
    db: AsyncClient, medicine_ids: list[str], today: date
) -> tuple[list[dict], dict[str, str]]:
    """Batches that can be sold (in stock, not expired, priced, active pharmacy) and the names of
    their pharmacies {pharmacy_id: name}."""
    if not medicine_ids:
        return [], {}
    res = await (
        db.table("medicine_batches")
        .select("id,medicine_id,pharmacy_id,selling_price,quantity,expiry_date")
        .in_("medicine_id", medicine_ids)
        .gt("quantity", 0)
        .gt("expiry_date", today.isoformat())
        .execute()
    )
    batches = [b for b in res.data if b.get("selling_price") is not None]
    pharmacy_ids = sorted({b["pharmacy_id"] for b in batches})
    if not pharmacy_ids:
        return [], {}
    res = await (
        db.table("pharmacies")
        .select("id,name")
        .in_("id", pharmacy_ids)
        .eq("is_active", True)
        .execute()
    )
    names = {p["id"]: p["name"] for p in res.data}
    return [b for b in batches if b["pharmacy_id"] in names], names


def best_batch(batches: list[dict], pharmacy_id: str | None) -> dict | None:
    """The batch the cart should use: the customer's pharmacy, then cheapest, then the earliest
    expiry (sell old stock first)."""
    if not batches:
        return None
    return min(
        batches,
        key=lambda b: (
            b["pharmacy_id"] != pharmacy_id,
            float(b["selling_price"]),
            str(b["expiry_date"]),
        ),
    )


def product_card(
    medicine: dict, batch: dict | None, pharmacies: dict[str, str], currency: str
) -> ProductCard:
    """One card. No batch = out of stock (no price, no pharmacy)."""
    return ProductCard(
        batch_id=batch["id"] if batch else None,
        medicine_id=medicine["id"],
        name=medicine["name"],
        generic_name=medicine.get("generic_name") or None,
        price=float(batch["selling_price"]) if batch else None,
        currency=currency,
        in_stock=batch is not None,
        pharmacy_id=batch["pharmacy_id"] if batch else None,
        pharmacy_name=pharmacies.get(batch["pharmacy_id"]) if batch else None,
        image_url=medicine.get("image_url") or None,
    )


async def _cards(
    db: AsyncClient,
    medicines: list[dict],
    *,
    pharmacy_id: str | None,
    currency: str,
    today: date,
) -> list[ProductCard]:
    """Cards for `medicines` (order kept), each with its best sellable batch or out of stock."""
    batches, pharmacies = await _sellable_batches(db, [m["id"] for m in medicines], today)
    by_medicine: dict[str, list[dict]] = {}
    for b in batches:
        by_medicine.setdefault(b["medicine_id"], []).append(b)
    return [
        product_card(m, best_batch(by_medicine.get(m["id"], []), pharmacy_id), pharmacies, currency)
        for m in medicines
    ]


async def find_alternatives(
    db: AsyncClient,
    generic_name: str,
    *,
    exclude_ids: Iterable[str] = (),
    pharmacy_id: str | None = None,
    currency: str = "USD",
    today: date | None = None,
    limit: int = MAX_ALTERNATIVES,
) -> list[ProductCard]:
    """In-stock medicines with the same generic name (case-insensitive, whole name), cheapest
    first, without `exclude_ids` (the medicine they replace)."""
    generic = " ".join(generic_name.split())
    if not generic or "*" in generic or "%" in generic:
        return []
    res = await (
        db.table("medicines")
        .select("id,name,generic_name,image_url")
        .ilike("generic_name", generic)
        .limit(MAX_MATCHES)
        .execute()
    )
    skip = set(exclude_ids)
    medicines = [m for m in res.data if m["id"] not in skip]
    cards = await _cards(
        db, medicines, pharmacy_id=pharmacy_id, currency=currency, today=today or date.today()
    )
    in_stock = [c for c in cards if c.in_stock]
    in_stock.sort(key=lambda c: (c.pharmacy_id != pharmacy_id, c.price))
    return in_stock[:limit]


async def search_products(
    db: AsyncClient,
    name: str | Iterable[str],
    *,
    pharmacy_id: str | None = None,
    currency: str = "USD",
    today: date | None = None,
    limit: int = MAX_PRODUCTS,
) -> list[ProductCard]:
    """Shop medicines whose name or generic name contains the (first) word of `name` (one name
    or several, e.g. a drug and its brands). In-stock cards first; out-of-stock cards carry
    in-stock alternatives with the same generic."""
    words = search_words([name] if isinstance(name, str) else name)
    if not words:
        return []
    match = ",".join(f"{col}.ilike.*{w}*" for w in words for col in ("name", "generic_name"))
    res = await (
        db.table("medicines")
        .select("id,name,generic_name,image_url")
        .or_(match)
        .order("name")
        .limit(MAX_MATCHES)
        .execute()
    )
    today = today or date.today()
    cards = await _cards(db, res.data, pharmacy_id=pharmacy_id, currency=currency, today=today)
    # stable sort: in stock first, the customer's pharmacy first, then the shop's name order
    cards.sort(key=lambda c: (not c.in_stock, c.pharmacy_id != pharmacy_id))
    cards = cards[:limit]
    for card in cards:
        if not card.in_stock and card.generic_name:
            card.alternatives = (
                await find_alternatives(
                    db,
                    card.generic_name,
                    exclude_ids=[c.medicine_id for c in cards],
                    pharmacy_id=pharmacy_id,
                    currency=currency,
                    today=today,
                )
                or None
            )
    return cards


# Fixed product texts (no LLM: prices and stock come straight from the cards, nothing invented).
PRODUCT_TEXTS: dict[AgentLanguage, dict[str, str]] = {
    "en": {
        "header": "In our shop:",
        "in_stock": "- {name}: in stock, {price} at {pharmacy}.",
        "out_of_stock": "- {name}: out of stock right now.",
        "alternatives": " Same medicine available: {names}.",
        "not_found": "I could not find this medicine in our shop right now.",
        "no_name": "Which medicine are you looking for? Please write its name.",
    },
    "roman_urdu": {
        "header": "Hamari shop mein:",
        "in_stock": "- {name}: stock mein hai, {price} ({pharmacy}).",
        "out_of_stock": "- {name}: abhi stock mein nahi.",
        "alternatives": " Yahi dawa yahan maujood hai: {names}.",
        "not_found": "Ye dawa abhi hamari shop mein nahi mili.",
        "no_name": "Aap kaun si dawa dhoond rahe hain? Us ka naam likhein.",
    },
    "urdu": {
        "header": "ہماری شاپ میں:",
        "in_stock": "- {name}: دستیاب ہے، {price} ({pharmacy})۔",
        "out_of_stock": "- {name}: ابھی دستیاب نہیں۔",
        "alternatives": " یہی دوا یہاں موجود ہے: {names}۔",
        "not_found": "یہ دوا ابھی ہماری شاپ میں نہیں ملی۔",
        "no_name": "آپ کون سی دوا ڈھونڈ رہے ہیں؟ اس کا نام لکھیں۔",
    },
}
CURRENCY_SYMBOLS = {"USD": "$"}  # same "$" as the shop pages (Client utils.formatPrice)


def format_price(amount: float | None, currency: str) -> str:
    """45 USD -> "$45.00"; other codes -> "PKR 45.00"."""
    symbol = CURRENCY_SYMBOLS.get(currency, f"{currency} ")
    return f"{symbol}{amount or 0:.2f}"


def product_text(products: list[ProductCard], language: AgentLanguage, *, asked: bool) -> str:
    """Short text over the product cards, one line per card. `asked` = the message named a drug
    (no cards + no name -> ask for the name instead of "not found")."""
    t = PRODUCT_TEXTS[language]
    if not products:
        return t["not_found"] if asked else t["no_name"]
    lines = [t["header"]]
    for p in products:
        if p.in_stock:
            price = format_price(p.price, p.currency)
            lines.append(t["in_stock"].format(name=p.name, price=price, pharmacy=p.pharmacy_name))
            continue
        line = t["out_of_stock"].format(name=p.name)
        if p.alternatives:
            line += t["alternatives"].format(names=", ".join(a.name for a in p.alternatives))
        lines.append(line)
    return "\n".join(lines)


def shop_names(catalog: DrugCatalog, drug_names: Iterable[str]) -> list[str]:
    """What to search in the shop for the asked drugs: the US name plus its brands and local
    generics (acetaminophen -> acetaminophen, panadol, paracetamol)."""
    out: list[str] = []
    for us in drug_names:
        out += [n for n in [us, *catalog.local_names(us)] if n not in out]
    return out


async def tools(state: AgentState, *, db: AsyncClient, catalog: DrugCatalog, currency: str) -> dict:
    """Partial update: product_results (ProductCard list), timings["tools"]. No LLM call."""
    start = time.perf_counter()
    names = shop_names(catalog, state.get("drug_names") or [])
    products = await search_products(
        db, names, pharmacy_id=state.get("pharmacy_id"), currency=currency
    )
    ms = round((time.perf_counter() - start) * 1000)
    return {"product_results": products, "timings": add_timing(state, "tools", ms)}


def make_tools(
    db: AsyncClient, cache: CatalogCache, currency: str
) -> Callable[[AgentState], Awaitable[dict]]:
    """The LangGraph node with the app's DB, the cached drug catalog and SHOP_CURRENCY."""

    async def tools_node(state: AgentState) -> dict:
        """Tools node (see module docstring)."""
        return await tools(state, db=db, catalog=await cache.get(db), currency=currency)

    return tools_node
