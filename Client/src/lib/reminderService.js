import { supabase } from "./supabase.js";

function parseTime(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.trim().split(":");
  const hour = parseInt(parts[0], 10);
  const minute = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  if (Number.isNaN(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function formatTime({ hour, minute }) {
  const m = minute == null || Number.isNaN(minute) ? 0 : Math.max(0, Math.min(59, Math.floor(minute)));
  const h = hour == null || Number.isNaN(hour) ? 0 : Math.max(0, Math.min(23, Math.floor(hour)));
  const period = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const mStr = m < 10 ? `0${m}` : String(m);
  return `${h12}:${mStr} ${period}`;
}

function parseReminder(row) {
  const presc = row.prescriptions ?? row.prescription;
  const imageUrl = presc && typeof presc === "object" ? presc.image_url ?? presc.imageUrl : null;
  const timesRaw = row.reminder_times ?? [];
  const times = timesRaw
    .map((t) => parseTime(t.schedule_time ?? t.scheduleTime))
    .filter(Boolean);
  times.sort((a, b) => (a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute));

  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    prescriptionId: row.prescription_id ?? row.prescriptionId,
    prescriptionImageUrl: imageUrl ?? null,
    medicineName: row.medicine_name ?? row.medicineName ?? "",
    dosage: row.dosage ?? null,
    times,
    startDate: row.start_date ?? row.startDate,
    endDate: row.end_date ?? row.endDate,
    isActive: row.is_active ?? row.isActive !== false,
  };
}

/**
 * Fetch reminders for user (active, end_date >= today or null). With times and prescription image.
 */
export async function getReminders(userId) {
  if (!userId) return [];
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("reminders")
    .select("*, reminder_times(schedule_time), prescriptions(image_url)")
    .eq("user_id", userId)
    .or(`end_date.gte.${today},end_date.is.null`)
    .order("start_date", { ascending: false });

  if (error) return [];
  return (data || []).map(parseReminder);
}

/**
 * Fetch a single reminder by id (for edit page).
 */
export async function getReminderById(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from("reminders")
    .select("*, reminder_times(schedule_time), prescriptions(image_url)")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return parseReminder(data);
}

/**
 * Reminders expiring within withinDays (end_date between today and today+withinDays). Ordered by end_date.
 */
export async function getExpiringSoonReminders(userId, withinDays = 60) {
  if (!userId) return [];
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + withinDays);
  const todayStr = today.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("reminders")
    .select("*, reminder_times(schedule_time), prescriptions(image_url)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .gte("end_date", todayStr)
    .lte("end_date", endStr)
    .order("end_date", { ascending: true });

  if (error) return [];
  return (data || []).map(parseReminder);
}

function timeToApi({ hour, minute }) {
  const h = String(hour).padStart(2, "0");
  const m = String(minute ?? 0).padStart(2, "0");
  return `${h}:${m}:00`;
}

async function insertTimes(reminderId, times) {
  if (!times.length) return;
  const { error } = await supabase
    .from("reminder_times")
    .insert(times.map((t) => ({ reminder_id: reminderId, schedule_time: timeToApi(t) })));
  if (error) throw new Error(error.message);
}

/**
 * Create a new reminder with one or more times per day.
 */
export async function createReminder(userId, opts) {
  if (!userId || !opts?.medicineName?.trim()) return null;
  const times = opts.times && opts.times.length ? opts.times : [{ hour: 8, minute: 0 }];

  const today = new Date().toISOString().slice(0, 10);
  const { data: reminderRow, error: insertError } = await supabase
    .from("reminders")
    .insert({
      user_id: userId,
      prescription_id: opts.prescriptionId || null,
      medicine_name: opts.medicineName.trim(),
      dosage: opts.dosage?.trim() || null,
      start_date: opts.startDate || today,
      end_date: opts.endDate || null,
      is_active: opts.isActive !== false,
    })
    .select()
    .single();

  if (insertError || !reminderRow) return null;
  const reminderId = reminderRow.id;

  try {
    await insertTimes(reminderId, times);
  } catch (err) {
    // Don't leave a reminder without times behind.
    await supabase.from("reminders").delete().eq("id", reminderId);
    throw err;
  }

  const { data: full } = await supabase
    .from("reminders")
    .select("*, reminder_times(schedule_time), prescriptions(image_url)")
    .eq("id", reminderId)
    .single();
  return full ? parseReminder(full) : parseReminder(reminderRow);
}

/**
 * Update reminder and replace its times.
 */
export async function updateReminder(id, opts) {
  if (!id) return null;
  const data = {};
  if (opts.medicineName !== undefined) data.medicine_name = opts.medicineName.trim();
  if (opts.dosage !== undefined) data.dosage = opts.dosage?.trim() || null;
  if (opts.startDate !== undefined) data.start_date = opts.startDate;
  if (opts.endDate !== undefined) data.end_date = opts.endDate;
  if (opts.isActive !== undefined) data.is_active = opts.isActive;

  if (Object.keys(data).length > 0) {
    const { error } = await supabase.from("reminders").update(data).eq("id", id);
    if (error) return null;
  }

  if (opts.times != null && Array.isArray(opts.times)) {
    const { error: delError } = await supabase.from("reminder_times").delete().eq("reminder_id", id);
    if (delError) throw new Error(delError.message);
    await insertTimes(id, opts.times);
  }

  const { data: full } = await supabase
    .from("reminders")
    .select("*, reminder_times(schedule_time), prescriptions(image_url)")
    .eq("id", id)
    .single();
  return full ? parseReminder(full) : null;
}

/**
 * Delete a reminder.
 */
export async function deleteReminder(id) {
  if (!id) return false;
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  return !error;
}

export { formatTime };

/**
 * Get the next occurrence (soonest reminder time from now) for a reminder.
 * Returns { diffMinutes, nextTime } or { diffMinutes: null, nextTime: null } if no times.
 * Mirrors my_fyp _nextOccurrence.
 */
export function getNextOccurrence(reminder) {
  const times = reminder?.times ?? [];
  if (!times.length) return { diffMinutes: null, nextTime: null };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let bestDiffMs = null;
  let bestTime = null;

  for (const t of times) {
    const h = t.hour ?? 0;
    const m = t.minute ?? 0;
    let next = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
    }
    const diffMs = next.getTime() - now.getTime();
    if (bestDiffMs == null || diffMs < bestDiffMs) {
      bestDiffMs = diffMs;
      bestTime = t;
    }
  }

  const diffMinutes = bestDiffMs != null ? Math.floor(bestDiffMs / (60 * 1000)) : null;
  return { diffMinutes, nextTime: bestTime };
}

/**
 * Format remaining time for display. Mirrors my_fyp _formatTimeRemaining.
 * - &lt; 60 min: "X min"
 * - &lt; 24 hr: "X hr"
 * - next day (24h–48h): "Tomorrow 8:00 AM"
 * - else: "X days"
 */
export function formatTimeRemaining(diffMinutes, nextTime) {
  if (diffMinutes == null || diffMinutes < 0) return "—";
  if (!nextTime) return "—";
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(diffMinutes / (60 * 24));
  if (days === 1) return `Tomorrow ${formatTime(nextTime)}`;
  return `${days} days`;
}
