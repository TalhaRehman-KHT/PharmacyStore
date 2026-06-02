/**
 * Gemini AI service – medicine label scan (same as my_fyp GeminiService.analyzeMedicineLabel).
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Same as my_fyp: _visionModelName = 'gemini-3-flash-preview'
const VISION_MODEL = "gemini-3.5-flash";

const PROMPT = `Analyze this medicine packaging or label image. Extract the following and return ONLY valid JSON, no markdown or extra text:
{
  "name": "brand/trade name of the medicine",
  "genericName": "generic/active ingredient name if visible",
  "strength": "e.g. 500mg, 10ml",
  "dosageForm": "e.g. Tablet, Capsule, Syrup",
  "manufacturer": "company/manufacturer name",
  "description": "brief description or indication if visible"
}
Use empty string "" for any field you cannot read. Only include fields you can clearly see on the label.`;

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseResponse(text) {
  try {
    let jsonStr = (text || "").trim();
    const codeBlock = /```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(text);
    if (codeBlock) jsonStr = codeBlock[1].trim();
    const obj = JSON.parse(jsonStr);
    if (!obj || typeof obj !== "object") return {};
    const str = (v) => {
      if (v == null) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    };
    return {
      name: str(obj.name ?? obj.medicine_name),
      genericName: str(obj.genericName ?? obj.generic_name),
      strength: str(obj.strength),
      dosageForm: str(obj.dosageForm ?? obj.dosage_form ?? obj.form),
      manufacturer: str(obj.manufacturer),
      description: str(obj.description),
    };
  } catch {
    return {};
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Call API with retry for 429 (Too Many Requests). Same pattern as robust API clients.
 * Retries up to 4 times with exponential backoff: 1s, 2s, 4s, 8s.
 */
async function fetchWithRetry(url, options, maxRetries = 4) {
  let lastRes;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastRes = await fetch(url, options);
    if (lastRes.status === 429 && attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await sleep(delay);
      continue;
    }
    return lastRes;
  }
  return lastRes;
}

/**
 * Analyze medicine label image. Returns { name, genericName, strength, dosageForm, manufacturer, description }.
 * @param {File} file - Image file (from input or camera)
 */
export async function analyzeMedicineLabel(file) {
  if (!API_KEY) throw new Error("Gemini API key not configured");
  if (!file?.type?.startsWith("image/")) throw new Error("Please select an image file");

  const base64 = await toBase64(file);
  const mimeType = file.type || "image/jpeg";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
  };

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const candidates = data.candidates;
  if (!candidates?.length) throw new Error("No response from AI");

  const content = candidates[0]?.content;
  const parts = content?.parts;
  if (!parts?.length) throw new Error("Empty AI response");

  const text = parts[0]?.text;
  return parseResponse(text || "{}");
}

function isPrescriptionFile(file) {
  return file?.type?.startsWith("image/") || file?.type === "application/pdf";
}

const PRESCRIPTION_PROMPT = `Analyze this medical prescription image or PDF. Extract all medicines and return ONLY valid JSON, no markdown.

For each medicine provide:
- name: medicine name (brand or generic)
- dosage: how much to take (e.g. "1 tablet twice daily", "500mg 3 times")
- purpose: what it treats (simple words)
- instructions: when and how to take (simple words)

Also provide:
- warnings: list of important warnings or precautions
- summary: 1-2 sentence plain-language summary of the prescription

Format:
{
  "medicines": [{"name": "", "dosage": "", "purpose": "", "instructions": ""}],
  "warnings": ["warning1", "warning2"],
  "summary": "Brief summary"
}`;

