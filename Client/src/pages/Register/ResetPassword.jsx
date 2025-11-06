import React, { useState, useEffect } from "react";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        if (!token) setError("Invalid or missing reset token");
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirm) return setError("Passwords do not match");

        setLoading(true);
        setError("");
        setMessage("");

        try {
            const { data } = await axios.post("http://localhost:5000/api/auth/reset-password", {
                token,
                newPassword: password,
            });
            setMessage(data.message);
            setTimeout(() => navigate("/login"), 2000);
        } catch (err) {
            setError(err.response?.data?.message || "Error resetting password");
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
                    <h3 className="text-2xl font-semibold mb-2">Reset Your Password</h3>
                    <span className="text-gray-600 mb-8 text-sm md:text-base">
                        Enter a new password below
                    </span>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <div className="relative w-full">
                            <input
                                type={showPass ? "text" : "password"}
                                placeholder="New Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-green-400"
                                required
                            />
                            <div
                                className="absolute right-3 top-3 cursor-pointer text-gray-500 hover:text-green-500"
                                onClick={() => setShowPass(!showPass)}
                            >
                                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                            </div>
                        </div>

                        <div className="relative w-full">
                            <input
                                type={showConfirm ? "text" : "password"}
                                placeholder="Confirm Password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-green-400"
                                required
                            />
                            <div
                                className="absolute right-3 top-3 cursor-pointer text-gray-500 hover:text-green-500"
                                onClick={() => setShowConfirm(!showConfirm)}
                            >
                                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                            </div>
                        </div>

                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        {message && <p className="text-green-600 text-sm">{message}</p>}

                        <button
                            type="submit"
                            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-transform hover:scale-[1.02]"
                            disabled={loading || !token}
                        >
                            {loading ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
