import React, { useState, useEffect, useContext } from "react";
import UserLayout from "../../components/UserLayout.jsx";
import { getUserOrders } from "../../lib/userOrderService.js";
import { AuthContext } from "../../context/AuthContext.jsx";
import { ShoppingBag, ChevronRight } from "lucide-react";

const FILTERS = ["All", "Pending", "Paid", "Completed", "Cancelled"];

const statusColors = {
  pending: { bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  paid: { bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  completed: { bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
  cancelled: { bg: "rgba(255,143,107,0.15)", text: "#c2410c" },
};

function StatusBadge({ status }) {
  const key = (status || "pending").toLowerCase();
  const style = statusColors[key] || statusColors.pending;
  const label = status ? status[0].toUpperCase() + status.slice(1) : "Pending";
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-lg"
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
    const status = filter === "All" ? undefined : filter.toLowerCase();
    getUserOrders(user.id, { status })
      .then(setOrders)
      .catch((err) => setError(err.message || "Failed to load orders"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [user?.id, filter]);

  return (
    <UserLayout>
      <div className="px-4 sm:px-6 py-4 max-w-7xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-3">My Orders</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-6 text-center">
            <p className="text-text-secondary mb-4">{error}</p>
            <button
              type="button"
              onClick={loadOrders}
              className="text-primary-green font-semibold hover:underline"
            >
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
                  className={`px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
                    filter === f
                      ? "bg-primary-green text-white shadow-lg shadow-primary-green/25"
                      : "bg-white text-gray-500 border border-gray-200 shadow-sm hover:border-primary-green/50"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-green/10 flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-primary-green" />
                </div>
                <p className="text-text-secondary font-medium">
                  {filter === "All" ? "No orders yet" : "No orders match your filter"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const statusColor = statusColors[order.status] || statusColors.pending;
                  const itemsPreview = order.items
                    .slice(0, 2)
                    .map((i) => i.medicineName)
                    .join(", ") + (order.items.length > 2 ? "..." : "");
                  const itemCount = order.items.length;
                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-3 flex items-center gap-3 hover:shadow-md transition-shadow"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${statusColor.text}, ${statusColor.text}cc)`,
                          boxShadow: `0 4px 8px ${statusColor.text}4d`,
                        }}
                      >
                        <ShoppingBag className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text-primary">Order #{order.id}</p>
                        <p className="text-sm text-text-secondary truncate">{itemsPreview || "No items"}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <StatusBadge status={order.status} />
                          <span className="text-xs text-text-secondary">
                            {itemCount} {itemCount === 1 ? "item" : "items"}
                          </span>
                          <span className="text-xs text-text-secondary">• {order.orderDate}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary-green">
                          ${order.totalAmount != null ? order.totalAmount.toFixed(2) : "N/A"}
                        </p>
                        <ChevronRight className="w-5 h-5 text-text-secondary ml-auto mt-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </UserLayout>
  );
}
