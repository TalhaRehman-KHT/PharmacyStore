import { useEffect, useContext } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useVendorDashboard } from "../context/VendorDashboardContext.jsx";
import { AuthContext } from "../context/AuthContext.jsx";

/** Pages an admin may open; everything else under /vendor sends them to payouts. */
const ADMIN_PATHS = ["/vendor/admin-orders", "/vendor/escalations"];

/**
 * Redirects vendor to /vendor/create-store if they have no pharmacy.
 * Admins skip this (they use Payout review and the escalation queue without owning a store).
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
    if (ADMIN_PATHS.some((p) => location.pathname.startsWith(p))) {
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
