"""Retrieval smoke test: does the right chunk show up in the top 5?

Run from medassist-api/:  python -m eval.retrieval_smoke

For every row of eval/retrieval_smoke.csv it runs two pipelines:
  (a) vector only:        hybrid_search with an empty query_text, first 5 rows
  (b) hybrid + rerank:    hybrid_search (vector + keyword, RRF) top 20 -> FlashRank -> top 5
A hit = a chunk whose drug AND section match the row, inside the top 5.
Recall@5 = share of questions with a hit; MRR = mean of 1/rank of the first hit (0 when missed).

Query vectors are cached in eval/cache/query_vectors.json (git-ignored), so a re-run costs no
Gemini quota unless a question changed. The report goes to eval/results/retrieval_smoke.md.
"""

import asyncio
import csv
import hashlib
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from app.rag.search import DEFAULT_MATCH_COUNT, SearchHit, hybrid_search

EVAL_DIR = Path(__file__).resolve().parent
QUESTIONS_FILE = EVAL_DIR / "retrieval_smoke.csv"
CACHE_FILE = EVAL_DIR / "cache" / "query_vectors.json"
REPORT_FILE = EVAL_DIR / "results" / "retrieval_smoke.md"
K = 5
MODES = ("vector", "hybrid_rerank")
MODE_TITLES = {"vector": "vector only", "hybrid_rerank": "hybrid + rerank"}


@dataclass(frozen=True)
class Question:
    question: str
    language: str
    expected_drug: str
    expected_section: str


@dataclass(frozen=True)
class Outcome:
    """What one pipeline returned for one question. rank is 1..K, or None for a miss."""

    question: Question
    mode: str
    rank: int | None
    top: list[SearchHit]


def read_questions(path: Path = QUESTIONS_FILE) -> list[Question]:
    with path.open(encoding="utf-8", newline="") as f:
        return [
            Question(
                r["question"].strip(),
                r["language"].strip(),
                r["expected_drug"].strip().lower(),
                r["expected_section"].strip(),
            )
            for r in csv.DictReader(f)
        ]


def first_hit_rank(hits: list[SearchHit], q: Question, k: int = K) -> int | None:
    """1-based position of the first chunk with the expected drug and section, within the top k."""
    for i, h in enumerate(hits[:k], 1):
        if h.drug_name.lower() == q.expected_drug and h.section == q.expected_section:
            return i
    return None


def score(outcomes: list[Outcome]) -> tuple[float, float]:
    """(Recall@K, MRR) of a group of outcomes. An empty group scores (0, 0)."""
    if not outcomes:
        return 0.0, 0.0
    recall = sum(o.rank is not None for o in outcomes) / len(outcomes)
    mrr = sum(1 / o.rank for o in outcomes if o.rank) / len(outcomes)
    return recall, mrr


# ---------- query vectors (cached) ----------


def _cache_key(model: str, dim: int, text: str) -> str:
    return hashlib.sha256(f"{model}|{dim}|query|{text}".encode()).hexdigest()


async def query_vectors(
    questions: list[Question],
    embed: Callable[[str], Awaitable[list[float]]],
    model: str,
    dim: int,
    cache_file: Path = CACHE_FILE,
) -> list[list[float]]:
    """One vector per question; only questions missing from the cache cost an API call."""
    cache = json.loads(cache_file.read_text("utf-8")) if cache_file.exists() else {}
    out = []
    for q in questions:
        key = _cache_key(model, dim, q.question)
        if key not in cache:
            cache[key] = await embed(q.question)
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps(cache), encoding="utf-8")  # save as we go
        out.append(cache[key])
    return out


# ---------- the two pipelines ----------


async def run_pipelines(db, reranker, q: Question, vector: list[float]) -> list[Outcome]:
    """(a) vector only and (b) hybrid + rerank for one question."""
    vec_hits = await hybrid_search(db, vector, "", match_count=K)
    hybrid_hits = await hybrid_search(db, vector, q.question, match_count=DEFAULT_MATCH_COUNT)
    reranked = await reranker.rerank(q.question, hybrid_hits, top_n=K)
    return [
        Outcome(q, "vector", first_hit_rank(vec_hits, q), vec_hits[:K]),
        Outcome(q, "hybrid_rerank", first_hit_rank(reranked, q), reranked[:K]),
    ]


