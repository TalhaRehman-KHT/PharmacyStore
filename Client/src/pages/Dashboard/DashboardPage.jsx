import React, { useContext } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { decodeJwt } from "../../utils/jwtDecode.js";
import UserDashboard from "./UserDashboard.jsx";
import Dashboard from "./Dashboard.jsx";

export default function DashboardPage() {
    const { user } = useContext(AuthContext);

    const getRole = () => {
        const token = user?.token ?? localStorage.getItem("token");
        const payload = decodeJwt(token);
        if (payload?.role) return payload.role;
        return user?.user?.role ?? "user";
    };

    const role = getRole();

    return role === "vendor" ? <Dashboard /> : <UserDashboard />;
}
