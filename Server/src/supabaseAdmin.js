import { createClient } from "@supabase/supabase-js";

let cached = null;

/**
 * Lazy client so importing the app does not throw when env is missing (e.g. misconfigured Vercel).
 * Call at request time; throws a clear error if vars are still unset.
 */
export function getSupabaseAdmin() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    const err = new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add both in Vercel → Project → Settings → Environment Variables (Production), then redeploy."
    );
    err.statusCode = 503;
    throw err;
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
