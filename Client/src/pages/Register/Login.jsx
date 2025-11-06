import React, { useState, useContext } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";

export default function Login() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useContext(AuthContext);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { data } = await axios.post("http://localhost:5000/api/auth/login", form);

            // Save user + token in Context and localStorage
            login({
                token: data.token,
                user: data.user,
            });

            alert("Login successful!");

            navigate("/Dashboard");
            console.log(data);
        } catch (err) {
            console.error(err.response?.data || err.message);
            setError(err.response?.data?.message || "Invalid email or password");
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
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Right Section */}
            <div className="w-full md:w-1/2 flex flex-col p-8 md:p-10 bg-white justify-center items-center text-center">
                <div className="flex flex-col justify-center items-center w-full max-w-sm">
                    <h3 className="text-2xl font-semibold mb-2">Welcome Back!</h3>
                    <span className="text-gray-600 mb-8 text-sm md:text-base">
                        Log in to continue to Pharmacy Store
                    </span>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <input
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={form.email}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                            required
                        />

                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={form.password}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                            required
                        />

                        {error && <p className="text-red-500 text-sm">{error}</p>}

                        <button
                            type="submit"
                            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition"
                            disabled={loading}
                        >
                            {loading ? "Logging in..." : "Login"}
                        </button>
                    </form>

                    <div className="my-4 w-full h-px bg-gray-200" />

                    <Link
                        to="/forgot-password"
                        className="text-green-600 font-medium hover:underline mb-3"
                    >
                        Forgot Password?
                    </Link>

                    <p className="text-gray-600 text-sm">
                        Don’t have an account?{" "}
                        <a href="/register" className="text-green-600 font-medium hover:underline">
                            Create new account
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
