import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import {
  getUserOrders,
  userOrderBadgeKey,
  userOrderSummaryLabel,
} from "../../lib/userOrderService.js";
import { AuthContext } from "../../context/AuthContext.jsx";
import { ShoppingBag, ChevronRight } from "lucide-react";

const FILTERS = ["All", "Pending", "On the way", "Delivered", "Cancelled"];

const badgeColors = {
  awaiting_payment: { bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  preparing: { bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  on_the_way: { bg: "rgba(96,91,255,0.12)", text: "#4B49CC" },
  delivered: { bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
  cancelled: { bg: "rgba(255,143,107,0.15)", text: "#c2410c" },
};

function StatusBadge({ order }) {
  const key = userOrderBadgeKey(order);
  const style = badgeColors[key] || badgeColors.awaiting_payment;
  const label = userOrderSummaryLabel(order);
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {label}
    </span>
  );
}

export default function UserOrders() {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");

  const loadOrders = () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const filterParam = filter === "All" ? undefined : filter;
    getUserOrders(user.id, { filter: filterParam })
      .then(setOrders)
      .catch((err) => setError(err.message || "Failed to load orders"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [user?.id, filter]);

  return (
    <UserLayout>
      <div className="px-4 sm:px-6 py-4 max-w-5xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-1">My orders</h2>
        <p className="text-sm text-text-secondary mb-4">
          Track payment and delivery: <span className="font-medium">Pending</span> includes unpaid or paid orders still
          being prepared.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-text-secondary mb-4">{error}</p>
            <button type="button" onClick={loadOrders} className="text-primary-green font-semibold hover:underline">
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    filter === f
                      ? "bg-primary-green text-white shadow-md"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-primary-green/40"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-green/10 flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-primary-green" />
                </div>
                <p className="text-text-secondary font-medium">
                  {filter === "All" ? "No orders yet" : "No orders match this filter"}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/90 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Pharmacy</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-900">#{String(order.id).slice(0, 8)}</td>
                          <td className="px-4 py-3 text-gray-800 max-w-[180px] truncate" title={order.pharmacyName}>
                            {order.pharmacyName}
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{order.orderDate}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary-green whitespace-nowrap">
                            ${order.totalAmount != null ? order.totalAmount.toFixed(2) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge order={order} />
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/user/orders/${order.id}`}
                              className="inline-flex items-center gap-0.5 text-primary-green text-xs font-bold hover:underline"
                            >
                              View
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {orders.map((order) => {
                    const key = userOrderBadgeKey(order);
                    const statusColor = badgeColors[key] || badgeColors.awaiting_payment;
                    const itemsPreview =
                      order.items
                        .slice(0, 2)
                        .map((i) => i.medicineName)
                        .join(", ") + (order.items.length > 2 ? "…" : "");
                    return (
                      <Link
                        key={order.id}
                        to={`/user/orders/${order.id}`}
                        className="block bg-white rounded-xl border border-gray-100 shadow-sm p-3 active:scale-[0.99] transition-transform"
                      >
                        <div className="flex gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${statusColor.text}, ${statusColor.text}cc)`,
                            }}
                          >
                            <ShoppingBag className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-2">
                              <p className="font-bold text-text-primary text-sm">#{String(order.id).slice(0, 8)}</p>
                              <p className="font-bold text-primary-green text-sm shrink-0">
                                ${order.totalAmount != null ? order.totalAmount.toFixed(2) : "—"}
                              </p>
                            </div>
                            <p className="text-xs text-text-secondary truncate mt-0.5">{order.pharmacyName}</p>
                            <p className="text-xs text-text-secondary truncate">{itemsPreview || "—"}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <StatusBadge order={order} />
                              <span className="text-xs text-gray-400">{order.orderDate}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 mt-2" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </UserLayout>
  );
}
