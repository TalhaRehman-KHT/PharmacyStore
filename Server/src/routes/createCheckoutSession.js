import { requireStripe } from "../stripeClient.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";

function moneyToCents(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * POST /api/stripe/create-checkout-session
 * Body: { cart_id, success_url, cancel_url }
 * Header: X-User-Id (must match carts.user_id — replace with JWT verification later)
 */
export async function createCheckoutSessionHandler(req, res) {
  try {
    const userId = typeof req.headers["x-user-id"] === "string" ? req.headers["x-user-id"].trim() : "";
    if (!userId) {
      return res.status(401).json({ message: "Missing X-User-Id" });
    }

    const { cart_id: cartId, success_url: successUrl, cancel_url: cancelUrl } = req.body || {};
    if (!cartId || !successUrl || !cancelUrl) {
      return res.status(400).json({ message: "cart_id, success_url, and cancel_url are required" });
    }

    const { data: cart, error: cartErr } = await getSupabaseAdmin()
      .from("carts")
      .select(
        `
        id,
        user_id,
        pharmacy_id,
        cart_items (
          id,
          batch_id,
          medicine_id,
          quantity,
          unit_price,
          medicines ( name )
        )
      `
      )
      .eq("id", cartId)
      .maybeSingle();

    if (cartErr) {
      console.error(cartErr);
      return res.status(500).json({ message: cartErr.message });
    }
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    if (String(cart.user_id) !== String(userId)) {
      return res.status(403).json({ message: "Not your cart" });
    }

    const items = cart.cart_items || [];
    if (items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const batchIds = [...new Set(items.map((i) => i.batch_id).filter(Boolean))];
    const { data: batches, error: batchErr } = await getSupabaseAdmin()
      .from("medicine_batches")
      .select("id, pharmacy_id, medicine_id, selling_price, quantity, medicines ( name )")
      .in("id", batchIds);

    if (batchErr) {
      console.error(batchErr);
      return res.status(500).json({ message: batchErr.message });
    }

    const batchMap = new Map((batches || []).map((b) => [String(b.id), b]));
    const currency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();

    let totalAmount = 0;
    const lineItems = [];

    for (const row of items) {
      const batch = batchMap.get(String(row.batch_id));
      if (!batch) {
        return res.status(400).json({ message: `Batch not found for cart line` });
      }
      if (batch.pharmacy_id !== cart.pharmacy_id) {
        return res.status(400).json({ message: "Cart batch does not belong to this pharmacy" });
      }

      const qty = Number(row.quantity) || 0;
      if (qty < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }
      const stock = Number(batch.quantity) || 0;
      if (stock < qty) {
        return res.status(400).json({ message: "Insufficient stock for one or more items" });
      }

      const unit = batch.selling_price != null ? Number(batch.selling_price) : Number(row.unit_price);
      if (!Number.isFinite(unit) || unit < 0) {
        return res.status(400).json({ message: "Invalid price for an item" });
      }

      const cents = moneyToCents(unit);
      if (cents == null || cents < 1) {
        return res.status(400).json({ message: "Amount too small for checkout" });
      }

      totalAmount += unit * qty;
      const name =
        batch.medicines?.name || row.medicines?.name || "Medicine";

      lineItems.push({
        price_data: {
          currency,
          product_data: { name },
          unit_amount: cents,
        },
        quantity: qty,
      });
    }

    const { data: orderRow, error: orderErr } = await getSupabaseAdmin()
      .from("orders")
      .insert({
        user_id: userId,
        pharmacy_id: cart.pharmacy_id,
        payment_status: "unpaid",
        fulfillment_status: "pending",
        total_amount: totalAmount,
        admin_payment_status: null,
      })
      .select("id")
      .single();

    if (orderErr) {
      console.error(orderErr);
      return res.status(500).json({ message: orderErr.message });
    }

    const orderId = orderRow.id;

    for (const row of items) {
      const batch = batchMap.get(String(row.batch_id));
      const qty = Number(row.quantity) || 0;
      const unit = batch.selling_price != null ? Number(batch.selling_price) : Number(row.unit_price);
      const { error: oiErr } = await getSupabaseAdmin().from("order_items").insert({
        order_id: orderId,
        batch_id: row.batch_id,
        medicine_id: row.medicine_id,
        quantity: qty,
        unit_price: unit,
      });
      if (oiErr) {
        console.error(oiErr);
        await getSupabaseAdmin().from("order_items").delete().eq("order_id", orderId);
        await getSupabaseAdmin().from("orders").delete().eq("id", orderId);
        return res.status(500).json({ message: oiErr.message });
      }
    }

    const stripe = requireStripe();

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "hosted",
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: orderId,
        metadata: {
          order_id: orderId,
          cart_id: cartId,
          user_id: userId,
          pharmacy_id: cart.pharmacy_id,
        },
        payment_intent_data: {
          metadata: {
            order_id: orderId,
            cart_id: cartId,
          },
        },
      });
    } catch (stripeErr) {
      console.error(stripeErr);
      await getSupabaseAdmin().from("order_items").delete().eq("order_id", orderId);
      await getSupabaseAdmin().from("orders").delete().eq("id", orderId);
      return res.status(502).json({ message: stripeErr.message || "Stripe error" });
    }

    const { error: updErr } = await getSupabaseAdmin()
      .from("orders")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updErr) {
      console.error(updErr);
    }

    const checkoutUrl = typeof session.url === "string" ? session.url.trim() : "";
    if (!checkoutUrl) {
      console.error("Stripe session missing url", { id: session.id, ui_mode: session.ui_mode });
      return res.status(502).json({
        message:
          "Stripe did not return a hosted checkout URL. Check STRIPE_SECRET_KEY (test vs live) and Stripe Dashboard → Developers → API version.",
      });
    }

    return res.json({ url: checkoutUrl });
  } catch (e) {
    console.error(e);
    const code = e.statusCode || 500;
    return res.status(code).json({ message: e.message || "Checkout failed" });
  }
}
