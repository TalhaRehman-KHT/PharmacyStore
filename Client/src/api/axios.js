import axios from "axios";

// Create a reusable axios instance
const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add interceptors for automatic token handling
axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Let browser set Content-Type for FormData (multipart/form-data)
    if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
    }
    return config;
});

export default axiosInstance;
