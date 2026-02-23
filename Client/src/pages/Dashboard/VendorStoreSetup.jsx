import React, { useState } from "react";
import { Eye, EyeOff, Store } from "lucide-react";
import axiosInstance from "../../api/axios.js";

const STORE_CREATED_KEY = "vendorStoreCreated";

export default function VendorStoreSetup() {
    const [form, setForm] = useState({
        shopName: "",
        city: "",
        address: "",
        contactNumber: "",
        licenseId: "",
        storePassword: "",
    });
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showStorePass, setShowStorePass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleChange = (e) => {
        setError("");
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (form.storePassword !== confirmPassword) {
            return setError("Passwords do not match");
        }
        if (form.storePassword.length < 6) {
            return setError("Store password must be at least 6 characters");
        }

        setLoading(true);
        setError("");
        try {
            const payload = {
                shopName: form.shopName,
                city: form.city,
                address: form.address,
                contactNumber: form.contactNumber,
                licenseId: form.licenseId,
                storePassword: form.storePassword,
            };
            const { data } = await axiosInstance.post("/api/vendor/create-store", payload);
            localStorage.setItem(STORE_CREATED_KEY, "true");
            alert(data.message || "Store created successfully!");
            window.location.href = "/dashboard";
        } catch (err) {
            const res = err.response?.data;
            const msg = res?.error || res?.message || "Failed to create store. Please try again.";
            const hint = res?.hint ? ` (${res.hint})` : "";
            setError(msg + hint);
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        "w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400";

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
                            <Store size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
                                Store Setup
                            </h1>
                            <p className="text-sm text-gray-600">
                                Create your pharmacy store to get started
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="shopName" className="block text-sm font-medium text-gray-700 mb-1">
                                Shop Name
                            </label>
                            <input
                                id="shopName"
                                type="text"
                                name="shopName"
                                placeholder="Enter shop name"
                                value={form.shopName}
                                onChange={handleChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                                City
                            </label>
                            <input
                                id="city"
                                type="text"
                                name="city"
                                placeholder="Enter city"
                                value={form.city}
                                onChange={handleChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                                Address
                            </label>
                            <input
                                id="address"
                                type="text"
                                name="address"
                                placeholder="Enter full address"
                                value={form.address}
                                onChange={handleChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">
                                Contact Number
                            </label>
                            <input
                                id="contactNumber"
                                type="tel"
                                name="contactNumber"
                                placeholder="e.g. +92 300 1234567"
                                value={form.contactNumber}
                                onChange={handleChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="licenseId" className="block text-sm font-medium text-gray-700 mb-1">
                                License ID
                            </label>
                            <input
                                id="licenseId"
                                type="text"
                                name="licenseId"
                                placeholder="Enter pharmacy license ID"
                                value={form.licenseId}
                                onChange={handleChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="storePassword" className="block text-sm font-medium text-gray-700 mb-1">
                                Store Password
                            </label>
                            <div className="relative">
                                <input
                                    id="storePassword"
                                    type={showStorePass ? "text" : "password"}
                                    name="storePassword"
                                    placeholder="Min 6 characters"
                                    value={form.storePassword}
                                    onChange={handleChange}
                                    className={`${inputClass} pr-10`}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-green-500"
                                    onClick={() => setShowStorePass(!showStorePass)}
                                    aria-label={showStorePass ? "Hide password" : "Show password"}
                                >
                                    {showStorePass ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <input
                                    id="confirmPassword"
                                    type={showConfirm ? "text" : "password"}
                                    placeholder="Confirm store password"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setError("");
                                        setConfirmPassword(e.target.value);
                                    }}
                                    className={`${inputClass} pr-10`}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-green-500"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    aria-label={showConfirm ? "Hide password" : "Show password"}
                                >
                                    {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {error && <p className="text-red-500 text-sm">{error}</p>}

                        <button
                            type="submit"
                            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                            disabled={loading}
                        >
                            {loading ? "Creating Store..." : "Create Store"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export { STORE_CREATED_KEY };
