import React, { useContext, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import {
  Home,
  Store,
  ShoppingCart,
  Package,
  HeartPulse,
  User,
  LogOut,
  Bell,
  Menu,
  X,
  MessageCircle,
} from "lucide-react";
import { UserNotificationsContext } from "../context/UserNotificationsContext.jsx";

const navItems = [
  { path: "/user/dashboard", label: "Home", icon: Home },
  { path: "/user/shop", label: "Shop", icon: Store },
  { path: "/user/cart", label: "Cart", icon: ShoppingCart },
  { path: "/user/notifications", label: "Notifications", icon: Bell },
  { path: "/user/orders", label: "Orders", icon: Package },
  { path: "/user/health", label: "Health", icon: HeartPulse },
  { path: "/user/assistant", label: "MedAssist", icon: MessageCircle },
  { path: "/user/profile", label: "Profile", icon: User },
];

export default function UserLayout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const { unreadCount } = useContext(UserNotificationsContext);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const pageTitle = useMemo(() => {
    const match = navItems.find(
      (item) =>
        location.pathname === item.path ||
        (item.path !== "/user/dashboard" && location.pathname.startsWith(`${item.path}/`))
    );
    return match?.label || "Home";
  }, [location.pathname]);

  const sidebarNav = (
    <>
      <div className="p-4 border-b border-white/10">
        <Link
          to="/user/dashboard"
          className="block"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <img
            src="/assets/logo.png"
            alt="Pharmacy Store"
            className="h-10 w-auto object-contain"
          />
        </Link>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive =
            location.pathname === path ||
            (path !== "/user/dashboard" && location.pathname.startsWith(`${path}/`));
          const isNotifications = path === "/user/notifications";
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
              <span className="flex-1 min-w-0 truncate">{label}</span>
              {isNotifications && unreadCount > 0 && (
                <span className="min-w-6 h-6 px-2 rounded-full bg-primary-orange text-white text-[12px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
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
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar – matches VendorLayout / my_fyp sidebarBackground #0D0D0D */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-sidebar text-white flex-col shrink-0">
        {sidebarNav}
      </aside>

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
          <Link
            to="/user/dashboard"
            className="flex items-center gap-2 min-w-0"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <img
              src="/assets/logo.png"
              alt="Pharmacy Store"
              className="h-9 w-auto object-contain"
            />
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
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive =
              location.pathname === path ||
              (path !== "/user/dashboard" && location.pathname.startsWith(`${path}/`));
            const isNotifications = path === "/user/notifications";
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
                <span className="flex-1 min-w-0 truncate">{label}</span>
                {isNotifications && unreadCount > 0 && (
                  <span className="min-w-6 h-6 px-2 rounded-full bg-primary-orange text-white text-[12px] font-bold flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
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
        {/* Header – matches VendorLayout: accent-green avatar, name */}
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
            <h1 className="text-base sm:text-lg font-bold text-text-primary truncate">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-primary-green font-semibold text-sm"
              style={{ background: "var(--color-accent-green)" }}
            >
              {(user?.name || "G")[0].toUpperCase()}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-text-primary max-w-40 truncate">
              {user?.name || "Guest"}
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-background">{children}</div>
      </main>
    </div>
  );
}
