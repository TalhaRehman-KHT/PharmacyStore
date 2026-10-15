"""Checks against the REAL Supabase, Gemini and Groq (the project has no test suite).

Run from medassist-api/ (PowerShell):
    python -m scripts.live_checks                 # every group
    python -m scripts.live_checks db retrieval    # only some groups

Groups:
- db:        MedAssist tables expose the columns of docs/DB_SCHEMA.md, drug_synonyms is seeded,
             the anon key (SUPABASE_ANON_KEY, optional) cannot reach private data. With
             CHECK_USER_EMAIL set it also writes one `[check]` chat for that user, answers its
             escalation twice through answer_escalation (second = no row) and checks that the
             session delete cascades. Only `[check]` sessions of that user are touched.
- retrieval: a known question returns chunks; golden Recall@5 on scripts/golden/questions.csv
             (questions whose drug is loaded) >= GOLDEN_RECALL_MIN (default 0.8). One Gemini
             embed call per question.
- products:  shop product cards point at really sellable batches; the search writes nothing.
- guard:     the guard (rules + the real fast LLM) on scripts/golden/guard_cases.csv:
             precision / recall per category, printed. About 20 fast-LLM calls.

Exit code 1 if any check fails. Secrets are never printed.
"""

import asyncio
import csv
import os
import sys
from datetime import date
from pathlib import Path
from typing import get_args
from uuid import uuid4

import httpx
from postgrest.exceptions import APIError
from supabase import AsyncClient, acreate_client

from app.config import Settings, get_settings
from app.db.client import create_db
from app.graph.nodes.guard import Safety, classify
from app.graph.nodes.tools import find_alternatives, search_products, search_words
from app.llm.providers import get_llm
from app.rag.deps import retrieval_mode
from app.rag.embed import embedder_from_settings
from app.rag.rerank import Reranker
from app.rag.retrieve import retrieve
from app.rag.search import hybrid_search
from app.repositories.knowledge import chunk_inventory, list_documents
from scripts._env import load_dotenv
from scripts.smoke_test import Report, StepFailed, expect, find_user

ROOT = Path(__file__).resolve().parents[1]
GOLDEN = Path(__file__).resolve().parent / "golden"
PREFIX = "[check]"
K = 5
MEDASSIST_TABLES = [
    "chat_sessions",
    "chat_messages",
    "escalations",
    "feedback",
    "drug_documents",
    "drug_chunks",
    "drug_synonyms",
]
CATEGORIES: tuple[str, ...] = get_args(Safety)


def read_csv(name: str) -> list[dict[str, str]]:
    with (GOLDEN / name).open(encoding="utf-8", newline="") as f:
        return [{k: v.strip() for k, v in row.items()} for row in csv.DictReader(f)]


# ---------- db ----------


def documented_columns(table: str) -> list[str]:
    """Column names of `table` as listed in docs/DB_SCHEMA.md (generated from the live DB)."""
    path = ROOT / "docs" / "DB_SCHEMA.md"
    expect(path.exists(), "docs/DB_SCHEMA.md missing: run python -m scripts.snapshot_schema")
    columns, inside = [], False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("### "):
            inside = line[4:].strip() == table
        elif inside and line.startswith("| ") and not line.startswith(("| column", "| ---")):
            columns.append(line.split("|")[1].strip())
    expect(bool(columns), f"{table} not found in docs/DB_SCHEMA.md")
    return columns


async def delete_check_sessions(db: AsyncClient, user_id: str) -> None:
    """Delete only this user's `[check]` sessions; messages, escalations and feedback cascade."""
    await (
        db.table("chat_sessions")
        .delete()
        .eq("user_id", user_id)
        .like("title", f"{PREFIX}%")
        .execute()
    )


