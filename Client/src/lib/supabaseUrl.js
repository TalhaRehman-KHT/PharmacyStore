/**
 * Supabase JS expects the bare project URL. A value copied from the REST docs
 * ends in /rest/v1, which makes every request hit /rest/v1/rest/v1/... (404).
 */
export function normalizeSupabaseUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "");
}
