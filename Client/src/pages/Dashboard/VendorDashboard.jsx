import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";

export default function VendorDashboard() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">Vendor Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name} ({user?.email})</span>
          <button
            onClick={logout}
            className="text-sm text-green-600 hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="p-6">
        <p className="text-gray-600 mb-4">Welcome, {user?.name}. Role: <strong>{user?.role}</strong></p>
        <p className="text-sm text-gray-500">Vendor-only area. Manage your pharmacy, inventory, and orders here.</p>
        <Link to="/" className="inline-block mt-4 text-green-600 hover:underline">Back to home</Link>
      </main>
    </div>
  );
}
