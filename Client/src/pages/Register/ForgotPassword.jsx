import React, { useState } from "react";
import axios from "axios";
import axiosInstance from "../../api/axios.js";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        try {
            const { data } = await axiosInstance.post("/api/auth/forgot-password", { email });
            setMessage(data.message);
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
            <div className="hidden md:block md:w-1/2">
                <img src="/assets/storePic.jpg" alt="Pharmacy" className="w-full h-full object-cover" />
            </div>

            <div className="w-full md:w-1/2 flex flex-col p-6 md:p-10 bg-white justify-center items-center text-center">
                <div className="flex flex-col justify-center items-center w-full max-w-sm  p-6">
                    <h3 className="text-2xl font-semibold mb-2">Forgot Password?</h3>
                    <span className="text-gray-600 mb-8 text-sm md:text-base">
                        Enter your registered email to receive a reset link
                    </span>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                            required
                        />

                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        {message && <p className="text-green-600 text-sm">{message}</p>}

                        <button
                            type="submit"
                            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-transform hover:scale-[1.02]"
                            disabled={loading}
                        >
                            {loading ? "Sending..." : "Send Reset Link"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
