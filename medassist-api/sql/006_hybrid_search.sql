-- 006_hybrid_search.sql
-- Hybrid search over drug_chunks: vector search (meaning) + keyword search (exact words),
-- merged with Reciprocal Rank Fusion (RRF, k = 60). Run after 002/003. Safe to run again.
-- Why it works this way: notes/hybrid_search.md.
--
-- Called by the backend only (app/rag/search.py, service role) through the hybrid_search RPC.
-- An empty query_text gives no keyword hits, so the function is then pure vector search
-- (used to compare "vector only" with "hybrid" in R19).

create or replace function public.hybrid_search(
  query_embedding extensions.vector(768),
  query_text      text,
  match_count     int  default 20,
  drug_filter     text default null
)
returns table (
  chunk_id     uuid,
  content      text,
  drug_name    text,
  section      text,
  vector_rank  int,
  keyword_rank int,
  rrf_score    float
)
language sql
stable
set search_path = public, extensions
as $$
  -- v = the 20 chunks whose MEANING is closest to the question.
  -- "<=>" is cosine distance (0 = same direction), so ascending order = most similar first.
  -- rank 1 = best match. Optional drug_filter keeps only one drug's chunks.
  with v as (
    select c.id,
           row_number() over (order by c.embedding <=> query_embedding) as rank
    from drug_chunks c
    where c.embedding is not null
      and (drug_filter is null or c.drug_name = drug_filter)
    order by c.embedding <=> query_embedding
    limit 20
  ),
  -- k = the 20 chunks that contain the question's WORDS (Postgres full-text search on fts).
  -- websearch_to_tsquery understands normal typing ("warfarin bleeding", "-alcohol", "quotes").
  -- ts_rank scores how well a chunk matches; higher = better, so rank 1 = best.
  -- An empty query_text matches nothing here.
  k as (
    select c.id,
           row_number() over (
             order by ts_rank(c.fts, websearch_to_tsquery('english', query_text)) desc
           ) as rank
    from drug_chunks c
    where c.fts @@ websearch_to_tsquery('english', query_text)
      and (drug_filter is null or c.drug_name = drug_filter)
    order by ts_rank(c.fts, websearch_to_tsquery('english', query_text)) desc
    limit 20
  ),
  -- fused = every chunk found by v, by k, or by both (full outer join).
  -- RRF: each list gives 1 / (60 + rank); a list that did not find the chunk gives 0.
  -- A chunk found by BOTH lists gets two shares, so it rises to the top.
  fused as (
    select coalesce(v.id, k.id) as id,
           v.rank as vector_rank,
           k.rank as keyword_rank,
           coalesce(1.0 / (60 + v.rank), 0) + coalesce(1.0 / (60 + k.rank), 0) as rrf_score
    from v
    full outer join k on k.id = v.id
  )
  -- Join back to drug_chunks for the text the answer needs; best fused score first.
  select f.id,
         c.content,
         c.drug_name,
         c.section,
         f.vector_rank::int,
         f.keyword_rank::int,
         f.rrf_score::float
  from fused f
  join drug_chunks c on c.id = f.id
  order by f.rrf_score desc
  limit match_count;
$$;

-- Backend only: the browser's anon key must not be able to call it.
revoke all on function public.hybrid_search(extensions.vector, text, int, text) from public, anon, authenticated;
grant execute on function public.hybrid_search(extensions.vector, text, int, text) to service_role;
