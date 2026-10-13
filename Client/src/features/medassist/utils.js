/** DOM id of a citation card, unique per message. */
export const citationDomId = (messageId, n) => `medassist-cite-${messageId}-${n}`;

/**
 * Format a price exactly like the shop pages do (`${price.toFixed(2)}`), e.g. 45 -> "$45.00".
 * The shop has no shared helper, so this copies its inline format instead of importing it.
 */
export const formatPrice = (amount) => `$${(Number(amount) || 0).toFixed(2)}`;

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const RELATIVE_STEPS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "5 minutes ago", "yesterday", "just now". */
export function formatRelative(iso, now = Date.now()) {
  const sec = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(sec) >= size) return rtf.format(Math.trunc(sec / size), unit);
  }
  return "just now";
}

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** "12 Oct 2026, 14:05". */
export const formatDateTime = (iso) => dateTimeFmt.format(new Date(iso));

/** Minutes to wait, rounded up, from a Retry-After value in seconds. */
export const retryMinutes = (sec) => Math.max(1, Math.ceil((Number(sec) || 0) / 60));
