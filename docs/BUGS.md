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
| K8 | `Server/src/routes/createCheckoutSession.js` | caller identified by spoofable `X-User-Id` header (confirmed: session created without login) | High | open |
| K9 | `Server/src/routes/stripeWebhook.js` | idempotency = read-then-update (race on duplicate events → double stock deduction) | Medium | open |

## Browser audit (Phase 2)
Run 2026-10-08, Chrome, local Client + Server. Status in last column.

| ID | Route/flow | Steps | Expected | Actual | Console/network | Severity | File | Status |
|---|---|---|---|---|---|---|---|---|
| B1 | `/user/register` | submit valid form | non-blocking success msg | native `alert()` blocks page | — | Low | `Register.jsx` | fixed |
| B2 | all DB calls | any Supabase call | 200 | 404 `PGRST125 Invalid path` (URL ends `/rest/v1` → `/rest/v1/rest/v1/…`); same on Server | `POST …/rest/v1/rest/v1/users 404` | Critical | `lib/supabase.js`, `Server/src/supabaseAdmin.js` | fixed |
| B3 | OTP | read `otps` with publishable key | OTP hidden | plaintext `otp_code` readable by anyone (RLS true) | — | Critical | DB / `authService.js` | open (→ K4 plan) |
| B4 | `/vendor/create-store` | vendor with store opens page, submits | redirect to dashboard | form shown; 2nd pharmacy → `.maybeSingle()` errors → dashboard broken | — | High | `CreateStore.jsx`, `vendorPharmacyService.js` | open |
| B5 | `/user/cart` | `+` past stock (2) | capped at stock | qty 3 allowed (server rejects at checkout: 400 Insufficient stock) | — | Medium | `UserCart.jsx`, `userCartService.js` | open |
| B6 | checkout (local) | Pay | local API | calls hosted `server-delta-sandy-36.vercel.app` (VITE_API_URL) → 500 `TypeError: fetch failed` | `POST …vercel.app/api/stripe/create-checkout-session 500` | High (config) | `Client/.env`, hosted env | open — user: set `VITE_API_URL=http://localhost:5050` locally; check Vercel `SUPABASE_URL` |
| B9 | vendor settings | save with no changes | no-op | `updatePharmacy` returns `getPharmacyByVendorId(null)` | — | Low | `vendorPharmacyService.js:70` | open |
| B10 | `/forgot-password` | email that has user+vendor accounts | OTP sent | `.maybeSingle()` errors on 2 rows → silently no OTP, UI says sent; `resetPassword` `.single()` same | no `otps` row | High | `authService.js` `requestPasswordReset`, `resetPassword` | open |
| B11 | OTP verify | wrong code repeatedly | attempts counted, lock at 5 | `attempts` never incremented → brute force | — | High | `authService.js` `verifyOTP*` | open |
| B12 | repo | `npm run lint` | 0 errors | 31 errors (unused vars, fast-refresh exports), 6 warnings | — | Low | many | open |

## Verified OK
| Flow | Result |
|---|---|
| Logged-out guards (19 routes) | redirect to role login / `/` ✅ |
| Wrong-role guards (user→vendor, vendor→user/admin) | redirect to role home ✅ |
| Signup → OTP verify → login (customer) | ✅ (after B2 fix) |
| Shop list, add to cart, qty +/−, empty cart | ✅ |
| Server checkout session (stock check, Stripe URL) | ✅ via local API |
| Stripe test payment (4242) → success redirect | ✅ |
| Webhook (signed replay): paid, stock −2, `stock_transactions`, cart cleared | ✅ |
| Webhook duplicate event → no double deduction (sequential) | ✅ |
| Webhook bad signature → 400 | ✅ |
| Reminder add / delete (+ times) | ✅ |
| Vendor dashboard/orders/medicine/expiring/reports/settings render | ✅ |
| Medicine + image upload to `DatabaseAssets` + batch (done by user) | ✅ |
| 375px width: no horizontal overflow (9 user pages) | ✅ |
| Console errors on all crawled routes | none |

## Not tested yet
| Flow | Blocker |
|---|---|
| Google sign-in | needs manual Google account click |
| Admin approve/reject | needs SQL to promote a vendor (user runs) |
| Gemini prescription scan → reminders | needs prescription image upload |
| Real webhook via `stripe listen` | Stripe CLI not installed |
| OTP email delivery | Gmail tool lacks read scope; ask user to confirm inbox |
