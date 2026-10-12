-- 003_indexes.sql
-- Indexes make search and history fast. Run after 002. Safe to run more than once.

-- Vector search: HNSW graph index for approximate nearest neighbours by cosine distance.
-- vector_cosine_ops must match the operator used in queries: <=> (cosine distance).
create index if not exists drug_chunks_embedding_hnsw
  on public.drug_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- Keyword search: GIN index over the generated tsvector column.
create index if not exists drug_chunks_fts_gin
  on public.drug_chunks using gin (fts);

-- Filters used by the agent ("only ibuprofen", "only the interactions section").
create index if not exists drug_chunks_drug_name_idx on public.drug_chunks (drug_name);
create index if not exists drug_chunks_section_idx   on public.drug_chunks (section);

-- Brand lookup is case-insensitive ("panadol" = "Panadol").
create index if not exists drug_synonyms_brand_lower_idx
  on public.drug_synonyms (lower(brand_name));

-- Chat history screens.
create index if not exists chat_sessions_user_updated_idx
  on public.chat_sessions (user_id, updated_at desc);
create index if not exists chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at);

-- Pharmacist queue: pending first, newest first.
create index if not exists escalations_status_created_idx
  on public.escalations (status, created_at desc);
create index if not exists escalations_user_idx on public.escalations (user_id);
