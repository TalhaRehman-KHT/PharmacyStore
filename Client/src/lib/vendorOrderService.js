/**
 * Vendor order service – mirrors my_fyp OrderService.
 * Uses Supabase: orders, order_items, users.
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

  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    pharmacyId: row.pharmacy_id ?? row.pharmacyId,
    customerName: row.users?.name ?? row.customerName ?? "Customer",
    customerEmail: row.users?.email ?? row.customerEmail,
    status: (row.status || "pending").toLowerCase(),
    items,
    totalAmount,
    orderDate,
    createdAt: created,
  };
}

export async function getPharmacyOrders(pharmacyId, { status, limit = 100 } = {}) {
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

  if (status && status !== "All" && status.toLowerCase() !== "all") {
    q = q.eq("status", status.toLowerCase());
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(parseOrder);
}

export async function getOrderCount(pharmacyId, status) {
  let q = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("pharmacy_id", pharmacyId);

  if (status && status !== "All") {
    q = q.eq("status", status.toLowerCase());
  }

  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getTotalRevenue(pharmacyId) {
  const { data, error } = await supabase
    .from("orders")
    .select("total_amount, status")
    .eq("pharmacy_id", pharmacyId);

  if (error) throw new Error(error.message);

  let total = 0;
  for (const o of data || []) {
    const s = (o.status || "").toLowerCase();
    if ((s === "paid" || s === "completed") && o.total_amount != null) {
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

export async function updateOrderStatus(orderId, status) {
  const { error } = await supabase
    .from("orders")
    .update({
      status: status.toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}