function parsePrescriptionResponse(text) {
  try {
    let jsonStr = (text || "").trim();
    const codeBlock = /```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(text);
    if (codeBlock) jsonStr = codeBlock[1].trim();
    const obj = JSON.parse(jsonStr);
    if (!obj || typeof obj !== "object") return { medicines: [], warnings: [], summary: "" };
    const medicines = Array.isArray(obj.medicines)
      ? obj.medicines.map((m) => ({
          name: (m.name ?? "Unknown").toString().trim(),
          dosage: (m.dosage ?? "").toString().trim(),
          purpose: (m.purpose ?? "").toString().trim(),
          instructions: (m.instructions ?? "").toString().trim(),
        }))
      : [];
    const warnings = Array.isArray(obj.warnings) ? obj.warnings.map((w) => String(w)) : [];
    const summary = (obj.summary ?? "").toString().trim();
    return { medicines, warnings, summary };
  } catch {
    return { medicines: [], warnings: [], summary: text || "" };
  }
}

/**
 * Analyze prescription image/PDF. Returns { medicines: [{name, dosage, purpose, instructions}], warnings: [], summary }.
 * @param {File} file - Prescription image or PDF
 */
export async function analyzePrescription(file) {
  if (!API_KEY) throw new Error("Gemini API key not configured");
  if (!isPrescriptionFile(file)) throw new Error("Please select an image or PDF file");

  const base64 = await toBase64(file);
  const mimeType = file.type || "image/jpeg";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          { text: PRESCRIPTION_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
  };

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw new Error("Too many requests. Please wait and try again.");
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return parsePrescriptionResponse(text);
}

const ALTERNATIVES_PROMPT = (medicineName) => `You are a pharmacy assistant explaining medicines to someone with NO medical or pharmacy background. Use VERY SIMPLE language only - like explaining to a friend or grandparent. NO jargon, NO technical terms. Use short sentences and everyday words.

For the medicine "${medicineName}":

1. Write DETAILS in super simple language:
   - What is it? (in plain words)
   - What health problems does it help?
   - How does it help? (simple explanation)
   - What might you feel or notice? (side effects in plain words)
   - What to be careful about?
   - What forms is it available in? (tablet, syrup, etc.)
   MUST be understandable by someone who has never studied medicine. Avoid words like "analgesic", "antipyretic", "contraindication" - use "pain relief", "reduces fever", "who should NOT take it" instead.

2. Then provide 3-5 ALTERNATIVE medicines that can be used instead. For each alternative, write in the SAME simple language - no jargon.

Return ONLY valid JSON, no markdown or extra text. Format:
{
  "details": "Full description in VERY SIMPLE words that anyone can understand (2-4 short paragraphs, everyday language only)",
  "alternatives": [
    {
      "name": "Alternative medicine name",
      "details": "Brief description in simple words anyone can understand",
      "brands": "Common brand names",
      "price": "low/medium/high",
      "effectiveness": "How it compares - use simple words",
      "notes": "Key points in plain language"
    }
  ]
}`;

function parseAlternativesResponse(text) {
  try {
    let jsonStr = (text || "").trim();
    const codeBlock = /```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(text);
    if (codeBlock) jsonStr = codeBlock[1].trim();
    const obj = JSON.parse(jsonStr);
    if (!obj || typeof obj !== "object") return { details: "", alternatives: [] };
    const details = (obj.details ?? "").toString().trim();
    const alternatives = Array.isArray(obj.alternatives)
      ? obj.alternatives.map((a) => ({
          name: (a.name ?? "Unknown").toString().trim(),
          details: (a.details ?? "").toString().trim(),
          brands: (a.brands ?? "").toString().trim(),
          price: (a.price ?? "").toString().trim(),
          effectiveness: (a.effectiveness ?? "").toString().trim(),
          notes: (a.notes ?? "").toString().trim(),
        }))
      : [];
    return { details, alternatives };
  } catch {
    return { details: text || "", alternatives: [] };
  }
}

/**
 * Get medicine details and alternatives in simple language. Returns { details: string, alternatives: [{name, details, brands, price, effectiveness, notes}] }.
 * @param {string} medicineName - Medicine to look up
 */
export async function getMedicineDetailsWithAlternatives(medicineName) {
  if (!API_KEY) throw new Error("Gemini API key not configured");
  const name = (medicineName || "").toString().trim();
  if (!name) throw new Error("Please enter a medicine name");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: ALTERNATIVES_PROMPT(name) }] }],
  };

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw new Error("Too many requests. Please wait and try again.");
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return parseAlternativesResponse(text);
}
