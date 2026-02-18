import React, { useState, useMemo } from "react";
import VendorLayout from "../../components/VendorLayout.jsx";
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
  Pending: { bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  Paid: { bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  Completed: { bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
};

const sampleOrders = [
  { id: "ORD-001", customerName: "John Doe", orderDate: "2025-08-20", totalAmount: 45.99, status: "Pending" },
  { id: "ORD-002", customerName: "Jane Smith", orderDate: "2025-08-21", totalAmount: 128.5, status: "Completed" },
  { id: "ORD-003", customerName: "HealthPlus", orderDate: "2025-08-22", totalAmount: 320.0, status: "Pending" },
  { id: "ORD-004", customerName: "Care Pharmacy", orderDate: "2025-08-22", totalAmount: 89.99, status: "Paid" },
  { id: "ORD-005", customerName: "Medico Chain", orderDate: "2025-08-23", totalAmount: 256.0, status: "Paid" },
  { id: "ORD-006", customerName: "Wellness Rx", orderDate: "2025-08-23", totalAmount: 67.5, status: "Completed" },
  { id: "ORD-007", customerName: "QuickMed", orderDate: "2025-08-24", totalAmount: 145.0, status: "Completed" },
  { id: "ORD-008", customerName: "Sarah Wilson", orderDate: "2025-08-24", totalAmount: 52.3, status: "Pending" },
  { id: "ORD-009", customerName: "City Pharmacy", orderDate: "2025-08-25", totalAmount: 198.75, status: "Paid" },
  { id: "ORD-010", customerName: "Mike Brown", orderDate: "2025-08-25", totalAmount: 34.99, status: "Completed" },
];

function StatusBadge({ status }) {
  const style = statusColors[status] || statusColors.Pending;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status}
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
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");

  const filteredOrders = useMemo(() => {
    let list = sampleOrders;
    if (selectedFilter !== "All") {
      list = list.filter((o) => o.status === selectedFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          (o.customerName && o.customerName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [search, selectedFilter]);

  const pendingCount = sampleOrders.filter((o) => o.status === "Pending").length;
  const paidCount = sampleOrders.filter((o) => o.status === "Paid").length;
  const completedCount = sampleOrders.filter((o) => o.status === "Completed").length;

  return (
    <VendorLayout>
      <div className="min-h-full bg-[#f5f5f5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Customer Orders</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {sampleOrders.length} total orders · Search and filter below
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard title="Pending" value={pendingCount} icon={Clock} color="#FFC327" />
            <StatCard title="Paid" value={paidCount} icon={Package} color="#2859C5" />
            <StatCard title="Completed" value={completedCount} icon={CheckCircle} color="#008F0B" />
          </div>

          {/* Toolbar */}
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

          {/* Orders list card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <ShoppingBag className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium">
                  {sampleOrders.length === 0 ? "No orders yet" : "No orders match your filter"}
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
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-4 py-3.5 font-medium text-gray-900">{order.id}</td>
                        <td className="px-4 py-3.5 text-gray-700">{order.customerName}</td>
                        <td className="px-4 py-3.5 text-gray-500">{order.orderDate}</td>
                        <td className="px-4 py-3.5 font-semibold text-primary-green">
                          ${order.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-primary-green text-xs font-semibold hover:underline"
                          >
                            View
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
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
  );
}
