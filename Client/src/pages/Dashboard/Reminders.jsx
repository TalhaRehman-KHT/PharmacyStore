import React, { useState, useEffect } from "react";
import { Bell, Plus, Calendar } from "lucide-react";
import axiosInstance from "../../api/axios.js";

export default function Reminders() {
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({
        title: "",
        description: "",
        reminder_date: "",
    });
    const [submitting, setSubmitting] = useState(false);

    const fetchReminders = async () => {
        setLoading(true);
        setError("");
        try {
            const { data } = await axiosInstance.get("/api/reminders");
            setReminders(data.reminders || []);
        } catch (err) {
            const res = err.response?.data;
            const msg = res?.error || res?.message || "Failed to load reminders";
            const hint = res?.hint ? ` (${res.hint})` : "";
            setError(msg + hint);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReminders();
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title?.trim() || !form.reminder_date) {
            setError("Title and reminder date are required");
            return;
        }
        setSubmitting(true);
        setError("");
        try {
            await axiosInstance.post("/api/reminders", form);
            setForm({ title: "", description: "", reminder_date: "" });
            setFormOpen(false);
            fetchReminders();
        } catch (err) {
            const res = err.response?.data;
            const msg = res?.error || res?.message || "Failed to create reminder";
            const hint = res?.hint ? ` (${res.hint})` : "";
            setError(msg + hint);
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass =
        "w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                        <Bell size={28} className="text-green-600" />
                        Reminders
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Manage your medication reminders
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                    <Plus size={20} />
                    Add Reminder
                </button>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
                    Loading reminders...
                </div>
            ) : reminders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                    <Bell size={48} className="mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 mb-4">No reminders yet</p>
                    <button
                        type="button"
                        onClick={() => setFormOpen(true)}
                        className="text-green-600 font-medium hover:text-green-700"
                    >
                        Add your first reminder
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {reminders.map((r) => (
                        <div
                            key={r.id}
                            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800">
                                        {r.title || r.name}
                                    </h3>
                                    {r.description && (
                                        <p className="text-sm text-gray-600 mt-0.5">
                                            {r.description}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(
                                            r.reminder_date
                                        ).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Reminder Modal */}
            {formOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                            <h3 className="font-semibold text-gray-800">
                                Add Reminder
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setFormOpen(false);
                                    setForm({
                                        title: "",
                                        description: "",
                                        reminder_date: "",
                                    });
                                }}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="e.g. Take morning medicine"
                                    className={inputClass}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Add notes..."
                                    rows={2}
                                    className={`${inputClass} resize-none`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    name="reminder_date"
                                    value={form.reminder_date}
                                    onChange={handleChange}
                                    className={inputClass}
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setFormOpen(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-70"
                                >
                                    {submitting
                                        ? "Creating..."
                                        : "Create Reminder"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
