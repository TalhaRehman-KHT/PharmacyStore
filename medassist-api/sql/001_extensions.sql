-- 001_extensions.sql
-- Enables pgvector. Supabase keeps extensions in the "extensions" schema.
-- Safe to run more than once.

create extension if not exists vector with schema extensions;
