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
import { Ban, CheckCircle, ChevronLeft, Edit3, Package, Truck, X } from "lucide-react";
import toast from "react-hot-toast";

const rowStatusColors = {
  awaiting_payment: { bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  pending_ship: { bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  on_the_way: { bg: "rgba(96,91,255,0.12)", text: "#4B49CC" },
  delivered: { bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
  cancelled: { bg: "rgba(255,143,107,0.15)", text: "#c2410c" },
};

const STATUS_ACTIONS = [
  {
    status: "on_the_way",
    label: "On the way",
    icon: Truck,
    color: "#4B49CC",
  },
  {
    status: "delivered",
    label: "Delivered",
    icon: CheckCircle,
    color: "#008F0B",
  },
  {
    status: "cancelled",
    label: "Cancelled",
    icon: Ban,
    color: "#c2410c",
  },
];

function formatStatus(status) {
  if (!status) return "—";
  if (status === "on_the_way") return "On the way";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export default function VendorOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { pharmacy, refresh } = useVendorDashboard();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [changeStatusOpen, setChangeStatusOpen] = useState(false);

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
      if (fulfill !== "pending") {
        toast.error("This order is not waiting to ship.");
        return;
      }
    } else if (next === "delivered") {
      if (pay !== "paid") {
        toast.error("Order must be paid before delivery.");
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
      setChangeStatusOpen(false);
      refresh();
      toast.success(`Order status changed to ${formatStatus(next)}.`);
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
  const canUseFulfillmentAction = (status) => {
    if (status === "cancelled") return fulfill !== "delivered";
    if (pay !== "paid") return false;
    if (status === "on_the_way") return fulfill === "pending";
    if (status === "delivered") return fulfill === "pending" || fulfill === "on_the_way";
    return false;
  };

  const statusActionMessage =
    pay === "paid" ? "Move the paid order through delivery." : "Order must be paid before delivery can start.";

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
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
                          <dd className="text-text-secondary">{formatStatus(fulfill)}</dd>
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
                                Approved — vendor payout has been confirmed.
                              </p>
                            )}
                            {admin === "rejected" && <p className="text-red-700">Rejected — contact support.</p>}
                            {!admin && <p className="text-gray-600">Awaiting admin review after Stripe payment.</p>}
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
                  </div>

                  <div className="space-y-6">
                    {showActions && (
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h2 className="font-bold text-gray-900 mb-2">Update status</h2>
                        <p className="text-sm text-text-secondary mb-4">
                          {statusActionMessage}
                        </p>
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => setChangeStatusOpen(true)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary-green px-4 py-3 text-sm font-semibold text-primary-green transition-colors hover:bg-primary-green hover:text-white disabled:opacity-60"
                        >
                          <Edit3 className="h-4 w-4" />
                          {updating ? "Updating..." : "Change status"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {changeStatusOpen && (
                  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 pb-4 sm:items-center sm:pb-0">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">Change order status</h2>
                          <p className="mt-1 text-xs text-text-secondary">Current: {formatStatus(fulfill)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setChangeStatusOpen(false)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          aria-label="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {STATUS_ACTIONS.map(({ status, label, icon: Icon, color }) => {
                          const isCurrent = status === fulfill;
                          const canUse = canUseFulfillmentAction(status);
                          return (
                            <button
                              key={status}
                              type="button"
                              disabled={updating || isCurrent || !canUse}
                              onClick={() => handleFulfillmentChange(status)}
                              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                                isCurrent
                                  ? "bg-gray-50"
                                  : canUse
                                    ? "hover:bg-gray-50"
                                    : "cursor-not-allowed bg-gray-50/60 opacity-60"
                              }`}
                              style={{ borderColor: isCurrent ? `${color}66` : "#e5e7eb" }}
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                                  style={{ backgroundColor: `${color}1f`, color }}
                                >
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="font-semibold text-gray-900">{label}</span>
                              </span>
                              {isCurrent && (
                                <span className="text-xs font-semibold" style={{ color }}>
                                  Current
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <p className="mt-4 text-xs leading-relaxed text-text-secondary">{statusActionMessage}</p>
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
