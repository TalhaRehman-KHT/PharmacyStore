"""One embedding model for every chunk and every query.

Vectors from different models (or the same model at another size) live in different spaces, so a
cosine score between them means nothing. Every drug_chunks row stores the model that made its
vector in metadata.embedding_model; the loader and the search refuse to run when the database
holds another model than the one in settings (GEMINI_EMBED_MODEL).

A row without embedding_model was loaded before F5 (legacy). It is allowed until the loader
rewrites it, because all those rows were made with gemini-embedding-001.
"""

from collections import Counter

from app.repositories.knowledge import chunk_inventory

MODEL_KEY = "embedding_model"  # key inside drug_chunks.metadata

_checked: set[str] = set()  # models already verified against the DB in this process


class EmbeddingModelMismatch(RuntimeError):
    """The database holds vectors from another embedding model than settings."""


def check_models(models: Counter, expected: str) -> None:
    """Raise EmbeddingModelMismatch when any tagged row was made by another model than expected."""
    other = {m: n for m, n in models.items() if m is not None and m != expected}
    if other:
        found = ", ".join(f"{m} ({n} chunks)" for m, n in sorted(other.items()))
        raise EmbeddingModelMismatch(
            f"drug_chunks has vectors from {found}, but settings use {expected!r}. "
            "Vectors of different models cannot be compared. Set GEMINI_EMBED_MODEL back, "
            "or delete all drug_chunks and re-embed everything with the new model."
        )


async def db_models(db) -> Counter:
    """Number of drug_chunks rows per embedding model (None = legacy row without a tag)."""
    return Counter((r.get("metadata") or {}).get(MODEL_KEY) for r in await chunk_inventory(db))


async def ensure_db_model(db, expected: str) -> None:
    """check_models against the live table, once per process for each model (search path)."""
    if expected in _checked:
        return
    check_models(await db_models(db), expected)
    _checked.add(expected)
