/**
 * Admin: list all orders and set vendor payout (admin_payment_status).
 * Requires Supabase RLS (or policies) that allow your admin user to read/update orders.
 */
import { supabase } from "./supabase.js";

function parseRow(row) {
  const items = (row.order_items || []).map((i) => ({
    id: i.id,
    medicineName: i.medicines?.name ?? "Medicine",
    quantity: i.quantity ?? 0,
    unitPrice: parseFloat(i.unit_price ?? 0) || 0,
  }));
  return {
    id: row.id,
    userId: row.user_id,
    pharmacyId: row.pharmacy_id,
    pharmacyName: row.pharmacies?.name ?? "—",
    customerName: row.users?.name ?? "—",
    customerEmail: row.users?.email ?? "",
    paymentStatus: (row.payment_status || "unpaid").toLowerCase(),
    fulfillmentStatus: (row.fulfillment_status || "pending").toLowerCase(),
    adminPaymentStatus: row.admin_payment_status ?? null,
    totalAmount: row.total_amount != null ? parseFloat(row.total_amount) : 0,
    createdAt: row.created_at,
    orderDate: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : "—",
    items,
  };
}

function applyAdminFilter(q, filterLabel) {
  const f = (filterLabel || "All").trim();
  if (!f || f.toLowerCase() === "all") return q;

  switch (f) {
    case "Payout pending":
      return q
        .eq("payment_status", "paid")
        .or("admin_payment_status.is.null,admin_payment_status.eq.pending");
    case "Payout approved":
      return q.eq("payment_status", "paid").eq("admin_payment_status", "approved");
    case "Payout rejected":
      return q.eq("payment_status", "paid").eq("admin_payment_status", "rejected");
    default:
      return q;
  }
}

export async function getAdminOrders({ filter, limit = 150 } = {}) {
  let q = supabase
    .from("orders")
    .select(
      `
      id,
      user_id,
      pharmacy_id,
      payment_status,
      fulfillment_status,
      admin_payment_status,
      total_amount,
      created_at,
      pharmacies ( name ),
      users ( name, email ),
      order_items (
        id, quantity, unit_price,
        medicines ( name )
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  q = applyAdminFilter(q, filter);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(parseRow);
}

export async function updateAdminPaymentStatus(orderId, status) {
  const v = (status || "").toLowerCase();
  if (!["pending", "approved", "rejected"].includes(v)) {
    throw new Error("Invalid payout status");
  }
  const { error } = await supabase
    .from("orders")
    .update({
      admin_payment_status: v,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}
