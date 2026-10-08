-- B4: enforce one active pharmacy per vendor at the DB level.
-- Additive, non-destructive. Fails if duplicates already exist; check first:
--   SELECT vendor_id, count(*) FROM pharmacies WHERE is_active GROUP BY vendor_id HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS pharmacies_one_active_per_vendor
  ON public.pharmacies (vendor_id)
  WHERE is_active;
