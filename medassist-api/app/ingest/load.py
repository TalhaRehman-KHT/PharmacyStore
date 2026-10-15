"""Embed chunked label text and insert it into the Supabase vector tables.

Input: data/chunks/chunks.jsonl (R15). For every document (one FDA label):
  1. upsert drug_documents by label_id (unique) -> its id
  2. delete all its drug_chunks, then insert the new ones
     (a re-chunked document never keeps stale rows; a re-run gives the same rows)
  3. delete other drug_documents of the same generic name (a replaced label, e.g. cetirizine eye
     drops -> tablets; their chunks go by ON DELETE CASCADE), so a drug never has two labels
Only chunks whose embedding has exactly `dim` values are inserted. When the daily Gemini quota
runs out, only documents whose chunks are ALL embedded (cache) are written; the rest wait for the
next run. A dry run embeds (and so fills the cache) but writes nothing to the database.
Every chunk row stores metadata.embedding_model; a real run first checks that the database holds
no vectors of another model (app.rag.model_guard) and stops before spending any quota if it does.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from app.paths import DATA_DIR
from app.rag.embed import DailyQuotaExceeded, Embedder
from app.rag.model_guard import MODEL_KEY, check_models, db_models
from app.repositories.knowledge import delete_other_labels, replace_chunks, upsert_document

CHUNKS_FILE = DATA_DIR / "chunks" / "chunks.jsonl"
DOC_COLUMNS = ("label_id", "generic_name", "brand_names", "source_url", "effective_date")


@dataclass
class LoadReport:
    documents: int = 0
    chunks_in_file: int = 0
    embedded: int = 0
    cache_hits: int = 0
    api_calls: int = 0
    inserted: int = 0
    skipped_bad_dim: int = 0
    documents_loaded: int = 0
    documents_waiting: int = 0  # not fully embedded yet (daily quota): loaded on a later run
    chunks_waiting: int = 0  # chunks of those waiting documents
    replaced: list[str] = field(default_factory=list)  # old label_ids deleted (step 3)
    quota_reset_s: float | None = None  # set when the run stopped on the daily quota
    quota_stop: bool = False
    dry_run: bool = False


def read_chunks(path: Path = CHUNKS_FILE, limit: int | None = None) -> dict[str, list[dict]]:
    """Chunk rows grouped by label_id, in file order. `limit` keeps only the first N documents."""
    docs: dict[str, list[dict]] = {}
    for line in path.read_text("utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if row["label_id"] not in docs and limit is not None and len(docs) >= limit:
            continue
        docs.setdefault(row["label_id"], []).append(row)
    return docs


def select_drugs(
    docs: dict[str, list[dict]], names: list[str]
) -> tuple[dict[str, list[dict]], list[str]]:
    """Only the documents of these generic names (case-insensitive), in file order.
    Also returns the names that have no document in the file."""
    wanted = {n.strip().lower() for n in names if n.strip()}
    picked = {
        label: chunks for label, chunks in docs.items() if chunks[0]["drug_name"].lower() in wanted
    }
    found = {chunks[0]["drug_name"].lower() for chunks in picked.values()}
    return picked, sorted(wanted - found)


async def load(db, embedder: Embedder, docs: dict[str, list[dict]], *, dry_run: bool = False):
    """Embed every chunk, then write documents + chunks (unless dry_run). Returns a LoadReport.
    Raises EmbeddingModelMismatch (before any API call) if the DB holds another model."""
    report = LoadReport(
        documents=len(docs), chunks_in_file=sum(map(len, docs.values())), dry_run=dry_run
    )
    if not dry_run:
        check_models(await db_models(db), embedder.model)
    # Embed everything first: full batches of 100 across documents = fewest API calls.
    rows = [row for chunks in docs.values() for row in chunks]
    texts = [row["content"] for row in rows]
    try:
        vectors: list[list[float] | None] = list(await embedder.embed_documents(texts))
    except DailyQuotaExceeded as exc:
        # Keep what is already done (it is in the cache); unfinished chunks stay None.
        report.quota_stop, report.quota_reset_s = True, exc.retry_after_s
        vectors = [embedder.cached(t) for t in texts]
    for row, vector in zip(rows, vectors, strict=True):
        row["embedding"] = vector
    done = [v for v in vectors if v is not None]
    report.embedded = sum(len(v) == embedder.dim for v in done)
    report.skipped_bad_dim = len(done) - report.embedded
    report.cache_hits, report.api_calls = embedder.cache_hits, embedder.api_calls

    # A document is written only when every chunk has a vector: never half a label in the DB.
    ready = [c for c in docs.values() if all(r["embedding"] is not None for r in c)]
    report.documents_waiting = len(docs) - len(ready)
    report.chunks_waiting = report.chunks_in_file - sum(map(len, ready))
    if dry_run:
        return report
    for chunks in ready:
        doc = {k: chunks[0]["document"].get(k) for k in DOC_COLUMNS}
        doc_id = await upsert_document(db, doc)
        good = [
            {
                "document_id": doc_id,
                "chunk_index": c["chunk_index"],
                "section": c["section"],
                "drug_name": c["drug_name"],
                "content": c["content"],
                "embedding": c["embedding"],
                "metadata": {**c.get("metadata", {}), MODEL_KEY: embedder.model},
            }
            for c in chunks
            if len(c["embedding"]) == embedder.dim
        ]
        await replace_chunks(db, doc_id, good)
        report.replaced += await delete_other_labels(db, doc["generic_name"], doc["label_id"])
        report.inserted += len(good)
        report.documents_loaded += 1
    return report
