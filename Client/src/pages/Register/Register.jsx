import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { signUp } from "../../lib/authService.js";
import GoogleSignInSection from "../../components/GoogleSignInSection.jsx";

const DEFAULT_FORM = {
  name: "",
  email: "",
  phone: "",
  password: "",
  company_name: "",
  address: "",
};

export default function Register({ role = "user" }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const navigate = useNavigate();
  const isVendor = role === "vendor";
  const label = isVendor ? "Vendor" : "Customer";

  const handleChange = (e) => {
    setError("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== confirmPassword) return setError("Passwords do not match");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");

    setLoading(true);
    setError("");
    try {
      await signUp({
        email: form.email,
        password: form.password,
        name: form.name,
        // Vendor store details are collected in Create Store, not at signup.
        phone: isVendor ? null : form.phone || null,
        role: role || "user",
        companyName: null,
        address: null,
      });

      alert("Account created. Please verify your email with the OTP sent to your inbox.");
      navigate("/verify-otp", { state: { email: form.email.trim().toLowerCase(), role } });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const loginPath = isVendor ? "/vendor/login" : "/user/login";

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block md:w-1/2">
        <img src="/assets/storePic.jpg" alt="Pharmacy" className="w-full h-full object-cover" />
      </div>

      <div className="w-full md:w-1/2 flex flex-col p-6 md:p-10 bg-white justify-center items-center text-center">
        <div className="flex flex-col justify-center items-center w-full max-w-sm  p-6">
          <h3 className="text-2xl font-semibold mb-2">Create {label} Account</h3>
          <span className="text-gray-600 mb-8 text-sm md:text-base">
            Join as {label.toLowerCase()}
          </span>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={form.name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />

            <input
              type="tel"
              name="phone"
              placeholder="Phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
              style={{ display: isVendor ? "none" : undefined }}
            />

            <div className="relative w-full">
              <input
                type={showPass ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
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
                name="confirmPassword"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-transform hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          <GoogleSignInSection
            isVendorFlow={isVendor}
            setError={setError}
            setLoading={setLoading}
          />

          <p className="text-gray-600 text-sm my-1">
            Already have an account?{" "}
            <Link to={loginPath} className="text-green-600 font-medium hover:underline">
              Sign in as {label}
            </Link>
          </p>
          <Link to="/" className="text-gray-500 text-sm hover:underline mt-2">Back to home</Link>
        </div>
      </div>
    </div>
  );
}
