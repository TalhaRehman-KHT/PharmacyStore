-- Run in Supabase SQL editor after orders_stripe_admin_payment.sql (if you use those columns).
-- Replaces legacy orders.status with:
--   payment_status: Stripe outcome — unpaid | paid | failed | refunded
--   fulfillment_status: vendor delivery — pending | on_the_way | delivered | cancelled
--   admin_payment_status: (existing) NULL | pending | approved | rejected
-- Cart is cleared in the Stripe webhook after payment (already in server code).

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'status'
  ) THEN
    EXECUTE $mig$
      UPDATE public.orders SET
        payment_status = CASE WHEN status::text IN ('paid', 'completed') THEN 'paid' ELSE 'unpaid' END,
        fulfillment_status = CASE
          WHEN status::text = 'completed' THEN 'delivered'
          WHEN status::text = 'cancelled' THEN 'cancelled'
          ELSE 'pending'
        END
    $mig$;
  END IF;
END $$;

UPDATE public.orders SET payment_status = COALESCE(payment_status, 'unpaid');
UPDATE public.orders SET fulfillment_status = COALESCE(fulfillment_status, 'pending');

ALTER TABLE public.orders ALTER COLUMN payment_status SET DEFAULT 'unpaid';
ALTER TABLE public.orders ALTER COLUMN fulfillment_status SET DEFAULT 'pending';
ALTER TABLE public.orders ALTER COLUMN payment_status SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN fulfillment_status SET NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'failed'::text, 'refunded'::text]));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_status_check
  CHECK (fulfillment_status = ANY (ARRAY['pending'::text, 'on_the_way'::text, 'delivered'::text, 'cancelled'::text]));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders DROP COLUMN IF EXISTS status;
