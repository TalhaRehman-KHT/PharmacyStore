"""graph/drugs.py (catalog, cache) and graph/nodes/rewrite.py with a fake fast LLM."""

import pytest

from app.graph.drugs import CatalogCache, DrugCatalog, load_catalog
from app.graph.nodes.rewrite import make_rewrite, plain_query, rewrite
from tests.fakes.llm import FakeFastLLM
from tests.fakes.supabase import FakeSupabase

SYNONYMS = [  # rows as in sql/005_seed_synonyms.sql
    ("Panadol", "paracetamol", "acetaminophen"),
    ("Brufen", "ibuprofen", "ibuprofen"),
    ("Augmentin", "amoxicillin + clavulanate", "amoxicillin and clavulanate potassium"),
    ("Glucophage", "metformin", "metformin hydrochloride"),
    ("Ventolin", "salbutamol", "albuterol"),
]
LOADED = [
    "acetaminophen",
    "albuterol",
    "amoxicillin",
    "bisoprolol fumarate",
    "clavulanate",
    "ibuprofen",
    "metformin",
]


def seeded_db() -> FakeSupabase:
    db = FakeSupabase()
    for brand, generic, us in SYNONYMS:
        db.seed("drug_synonyms", brand_name=brand, generic_name=generic, us_name=us)
    for i, name in enumerate(LOADED):
        db.seed("drug_documents", label_id=f"label-{i}", generic_name=name)
    return db


@pytest.fixture
async def catalog() -> DrugCatalog:
    return await load_catalog(seeded_db())


# ---------- catalog ----------


async def test_catalog_maps_brands_and_salts_to_loaded_drugs(catalog):
    assert catalog.to_loaded("Panadol") == ["acetaminophen"]
    assert catalog.to_loaded("paracetamol") == ["acetaminophen"]
    assert catalog.to_loaded("Glucophage") == ["metformin"]  # metformin hydrochloride
    assert catalog.to_loaded("bisoprolol") == ["bisoprolol fumarate"]
    assert catalog.to_loaded("Augmentin") == ["amoxicillin", "clavulanate"]
    assert catalog.to_loaded("warfarin") == []  # not loaded
    assert catalog.to_loaded("amoxicillin and clavulanate potassium") == [
        "amoxicillin",
        "clavulanate",
    ]


async def test_mentioned_finds_whole_words_in_order(catalog):
    assert catalog.mentioned("Brufen aur Panadol ek saath le sakte hain?") == [
        "ibuprofen",
        "acetaminophen",
    ]
    assert catalog.mentioned("PANADOL-extra?") == ["acetaminophen"]
    assert catalog.mentioned("brufenx and panadols") == []  # no partial words
    assert catalog.mentioned("weather today") == []


async def test_unique_drops_repeats(catalog):
    assert catalog.unique(["metformin hydrochloride", "metformin", "Glucophage"]) == [
        "metformin hydrochloride"
    ]
    assert catalog.unique(["Augmentin", "amoxicillin", "clavulanate"]) == [
        "amoxicillin and clavulanate potassium"
    ]
    assert catalog.unique(["Brufen", "Panadol"]) == ["ibuprofen", "acetaminophen"]


async def test_catalog_cache_loads_once_within_ttl():
    db = seeded_db()
    cache = CatalogCache(ttl_s=60)
    first = await cache.get(db)
    before = db.queries
    assert await cache.get(db) is first
    assert db.queries == before  # no new request
    expired = CatalogCache(ttl_s=-1)
    await expired.get(db)
    await expired.get(db)
    assert db.queries == before + 4  # 2 requests per load


# ---------- rewrite node ----------


def llm_reply(query: str, drugs: list[str]) -> str:
    names = ", ".join(f'"{d}"' for d in drugs)
    return f'{{"query": "{query}", "drugs": [{names}]}}'


async def test_roman_urdu_brand_question(catalog):
    llm = FakeFastLLM(llm_reply("acetaminophen side effects", ["acetaminophen"]))
    state = {"question": "Panadol ke side effects", "language": "roman_urdu"}
    update = await rewrite(state, llm=llm, catalog=catalog)
    assert update["rewritten_query"] == "acetaminophen side effects"
    assert update["drug_names"] == ["acetaminophen"]
    assert update["drug_filter"] == "acetaminophen"
    assert update["rewrite_count"] == 1
    assert update["tokens"] == 120
    assert "Generic names of drugs in the message: acetaminophen" in llm.prompt()


