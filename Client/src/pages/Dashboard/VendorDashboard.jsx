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
  Plus,
  FileText,
  CalendarClock,
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
          <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-text-primary truncate">Dashboard</h1>
                <p className="text-sm text-text-secondary mt-0.5 truncate">
                  {pharmacy?.name ? `Overview for ${pharmacy.name}` : "Track orders, inventory and revenue"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading}
                  className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl border border-border bg-white text-sm font-semibold text-text-primary hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
                <Link
                  to="/vendor/medicine"
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-primary-green text-white text-sm font-semibold hover:bg-dark-green"
                >
                  <Plus className="w-4 h-4" />
                  Add medicine
                </Link>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-2xl border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary-green/10 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-5 h-5 text-primary-green" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-text-primary truncate">Orders trend</h2>
                        <p className="text-xs text-text-secondary truncate">Orders per week (recent)</p>
                      </div>
                    </div>
                    <Link to="/vendor/orders" className="text-primary-green font-semibold text-sm hover:underline shrink-0">
                      View orders
                    </Link>
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

                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-text-primary">Recent orders</h2>
                  <Link to="/vendor/orders" className="text-primary-green font-semibold text-sm hover:underline">
                    View all
                  </Link>
                </div>
                <div className="bg-white rounded-2xl border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-background text-text-secondary text-left">
                          <th className="px-5 py-3">Order</th>
                          <th className="px-5 py-3">Customer</th>
                          <th className="px-5 py-3 text-right">Total</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-10 text-center text-text-secondary">
                              Loading…
                            </td>
                          </tr>
                        ) : orders.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-10 text-center text-text-secondary">
                              No orders yet
                            </td>
                          </tr>
                        ) : (
                          orders.slice(0, 6).map((order) => (
                            <tr key={order.id} className="border-t border-border hover:bg-background/50">
                              <td className="px-5 py-3 text-text-primary font-medium font-mono text-xs whitespace-nowrap">
                                #{order.id.slice(0, 8)}
                              </td>
                              <td className="px-5 py-3 text-text-primary">{order.customerName ?? "Customer"}</td>
                              <td className="px-5 py-3 text-right text-primary-green font-semibold whitespace-nowrap">
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
                                  className="text-primary-green font-semibold text-xs hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                  Manage <ChevronRight className="w-3.5 h-3.5" />
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

              <aside className="space-y-5">
                <div className="bg-white rounded-2xl border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-sm font-bold text-text-primary">Quick actions</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Common vendor tasks</p>
                  </div>
                  <div className="p-4 space-y-2">
                    <Link
                      to="/vendor/medicine"
                      className="w-full inline-flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border hover:bg-gray-50"
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                        <Pill className="w-4 h-4 text-primary-green" />
                        Manage inventory
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                    <Link
                      to="/vendor/orders"
                      className="w-full inline-flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border hover:bg-gray-50"
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                        <ShoppingCart className="w-4 h-4 text-primary-blue" />
                        Process orders
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                    <Link
                      to="/vendor/reports"
                      className="w-full inline-flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border hover:bg-gray-50"
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                        <FileText className="w-4 h-4 text-primary-purple" />
                        View reports
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-sm font-bold text-text-primary">Inventory alerts</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Stay ahead of stock issues</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        <span className="text-sm font-semibold text-text-primary">Low stock</span>
                      </div>
                      <span className="text-sm font-bold text-text-primary">{loading ? "…" : lowStockCount}</span>
                    </div>
                    <Link
                      to="/vendor/medicine"
                      className="inline-flex items-center justify-between gap-3 w-full px-4 py-2.5 rounded-xl bg-background hover:bg-gray-100 text-sm font-semibold text-primary-green"
                    >
                      Review inventory
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/vendor/expiring-soon"
                      className="inline-flex items-center justify-between gap-3 w-full px-4 py-2.5 rounded-xl bg-background hover:bg-gray-100 text-sm font-semibold text-text-primary"
                    >
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-primary-orange" />
                        Expiring soon
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </VendorLayout>
    </VendorRouteGuard>
  );
}
