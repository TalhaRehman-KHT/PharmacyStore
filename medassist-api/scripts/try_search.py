"""Manual check of hybrid search from the command line.

Run with: python -m scripts.try_search "panadol side effects" [--drug acetaminophen] [--vector-only]

Embeds the question (1 Gemini call), calls the hybrid_search RPC and prints one line per chunk:
rank, rrf score, vector rank, keyword rank, drug, section and the first 120 characters.
--vector-only sends an empty query_text, so the keyword list finds nothing.
"""

import argparse
import asyncio

import httpx

from app.config import get_settings
from app.db.client import create_db
from app.rag.embed import embedder_from_settings
from app.rag.model_guard import ensure_db_model
from app.rag.search import DEFAULT_MATCH_COUNT, hybrid_search


def _rank(value: int | None) -> str:
    return "-" if value is None else str(value)


async def main(args: argparse.Namespace) -> None:
    settings = get_settings()
    db = await create_db(settings)
    async with httpx.AsyncClient(timeout=60) as client:
        embedder = embedder_from_settings(client, settings, cache_dir=None)
        vector = await embedder.embed_query(args.question)
    await ensure_db_model(db, embedder.model)  # never compare vectors of two models
    hits = await hybrid_search(
        db,
        vector,
        "" if args.vector_only else args.question,
        match_count=args.limit,
        drug_filter=args.drug.lower() if args.drug else None,
    )
    mode = "vector only" if args.vector_only else "hybrid"
    print(f"{args.question!r} | {mode} | drug: {args.drug or 'all'} | {len(hits)} chunks")
    print(f"{'#':>2} {'rrf':>7} {'vec':>4} {'kw':>4}  drug / section / text")
    for i, h in enumerate(hits, 1):
        text = " ".join(h.content.split())[:120]
        print(
            f"{i:>2} {h.rrf_score:.5f} {_rank(h.vector_rank):>4} {_rank(h.keyword_rank):>4}  "
            f"{h.drug_name} / {h.section} / {text}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Try the hybrid_search RPC.")
    parser.add_argument("question")
    parser.add_argument("--drug", help="only this drug (generic name, e.g. ibuprofen)")
    parser.add_argument("--vector-only", action="store_true", help="empty query_text")
    parser.add_argument("--limit", type=int, default=DEFAULT_MATCH_COUNT, help="match_count")
    asyncio.run(main(parser.parse_args()))
