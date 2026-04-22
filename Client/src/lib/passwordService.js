/**
 * Matches my_fyp PasswordService: SHA-256 with salt, format "salt:hash".
 * Uses Web Crypto API (browser).
 */

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash password with salt. Returns "salt:hexHash".
 * @param {string} password
 * @param {string} [salt] - If omitted, generates a new salt.
 * @returns {Promise<string>}
 */
export async function hashPassword(password, salt) {
  const saltToUse = salt ?? generateSalt();
  const message = password + saltToUse;
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hexHash = bufferToHex(hashBuffer);
  return `${saltToUse}:${hexHash}`;
}

/**
 * Verify password against stored "salt:hash".
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [salt, storedHex] = parts;
    const computed = await hashPassword(password, salt);
    const computedHex = computed.split(":")[1];
    return computedHex === storedHex;
  } catch {
    return false;
  }
}

/** Generate 6-digit OTP (string). */
export function generateOTP() {
  return String(100000 + Math.floor(Math.random() * 900000));
}
