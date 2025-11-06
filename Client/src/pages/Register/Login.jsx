import React, { useState } from "react";

export default function Login() {
    const [form, setForm] = useState({ email: "", password: "" });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Login attempt:", form);
        // Later you’ll call your API here (e.g., axios.post('/auth/login', form))
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

            {/* Right Content Section */}
            <div className="w-full md:w-1/2 flex flex-col p-8 md:p-10 relative bg-white justify-center items-center text-center">
                {/* Form Section */}
                <div className="flex flex-col justify-center items-center w-full max-w-sm">
                    <h3 className="text-2xl font-semibold mb-2">Welcome Back!</h3>
                    <span className="text-gray-600 mb-8 text-sm md:text-base">
                        Log in to continue to Pharmacy Store
                    </span>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        {/* Email Input */}
                        <input
                            type="email"
                            name="email"
                            placeholder="Email"
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

                        {/* Login Button */}
                        <button
                            type="submit"
                            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition"
                        >
                            Login
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="my-6 w-full h-px bg-gray-200" />

                    {/* Create Account Link */}
                    <p className="text-gray-600 text-sm">
                        Don’t have an account?{" "}
                        <a
                            href="/register"
                            className="text-green-600 font-medium hover:underline"
                        >
                            Create new account
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
