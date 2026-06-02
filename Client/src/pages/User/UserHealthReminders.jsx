import React, { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getReminders, getExpiringSoonReminders, formatTime, getNextOccurrence, formatTimeRemaining } from "../../lib/reminderService.js";
import { ChevronLeft, Clock, Calendar, Pill, FileText } from "lucide-react";

function formatDateStr(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString();
}

function daysUntil(endDateStr) {
  if (!endDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function isPdfUrl(url) {
  return /\.pdf(?:$|\?)/i.test(url || "");
}

function PrescriptionThumb({ url, fallback: FallbackIcon = Pill, color = "#008F0B" }) {
  if (!url) return <FallbackIcon className="w-8 h-8" style={{ color }} />;

  if (isPdfUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="w-full h-full flex items-center justify-center"
        aria-label="Open prescription PDF"
      >
        <FileText className="w-8 h-8" style={{ color }} />
      </a>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="w-full h-full object-cover"
    />
  );
}

function ReminderCard({ reminder, showNext }) {
  const times = reminder.times ?? [];
  const timesStr = times.length
    ? times.map((t) => formatTime(t)).join(", ")
    : "—";
  const { diffMinutes, nextTime } = getNextOccurrence(reminder);
  const remainingStr = showNext && nextTime ? formatTimeRemaining(diffMinutes, nextTime) : null;
  const isSoon = remainingStr && diffMinutes != null && diffMinutes < 60;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex hover:shadow-md hover:border-primary-green/20 transition-all">
      <div
        className="w-1 shrink-0"
        style={{ backgroundColor: isSoon ? "#FF8F6B" : "#008F0B" }}
      />
      <div className="p-4 sm:p-5 flex-1 flex items-center gap-4">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-primary-green/10 flex items-center justify-center overflow-hidden shrink-0">
          <PrescriptionThumb url={reminder.prescriptionImageUrl} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{reminder.medicineName}</p>
          {reminder.dosage && (
            <p className="text-sm text-gray-500 mt-0.5">Dosage: {reminder.dosage}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{timesStr}</span>
          </div>
          {reminder.endDate && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              Expires: {formatDateStr(reminder.endDate)}
            </p>
          )}
          {remainingStr && remainingStr !== "—" && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-green/10 text-primary-green text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              Next in {remainingStr}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpiryCard({ reminder }) {
  const days = daysUntil(reminder.endDate);
  const daysText =
    days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`;
  const isUrgent = days !== null && days <= 7;
  const color = isUrgent ? "#FF8F6B" : "#008F0B";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex hover:shadow-md transition-all">
      <div className="w-1 shrink-0" style={{ backgroundColor: color }} />
      <div className="p-4 sm:p-5 flex-1 flex items-center gap-4">
        <div
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
          style={{ backgroundColor: `${color}18` }}
        >
          <PrescriptionThumb url={reminder.prescriptionImageUrl} fallback={Calendar} color={color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{reminder.medicineName}</p>
          {reminder.dosage && (
            <p className="text-sm text-gray-500 mt-0.5">Dosage: {reminder.dosage}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            Expires: {formatDateStr(reminder.endDate)}
          </div>
        </div>
        <div
          className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          {daysText}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border border-gray-200 bg-white/80">
      <div className="w-20 h-20 rounded-2xl bg-primary-green/10 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-primary-green" />
      </div>
      <p className="text-lg font-bold text-gray-900">{title}</p>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">{subtitle}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm bg-primary-green hover:bg-dark-green transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  );
}

export default function UserHealthReminders() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState("reminders");
  const [reminders, setReminders] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [loadingExpiring, setLoadingExpiring] = useState(true);
  const [error, setError] = useState(null);

  const loadReminders = async () => {
    if (!user?.id) {
      setError("Please sign in to see reminders");
      setLoadingReminders(false);
      return;
    }
    setLoadingReminders(true);
    setError(null);
    try {
      const list = await getReminders(user.id);
      setReminders(list);
    } catch {
      setReminders([]);
    } finally {
      setLoadingReminders(false);
    }
  };

  const loadExpiring = async () => {
    if (!user?.id) {
      setLoadingExpiring(false);
      return;
    }
    setLoadingExpiring(true);
    try {
      const list = await getExpiringSoonReminders(user.id, 60);
      setExpiring(list);
    } catch {
      setExpiring([]);
    } finally {
      setLoadingExpiring(false);
    }
  };

  useEffect(() => {
    loadReminders();
    loadExpiring();
  }, [user?.id]);

  const goManage = () => navigate("/user/health/reminders/manage");

  return (
    <UserLayout>
      <div className="min-h-full bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <header className="flex items-center gap-3 mb-6">
            <Link
              to="/user/health"
              className="p-2 rounded-xl text-gray-600 hover:bg-white hover:border border border-transparent hover:border-gray-200 transition-colors"
              aria-label="Back to Health"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Medicine Reminders</h1>
              <p className="text-sm text-gray-500 mt-0.5">View and manage your medicine reminders</p>
            </div>
          </header>

          <div className="flex gap-1 p-1 rounded-xl bg-gray-200/60 w-full max-w-md mb-6">
            <button
              type="button"
              onClick={() => setTab("reminders")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "reminders" ? "bg-white shadow text-primary-green" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Reminders
            </button>
            <button
              type="button"
              onClick={() => setTab("expiring")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === "expiring" ? "bg-white shadow text-primary-green" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Expiring soon
            </button>
          </div>

          {error ? (
            <div className="py-12 text-center rounded-2xl bg-white border border-gray-100">
              <p className="text-gray-600">{error}</p>
            </div>
          ) : tab === "reminders" ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-gray-900">Your reminders</span>
                <div className="flex items-center gap-3">
                  {reminders.length > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-primary-green/10 text-primary-green text-sm font-semibold">
                      {reminders.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={goManage}
                    className="text-primary-green font-semibold text-sm hover:underline"
                  >
                    Manage
                  </button>
                </div>
              </div>
              {loadingReminders ? (
                <div className="flex justify-center py-16">
                  <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
                </div>
              ) : reminders.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No reminders yet"
                  subtitle="Add medicines and set times so you never miss a dose."
                  actionLabel="Manage reminders"
                  onAction={goManage}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reminders.map((r) => (
                    <ReminderCard key={r.id} reminder={r} showNext />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="font-bold text-gray-900 mb-4">Expiring in 60 days</p>
              {loadingExpiring ? (
                <div className="flex justify-center py-16">
                  <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
                </div>
              ) : expiring.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No medicines expiring soon"
                  subtitle="Medicines expiring in the next 60 days will show here."
                  actionLabel="Manage reminders"
                  onAction={goManage}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {expiring.map((r) => (
                    <ExpiryCard key={r.id} reminder={r} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
