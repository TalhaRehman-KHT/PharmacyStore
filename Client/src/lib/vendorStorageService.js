/**
 * Vendor storage service – mirrors my_fyp StorageService.
 * Upload medicine images to Supabase Storage bucket: DatabaseAssets
 */
import { supabase } from "./supabase.js";

const BUCKET = "DatabaseAssets";

export function medicineImagePath(medicineId) {
  return `medicines/${medicineId}/${Date.now()}.jpg`;
}

export async function uploadMedicineImage(file, medicineId) {
  const path = medicineImagePath(medicineId);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
