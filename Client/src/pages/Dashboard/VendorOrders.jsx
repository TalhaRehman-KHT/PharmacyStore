import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import VendorLayout from "../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../components/VendorRouteGuard.jsx";
import { useVendorDashboard } from "../../context/VendorDashboardContext.jsx";
import {
  getPharmacyOrders,
  vendorOrderRowLabel,
  vendorOrderRowStatusKey,
} from "../../lib/vendorOrderService.js";
import { Package, Clock, Truck, CheckCircle, ShoppingBag, Search, X, ChevronRight } from "lucide-react";

const FILTERS = ["All", "Unpaid", "Pending", "On the way", "Delivered", "Cancelled"];

const rowStatusColors = {
  awaiting_payment: { bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  pending_ship: { bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  on_the_way: { bg: "rgba(96,91,255,0.12)", text: "#4B49CC" },
  delivered: { bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
  cancelled: { bg: "rgba(255,143,107,0.15)", text: "#c2410c" },
};

function CombinedStatusCell({ order }) {
  const key = vendorOrderRowStatusKey(order);
  const style = rowStatusColors[key] || rowStatusColors.awaiting_payment;
  const main = vendorOrderRowLabel(order);
  const paid = order.paymentStatus === "paid";
  const admin = (order.adminPaymentStatus || "").toLowerCase() || (paid ? "pending" : null);

  return (
    <div className="space-y-1">
      <span
        className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold"
        style={{ backgroundColor: style.bg, color: style.text }}
      >
        {main}
      </span>
      <div className="text-[11px] text-gray-500 leading-snug">
        <span className="text-gray-600">Stripe:</span> {paid ? "Paid" : "Unpaid"}
        {paid && (
          <>
            {" · "}
            <span className="text-gray-600">Payout:</span>{" "}
            {admin === "approved" ? "Approved" : admin === "rejected" ? "Rejected" : "Pending"}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18` }}
        >
          <Icon className="w-5 h-5 shrink-0" style={{ color }} />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500 font-medium">{title}</p>
        </div>
      </div>
    </div>
  );
}

export default function VendorOrders() {
  const { pharmacy } = useVendorDashboard();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");

  useEffect(() => {
    if (!pharmacy?.id) return;
    setLoading(true);
    getPharmacyOrders(pharmacy.id, {
      filter: selectedFilter !== "All" ? selectedFilter : undefined,
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

  const unpaidCount = orders.filter(
    (o) => o.paymentStatus !== "paid" && o.fulfillmentStatus !== "cancelled"
  ).length;
  const toShipCount = orders.filter(
    (o) => o.paymentStatus === "paid" && o.fulfillmentStatus === "pending"
  ).length;
  const onTheWayCount = orders.filter((o) => o.fulfillmentStatus === "on_the_way").length;
  const deliveredCount = orders.filter((o) => o.fulfillmentStatus === "delivered").length;

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full bg-[#f5f5f5]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Update delivery status (pending → on the way → delivered). Stripe payment and admin payout are shown for
                reference.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard title="Unpaid" value={unpaidCount} icon={Clock} color="#FFC327" />
              <StatCard title="Paid · to ship" value={toShipCount} icon={Package} color="#2859C5" />
              <StatCard title="On the way" value={onTheWayCount} icon={Truck} color="#605BFF" />
              <StatCard title="Delivered" value={deliveredCount} icon={CheckCircle} color="#008F0B" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setSelectedFilter(filter)}
                      className={`shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        filter === selectedFilter
                          ? "bg-primary-green text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-72 sm:ml-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search order or customer…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-green/20"
                  />
                  {search.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
                      aria-label="Clear"
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
                  <p className="text-sm font-medium">Loading…</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <ShoppingBag className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm font-medium">
                    {orders.length === 0 ? "No orders yet" : "No matches"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 min-w-[200px]">Status</th>
                        <th className="px-4 py-3 w-24" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => (
                        <tr
                          key={o.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-4 py-3 align-top">
                            <span className="font-mono text-xs font-medium text-gray-900">#{o.id.slice(0, 8)}</span>
                            <p className="text-[11px] text-gray-400 mt-0.5">{o.orderDate ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3 align-top text-gray-800">{o.customerName ?? "—"}</td>
                          <td className="px-4 py-3 align-top text-right font-semibold text-primary-green whitespace-nowrap">
                            ${o.totalAmount?.toFixed(2) ?? "0.00"}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <CombinedStatusCell order={o} />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <Link
                              to={`/vendor/orders/${o.id}`}
                              className="inline-flex items-center gap-0.5 text-primary-green text-xs font-semibold hover:underline whitespace-nowrap"
                            >
                              Manage
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
