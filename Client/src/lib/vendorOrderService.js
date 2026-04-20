/**
 * Vendor order service — Supabase orders with payment_status, fulfillment_status, admin_payment_status.
 */
import { supabase } from "./supabase.js";

function parseOrder(row) {
  const items = (row.order_items || []).map((i) => ({
    id: i.id,
    batchId: i.batch_id ?? i.batchId,
    medicineId: i.medicine_id ?? i.medicineId,
    medicineName: i.medicines?.name ?? "Medicine",
    quantity: i.quantity ?? 0,
    unitPrice: parseFloat(i.unit_price ?? i.unitPrice) || 0,
    totalPrice: parseFloat(i.total_price ?? i.totalPrice) || 0,
  }));

  const totalAmount =
    row.total_amount != null
      ? parseFloat(row.total_amount)
      : items.reduce((s, i) => s + (i.totalPrice || i.quantity * i.unitPrice), 0);
  const created = row.created_at ?? row.createdAt;
  const orderDate = created ? new Date(created).toISOString().split("T")[0] : null;

  const paymentStatus = (row.payment_status || "unpaid").toLowerCase();
  const fulfillmentStatus = (row.fulfillment_status || "pending").toLowerCase();

  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    pharmacyId: row.pharmacy_id ?? row.pharmacyId,
    customerName: row.users?.name ?? row.customerName ?? "Customer",
    customerEmail: row.users?.email ?? row.customerEmail,
    paymentStatus,
    fulfillmentStatus,
    adminPaymentStatus: row.admin_payment_status ?? null,
    items,
    totalAmount,
    orderDate,
    createdAt: created,
  };
}

/** Map UI filter label to Supabase query constraints. */
function applyOrderFilter(q, filterLabel) {
  const f = (filterLabel || "All").trim();
  if (!f || f.toLowerCase() === "all") return q;

  switch (f) {
    case "Unpaid":
      return q.eq("payment_status", "unpaid").neq("fulfillment_status", "cancelled");
    case "Pending":
      return q.eq("fulfillment_status", "pending");
    case "On the way":
      return q.eq("fulfillment_status", "on_the_way");
    case "Delivered":
      return q.eq("fulfillment_status", "delivered");
    case "Cancelled":
      return q.eq("fulfillment_status", "cancelled");
    default:
      return q;
  }
}

export async function getPharmacyOrders(pharmacyId, { filter, limit = 100 } = {}) {
  let q = supabase
    .from("orders")
    .select(
      `
      *,
      users ( id, name, email ),
      order_items (
        id, order_id, batch_id, medicine_id, quantity, unit_price, total_price,
        medicines ( name )
      )
    `
    )
    .eq("pharmacy_id", pharmacyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  q = applyOrderFilter(q, filter);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(parseOrder);
}

export async function getOrderCount(pharmacyId, filter) {
  let q = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("pharmacy_id", pharmacyId);

  q = applyOrderFilter(q, filter);

  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getTotalRevenue(pharmacyId) {
  const { data, error } = await supabase
    .from("orders")
    .select("total_amount, payment_status, admin_payment_status")
    .eq("pharmacy_id", pharmacyId);

  if (error) throw new Error(error.message);

  let total = 0;
  for (const o of data || []) {
    const paid = (o.payment_status || "").toLowerCase() === "paid";
    const adminOk = (o.admin_payment_status || "").toLowerCase() === "approved";
    if (paid && adminOk && o.total_amount != null) {
      total += parseFloat(o.total_amount);
    }
  }
  return total;
}

export async function getUniqueCustomerCount(pharmacyId) {
  const { data, error } = await supabase
    .from("orders")
    .select("user_id")
    .eq("pharmacy_id", pharmacyId)
    .not("user_id", "is", null);

  if (error) throw new Error(error.message);

  const ids = new Set((data || []).map((r) => r.user_id).filter(Boolean));
  return ids.size;
}

/** Vendor table / dashboard: color key from payment + fulfillment. */
export function vendorOrderRowStatusKey(order) {
  if (!order) return "awaiting_payment";
  if (order.fulfillmentStatus === "cancelled") return "cancelled";
  if (order.paymentStatus !== "paid") return "awaiting_payment";
  if (order.fulfillmentStatus === "delivered") return "delivered";
  if (order.fulfillmentStatus === "on_the_way") return "on_the_way";
  return "pending_ship";
}

/** Single-line label for vendor order list. */
export function vendorOrderRowLabel(order) {
  if (!order) return "—";
  if (order.fulfillmentStatus === "cancelled") return "Cancelled";
  if (order.paymentStatus !== "paid") return "Awaiting payment";
  if (order.fulfillmentStatus === "delivered") return "Delivered";
  if (order.fulfillmentStatus === "on_the_way") return "On the way";
  return "Pending ship";
}

export async function updateOrderFulfillmentStatus(orderId, fulfillmentStatus, pharmacyId = null) {
  const v = fulfillmentStatus.toLowerCase();
  const allowed = ["pending", "on_the_way", "delivered", "cancelled"];
  if (!allowed.includes(v)) {
    throw new Error("Invalid fulfillment status");
  }
  let q = supabase
    .from("orders")
    .update({
      fulfillment_status: v,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (pharmacyId) {
    q = q.eq("pharmacy_id", pharmacyId);
  }
  const { data, error } = await q.select("id").maybeSingle();

  if (error) throw new Error(error.message);
  if (pharmacyId && !data) {
    throw new Error("Order not found for this pharmacy");
  }
}
