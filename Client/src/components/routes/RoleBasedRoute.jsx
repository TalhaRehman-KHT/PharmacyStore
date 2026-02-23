import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { decodeJwt } from "../../utils/jwtDecode.js";
import ProtectedRoute from "./ProtectedRoute.jsx";
import UserDashboardLayout from "../layout/UserDashboardLayout.jsx";
import VendorDashboardLayout from "../layout/VendorDashboardLayout.jsx";
import VendorStoreSetup from "../../pages/Dashboard/VendorStoreSetup.jsx";

const STORE_SETUP_PATH = "/dashboard/store-setup";
const STORE_CREATED_KEY = "vendorStoreCreated";

function hasVendorStore() {
    return localStorage.getItem(STORE_CREATED_KEY) === "true";
}

export default function RoleBasedRoute({ children }) {
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const pathname = location.pathname;

    const getRole = () => {
        const token = user?.token ?? localStorage.getItem("token");
        const payload = decodeJwt(token);
        if (payload?.role) return payload.role;
        return user?.user?.role ?? null;
    };

    const role = getRole();

    if (!role) {
        return (
            <ProtectedRoute>
                <Navigate to="/" replace />
            </ProtectedRoute>
        );
    }

    // Vendor without store: redirect to store setup unless already there
    if (role === "vendor" && !hasVendorStore()) {
        if (pathname === STORE_SETUP_PATH) {
            return (
                <ProtectedRoute>
                    <VendorStoreSetup />
                </ProtectedRoute>
            );
        }
        return (
            <ProtectedRoute>
                <Navigate to={STORE_SETUP_PATH} replace />
            </ProtectedRoute>
        );
    }

    // Vendor with store visiting setup page: redirect to dashboard
    if (role === "vendor" && hasVendorStore() && pathname === STORE_SETUP_PATH) {
        return (
            <ProtectedRoute>
                <Navigate to="/dashboard" replace />
            </ProtectedRoute>
        );
    }

    const Layout = role === "vendor" ? VendorDashboardLayout : UserDashboardLayout;

    return (
        <ProtectedRoute>
            <Layout>{children}</Layout>
        </ProtectedRoute>
    );
}
