import React, { useState, useEffect, useMemo, useCallback } from "react";
import VendorLayout from "../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../components/VendorRouteGuard.jsx";
import { getAdminOrders, updateAdminPaymentStatus } from "../../lib/adminOrderService.js";
import { Search, X, Shield } from "lucide-react";
import toast from "react-hot-toast";

const FILTERS = ["All", "Payout pending", "Payout approved", "Payout rejected"];

const fulfillLabels = {
  pending: "Pending",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [draftPayout, setDraftPayout] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    getAdminOrders({ filter: filter === "All" ? undefined : filter, limit: 200 })
      .then((rows) => {
        setOrders(rows);
        const next = {};
        for (const o of rows) {
          if (o.paymentStatus === "paid") {
            next[o.id] = (o.adminPaymentStatus || "pending").toLowerCase();
          }
        }
        setDraftPayout(next);
      })
      .catch((e) => {
        toast.error(e?.message || "Failed to load orders");
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.id?.toLowerCase().includes(q) ||
        (o.pharmacyName && o.pharmacyName.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerEmail && o.customerEmail.toLowerCase().includes(q))
    );
  }, [orders, search]);

  async function savePayout(orderId) {
    const status = draftPayout[orderId];
    if (!status) return;
    setSavingId(orderId);
    try {
      await updateAdminPaymentStatus(orderId, status);
      toast.success("Payout status saved");
      load();
    } catch (e) {
      toast.error(e?.message || "Could not update");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full bg-[#f5f5f5]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex flex-wrap items-start gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-primary-green/15 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-primary-green" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vendor payouts</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  After Stripe marks an order paid, set payout to <span className="font-medium">Approved</span> when the
                  vendor should receive funds, or <span className="font-medium">Pending</span> /{" "}
                  <span className="font-medium">Rejected</span> as needed.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        filter === f ? "bg-primary-green text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search order, pharmacy, customer…"
                    className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-green/20"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Clear"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="py-16 flex justify-center">
                  <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-12 text-center text-gray-500 text-sm">No orders match.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Pharmacy</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Delivery</th>
                        <th className="px-4 py-3 min-w-[200px]">Vendor payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o) => (
                        <tr key={o.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40">
                          <td className="px-4 py-3 font-mono text-xs text-gray-900">#{String(o.id).slice(0, 8)}</td>
                          <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate" title={o.pharmacyName}>
                            {o.pharmacyName}
                          </td>
                          <td className="px-4 py-3 text-gray-700 max-w-[160px]">
                            <div className="truncate font-medium">{o.customerName}</div>
                            <div className="truncate text-xs text-gray-400">{o.customerEmail}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary-green whitespace-nowrap">
                            ${o.totalAmount?.toFixed(2) ?? "0.00"}
                          </td>
                          <td className="px-4 py-3 text-gray-700 capitalize">
                            {fulfillLabels[o.fulfillmentStatus] ?? o.fulfillmentStatus}
                          </td>
                          <td className="px-4 py-3">
                            {o.paymentStatus !== "paid" ? (
                              <span className="text-xs text-gray-400">— unpaid</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={draftPayout[o.id] ?? "pending"}
                                  onChange={(e) =>
                                    setDraftPayout((prev) => ({ ...prev, [o.id]: e.target.value }))
                                  }
                                  className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="approved">Approved</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                                <button
                                  type="button"
                                  disabled={
                                    savingId === o.id ||
                                    (draftPayout[o.id] ?? "pending") ===
                                      (o.adminPaymentStatus || "pending").toLowerCase()
                                  }
                                  onClick={() => savePayout(o.id)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-green text-white disabled:opacity-40"
                                >
                                  {savingId === o.id ? "…" : "Save"}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </VendorLayout>
    </VendorRouteGuard>
  );
}
