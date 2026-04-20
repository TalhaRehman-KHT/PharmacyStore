/**
 * Vendor report service – mirrors my_fyp ReportService.
 * Top selling from order_items (paid/completed orders), category stats, low stock, expiring batches.
 */
import { supabase } from "./supabase.js";
import { getPharmacyMedicines } from "./vendorMedicineService.js";

export async function getTotalUnitsSold(pharmacyId) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("pharmacy_id", pharmacyId)
    .eq("payment_status", "paid");

  const orderIds = (orders || []).map((o) => o.id);
  if (orderIds.length === 0) return 0;

  const { data: items } = await supabase
    .from("order_items")
    .select("quantity, batch_id")
    .in("order_id", orderIds);

  const batchIds = new Set((items || []).map((i) => i.batch_id).filter(Boolean));
  const batches = await getPharmacyMedicines(pharmacyId);
  const pharmacyBatchIds = new Set(batches.map((b) => b.id));

  let total = 0;
  for (const i of items || []) {
    if (pharmacyBatchIds.has(i.batch_id)) {
      total += parseInt(i.quantity, 10) || 0;
    }
  }
  return total;
}

export async function getTopSellingMedicines(pharmacyId, limit = 5) {
  const batches = await getPharmacyMedicines(pharmacyId);
  const batchIds = batches.map((b) => b.id);
  if (batchIds.length === 0) return [];

  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("pharmacy_id", pharmacyId)
    .eq("payment_status", "paid");

  const orderIds = (orders || []).map((o) => o.id);
  if (orderIds.length === 0) return [];

  const { data: items } = await supabase
    .from("order_items")
    .select("batch_id, quantity")
    .in("order_id", orderIds);

  const batchToMed = {};
  for (const b of batches) {
    batchToMed[b.id] = { medicineId: b.medicineId, name: b.medicineName || b.batchNumber, price: b.sellingPrice };
  }

  const byMed = {};
  for (const i of items || []) {
    const info = batchToMed[i.batch_id];
    if (!info) continue;
    const prev = byMed[info.medicineId] || { qty: 0, price: info.price, name: info.name };
    byMed[info.medicineId] = {
      qty: prev.qty + (parseInt(i.quantity, 10) || 0),
      price: prev.price ?? info.price,
      name: prev.name || info.name,
    };
  }

  return Object.entries(byMed)
    .map(([medicineId, v]) => ({
      medicineId,
      medicineName: v.name,
      quantitySold: v.qty,
      revenue: v.price ? v.qty * v.price : null,
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, limit);
}

export async function getStockByDosageForm(pharmacyId) {
  const batches = await getPharmacyMedicines(pharmacyId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byCat = {};
  for (const b of batches) {
    if (b.quantity <= 0) continue;
    const exp = b.expiryDate ? new Date(b.expiryDate) : null;
    if (exp) {
      exp.setHours(0, 0, 0, 0);
      if (exp < today) continue;
    }
    const cat = (b.dosageForm || "").trim() || "Other";
    const value = (b.sellingPrice || 0) * b.quantity;
    byCat[cat] = byCat[cat] || { quantity: 0, value: 0 };
    byCat[cat].quantity += b.quantity;
    byCat[cat].value += value;
  }

  return Object.entries(byCat)
    .map(([category, v]) => ({ category, quantity: v.quantity, value: v.value }))
    .sort((a, b) => b.value - a.value);
}

export async function getExpiringBatches(pharmacyId, daysAhead = 90) {
  const batches = await getPharmacyMedicines(pharmacyId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(today);
  deadline.setDate(deadline.getDate() + daysAhead);

  const result = [];
  for (const b of batches) {
    if (b.quantity <= 0) continue;
    const exp = b.expiryDate ? new Date(b.expiryDate) : null;
    if (!exp) continue;
    exp.setHours(0, 0, 0, 0);
    if (exp < today) continue;
    if (exp > deadline) continue;
    const daysLeft = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    result.push({
      medicineName: b.medicineName || b.batchNumber,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      daysLeft,
      quantity: b.quantity,
    });
  }
  result.sort((a, b) => a.daysLeft - b.daysLeft);
  return result;
}

export async function getLowStockItems(pharmacyId, threshold = 50) {
  const batches = await getPharmacyMedicines(pharmacyId);
  return batches
    .filter((b) => b.quantity > 0 && b.quantity < threshold)
    .map((b) => ({
      medicineName: b.medicineName || b.batchNumber,
      batchNumber: b.batchNumber,
      quantity: b.quantity,
    }))
    .sort((a, b) => a.quantity - b.quantity);
}

export async function getCustomerStats(pharmacyId) {
  const { data } = await supabase
    .from("orders")
    .select("payment_status, fulfillment_status")
    .eq("pharmacy_id", pharmacyId);

  let awaitingPayment = 0;
  let pendingShip = 0;
  let onTheWay = 0;
  let delivered = 0;
  let cancelled = 0;

  for (const r of data || []) {
    const p = (r.payment_status || "").toLowerCase();
    const f = (r.fulfillment_status || "").toLowerCase();
    if (f === "cancelled") cancelled += 1;
    else if (p !== "paid") awaitingPayment += 1;
    else if (f === "delivered") delivered += 1;
    else if (f === "on_the_way") onTheWay += 1;
    else pendingShip += 1;
  }

  return [
    { label: "Awaiting payment", value: awaitingPayment },
    { label: "Pending ship", value: pendingShip },
    { label: "On the way", value: onTheWay },
    { label: "Delivered", value: delivered },
    { label: "Cancelled", value: cancelled },
  ];
}