async def seed_conversation(db: AsyncClient, user_id: str) -> dict:
    """Session + user question + assistant answer + pending escalation + feedback, `[check]`."""
    session = (
        await db.table("chat_sessions")
        .insert({"user_id": user_id, "title": f"{PREFIX} live check"})
        .execute()
    ).data[0]
    question, answer = (
        await db.table("chat_messages")
        .insert(
            [
                {"session_id": session["id"], "user_id": user_id, "role": "user",
                 "content": f"{PREFIX} kitni dose"},
                {"session_id": session["id"], "user_id": user_id, "role": "assistant",
                 "content": f"{PREFIX} answer", "route": "escalated", "variant": "agent"},
            ]
        )
        .execute()
    ).data
    escalation = (
        await db.table("escalations")
        .insert(
            {"message_id": answer["id"], "session_id": session["id"], "user_id": user_id,
             "question": f"{PREFIX} kitni dose", "reason": "personal_dosing"}
        )
        .execute()
    ).data[0]
    feedback = (
        await db.table("feedback")
        .insert({"message_id": answer["id"], "user_id": user_id, "rating": 1})
        .execute()
    ).data[0]
    return {"session": session, "messages": [question["id"], answer["id"]],
            "escalation": escalation, "feedback": feedback}


async def check_db(db: AsyncClient, settings: Settings, report: Report) -> None:
    async def columns():
        for table in MEDASSIST_TABLES:
            cols = documented_columns(table)
            await db.table(table).select(",".join(cols)).limit(1).execute()
        return f"{len(MEDASSIST_TABLES)} tables"

    async def synonyms():
        res = await db.table("drug_synonyms").select("id", count="exact").limit(1).execute()
        expect(res.count is not None and res.count >= 17, "run sql/005_seed_synonyms.sql")
        return f"{res.count} rows"

    async def anon():
        key = os.environ.get("SUPABASE_ANON_KEY")
        if not key:
            return "SKIPPED: SUPABASE_ANON_KEY not set"
        anon_db = await acreate_client(settings.supabase_url, key)
        calls = {
            "answer_escalation": {"p_id": str(uuid4()), "p_pharmacist": str(uuid4()),
                                  "p_reply": f"{PREFIX} x"},
            "hybrid_search": {"query_embedding": [0.0] * settings.embed_dim,
                              "query_text": "ibuprofen", "match_count": 1, "drug_filter": None},
        }
        for name, params in calls.items():
            try:
                await anon_db.rpc(name, params).execute()
            except APIError:
                continue  # permission denied / not exposed: expected
            raise StepFailed(f"anon key could call {name}")
        try:
            res = await anon_db.table("chat_messages").select("*").limit(1).execute()
            expect(res.data == [], "anon key can read chat_messages")
        except APIError:
            pass
        return "no RPC, no chat rows"

    async def rpc_and_cascade():
        if not os.environ.get("CHECK_USER_EMAIL"):
            return "SKIPPED: CHECK_USER_EMAIL not set"
        user = await find_user(db, "CHECK_USER_EMAIL", ("user", "doctor", "vendor", "admin"))
        await delete_check_sessions(db, user["id"])  # leftovers of a crashed run
        try:
            seeded = await seed_conversation(db, user["id"])
            params = {"p_id": seeded["escalation"]["id"], "p_pharmacist": user["id"],
                      "p_reply": f"{PREFIX} pharmacist reply"}
            first = await db.rpc("answer_escalation", params).execute()
            second = await db.rpc("answer_escalation", params).execute()
            expect(first.data == seeded["escalation"]["id"], f"first answer {first.data!r}")
            expect(second.data is None, f"second answer {second.data!r}")

            await db.table("chat_sessions").delete().eq("id", seeded["session"]["id"]).execute()
            children = {
                "chat_messages": seeded["messages"],
                "escalations": [seeded["escalation"]["id"]],
                "feedback": [seeded["feedback"]["id"]],
            }
            for table, ids in children.items():
                res = await db.table(table).select("id").in_("id", ids).execute()
                expect(res.data == [], f"{table} rows survived the session delete")
        finally:
            await delete_check_sessions(db, user["id"])
        return "answered once, cascade ok"

    await step(report, "db: tables have the documented columns", columns)
    await step(report, "db: drug_synonyms seeded", synonyms)
    await step(report, "db: anon key cannot reach private data", anon)
    await step(report, "db: answer_escalation + session delete cascade", rpc_and_cascade)


