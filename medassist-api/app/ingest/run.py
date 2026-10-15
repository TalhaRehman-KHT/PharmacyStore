"""CLI entry point for ingestion: download labels, chunk, embed and load.

Run with: python -m app.ingest.run <command>
  drug-list   build data/drugs.txt from the shop's medicines table (read-only)
  download    one FDA label per drug (oral preferred) -> data/raw/, data/missing.txt
              [--force] [--limit N] [--no-key] [--drugs a,b,c]
  label-routes  saved labels whose route is not ORAL (read-only, no requests)
  chunk       data/raw/*.json -> data/chunks/chunks.jsonl, data/chunk_report.md
              [--drugs a,b,c = re-chunk only these, keep the other rows as they are]
  embed-load  chunks.jsonl -> Gemini vectors -> drug_documents + drug_chunks
              [--limit N documents] [--drugs a,b,c] [--dry-run] [--delay S]
              [--resume = skip documents already fully embedded with this model; priority order]
  embed-status  documents/chunks in file vs DB, remaining, rows per embedding model (read-only)
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
        api_key=key.get_secret_value() if key else None,
        force=args.force,
        limit=args.limit,
        only=_names(args.drugs),
    )
    print(
        f"downloaded: {len(r.downloaded)} ({', '.join(r.downloaded) or '-'}) | "
        f"skipped: {len(r.skipped)} | missing: {len(r.missing)}"
    )
    print("wrote data/raw/*.json" + ("" if args.drugs else " and data/missing.txt"))
    await _label_routes(args)


async def _label_routes(_args: argparse.Namespace) -> None:
    from app.ingest.openfda import ROUTE, route_report

    rows = route_report()
    print(f"labels whose route is not {ROUTE} ({len(rows)}):")
    for drug, routes in rows:
        print(f"  {drug}: {', '.join(routes) or 'no route'}")


async def _chunk(args: argparse.Namespace) -> None:
    from app.ingest.chunker import run

    r = run(only=_names(args.drugs))
    if args.drugs:
        print(f"re-chunked only: {args.drugs} (other documents unchanged)")
    print(
        f"documents: {r['documents']} | chunks: {r['chunks']} | "
        f"chars min {r['min_chars']} / max {r['max_chars']}"
    )
    print("wrote data/chunks/chunks.jsonl and data/chunk_report.md")


async def _embed_load(args: argparse.Namespace) -> None:
    import httpx

    from app.ingest.load import CHUNKS_FILE, load, read_chunks, select_drugs
    from app.rag.embed import embedder_from_settings
    from app.rag.model_guard import EmbeddingModelMismatch

    settings = get_settings()
    if args.resume:
        await _resume(args, settings)
        return
    if args.drugs:
        docs, unknown = select_drugs(read_chunks(CHUNKS_FILE), args.drugs.split(","))
        if unknown:
            print(f"not in chunks.jsonl (skipped): {', '.join(unknown)}")
        if args.limit is not None:
            docs = dict(list(docs.items())[: args.limit])
        if not docs:
            print("no documents selected, nothing to do")
            return
    else:
        docs = read_chunks(CHUNKS_FILE, args.limit)
    db = None if args.dry_run else await create_db(settings)
    async with httpx.AsyncClient(timeout=60) as client:
        embedder = embedder_from_settings(client, settings, delay=args.delay)
        try:
            r = await load(db, embedder, docs, dry_run=args.dry_run)
        except EmbeddingModelMismatch as exc:
            raise SystemExit(f"STOPPED: {exc}") from None
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
        from app.repositories.knowledge import kb_counts

        c = await kb_counts(db)
        print(
            f"DB now: drug_documents {c.documents} | drug_chunks {c.chunks} | "
            f"with embedding {c.with_embedding}"
        )


async def _resume(args: argparse.Namespace, settings) -> None:
    """embed-load --resume: only unfinished documents, priority order, one summary line."""
    import httpx

    from app.ingest.load import CHUNKS_FILE, load, read_chunks
    from app.ingest.resume import pending
    from app.rag.embed import embedder_from_settings
    from app.rag.model_guard import EmbeddingModelMismatch

    model = settings.gemini_embed_model
    db = await create_db(settings)
    everything = read_chunks(CHUNKS_FILE)
    docs = await pending(db, everything, model)
    if args.limit is not None:
        docs = dict(list(docs.items())[: args.limit])
    if not docs:
        print(f"nothing to do: all {len(everything)} documents are loaded with {model}")
        return
    names = [c[0]["drug_name"] for c in docs.values()]
    print(
        f"to do: {len(docs)} documents, {sum(map(len, docs.values()))} chunks "
        f"(first: {', '.join(names[:8])}{' ...' if len(names) > 8 else ''})"
    )
    async with httpx.AsyncClient(timeout=60) as client:
        embedder = embedder_from_settings(client, settings, delay=args.delay)
        try:
            r = await load(db, embedder, docs)
        except EmbeddingModelMismatch as exc:
            raise SystemExit(f"STOPPED: {exc}") from None
    print(
        f"API calls: {r.api_calls} | cache hits: {r.cache_hits} | inserted chunks: {r.inserted}"
        + (f" | replaced old labels: {len(r.replaced)}" if r.replaced else "")
    )
    if r.quota_stop:
        print(
            f"{r.documents_loaded} done today, {r.chunks_waiting} chunks remaining, "
            "run again tomorrow"
        )
    else:
        print(f"{r.documents_loaded} done, {r.chunks_waiting} chunks remaining")


async def _embed_status(_args: argparse.Namespace) -> None:
    from app.ingest.load import CHUNKS_FILE, read_chunks
    from app.ingest.status import embed_status, render

    settings = get_settings()
    db = await create_db(settings)
    print(render(await embed_status(db, read_chunks(CHUNKS_FILE)), settings.gemini_embed_model))


def _names(drugs: str | None) -> list[str] | None:
    """'a, b' -> ['a', 'b']; None stays None (= all drugs)."""
    return None if drugs is None else [d.strip() for d in drugs.split(",") if d.strip()]


COMMANDS = {
    "drug-list": lambda _args: _drug_list(),
    "download": _download,
    "label-routes": _label_routes,
    "chunk": _chunk,
    "embed-load": _embed_load,
    "embed-status": _embed_status,
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
        "--drugs",
        help="download / chunk / embed-load: only these generic names, comma-separated "
        "(e.g. ibuprofen,metformin)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="embed-load: skip documents already fully embedded with this model; priority order",
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
