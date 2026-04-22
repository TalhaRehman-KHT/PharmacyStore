import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { User, Lock, MessageCircle, Info, LogOut, ChevronRight } from "lucide-react";

function SettingCard({ icon: Icon, title, subtitle, color, to, onClick }) {
  const className =
    "flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] hover:shadow-md transition-shadow";
  const content = (
    <>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
    </>
  );
  if (to) return <Link to={to} className={className}>{content}</Link>;
  return (
    <button type="button" onClick={onClick} className={`w-full text-left ${className}`}>
      {content}
    </button>
  );
}

export default function UserProfile() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const handleHelpSupport = () => {
    const email = "za2767651@gmail.com";
    const subject = encodeURIComponent("IPSMS Web - Support Request");
    window.location.href = `mailto:${email}?subject=${subject}`;
  };

  return (
    <UserLayout>
      <div className="px-4 sm:px-6 py-4 max-w-7xl mx-auto pb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Profile</h2>
        <p className="text-sm text-gray-500 mb-4">Manage your account</p>

        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary-green/10 shrink-0">
              <User className="w-6 h-6 text-primary-green" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 font-bold">{user?.name || "Not signed in"}</p>
              <p className="text-sm text-gray-500 truncate">{user?.email || "—"}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
          </div>
        </div>

        {/* Account */}
        <p className="text-base font-bold text-gray-900 mb-2">Account</p>
        <div className="space-y-2 mb-5">
          <SettingCard
            icon={Lock}
            title="Change Password"
            subtitle="Update your password via email OTP"
            color="#FF8F6B"
            to="/forgot-password"
          />
        </div>

        {/* Support */}
        <p className="text-base font-bold text-gray-900 mb-2">Support</p>
        <div className="space-y-2 mb-5">
          <SettingCard
            icon={MessageCircle}
            title="Help & Support"
            subtitle="Email us for support"
            color="#008F0B"
            onClick={handleHelpSupport}
          />
          <SettingCard
            icon={Info}
            title="About"
            subtitle="Version 1.0.0"
            color="#2859C5"
            onClick={() => {}}
          />
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] hover:shadow-md transition-shadow text-left"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(255,143,107,0.1)" }}
          >
            <LogOut className="w-5 h-5" style={{ color: "#FF8F6B" }} />
          </div>
          <span className="flex-1 font-semibold" style={{ color: "#FF8F6B" }}>Logout</span>
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        </button>

        <p className="text-center text-xs text-gray-500 mt-6">
          Intelligent Pharmacy System v1.0.0
        </p>
      </div>
    </UserLayout>
  );
}
