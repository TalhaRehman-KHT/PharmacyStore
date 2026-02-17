import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { verifyOTPWithoutMarking } from "../../lib/authService.js";

export default function VerifyResetOtp() {
  const location = useLocation();
  const stateEmail = location.state?.email ?? "";

  const [email, setEmail] = useState(stateEmail);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (stateEmail) setEmail(stateEmail);
  }, [stateEmail]);

  useEffect(() => {
    if (!stateEmail && !email) {
      navigate("/forgot-password", { replace: true });
    }
  }, [stateEmail, email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (otp.length !== 6) {
      setError("OTP must be 6 digits.");
      return;
    }

    const emailLower = (email || stateEmail).trim().toLowerCase();
    if (!emailLower) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    try {
      await verifyOTPWithoutMarking({
        email: emailLower,
        otpCode: otp,
        otpType: "password_reset",
      });
      navigate("/reset-password", { state: { email: emailLower, otpCode: otp } });
    } catch (err) {
      setError(err.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const displayEmail = email || stateEmail;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <div className="hidden md:block md:w-1/2">
        <img src="/assets/storePic.jpg" alt="Pharmacy" className="w-full h-full object-cover" />
      </div>

      <div className="w-full md:w-1/2 flex flex-col p-6 sm:p-8 md:p-10 bg-white justify-center items-center text-center">
        <div className="flex flex-col justify-center items-center w-full max-w-sm sm:max-w-md">
          <h3 className="text-2xl sm:text-3xl font-semibold mb-2 text-gray-800">
            Verify reset code
          </h3>
          <span className="text-gray-600 mb-8 text-sm sm:text-base">
            Enter the 6-digit code sent to {displayEmail || "your email"}
          </span>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <input
              type="email"
              placeholder="Your email"
              value={displayEmail}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400 text-sm sm:text-base"
              required
            />

            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => {
                setError("");
                if (e.target.value.length <= 6 && /^[0-9]*$/.test(e.target.value))
                  setOtp(e.target.value);
              }}
              maxLength={6}
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400 text-center tracking-widest text-lg sm:text-xl"
              required
            />

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-medium"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Continue"}
            </button>
          </form>

          <Link to="/forgot-password" className="text-gray-500 text-sm hover:underline mt-4">
            Back to Forgot password
          </Link>
        </div>
      </div>
    </div>
  );
}
