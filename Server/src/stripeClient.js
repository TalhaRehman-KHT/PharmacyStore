import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY?.trim();

export const stripe = secret ? new Stripe(secret) : null;

export function requireStripe() {
  if (!stripe) {
    const err = new Error("Stripe is not configured (STRIPE_SECRET_KEY)");
    err.statusCode = 503;
    throw err;
  }
  return stripe;
}
