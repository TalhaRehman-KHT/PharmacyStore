"""Knowledge base tables: drug_documents (one FDA label each) and drug_chunks (with vectors)."""

from dataclasses import dataclass

INSERT_BATCH = 100  # rows per insert request (each row carries a 768-float vector)
PAGE = 1000  # PostgREST returns at most 1000 rows per request


async def upsert_document(db, doc: dict) -> str:
    """Insert or update a drug_documents row by label_id (unique). Returns its id."""
    res = await db.table("drug_documents").upsert(doc, on_conflict="label_id").execute()
    return res.data[0]["id"]


async def replace_chunks(db, document_id: str, rows: list[dict]) -> None:
    """Delete all chunks of a document, then insert `rows` in batches (no stale rows stay)."""
    await db.table("drug_chunks").delete().eq("document_id", document_id).execute()
    for start in range(0, len(rows), INSERT_BATCH):
        await db.table("drug_chunks").insert(rows[start : start + INSERT_BATCH]).execute()


async def list_documents(db) -> list[dict]:
    """All drug_documents rows: id, label_id, generic_name (64 at most, one request)."""
    res = await db.table("drug_documents").select("id, label_id, generic_name").execute()
    return res.data or []


async def source_urls(db, drug_names: list[str]) -> dict[str, str]:
    """{generic_name: source_url} for these drugs, in one request (no URL = left out)."""
    if not drug_names:
        return {}
    res = await (
        db.table("drug_documents")
        .select("generic_name, source_url")
        .in_("generic_name", sorted(set(drug_names)))
        .execute()
    )
    return {r["generic_name"]: r["source_url"] for r in res.data or [] if r.get("source_url")}


async def chunk_inventory(db) -> list[dict]:
    """document_id + metadata of every drug_chunks row (no vectors), fetched page by page."""
    rows: list[dict] = []
    while True:
        res = await (
            db.table("drug_chunks")
            .select("document_id, metadata")
            .order("id")
            .range(len(rows), len(rows) + PAGE - 1)
            .execute()
        )
        page = res.data or []
        rows += page
        if len(page) < PAGE:
            return rows


@dataclass(frozen=True)
class KbCounts:
    documents: int
    chunks: int
    with_embedding: int


async def kb_counts(db) -> KbCounts:
    """Row counts of drug_documents, drug_chunks and chunks that have an embedding."""
    docs = await db.table("drug_documents").select("id", count="exact", head=True).execute()
    chunks = await db.table("drug_chunks").select("id", count="exact", head=True).execute()
    with_vec = (
        await db.table("drug_chunks")
        .select("id", count="exact", head=True)
        .not_.is_("embedding", "null")
        .execute()
    )
    return KbCounts(docs.count, chunks.count, with_vec.count)
