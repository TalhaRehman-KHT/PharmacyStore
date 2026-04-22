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
    dosageForm: med.dosage_form ?? null,
    category: med.generic_name || med.dosage_form || "Medicine",
    description: med.description,
    genericName: med.generic_name ?? null,
    imageUrl: med.image_url ?? med.imageUrl,
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
      medicines ( id, name, generic_name, strength, dosage_form, manufacturer, description, image_url ),
      pharmacies ( id, name, address, city, phone )
    `
    )
    .gte("quantity", 1)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  let batches = (data || []).map(parseBatch);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  batches = batches.filter((b) => {
    if (!b.expiryDate) return true;
    const exp = new Date(b.expiryDate);
    exp.setHours(0, 0, 0, 0);
    return exp >= today;
  });

  return { batches, medicines: groupBatchesByMedicine(batches) };
}

/** Group batches by medicine (same as my_fyp MedicineHelper.groupBatchesByMedicine). */
function groupBatchesByMedicine(batches) {
  const byMed = {};
  for (const b of batches) {
    const mid = b.medicineId;
    if (!byMed[mid]) byMed[mid] = [];
    byMed[mid].push(b);
  }

  return Object.values(byMed).map((batchList) => {
    const first = batchList[0];
    const totalQty = batchList.reduce((s, b) => s + (b.quantity || 0), 0);
    const earliestExpiry = batchList.reduce((a, b) => {
      const exp = b.expiryDate ? new Date(b.expiryDate) : null;
      if (!exp) return a;
      return !a || exp < a ? exp : a;
    }, null);
    const prices = batchList
      .filter((b) => b.sellingPrice != null && b.sellingPrice > 0)
      .map((b) => b.sellingPrice);
    const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    const bestBatch = batchList
      .filter((b) => b.quantity > 0)
      .sort((a, b) => (a.sellingPrice ?? 999) - (b.sellingPrice ?? 999))[0];

    return {
      id: first.medicineId,
      name: first.medicineName || "Unknown Medicine",
      category: (first.dosageForm || first.category || "General").trim() || "General",
      quantity: totalQty,
      price: avgPrice,
      expiryDate: earliestExpiry ? earliestExpiry.toISOString().split("T")[0] : "",
      description: first.description || first.genericName || null,
      imageUrl: first.imageUrl ?? null,
      bestBatch, // lowest-price in-stock batch for add-to-cart (same as Flutter _getBestBatchForMedicine)
    };
  });
}
