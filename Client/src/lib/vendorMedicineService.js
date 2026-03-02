/**
 * Vendor medicine service – mirrors my_fyp MedicineService.
 * Uses Supabase: medicines, medicine_batches.
 */
import { supabase } from "./supabase.js";

const LOW_STOCK_THRESHOLD = 50;

function parseBatch(row) {
  const med = row.medicines || {};
  const expiry = row.expiry_date ?? row.expiryDate;
  const price = row.selling_price ?? row.sellingPrice ?? 0;
  const quantity = row.quantity ?? 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = expiry ? new Date(expiry) : null;
  expDate?.setHours(0, 0, 0, 0);
  let status = "available";
  if (quantity <= 0 || (expDate && expDate < today)) status = "expired";
  else if (quantity < LOW_STOCK_THRESHOLD) status = "low_stock";

  return {
    id: row.id,
    pharmacyId: row.pharmacy_id ?? row.pharmacyId,
    medicineId: row.medicine_id ?? row.medicineId,
    batchNumber: row.batch_number ?? row.batchNumber,
    expiryDate: expiry,
    purchasePrice: row.purchase_price != null ? parseFloat(row.purchase_price) : null,
    sellingPrice: typeof price === "number" ? price : parseFloat(price) || 0,
    quantity,
    createdAt: row.created_at ?? row.createdAt,
    medicineName: med.name,
    genericName: med.generic_name ?? med.genericName,
    strength: med.strength,
    dosageForm: med.dosage_form ?? med.dosageForm,
    description: med.description,
    imageUrl: med.image_url ?? med.imageUrl,
    status,
  };
}

export async function getPharmacyMedicines(pharmacyId) {
  const { data, error } = await supabase
    .from("medicine_batches")
    .select(
      `
      *,
      medicines ( id, name, generic_name, strength, dosage_form, manufacturer, description, image_url )
    `
    )
    .eq("pharmacy_id", pharmacyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(parseBatch);
}

/** Batch status for filtering: available | low_stock | expired | out_of_stock */
export function batchStatus(batch) {
  const quantity = batch.quantity ?? 0;
  const expiry = batch.expiryDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = expiry ? new Date(expiry) : null;
  if (expDate) expDate.setHours(0, 0, 0, 0);
  if (quantity <= 0) return "out_of_stock";
  if (expDate && expDate < today) return "expired";
  if (quantity < LOW_STOCK_THRESHOLD) return "low_stock";
  return "available";
}

/** Batches expiring within withinDays (default 60) for vendor expiring-soon page */
export async function getExpiringSoonBatches(pharmacyId, withinDays = 60) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const end = new Date(today);
  end.setDate(end.getDate() + withinDays);
  const endStr = end.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("medicine_batches")
    .select(
      `
      *,
      medicines ( id, name, generic_name, strength, dosage_form, image_url )
    `
    )
    .eq("pharmacy_id", pharmacyId)
    .gte("expiry_date", todayStr)
    .lte("expiry_date", endStr)
    .order("expiry_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(parseBatch);
}

export async function getMedicineCount(pharmacyId) {
  const batches = await getPharmacyMedicines(pharmacyId);
  const ids = new Set(batches.map((b) => b.medicineId));
  return ids.size;
}

export async function getLowStockCount(pharmacyId) {
  const batches = await getPharmacyMedicines(pharmacyId);
  return batches.filter((b) => b.quantity > 0 && b.quantity < LOW_STOCK_THRESHOLD).length;
}

export async function createMedicine({ name, genericName, strength, dosageForm, manufacturer, description, imageUrl }) {
  const insert = {
    name: (name ?? "").trim(),
  };
  if (genericName?.trim()) insert.generic_name = genericName.trim();
  if (strength?.trim()) insert.strength = strength.trim();
  if (dosageForm?.trim()) insert.dosage_form = dosageForm.trim();
  if (manufacturer?.trim()) insert.manufacturer = manufacturer.trim();
  if (description?.trim()) insert.description = description.trim();
  if (imageUrl?.trim()) insert.image_url = imageUrl.trim();

  const { data, error } = await supabase.from("medicines").insert(insert).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function addMedicineBatch({
  pharmacyId,
  medicineId,
  batchNumber,
  expiryDate,
  quantity,
  purchasePrice,
  sellingPrice,
}) {
  const insert = {
    pharmacy_id: pharmacyId,
    medicine_id: medicineId,
    batch_number: (batchNumber ?? "").trim(),
    expiry_date: expiryDate instanceof Date ? expiryDate.toISOString().split("T")[0] : String(expiryDate || "").split("T")[0],
    quantity: Math.max(0, parseInt(quantity, 10) || 0),
  };
  if (purchasePrice != null) insert.purchase_price = parseFloat(purchasePrice);
  if (sellingPrice != null) insert.selling_price = parseFloat(sellingPrice);

  const { data, error } = await supabase.from("medicine_batches").insert(insert).select().single();
  if (error) throw new Error(error.message);
  return parseBatch(data);
}

export async function updateMedicine(medicineId, { name, genericName, strength, dosageForm, manufacturer, description, imageUrl }) {
  const updates = {};
  if (name != null) updates.name = name.trim();
  if (genericName != null) updates.generic_name = genericName.trim() || null;
  if (strength != null) updates.strength = strength.trim() || null;
  if (dosageForm != null) updates.dosage_form = dosageForm.trim() || null;
  if (manufacturer != null) updates.manufacturer = manufacturer.trim() || null;
  if (description != null) updates.description = description.trim() || null;
  if (imageUrl !== undefined) updates.image_url = imageUrl?.trim() || null;

  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase.from("medicines").update(updates).eq("id", medicineId);
  if (error) throw new Error(error.message);
}

export async function updateBatch(batchId, { batchNumber, expiryDate, quantity, purchasePrice, sellingPrice }) {
  const updates = {};
  if (batchNumber != null) updates.batch_number = String(batchNumber).trim();
  if (expiryDate != null) {
    const d = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
    updates.expiry_date = d.toISOString().split("T")[0];
  }
  if (quantity != null) updates.quantity = Math.max(0, parseInt(quantity, 10) || 0);
  if (purchasePrice != null) updates.purchase_price = parseFloat(purchasePrice);
  if (sellingPrice != null) updates.selling_price = parseFloat(sellingPrice);

  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase.from("medicine_batches").update(updates).eq("id", batchId);
  if (error) throw new Error(error.message);
}

export async function deleteBatch(batchId) {
  const { error } = await supabase.from("medicine_batches").delete().eq("id", batchId);
  if (error) throw new Error(error.message);
}

export async function deleteBatchesByPharmacyAndMedicine(pharmacyId, medicineId) {
  const { error } = await supabase
    .from("medicine_batches")
    .delete()
    .eq("pharmacy_id", pharmacyId)
    .eq("medicine_id", medicineId);
  if (error) throw new Error(error.message);
}

export async function deleteMedicine(medicineId) {
  const { error: batchErr } = await supabase.from("medicine_batches").delete().eq("medicine_id", medicineId);
  if (batchErr) throw new Error(batchErr.message);
  const { error: medErr } = await supabase.from("medicines").delete().eq("id", medicineId);
  if (medErr) throw new Error(medErr.message);
}
