"""CLI entry point for ingestion: download labels, chunk, embed and load.

Run with: python -m app.ingest.run <command>
  drug-list   build data/drugs.txt from the shop's medicines table (read-only)
  download    one FDA label per drug -> data/raw/, data/missing.txt
              [--force] [--limit N] [--no-key]
  chunk       data/raw/*.json -> data/chunks/chunks.jsonl, data/chunk_report.md
  embed-load  chunks.jsonl -> Gemini vectors -> drug_documents + drug_chunks
              [--limit N documents] [--dry-run] [--delay S]
"""

import argparse
import asyncio

from app.config import get_settings
from app.db.client import create_db


async def _drug_list() -> None:
    from app.ingest.make_drug_list import run
    from app.paths import DATA_DIR

    db = await create_db(get_settings())
    r = await run(db)
    print(
        f"medicines: {r.total} | with generic: {r.with_generic} | derived: {len(r.derived)} | "
        f"could not derive: {len(r.not_derived)} | unique drugs: {len(r.drugs)} | "
        f"proposed synonyms: {len(r.synonyms)}"
    )
    print(f"wrote {DATA_DIR / 'drugs.txt'}, synonyms_proposed.csv, drug_report.md")


async def _download(args: argparse.Namespace) -> None:
    from app.ingest.openfda import run

    key = None if args.no_key else get_settings().openfda_api_key
    print(f"OPENFDA_API_KEY: {'set' if key else 'not used (1000 requests/day limit)'}")
    r = await run(
        api_key=key.get_secret_value() if key else None, force=args.force, limit=args.limit
    )
    print(
        f"downloaded: {len(r.downloaded)} | skipped: {len(r.skipped)} | missing: {len(r.missing)}"
    )
    print("wrote data/raw/*.json and data/missing.txt")


async def _chunk(_args: argparse.Namespace) -> None:
    from app.ingest.chunker import run

    r = run()
    print(
        f"documents: {r['documents']} | chunks: {r['chunks']} | "
        f"chars min {r['min_chars']} / max {r['max_chars']}"
    )
    print("wrote data/chunks/chunks.jsonl and data/chunk_report.md")


async def _embed_load(args: argparse.Namespace) -> None:
    import httpx

    from app.ingest.load import CHUNKS_FILE, load, read_chunks
    from app.rag.embed import embedder_from_settings

    settings = get_settings()
    docs = read_chunks(CHUNKS_FILE, args.limit)
    db = None if args.dry_run else await create_db(settings)
    async with httpx.AsyncClient(timeout=60) as client:
        embedder = embedder_from_settings(client, settings, delay=args.delay)
        r = await load(db, embedder, docs, dry_run=args.dry_run)
    print(
        f"model: {settings.gemini_embed_model} ({settings.embed_dim} dims) | "
        f"{'DRY RUN, nothing written' if r.dry_run else 'written to the database'}"
    )
    print(
        f"documents: {r.documents} | chunks in file: {r.chunks_in_file} | embedded: {r.embedded} | "
        f"cache hits: {r.cache_hits} | API calls: {r.api_calls} | inserted: {r.inserted} | "
        f"skipped (wrong size): {r.skipped_bad_dim}"
    )
    print(
        f"documents loaded: {r.documents_loaded} | waiting (not fully embedded): "
        f"{r.documents_waiting}"
    )
    if r.quota_stop:
        hours = f"~{r.quota_reset_s / 3600:.1f} h" if r.quota_reset_s else "tomorrow"
        print(
            f"STOPPED: Gemini free-tier daily quota used up (resets in {hours}). "
            "Run the same command again after the reset; the cache keeps all progress."
        )
    if db is not None:
        all_rows = await db.table("drug_chunks").select("id", count="exact", head=True).execute()
        with_vec = (
            await db.table("drug_chunks")
            .select("id", count="exact", head=True)
            .not_.is_("embedding", "null")
            .execute()
        )
        docs_db = await db.table("drug_documents").select("id", count="exact", head=True).execute()
        print(
            f"DB now: drug_documents {docs_db.count} | drug_chunks {all_rows.count} | "
            f"with embedding {with_vec.count}"
        )


COMMANDS = {
    "drug-list": lambda _args: _drug_list(),
    "download": _download,
    "chunk": _chunk,
    "embed-load": _embed_load,
}


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.ingest.run")
    parser.add_argument("command", choices=sorted(COMMANDS))
    parser.add_argument("--force", action="store_true", help="download: fetch again even if saved")
    parser.add_argument(
        "--limit", type=int, help="download: first N drugs; embed-load: first N documents"
    )
    parser.add_argument(
        "--no-key", action="store_true", help="download: ignore OPENFDA_API_KEY (e.g. a bad key)"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="embed-load: embed only, write nothing to the DB"
    )
    parser.add_argument(
        "--delay", type=float, default=1.0, help="embed-load: seconds between embed batches"
    )
    args = parser.parse_args()
    asyncio.run(COMMANDS[args.command](args))


if __name__ == "__main__":
    main()
