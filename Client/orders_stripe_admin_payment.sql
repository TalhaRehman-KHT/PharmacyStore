-- Run in Supabase SQL editor (additive). Stripe Checkout + admin confirmation before vendor treats payout as final.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- NULL = customer has not completed checkout yet. After successful Stripe payment, webhook sets 'pending' until an admin approves.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS admin_payment_status text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_admin_payment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_admin_payment_status_check CHECK (
    admin_payment_status IS NULL
    OR admin_payment_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])
  );

CREATE INDEX IF NOT EXISTS orders_stripe_checkout_session_id_idx
  ON public.orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
