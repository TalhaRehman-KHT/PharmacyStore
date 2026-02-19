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
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    pharmacyId: row.pharmacy_id ?? row.pharmacyId,
    status: (row.status || "pending").toLowerCase(),
    items,
    totalAmount,
    orderDate,
    createdAt: created,
  };
}

export async function getUserOrders(userId, { status, limit = 100 } = {}) {
  let q = supabase
    .from("orders")
    .select(
      `
      *,
      order_items (
        id, order_id, batch_id, medicine_id, quantity, unit_price, total_price,
        medicines ( name )
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "All" && status.toLowerCase() !== "all") {
    q = q.eq("status", status.toLowerCase());
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(parseOrder);
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
      status: "pending",
      total_amount: totalAmount,
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
