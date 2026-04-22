import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { analyzePrescription } from "../../lib/geminiService.js";
import { savePrescription } from "../../lib/prescriptionService.js";
import { ChevronLeft, Upload, AlertTriangle, Calendar, Clock, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

function toMedicinesWithReminders(medicines) {
  return (medicines || []).map((m) => ({
    name: m.name || "Unknown",
    dosage: m.dosage || "",
    purpose: m.purpose || "",
    instructions: m.instructions || "",
    endDate: null,
    reminderTimes: [{ hour: 8, minute: 0 }],
  }));
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 10);
}

export default function UserHealthScanPrescription() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [medicines, setMedicines] = useState([]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f?.type.startsWith("image/")) return;
    setFile(f);
    setError(null);
    setResult(null);
    setMedicines([]);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Please upload a prescription image");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const data = await analyzePrescription(file);
      setResult(data);
      setMedicines(toMedicinesWithReminders(data.medicines));
      toast.success("Prescription analyzed");
    } catch (err) {
      setError(err?.message || "AI could not read prescription");
      toast.error(err?.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const setMedicineEndDate = (index, dateStr) => {
    setMedicines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], endDate: dateStr || null };
      return next;
    });
  };

  const addReminderTime = (index) => {
    setMedicines((prev) => {
      const next = [...prev];
      const times = [...(next[index].reminderTimes || [])];
      times.push(times.length ? { ...times[times.length - 1] } : { hour: 8, minute: 0 });
      next[index] = { ...next[index], reminderTimes: times };
      return next;
    });
  };

  const removeReminderTime = (index, timeIndex) => {
    setMedicines((prev) => {
      const next = [...prev];
      const times = [...(next[index].reminderTimes || [])];
      if (times.length <= 1) return prev;
      times.splice(timeIndex, 1);
      next[index] = { ...next[index], reminderTimes: times };
      return next;
    });
  };

  const setReminderTime = (index, timeIndex, hour, minute) => {
    setMedicines((prev) => {
      const next = [...prev];
      const times = [...(next[index].reminderTimes || [])];
      times[timeIndex] = { hour, minute };
      next[index] = { ...next[index], reminderTimes: times };
      return next;
    });
  };

  const removeMedicine = (index) => {
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAndAddToReminders = async () => {
    if (!user?.id) {
      toast.error("Please sign in to save");
      return;
    }
    if (!file) {
      toast.error("Please upload a prescription image");
      return;
    }
    const needExpiry = medicines.filter((m) => !m.endDate);
    if (needExpiry.length) {
      toast.error(`Set expiry date for: ${needExpiry.map((m) => m.name).join(", ")}`);
      return;
    }
    const needTimes = medicines.filter((m) => !m.reminderTimes?.length);
    if (needTimes.length) {
      toast.error(`Add at least one reminder time for: ${needTimes.map((m) => m.name).join(", ")}`);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const invalidEnd = medicines.find((m) => m.endDate && m.endDate < today);
    if (invalidEnd) {
      toast.error("Expiry date must be today or later");
      return;
    }

    setSaving(true);
    try {
      const extractedText = medicines
        .map((m) => `${m.name}: ${m.dosage}. ${m.instructions}`)
        .join("\n");
      await savePrescription(
        user.id,
        file,
        extractedText,
        result?.summary || "",
        medicines.map((m) => ({
          name: m.name,
          dosage: m.dosage,
          purpose: m.purpose,
          instructions: m.instructions,
          endDate: m.endDate,
          reminderTimes: m.reminderTimes,
        }))
      );
      toast.success("Prescription saved. Reminders created.");
      navigate("/user/health/reminders");
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserLayout>
      <div className="min-h-full bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Page header – web-friendly */}
          <header className="flex items-center gap-3 mb-6">
            <Link
              to="/user/health"
              className="p-2 rounded-xl text-gray-600 hover:bg-white hover:border border border-transparent hover:border-gray-200 transition-colors"
              aria-label="Back to Health"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Scan Prescription</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Upload a photo; AI extracts medicines. Set expiry and reminder times, then save.
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left: upload & preview */}
            <div className="space-y-4">
              {!preview ? (
                <label className="block p-8 rounded-2xl border-2 border-dashed border-primary-green/40 bg-white hover:bg-primary-green/5 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  <div className="flex flex-col items-center text-center">
                    <Upload className="w-14 h-14 text-primary-green mb-4" />
                    <span className="font-semibold text-primary-green text-lg">Upload prescription</span>
                    <span className="text-sm text-gray-500 mt-1">Click or drag image (camera or gallery)</span>
                  </div>
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                    <img
                      src={preview}
                      alt="Prescription"
                      className="w-full max-h-80 object-contain bg-gray-50"
                    />
                  </div>
                  <div className="flex gap-3">
                    <label className="flex-1 py-3 rounded-xl border border-gray-200 bg-white text-center text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                      Change image
                      <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
                    </label>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="flex-1 py-3 rounded-xl bg-primary-green text-white font-semibold text-sm hover:bg-dark-green disabled:opacity-60 transition-colors"
                    >
                      {analyzing ? "Reading…" : "Analyze with AI"}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {result?.summary && (
                <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Summary</p>
                  <p className="text-sm text-gray-600 italic">{result.summary}</p>
                </div>
              )}
              {result?.warnings?.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-sm font-semibold text-amber-800 mb-2">Warnings</p>
                  <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right: medicines + expiry + times */}
            <div className="space-y-4">
              {medicines.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-gray-700">
                    Set expiry date and reminder times for each medicine, then save.
                  </p>
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {medicines.map((m, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-semibold text-gray-500">Medicine {i + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeMedicine(i)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            aria-label="Remove medicine"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="font-bold text-gray-900">{m.name}</p>
                        {m.dosage && <p className="text-sm text-gray-600 mt-0.5">Dosage: {m.dosage}</p>}
                        {m.purpose && <p className="text-sm text-gray-600 mt-0.5">Purpose: {m.purpose}</p>}
                        {m.instructions && (
                          <p className="text-sm text-gray-600 mt-0.5">Instructions: {m.instructions}</p>
                        )}

                        <div className="mt-3">
                          <label className="text-xs font-semibold text-gray-600">Expiry date</label>
                          <div className="mt-1 flex items-center gap-2">
                            <input
                              type="date"
                              value={m.endDate || ""}
                              min={formatDate(new Date())}
                              onChange={(e) => setMedicineEndDate(i, e.target.value || null)}
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green"
                            />
                            <Calendar className="w-5 h-5 text-primary-green shrink-0" />
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                              <Clock className="w-4 h-4" /> Reminder times
                            </label>
                            <button
                              type="button"
                              onClick={() => addReminderTime(i)}
                              className="text-xs font-medium text-primary-green hover:underline"
                            >
                              <Plus className="w-3.5 h-3.5 inline mr-0.5" /> Add time
                            </button>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {(m.reminderTimes || []).map((t, ti) => (
                              <div key={ti} className="flex items-center gap-1 rounded-lg bg-primary-green/10 px-2 py-1">
                                <input
                                  type="time"
                                  value={`${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`}
                                  onChange={(e) => {
                                    const [h, min] = (e.target.value || "08:00").split(":").map(Number);
                                    setReminderTime(i, ti, h, min);
                                  }}
                                  className="bg-transparent border-none text-sm w-20 focus:ring-0 p-0"
                                />
                                {(m.reminderTimes?.length || 0) > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeReminderTime(i, ti)}
                                    className="text-gray-500 hover:text-red-500 p-0.5"
                                    aria-label="Remove time"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleSaveAndAddToReminders}
                      disabled={saving}
                      className="w-full py-3.5 rounded-xl bg-primary-green text-white font-semibold hover:bg-dark-green disabled:opacity-60 transition-colors"
                    >
                      {saving ? "Saving…" : "Save Prescription & Create Reminders"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white/60 p-8 text-center">
                  <p className="text-gray-500">Upload and analyze a prescription to set expiry and reminder times here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
