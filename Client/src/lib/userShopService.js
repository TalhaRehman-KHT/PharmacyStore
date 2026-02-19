import { supabase } from "./supabase.js";

function parseBatch(row) {
  const med = row.medicines || {};
  const pharm = row.pharmacies || {};
  const expiry = row.expiry_date || row.expiryDate;
  const price = row.selling_price ?? row.sellingPrice ?? 0;
  return {
    id: row.id,
    pharmacyId: row.pharmacy_id ?? row.pharmacyId,
    medicineId: row.medicine_id ?? row.medicineId,
    batchNumber: row.batch_number ?? row.batchNumber,
    expiryDate: expiry ? new Date(expiry) : null,
    quantity: row.quantity ?? 0,
    sellingPrice: typeof price === "number" ? price : parseFloat(price) || 0,
    medicineName: med.name,
    category: med.generic_name || med.dosage_form || "Medicine",
    description: med.description,
    pharmacyName: pharm.name,
    pharmacyAddress: pharm.address,
    pharmacyCity: pharm.city,
    pharmacyPhone: pharm.phone,
  };
}

export async function getShopMedicines() {
  const { data, error } = await supabase
    .from("medicine_batches")
    .select(
      `
      *,
      medicines ( id, name, generic_name, strength, dosage_form, manufacturer, description ),
      pharmacies ( id, name, address, city, phone )
    `
    )
    .gte("quantity", 1)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const batches = (data || []).map(parseBatch);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return batches.filter((b) => {
    if (!b.expiryDate) return true;
    const exp = new Date(b.expiryDate);
    exp.setHours(0, 0, 0, 0);
    return exp >= today;
  });
}
