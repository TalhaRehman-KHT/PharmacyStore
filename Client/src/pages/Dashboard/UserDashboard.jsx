import React, { useContext, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import UserLayout from "../../components/UserLayout.jsx";
import {
  getUserOrders,
  userOrderBadgeKey,
  userOrderSummaryLabel,
} from "../../lib/userOrderService.js";
import { getCartsForUser } from "../../lib/userCartService.js";
import { getCustomerStats } from "../../lib/customerStatsService.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ShoppingBag,
  FileText,
  BarChart3,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

const CARD_STYLES = {
  green: {
    border: "rgba(0,143,11,0.1)",
    bg: "linear-gradient(135deg, rgba(0,143,11,0.05), rgba(0,143,11,0.02))",
    iconBg: "linear-gradient(135deg, #008F0B, #007009)",
    shadow: "0 4px 8px rgba(0,143,11,0.25)",
    valueClass: "text-primary-green",
  },
  blue: {
    border: "rgba(40,89,197,0.1)",
    bg: "linear-gradient(135deg, rgba(40,89,197,0.05), rgba(40,89,197,0.02))",
    iconBg: "linear-gradient(135deg, #2859C5, #1E47A0)",
    shadow: "0 4px 8px rgba(40,89,197,0.25)",
    valueClass: "text-primary-blue",
  },
};

const activityDefaults = [
  { label: "Prescriptions", value: 0, fill: "#008F0B" },
  { label: "Reminders", value: 0, fill: "#2859C5" },
  { label: "Cart", value: 0, fill: "#FF8F6B" },
];

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
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {label}
    </span>
  );
}

export default function UserDashboard() {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [activityData, setActivityData] = useState(activityDefaults);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user?.id) {
      setOrders([]);
      setActivityData(activityDefaults);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getUserOrders(user.id, { limit: 100 }),
      getCartsForUser(user.id).catch(() => []),
      getCustomerStats(user.id).catch(() => ({ prescriptions: 0, reminders: 0 })),
    ])
      .then(([orderList, carts, stats]) => {
        setOrders(orderList);
        const cartItems = carts.reduce((s, c) => s + (c.items?.length ?? 0), 0);
        setActivityData([
          { label: "Prescriptions", value: stats?.prescriptions ?? 0, fill: "#008F0B" },
          { label: "Reminders", value: stats?.reminders ?? 0, fill: "#2859C5" },
          { label: "Cart", value: cartItems, fill: "#FF8F6B" },
        ]);
      })
      .catch(() => {
        setOrders([]);
        setActivityData(activityDefaults);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = orders.filter(
    (o) => o.fulfillmentStatus !== "cancelled" && o.fulfillmentStatus !== "delivered"
  ).length;
  const totalOrders = orders.length;
  const recentOrders = orders.slice(0, 5);

  return (
    <UserLayout>
      <div className="min-h-full">
        <div className="px-4 sm:px-6 py-4 pb-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Home</h1>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="p-2 rounded-xl text-primary-green hover:bg-primary-green/10 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <div
                className="rounded-xl p-4 border shadow-[0_4px_10px_var(--color-card-shadow)] transition-shadow hover:shadow-md"
              style={{ borderColor: CARD_STYLES.green.border, background: CARD_STYLES.green.bg }}
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-11 h-11 rounded-[14px] flex items-center justify-center shadow-lg"
                  style={{ background: CARD_STYLES.green.iconBg, boxShadow: CARD_STYLES.green.shadow }}
                >
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
              </div>
                <p className={`text-2xl font-bold tracking-tight mt-2 ${CARD_STYLES.green.valueClass}`}>
                {loading ? "—" : activeCount}
              </p>
              <p className="text-xs font-medium text-text-secondary mt-0.5 truncate">Active Orders</p>
            </div>
            <div
                className="rounded-xl p-4 border shadow-[0_4px_10px_var(--color-card-shadow)] transition-shadow hover:shadow-md"
              style={{ borderColor: CARD_STYLES.blue.border, background: CARD_STYLES.blue.bg }}
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-11 h-11 rounded-[14px] flex items-center justify-center shadow-lg"
                  style={{ background: CARD_STYLES.blue.iconBg, boxShadow: CARD_STYLES.blue.shadow }}
                >
                  <FileText className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className={`text-2xl font-bold tracking-tight mt-3 ${CARD_STYLES.blue.valueClass}`}>
                {loading ? "—" : totalOrders}
              </p>
              <p className="text-xs font-medium text-text-secondary mt-0.5 truncate">Total Orders</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary-green/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary-green" />
              </div>
              <div>
            <h2 className="text-base font-bold text-gray-900">Your Activity</h2>
            <p className="text-xs text-gray-500">Prescriptions, reminders & cart</p>
              </div>
            </div>
            <div className="p-4">
              <div className="h-[160px] w-full">
                {activityData.every((d) => d.value === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-text-secondary">
                    <BarChart3 className="w-12 h-12 opacity-50 mb-2" />
                    <p className="text-sm font-medium">No activity data yet</p>
                    <p className="text-xs mt-1 opacity-80">Scan prescriptions, add reminders or shop</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                        formatter={(value, name, props) => [value, props.payload?.label]}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={32}>
                        {activityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill || "#008F0B"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
            <Link to="/user/orders" className="text-primary-green font-semibold text-sm hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {recentOrders.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-6 flex flex-col items-center justify-center text-center">
                <ShoppingBag className="w-12 h-12 text-text-secondary/50 mb-3" />
                <p className="text-sm text-gray-500">No orders yet</p>
              </div>
            ) : (
              recentOrders.map((order) => {
                const itemsPreview = order.items
                  .slice(0, 2)
                  .map((i) => i.medicineName)
                  .join(", ") + (order.items.length > 2 ? "..." : "");
                const sc = badgeColors[userOrderBadgeKey(order)] || badgeColors.awaiting_payment;
                return (
                  <Link
                    key={order.id}
                    to={`/user/orders/${order.id}`}
                    className="flex bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-3 items-center gap-3 hover:shadow-md transition-shadow group"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${sc.text}, ${sc.text}cc)`,
                        boxShadow: `0 4px 8px ${sc.text}4d`,
                      }}
                    >
                      <ShoppingBag className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-gray-900 truncate">Order #{order.id}</p>
                      <p className="text-[13px] text-gray-500 truncate mt-0.5">{itemsPreview || "No items"}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge order={order} />
                        <span className="text-xs text-gray-500">
                          {order.items.length} {order.items.length === 1 ? "item" : "items"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-green transition-colors shrink-0" />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
