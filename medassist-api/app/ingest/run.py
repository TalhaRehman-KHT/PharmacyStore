"""CLI entry point for ingestion: download labels, chunk, embed and load.

Run with: python -m app.ingest.run <command>
  drug-list   build data/drugs.txt from the shop's medicines table (read-only)
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


COMMANDS = {"drug-list": _drug_list}


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.ingest.run")
    parser.add_argument("command", choices=sorted(COMMANDS))
    args = parser.parse_args()
    asyncio.run(COMMANDS[args.command]())


if __name__ == "__main__":
    main()
