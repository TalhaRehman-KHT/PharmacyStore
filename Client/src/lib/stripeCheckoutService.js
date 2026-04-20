import axiosInstance from "../api/axios.js";

/**
 * Starts Stripe Checkout for one cart (one pharmacy). Your backend must:
 * 1. Verify the caller owns `cart_id` (e.g. match X-User-Id to carts.user_id; prefer a signed JWT in production).
 * 2. Load cart_items from Supabase with the service role and recompute line amounts from trusted DB fields (do not trust client prices).
 * 3. Create a pending order + order_items (or create the order only in the webhook after payment — your choice).
 * 4. stripe.checkout.sessions.create({ mode: 'payment', line_items, success_url, cancel_url, metadata: { order_id } }).
 * 5. Return { url: session.url }.
 *
 * Webhook: on checkout.session.completed, set orders.payment_status = 'paid', fulfillment_status = 'pending', admin_payment_status = 'pending'; decrement batches / stock_transactions; clear cart_items for that cart.
 */
export async function createCheckoutSessionForCart(cartId) {
  const origin = window.location.origin;
  const successUrl = `${origin}/user/cart?checkout=success`;
  const cancelUrl = `${origin}/user/cart?checkout=cancel`;

  let data;
  try {
    const res = await axiosInstance.post("/api/stripe/create-checkout-session", {
      cart_id: String(cartId),
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    data = res.data;
  } catch (e) {
    const status = e.response?.status;
    const body = e.response?.data;
    const msg =
      (typeof body === "object" && body != null && (body.message || body.error)) ||
      (typeof body === "string" ? body : null) ||
      e.message ||
      "Could not reach checkout API";
    const hint =
      status === 404 || e.code === "ERR_NETWORK"
        ? " Check the API is running, VITE_API_URL / Vite proxy, and browser console (Network tab)."
        : "";
    throw new Error(`${msg}${status ? ` [HTTP ${status}]` : ""}${hint}`);
  }

  let url = typeof data?.url === "string" ? data.url.trim() : "";
  if (!url) {
    throw new Error(data?.message || "Checkout could not be started (no Stripe session URL)");
  }
  if (!url.startsWith("https://")) {
    throw new Error("Invalid checkout link from server (expected https Stripe URL).");
  }

  window.location.replace(url);
}
