# MedAssist API

A medicine question-answering assistant for PharmacyStore. Customers ask about medicines in English or
Roman Urdu and get short answers that cite official FDA labels (DailyMed links). Shop questions
("is Panadol in stock?") get product cards with price and pharmacy. Risky questions (personal dosing,
prescription-only, pregnancy or children) get general cited information and are sent to the pharmacist
(vendor), who replies from `/vendor/escalations`. Emergencies get a fixed "seek help now" message.

## Architecture
```
Client (React widget, /user/assistant)  --X-User-Id, JSON / SSE-->  medassist-api (FastAPI, port 8000)
                                                                        |
  LangGraph agent (app/graph/build.py):                                 |
    guard ── emergency ─────────────────────────────> fixed text       |
      │ (keyword rules + fast LLM: safe / risky)                        |
    router ── out_of_scope ─────────────────────────> fixed text       |
      │ (knowledge / product / both + language)                         |
    rewrite (brand -> US generic, English query)                        |
      ├─ tools (read-only shop search: stock, price, alternatives)      |
      └─ retrieve (Gemini embedding -> pgvector) -> grade (fast LLM)    |
            ├─ nothing relevant (after one retry) -> no_evidence        |
            └─ generate (Groq, [n] citations) -> escalate if risky      |
                                                                        v
                     Supabase Postgres + pgvector (drug labels, chats, escalations, shop tables read-only)
```
- Answers stream token by token (SSE). An answer without a valid citation is replaced by "no evidence".
- LLM chain: Groq answer model -> Groq backup model -> Gemini; all busy = HTTP 429 with Retry-After.
- Every chat, message, rating and escalation is stored per user; another user's ids return 404.

## Run locally (Windows PowerShell)
```powershell
cd medassist-api
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
copy .env.example .env        # then fill in the values (names are explained in the file)
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
Open http://localhost:8000/docs for Swagger and http://localhost:8000/health for a health check.
Client: set `VITE_MEDASSIST_API_URL=http://localhost:8000` and `VITE_MEDASSIST_USE_MOCK=false`
in `Client/.env`, then `cd Client; npm run dev`.

Docker: `docker compose up --build` (reads `.env`).

## Load the medicine labels
```powershell
python -m app.ingest.run drug-list       # drugs the shop sells + extras
python -m app.ingest.run download        # openFDA labels (oral first)
python -m app.ingest.run chunk           # clean + split into sections
python -m app.ingest.run embed-load --resume   # Gemini embeddings -> DB (free tier: run daily)
python -m app.ingest.run embed-status    # how much is left
```

## Database
- Migrations: `sql/NNN_*.sql`, run with `python -m scripts.run_sql <file>` (dry run first, then `--yes`).
- `sql/schema/` and `docs/DB_SCHEMA.md` are generated from the live database by
  `python -m scripts.snapshot_schema`; do not edit them by hand. See `sql/README.md`.

## Test
```powershell
ruff check .
pytest -q                                   # unit tests, no network (fakes for DB and LLMs)
$env:RUN_INTEGRATION="1"; $env:ITEST_USER_EMAIL="<customer email>"; pytest -m integration -q
```
Integration tests use the real database and touch only rows prefixed `[itest]`. They include a golden
retrieval gate: Recall@5 on `tests/golden/questions.csv` (questions whose drug is loaded) must stay at or
above `GOLDEN_RECALL_MIN` (default 0.8).

End-to-end check against a running API:
`$env:SMOKE_CUSTOMER_EMAIL=...; $env:SMOKE_VENDOR_EMAIL=...; python -m scripts.smoke_test`

## Deploy
The container image is built from `Dockerfile` (runs `uvicorn` on port 8000). Deployment steps and
the AWS / GitHub checklist will live in `docs/DEPLOY.md`.

## Known limits
- Auth trusts the `X-User-Id` header, the same as the main PharmacyStore app (no real login tokens yet).
- The rate limit is in memory per process.
- Answers are general label information, never personal medical advice.
