import React, { useState, useContext } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { signIn } from "../../lib/authService.js";
import { getRoleHome } from "../../components/ProtectedRoute.jsx";

const VENDOR_ROLES = ["vendor", "admin"];
const USER_ROLES = ["user", "doctor"];

export default function Login({ role = "user" }) {
  const location = useLocation();
  const successMessage = location.state?.message;

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const isVendorFlow = role === "vendor";
  const loginLabel = isVendorFlow ? "Vendor" : "Customer";
  const registerPath = isVendorFlow ? "/vendor/register" : "/user/register";
  const allowedRoles = isVendorFlow ? VENDOR_ROLES : USER_ROLES;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userData = await signIn({
        email: form.email,
        password: form.password,
        allowedRoles,
      });
      if (!allowedRoles.includes(userData.role)) {
        setError(
          isVendorFlow
            ? "This account is a customer account. Please use the Customer sign-in page."
            : "This account is a vendor account. Please use the Vendor sign-in page."
        );
        setLoading(false);
        return;
      }
      login(userData);
      navigate(getRoleHome(userData.role));
    } catch (err) {
      setError(err.message || "Invalid email or password.");
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
        <div className="flex flex-col justify-center items-center w-full max-w-sm   p-6">
          <h3 className="text-2xl font-semibold mb-2">Welcome Back, {loginLabel}!</h3>
          <span className="text-gray-600 mb-8 text-sm md:text-base">
            Sign in to your {loginLabel.toLowerCase()} account
          </span>

          {successMessage && (
            <p className="w-full mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
              {successMessage}
            </p>
          )}

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

            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-green-400"
                required
              />
              <div
                className="absolute right-3 top-3 cursor-pointer text-gray-500 hover:text-green-500"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-transform hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <Link to="/forgot-password" className="text-green-600 font-medium hover:underline mb-3">
            Forgot Password?
          </Link>

          <p className="text-gray-600 text-sm">
            Don't have an account?{" "}
            <Link to={registerPath} className="text-green-600 font-medium hover:underline">
              Create {loginLabel.toLowerCase()} account
            </Link>
          </p>
          <Link to="/" className="text-gray-500 text-sm hover:underline mt-2">Back to home</Link>
        </div>
      </div>
    </div>
  );
}
