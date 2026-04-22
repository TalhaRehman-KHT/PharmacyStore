import { useEffect, useContext } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useVendorDashboard } from "../context/VendorDashboardContext.jsx";
import { AuthContext } from "../context/AuthContext.jsx";

/**
 * Redirects vendor to /vendor/create-store if they have no pharmacy.
 * Admins skip this (they use Payout review without owning a store).
 */
export default function VendorRouteGuard({ children }) {
  const { user } = useContext(AuthContext);
  const { pharmacy, loading } = useVendorDashboard();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isAdmin) return;
    if (loading) return;
    if (!pharmacy?.id && !location.pathname.includes("/vendor/create-store")) {
      navigate("/vendor/create-store", { replace: true });
    }
  }, [isAdmin, pharmacy?.id, loading, navigate, location.pathname]);

  if (isAdmin) {
    if (location.pathname.startsWith("/vendor/admin-orders")) {
      return children;
    }
    return <Navigate to="/vendor/admin-orders" replace />;
  }

  if (loading && !pharmacy?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-green border-t-transparent" />
      </div>
    );
  }

  if (!pharmacy?.id && !location.pathname.includes("/vendor/create-store")) {
    return null;
  }

  return children;
}
