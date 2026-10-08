/**
 * Vendor pharmacy service – mirrors my_fyp PharmacyService.
 * Uses Supabase: pharmacies table.
 */
import { supabase } from "./supabase.js";

function toPharmacy(row) {
  if (!row) return null;
  return {
    id: row.id,
    vendorId: row.vendor_id ?? row.vendorId,
    name: row.name,
    licenseNumber: row.license_number ?? row.licenseNumber,
    address: row.address,
    city: row.city,
    phone: row.phone ?? null,
    isActive: row.is_active ?? row.isActive ?? true,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

export async function getPharmacyByVendorId(vendorId) {
  const { data, error } = await supabase
    .from("pharmacies")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("is_active", true)
    // One store per vendor; oldest wins if duplicates already exist.
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return toPharmacy(data);
}

async function getPharmacyById(pharmacyId) {
  const { data, error } = await supabase.from("pharmacies").select("*").eq("id", pharmacyId).maybeSingle();
  if (error) throw new Error(error.message);
  return toPharmacy(data);
}

export async function createPharmacy({
  vendorId,
  name,
  licenseNumber,
  address,
  city,
  phone,
}) {
  if (await getPharmacyByVendorId(vendorId)) {
    throw new Error("You already have a store. Edit it in Settings.");
  }

  const insert = {
    vendor_id: vendorId,
    name: name.trim(),
    license_number: (licenseNumber ?? "").trim(),
    address: (address ?? "").trim(),
    city: (city ?? "").trim(),
    is_active: true,
  };
  if (phone?.trim()) insert.phone = phone.trim();

  const { data, error } = await supabase
    .from("pharmacies")
    .insert(insert)
    .select()
    .single();

  if (error) throw new Error(error.message || "Database error");
  return toPharmacy(data);
}

export async function updatePharmacy(pharmacyId, { name, licenseNumber, address, city, phone }) {
  const updates = {};
  if (name != null) updates.name = name.trim();
  if (licenseNumber != null) updates.license_number = licenseNumber.trim();
  if (address != null) updates.address = address.trim();
  if (city != null) updates.city = city.trim();
  if (phone != null) updates.phone = phone.trim() || null;
  if (Object.keys(updates).length === 0) return getPharmacyById(pharmacyId);

  const { data, error } = await supabase
    .from("pharmacies")
    .update(updates)
    .eq("id", pharmacyId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toPharmacy(data);
}
