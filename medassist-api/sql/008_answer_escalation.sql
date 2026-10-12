-- 008_answer_escalation.sql
-- Answer a pending escalation atomically. Run after 002. Safe to run again.
--
-- Matches the LIVE function (see sql/schema/40_functions.sql). Parameter names are part of the
-- API: the backend calls it by name (p_id, p_pharmacist, p_reply), and Postgres cannot rename
-- parameters with "create or replace".
--
-- Marks the escalation answered and adds the reply to the customer's chat as a 'pharmacist'
-- message, in one transaction. Returns the escalation id, or NULL when no pending escalation
-- has that id (already answered, or missing), so two pharmacists cannot both answer it.
-- Only the backend (service role) may call it: the browser's anon key could otherwise pass any
-- pharmacist id.

create or replace function public.answer_escalation(
  p_id         uuid,
  p_pharmacist uuid,
  p_reply      text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id      uuid;
  v_session uuid;
  v_owner   uuid;
begin
  if p_reply is null or length(trim(p_reply)) = 0 then
    raise exception 'reply must not be empty';
  end if;

  -- the "and status = 'pending'" makes two pharmacists answering at once safe: only one wins
  update public.escalations
     set status = 'answered', reply = p_reply, pharmacist_id = p_pharmacist, answered_at = now()
   where id = p_id and status = 'pending'
  returning id, session_id, user_id into v_id, v_session, v_owner;

  if v_id is null then
    return null;
  end if;

  -- the pharmacist's message belongs to the session OWNER (user_id); who answered is in escalations.pharmacist_id
  insert into public.chat_messages (session_id, user_id, role, content)
  values (v_session, v_owner, 'pharmacist', p_reply);

  return v_id;
end;
$$;

revoke all on function public.answer_escalation(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.answer_escalation(uuid, uuid, text) to service_role;