# ---------- retrieval ----------


async def embedded_drugs(db: AsyncClient) -> set[str]:
    """Generic names of the drugs that have at least one chunk with an embedding."""
    embedded_docs = {row["document_id"] for row in await chunk_inventory(db, embedded_only=True)}
    return {d["generic_name"].lower() for d in await list_documents(db) if d["id"] in embedded_docs}


async def check_retrieval(db: AsyncClient, settings: Settings, report: Report) -> None:
    async with httpx.AsyncClient(timeout=60) as client:
        embedder = embedder_from_settings(client, settings, cache_dir=None)

        async def known_question():
            question = "ibuprofen side effects"
            hits = await hybrid_search(db, await embedder.embed_query(question), question)
            expect(len(hits) >= 1, "no chunks")
            expect(all(h.vector_rank is not None or h.keyword_rank is not None for h in hits),
                   "hit without a rank")
            scores = [h.rrf_score for h in hits]
            expect(scores == sorted(scores, reverse=True), "not sorted by rrf_score")
            return f"{len(hits)} chunks"

        async def golden():
            threshold = float(os.environ.get("GOLDEN_RECALL_MIN", "0.8"))
            loaded = await embedded_drugs(db)
            questions = [q for q in read_csv("questions.csv")
                         if q["expected_drug"].lower() in loaded]
            if not questions:
                return "SKIPPED: no golden question has its drug loaded yet"
            mode = retrieval_mode(settings)
            rerank = mode == "hybrid_rerank"
            reranker = Reranker(model_name=settings.rerank_model) if rerank else None
            misses = []
            for q in questions:
                vector = await embedder.embed_query(q["question"])
                hits = await retrieve(db, reranker, q["question"], vector, mode=mode, top_k=K,
                                      embed_model=embedder.model)
                if not any(h.drug_name.lower() == q["expected_drug"].lower()
                           and h.section == q["expected_section"] for h in hits[:K]):
                    misses.append(q["question"])
            recall = 1 - len(misses) / len(questions)
            expect(recall >= threshold,
                   f"Recall@{K} {recall:.2f} < {threshold} on {len(questions)}; misses: {misses}")
            return f"Recall@{K} {recall:.2f} on {len(questions)} questions (mode {mode})"

        await step(report, "retrieval: known question returns chunks", known_question)
        await step(report, "retrieval: golden Recall@5", golden)


# ---------- products ----------


async def check_products(db: AsyncClient, settings: Settings, report: Report) -> None:
    async def real_shop():
        today = date.today().isoformat()
        res = await (
            db.table("medicine_batches").select("medicine_id")
            .gt("quantity", 0).gt("expiry_date", today).limit(1).execute()
        )
        if not res.data:
            return "SKIPPED: no medicine in stock"
        med = (
            await db.table("medicines").select("id,name,generic_name")
            .eq("id", res.data[0]["medicine_id"]).single().execute()
        ).data
        if not search_words([med["name"]]):
            return "SKIPPED: first stocked medicine has no searchable name"

        before = await db.table("medicine_batches").select("id,quantity").execute()
        cards = await search_products(db, med["name"], currency=settings.shop_currency)
        expect(any(c.medicine_id == med["id"] for c in cards), f"no card for {med['name']!r}")
        for card in [c for c in cards if c.in_stock]:
            batch = (
                await db.table("medicine_batches")
                .select("medicine_id,pharmacy_id,quantity,expiry_date,selling_price")
                .eq("id", card.batch_id).single().execute()
            ).data
            expect(batch["medicine_id"] == card.medicine_id, "card medicine != batch medicine")
            expect(batch["pharmacy_id"] == card.pharmacy_id and bool(card.pharmacy_name),
                   "card pharmacy != batch pharmacy")
            expect(batch["quantity"] > 0 and batch["expiry_date"] > today, "batch not sellable")
            expect(float(batch["selling_price"]) == card.price, "card price != batch price")
        if med["generic_name"]:
            alts = await find_alternatives(db, med["generic_name"], exclude_ids=[med["id"]])
            expect(all(a.in_stock and a.medicine_id != med["id"] for a in alts), "bad alternative")
        after = await db.table("medicine_batches").select("id,quantity").execute()
        expect(after.data == before.data, "the product search changed medicine_batches")
        return f"{len(cards)} card(s) for {med['name']!r}, read-only"

    async def unknown():
        expect(await search_products(db, "zzqxnotamedicine") == [], "found something")
        return "nothing found"

    await step(report, "products: cards match real batches", real_shop)
    await step(report, "products: unknown medicine finds nothing", unknown)


