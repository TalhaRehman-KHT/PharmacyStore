# PharmacyStore

## Stack
- `Client/`: React 19 + Vite + Tailwind 4 + Zustand + React Router 7, Supabase JS (direct DB access), EmailJS, Gemini, Google OAuth. Port 5173.
- `Server/`: Express 4 + Stripe + Supabase service client. Port 5050. Routes: health, checkout session, webhook.
- DB: Supabase, 14 tables, bucket `DatabaseAssets`. Custom auth (`users` table), no Supabase Auth.

## Commands (PowerShell, Node 22)
- Server: `cd Server; npm run dev`
- Client: `cd Client; npm run dev` | `npm run lint` | `npm run build`
- Webhook: `stripe listen --forward-to localhost:5050/api/stripe/webhook`

## Rules
- Branch `v4-fix`; small commits `fix(area): …`.
- Never print/log/commit/modify `.env` values; names stay fixed.
- Ask before: auth architecture change, DB schema change, deleting files, major deps, irreversible ops.
- Schema changes → `supabase/migrations/NNN_name.sql`; user runs them.
- TDD: failing test → fix → green → lint/build → browser verify → commit.
- Docs: minimal words, tables/bullets.
- Talk to user in Roman Urdu; code/docs/commits in English.
- Stuck >2 attempts → stop and report.

## Docs
- `docs/ARCHITECTURE.md` flows, auth, trust boundaries
- `docs/STRUCTURE.md` file map
- `docs/ROUTES.md` routes + status
- `docs/DATABASE.md` tables, FKs, enums
- `docs/ENV.md` env names
- `docs/WORKFLOW.md` run, admin, tests
- `docs/BUGS.md` bug list (K1–K9 + audit)
- `docs/TEST_PLANS.md` plans
