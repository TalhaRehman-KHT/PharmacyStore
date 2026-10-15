"""Golden retrieval gate against the REAL database: search quality must not silently drop.

For every question in tests/golden/questions.csv whose drug is loaded (has embedded chunks),
a hit = a chunk of the expected drug AND section in the top 5, searched exactly as the app
searches (rag/deps.py: RETRIEVAL_MODE / RERANK_ENABLED). Recall@5 must stay at or above
GOLDEN_RECALL_MIN (environment variable, default 0.8).

Run: RUN_INTEGRATION=1 pytest -m integration -q   (one Gemini embed call per loaded question)
"""

import csv
import os
from pathlib import Path

import httpx
import pytest

from app.rag.deps import retrieval_mode
from app.rag.embed import Embedder
from app.rag.rerank import Reranker
from app.rag.retrieve import retrieve
from app.repositories.knowledge import chunk_inventory, list_documents

pytestmark = pytest.mark.integration

QUESTIONS_FILE = Path(__file__).resolve().parents[1] / "golden" / "questions.csv"
K = 5


def read_questions() -> list[dict]:
    with QUESTIONS_FILE.open(encoding="utf-8", newline="") as f:
        return [{k: v.strip() for k, v in row.items()} for row in csv.DictReader(f)]


async def embedded_drugs(db) -> set[str]:
    """Generic names of the drugs that have at least one chunk with an embedding."""
    embedded_docs = {row["document_id"] for row in await chunk_inventory(db, embedded_only=True)}
    return {d["generic_name"].lower() for d in await list_documents(db) if d["id"] in embedded_docs}


async def test_golden_recall_at_5_stays_above_the_threshold(live_db, real_settings):
    threshold = float(os.environ.get("GOLDEN_RECALL_MIN", "0.8"))
    loaded = await embedded_drugs(live_db)
    questions = [q for q in read_questions() if q["expected_drug"].lower() in loaded]
    if not questions:
        pytest.skip("no golden question has its drug loaded yet")

    mode = retrieval_mode(real_settings)
    reranker = Reranker(model_name=real_settings.rerank_model) if mode == "hybrid_rerank" else None
    misses = []
    async with httpx.AsyncClient(timeout=60) as client:
        embedder = Embedder(
            client,
            real_settings.gemini_api_key.get_secret_value(),
            real_settings.gemini_embed_model,
            real_settings.embed_dim,
            cache_dir=None,
        )
        for q in questions:
            vector = await embedder.embed_query(q["question"])
            hits = await retrieve(
                live_db,
                reranker,
                q["question"],
                vector,
                mode=mode,
                top_k=K,
                embed_model=embedder.model,
            )
            if not any(
                h.drug_name.lower() == q["expected_drug"].lower()
                and h.section == q["expected_section"]
                for h in hits[:K]
            ):
                misses.append(q["question"])

    recall = 1 - len(misses) / len(questions)
    assert recall >= threshold, (
        f"Recall@{K} {recall:.2f} < {threshold} on {len(questions)} questions; misses: {misses}"
    )
