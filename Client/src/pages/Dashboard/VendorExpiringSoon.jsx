import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import VendorLayout from "../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../components/VendorRouteGuard.jsx";
import { useVendorDashboard } from "../../context/VendorDashboardContext.jsx";
import { getExpiringSoonBatches } from "../../lib/vendorMedicineService.js";
import { Pill, Calendar, ChevronLeft } from "lucide-react";

function daysUntil(expiryDate) {
  if (!expiryDate) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

function formatExpiry(expiryDate) {
  if (!expiryDate) return "—";
  const d = new Date(expiryDate);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "numeric" });
}

export default function VendorExpiringSoon() {
  const { pharmacy } = useVendorDashboard();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pharmacy?.id) {
      setLoading(false);
      setError("Pharmacy not found");
      return;
    }
    setLoading(true);
    setError(null);
    getExpiringSoonBatches(pharmacy.id, 60)
      .then(setBatches)
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [pharmacy?.id]);

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full bg-[#f5f5f5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <Link
              to="/vendor/medicine"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-green text-sm font-medium mb-6"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Medicine Inventory
            </Link>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Expiring soon</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Batches expiring within 60 days
              </p>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-green border-t-transparent" />
              </div>
            ) : error ? (
              <div className="bg-white rounded-2xl border p-8 text-center">
                <p className="text-gray-500 mb-4">{error}</p>
                <button
                  type="button"
                  onClick={() => pharmacy?.id && getExpiringSoonBatches(pharmacy.id, 60).then(setBatches).catch(() => {})}
                  className="px-4 py-2 bg-primary-green text-white rounded-xl text-sm font-medium hover:bg-dark-green"
                >
                  Retry
                </button>
              </div>
            ) : batches.length === 0 ? (
              <div className="bg-white rounded-2xl border flex flex-col items-center justify-center py-16 text-gray-500">
                <div className="w-16 h-16 rounded-full bg-primary-green/10 flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-primary-green" />
                </div>
                <p className="font-semibold text-gray-900">No medicines expiring soon</p>
                <p className="text-sm mt-1">Batches expiring within 60 days will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {batches.map((batch) => {
                  const days = daysUntil(batch.expiryDate);
                  const isUrgent = days <= 7;
                  const color = isUrgent ? "#FF8F6B" : "#008F0B";
                  const daysText =
                    days === 0 ? "Expires today" : days === 1 ? "Tomorrow" : `${days} days`;
                  return (
                    <div
                      key={batch.id}
                      className="bg-white rounded-2xl border shadow-sm overflow-hidden flex"
                      style={{
                        borderColor: isUrgent ? `${color}40` : undefined,
                      }}
                    >
                      <div
                        className="w-1 shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 p-4 flex items-center gap-4">
                        <div
                          className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          {batch.imageUrl ? (
                            <img
                              src={batch.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Pill className="w-7 h-7 shrink-0" style={{ color }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">
                            {batch.medicineName || "Medicine"}
                          </p>
                          <p className="text-sm text-gray-500">
                            Batch {batch.batchNumber} · Qty: {batch.quantity}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {formatExpiry(batch.expiryDate)}
                          </p>
                        </div>
                        <div
                          className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold"
                          style={{
                            backgroundColor: `${color}18`,
                            color,
                          }}
                        >
                          {daysText}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </VendorLayout>
    </VendorRouteGuard>
  );
}
