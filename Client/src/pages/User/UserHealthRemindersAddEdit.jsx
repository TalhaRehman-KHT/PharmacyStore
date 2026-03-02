import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { createReminder, updateReminder, getReminderById } from "../../lib/reminderService.js";
import { ChevronLeft, Pill, Clock, Calendar, Plus } from "lucide-react";
import toast from "react-hot-toast";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function defaultEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function UserHealthRemindersAddEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const existing = React.useRef(null);

  const [medicineName, setMedicineName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState([{ hour: 8, minute: 0 }]);
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(id);

  useEffect(() => {
    const state = window.history.state?.state;
    const reminder = state?.reminder;
    if (reminder && reminder.id === id) {
      existing.current = reminder;
      setMedicineName(reminder.medicineName || "");
      setDosage(reminder.dosage || "");
      setTimes(
        reminder.times?.length
          ? reminder.times.map((t) => ({ hour: t.hour, minute: t.minute ?? 0 }))
          : [{ hour: 8, minute: 0 }]
      );
      setEndDate(reminder.endDate || defaultEndDate());
      setIsActive(reminder.isActive !== false);
      return;
    }
    if (id) {
      getReminderById(id).then((r) => {
        if (r) {
          existing.current = r;
          setMedicineName(r.medicineName || "");
          setDosage(r.dosage || "");
          setTimes(
            r.times?.length
              ? r.times.map((t) => ({ hour: t.hour, minute: t.minute ?? 0 }))
              : [{ hour: 8, minute: 0 }]
          );
          setEndDate(r.endDate || defaultEndDate());
          setIsActive(r.isActive !== false);
        }
      });
    }
  }, [id]);

  const addTime = () => {
    const last = times[times.length - 1];
    setTimes([...times, last ? { ...last } : { hour: 8, minute: 0 }]);
  };

  const removeTime = (index) => {
    if (times.length <= 1) return;
    setTimes(times.filter((_, i) => i !== index));
  };

  const setTime = (index, hour, minute) => {
    setTimes((prev) => {
      const next = [...prev];
      next[index] = { hour, minute };
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = medicineName.trim();
    if (!name) {
      toast.error("Enter medicine name");
      return;
    }
    if (!endDate) {
      toast.error("Set expiry date");
      return;
    }
    const today = todayStr();
    if (endDate < today) {
      toast.error("Expiry date must be today or later");
      return;
    }
    if (!user?.id) {
      toast.error("Please sign in");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && existing.current) {
        const updated = await updateReminder(id, {
          medicineName: name,
          dosage: dosage.trim() || null,
          times,
          endDate,
          isActive,
        });
        if (updated) {
          toast.success("Reminder updated");
          navigate("/user/health/reminders/manage");
        } else {
          toast.error("Failed to update");
        }
      } else {
        const created = await createReminder(user.id, {
          medicineName: name,
          dosage: dosage.trim() || null,
          times,
          startDate: today,
          endDate,
          isActive,
        });
        if (created) {
          toast.success("Reminder added");
          navigate("/user/health/reminders/manage");
        } else {
          toast.error("Failed to add reminder");
        }
      }
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserLayout>
      <div className="min-h-full bg-gray-50/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <header className="flex items-center gap-3 mb-6">
            <Link
              to="/user/health/reminders/manage"
              className="p-2 rounded-xl text-gray-600 hover:bg-white hover:border border border-transparent hover:border-gray-200 transition-colors"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {isEdit ? "Edit reminder" : "Add reminder"}
            </h1>
          </header>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Medicine name
                </label>
                <div className="relative">
                  <Pill className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-green" />
                  <input
                    type="text"
                    value={medicineName}
                    onChange={(e) => setMedicineName(e.target.value)}
                    placeholder="e.g. Paracetamol"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Dosage (optional)
                </label>
                <input
                  type="text"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="e.g. 500mg twice daily"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Reminder times (per day)
                </label>
                <div className="flex flex-wrap gap-2">
                  {times.map((t, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-green/10 px-3 py-2"
                    >
                      <input
                        type="time"
                        value={`${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`}
                        onChange={(e) => {
                          const v = e.target.value || "08:00";
                          const [h, m] = v.split(":").map(Number);
                          setTime(i, h, m);
                        }}
                        className="bg-transparent border-none text-sm w-24 focus:ring-0 p-0"
                      />
                      {times.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTime(i)}
                          className="text-gray-500 hover:text-red-500 text-lg leading-none p-0.5"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addTime}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-green/10 text-primary-green px-3 py-2 text-sm font-medium hover:bg-primary-green/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add time
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Expiry date
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-green shrink-0" />
                  <input
                    type="date"
                    value={endDate}
                    min={todayStr()}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 bg-white focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">When the medicine expires</p>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50/80 px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900">Active</p>
                  <p className="text-xs text-gray-500">Inactive reminders won&apos;t show in upcoming</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    isActive ? "bg-primary-green" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isActive ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-primary-green text-white font-semibold hover:bg-dark-green disabled:opacity-60 transition-colors"
              >
                {saving ? "Saving…" : isEdit ? "Update reminder" : "Add reminder"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </UserLayout>
  );
}
