"""CLI entry point for ingestion: download labels, chunk, embed and load.

Run with: python -m app.ingest.run <command>
  drug-list   build data/drugs.txt from the shop's medicines table (read-only)
  download    one FDA label per drug -> data/raw/, data/missing.txt
              [--force] [--limit N] [--no-key]
  chunk       data/raw/*.json -> data/chunks/chunks.jsonl, data/chunk_report.md
"""

import argparse
import asyncio

from app.config import get_settings
from app.db.client import create_db


async def _drug_list() -> None:
    from app.ingest.make_drug_list import DATA_DIR, run

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


COMMANDS = {
    "drug-list": lambda _args: _drug_list(),
    "download": _download,
    "chunk": _chunk,
}


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.ingest.run")
    parser.add_argument("command", choices=sorted(COMMANDS))
    parser.add_argument("--force", action="store_true", help="download: fetch again even if saved")
    parser.add_argument("--limit", type=int, help="download: only the first N drugs")
    parser.add_argument(
        "--no-key", action="store_true", help="download: ignore OPENFDA_API_KEY (e.g. a bad key)"
    )
    args = parser.parse_args()
    asyncio.run(COMMANDS[args.command](args))


if __name__ == "__main__":
    main()
