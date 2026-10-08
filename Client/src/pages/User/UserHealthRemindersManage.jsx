import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getReminders, deleteReminder, formatTime } from "../../lib/reminderService.js";
import { ChevronLeft, Bell, Pill, Clock, Pencil, Trash2, Plus } from "lucide-react";
import toast from "react-hot-toast";

function formatDateStr(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function ReminderTile({ reminder, onEdit, onDelete }) {
  const timesStr = reminder.times?.length
    ? reminder.times.map((t) => formatTime(t)).join(", ")
    : "—";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-primary-green/20 transition-all">
      <div
        className="p-4 sm:p-5 flex items-center gap-3 cursor-pointer hover:bg-gray-50/50"
        onClick={onEdit}
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            reminder.isActive ? "bg-primary-green/15" : "bg-gray-200"
          }`}
        >
          <Pill
            className={`w-6 h-6 ${reminder.isActive ? "text-primary-green" : "text-gray-400"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{reminder.medicineName}</p>
          {reminder.dosage && (
            <p className="text-sm text-gray-500 mt-0.5">{reminder.dosage}</p>
          )}
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" />
            {timesStr}
          </p>
          {reminder.endDate && (
            <p className="text-xs text-gray-500 mt-0.5">
              Expires: {formatDateStr(reminder.endDate)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2.5 rounded-xl text-primary-green hover:bg-primary-green/10 transition-colors"
            aria-label="Edit"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserHealthRemindersManage() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadReminders = useCallback(async () => {
    if (!user?.id) {
      setError("Please sign in");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getReminders(user.id);
      setReminders(list);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const handleEdit = (reminder) => {
    navigate(`/user/health/reminders/edit/${reminder.id}`, { state: { reminder } });
  };

  const handleAdd = () => navigate("/user/health/reminders/add");

  const handleDelete = async (reminder) => {
    const ok = window.confirm(
      `Remove "${reminder.medicineName}" from your reminders?`
    );
    if (!ok) return;
    try {
      const deleted = await deleteReminder(reminder.id);
      if (deleted) {
        await loadReminders();
        toast.success("Reminder deleted");
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <UserLayout>
      <div className="min-h-full bg-gray-50/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Link
                to="/user/health/reminders"
                className="p-2 rounded-xl text-gray-600 hover:bg-white hover:border border border-transparent hover:border-gray-200 transition-colors"
                aria-label="Back to Reminders"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manage Reminders</h1>
                <p className="text-sm text-gray-500 mt-0.5">Add, edit or delete medicine reminders</p>
              </div>
            </div>
            {!error && (
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary-green text-white font-semibold hover:bg-dark-green transition-colors shrink-0"
              >
                <Plus className="w-5 h-5" />
                Add reminder
              </button>
            )}
          </header>

          <div className="space-y-4 pb-24 sm:pb-8">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="py-12 text-center rounded-2xl bg-white border border-gray-100">
                <p className="text-gray-600">{error}</p>
                <Link
                  to="/user/health/reminders"
                  className="mt-4 inline-block text-primary-green font-semibold hover:underline"
                >
                  Back to Reminders
                </Link>
              </div>
            ) : reminders.length === 0 ? (
              <div className="py-16 text-center rounded-2xl border border-gray-200 bg-white/80">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-green/10 flex items-center justify-center">
                  <Bell className="w-8 h-8 text-primary-green" />
                </div>
                <p className="font-bold text-gray-900">No reminders yet</p>
                <p className="text-sm text-gray-500 mt-1">Click &quot;Add reminder&quot; to create your first one</p>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary-green text-white font-semibold hover:bg-dark-green"
                >
                  <Plus className="w-5 h-5" />
                  Add reminder
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reminders.map((r) => (
                  <ReminderTile
                    key={r.id}
                    reminder={r}
                    onEdit={() => handleEdit(r)}
                    onDelete={() => handleDelete(r)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* FAB on mobile only */}
          {!error && reminders.length > 0 && (
            <div className="fixed bottom-6 right-6 z-10 sm:hidden">
              <button
                type="button"
                onClick={handleAdd}
                className="w-14 h-14 rounded-full bg-primary-green text-white shadow-lg flex items-center justify-center hover:bg-dark-green active:scale-95"
                aria-label="Add reminder"
              >
                <Plus className="w-7 h-7" />
              </button>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
