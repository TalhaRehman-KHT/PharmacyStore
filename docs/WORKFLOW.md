# Workflow

## Run locally (3 terminals, PowerShell)
| # | Dir | Command |
|---|---|---|
| 1 | `Server/` | `npm install; npm run dev` → http://localhost:5050/api/health |
| 2 | `Client/` | `npm install; npm run dev` → http://localhost:5173 |
| 3 | any | `stripe listen --forward-to localhost:5050/api/stripe/webhook` → copy `whsec_…` into `Server/.env` `STRIPE_WEBHOOK_SECRET`, restart server |

Health with config flags: `/api/health?details=1`.
Stripe test card: `4242 4242 4242 4242`, any future date, any CVC.

## Branch / commit
- Work branch: `v4-fix` (from `v3`). PR → `main`.
- Small commits: `fix(cart): …`, `test(auth): …`, `docs: …`, `chore: …`.
- Never commit `.env`, `node_modules/`.
- Schema changes: new file `supabase/migrations/NNN_name.sql`, run manually in Supabase SQL editor.

## Make an admin
1. Register via `/vendor/register`, verify OTP.
2. Supabase SQL editor:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = '<email>' AND role = 'vendor';
   ```
3. Log in at `/vendor/login` → lands on `/vendor/admin-orders`.

## Tests
| Pkg | Command |
|---|---|
| Client | `npm run lint`, `npm run build`, `npm test` (Vitest, TBD), `npm run test:e2e` (Playwright, TBD) |
| Server | `npm test` (Vitest + supertest, TBD) |
