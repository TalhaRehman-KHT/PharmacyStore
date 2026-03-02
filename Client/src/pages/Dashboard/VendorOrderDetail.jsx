import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import VendorLayout from "../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../components/VendorRouteGuard.jsx";
import { getPharmacyOrders } from "../../lib/vendorOrderService.js";
import { updateOrderStatus } from "../../lib/vendorOrderService.js";
import { useVendorDashboard } from "../../context/VendorDashboardContext.jsx";
import { ChevronLeft, Package, Check, X } from "lucide-react";
import toast from "react-hot-toast";

const statusColors = {
  pending: { bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  paid: { bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  completed: { bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
  cancelled: { bg: "rgba(255,143,107,0.15)", text: "#c2410c" },
};

const STATUS_OPTIONS = ["pending", "paid", "completed", "cancelled"];

export default function VendorOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { pharmacy, refresh } = useVendorDashboard();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!pharmacy?.id || !orderId) return;
    let cancelled = false;
    getPharmacyOrders(pharmacy.id, { limit: 200 })
      .then((orders) => {
        if (cancelled) return;
        const o = orders.find((ord) => ord.id === orderId);
        setOrder(o || null);
      })
      .catch(() => setOrder(null))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [pharmacy?.id, orderId]);

  const handleStatusChange = async (newStatus) => {
    if (!order || updating) return;
    const canChange = (order.status || "").toLowerCase() !== "paid";
    if (!canChange) {
      toast.error("Paid orders cannot be changed.");
      return;
    }
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, newStatus);
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      refresh();
      toast.success(`Status updated to ${newStatus}`);
    } catch (e) {
      toast.error(e?.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const status = (order?.status || "pending").toLowerCase();
  const style = statusColors[status] || statusColors.pending;

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full bg-[#f5f5f5]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
            <button
              type="button"
              onClick={() => navigate("/vendor/orders")}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-medium mb-6"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to orders
            </button>

            {loading ? (
              <div className="bg-white rounded-2xl p-8 text-center text-text-secondary">
                Loading…
              </div>
            ) : !order ? (
              <div className="bg-white rounded-2xl p-8 text-center text-text-secondary">
                Order not found
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h1 className="text-xl font-bold text-gray-900">
                      Order #{order.id.slice(0, 8)}
                    </h1>
                    <span
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-text-secondary">
                    <span>Customer: {order.customerName ?? "—"}</span>
                    <span>•</span>
                    <span>Date: {order.orderDate ?? "—"}</span>
                  </div>
                  <div className="mt-4 text-lg font-bold text-primary-green">
                    ${order.totalAmount?.toFixed(2) ?? "0.00"}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary-green" />
                    <h2 className="font-bold text-gray-900">Items</h2>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {order.items?.map((item, i) => (
                      <li key={i} className="px-5 py-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{item.medicineName ?? "Medicine"}</p>
                          <p className="text-sm text-text-secondary">
                            Qty: {item.quantity} × ${(item.unitPrice || 0).toFixed(2)}
                          </p>
                        </div>
                        <span className="font-semibold text-primary-green">
                          ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {status !== "paid" && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-bold text-gray-900 mb-4">Change status</h2>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((s) => {
                        const isCurrent = s === status;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={isCurrent || updating}
                            onClick={() => handleStatusChange(s)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                              isCurrent
                                ? "bg-gray-100 text-gray-500 cursor-default"
                                : "bg-primary-green/10 text-primary-green hover:bg-primary-green hover:text-white"
                            } disabled:opacity-60`}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </VendorLayout>
    </VendorRouteGuard>
  );
}
