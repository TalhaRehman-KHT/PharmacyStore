import React, { useState, useEffect, useCallback } from "react";
import VendorLayout from "../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../components/VendorRouteGuard.jsx";
import { useVendorDashboard } from "../../context/VendorDashboardContext.jsx";
import {
  getTotalUnitsSold,
  getStockByDosageForm,
  getExpiringBatches,
  getLowStockItems,
  getCustomerStats,
} from "../../lib/vendorReportService.js";
import {
  getTotalRevenue,
  getOrderCount,
  getUniqueCustomerCount,
} from "../../lib/vendorOrderService.js";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Layers,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const CARD_STYLES = {
  green: {
    border: "rgba(0,143,11,0.2)",
    bg: "linear-gradient(135deg, rgba(0,143,11,0.08), rgba(0,143,11,0.02))",
    iconBg: "linear-gradient(135deg, #008F0B, rgba(0,143,11,0.75))",
    shadow: "rgba(0,143,11,0.08)",
    valueClass: "text-primary-green",
  },
  blue: {
    border: "rgba(40,89,197,0.2)",
    bg: "linear-gradient(135deg, rgba(40,89,197,0.08), rgba(40,89,197,0.02))",
    iconBg: "linear-gradient(135deg, #2859C5, rgba(40,89,197,0.75))",
    shadow: "rgba(40,89,197,0.08)",
    valueClass: "text-primary-blue",
  },
  purple: {
    border: "rgba(96,91,255,0.2)",
    bg: "linear-gradient(135deg, rgba(96,91,255,0.08), rgba(96,91,255,0.02))",
    iconBg: "linear-gradient(135deg, #605BFF, rgba(96,91,255,0.75))",
    shadow: "rgba(96,91,255,0.08)",
    valueClass: "text-primary-purple",
  },
  orange: {
    border: "rgba(255,143,107,0.2)",
    bg: "linear-gradient(135deg, rgba(255,143,107,0.08), rgba(255,143,107,0.02))",
    iconBg: "linear-gradient(135deg, #FF8F6B, rgba(255,143,107,0.75))",
    shadow: "rgba(255,143,107,0.08)",
    valueClass: "text-primary-orange",
  },
};

const PIE_COLORS = ["#605BFF", "#FFC327", "#2859C5", "#008F0B", "#FF8F6B"];

