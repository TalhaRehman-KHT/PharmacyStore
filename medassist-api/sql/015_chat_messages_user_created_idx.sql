-- 015_chat_messages_user_created_idx.sql
-- Per-user rate limit (app/rate_limit.py) counts a user's questions of the last hour:
--   where user_id = $1 and role = 'user' and created_at >= $2 order by created_at desc limit 20
-- This partial index (only question rows) answers that from the index alone.
-- Adds an index only: no data changes. Safe to run more than once.
create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc)
  where role = 'user';
