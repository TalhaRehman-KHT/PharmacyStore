import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { resetPassword } from "../../lib/authService.js";

export default function ResetPassword() {
  const location = useLocation();
  const stateEmail = location.state?.email ?? "";
  const stateOtpCode = location.state?.otpCode ?? "";
  const fromVerifyStep = Boolean(stateEmail && stateOtpCode);

  const [email, setEmail] = useState(stateEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const navigate = useNavigate();

  const effectiveEmail = fromVerifyStep ? stateEmail : email.trim().toLowerCase();
  const effectiveOtp = fromVerifyStep ? stateOtpCode : otp;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords do not match");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (!fromVerifyStep && otp.length !== 6) return setError("OTP must be 6 digits.");
    if (!effectiveEmail) return setError("Email is required.");
    if (!effectiveOtp) return setError("OTP is required.");

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await resetPassword({
        email: effectiveEmail,
        otpCode: effectiveOtp,
        newPassword: password,
      });
      setMessage("Password updated. Redirecting to login...");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setError(err.message || "Error resetting password.");
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
          <h3 className="text-2xl font-semibold mb-2">
            {fromVerifyStep ? "New password" : "Reset Your Password"}
          </h3>
          <span className="text-gray-600 mb-8 text-sm md:text-base">
            {fromVerifyStep
              ? "Set a new password for your account."
              : "Enter your email, the OTP sent to you, and a new password"}
          </span>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={fromVerifyStep ? stateEmail : email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={fromVerifyStep}
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
              required
            />

            {!fromVerifyStep && (
              <input
                type="text"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => {
                  if (e.target.value.length <= 6 && /^[0-9]*$/.test(e.target.value)) setOtp(e.target.value);
                }}
                maxLength={6}
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400 text-center"
                required
              />
            )}

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
              disabled={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <Link to="/" className="text-green-600 font-medium hover:underline mt-4 inline-block">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
