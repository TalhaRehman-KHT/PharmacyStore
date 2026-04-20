import { getReminders } from "./reminderService.js";
import { createUserReminderAlert } from "./userAlertService.js";

function ymd(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function timeKey(t) {
  return `${pad2(t.hour ?? 0)}:${pad2(t.minute ?? 0)}`;
}

function isWithinReminderDateWindow(reminder, todayStr) {
  const start = reminder?.startDate;
  const end = reminder?.endDate;
  if (start && start > todayStr) return false;
  if (end && end < todayStr) return false;
  return reminder?.isActive !== false;
}

function alreadyNotified({ userId, reminderId, tKey, todayStr }) {
  const key = `reminder_notified:${userId}:${reminderId}:${tKey}:${todayStr}`;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markNotified({ userId, reminderId, tKey, todayStr }) {
  const key = `reminder_notified:${userId}:${reminderId}:${tKey}:${todayStr}`;
  try {
    localStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

/**
 * Returns reminder notifications that are due "now".
 *
 * Heuristic:
 * - Match current hour:minute.
 * - Fire once per (user, reminder, time, day) using localStorage.
 *
 * This is purely client-side; for true push notifications you'd add a server job + table.
 */
export async function pollDueReminderNotifications(userId, now = new Date()) {
  if (!userId) return [];

  const todayStr = ymd(now);
  const currentH = now.getHours();
  const currentM = now.getMinutes();

  const reminders = await getReminders(userId);
  const due = [];

  for (const r of reminders) {
    if (!isWithinReminderDateWindow(r, todayStr)) continue;
    const times = r?.times ?? [];
    for (const t of times) {
      if ((t.hour ?? 0) !== currentH || (t.minute ?? 0) !== currentM) continue;
      const tKey = timeKey(t);
      if (alreadyNotified({ userId, reminderId: r.id, tKey, todayStr })) continue;
      markNotified({ userId, reminderId: r.id, tKey, todayStr });
      const message = `Time to take ${r.medicineName}${r.dosage ? ` (${r.dosage})` : ""}`;
      try {
        const row = await createUserReminderAlert({
          userId,
          message,
          meta: { reminderId: r.id, time: tKey, day: todayStr },
        });
        if (row) due.push(row);
      } catch {
        // If DB insert fails (RLS / schema not applied), still show it in UI this session.
        due.push({
          id: `${r.id}:${tKey}:${todayStr}`,
          type: "REMINDER",
          title: "Medicine reminder",
          message,
          isRead: false,
          createdAt: now.toISOString(),
          meta: { reminderId: r.id, time: tKey },
        });
      }
    }
  }

  return due;
}

