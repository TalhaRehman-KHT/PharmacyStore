import React, { useContext, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import VendorLayout from "../../components/VendorLayout.jsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Pill,
  ShoppingCart,
  AlertTriangle,
  DollarSign,
  TrendingUp,
} from "lucide-react";

const PERIODS = ["Day", "Week", "Month"];

// Sample data: orders per day (last 7 days)
const ordersPerDay = [
  { label: "Mon", orders: 12 },
  { label: "Tue", orders: 19 },
  { label: "Wed", orders: 15 },
  { label: "Thu", orders: 22 },
  { label: "Fri", orders: 28 },
  { label: "Sat", orders: 35 },
  { label: "Sun", orders: 24 },
];

// Sample data: orders per week (last 6 weeks)
const ordersPerWeek = [
  { label: "W1", orders: 98 },
  { label: "W2", orders: 112 },
  { label: "W3", orders: 105 },
  { label: "W4", orders: 134 },
  { label: "W5", orders: 121 },
  { label: "W6", orders: 155 },
];

// Sample data: orders per month (all 12 months)
const ordersPerMonth = [
  { label: "Jan", orders: 420 },
  { label: "Feb", orders: 380 },
  { label: "Mar", orders: 445 },
  { label: "Apr", orders: 512 },
  { label: "May", orders: 478 },
  { label: "Jun", orders: 535 },
  { label: "Jul", orders: 498 },
  { label: "Aug", orders: 522 },
  { label: "Sep", orders: 465 },
  { label: "Oct", orders: 548 },
  { label: "Nov", orders: 510 },
  { label: "Dec", orders: 592 },
];

/* my_fyp StatCard-style: gradient bg, colored icon box, value bold */
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

const overviewCards = [
  { label: "Total Medicines", value: "248", icon: Pill, style: CARD_STYLES.green },
  { label: "Customer Orders", value: "1,420", icon: ShoppingCart, style: CARD_STYLES.blue },
  { label: "Low Stock Alerts", value: "12", icon: AlertTriangle, style: CARD_STYLES.warning },
  { label: "Total Revenue", value: "$24.5k", icon: DollarSign, style: CARD_STYLES.purple },
];

const recentOrders = [
  { id: "#ORD-001", customer: "John Doe", total: 45.99, status: "Pending" },
  { id: "#ORD-002", customer: "Jane Smith", total: 128.50, status: "Completed" },
  { id: "#ORD-003", customer: "HealthPlus", total: 320.00, status: "Pending" },
];

export default function VendorDashboard() {
  const { user } = useContext(AuthContext);
  const [chartPeriod, setChartPeriod] = useState("Day");

  const chartData = useMemo(() => {
    if (chartPeriod === "Week") return ordersPerWeek;
    if (chartPeriod === "Month") return ordersPerMonth;
    return ordersPerDay;
  }, [chartPeriod]);

  return (
    <VendorLayout>
      <div className="min-h-full">
        <div className="px-4 sm:px-6 py-4 pb-6 max-w-7xl mx-auto">
          {/* 1) Overview: Total Medicines, Customer Orders, Low Stock, Total Revenue */}
          <h2 className="text-xl font-bold text-text-primary mb-3">Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {overviewCards.map(({ label, value, icon: Icon, style: s }) => (
              <div
                key={label}
                className="rounded-xl p-4 border shadow-[0_4px_10px_var(--color-card-shadow)] transition-shadow hover:shadow-md"
                style={{
                  borderColor: s.border,
                  background: s.bg,
                }}
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
                  {value}
                </p>
                <p className="text-xs font-medium text-text-secondary mt-0.5 truncate">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* 2) Orders chart: Day / Week / Month */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary-green/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary-green" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Orders</h2>
                  <p className="text-xs text-gray-500">Orders per {chartPeriod.toLowerCase()}</p>
                </div>
              </div>
              <div className="flex rounded-xl bg-gray-100 p-1">
                {PERIODS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setChartPeriod(period)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      chartPeriod === period
                        ? "bg-white text-primary-green shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <div className="h-56 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: chartPeriod === "Month" ? 8 : 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="label"
                      interval={0}
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
                      labelStyle={{ color: "#1f2937", fontWeight: 600 }}
                      formatter={(value) => [`${value} orders`, "Orders"]}
                      labelFormatter={(label) => (chartPeriod === "Day" ? label : chartPeriod === "Week" ? `Week ${label}` : label)}
                    />
                    <Bar
                      dataKey="orders"
                      fill="#008F0B"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={chartPeriod === "Month" ? 28 : 48}
                      name="Orders"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 3) Recent Customer Orders */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-text-primary">
              Recent Customer Orders
            </h2>
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
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-t border-border hover:bg-background/50"
                    >
                      <td className="px-5 py-3 text-text-primary font-medium">
                        {order.id}
                      </td>
                      <td className="px-5 py-3 text-text-primary">
                        {order.customer}
                      </td>
                      <td className="px-5 py-3 text-primary-green font-semibold">
                        ${order.total.toFixed(2)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`font-semibold ${
                            order.status === "Completed"
                              ? "text-primary-green"
                              : "text-warning"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </VendorLayout>
  );
}
