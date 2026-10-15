"""embed-load --resume: which documents still need embedding, and in which order.

A document (one FDA label) is DONE when the database holds exactly as many chunks for its
label_id as chunks.jsonl has, and every one of them has an embedding made by the current model
(metadata.embedding_model). Done documents are skipped, so a daily run spends the Gemini free-tier
quota (~1000 texts/day) only on new work. The rest is loaded in PRIORITY order (drugs the shop
sells most / the golden test needs), then alphabetically.
Safe to run every day: vectors are cached on disk (no repeated cost) and the loader replaces a
document's chunks (no duplicate rows).
"""

from collections import Counter

from app.rag.model_guard import MODEL_KEY
from app.repositories.knowledge import chunk_inventory, list_documents

PRIORITY = (
    "ibuprofen",
    "metformin",
    "omeprazole",
    "diclofenac",
    "losartan",
    "cetirizine",
    "azithromycin",
)


def _name(chunks: list[dict]) -> str:
    return chunks[0]["drug_name"].lower()


def prioritize(docs: dict[str, list[dict]]) -> dict[str, list[dict]]:
    """The same documents, PRIORITY drugs first (in that order), then the rest A-Z."""

    def key(label: str) -> tuple[int, str]:
        name = _name(docs[label])
        rank = PRIORITY.index(name) if name in PRIORITY else len(PRIORITY)
        return rank, name

    return {label: docs[label] for label in sorted(docs, key=key)}


async def done_labels(db, docs: dict[str, list[dict]], model: str) -> set[str]:
    """label_ids of the file whose chunks are ALL in the DB with an embedding of `model`."""
    label_of = {d["id"]: d["label_id"] for d in await list_documents(db)}
    tagged = Counter(
        label_of.get(r["document_id"])
        for r in await chunk_inventory(db, embedded_only=True)
        if (r.get("metadata") or {}).get(MODEL_KEY) == model
    )
    return {label for label, chunks in docs.items() if tagged.get(label) == len(chunks)}


async def pending(db, docs: dict[str, list[dict]], model: str) -> dict[str, list[dict]]:
    """Documents that still need work, in priority order."""
    done = await done_labels(db, docs, model)
    return {label: c for label, c in prioritize(docs).items() if label not in done}
