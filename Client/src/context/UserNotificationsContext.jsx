import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext.jsx";
import { pollDueReminderNotifications } from "../lib/userReminderNotificationService.js";
import {
  clearAlertsForUser,
  getAlertsForUser,
  markAlertRead,
  markAllAlertsReadForUser,
} from "../lib/userAlertService.js";

export const UserNotificationsContext = createContext({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  markRead: (_id) => {},
  getById: (_id) => null,
  clearAll: () => {},
});

function storageKey(userId) {
  return `user_notifications:${userId}`;
}

function loadFromStorage(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(userId, list) {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function UserNotificationsProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);

  // load on login change
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    // Prefer DB (alerts table). Fallback to local storage if DB fails.
    getAlertsForUser(user.id, { limit: 50 })
      .then((rows) => setNotifications(rows))
      .catch(() => setNotifications(loadFromStorage(user.id)));
  }, [user?.id]);

  // persist on changes
  useEffect(() => {
    if (!user?.id) return;
    saveToStorage(user.id, notifications);
  }, [user?.id, notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setNotifications([]);
      return;
    }

    async function tick() {
      try {
        const due = await pollDueReminderNotifications(user.id, new Date());
        if (cancelled || !due?.length) return;
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const next = [...due.filter((x) => !existingIds.has(x.id)), ...prev].slice(0, 50);
          return next;
        });
      } catch {
        // ignore polling failures
      }
    }

    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user?.id]);

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  const markRead = (id) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  const getById = (id) => notifications.find((n) => n.id === id) ?? null;
  const clearAll = () => setNotifications([]);
 
  // keep DB in sync for reads/clears
  const markAllReadDb = async () => {
    if (!user?.id) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllAlertsReadForUser(user.id);
    } catch {
      // ignore
    }
  };
  const markReadDb = async (id) => {
    if (!id) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await markAlertRead(id, true);
    } catch {
      // ignore
    }
  };
  const clearAllDb = async () => {
    if (!user?.id) return;
    setNotifications([]);
    try {
      await clearAlertsForUser(user.id);
    } catch {
      // ignore
    }
  };

  return (
    <UserNotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        markAllRead: markAllReadDb,
        markRead: markReadDb,
        getById,
        clearAll: clearAllDb,
      }}
    >
      {children}
    </UserNotificationsContext.Provider>
  );
}

