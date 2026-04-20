import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import VendorLayout from "../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../components/VendorRouteGuard.jsx";
import { useVendorDashboard } from "../../context/VendorDashboardContext.jsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { vendorOrderRowLabel, vendorOrderRowStatusKey } from "../../lib/vendorOrderService.js";
import {
  Pill,
  ShoppingCart,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

const PERIODS = ["Day", "Week", "Month"];

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
  orange: {
    border: "rgba(255,143,107,0.1)",
    bg: "linear-gradient(135deg, rgba(255,143,107,0.05), rgba(255,143,107,0.02))",
    iconBg: "linear-gradient(135deg, #FF8F6B, #FF7555)",
    shadow: "0 4px 8px rgba(255,143,107,0.25)",
    valueClass: "text-primary-orange",
  },
  purple: {
    border: "rgba(96,91,255,0.1)",
    bg: "linear-gradient(135deg, rgba(96,91,255,0.05), rgba(96,91,255,0.02))",
    iconBg: "linear-gradient(135deg, #605BFF, #4B49CC)",
    shadow: "0 4px 8px rgba(96,91,255,0.25)",
    valueClass: "text-primary-purple",
  },
  warning: {
    border: "rgba(255,195,39,0.2)",
    bg: "linear-gradient(135deg, rgba(255,195,39,0.08), rgba(255,195,39,0.03))",
    iconBg: "linear-gradient(135deg, #FFC327, #E6AC00)",
    shadow: "0 4px 8px rgba(255,195,39,0.3)",
    valueClass: "text-warning",
  },
};

const ordersPerDay = [
  { label: "Mon", orders: 0 },
  { label: "Tue", orders: 0 },
  { label: "Wed", orders: 0 },
  { label: "Thu", orders: 0 },
  { label: "Fri", orders: 0 },
  { label: "Sat", orders: 0 },
  { label: "Sun", orders: 0 },
];

function formatCurrency(amount) {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toFixed(0)}`;
}

function statusColorFromKey(key) {
  switch (key) {
    case "awaiting_payment":
      return "#FFC327";
    case "pending_ship":
      return "#2859C5";
    case "on_the_way":
      return "#605BFF";
    case "delivered":
      return "#008F0B";
    case "cancelled":
      return "#FF8F6B";
    default:
      return "#6b7280";
  }
}

export default function VendorDashboard() {
  const {
    pharmacy,
    orders,
    totalMedicines,
    totalOrders,
    lowStockCount,
    totalRevenue,
    loading,
    error,
    refresh,
  } = useVendorDashboard();

  const overviewCards = useMemo(
    () => [
      { label: "Total Medicines", value: String(totalMedicines), icon: Pill, style: CARD_STYLES.green },
      { label: "Customer Orders", value: String(totalOrders), icon: ShoppingCart, style: CARD_STYLES.blue },
      { label: "Low Stock Alerts", value: String(lowStockCount), icon: AlertTriangle, style: CARD_STYLES.warning },
      { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: DollarSign, style: CARD_STYLES.purple },
    ],
    [totalMedicines, totalOrders, lowStockCount, totalRevenue]
  );

  const chartData = useMemo(() => {
    const byDay = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const o of orders) {
      const d = o.createdAt ? new Date(o.createdAt) : new Date();
      const day = days[d.getDay()];
      if (byDay[day] !== undefined) byDay[day]++;
    }
    return Object.entries(byDay).map(([label, orders]) => ({ label, orders }));
  }, [orders]);

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full">
          <div className="px-4 sm:px-6 py-4 pb-6 max-w-7xl mx-auto">
            {/* Header with refresh */}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-text-primary">Overview</h1>
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="text-sm text-primary-green hover:underline font-medium disabled:opacity-50"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {/* Overview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {overviewCards.map(({ label, value, icon: Icon, style: s }) => (
                <div
                  key={label}
                  className="rounded-xl p-4 border shadow-[0_4px_10px_var(--color-card-shadow)] transition-shadow hover:shadow-md"
                  style={{ borderColor: s.border, background: s.bg }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="w-11 h-11 rounded-[14px] flex items-center justify-center shadow-lg"
                      style={{ background: s.iconBg, boxShadow: s.shadow }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold tracking-tight mt-3 ${s.valueClass}`}>
                    {loading ? "…" : value}
                  </p>
                  <p className="text-xs font-medium text-text-secondary mt-0.5 truncate">{label}</p>
                </div>
              ))}
            </div>

            {/* Orders chart */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden mb-5">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary-green/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary-green" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Orders</h2>
                  <p className="text-xs text-gray-500">Orders per week (recent)</p>
                </div>
              </div>
              <div className="p-4">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                        formatter={(value) => [`${value} orders`, "Orders"]}
                      />
                      <Bar dataKey="orders" fill="#008F0B" radius={[6, 6, 0, 0]} name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent orders */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-text-primary">Recent Customer Orders</h2>
              <Link
                to="/vendor/orders"
                className="text-primary-green font-semibold text-sm hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden mb-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background text-text-secondary text-left">
                      <th className="px-5 py-3">Order ID</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Total</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-text-secondary">
                          Loading…
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-text-secondary">
                          No orders yet
                        </td>
                      </tr>
                    ) : (
                      orders.slice(0, 5).map((order) => (
                        <tr key={order.id} className="border-t border-border hover:bg-background/50">
                          <td className="px-5 py-3 text-text-primary font-medium font-mono text-xs">
                            #{order.id.slice(0, 8)}
                          </td>
                          <td className="px-5 py-3 text-text-primary">{order.customerName ?? "Customer"}</td>
                          <td className="px-5 py-3 text-primary-green font-semibold">
                            ${order.totalAmount?.toFixed(2) ?? "0.00"}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="font-semibold"
                              style={{ color: statusColorFromKey(vendorOrderRowStatusKey(order)) }}
                            >
                              {vendorOrderRowLabel(order)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <Link
                              to={`/vendor/orders/${order.id}`}
                              className="text-primary-green font-semibold text-xs hover:underline inline-flex items-center gap-1"
                            >
                              View <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </VendorLayout>
    </VendorRouteGuard>
  );
}
