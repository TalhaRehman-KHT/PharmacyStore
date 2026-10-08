# Bugs

Severity: Critical / High / Medium / Low. Status: open / fixed (`hash`).

## Known (pre-audit, confirmed in code 2026-10-08)
| ID | Where | Issue | Severity | Status |
|---|---|---|---|---|
| K1 | `Server/src/app.js` | commented-out import of non-existent `routes/googleAuth.js` + dead `/api/auth/google` block | High | open |
| K2 | `Client/src/lib/authService.js` `signIn` | `password_hash` fetched to browser, compared client-side | Critical | open |
| K3 | `authService.js` `signInWithGoogle` | Google ID token decoded via `atob`, no signature check | Critical | open |
| K4 | DB | all RLS policies `USING (true)` | Critical | open |
| K5 | `emailService.js`, `googleConstants.js`, `api/axios.js` | hardcoded fallback ids / hosted URL | Medium | open |
| K6 | repo | `Client/.env`, `Server/.env`, `Server/node_modules` (2244 files) tracked; no root `.gitignore` | Medium | untracked (882d49b); values still in git history → rotate keys |
| K7 | `userCartService.js`, `reminderService.js` | some inserts ignore `error` | Medium | open |
| K8 | `Server/src/routes/createCheckoutSession.js` | caller identified by spoofable `X-User-Id` header | High | open |
| K9 | `Server/src/routes/stripeWebhook.js` | idempotency = read-then-update (race on duplicate events → double stock deduction) | Medium | open |

## Browser audit (Phase 2)
| ID | Route/flow | Steps | Expected | Actual | Console/network | Severity | Suspected file |
|---|---|---|---|---|---|---|---|
