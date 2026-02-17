import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { verifyOTP } from "../../lib/authService.js";

export default function VerifyOtp() {
  const location = useLocation();
  const stateEmail = location.state?.email ?? "";
  const stateRole = location.state?.role ?? "user";

  const [email, setEmail] = useState(stateEmail);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (stateEmail) setEmail(stateEmail);
  }, [stateEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (otp.length !== 6) {
      setError("OTP must be 6 digits.");
      return;
    }

    setLoading(true);
    try {
      await verifyOTP({
        email: email.trim(),
        otpCode: otp,
        otpType: "email_verification",
      });

      const loginPath = stateRole === "vendor" ? "/vendor/login" : "/user/login";
      navigate(loginPath, { state: { message: "Email verified. You can log in now." } });
    } catch (err) {
      setError(err.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const displayEmail = email;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <div className="hidden md:block md:w-1/2">
        <img src="/assets/storePic.jpg" alt="Pharmacy" className="w-full h-full object-cover" />
      </div>

      <div className="w-full md:w-1/2 flex flex-col p-6 sm:p-8 md:p-10 bg-white justify-center items-center text-center">
        <div className="flex flex-col justify-center items-center w-full max-w-sm sm:max-w-md">
          <h3 className="text-2xl sm:text-3xl font-semibold mb-2 text-gray-800">
            Verify Your Email
          </h3>
          <span className="text-gray-600 mb-8 text-sm sm:text-base">
            Enter the 6-digit OTP sent to your email
          </span>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <input
              type="email"
              placeholder="Your registered email"
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
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>

          <p className="text-gray-600 text-sm sm:text-base mt-4">
            Didn't receive the code? Check your spam folder or log in and request a new OTP later.
          </p>
        </div>
      </div>
    </div>
  );
}
