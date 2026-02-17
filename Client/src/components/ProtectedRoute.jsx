import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

/**
 * Protects routes by auth and optional role.
 * - If not authenticated -> redirect to /login, then back here after login.
 * - If allowedRoles is set and user's role is not in the list -> redirect to role home.
 */
export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { user, loading, userRole } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    const loginPath = location.pathname.startsWith("/vendor")
      ? "/vendor/login"
      : location.pathname.startsWith("/user")
        ? "/user/login"
        : "/";
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles != null && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.includes(userRole);
    if (!hasAccess) {
      const roleHome = getRoleHome(userRole);
      return <Navigate to={roleHome} replace />;
    }
  }

  return children;
}

export function getRoleHome(role) {
  switch (role) {
    case "vendor":
      return "/vendor/dashboard";
    case "user":
      return "/user/dashboard";
    case "admin":
      return "/vendor/dashboard";
    case "doctor":
      return "/user/dashboard";
    default:
      return "/";
  }
}
