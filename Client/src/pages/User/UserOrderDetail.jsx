import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  getUserOrder,
  userOrderBadgeKey,
  userOrderSummaryLabel,
} from "../../lib/userOrderService.js";
import { ChevronLeft, Package, Calendar, Clock, Wallet } from "lucide-react";

const badgeColors = {
  awaiting_payment: { bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  preparing: { bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  on_the_way: { bg: "rgba(96,91,255,0.12)", text: "#4B49CC" },
  delivered: { bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
  cancelled: { bg: "rgba(255,143,107,0.15)", text: "#c2410c" },
};

function formatDate(createdAt) {
  if (!createdAt) return "—";
  const d = new Date(createdAt);
  return d.toISOString().slice(0, 10);
}

function formatTime(createdAt) {
  if (!createdAt) return "—";
  const d = new Date(createdAt);
  return d.toTimeString().slice(0, 5);
}

export default function UserOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getUserOrder(user.id, orderId)
      .then((o) => {
        if (!cancelled) setOrder(o ?? null);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, orderId]);

  const badgeKey = order ? userOrderBadgeKey(order) : "awaiting_payment";
  const style = badgeColors[badgeKey] || badgeColors.awaiting_payment;
  const headline = order ? userOrderSummaryLabel(order) : "—";
  const pay = (order?.paymentStatus || "").toLowerCase();
  const fulfill = (order?.fulfillmentStatus || "").toLowerCase();

  return (
    <UserLayout>
      <div className="min-h-full bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <button
            type="button"
            onClick={() => navigate("/user/orders")}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-medium mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to orders
          </button>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-text-secondary mt-3">Loading order…</p>
            </div>
          ) : !order ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-text-secondary">
              Order not found
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h1 className="text-xl font-bold text-gray-900">Order #{String(order.id).slice(0, 8)}</h1>
                  <span
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: style.bg, color: style.text }}
                  >
                    {headline}
                  </span>
                </div>
                <dl className="space-y-2 text-sm text-text-secondary mb-4">
                  <div className="flex flex-wrap gap-2">
                    <dt className="font-semibold text-gray-800">Pharmacy:</dt>
                    <dd>{order.pharmacyName ?? "—"}</dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="font-semibold text-gray-800">Stripe payment:</dt>
                    <dd className="capitalize">{pay || "—"}</dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="font-semibold text-gray-800">Delivery:</dt>
                    <dd className="capitalize">{fulfill.replace(/_/g, " ")}</dd>
                  </div>
                </dl>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>Date: {formatDate(order.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Time: {formatTime(order.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary-green shrink-0" />
                    <span className="font-bold text-primary-green">
                      Total: ${order.totalAmount != null ? order.totalAmount.toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>
                {pay === "paid" && (
                  <p className="mt-4 text-xs text-gray-600">
                    Payment succeeded in Stripe. The pharmacy will update delivery status as your order moves along.
                  </p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary-green" />
                  <h2 className="font-bold text-gray-900">Items</h2>
                </div>
                {!order.items?.length ? (
                  <div className="px-5 py-8 text-center text-text-secondary text-sm">No items in this order</div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {order.items.map((item, i) => {
                      const subtotal =
                        (item.quantity || 0) * (item.unitPrice || item.totalPrice / (item.quantity || 1) || 0);
                      return (
                        <li key={item.id || i} className="px-5 py-4 flex justify-between items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900">{item.medicineName ?? "Medicine"}</p>
                            <p className="text-sm text-text-secondary mt-0.5">
                              Qty: {item.quantity} × ${(item.unitPrice ?? 0).toFixed(2)}
                            </p>
                          </div>
                          <span className="font-semibold text-gray-900 shrink-0">
                            ${(item.totalPrice ?? subtotal).toFixed(2)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
