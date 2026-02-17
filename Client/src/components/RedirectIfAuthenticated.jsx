import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { getRoleHome } from "./ProtectedRoute.jsx";

/**
 * For login/start/register: if user is already authenticated, redirect to their role-based dashboard.
 */
export default function RedirectIfAuthenticated({ children }) {
  const { user, loading, userRole } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (user) {
    const roleHome = getRoleHome(userRole);
    return <Navigate to={roleHome} replace />;
  }

  return children;
}
