import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useVendorDashboard } from "../context/VendorDashboardContext.jsx";

/**
 * Redirects vendor to /vendor/create-store if they have no pharmacy.
 * Use only on vendor dashboard routes (not on create-store itself).
 */
export default function VendorRouteGuard({ children }) {
  const { pharmacy, loading } = useVendorDashboard();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!pharmacy?.id && !location.pathname.includes("/vendor/create-store")) {
      navigate("/vendor/create-store", { replace: true });
    }
  }, [pharmacy?.id, loading, navigate, location.pathname]);

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
