import React, { useCallback, useState } from "react";
import { Inbox, RefreshCw, X } from "lucide-react";
import VendorLayout from "../../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../../components/VendorRouteGuard.jsx";
import { useEscalations } from "../hooks/useEscalations.js";
import { useEscalationInsights } from "../hooks/useEscalationInsights.js";
import EscalationList from "../components/EscalationList.jsx";
import EscalationDrawer from "../components/EscalationDrawer.jsx";
import EscalationInsightsCard from "../components/EscalationInsightsCard.jsx";
import MockBadge from "../components/MockBadge.jsx";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "answered", label: "Answered" },
];

export default function VendorEscalations() {
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState(null);
  const pending = useEscalations("pending");
  const answered = useEscalations("answered");
  const insights = useEscalationInsights();
  const current = tab === "pending" ? pending : answered;
  const counts = { pending: pending.escalations.length, answered: answered.escalations.length };

  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">Escalations</h1>
                <MockBadge />
              </div>
              <p className="text-gray-500 mt-1 text-sm">
                Questions MedAssist sent to a pharmacist. Your reply appears in the customer's chat.
              </p>
            </div>

            <EscalationInsightsCard
              topMedicines={insights.topMedicines}
              unhelpfulCount={insights.unhelpfulCount}
              loading={insights.loading}
              error={insights.error}
            />

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Escalation status">
                  {TABS.map(({ key, label }) => {
                    const active = tab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTab(key)}
                        className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          active ? "bg-primary-green text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                        {counts[key] > 0 && (
                          <span
                            className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                              active
                                ? "bg-white text-primary-green"
                                : key === "pending"
                                  ? "bg-primary-orange text-white"
                                  : "bg-gray-300 text-gray-700"
                            }`}
                          >
                            {counts[key]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={current.refresh}
                  disabled={current.loading}
                  className="p-2 rounded-xl text-primary-green hover:bg-primary-green/10 transition-colors disabled:opacity-50"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`w-5 h-5 ${current.loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" role="tabpanel">
              {current.loading && current.escalations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-green border-t-transparent mb-3" />
                  <p className="text-sm font-medium">Loading…</p>
                </div>
              ) : current.error ? (
                <div className="p-5 sm:p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <p className="text-text-primary font-semibold mb-1">Failed to load escalations</p>
                  <p className="text-text-secondary text-sm mb-6">{current.error.message}</p>
                  <button
                    type="button"
                    onClick={current.refresh}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-green text-primary-green font-medium hover:bg-primary-green/10"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              ) : current.escalations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <Inbox className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm font-medium">
                    {tab === "pending" ? "No questions waiting. Nice work!" : "No answered questions yet"}
                  </p>
                </div>
              ) : (
                <EscalationList escalations={current.escalations} onOpen={setSelected} />
              )}
            </div>
          </div>
        </div>

        <EscalationDrawer
          key={selected?.id ?? "none"}
          escalation={selected}
          onClose={closeDrawer}
          onReply={pending.reply}
          replying={Boolean(selected) && pending.replyingId === selected.id}
        />
      </VendorLayout>
    </VendorRouteGuard>
  );
}