# ---------- report ----------


def _snippet(h: SearchHit, n: int = 90) -> str:
    head, _, rest = h.content.partition("\n")
    body = rest if head.startswith("Drug:") and rest else h.content  # drop the header line
    return " ".join(body.split())[:n].replace("|", "/")


def build_report(outcomes: list[Outcome], note: str = "") -> str:
    """Markdown: totals per mode and language, then every miss with its top 3."""
    languages = sorted({o.question.language for o in outcomes})
    n = len({o.question.question for o in outcomes})
    lines = [f"# Retrieval smoke test ({date.today().isoformat()})", ""]
    if note:
        lines += [note, ""]
    lines += [
        f"{n} questions. Hit = expected drug AND section in the top {K}.",
        "",
        "| mode | group | n | Recall@5 | MRR |",
        "| --- | --- | --- | --- | --- |",
    ]
    for mode in MODES:
        mine = [o for o in outcomes if o.mode == mode]
        for group in ["all", *languages]:
            part = mine if group == "all" else [o for o in mine if o.question.language == group]
            recall, mrr = score(part)
            lines.append(
                f"| {MODE_TITLES[mode]} | {group} | {len(part)} | {recall:.2f} | {mrr:.2f} |"
            )

    lines += ["", "## Per question (rank of the first hit, - = miss)", ""]
    lines += ["| # | lang | question | expected | vector | hybrid+rerank |"]
    lines += ["| --- | --- | --- | --- | --- | --- |"]
    by_q: dict[str, dict[str, Outcome]] = {}
    for o in outcomes:
        by_q.setdefault(o.question.question, {})[o.mode] = o
    for i, (text, modes) in enumerate(by_q.items(), 1):
        q = next(iter(modes.values())).question
        ranks = [modes[m].rank if m in modes else None for m in MODES]
        cells = " | ".join("-" if r is None else str(r) for r in ranks)
        lines.append(
            f"| {i} | {q.language} | {text} | {q.expected_drug} / {q.expected_section} | {cells} |"
        )

    lines += ["", "## Misses (top 3 returned)", ""]
    misses = [o for o in outcomes if o.rank is None]
    if not misses:
        lines.append("none")
    for o in misses:
        q = o.question
        lines.append(
            f"- **{MODE_TITLES[o.mode]}** | {q.question} "
            f"(expected {q.expected_drug} / {q.expected_section})"
        )
        for j, h in enumerate(o.top[:3], 1):
            lines.append(f"  {j}. {h.drug_name} / {h.section}: {_snippet(h)}")
        if not o.top:
            lines.append("  (no chunks returned)")
    return "\n".join(lines) + "\n"


# ---------- main ----------


async def main() -> None:
    import httpx

    from app.config import get_settings
    from app.db.client import create_db
    from app.rag.embed import Embedder
    from app.rag.rerank import Reranker

    settings = get_settings()
    questions = read_questions()
    db = await create_db(settings)
    async with httpx.AsyncClient(timeout=60) as client:
        embedder = Embedder(
            client,
            settings.gemini_api_key.get_secret_value(),
            settings.gemini_embed_model,
            settings.embed_dim,
            cache_dir=None,
        )
        vectors = await query_vectors(
            questions, embedder.embed_query, settings.gemini_embed_model, settings.embed_dim
        )
    print(f"query vectors: {len(vectors)} | Gemini API calls: {embedder.api_calls}")

    docs = await db.table("drug_documents").select("id", count="exact", head=True).execute()
    chunks = (
        await db.table("drug_chunks")
        .select("id", count="exact", head=True)
        .not_.is_("embedding", "null")
        .execute()
    )
    note = (
        f"Database at run time: {docs.count} drug documents, {chunks.count} chunks with an "
        "embedding (the full load is 64 documents / 3866 chunks)."
    )

    reranker = Reranker()
    outcomes: list[Outcome] = []
    for q, vector in zip(questions, vectors, strict=True):
        outcomes += await run_pipelines(db, reranker, q, vector)

    report = build_report(outcomes, note)
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text(report, encoding="utf-8")
    print(report)
    print(f"wrote {REPORT_FILE.relative_to(EVAL_DIR.parent)}")

if __name__ == "__main__":
    asyncio.run(main())
