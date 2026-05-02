import express from "express";
import cors from "cors";
import { createCheckoutSessionHandler } from "./routes/createCheckoutSession.js";
import { stripeWebhookHandler } from "./routes/stripeWebhook.js";
import { googleAuthHandler } from "./routes/googleAuth.js";

const app = express();
app.set("trust proxy", 1);

// Vercel rewrites to the /api function sometimes pass paths like /health instead of /api/health.
app.use((req, res, next) => {
  if (!process.env.VERCEL) return next();
  let u = req.url || "/";
  if (u.startsWith("/api/") || u === "/api" || u.startsWith("/api?")) return next();
  const q = u.indexOf("?");
  const pathOnly = q === -1 ? u : u.slice(0, q);
  const search = q === -1 ? "" : u.slice(q);
  if (pathOnly === "/" || pathOnly === "") {
    req.url = "/api/health" + search;
    return next();
  }
  req.url = "/api" + (pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`) + search;
  next();
});

const frontendOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

app.use(
  cors({
    origin: frontendOrigins && frontendOrigins.length ? frontendOrigins : true,
    credentials: true,
  })
);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json());

app.post("/api/auth/google", (req, res, next) => {
  Promise.resolve(googleAuthHandler(req, res, next)).catch(next);
});

app.get("/api/health", (req, res) => {
  const showConfig = req.query.details === "1";
  const body = { ok: true };
  if (showConfig) {
    body.configured = {
      stripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
      stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      googleClientIdFromEnv: Boolean(process.env.GOOGLE_CLIENT_ID?.trim?.()),
    };
  }
  res.json(body);
});

app.post("/api/stripe/create-checkout-session", (req, res, next) => {
  Promise.resolve(createCheckoutSessionHandler(req, res)).catch(next);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Server error" });
});

export default app;
