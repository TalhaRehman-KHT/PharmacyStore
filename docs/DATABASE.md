# Database (Supabase)

Source: live REST schema (2026-10-08). DDL: `supabase/schema.sql`. All PKs `id uuid`. RLS on, all policies permissive (K4).

| Table | Key columns | FKs | Used by |
|---|---|---|---|
| users | email, password_hash, role, google_sub, email_verified, is_active | — | authService |
| otps | email, otp_code, otp_type, expires_at, is_used, attempts | user_id→users | authService |
| pharmacies | vendor_id, name, license_number, city | vendor_id→users | vendorPharmacyService |
| medicines | name, generic_name, strength, image_url | — | vendorMedicineService |
| medicine_batches | batch_number, expiry_date, selling_price, quantity | pharmacy_id, medicine_id | vendorMedicineService, userShopService, Server |
| carts | user_id, pharmacy_id (one cart per pharmacy) | users, pharmacies | userCartService, Server |
| cart_items | quantity, unit_price | cart_id, batch_id, medicine_id | userCartService, Server webhook |
| orders | total_amount, payment_status, fulfillment_status, admin_payment_status, stripe_* | user_id, pharmacy_id | user/vendor/adminOrderService, vendorReportService, Server |
| order_items | quantity, unit_price, total_price | order_id, batch_id, medicine_id | userOrderService, vendorReportService, Server |
| stock_transactions | type, quantity, reason | batch_id | Server webhook |
| prescriptions | image_url, ai_extracted_text, ai_summary | user_id | prescriptionService, customerStatsService |
| reminders | medicine_name, dosage, start/end_date, is_active | user_id, prescription_id | reminderService, prescriptionService |
| reminder_times | schedule_time | reminder_id | reminderService, prescriptionService |
| alerts | type, message, is_read, meta | user_id, pharmacy_id | userAlertService |

## Enums (CHECK)
| Column | Values |
|---|---|
| users.role | user, vendor, admin, doctor |
| otps.otp_type | email_verification, phone_verification, password_reset |
| orders.payment_status | unpaid, paid, failed, refunded |
| orders.fulfillment_status | pending, on_the_way, delivered, cancelled |
| orders.admin_payment_status | NULL, pending, approved, rejected |

## Other
- Unique `(email, role)` on users → same email can be user + vendor.
- RPC `login_user(email, password)` SECURITY DEFINER exists (unused by client; filters email only, not role).
- Storage bucket: `DatabaseAssets` (medicine images, prescriptions).
