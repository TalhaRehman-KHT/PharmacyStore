# Env variables (names only — never commit values)

## Client (`Client/.env`, exposed to browser)
| Name | Purpose | Used in |
|---|---|---|
| VITE_API_URL | Express API base | `api/axios.js` |
| VITE_SUPABASE_URL | Supabase project URL | `lib/supabase.js` |
| VITE_SUPABASE_ANON_KEY | publishable key (`sb_publishable_…`) | `lib/supabase.js` |
| VITE_EMAILJS_SERVICE_ID | EmailJS service | `lib/emailService.js` |
| VITE_EMAILJS_TEMPLATE_ID | OTP template | `lib/emailService.js` |
| VITE_EMAILJS_PUBLIC_KEY | EmailJS public key | `lib/emailService.js` |
| VITE_GOOGLE_WEB_CLIENT_ID | Google OAuth web client | `lib/googleConstants.js`, `lib/authService.js` |
| VITE_GEMINI_API_KEY | Gemini OCR | `lib/geminiService.js` |

## Server (`Server/.env`, secret)
| Name | Purpose | Used in |
|---|---|---|
| PORT | listen port (default 5050) | `src/index.js` |
| SUPABASE_URL | Supabase project URL | `src/supabaseAdmin.js` |
| SUPABASE_SERVICE_ROLE_KEY | secret key (`sb_secret_…`) | `src/supabaseAdmin.js` |
| STRIPE_SECRET_KEY | Stripe API | `src/stripeClient.js` |
| STRIPE_WEBHOOK_SECRET | webhook signature | `src/routes/stripeWebhook.js` |
| FRONTEND_URL | CORS origins (comma list) | `src/app.js` |
| STRIPE_CURRENCY | e.g. `usd` | `src/routes/createCheckoutSession.js` |
| VERCEL | set by Vercel; skips `listen` | `src/app.js`, `src/index.js` |

## Notes
- Hardcoded fallbacks exist (K5): EmailJS ids, Google client id, hosted API URL.
- `GOOGLE_CLIENT_ID` referenced only in `/api/health?details=1`.
- Template: `Server/.env.example`. Client has none yet.
