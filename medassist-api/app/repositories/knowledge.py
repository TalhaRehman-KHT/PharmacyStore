"""Knowledge base tables: drug_documents (one FDA label each) and drug_chunks (with vectors)."""

from dataclasses import dataclass

INSERT_BATCH = 100  # rows per insert request (each row carries a 768-float vector)


async def upsert_document(db, doc: dict) -> str:
    """Insert or update a drug_documents row by label_id (unique). Returns its id."""
    res = await db.table("drug_documents").upsert(doc, on_conflict="label_id").execute()
    return res.data[0]["id"]


async def replace_chunks(db, document_id: str, rows: list[dict]) -> None:
    """Delete all chunks of a document, then insert `rows` in batches (no stale rows stay)."""
    await db.table("drug_chunks").delete().eq("document_id", document_id).execute()
    for start in range(0, len(rows), INSERT_BATCH):
        await db.table("drug_chunks").insert(rows[start : start + INSERT_BATCH]).execute()


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
