/**
 * The logged-in user's id, read from where the existing app keeps it.
 *
 * authService.js stores the user object under localStorage["user"] (no token). Read-only:
 * MedAssist never writes this key.
 */
const USER_STORAGE_KEY = "user";

/** @returns {string | null} */
export function getCurrentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "null");
    const id = typeof user?.id === "string" ? user.id.trim() : "";
    return id || null;
  } catch {
    return null;
  }
}