function formatRevenue(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function SectionCard({ title, icon: Icon, iconColor, children }) {
  return (
    <div className="bg-white rounded-[20px] border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${iconColor}1A` }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

export default function VendorReports() {
  const { pharmacy } = useVendorDashboard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [uniqueCustomers, setUniqueCustomers] = useState(0);
  const [productsSold, setProductsSold] = useState(0);
  const [stockByCategory, setStockByCategory] = useState([]);
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [customerStats, setCustomerStats] = useState([]);

  const load = useCallback(async () => {
    if (!pharmacy?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [revenue, orders, customers, units, stock, expiring, lowStock, stats] = await Promise.all([
        getTotalRevenue(pharmacy.id),
        getOrderCount(pharmacy.id),
        getUniqueCustomerCount(pharmacy.id),
        getTotalUnitsSold(pharmacy.id),
        getStockByDosageForm(pharmacy.id),
        getExpiringBatches(pharmacy.id, 90),
        getLowStockItems(pharmacy.id, 50),
        getCustomerStats(pharmacy.id),
      ]);
      setTotalSales(revenue);
      setTotalOrders(orders);
      setUniqueCustomers(customers);
      setProductsSold(units);
      setStockByCategory(stock || []);
      setExpiringBatches(expiring || []);
      setLowStockItems(lowStock || []);
      setCustomerStats(stats || []);
    } catch (e) {
      setError(e?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [pharmacy?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const pieData = customerStats.filter((s) => s.value > 0);
  const totalPie = pieData.reduce((s, d) => s + d.value, 0);

  const summaryCards = [
    { label: "Total Sales", value: formatRevenue(totalSales), icon: DollarSign, style: CARD_STYLES.green },
    { label: "Total Orders", value: String(totalOrders), icon: ShoppingCart, style: CARD_STYLES.blue },
    { label: "Customers", value: String(uniqueCustomers), icon: Users, style: CARD_STYLES.purple },
    { label: "Units Sold", value: String(productsSold), icon: Package, style: CARD_STYLES.orange },
  ];

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full bg-background">
          <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="p-2 rounded-xl text-primary-green hover:bg-primary-green/10 transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-text-primary font-semibold mb-1">Failed to load reports</p>
                <p className="text-text-secondary text-sm mb-6">{error}</p>
                <button
                  type="button"
                  onClick={load}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-green text-primary-green font-medium hover:bg-primary-green/10"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-text-secondary">Summary · Live from database</p>

                <div>
                  <h2 className="text-xl font-bold text-text-primary mb-4">Overview</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {summaryCards.map(({ label, value, icon: Icon, style: s }) => (
                      <div
                        key={label}
                        className="rounded-2xl p-4 border"
                        style={{ borderColor: s.border, background: s.bg, boxShadow: `0 2px 6px ${s.shadow}` }}
                      >
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 mx-auto"
                          style={{ background: s.iconBg, boxShadow: `0 2px 4px ${s.shadow}` }}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <p className={`text-center text-lg font-bold ${s.valueClass}`}>{value}</p>
                        <p className="text-center text-sm font-semibold text-text-secondary">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Medicines Expiring in Upcoming 3 Months */}
                <SectionCard
                  title="Medicines Expiring in Upcoming 3 Months"
                  icon={Calendar}
                  iconColor="#FF8F6B"
                >
                  {expiringBatches.length === 0 ? (
                    <p className="py-6 text-center text-sm text-text-secondary">
                      No medicines expiring in the upcoming 3 months.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {expiringBatches.slice(0, 10).map((item, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border"
                          style={{ backgroundColor: "rgba(255,143,107,0.08)", borderColor: "rgba(255,143,107,0.2)" }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-text-primary truncate">{item.medicineName}</p>
                              <p className="text-xs text-text-secondary mt-0.5">
                                Batch {item.batchNumber} · {item.quantity} units
                              </p>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-sm font-semibold text-primary-orange">{item.daysLeft} days left</p>
                              <p className="text-xs text-text-secondary">
                                Exp: {item.expiryDate ? String(item.expiryDate).split("T")[0] : "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Low Stock Medicines */}
                <SectionCard title="Low Stock Medicines" icon={AlertTriangle} iconColor="#FFC327">
                  {lowStockItems.length === 0 ? (
                    <p className="py-6 text-center text-sm text-text-secondary">
                      No low stock items. All medicines are well stocked.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {lowStockItems.slice(0, 10).map((item, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border flex justify-between items-center"
                          style={{ backgroundColor: "rgba(255,195,39,0.08)", borderColor: "rgba(255,195,39,0.2)" }}
                        >
                          <p className="text-sm font-semibold text-text-primary truncate flex-1">{item.medicineName}</p>
                          <p className="text-sm font-semibold text-warning shrink-0 ml-2">
                            Batch {item.batchNumber} · {item.quantity} units
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Orders by Status */}
                <SectionCard title="Orders by Status" icon={ShoppingCart} iconColor="#605BFF">
                  {totalPie === 0 && uniqueCustomers === 0 ? (
                    <p className="py-6 text-center text-sm text-text-secondary">No orders yet.</p>
                  ) : (
                    <div>
                      {uniqueCustomers > 0 && (
                        <p className="text-sm text-text-secondary font-medium mb-3">
                          {uniqueCustomers} unique customer{uniqueCustomers === 1 ? "" : "s"}
                        </p>
                      )}
                      {pieData.length === 0 ? (
                        <p className="py-4 text-sm text-text-secondary">No orders by status yet.</p>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                          <div className="w-full sm:w-48 h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  dataKey="value"
                                  nameKey="label"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={60}
                                  innerRadius={24}
                                  paddingAngle={2}
                                  label={({ percent }) => (percent >= 0.08 ? `${(percent * 100).toFixed(0)}%` : "")}
                                >
                                  {pieData.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(v) => [v, "Orders"]} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-2">
                            {pieData.map((d, i) => (
                              <div key={d.label} className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-sm shrink-0"
                                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                                />
                                <span className="text-sm text-text-primary">
                                  {d.label}: {d.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SectionCard>

                {/* Stock by Category */}
                <SectionCard title="Stock by Category" icon={Layers} iconColor="#2859C5">
                  {stockByCategory.length === 0 ? (
                    <p className="py-6 text-center text-sm text-text-secondary">No stock by category yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {stockByCategory.map((row, i) => {
                        const colors = ["#008F0B", "#2859C5", "#605BFF", "#FF8F6B", "#FFC327"];
                        const color = colors[i % colors.length];
                        const amount = `${row.quantity} units · $${(row.value || 0).toFixed(0)}`;
                        return (
                          <div
                            key={row.category}
                            className="p-3 rounded-xl border flex justify-between items-center"
                            style={{ backgroundColor: `${color}14`, borderColor: `${color}33` }}
                          >
                            <p className="text-sm font-semibold text-text-primary truncate flex-1">{row.category}</p>
                            <p className="text-sm font-semibold shrink-0 ml-2" style={{ color }}>
                              {amount}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>
            )}
          </div>
        </div>
      </VendorLayout>
    </VendorRouteGuard>
  );
}
