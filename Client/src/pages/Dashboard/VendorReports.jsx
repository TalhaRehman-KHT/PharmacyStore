import React from "react";
import VendorLayout from "../../components/VendorLayout.jsx";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Layers,
  AlertTriangle,
  Lightbulb,
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
  purple: {
    border: "rgba(96,91,255,0.1)",
    bg: "linear-gradient(135deg, rgba(96,91,255,0.05), rgba(96,91,255,0.02))",
    iconBg: "linear-gradient(135deg, #605BFF, #4B49CC)",
    shadow: "0 4px 8px rgba(96,91,255,0.25)",
    valueClass: "text-primary-purple",
  },
  orange: {
    border: "rgba(255,143,107,0.1)",
    bg: "linear-gradient(135deg, rgba(255,143,107,0.05), rgba(255,143,107,0.02))",
    iconBg: "linear-gradient(135deg, #FF8F6B, #FF7555)",
    shadow: "0 4px 8px rgba(255,143,107,0.25)",
    valueClass: "text-primary-orange",
  },
};

const summaryCards = [
  { label: "Total Sales", value: "$24,520", icon: DollarSign, style: CARD_STYLES.green },
  { label: "Total Orders", value: "1,420", icon: ShoppingCart, style: CARD_STYLES.blue },
  { label: "No. Customers", value: "892", icon: Users, style: CARD_STYLES.purple },
  { label: "Products Sold", value: "5,840", icon: Package, style: CARD_STYLES.orange },
];

const topSellingMedicines = [
  { name: "Paracetamol 500mg", sold: 1250, revenue: 7487.5 },
  { name: "Amoxicillin 250mg", sold: 890, revenue: 11125 },
  { name: "Ibuprofen 400mg", sold: 720, revenue: 5032.8 },
  { name: "Omeprazole 20mg", sold: 540, revenue: 5394.6 },
  { name: "Loratadine 10mg", sold: 410, revenue: 3476.9 },
];

const stockByCategory = [
  { category: "Pain Relief", count: 45, lowStock: 2 },
  { category: "Antibiotics", count: 28, lowStock: 5 },
  { category: "Digestive", count: 22, lowStock: 3 },
  { category: "Allergy", count: 18, lowStock: 0 },
  { category: "Diabetes", count: 15, lowStock: 1 },
];

const alerts = [
  { text: "Amoxicillin 250mg is low on stock (8 units). Consider restocking.", type: "warning" },
  { text: "Omeprazole 20mg has only 5 units left.", type: "warning" },
  { text: "Pain Relief category had 15% higher sales this week.", type: "info" },
];

const insights = [
  "Paracetamol and Amoxicillin are your top sellers; ensure adequate stock.",
  "Customer count grew by 12% compared to last month.",
  "Weekend orders are 25% higher; plan inventory accordingly.",
];

export default function VendorReports() {
  const maxSold = Math.max(...topSellingMedicines.map((m) => m.sold));

  return (
    <VendorLayout>
      <div className="min-h-full bg-background">
        <div className="px-6 py-6 max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-text-primary mb-6">Reports</h1>

          {/* Total Sales, Total Orders, No. Customers, Products Sold */}
          <h2 className="text-xl font-bold text-text-primary mb-4">Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {summaryCards.map(({ label, value, icon: Icon, style: s }) => (
              <div
                key={label}
                className="rounded-[20px] p-5 border shadow-[0_4px_10px_var(--color-card-shadow)]"
                style={{ borderColor: s.border, background: s.bg }}
              >
                <div
                  className="w-11 h-11 rounded-[14px] flex items-center justify-center shadow-lg mb-3"
                  style={{ background: s.iconBg, boxShadow: s.shadow }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className={`text-2xl font-bold tracking-tight ${s.valueClass}`}>{value}</p>
                <p className="text-xs font-medium text-text-secondary mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            {/* Top Selling Medicines */}
            <div className="bg-white rounded-2xl border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-green" />
                <h2 className="text-lg font-bold text-text-primary">Top Selling Medicines</h2>
              </div>
              <div className="p-5 space-y-4">
                {topSellingMedicines.map((item) => (
                  <div key={item.name} className="flex items-center gap-4">
                    <span className="w-36 text-sm font-medium text-text-primary shrink-0 truncate">
                      {item.name}
                    </span>
                    <div className="flex-1 h-8 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-green rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium"
                        style={{ width: `${(item.sold / maxSold) * 100}%` }}
                      >
                        {item.sold}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-primary-green w-20 text-right shrink-0">
                      ${item.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stock by Category */}
            <div className="bg-white rounded-2xl border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary-blue" />
                <h2 className="text-lg font-bold text-text-primary">Stock by Category</h2>
              </div>
              <div className="p-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b border-border">
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium text-right">Products</th>
                      <th className="pb-2 font-medium text-right">Low Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockByCategory.map((row) => (
                      <tr key={row.category} className="border-b border-border/50">
                        <td className="py-2.5 text-text-primary font-medium">{row.category}</td>
                        <td className="py-2.5 text-text-primary text-right">{row.count}</td>
                        <td className="py-2.5 text-right">
                          {row.lowStock > 0 ? (
                            <span className="text-warning font-semibold">{row.lowStock}</span>
                          ) : (
                            <span className="text-primary-green">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Alerts and Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h2 className="text-lg font-bold text-text-primary">Alerts</h2>
              </div>
              <ul className="p-5 space-y-3">
                {alerts.map((a, i) => (
                  <li
                    key={i}
                    className={`text-sm rounded-xl px-3 py-2.5 ${
                      a.type === "warning"
                        ? "bg-warning/10 text-warning border border-warning/20"
                        : "bg-primary-blue/10 text-primary-blue border border-primary-blue/20"
                    }`}
                  >
                    {a.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-border shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary-purple" />
                <h2 className="text-lg font-bold text-text-primary">Insights</h2>
              </div>
              <ul className="p-5 space-y-3">
                {insights.map((insight, i) => (
                  <li
                    key={i}
                    className="text-sm text-text-primary bg-accent-green/50 border border-primary-green/20 rounded-xl px-3 py-2.5"
                  >
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </VendorLayout>
  );
}
