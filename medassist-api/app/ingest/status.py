"""embed-status: how much of chunks.jsonl is in the database, and with which embedding model.

Read-only: two cheap count queries, the document list and the chunk metadata (no vectors).
"""

from collections import Counter
from dataclasses import dataclass, field

from app.rag.model_guard import db_models
from app.repositories.knowledge import kb_counts, list_documents


@dataclass
class EmbedStatus:
    documents_file: int
    chunks_file: int
    documents_db: int
    chunks_db: int
    with_embedding: int
    models: Counter  # drug_chunks rows per metadata.embedding_model (None = legacy, no tag)
    loaded: list[str] = field(default_factory=list)  # generic names in the DB
    waiting: list[str] = field(default_factory=list)  # in the file, not in the DB yet
    chunks_waiting: int = 0


async def embed_status(db, docs: dict[str, list[dict]]) -> EmbedStatus:
    """Compare the chunk file (label_id -> chunks) with drug_documents / drug_chunks."""
    counts = await kb_counts(db)
    in_db = {d["label_id"] for d in await list_documents(db)}
    names = {label: chunks[0]["drug_name"] for label, chunks in docs.items()}
    waiting = [label for label in docs if label not in in_db]
    return EmbedStatus(
        documents_file=len(docs),
        chunks_file=sum(map(len, docs.values())),
        documents_db=counts.documents,
        chunks_db=counts.chunks,
        with_embedding=counts.with_embedding,
        models=await db_models(db),
        loaded=sorted(names[label] for label in docs if label in in_db),
        waiting=sorted(names[label] for label in waiting),
        chunks_waiting=sum(len(docs[label]) for label in waiting),
    )


def render(s: EmbedStatus, expected_model: str) -> str:
    """Plain text for the terminal."""
    models = ", ".join(
        f"{m or 'untagged (pre-F5)'}: {n}" for m, n in sorted(s.models.items(), key=str)
    )
    lines = [
        f"documents: {s.documents_db} in DB / {s.documents_file} in file | "
        f"remaining: {len(s.waiting)}",
        f"chunks: {s.chunks_db} in DB ({s.with_embedding} with embedding) / {s.chunks_file} in file"
        f" | remaining: {s.chunks_waiting}",
        f"per model: {models or 'none'} | settings model: {expected_model}",
        f"loaded ({len(s.loaded)}): {', '.join(s.loaded) or '-'}",
        f"not loaded ({len(s.waiting)}): {', '.join(s.waiting) or '-'}",
    ]
    other = [m for m in s.models if m is not None and m != expected_model]
    if other:
        lines.append(f"WARNING: other models in the DB: {', '.join(other)} (search will refuse)")
    return "\n".join(lines)
