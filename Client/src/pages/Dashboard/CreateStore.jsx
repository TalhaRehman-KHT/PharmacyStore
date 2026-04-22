import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPharmacy } from "../../lib/vendorPharmacyService.js";
import { useVendorDashboard } from "../../context/VendorDashboardContext.jsx";
import { Store, FileText, Phone, MapPin, Building2 } from "lucide-react";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

export default function CreateStore() {
  const navigate = useNavigate();
  const { refresh } = useVendorDashboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: "",
    licenseNumber: "",
    address: "",
    city: "",
    phone: "",
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user?.id) {
      setError("Please log in again.");
      return;
    }
    if (!form.name?.trim()) {
      setError("Store name is required.");
      return;
    }
    if (!form.licenseNumber?.trim()) {
      setError("License number is required.");
      return;
    }
    if (!form.address?.trim()) {
      setError("Address is required.");
      return;
    }
    if (!form.city?.trim()) {
      setError("City is required.");
      return;
    }
    if (!form.phone?.trim()) {
      setError("Phone is required.");
      return;
    }

    setLoading(true);
    try {
      await createPharmacy({
        vendorId: user.id,
        name: form.name.trim(),
        licenseNumber: form.licenseNumber.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        phone: form.phone.trim() || null,
      });
      await refresh();
      navigate("/vendor/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "Failed to create store");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent-green/30 to-background">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #008F0B, #006b08)",
              boxShadow: "0 8px 24px rgba(0,143,11,0.3)",
            }}
          >
            <Store className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Create Your Store</h1>
            <p className="text-sm text-text-secondary mt-0.5">Setup your pharmacy details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Store Name *</label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className={inputClass + " pl-10"}
                placeholder="Enter your pharmacy store name"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>License Number *</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="licenseNumber"
                value={form.licenseNumber}
                onChange={handleChange}
                className={inputClass + " pl-10"}
                placeholder="Enter pharmacy license number"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Phone Number *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className={inputClass + " pl-10"}
                placeholder="Enter store contact number"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Address *</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={2}
                className={inputClass + " pl-10 resize-none"}
                placeholder="Enter complete store address"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>City *</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                className={inputClass + " pl-10"}
                placeholder="Enter city name"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary-green text-white font-semibold hover:bg-dark-green transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? "Creating…" : "Create Store"}
          </button>

          <p className="text-center text-xs text-text-secondary">
            You can update these details later in settings.
          </p>
        </form>
      </div>
    </div>
  );
}
