import { requireStripe } from "../stripeClient.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";

async function clearCart(cartId) {
  await getSupabaseAdmin().from("cart_items").delete().eq("cart_id", cartId);
  await getSupabaseAdmin()
    .from("carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);
}

async function applyStockDeductions(orderId) {
  const { data: lines, error } = await getSupabaseAdmin()
    .from("order_items")
    .select("id, batch_id, quantity")
    .eq("order_id", orderId);

  if (error) throw error;

  for (const line of lines || []) {
    const qty = Number(line.quantity) || 0;
    if (qty < 1) continue;

    const { data: batch, error: bErr } = await getSupabaseAdmin()
      .from("medicine_batches")
      .select("quantity")
      .eq("id", line.batch_id)
      .single();

    if (bErr) throw bErr;
    const current = Number(batch?.quantity) || 0;
    const next = current - qty;
    if (next < 0) {
      throw new Error(`Insufficient stock for batch ${line.batch_id}`);
    }

    const { error: uErr } = await getSupabaseAdmin()
      .from("medicine_batches")
      .update({ quantity: next })
      .eq("id", line.batch_id);

    if (uErr) throw uErr;

    await getSupabaseAdmin().from("stock_transactions").insert({
      batch_id: line.batch_id,
      type: "OUT",
      quantity: qty,
      reason: `Order ${orderId}`,
    });
  }
}

/**
 * POST /api/stripe/webhook — raw body required (see index.js)
 */
export async function stripeWebhookHandler(req, res) {
  const stripe = requireStripe();
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).send("Webhook not configured");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id || session.client_reference_id;
    const cartId = session.metadata?.cart_id;
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!orderId) {
      console.error("checkout.session.completed missing order_id metadata");
      return res.json({ received: true });
    }

    try {
      const { data: order, error: oErr } = await getSupabaseAdmin()
        .from("orders")
        .select("id, payment_status, stripe_payment_intent_id")
        .eq("id", orderId)
        .single();

      if (oErr || !order) {
        console.error("Order not found for webhook", orderId, oErr);
        return res.json({ received: true });
      }

      if ((order.payment_status || "").toLowerCase() === "paid") {
        return res.json({ received: true });
      }

      await applyStockDeductions(orderId);

      const { error: upErr } = await getSupabaseAdmin()
        .from("orders")
        .update({
          payment_status: "paid",
          fulfillment_status: "pending",
          stripe_payment_intent_id: paymentIntentId || null,
          admin_payment_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (upErr) {
        console.error(upErr);
        return res.status(500).json({ error: upErr.message });
      }

      if (cartId) {
        await clearCart(cartId);
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.json({ received: true });
}
