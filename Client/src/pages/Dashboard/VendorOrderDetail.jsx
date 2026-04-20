import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import VendorLayout from "../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../components/VendorRouteGuard.jsx";
import {
  getPharmacyOrders,
  updateOrderFulfillmentStatus,
  vendorOrderRowLabel,
  vendorOrderRowStatusKey,
} from "../../lib/vendorOrderService.js";
import { useVendorDashboard } from "../../context/VendorDashboardContext.jsx";
import { ChevronLeft, Package } from "lucide-react";
import toast from "react-hot-toast";

const rowStatusColors = {
  awaiting_payment: { bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  pending_ship: { bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  on_the_way: { bg: "rgba(96,91,255,0.12)", text: "#4B49CC" },
  delivered: { bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
  cancelled: { bg: "rgba(255,143,107,0.15)", text: "#c2410c" },
};

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
    return () => {
      cancelled = true;
    };
  }, [pharmacy?.id, orderId]);

  const handleFulfillmentChange = async (nextRaw) => {
    if (!order || updating) return;
    const next = nextRaw.toLowerCase();
    const pay = order.paymentStatus;
    const admin = (order.adminPaymentStatus || "").toLowerCase();
    const fulfill = order.fulfillmentStatus;

    if (next === "cancelled") {
      if (fulfill === "delivered") {
        toast.error("Cannot cancel a delivered order.");
        return;
      }
    } else if (next === "on_the_way") {
      if (pay !== "paid") {
        toast.error("Order must be paid before you can ship.");
        return;
      }
      if (admin !== "approved") {
        toast.error("Admin must approve payment before you mark this order on the way.");
        return;
      }
      if (fulfill !== "pending") {
        toast.error("This order is not waiting to ship.");
        return;
      }
    } else if (next === "delivered") {
      if (pay !== "paid") {
        toast.error("Order must be paid before delivery.");
        return;
      }
      if (admin !== "approved") {
        toast.error("Admin must approve payment before you mark delivered.");
        return;
      }
      if (fulfill !== "pending" && fulfill !== "on_the_way") {
        toast.error("Invalid transition.");
        return;
      }
    } else {
      toast.error("Invalid action.");
      return;
    }

    setUpdating(true);
    try {
      await updateOrderFulfillmentStatus(order.id, next, pharmacy?.id ?? null);
      setOrder((prev) => (prev ? { ...prev, fulfillmentStatus: next } : null));
      refresh();
      toast.success("Order updated");
    } catch (e) {
      toast.error(e?.message || "Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  const summaryKey = vendorOrderRowStatusKey(order);
  const summaryStyle = rowStatusColors[summaryKey] || rowStatusColors.awaiting_payment;
  const summaryLabel = vendorOrderRowLabel(order);
  const pay = (order?.paymentStatus || "").toLowerCase();
  const fulfill = (order?.fulfillmentStatus || "").toLowerCase();
  const admin = (order?.adminPaymentStatus || "").toLowerCase();

  const showActions = fulfill !== "delivered" && fulfill !== "cancelled";
  const canCancel = fulfill !== "delivered";
  const canShip =
    pay === "paid" && admin === "approved" && fulfill === "pending";
  const canDeliver =
    pay === "paid" && admin === "approved" && (fulfill === "pending" || fulfill === "on_the_way");

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
              <div className="bg-white rounded-2xl p-8 text-center text-text-secondary">Loading…</div>
            ) : !order ? (
              <div className="bg-white rounded-2xl p-8 text-center text-text-secondary">Order not found</div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h1 className="text-xl font-bold text-gray-900">Order #{order.id.slice(0, 8)}</h1>
                    <span
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: summaryStyle.bg, color: summaryStyle.text }}
                    >
                      {summaryLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                    <span>Customer: {order.customerName ?? "—"}</span>
                    <span>•</span>
                    <span>Date: {order.orderDate ?? "—"}</span>
                  </div>
                  <div className="mt-4 text-lg font-bold text-primary-green">
                    ${order.totalAmount?.toFixed(2) ?? "0.00"}
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <dt className="font-semibold text-gray-800">Payment (Stripe):</dt>
                      <dd className="text-text-secondary capitalize">{pay || "—"}</dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="font-semibold text-gray-800">Fulfillment:</dt>
                      <dd className="text-text-secondary capitalize">{fulfill.replace(/_/g, " ")}</dd>
                    </div>
                    {pay === "paid" && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="font-semibold text-gray-800 mb-1">Admin payout</p>
                        {admin === "pending" && (
                          <p className="text-amber-700">
                            Pending admin confirmation — funds are held by the platform until approved.
                          </p>
                        )}
                        {admin === "approved" && (
                          <p className="text-primary-green">
                            Approved — you can mark the order on the way and delivered when fulfilled.
                          </p>
                        )}
                        {admin === "rejected" && (
                          <p className="text-red-700">Rejected — contact support.</p>
                        )}
                        {!admin && (
                          <p className="text-gray-600">Awaiting admin review after Stripe payment.</p>
                        )}
                      </div>
                    )}
                  </dl>
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

                {showActions && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-bold text-gray-900 mb-4">Update fulfillment</h2>
                    <p className="text-sm text-text-secondary mb-4">
                      Stripe marks payment. You move the order from pending → on the way → delivered. Cancel if you
                      cannot fulfill (not delivered orders only).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canShip && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => handleFulfillmentChange("on_the_way")}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-primary-green/10 text-primary-green hover:bg-primary-green hover:text-white transition-colors disabled:opacity-60"
                        >
                          On the way
                        </button>
                      )}
                      {canDeliver && fulfill !== "delivered" && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => handleFulfillmentChange("delivered")}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-primary-green/10 text-primary-green hover:bg-primary-green hover:text-white transition-colors disabled:opacity-60"
                        >
                          Delivered
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => handleFulfillmentChange("cancelled")}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
                        >
                          Cancel order
                        </button>
                      )}
                    </div>
                    {pay === "paid" && admin !== "approved" && (
                      <p className="mt-3 text-xs text-amber-800">
                        Shipping and delivery actions unlock after admin approves your payout.
                      </p>
                    )}
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
