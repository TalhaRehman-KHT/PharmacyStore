import React, { useContext, useMemo, useState } from "react";
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
  Stethoscope,
} from "lucide-react";
import { useEscalations } from "../features/medassist/hooks/useEscalations.js";

const ESCALATIONS_PATH = "/vendor/escalations";

const navItems = [
  { path: "/vendor/dashboard", label: "Main Dashboard", icon: LayoutDashboard },
  { path: "/vendor/medicine", label: "Medicine", icon: Pill },
  { path: "/vendor/orders", label: "Orders", icon: ShoppingCart },
  { path: ESCALATIONS_PATH, label: "Escalations", icon: Stethoscope },
  { path: "/vendor/reports", label: "Reports", icon: BarChart3 },
  { path: "/vendor/settings", label: "Settings", icon: Settings },
];

/** Admins don't own a store: payout review plus the MedAssist escalation queue. */
const adminNavItems = [
  { path: "/vendor/admin-orders", label: "Vendor payouts", icon: ShieldCheck },
  { path: ESCALATIONS_PATH, label: "Escalations", icon: Stethoscope },
];

function NavLabel({ label, badge }) {
  return (
    <>
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {badge > 0 && (
        <span
          className="min-w-6 h-6 px-2 rounded-full bg-primary-orange text-white text-[12px] font-bold flex items-center justify-center"
          aria-label={`${badge} pending`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </>
  );
}

export default function VendorLayout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const { pharmacy } = useVendorDashboard();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Pending MedAssist questions for the sidebar badge.
  const pendingCount = useEscalations("pending").escalations.length;

  const pageTitle = useMemo(() => {
    if (isAdmin) {
      return location.pathname.startsWith(ESCALATIONS_PATH) ? "Escalations" : "Vendor payouts";
    }
    if (location.pathname === "/vendor/create-store") return "Create Store";
    const match = navItems.find((n) => n.path === location.pathname);
    if (match) return match.label;
    if (location.pathname.startsWith("/vendor/orders/")) return "Order details";
    return "Vendor dashboard";
  }, [isAdmin, location.pathname]);

  const homeHref = isAdmin
    ? "/vendor/admin-orders"
    : pharmacy?.id
      ? "/vendor/dashboard"
      : "/vendor/create-store";

  const adminNav = adminNavItems.map(({ path, label, icon: Icon }) => {
    const isActive = location.pathname.startsWith(path);
    return (
      <Link
        key={path}
        to={path}
        onClick={() => setMobileSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary-green text-white shadow-lg shadow-primary-green/25"
            : "text-gray-400 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <NavLabel label={label} badge={path === ESCALATIONS_PATH ? pendingCount : 0} />
      </Link>
    );
  });

  const sidebarNav = (
    <>
      <div className="p-4 border-b border-white/10">
        <Link to={homeHref} className="block" onClick={() => setMobileSidebarOpen(false)}>
          <img src="/assets/logo.png" alt="Pharmacy Store" className="h-10 w-auto object-contain" />
        </Link>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {isAdmin ? (
          adminNav
        ) : (
          <>
            {!pharmacy?.id && (
              <Link
                to="/vendor/create-store"
                onClick={() => setMobileSidebarOpen(false)}
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
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-green text-white shadow-lg shadow-primary-green/25"
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <NavLabel label={label} badge={path === ESCALATIONS_PATH ? pendingCount : 0} />
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
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar – my_fyp: sidebarBackground #0D0D0D */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-sidebar text-white flex-col shrink-0">
        {sidebarNav}
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-sidebar text-white flex flex-col transform transition-transform duration-200 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Sidebar"
      >
        <div className="p-3 flex items-center justify-between border-b border-white/10">
          <Link to={homeHref} className="flex items-center gap-2" onClick={() => setMobileSidebarOpen(false)}>
            <img src="/assets/logo.png" alt="Pharmacy Store" className="h-9 w-auto object-contain" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="p-2 rounded-xl hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/*
          Reuse same nav, but without duplicating logo/header again.
          Keep the logout button at bottom.
        */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-auto">
          {isAdmin ? (
            adminNav
          ) : (
            <>
              {!pharmacy?.id && (
                <Link
                  to="/vendor/create-store"
                  onClick={() => setMobileSidebarOpen(false)}
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
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary-green text-white shadow-lg shadow-primary-green/25"
                        : "text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <NavLabel label={label} badge={path === ESCALATIONS_PATH ? pendingCount : 0} />
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
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-700"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-text-primary truncate">{pageTitle}</h1>
              {pharmacy?.name && !isAdmin && (
                <p className="text-xs text-text-secondary truncate">{pharmacy.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-primary-green font-semibold text-sm"
              style={{ background: "var(--color-accent-green)" }}
            >
              {(user?.name || "U")[0]}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-text-primary">{user?.name || "Vendor"}</span>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-background">{children}</div>
      </main>
    </div>
  );
}
