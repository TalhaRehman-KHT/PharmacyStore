-- 011_auth_sessions.sql
-- Server-side login sessions for PharmacyStore (Node). One row per logged-in device.
-- The refresh token itself is NEVER stored: only its SHA-256 hash. The browser keeps the raw token
-- in an httpOnly cookie, so JavaScript (and XSS) cannot read it.
--
-- Rotation: every /api/auth/refresh revokes the old row and creates a new one (replaced_by points to it).
-- If an already-revoked token is used again, someone copied it: revoke ALL sessions of that user.
--
-- Only the Node server (service role key) touches this table. RLS on + no policies + no grants
-- means the public anon key can never read it. Safe to run again.

create table if not exists public.auth_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  token_hash    text not null unique,                 -- sha256(refresh token), hex
  user_agent    text,
  ip            text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  replaced_by   uuid references public.auth_sessions(id) on delete set null
);

create index if not exists auth_sessions_user_idx on public.auth_sessions (user_id);
create index if not exists auth_sessions_active_idx
  on public.auth_sessions (user_id) where revoked_at is null;

alter table public.auth_sessions enable row level security;
revoke all on table public.auth_sessions from anon, authenticated;

-- Housekeeping you can run any time (deletes sessions that expired more than 30 days ago):
-- delete from public.auth_sessions where expires_at < now() - interval '30 days';