async def test_two_drugs_give_no_filter(catalog):
    llm = FakeFastLLM(
        llm_reply("ibuprofen and acetaminophen together interactions", ["Brufen", "Panadol"])
    )
    state = {"question": "Brufen aur Panadol ek saath le sakte hain?", "language": "roman_urdu"}
    update = await rewrite(state, llm=llm, catalog=catalog)
    assert update["drug_names"] == ["ibuprofen", "acetaminophen"]
    assert update["drug_filter"] is None  # two drugs: search both


async def test_plain_english_question_needs_no_llm(catalog):
    llm = FakeFastLLM("never used")
    state = {"question": "Is Augmentin in stock?", "language": "en"}
    update = await rewrite(state, llm=llm, catalog=catalog)
    assert llm.calls == []
    assert update["rewritten_query"] == (
        "Is Augmentin in stock? (amoxicillin and clavulanate potassium)"
    )
    assert update["drug_names"] == ["amoxicillin and clavulanate potassium"]
    assert update["drug_filter"] is None  # a combination is two loaded labels
    assert update["tokens"] == 0


async def test_out_of_scope_text_has_no_drugs(catalog):
    update = await rewrite(
        {"question": "weather today", "language": "en"}, llm=FakeFastLLM("x"), catalog=catalog
    )
    assert update["rewritten_query"] == "weather today"
    assert update["drug_names"] == [] and update["drug_filter"] is None


async def test_follow_up_with_history_is_resolved_by_the_llm(catalog):
    llm = FakeFastLLM(llm_reply("metformin use in elderly patients", ["metformin"]))
    state = {
        "question": "Is it safe for elderly people?",
        "language": "en",
        "history": [("user", "What is Glucophage for?"), ("assistant", "Type 2 diabetes.")],
    }
    update = await rewrite(state, llm=llm, catalog=catalog)
    assert "user: What is Glucophage for?" in llm.prompt()
    assert update["drug_names"] == ["metformin hydrochloride"]  # US name from drug_synonyms
    assert update["drug_filter"] == "metformin"  # the loaded label's name


async def test_unknown_drug_is_kept_but_not_filtered(catalog):
    llm = FakeFastLLM(llm_reply("warfarin bleeding risk", ["warfarin"]))
    state = {"question": "warfarin se khoon aata hai?", "language": "roman_urdu"}
    update = await rewrite(state, llm=llm, catalog=catalog)
    assert update["drug_names"] == ["warfarin"]
    assert update["drug_filter"] is None  # not loaded: a filter would find nothing


async def test_unparseable_llm_reply_keeps_the_question(catalog):
    state = {"question": "Panadol ke side effects", "language": "roman_urdu"}
    update = await rewrite(state, llm=FakeFastLLM("I cannot help"), catalog=catalog)
    assert update["rewritten_query"] == "Panadol ke side effects (acetaminophen)"
    assert update["drug_filter"] == "acetaminophen"
    assert update["tokens"] == 120  # the failed call still cost tokens


async def test_retry_broadens_and_drops_the_filter(catalog):
    llm = FakeFastLLM(llm_reply("acetaminophen adverse reactions warnings", ["acetaminophen"]))
    state = {
        "question": "What are the side effects of Panadol?",
        "language": "en",
        "rewritten_query": "acetaminophen side effects",
        "rewrite_count": 1,
    }
    update = await rewrite(state, llm=llm, catalog=catalog)
    assert len(llm.calls) == 1  # English, but a retry: the LLM is asked
    assert 'The search query "acetaminophen side effects" found nothing relevant' in llm.prompt()
    assert update["drug_filter"] is None
    assert update["rewrite_count"] == 2


async def test_make_rewrite_node_uses_the_cache():
    db = seeded_db()
    node = make_rewrite(lambda: FakeFastLLM("x"), db, CatalogCache())
    update = await node({"question": "What is Ventolin used for?", "language": "en"})
    assert update["drug_filter"] == "albuterol"
    before = db.queries
    await node({"question": "What is Ventolin used for?", "language": "en"})
    assert db.queries == before


def test_plain_query_adds_only_missing_names():
    assert plain_query("ibuprofen  dose?", ["ibuprofen"]) == "ibuprofen dose?"
    assert plain_query("Brufen?", ["ibuprofen"]) == "Brufen? (ibuprofen)"
