-- Custom auth tables (same as my_fyp/custom_auth_migration.sql).
-- Run this in Supabase SQL Editor if you haven't run my_fyp's migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'vendor', 'admin', 'doctor')),
  company_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Allow same email across roles (customer vs vendor), but not within the same role.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_role_key ON users (email, role);

CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  otp_type TEXT NOT NULL CHECK (otp_type IN ('email_verification', 'phone_verification', 'password_reset')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow user signup" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow user signup" ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow OTP operations" ON otps;
CREATE POLICY "Allow OTP operations" ON otps FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS otps_email_idx ON otps(email);
CREATE INDEX IF NOT EXISTS otps_user_id_idx ON otps(user_id);

-- Login: verify password (same hash as client: salt:hex) and return user without password_hash.
CREATE OR REPLACE FUNCTION login_user(user_email text, user_password text)
RETURNS TABLE (
  id uuid, email text, name text, phone text, role text,
  company_name text, address text, city text, state text,
  email_verified boolean, phone_verified boolean, is_active boolean,
  created_at timestamptz, updated_at timestamptz, last_login timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  stored text;
  salt_part text;
  stored_hash text;
  computed_hex text;
BEGIN
  SELECT password_hash INTO stored
  FROM users
  WHERE users.email = lower(trim(user_email)) AND users.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid email or password.';
  END IF;

  salt_part := split_part(stored, ':', 1);
  stored_hash := split_part(stored, ':', 2);
  computed_hex := encode(digest(user_password || salt_part, 'sha256'), 'hex');

  IF computed_hex != stored_hash THEN
    RAISE EXCEPTION 'Invalid email or password.';
  END IF;

  UPDATE users SET last_login = NOW() WHERE users.email = lower(trim(user_email));

  RETURN QUERY
  SELECT u.id, u.email, u.name, u.phone, u.role, u.company_name, u.address, u.city, u.state,
         u.email_verified, u.phone_verified, u.is_active, u.created_at, u.updated_at, u.last_login
  FROM users u
  WHERE u.email = lower(trim(user_email));
END;
$$;