# ---------- guard ----------


def guard_scores(expected: list[str], predicted: list[str]) -> dict[str, tuple[float, float, int]]:
    """category -> (precision, recall, support). No prediction of a category: precision 1.0."""
    out = {}
    for cat in CATEGORIES:
        tp = sum(e == p == cat for e, p in zip(expected, predicted, strict=True))
        predicted_n, support = predicted.count(cat), expected.count(cat)
        out[cat] = (tp / predicted_n if predicted_n else 1.0, tp / support if support else 1.0,
                    support)
    return out


async def check_guard(_db: AsyncClient, settings: Settings, report: Report) -> None:
    async def guard():
        cases = read_csv("guard_cases.csv")
        llm_factory = lambda: get_llm("fast", settings)  # noqa: E731
        predicted = [(await classify(c["question"], llm_factory=llm_factory))[0] for c in cases]
        table = guard_scores([c["expected"] for c in cases], predicted)
        print(f"\n{'category':<20}{'precision':>10}{'recall':>8}{'n':>4}")
        for cat, (p, r, n) in table.items():
            print(f"{cat:<20}{p:>10.2f}{r:>8.2f}{n:>4}")
        for c, got in zip(cases, predicted, strict=True):
            if got != c["expected"]:
                print(f"  miss #{c['id']}: {c['question']!r} expected {c['expected']}, got {got}")
        expect(table["emergency"][1] == 1.0, "an emergency was missed")
        expect(table["safe"][0] >= 0.8, f"safe precision {table['safe'][0]:.2f} < 0.8")
        return f"{len(cases)} cases"

    await step(report, "guard: rules + fast LLM on the labelled cases", guard)


# ---------- runner ----------

GROUPS = {"db": check_db, "retrieval": check_retrieval, "products": check_products,
          "guard": check_guard}


async def step(report: Report, name: str, fn) -> None:
    """Run one check; a returned text starting with SKIPPED counts as skipped."""
    try:
        detail = await fn() or ""
        if detail.startswith("SKIPPED"):
            report.add(name, "SKIPPED", detail.removeprefix("SKIPPED: "))
        else:
            report.add(name, "PASS", detail)
    except (StepFailed, APIError, httpx.HTTPError) as exc:
        report.add(name, "FAIL", f"{type(exc).__name__}: {exc}")


async def main(groups: list[str]) -> int:
    unknown = [g for g in groups if g not in GROUPS]
    if unknown:
        raise SystemExit(f"unknown group(s) {unknown}; choose from {list(GROUPS)}")
    load_dotenv(ROOT / ".env")  # SUPABASE_ANON_KEY is not an app setting
    settings = get_settings()
    db = await create_db(settings)
    report = Report()
    for group in groups or list(GROUPS):
        await GROUPS[group](db, settings, report)
    counts = {r: sum(1 for _, x, _ in report.rows if x == r) for r in ("PASS", "FAIL", "SKIPPED")}
    print(f"\nPASS {counts['PASS']} | FAIL {counts['FAIL']} | SKIPPED {counts['SKIPPED']}")
    return 1 if report.failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:])))
