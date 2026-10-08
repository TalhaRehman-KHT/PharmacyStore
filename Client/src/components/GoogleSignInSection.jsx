import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { AuthContext } from "../context/AuthContext.jsx";
import { signInWithGoogle } from "../lib/authService.js";
import { getRoleHome } from "./ProtectedRoute.jsx";

const VENDOR_ROLES = ["vendor", "admin"];
const USER_ROLES = ["user", "doctor"];

export default function GoogleSignInSection({ isVendorFlow, setError, setLoading }) {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const role = isVendorFlow ? "vendor" : "user";
  const allowedRoles = isVendorFlow ? VENDOR_ROLES : USER_ROLES;

  const handleSuccess = async (credentialResponse) => {
    const cred = credentialResponse.credential;
    if (!cred) {
      setError?.("Google did not return a credential.");
      return;
    }
    setLoading?.(true);
    setError?.("");
    try {
      const userData = await signInWithGoogle({ credential: cred, role });
      if (!allowedRoles.includes(userData.role)) {
        setError?.(
          isVendorFlow
            ? "This account is a customer account. Please use the Customer sign-in page."
            : "This account is a vendor account. Please use the Vendor sign-in page."
        );
        return;
      }
      login(userData);
      navigate(getRoleHome(userData.role));
    } catch (e) {
      setError?.(e.message || "Google sign-in failed.");
    } finally {
      setLoading?.(false);
    }
  };

  return (
    <div className="w-full mt-4 flex flex-col items-center gap-2">
      <p className="text-gray-400 text-xs w-full text-center">or</p>
      <div className="w-full flex justify-center min-h-10">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError?.("Google sign-in was cancelled or failed.")}
          text="continue_with"
          shape="rectangular"
          size="large"
          width="320"
        />
      </div>
    </div>
  );
}
