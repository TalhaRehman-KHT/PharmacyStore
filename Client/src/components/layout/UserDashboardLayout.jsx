import React from "react";
import { User, MessageCircle, Bell } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";

const userSidebarItems = [
    {
        to: "/dashboard/profile",
        label: "Profile",
        icon: <User size={20} />,
    },
    {
        to: "/dashboard",
        label: "Old Chats",
        icon: <MessageCircle size={20} />,
    },
    {
        to: "/dashboard/reminders",
        label: "Reminders",
        icon: <Bell size={20} />,
    },
];

export default function UserDashboardLayout({ children }) {
    return (
        <DashboardLayout
            sidebarItems={userSidebarItems}
            title="User Dashboard"
        >
            {children}
        </DashboardLayout>
    );
}
