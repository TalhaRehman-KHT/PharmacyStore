-- 999_drop_medassist.sql
-- DANGER: deletes ALL MedAssist tables and their data. Your shop tables are not touched.
-- Use only to rebuild from scratch, then run 001 -> 005 again.

drop table if exists public.feedback        cascade;
drop table if exists public.escalations     cascade;
drop table if exists public.chat_messages   cascade;
drop table if exists public.chat_sessions   cascade;
drop table if exists public.drug_chunks     cascade;
drop table if exists public.drug_documents  cascade;
drop table if exists public.drug_synonyms   cascade;
drop function if exists public.touch_chat_session();
drop function if exists public.is_pharmacist();
drop function if exists public.answer_escalation(uuid, uuid, text);
drop function if exists public.hybrid_search(extensions.vector, text, int, text);
