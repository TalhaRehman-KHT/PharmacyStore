import React, { useContext, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { UserNotificationsContext } from "../../context/UserNotificationsContext.jsx";
import { Bell, ChevronLeft, Clock } from "lucide-react";

export default function UserNotificationDetail() {
  const { id } = useParams();
  const { getById, markRead } = useContext(UserNotificationsContext);
  const notification = getById(id);

  useEffect(() => {
    if (id) markRead(id);
  }, [id, markRead]);

  return (
    <UserLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-3xl mx-auto min-h-full w-full">
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/user/notifications"
            className="p-2 rounded-xl text-gray-600 hover:bg-white hover:border border border-transparent hover:border-gray-200 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary">Notification</h2>
        </div>

        {!notification ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-green/10 flex items-center justify-center">
              <Bell className="w-8 h-8 text-primary-green" />
            </div>
            <p className="text-text-primary font-bold">Notification not found</p>
            <p className="text-text-secondary text-sm mt-2">
              It may have been cleared or you refreshed before it was saved.
            </p>
            <Link
              to="/user/notifications"
              className="inline-flex mt-5 items-center justify-center px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
              style={{ background: "linear-gradient(135deg, #008F0B, #007009)" }}
            >
              Back to notifications
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-gray-100">
              <p className="text-lg font-bold text-text-primary">{notification.title}</p>
              <div className="flex items-center gap-2 mt-2 text-sm text-text-secondary">
                <Clock className="w-4 h-4" />
                <span>
                  {new Date(notification.createdAt).toLocaleString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <p className="text-text-primary leading-relaxed">{notification.message}</p>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}

