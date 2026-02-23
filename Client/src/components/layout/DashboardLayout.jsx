import React, { useState, useContext } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { decodeJwt } from "../../utils/jwtDecode.js";
import { Menu, X, LogOut, User } from "lucide-react";

export default function DashboardLayout({
    children,
    sidebarItems = [],
    title = "Dashboard",
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const getRole = () => {
        const token = user?.token ?? localStorage.getItem("token");
        const payload = decodeJwt(token);
        if (payload?.role) return payload.role;
        return user?.user?.role ?? "user";
    };

    const role = getRole();
    const displayName = user?.user?.name || user?.user?.email || "User";

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top navbar - user profile */}
            <header className="fixed top-0 right-0 left-0 md:left-64 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
                <button
                    type="button"
                    onClick={() => setSidebarOpen((o) => !o)}
                    className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
                    aria-label="Toggle sidebar"
                >
                    {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <h1 className="hidden sm:block text-lg font-semibold text-gray-800 truncate">
                    {title}
                </h1>
                <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                    <div className="flex flex-col items-end min-w-0">
                        <span className="text-xs sm:text-sm font-medium text-gray-800 truncate max-w-[120px] sm:max-w-[180px]">
                            {displayName}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">
                            {role}
                        </span>
                    </div>
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                        <User size={18} />
                    </div>
                </div>
            </header>

            {/* Sidebar overlay (mobile) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar - light black dull */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full w-64 transform bg-gray-800 border-r border-gray-700 transition-transform duration-200 ease-in-out md:translate-x-0 ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex h-full flex-col">
                    <div className="flex h-14 items-center justify-between border-b border-gray-700 px-4">
                        <Link
                            to="/"
                            className="text-lg font-semibold text-green-400"
                        >
                            Pharmacy Store
                        </Link>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-700 md:hidden"
                            aria-label="Close sidebar"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                        {sidebarItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "/dashboard"}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                                        isActive
                                            ? "bg-green-600 text-white"
                                            : "text-gray-300 hover:bg-gray-700 hover:text-white"
                                    }`
                                }
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                    <div className="border-t border-gray-700 p-4">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-red-400 hover:bg-red-900/30 transition-colors"
                        >
                            <LogOut size={20} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="pt-14 md:pl-64 min-h-screen">
                <div className="p-4 md:p-6 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
