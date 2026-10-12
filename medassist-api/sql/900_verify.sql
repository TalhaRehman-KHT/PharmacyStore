-- 900_verify.sql
-- Read-only checks. Run after 001-005 and read the results.

-- 1. pgvector installed?
select extname, extversion from pg_extension where extname = 'vector';

-- 2. All 7 tables exist?
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('drug_documents','drug_chunks','drug_synonyms','chat_sessions',
                     'chat_messages','escalations','feedback')
order by table_name;

-- 3. Embedding column is vector(768) and fts is generated?
select column_name, udt_name, is_generated
from information_schema.columns
where table_schema = 'public' and table_name = 'drug_chunks'
  and column_name in ('embedding', 'fts');

-- 4. Indexes present (expect hnsw and gin among them)?
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'drug_chunks';

-- 5. RLS on for every MedAssist table (all should be true)?
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('drug_documents','drug_chunks','drug_synonyms','chat_sessions',
                  'chat_messages','escalations','feedback');

-- 6. Synonyms seeded?
select count(*) as synonyms from public.drug_synonyms;

-- 7. answer_escalation (008) exists and the browser roles cannot call it (expect t, f, f)?
select to_regprocedure('public.answer_escalation(uuid,uuid,text)') is not null as fn_exists,
       has_function_privilege('anon', 'public.answer_escalation(uuid,uuid,text)', 'execute')
         as anon_can_call,
       has_function_privilege('authenticated', 'public.answer_escalation(uuid,uuid,text)',
                              'execute') as authenticated_can_call;

-- 8. escalations.pharmacy_id (009) exists?
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'escalations' and column_name = 'pharmacy_id';
