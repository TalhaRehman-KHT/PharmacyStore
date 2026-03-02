import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import VendorLayout from "../../components/VendorLayout.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { updateUserProfile } from "../../lib/authService.js";
import {
  Store,
  Pencil,
  Lock,
  MessageCircle,
  Info,
  LogOut,
  ChevronRight,
  X,
  User,
  Phone,
  Building2,
  MapPin,
  Mail,
} from "lucide-react";

function SettingRow({ icon: Icon, title, subtitle, iconBg, iconClass, to, onClick, danger }) {
  const iconColor = danger ? "text-primary-orange" : (iconClass || "text-primary-green");
  const row = (
    <div
      className={
        "flex items-center gap-4 py-3.5 px-4 rounded-lg transition-colors " +
        (danger
          ? "hover:bg-orange-50/80"
          : "hover:bg-gray-50 active:bg-gray-100")
      }
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={
          danger
            ? { background: "rgba(255,143,107,0.15)" }
            : { background: iconBg || "var(--color-accent-green)" }
        }
      >
        <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? "text-primary-orange" : "text-gray-900"}`}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {!danger && <ChevronRight className="w-5 h-5 shrink-0 text-gray-400" />}
    </div>
  );

  if (to) return <Link to={to} className="block">{row}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="w-full text-left block">{row}</button>;
  return row;
}

export default function VendorSettings() {
  const { user, logout, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name ?? "",
    phone: user?.contactInfo ?? user?.phone ?? "",
    company_name: user?.companyName ?? user?.company_name ?? "",
    address: user?.address ?? "",
    city: user?.city ?? "",
    state: user?.state ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateUserProfile(user.id, {
        name: editForm.name,
        phone: editForm.phone,
        company_name: editForm.company_name,
        address: editForm.address,
        city: editForm.city,
        state: editForm.state,
      });
      if (updated) {
        updateUser({
          name: updated.name,
          contactInfo: updated.phone,
          companyName: updated.company_name,
          address: updated.address,
          city: updated.city,
          state: updated.state,
        });
      }
      setShowEditModal(false);
    } catch (e) {
      setSaveError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleHelpSupport = () => {
    const email = "support@pharmacystore.com";
    const subject = "Pharmacy Store - Support Request";
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
  };

  const openEditModal = () => {
    setEditForm({
      name: user?.name ?? "",
      phone: user?.contactInfo ?? user?.phone ?? "",
      company_name: user?.companyName ?? user?.company_name ?? "",
      address: user?.address ?? "",
      city: user?.city ?? "",
      state: user?.state ?? "",
    });
    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    setEditForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const displayCompany = user?.companyName ?? user?.company_name;

  return (
    <VendorLayout>
      <div className="min-h-full bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Manage your profile and account
            </p>
          </div>

          {/* Profile card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(145deg, #008F0B 0%, #006b08 100%)",
                  boxShadow: "0 8px 24px rgba(0,143,11,0.3)",
                }}
              >
                <Store className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900">
                  {user?.name ?? "Not signed in"}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 shrink-0 opacity-70" />
                  {user?.email ?? "—"}
                </p>
                {displayCompany && (
                  <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-primary-green/10 text-primary-green text-xs font-medium">
                    <Building2 className="w-3.5 h-3.5" />
                    {displayCompany}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={openEditModal}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-green/30 text-primary-green bg-primary-green/5 font-medium text-sm hover:bg-primary-green/15 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit profile
              </button>
            </div>
          </div>

          {/* Single settings list card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Account
              </p>
            </div>
            <div className="border-t border-gray-100">
              <SettingRow
                icon={Lock}
                title="Change Password"
                subtitle="Update via email OTP"
                iconBg="rgba(255,143,107,0.2)"
                iconClass="text-primary-orange"
                to="/forgot-password"
              />
            </div>

            <div className="px-4 pt-5 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Support
              </p>
            </div>
            <button
              type="button"
              onClick={handleHelpSupport}
              className="w-full border-t border-gray-100 text-left"
            >
              <SettingRow
                icon={MessageCircle}
                title="Help & Support"
                subtitle="Email us for support"
                iconBg="rgba(0,143,11,0.12)"
              />
            </button>
            <button
              type="button"
              onClick={() => {}}
              className="w-full border-t border-gray-100 text-left"
            >
              <SettingRow
                icon={Info}
                title="About"
                subtitle="Version 1.0.0"
                iconBg="rgba(40,89,197,0.12)"
              />
            </button>

            <div className="border-t border-gray-100 mt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left"
              >
                <SettingRow
                  icon={LogOut}
                  title="Log out"
                  subtitle={null}
                  danger
                />
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Pharmacy Store v1.0.0
          </p>
        </div>
      </div>

      {/* Edit Profile modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Edit profile</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {saveError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {saveError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none transition-all"
                    placeholder="Your name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none transition-all"
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Company name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="company_name"
                    value={editForm.company_name}
                    onChange={handleEditChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none transition-all"
                    placeholder="Company name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    name="address"
                    value={editForm.address}
                    onChange={handleEditChange}
                    rows={2}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none transition-all resize-none"
                    placeholder="Street address"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={editForm.city}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none transition-all"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={editForm.state}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none transition-all"
                    placeholder="State"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-5 py-2.5 bg-primary-green text-white rounded-xl font-medium text-sm hover:bg-dark-green transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
