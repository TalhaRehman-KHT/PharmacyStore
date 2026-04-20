import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { UserNotificationsContext } from "../../context/UserNotificationsContext.jsx";
import { Bell, Check, Trash2 } from "lucide-react";

export default function UserNotifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useContext(
    UserNotificationsContext,
  );

  return (
    <UserLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-4xl mx-auto min-h-full w-full">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary-green/10 flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary-green" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-text-primary">Notifications</h2>
              <p className="text-sm text-text-secondary mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={notifications.length === 0 || unreadCount === 0}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-text-primary font-semibold text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Mark all read
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-primary-orange font-semibold text-sm hover:bg-orange-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-green/10 flex items-center justify-center">
              <Bell className="w-8 h-8 text-primary-green" />
            </div>
            <p className="text-text-primary font-bold">No notifications yet</p>
            <p className="text-text-secondary text-sm mt-2">
              You’ll see medicine reminders here when it’s time to take them.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
            {notifications.map((n, idx) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  markRead(n.id);
                  navigate(`/user/notifications/${encodeURIComponent(n.id)}`);
                }}
                className={
                  "w-full text-left px-4 sm:px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors " +
                  (idx === notifications.length - 1 ? "border-b-0 " : "") +
                  (n.isRead ? "opacity-70" : "")
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary">{n.title}</p>
                    <p className="text-sm text-text-secondary mt-1">{n.message}</p>
                  </div>
                  {!n.isRead && <span className="w-2.5 h-2.5 rounded-full bg-primary-orange mt-1.5 shrink-0" />}
                </div>
                <p className="text-[12px] text-gray-400 mt-2">
                  {new Date(n.createdAt).toLocaleString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </UserLayout>
  );
}

