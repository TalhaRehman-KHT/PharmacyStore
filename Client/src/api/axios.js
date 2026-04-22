import axios from "axios";
import { getStoredUser } from "../lib/authService.js";

/** Hosted Pharmacy Store API (Vercel). */
export const HOSTED_PHARMACY_API = "https://server-delta-sandy-36.vercel.app";

/** Local Express API (PharmacyStore/Server, default PORT 5050). */
export const LOCAL_PHARMACY_API = "http://localhost:5050";

/**
 * API base URL:
 * - `VITE_API_URL` in .env wins if set.
 * - Else: Vite dev → LOCAL_PHARMACY_API; production build → HOSTED_PHARMACY_API.
 */
function apiBaseURL() {
  const v = import.meta.env.VITE_API_URL;
  if (v != null && String(v).trim() !== "") {
    return String(v).trim().replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return LOCAL_PHARMACY_API;
  }
  return HOSTED_PHARMACY_API;
}

const axiosInstance = axios.create({
  baseURL: apiBaseURL(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60_000,
});

// Optional: send user id for any backend that expects custom auth
axiosInstance.interceptors.request.use((config) => {
  const user = getStoredUser();
  if (user?.id) {
    config.headers["X-User-Id"] = user.id;
  }
  return config;
});

export default axiosInstance;
