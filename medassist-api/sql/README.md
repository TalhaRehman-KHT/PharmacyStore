# medassist-api/sql

Two kinds of files live here.

## `sql/schema/`: generated snapshot (never edit by hand)
Written by `python -m scripts.snapshot_schema` from the LIVE Supabase database (read-only connection,
`DATABASE_URL` in `.env`). The human-readable version is `docs/DB_SCHEMA.md`, the source of truth for
table and column names. No data and no secrets; output is deterministic, so `git diff` shows real drift only.

| File | Contents |
| --- | --- |
| 00_extensions_and_types.sql | extensions + enum types |
| 10_tables.sql | tables (columns, defaults, generated columns, PK/UNIQUE/CHECK) |
| 20_foreign_keys.sql | foreign keys with ON DELETE rules |
| 30_indexes.sql | indexes |
| 40_functions.sql | functions + EXECUTE grants |
| 50_triggers.sql | triggers |
| 60_rls_policies.sql | RLS + policies |

Rebuild on an EMPTY database: run them in order 00 -> 60.

## `sql/NNN_*.sql`: migrations (run by hand)
Run each one in the Supabase SQL editor, in order. Each file is safe to run again.

| Order | File | What it does |
| --- | --- | --- |
| 1 | 001_extensions.sql | Enables pgvector |
| 2 | 002_tables.sql | 7 MedAssist tables + updated_at trigger |
| 3 | 003_indexes.sql | HNSW vector index, full-text GIN index, history indexes |
| 4 | 004_rls.sql | Row Level Security (is_pharmacist() reads public.users) |
| 5 | 005_seed_synonyms.sql | Starter brand -> generic mapping |
| 6 | 006_hybrid_search.sql | Search function (you write it in Step 6) |
| 8 | 008_answer_escalation.sql | answer_escalation() RPC: atomic reply, backend-only |
| 9 | 009_escalation_pharmacy.sql | escalations.pharmacy_id + index |
| check | 900_verify.sql | Read-only checks after setup |
| reset | 999_drop_medassist.sql | Deletes all MedAssist tables (danger) |

## Workflow after every migration
1. Run the migration in the Supabase SQL editor.
2. Re-run the snapshot: `python -m scripts.snapshot_schema`
3. Review the drift: `git diff sql/schema docs/DB_SCHEMA.md`, and check that it matches what the migration meant to do.
