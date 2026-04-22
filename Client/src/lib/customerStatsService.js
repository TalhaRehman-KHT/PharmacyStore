import { supabase } from "./supabase.js";

/**
 * Customer stats for user home dashboard: prescriptions count, reminders count.
 * Cart items count is computed from carts in the dashboard.
 * Tables: prescriptions (user_id), reminders (user_id, is_active).
 * If tables don't exist, counts return 0.
 */
export async function getPrescriptionsCount(userId) {
  if (!userId) return 0;
  try {
    const { data, error } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("user_id", userId);
    if (error) return 0;
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

export async function getRemindersCount(userId) {
  if (!userId) return 0;
  try {
    const { data, error } = await supabase
      .from("reminders")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true);
    if (error) return 0;
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

export async function getCustomerStats(userId) {
  if (!userId) return { prescriptions: 0, reminders: 0 };
  try {
    const [prescriptions, reminders] = await Promise.all([
      getPrescriptionsCount(userId),
      getRemindersCount(userId),
    ]);
    return { prescriptions, reminders };
  } catch {
    return { prescriptions: 0, reminders: 0 };
  }
}
