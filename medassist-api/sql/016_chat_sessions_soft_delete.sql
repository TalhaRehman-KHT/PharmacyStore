-- 016_chat_sessions_soft_delete.sql
-- "Clear history" now hides sessions instead of deleting them (PR-10, bugs B1 + B2):
--   B1: the per-user rate limit counts chat_messages; a hard delete reset it.
--   B2: escalations cascade from chat_sessions; a hard delete removed pending pharmacist questions.
-- The API sets deleted_at = now(); lists and reads skip rows where deleted_at is not null.
-- Adds one nullable column only: no data changes. Safe to run more than once.
alter table public.chat_sessions
  add column if not exists deleted_at timestamptz;
