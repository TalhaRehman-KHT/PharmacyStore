import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import {
  LayoutDashboard,
  Pill,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { path: "/vendor/dashboard", label: "Main Dashboard", icon: LayoutDashboard },
  { path: "/vendor/medicine", label: "Medicine", icon: Pill },
  { path: "/vendor/orders", label: "Orders", icon: ShoppingCart },
  { path: "/vendor/reports", label: "Reports", icon: BarChart3 },
  { path: "/vendor/settings", label: "Settings", icon: Settings },
];

export default function VendorLayout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar – my_fyp: sidebarBackground #0D0D0D */}
      <aside className="w-64 min-h-screen bg-sidebar text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10">
          <Link to="/vendor/dashboard" className="block">
            <img
              src="/assets/logo.png"
              alt="Pharmacy Store"
              className="h-10 w-auto object-contain"
            />
          </Link>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={label}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-green text-white shadow-lg shadow-primary-green/25"
                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Header – white, subtle border like my_fyp */}
        <header className="bg-white border-b border-border px-4 sm:px-6 py-3 flex items-center justify-end shadow-sm">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-primary-green font-semibold text-sm"
              style={{ background: "var(--color-accent-green)" }}
            >
              {(user?.name || "U")[0]}
            </div>
            <span className="text-sm font-medium text-text-primary">
              {user?.name || "Vendor"}
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
