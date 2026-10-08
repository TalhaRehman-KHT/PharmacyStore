# Structure

```
PharmacyStore/
├─ Client/               React SPA (Vite)
│  ├─ src/api/           axios.js (API base URL, X-User-Id header)
│  ├─ src/components/    guards + layouts
│  ├─ src/context/       Auth, VendorDashboard, UserNotifications
│  ├─ src/lib/           all Supabase/3rd-party service calls
│  ├─ src/pages/         Register/, Dashboard/ (vendor+admin), User/, StartPage/
│  └─ *.sql              legacy partial SQL (see supabase/)
├─ Server/               Express API
│  ├─ src/               app.js, index.js, stripeClient.js, supabaseAdmin.js
│  ├─ src/routes/        createCheckoutSession.js, stripeWebhook.js
│  └─ api/index.js       Vercel entry
├─ supabase/schema.sql   live schema (reconstructed)
└─ docs/                 these docs
```

## Key files
| File | Purpose |
|---|---|
| `Client/src/App.jsx` | all routes + guards |
| `Client/src/components/ProtectedRoute.jsx` | login + role guard, `getRoleHome` |
| `Client/src/components/VendorRouteGuard.jsx` | vendor must have pharmacy; admin → admin-orders |
| `Client/src/components/RedirectIfAuthenticated.jsx` | bounce logged-in users from login/start |
| `Client/src/lib/authService.js` | signup, login, Google, OTP, reset, localStorage session |
| `Client/src/lib/passwordService.js` | salt+SHA-256 hashing |
| `Client/src/lib/emailService.js` | EmailJS OTP send |
| `Client/src/lib/geminiService.js` | Gemini OCR (labels, prescriptions) |
| `Client/src/lib/userCartService.js` | carts / cart_items |
| `Client/src/lib/stripeCheckoutService.js` | calls server checkout |
| `Client/src/lib/vendor*Service.js` | pharmacy, medicines, batches, orders, reports, storage |
| `Client/src/lib/prescriptionService.js` | prescription upload + reminders from OCR |
| `Client/src/lib/reminderService.js` | reminders + reminder_times CRUD |
| `Client/src/lib/userAlertService.js` | alerts |
| `Client/src/lib/adminOrderService.js` | admin approve/reject payment |
| `Server/src/app.js` | middleware, CORS, routes, health |
| `Server/src/routes/createCheckoutSession.js` | cart → order → Stripe session |
| `Server/src/routes/stripeWebhook.js` | paid → stock −, cart clear |
