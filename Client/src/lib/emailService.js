/**
 * Send OTP emails via EmailJS (signup verification & forgot password).
 * Template variables: {{passcode}}, {{time}}, plus optional {{email}}, {{type}}.
 */
import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_ym6n8bq";
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_rfoa1hw";
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "fMjzAE63XmiCBebZr";

let initialized = false;

function ensureInit() {
  if (!initialized) {
    emailjs.init(PUBLIC_KEY);
    initialized = true;
  }
}

/**
 * Send OTP email.
 * @param {string} recipientEmail - To address
 * @param {string} otpCode - 6-digit OTP
 * @param {'email_verification'|'password_reset'} otpType
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendOTPEmail(recipientEmail, otpCode, otpType) {
  ensureInit();

  const typeLabel =
    otpType === "email_verification" ? "Email Verification" : "Password Reset";

  // Valid until ~15 min (for "This OTP will be valid for 15 minutes till {{time}}")
  const validUntil = new Date(Date.now() + 15 * 60 * 1000).toLocaleString();

  const templateParams = {
    passcode: otpCode,
    time: validUntil,
    email: recipientEmail,
    to_email: recipientEmail,
    type: typeLabel,
    message_type: typeLabel,
  };

  try {
    const res = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
    return { ok: res.status === 200 };
  } catch (err) {
    console.error("EmailJS send error:", err);
    return { ok: false, error: err.text || err.message };
  }
}
