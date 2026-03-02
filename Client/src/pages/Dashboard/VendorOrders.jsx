import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import VendorLayout from "../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../components/VendorRouteGuard.jsx";
import { useVendorDashboard } from "../../context/VendorDashboardContext.jsx";
import { getPharmacyOrders } from "../../lib/vendorOrderService.js";
import {
  Package,
  Clock,
  CheckCircle,
  ShoppingBag,
  Search,
  X,
  ChevronRight,
} from "lucide-react";

const FILTERS = ["All", "Pending", "Paid", "Completed"];

const statusColors = {
  pending: { bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  paid: { bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  completed: { bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
  cancelled: { bg: "rgba(255,143,107,0.15)", text: "#c2410c" },
};

function StatusBadge({ status }) {
  const s = (status || "pending").toLowerCase();
  const style = statusColors[s] || statusColors.pending;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {(s && s[0].toUpperCase() + s.slice(1)) || "Pending"}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18` }}
        >
          <Icon className="w-6 h-6 shrink-0" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
        </div>
      </div>
    </div>
  );
}

export default function VendorOrders() {
  const { pharmacy, refresh } = useVendorDashboard();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");

  useEffect(() => {
    if (!pharmacy?.id) return;
    setLoading(true);
    getPharmacyOrders(pharmacy.id, {
      status: selectedFilter !== "All" ? selectedFilter : undefined,
      limit: 200,
    })
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [pharmacy?.id, selectedFilter]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.id?.toLowerCase().includes(q) ||
          (o.customerName && o.customerName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, search]);

  const pendingCount = orders.filter((o) => (o.status || "").toLowerCase() === "pending").length;
  const paidCount = orders.filter((o) => (o.status || "").toLowerCase() === "paid").length;
  const completedCount = orders.filter((o) => (o.status || "").toLowerCase() === "completed").length;

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full bg-[#f5f5f5]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Customer Orders</h1>
              <p className="text-gray-500 mt-1 text-sm">
                {loading ? "Loading…" : `${orders.length} total orders`} · Search and filter below
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard title="Pending" value={pendingCount} icon={Clock} color="#FFC327" />
              <StatCard title="Paid" value={paidCount} icon={Package} color="#2859C5" />
              <StatCard title="Completed" value={completedCount} icon={CheckCircle} color="#008F0B" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((filter) => {
                    const isSelected = filter === selectedFilter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setSelectedFilter(filter)}
                        className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-primary-green text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {filter}
                      </button>
                    );
                  })}
                </div>
                <div className="relative w-full sm:w-auto sm:min-w-[240px] sm:max-w-xs sm:ml-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search by order ID or customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green"
                  />
                  {search.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-green border-t-transparent mb-3" />
                  <p className="text-sm font-medium">Loading orders…</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <ShoppingBag className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm font-medium">
                    {orders.length === 0 ? "No orders yet" : "No orders match your filter"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Order
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3.5 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => (
                        <tr
                          key={o.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-4 py-3.5 font-medium text-gray-900 font-mono text-xs">
                            #{o.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3.5 text-gray-700">{o.customerName ?? "Customer"}</td>
                          <td className="px-4 py-3.5 text-gray-500">{o.orderDate ?? "—"}</td>
                          <td className="px-4 py-3.5 font-semibold text-primary-green">
                            ${o.totalAmount?.toFixed(2) ?? "0.00"}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="px-4 py-3.5">
                            <Link
                              to={`/vendor/orders/${o.id}`}
                              className="inline-flex items-center gap-1 text-primary-green text-xs font-semibold hover:underline"
                            >
                              View
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
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
