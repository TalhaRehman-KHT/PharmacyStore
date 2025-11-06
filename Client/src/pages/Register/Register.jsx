// src/pages/Register.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

export default function Register() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
    });
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    // read role from query string ?role=vendor
    const [role, setRole] = useState("");
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const r = params.get("role") || "";
        setRole(r);
    }, [location.search]);

    const handleChange = (e) => {
        setError("");
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // basic validation
        if (form.password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (form.password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        try {
            // send to your backend register route (as requested)
            const payload = { name: form.name, email: form.email, password: form.password, role };

            const { data } = await axios.post(
                "http://localhost:5000/api/auth/register",
                payload
            );

            // success message - backend should instruct to check email for OTP
            alert(data.message || "Registered successfully. Check your email for OTP to verify.");
            // optionally redirect to login or verification page
            navigate("/verify-otp");
        } catch (err) {
            console.error("Register error:", err.response?.data || err.message);
            setError(err.response?.data?.message || err.response?.data?.error || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen">
            {/* Left Image Section */}
            <div className="hidden md:block md:w-1/2">
                <img
                    src="/assets/storePic.jpg"
                    alt="Pharmacy"
                    className="w-full h-full object-cover "
                />
            </div>

            {/* Right Content Section */}
            <div className="w-full md:w-1/2 flex flex-col p-8 md:p-10 relative bg-white justify-center items-center text-center">
                {/* Centered Content */}
                <div className="flex flex-col justify-center items-center w-full max-w-sm">
                    <h3 className="text-2xl font-semibold mb-2">
                        Create Your Account
                    </h3>
                    <span className="text-gray-600 mb-8 text-sm md:text-base">
                        Join our pharmacy store community
                    </span>

                    {role && (
                        <div className="mb-3 text-sm text-gray-600">
                            Registering as: <strong>{role}</strong>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        {/* Name Input */}
                        <input
                            type="text"
                            name="name"
                            placeholder="Full Name"
                            value={form.name}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                            required
                        />

                        {/* Email Input */}
                        <input
                            type="email"
                            name="email"
                            placeholder="Email Address"
                            value={form.email}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                            required
                        />

                        {/* Password Input */}
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={form.password}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                            required
                        />

                        {/* Confirm Password */}
                        <input
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => {
                                setError("");
                                setConfirmPassword(e.target.value);
                            }}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                            required
                        />

                        {/* Inline error */}
                        {error && <p className="text-red-500 text-sm">{error}</p>}

                        {/* Create Account Button */}
                        <button
                            type="submit"
                            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition"
                            disabled={loading}
                        >
                            {loading ? "Creating..." : "Create Account"}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="my-6 w-full h-px bg-gray-200" />

                    {/* Already have account */}
                    <p className="text-gray-600 text-sm">
                        Already have an account?{" "}
                        <a
                            href="/login"
                            className="text-green-600 font-medium hover:underline"
                        >
                            Login
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
