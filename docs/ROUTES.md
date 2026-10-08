# Routes

Guards: **RIA** = `RedirectIfAuthenticated`, **PR** = `ProtectedRoute(allowedRoles)`, **VRG** = `VendorRouteGuard` (inside page).
Status: ⏳ untested, ✅ ok, ⚠️ works with issues, ❌ broken.

| Path | Page | Guard / roles | Status | Notes |
|---|---|---|---|---|
| `/` | Start | RIA | ⏳ | |
| `/user/login` | Login role=user | RIA | ⏳ | |
| `/vendor/login` | Login role=vendor | RIA | ⏳ | admin logs in here |
| `/user/register` | Register role=user | RIA | ⏳ | |
| `/vendor/register` | Register role=vendor | RIA | ⏳ | |
| `/verify-otp` | VerifyOtp | none | ⏳ | |
| `/forgot-password` | ForgotPassword | none | ⏳ | |
| `/verify-reset-otp` | VerifyResetOtp | none | ⏳ | |
| `/reset-password` | ResetPassword | none | ⏳ | |
| `/vendor/dashboard` | VendorDashboard | PR vendor,admin + VRG | ⏳ | admin → admin-orders |
| `/vendor/orders` | VendorOrders | PR vendor,admin + VRG | ⏳ | |
| `/vendor/orders/:orderId` | VendorOrderDetail | PR vendor,admin + VRG | ⏳ | |
| `/vendor/admin-orders` | AdminOrders | PR admin + VRG | ⏳ | |
| `/vendor/medicine` | VendorMedicine | PR vendor,admin + VRG | ⏳ | |
| `/vendor/expiring-soon` | VendorExpiringSoon | PR vendor,admin + VRG | ⏳ | |
| `/vendor/reports` | VendorReports | PR vendor,admin + VRG | ⏳ | |
| `/vendor/settings` | VendorSettings | PR vendor,admin | ⏳ | no VRG |
| `/vendor/create-store` | CreateStore | PR vendor,admin | ⏳ | reads `localStorage.user` directly |
| `/user/dashboard` | UserDashboard | PR user,doctor | ⏳ | |
| `/user/shop` | UserShop | PR user,doctor | ⏳ | |
| `/user/cart` | UserCart | PR user,doctor | ⏳ | Stripe return `?checkout=` |
| `/user/notifications` | UserNotifications | PR user,doctor | ⏳ | |
| `/user/notifications/:id` | UserNotificationDetail | PR user,doctor | ⏳ | |
| `/user/health` | UserHealth | PR user,doctor | ⏳ | |
| `/user/health/scan-prescription` | UserHealthScanPrescription | PR user,doctor | ⏳ | Gemini |
| `/user/health/alternatives` | UserHealthAlternatives | PR user,doctor | ⏳ | |
| `/user/health/reminders` | UserHealthReminders | PR user,doctor | ⏳ | |
| `/user/health/reminders/manage` | UserHealthRemindersManage | PR user,doctor | ⏳ | |
| `/user/health/reminders/add` | UserHealthRemindersAddEdit | PR user,doctor | ⏳ | |
| `/user/health/reminders/edit/:id` | UserHealthRemindersAddEdit | PR user,doctor | ⏳ | |
| `/user/profile` | UserProfile | PR user,doctor | ⏳ | |
| `/user/orders` | UserOrders | PR user,doctor | ⏳ | |
| `/user/orders/:orderId` | UserOrderDetail | PR user,doctor | ⏳ | |
| `*` | → `/` | | ⏳ | |

## Server
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `?details=1` shows configured flags |
| POST | `/api/stripe/create-checkout-session` | header `X-User-Id`, body `cart_id, success_url, cancel_url` |
| POST | `/api/stripe/webhook` | raw body, Stripe signature |
