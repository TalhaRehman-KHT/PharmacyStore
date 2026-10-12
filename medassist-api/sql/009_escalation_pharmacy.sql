-- 009_escalation_pharmacy.sql
-- Which pharmacy an escalation belongs to (the pharmacy the customer was shopping at, when
-- known). NULL = no pharmacy context. Used to scope the queue per vendor in Step 3.4.
-- Run after 002. Safe to run again.

alter table public.escalations
  add column if not exists pharmacy_id uuid references public.pharmacies(id) on delete set null;

create index if not exists escalations_pharmacy_status_idx
  on public.escalations (pharmacy_id, status, created_at desc);
