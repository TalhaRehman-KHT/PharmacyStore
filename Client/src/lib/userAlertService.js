import { supabase } from "./supabase.js";

function parseAlert(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? null,
    pharmacyId: row.pharmacy_id ?? row.pharmacyId ?? null,
    type: row.type ?? null,
    title: row.type === "REMINDER" ? "Medicine reminder" : "Alert",
    message: row.message,
    isRead: row.is_read ?? row.isRead ?? false,
    createdAt: row.created_at ?? row.createdAt,
    meta: row.meta ?? null,
  };
}

export async function getAlertsForUser(userId, { limit = 50 } = {}) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []).map(parseAlert).filter(Boolean);
}

export async function createUserReminderAlert({ userId, message, meta }) {
  if (!userId || !message?.trim()) return null;
  const baseInsert = {
    user_id: userId,
    type: "REMINDER",
    message: message.trim(),
    is_read: false,
  };
  const withMeta = meta != null ? { ...baseInsert, meta } : baseInsert;

  // Try inserting with meta first (if column exists), then retry without meta.
  const first = await supabase.from("alerts").insert(withMeta).select("*").single();
  if (!first.error) return parseAlert(first.data);

  const msg = first.error?.message || "";
  const missingMetaColumn =
    msg.includes('column "meta"') || msg.includes("schema cache") || msg.includes("meta");
  if (!missingMetaColumn) throw new Error(msg);

  const retry = await supabase.from("alerts").insert(baseInsert).select("*").single();
  if (retry.error) throw new Error(retry.error.message);
  return parseAlert(retry.data);
}

export async function markAlertRead(alertId, isRead = true) {
  if (!alertId) return false;
  const { error } = await supabase.from("alerts").update({ is_read: !!isRead }).eq("id", alertId);
  if (error) throw new Error(error.message);
  return true;
}

export async function markAllAlertsReadForUser(userId) {
  if (!userId) return false;
  const { error } = await supabase
    .from("alerts")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
  return true;
}

export async function clearAlertsForUser(userId) {
  if (!userId) return false;
  const { error } = await supabase.from("alerts").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  return true;
}

