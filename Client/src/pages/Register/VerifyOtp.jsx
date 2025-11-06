import React, { useState, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";

export default function VerifyOtp() {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (otp.length !== 4) {
            setError("OTP must be 4 digits.");
            return;
        }

        setLoading(true);
        try {
            const { data } = await axios.post("http://localhost:5000/api/auth/verify-otp", {
                email,
                code: otp,
            });

            // Save to localStorage + Context
            const userData = {
                token: data.token,
                user: data.user,
            };
            login(userData);

            alert(data.message || "Email verified successfully!");
            console.log(userData)
            navigate("/Dashboard");
        } catch (err) {
            console.error(err.response?.data || err.message);
            setError(err.response?.data?.message || "Invalid OTP or Email");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen">
            <div className="hidden md:block md:w-1/2">
                <img
                    src="/assets/storePic.jpg"
                    alt="Pharmacy"
                    className="w-full h-full object-cover"
                />
            </div>

            <div className="w-full md:w-1/2 flex flex-col p-8 md:p-10 bg-white justify-center items-center text-center">
                <div className="flex flex-col justify-center items-center w-full max-w-sm">
                    <h3 className="text-2xl font-semibold mb-2">Verify Your Account</h3>
                    <span className="text-gray-600 mb-8 text-sm md:text-base">
                        Enter the 4-digit OTP sent to your email address
                    </span>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <input
                            type="email"
                            placeholder="Enter your registered email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                            required
                        />

                        <input
                            type="text"
                            placeholder="Enter 4-digit OTP"
                            value={otp}
                            onChange={(e) => {
                                setError("");
                                if (e.target.value.length <= 4 && /^[0-9]*$/.test(e.target.value))
                                    setOtp(e.target.value);
                            }}
                            maxLength={4}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400 text-center tracking-widest text-lg"
                            required
                        />

                        {error && <p className="text-red-500 text-sm">{error}</p>}

                        <button
                            type="submit"
                            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition"
                            disabled={loading}
                        >
                            {loading ? "Verifying..." : "Verify OTP"}
                        </button>
                    </form>

                    <div className="my-6 w-full h-px bg-gray-200" />

                    <p className="text-gray-600 text-sm">
                        Didn’t receive the code?{" "}
                        <a
                            href="#"
                            onClick={() => alert("Resend OTP feature coming soon!")}
                            className="text-green-600 font-medium hover:underline"
                        >
                            Resend OTP
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
