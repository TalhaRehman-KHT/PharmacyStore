"""Ask the RUNNING API (/ask?variant=naive) every question of eval/retrieval_smoke.csv once and save
question, answer and citations to eval/results/naive_answers.md (input for the evaluation stage).

Run from medassist-api/ (PowerShell), with the API running on http://localhost:8000:
    $env:EVAL_USER_EMAIL="<customer email>"; python -m eval.naive_answers [--pause 35]

- The questions are asked as that customer (X-User-Id, looked up in public.users, read-only).
- Each question opens a new chat session; all of them are deleted again at the end (also after a
  crash), so the customer's history stays as it was.
- Groq's free tier allows ~2 answers per minute, so the script waits `--pause` seconds between
  questions and retries a failed question once after 60 s.
- The API allows 20 questions per user per hour (RATE_LIMIT): start the API for this run with a
  higher limit, e.g. `$env:RATE_LIMIT="200/hour"; uvicorn app.main:app --port 8000`.
"""

import argparse
import asyncio
import csv
import os
import time
from dataclasses import dataclass, field
from datetime import date

import httpx
from supabase import AsyncClient

from app.config import get_settings
from app.db.client import create_db
from eval.retrieval_smoke import QUESTIONS_FILE

API = os.environ.get("EVAL_API_URL", "http://localhost:8000").rstrip("/")
REPORT_FILE = QUESTIONS_FILE.parent / "results" / "naive_answers.md"
RETRY_WAIT_S = 60


@dataclass
class Row:
    question: str
    language: str
    expected_drug: str
    expected_section: str
    status: int = 0
    answer: str = ""
    route: str = ""
    citations: list[dict] = field(default_factory=list)
    latency_ms: int | None = None
    tokens: int | None = None
    session_id: str | None = None

    @property
    def drug_cited(self) -> bool:
        return any(c["drug"] == self.expected_drug for c in self.citations)


def read_rows() -> list[Row]:
    with QUESTIONS_FILE.open(encoding="utf-8") as f:
        return [Row(**r) for r in csv.DictReader(f)]


async def find_user_id(db: AsyncClient, email: str) -> str:
    res = await (
        db.table("users")
        .select("id, is_active")
        .eq("email", email)
        .in_("role", ["user", "doctor"])
        .execute()
    )
    active = [u for u in res.data if u.get("is_active") is not False]
    if not active:
        raise SystemExit("EVAL_USER_EMAIL: no active customer with that email")
    return active[0]["id"]


async def ask(http: httpx.AsyncClient, user_id: str, row: Row) -> None:
    res = await http.post(
        "/ask",
        params={"variant": "naive"},
        json={"question": row.question},
        headers={"X-User-Id": user_id},
    )
    row.status = res.status_code
    body = res.json()
    if res.status_code != 200:
        row.answer = f"(HTTP {res.status_code}: {body.get('message', '')})"
        return
    meta = body["meta"]
    row.answer, row.citations = body["answer"], body["citations"]
    row.route, row.latency_ms, row.tokens = meta["route"], meta["latencyMs"], meta.get("tokens")
    row.session_id = meta["sessionId"]


def render(rows: list[Row]) -> str:
    ok = [r for r in rows if r.status == 200]
    routes = {k: sum(r.route == k for r in ok) for k in sorted({r.route for r in ok})}
    lat = sorted(r.latency_ms for r in ok if r.latency_ms is not None)
    lines = [
        "# Naive RAG answers (retrieval_smoke questions)",
        "",
        f"Date: {date.today().isoformat()} | API: /ask?variant=naive | questions: {len(rows)} | "
        f"answered: {len(ok)} | routes: {routes} | expected drug cited: "
        f"{sum(r.drug_cited for r in ok)}/{len(ok)}"
        + (f" | latency median {lat[len(lat) // 2]} ms" if lat else ""),
        "",
        "| # | lang | question | route | expected drug cited | citations | ms | tokens |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for i, r in enumerate(rows, 1):
        cites = ", ".join(f"[{c['n']}] {c['drug']} / {c['section']}" for c in r.citations) or "-"
        lines.append(
            f"| {i} | {r.language} | {r.question} | {r.route or r.status} | "
            f"{'yes' if r.drug_cited else 'no'} | {cites} | {r.latency_ms or '-'} | "
            f"{r.tokens or '-'} |"
        )
    lines += ["", "## Answers", ""]
    for i, r in enumerate(rows, 1):
        lines += [
            f"### {i}. {r.question}",
            "",
            f"Expected: {r.expected_drug} / {r.expected_section} | route: {r.route or r.status}",
            "",
            *[f"> {line}" if line else ">" for line in r.answer.strip().splitlines()],
            "",
        ]
        lines += [f"- [{c['n']}] {c['drug']} / {c['section']}: {c['url']}" for c in r.citations]
        lines.append("")
    return "\n".join(lines)


async def cleanup(db: AsyncClient, user_id: str, rows: list[Row]) -> int:
    ids = [r.session_id for r in rows if r.session_id]
    if not ids:
        return 0
    res = await db.table("chat_sessions").delete().eq("user_id", user_id).in_("id", ids).execute()
    return len(res.data or [])


async def main(pause: float) -> None:
    email = os.environ.get("EVAL_USER_EMAIL", "").strip()
    if not email:
        raise SystemExit("Set EVAL_USER_EMAIL (a customer account)")
    db = await create_db(get_settings())
    user_id = await find_user_id(db, email)
    rows = read_rows()
    try:
        async with httpx.AsyncClient(base_url=API, timeout=120) as http:
            for i, row in enumerate(rows, 1):
                if i > 1:
                    await asyncio.sleep(pause)
                started = time.perf_counter()
                await ask(http, user_id, row)
                if row.status != 200:
                    print(f"{i:>2} retry in {RETRY_WAIT_S}s: {row.answer}", flush=True)
                    await asyncio.sleep(RETRY_WAIT_S)
                    await ask(http, user_id, row)
                took = time.perf_counter() - started
                print(
                    f"{i:>2} {row.route or row.status:<12} cited={row.drug_cited!s:<5} "
                    f"{took:5.1f}s  {row.question}",
                    flush=True,
                )
    finally:
        REPORT_FILE.write_text(render(rows) + "\n", encoding="utf-8")
        print(f"\nreport: {REPORT_FILE.relative_to(QUESTIONS_FILE.parent.parent)}")
        print(f"cleanup: deleted {await cleanup(db, user_id, rows)} eval session(s)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Naive RAG answers for the smoke questions.")
    parser.add_argument("--pause", type=float, default=35.0, help="seconds between questions")
    asyncio.run(main(parser.parse_args().pause))
