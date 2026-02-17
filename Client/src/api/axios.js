import axios from "axios";
import { getStoredUser } from "../lib/authService.js";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
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
