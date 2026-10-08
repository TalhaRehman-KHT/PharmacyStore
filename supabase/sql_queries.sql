-- =====================================================================
-- PharmacyStore — full database schema (Supabase / Postgres)
-- Rebuilds every table, constraint, index, RLS policy and the storage
-- bucket the app uses. Verified against the live schema on 2026-10-08.
--
-- How to use: Supabase Dashboard → SQL Editor → paste this file → Run.
-- Safe to re-run: IF NOT EXISTS everywhere, policies are dropped and
-- recreated. It never deletes data.
--
-- SECURITY WARNING (critical, known issue K4): RLS policies below are
-- permissive (USING true) because the browser talks to these tables
-- directly with the anon key. Anyone with that key can read/write every
-- table, including users.password_hash and otps. Do not go to production
-- until auth moves to the Server and these policies are replaced.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Auth (custom, not Supabase Auth)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL,
  password_hash  TEXT,                       -- "salt:sha256hex"; NULL for Google-only accounts
  name           TEXT NOT NULL,
  phone          TEXT,
  role           TEXT NOT NULL CHECK (role IN ('user', 'vendor', 'admin', 'doctor')),
  company_name   TEXT,
  address        TEXT,
  city           TEXT,
  state          TEXT,
  google_sub     TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  last_login     TIMESTAMPTZ
);
-- Same email may exist once per role (customer + vendor accounts).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_role_key ON public.users (email, role);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_role_idx ON public.users (google_sub, role) WHERE google_sub IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

CREATE TABLE IF NOT EXISTS public.otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  otp_code   TEXT NOT NULL,
  otp_type   TEXT NOT NULL CHECK (otp_type IN ('email_verification', 'phone_verification', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  is_used    BOOLEAN DEFAULT FALSE,
  attempts   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS otps_email_idx ON public.otps (email);
CREATE INDEX IF NOT EXISTS otps_user_id_idx ON public.otps (user_id);

-- ---------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  license_number TEXT NOT NULL,
  address        TEXT NOT NULL,
  city           TEXT NOT NULL,
  phone          TEXT,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pharmacies_vendor_id_idx ON public.pharmacies (vendor_id);
-- One active pharmacy per vendor.
CREATE UNIQUE INDEX IF NOT EXISTS pharmacies_one_active_per_vendor ON public.pharmacies (vendor_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.medicines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  generic_name TEXT,
  strength     TEXT,
  dosage_form  TEXT,
  manufacturer TEXT,
  description  TEXT,
  image_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.medicine_batches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id    UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  medicine_id    UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  batch_number   TEXT NOT NULL,
  expiry_date    DATE NOT NULL,
  purchase_price NUMERIC(12, 2),
  selling_price  NUMERIC(12, 2),
  quantity       INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS medicine_batches_pharmacy_id_idx ON public.medicine_batches (pharmacy_id);
CREATE INDEX IF NOT EXISTS medicine_batches_medicine_id_idx ON public.medicine_batches (medicine_id);

CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id   UUID REFERENCES public.medicine_batches(id),
  type       TEXT NOT NULL,                  -- 'IN' | 'OUT'
  quantity   INTEGER NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Cart (one cart per user per pharmacy)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID NOT NULL REFERENCES public.carts(id),
  batch_id    UUID NOT NULL REFERENCES public.medicine_batches(id),
  medicine_id UUID REFERENCES public.medicines(id),
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Orders (created by Server checkout, paid via Stripe webhook)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  pharmacy_id                UUID REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  total_amount               NUMERIC(12, 2),
  payment_status             TEXT NOT NULL DEFAULT 'unpaid'
    CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  fulfillment_status         TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT orders_fulfillment_status_check CHECK (fulfillment_status IN ('pending', 'on_the_way', 'delivered', 'cancelled')),
  admin_payment_status       TEXT
    CONSTRAINT orders_admin_payment_status_check CHECK (admin_payment_status IS NULL OR admin_payment_status IN ('pending', 'approved', 'rejected')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id   TEXT,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_pharmacy_id_idx ON public.orders (pharmacy_id);
CREATE INDEX IF NOT EXISTS orders_stripe_checkout_session_id_idx ON public.orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  batch_id    UUID REFERENCES public.medicine_batches(id) ON DELETE SET NULL,
  medicine_id UUID REFERENCES public.medicines(id) ON DELETE SET NULL,
  quantity    INTEGER NOT NULL,
  unit_price  NUMERIC(12, 2) NOT NULL,
  total_price NUMERIC(12, 2)
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

-- ---------------------------------------------------------------------
-- Health: prescriptions, reminders, alerts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id),
  image_url         TEXT NOT NULL,
  ai_extracted_text TEXT DEFAULT '',
  ai_summary        TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id),
  prescription_id UUID REFERENCES public.prescriptions(id),
  medicine_name   TEXT NOT NULL,
  dosage          TEXT,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reminder_times (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id   UUID NOT NULL REFERENCES public.reminders(id),
  schedule_time TIME NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.users(id),
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  type        TEXT NOT NULL DEFAULT 'GENERAL',
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Row Level Security: enable on all tables, one permissive policy each
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'otps', 'pharmacies', 'medicines', 'medicine_batches', 'stock_transactions',
                           'carts', 'cart_items', 'orders', 'order_items', 'prescriptions', 'reminders',
                           'reminder_times', 'alerts']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'Allow all ' || t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Storage: public bucket for medicine images and prescriptions
-- WARNING: anyone with the anon key can upload/overwrite/delete here, and
-- prescription images are publicly readable. Matches the current app
-- (browser uploads with the anon key; no auth.uid() without Supabase Auth).
-- Fix later: private bucket + server-side uploads or signed URLs.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('DatabaseAssets', 'DatabaseAssets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "DatabaseAssets read" ON storage.objects;
DROP POLICY IF EXISTS "DatabaseAssets write" ON storage.objects;
DROP POLICY IF EXISTS "DatabaseAssets update" ON storage.objects;
DROP POLICY IF EXISTS "DatabaseAssets delete" ON storage.objects;
CREATE POLICY "DatabaseAssets read" ON storage.objects FOR SELECT USING (bucket_id = 'DatabaseAssets');
CREATE POLICY "DatabaseAssets write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'DatabaseAssets');
CREATE POLICY "DatabaseAssets update" ON storage.objects FOR UPDATE USING (bucket_id = 'DatabaseAssets');
CREATE POLICY "DatabaseAssets delete" ON storage.objects FOR DELETE USING (bucket_id = 'DatabaseAssets');
