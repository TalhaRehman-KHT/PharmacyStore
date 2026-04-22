import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { useVendorDashboard } from "../context/VendorDashboardContext.jsx";
import {
  LayoutDashboard,
  Pill,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  Store,
  ShieldCheck,
  Menu,
  X,
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
  const { pharmacy } = useVendorDashboard();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar – fixed drawer on mobile, static on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-white flex flex-col shrink-0 transform transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-white/10">
          <Link
            to={isAdmin ? "/vendor/admin-orders" : pharmacy?.id ? "/vendor/dashboard" : "/vendor/create-store"}
            className="block"
          >
            <img
              src="/assets/logo.png"
              alt="Pharmacy Store"
              className="h-10 w-auto object-contain"
            />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 lg:hidden"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {isAdmin ? (
            <Link
              to="/vendor/admin-orders"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                location.pathname.startsWith("/vendor/admin-orders")
                  ? "bg-primary-green text-white shadow-lg shadow-primary-green/25"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-5 h-5 shrink-0" />
              Vendor payouts
            </Link>
          ) : (
            <>
              {!pharmacy?.id && (
                <Link
                  to="/vendor/create-store"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    location.pathname === "/vendor/create-store"
                      ? "bg-primary-green text-white shadow-lg shadow-primary-green/25"
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Store className="w-5 h-5 shrink-0" />
                  Create Store
                </Link>
              )}
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
            </>
          )}
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
        <header className="bg-white border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex lg:hidden items-center justify-center p-2 rounded-lg border border-border text-text-primary hover:bg-background"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>
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
