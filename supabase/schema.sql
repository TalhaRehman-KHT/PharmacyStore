-- PharmacyStore schema (reference).
-- Reconstructed 2026-10-08 from: live PostgREST schema (columns, defaults, FKs) + Client/*.sql (checks, indexes, policies).
-- Tables marked [inferred] had no DDL in repo: CHECK constraints / indexes / ON DELETE rules may differ from live.
-- Do NOT run against the live project; use supabase/migrations/ for changes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== Auth =====
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'vendor', 'admin', 'doctor')),
  company_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  google_sub TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_role_key ON users (email, role);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_role_idx ON users (google_sub, role) WHERE google_sub IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  otp_type TEXT NOT NULL CHECK (otp_type IN ('email_verification', 'phone_verification', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS otps_email_idx ON otps (email);
CREATE INDEX IF NOT EXISTS otps_user_id_idx ON otps (user_id);

-- ===== Catalog =====
CREATE TABLE IF NOT EXISTS pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  license_number TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pharmacies_vendor_id_idx ON pharmacies (vendor_id);

CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  generic_name TEXT,
  strength TEXT,
  dosage_form TEXT,
  manufacturer TEXT,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  purchase_price NUMERIC(12, 2),
  selling_price NUMERIC(12, 2),
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS medicine_batches_pharmacy_id_idx ON medicine_batches (pharmacy_id);
CREATE INDEX IF NOT EXISTS medicine_batches_medicine_id_idx ON medicine_batches (medicine_id);

-- [inferred]
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES medicine_batches(id),
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Cart (one cart per user per pharmacy) [inferred] =====
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id),
  batch_id UUID NOT NULL REFERENCES medicine_batches(id),
  medicine_id UUID REFERENCES medicines(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Orders =====
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
  total_amount NUMERIC(12, 2),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'on_the_way', 'delivered', 'cancelled')),
  admin_payment_status TEXT
    CHECK (admin_payment_status IS NULL OR admin_payment_status IN ('pending', 'approved', 'rejected')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_pharmacy_id_idx ON orders (pharmacy_id);
CREATE INDEX IF NOT EXISTS orders_stripe_checkout_session_id_idx ON orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES medicine_batches(id) ON DELETE SET NULL,
  medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  total_price NUMERIC(12, 2)
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

-- ===== Health [inferred] =====
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  image_url TEXT NOT NULL,
  ai_extracted_text TEXT DEFAULT '',
  ai_summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  prescription_id UUID REFERENCES prescriptions(id),
  medicine_name TEXT NOT NULL,
  dosage TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminder_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES reminders(id),
  schedule_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  pharmacy_id UUID REFERENCES pharmacies(id),
  type TEXT NOT NULL DEFAULT 'GENERAL',
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== RLS (current: permissive on all tables — see docs/BUGS.md K4) =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','otps','pharmacies','medicines','medicine_batches','stock_transactions',
    'carts','cart_items','orders','order_items','prescriptions','reminders','reminder_times','alerts']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
-- Policies: USING (true) WITH CHECK (true) per table (exact names in Client/supabase_*.sql).

-- ===== RPC =====
-- login_user(user_email text, user_password text): SECURITY DEFINER password check.
-- Full body: Client/supabase_custom_auth.sql.

-- ===== Storage =====
-- Bucket: DatabaseAssets (medicine images, prescription images).
