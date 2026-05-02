-- Run once in Supabase Dashboard → SQL Editor (fixes: "Could not find the 'google_sub' column")
-- Safe to re-run: IF NOT EXISTS guards avoid errors.

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_role_idx
  ON users (google_sub, role)
  WHERE google_sub IS NOT NULL;
