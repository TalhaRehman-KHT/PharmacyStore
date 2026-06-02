/**
 * Prescription service – upload prescription file, save to prescriptions table, create reminders.
 * Mirrors my_fyp PrescriptionService.savePrescription.
 */
import { supabase } from "./supabase.js";

const BUCKET = "DatabaseAssets";

function isPrescriptionFile(file) {
  return file?.type?.startsWith("image/") || file?.type === "application/pdf";
}

function prescriptionFilePath(userId, file) {
  const extensionByType = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const extension = extensionByType[file?.type] || "jpg";
  return `prescriptions/${userId}/${Date.now()}.${extension}`;
}

/**
 * Format time for API: { hour, minute } -> "HH:mm:00"
 */
function timeToApi({ hour, minute }) {
  const h = String(hour).padStart(2, "0");
  const m = String(minute ?? 0).padStart(2, "0");
  return `${h}:${m}:00`;
}

/**
 * Save prescription: upload file, insert prescriptions row, then for each medicine
 * insert reminders + reminder_times.
 * @param {string} userId
 * @param {File} imageFile - Prescription image/PDF file
 * @param {string} aiExtractedText
 * @param {string} aiSummary
 * @param {Array<{ name: string, dosage?: string, purpose?: string, instructions?: string, endDate: string | null, reminderTimes: Array<{ hour: number, minute: number }> }>} medicines
 */
export async function savePrescription(userId, imageFile, aiExtractedText, aiSummary, medicines) {
  if (!userId) throw new Error("User ID required");
  if (!isPrescriptionFile(imageFile)) throw new Error("Please provide an image or PDF file");
  if (!medicines?.length) throw new Error("At least one medicine required");

  const path = prescriptionFilePath(userId, imageFile);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, imageFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: imageFile.type || "image/jpeg",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const imageUrl = publicUrlData?.publicUrl;
  if (!imageUrl) throw new Error("Failed to get image URL");

  const { data: prescriptionRow, error: prescError } = await supabase
    .from("prescriptions")
    .insert({
      user_id: userId,
      image_url: imageUrl,
      ai_extracted_text: aiExtractedText || "",
      ai_summary: aiSummary || "",
    })
    .select("id")
    .single();

  if (prescError) throw new Error(prescError.message);
  const prescriptionId = prescriptionRow?.id ?? null;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  for (const med of medicines) {
    const endDate = med.endDate || todayStr;
    const times = med.reminderTimes?.length
      ? med.reminderTimes
      : [{ hour: 8, minute: 0 }];

    const { data: reminderRow, error: remError } = await supabase
      .from("reminders")
      .insert({
        user_id: userId,
        prescription_id: prescriptionId,
        medicine_name: med.name || "Unknown",
        dosage: med.dosage || null,
        start_date: todayStr,
        end_date: endDate,
        is_active: true,
      })
      .select("id")
      .single();

    if (remError) throw new Error(remError.message);
    const reminderId = reminderRow?.id;
    if (!reminderId) continue;

    for (const t of times) {
      const { error: timeError } = await supabase.from("reminder_times").insert({
        reminder_id: reminderId,
        schedule_time: timeToApi(t),
      });
      if (timeError) throw new Error(timeError.message);
    }
  }
}
