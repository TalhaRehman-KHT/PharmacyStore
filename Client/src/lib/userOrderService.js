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
  const totalAmount = items.reduce((s, i) => s + (i.totalPrice || i.quantity * i.unitPrice), 0);
  const created = row.created_at ?? row.createdAt;
  const orderDate = created ? new Date(created).toLocaleDateString() : "—";
  const paymentStatus = (row.payment_status || "unpaid").toLowerCase();
  const fulfillmentStatus = (row.fulfillment_status || "pending").toLowerCase();

  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    pharmacyId: row.pharmacy_id ?? row.pharmacyId,
    pharmacyName: row.pharmacies?.name ?? "Pharmacy",
    paymentStatus,
    fulfillmentStatus,
    adminPaymentStatus: row.admin_payment_status ?? null,
    items,
    totalAmount,
    orderDate,
    createdAt: created,
  };
}

function applyUserOrderFilter(q, filterLabel) {
  const f = (filterLabel || "All").trim();
  if (!f || f.toLowerCase() === "all") return q;

  switch (f) {
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

export async function getUserOrders(userId, { filter, limit = 100 } = {}) {
  let q = supabase
    .from("orders")
    .select(
      `
      *,
      pharmacies ( name ),
      order_items (
        id, order_id, batch_id, medicine_id, quantity, unit_price, total_price,
        medicines ( name )
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  q = applyUserOrderFilter(q, filter);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(parseOrder);
}

export async function getUserOrder(userId, orderId) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      pharmacies ( name ),
      order_items (
        id, order_id, batch_id, medicine_id, quantity, unit_price, total_price,
        medicines ( name )
      )
    `
    )
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return parseOrder(data);
}

export async function createOrder(userId, pharmacyId, items) {
  let totalAmount = 0;
  for (const item of items) {
    const qty = item.quantity || 0;
    const price = typeof item.unit_price !== "undefined" ? parseFloat(item.unit_price) : parseFloat(item.unitPrice) || 0;
    totalAmount += qty * price;
  }

  const { data: orderRes, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      pharmacy_id: pharmacyId,
      payment_status: "unpaid",
      fulfillment_status: "pending",
      total_amount: totalAmount,
      admin_payment_status: null,
    })
    .select("id")
    .single();

  if (orderErr) throw new Error(orderErr.message);
  const orderId = orderRes.id.toString();

  for (const item of items) {
    const qty = item.quantity || 0;
    const price = typeof item.unit_price !== "undefined" ? parseFloat(item.unit_price) : parseFloat(item.unitPrice) || 0;
    await supabase.from("order_items").insert({
      order_id: orderId,
      batch_id: item.batch_id ?? item.batchId,
      medicine_id: item.medicine_id ?? item.medicineId,
      quantity: qty,
      unit_price: price,
    });
  }

  return orderId;
}

/** Short label for user-facing order list (payment + delivery). */
export function userOrderSummaryLabel(order) {
  if (!order) return "—";
  if (order.fulfillmentStatus === "cancelled") return "Cancelled";
  if (order.fulfillmentStatus === "delivered") return "Delivered";
  if (order.fulfillmentStatus === "on_the_way") return "On the way";
  if (order.fulfillmentStatus === "pending") {
    if (order.paymentStatus !== "paid") return "Awaiting payment";
    return "Processing";
  }
  return "—";
}

/** Key for styling badges. */
export function userOrderBadgeKey(order) {
  if (!order) return "awaiting_payment";
  if (order.fulfillmentStatus === "cancelled") return "cancelled";
  if (order.paymentStatus !== "paid") return "awaiting_payment";
  if (order.fulfillmentStatus === "delivered") return "delivered";
  if (order.fulfillmentStatus === "on_the_way") return "on_the_way";
  return "preparing";
}
