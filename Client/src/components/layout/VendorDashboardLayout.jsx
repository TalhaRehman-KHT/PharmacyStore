import React from "react";
import { LayoutDashboard, Pill, Package, TrendingUp, User, Store } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";

const vendorSidebarItems = [
    {
        to: "/dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard size={20} />,
    },
    {
        to: "/dashboard/store-setup",
        label: "Store Setup",
        icon: <Store size={20} />,
    },
    {
        to: "/dashboard/add-medicine",
        label: "Add Medicine",
        icon: <Pill size={20} />,
    },
    {
        to: "/dashboard/medicine-stock",
        label: "Medicine Stock",
        icon: <Package size={20} />,
    },
    {
        to: "/dashboard/sales",
        label: "Sales",
        icon: <TrendingUp size={20} />,
    },
    {
        to: "/dashboard/profile",
        label: "Profile",
        icon: <User size={20} />,
    },
];

export default function VendorDashboardLayout({ children }) {
    return (
        <DashboardLayout
            sidebarItems={vendorSidebarItems}
            title="Vendor Dashboard"
        >
            {children}
        </DashboardLayout>
    );
}
