-- 014_drop_auth_sessions.sql
-- Stage A was cancelled; this table is not part of MedAssist.
-- Removes public.auth_sessions (created by the deleted 011_auth_sessions.sql). Safe to run again.

drop table if exists public.auth_sessions;
