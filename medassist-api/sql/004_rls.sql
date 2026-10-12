-- 004_rls.sql
-- Row Level Security. Run after 002.
--
-- How access works:
--   * The FastAPI backend uses the SERVICE ROLE key, which bypasses RLS. It does all writes.
--   * Drug tables have RLS ON and NO policies = nobody but the backend can touch them.
--   * Users live in public.users (custom auth, not Supabase Auth). auth.uid() is the `sub` claim
--     of a JWT signed with the project's JWT secret, so these policies only apply once the app
--     issues such tokens (sub = public.users.id). Until then the browser has only the anon key,
--     the "to authenticated" policies never match, and MedAssist tables are backend-only.

-- Helper: is the current user a pharmacist? (app roles vendor/admin; "pharmacist" kept for later)
-- SECURITY DEFINER lets it read public.users even when users has its own RLS.
create or replace function public.is_pharmacist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('pharmacist', 'vendor', 'admin')
      and coalesce(u.is_active, true)
  );
$$;

alter table public.drug_documents enable row level security;
alter table public.drug_chunks    enable row level security;
alter table public.drug_synonyms  enable row level security;
alter table public.chat_sessions  enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.escalations    enable row level security;
alter table public.feedback       enable row level security;

-- chat_sessions: a user sees and deletes only their own sessions.
drop policy if exists "own sessions select" on public.chat_sessions;
create policy "own sessions select" on public.chat_sessions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own sessions delete" on public.chat_sessions;
create policy "own sessions delete" on public.chat_sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- chat_messages: a user reads their own messages; a pharmacist reads messages of escalated chats.
drop policy if exists "own messages select" on public.chat_messages;
create policy "own messages select" on public.chat_messages
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select public.is_pharmacist())
      and exists (
        select 1 from public.escalations e where e.session_id = chat_messages.session_id
      )
    )
  );

-- escalations: the customer sees the status of their own; pharmacists see and answer all.
drop policy if exists "escalations select" on public.escalations;
create policy "escalations select" on public.escalations
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_pharmacist()));

drop policy if exists "escalations pharmacist update" on public.escalations;
create policy "escalations pharmacist update" on public.escalations
  for update to authenticated
  using ((select public.is_pharmacist()))
  with check ((select public.is_pharmacist()));

-- feedback: a user reads and writes only their own votes.
drop policy if exists "own feedback select" on public.feedback;
create policy "own feedback select" on public.feedback
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own feedback insert" on public.feedback;
create policy "own feedback insert" on public.feedback
  for insert to authenticated with check (user_id = (select auth.uid()));
