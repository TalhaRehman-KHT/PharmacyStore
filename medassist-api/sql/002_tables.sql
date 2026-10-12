-- 002_tables.sql
-- MedAssist tables. Run after 001. Safe to run more than once (if not exists).
-- user_id columns point to public.users (the app's custom auth table, not Supabase auth.users),
-- so deleting a user deletes their chats.

-- One row per FDA drug label downloaded from openFDA.
create table if not exists public.drug_documents (
  id              uuid primary key default gen_random_uuid(),
  label_id        text not null unique,          -- openFDA "id" of the label
  generic_name    text not null,                 -- e.g. ibuprofen
  brand_names     text[] not null default '{}',  -- brand names listed on the label
  source_url      text,
  effective_date  date,
  created_at      timestamptz not null default now()
);

-- The retrieval units. One row per section, or per piece of a long section.
create table if not exists public.drug_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.drug_documents(id) on delete cascade,
  chunk_index  int  not null default 0,          -- 0,1,2... inside the same section
  section      text not null,                    -- e.g. drug_interactions
  drug_name    text not null,                    -- generic name, copied for fast filtering
  content      text not null,                    -- the text sent to the LLM
  embedding    extensions.vector(768),           -- filled by the ingestion script
  metadata     jsonb not null default '{}',
  -- Keyword search column. GENERATED = Postgres fills it automatically from the text.
  fts          tsvector generated always as (
                 to_tsvector('english', drug_name || ' ' || section || ' ' || content)
               ) stored,
  created_at   timestamptz not null default now(),
  unique (document_id, section, chunk_index)     -- makes re-ingestion idempotent
);

-- Local brand -> generic -> US name mapping (Panadol -> paracetamol -> acetaminophen).
create table if not exists public.drug_synonyms (
  id            uuid primary key default gen_random_uuid(),
  brand_name    text not null,
  generic_name  text not null,
  us_name       text not null,
  source        text not null default 'manual',  -- manual | product_table
  created_at    timestamptz not null default now(),
  unique (brand_name, generic_name)
);

-- One conversation.
create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Every turn, plus the fields needed for the research evaluation.
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.chat_sessions(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'pharmacist')),
  content     text not null,
  route       text check (route in ('knowledge','product','both','out_of_scope',
                                    'emergency','escalated','no_evidence')),
  citations   jsonb not null default '[]',
  products    jsonb not null default '[]',
  variant     text check (variant in ('naive','rewrite','agent')),
  latency_ms  int,
  tokens      int,
  created_at  timestamptz not null default now()
);

-- Pharmacist queue.
create table if not exists public.escalations (
  id             uuid primary key default gen_random_uuid(),
  message_id     uuid not null references public.chat_messages(id) on delete cascade,
  session_id     uuid not null references public.chat_sessions(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  question       text not null,
  reason         text not null check (reason in ('personal_dosing','prescription_only',
                                                 'pregnancy_or_child','no_evidence')),
  chunk_ids      uuid[] not null default '{}',
  status         text not null default 'pending' check (status in ('pending','answered')),
  pharmacist_id  uuid references public.users(id) on delete set null,
  reply          text,
  answered_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- Thumbs up / down on an assistant message. One vote per user per message.
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.chat_messages(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  rating      smallint not null check (rating in (1, -1)),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (message_id, user_id)
);

-- Keep chat_sessions.updated_at fresh whenever a message is added.
create or replace function public.touch_chat_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.chat_sessions set updated_at = now() where id = new.session_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_session on public.chat_messages;
create trigger trg_touch_chat_session
  after insert on public.chat_messages
  for each row execute function public.touch_chat_session();

-- Repoint user foreign keys to public.users for databases created by an older version of this
-- file (which referenced auth.users). Drop-then-add keeps it safe to run again.
-- Fails if a table already has rows whose user_id is not in public.users; delete those first.
alter table public.chat_sessions drop constraint if exists chat_sessions_user_id_fkey;
alter table public.chat_sessions add constraint chat_sessions_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.chat_messages drop constraint if exists chat_messages_user_id_fkey;
alter table public.chat_messages add constraint chat_messages_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.escalations drop constraint if exists escalations_user_id_fkey;
alter table public.escalations add constraint escalations_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.escalations drop constraint if exists escalations_pharmacist_id_fkey;
alter table public.escalations add constraint escalations_pharmacist_id_fkey
  foreign key (pharmacist_id) references public.users(id) on delete set null;

alter table public.feedback drop constraint if exists feedback_user_id_fkey;
alter table public.feedback add constraint feedback_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;
