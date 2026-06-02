import React, { useState, useEffect, useMemo, useContext, useCallback } from "react";
import UserLayout from "../../components/UserLayout.jsx";
import { getShopMedicines } from "../../lib/userShopService.js";
import { addToCart } from "../../lib/userCartService.js";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  Search,
  X,
  Plus,
  ShoppingCart,
  MapPin,
  Phone,
  Store,
  Package,
  Calendar,
  RefreshCw,
  Pill,
} from "lucide-react";
import toast from "react-hot-toast";

export default function UserShop() {
  const { user } = useContext(AuthContext);
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [detailMedicine, setDetailMedicine] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getShopMedicines()
      .then(({ medicines: m, batches: b }) => {
        setMedicines(m);
        setBatches(b);
      })
      .catch((err) => {
        setError(err?.message || "Failed to load medicines");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const cats = [...new Set(medicines.map((m) => m.category).filter(Boolean))].sort();
    return ["All", ...cats];
  }, [medicines]);

  const filtered = useMemo(() => {
    let list = medicines;
    if (category !== "All") list = list.filter((m) => m.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name?.toLowerCase().includes(q));
    }
    return list;
  }, [medicines, category, search]);

  async function handleAddToCart(medicine) {
    const batch = medicine?.bestBatch;
    if (!batch) {
      toast.error("Unable to add this item to cart");
      return;
    }
    if (!user?.id) {
      toast.error("Please sign in to add to cart");
      return;
    }
    try {
      await addToCart({
        userId: user.id,
        pharmacyId: batch.pharmacyId,
        batchId: batch.id,
        medicineId: batch.medicineId,
        quantity: 1,
        unitPrice: batch.sellingPrice,
      });
      toast.success(`${medicine.name} added to cart`);
      setDetailMedicine(null);
    } catch (err) {
      toast.error(err?.message || "Failed to add to cart");
    }
  }

  return (
    <UserLayout>
      <div className="px-3 min-[380px]:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-6xl mx-auto min-h-full w-full">
        <div className="flex items-center justify-between gap-4 mb-4 sm:mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary">Shop</h2>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-xl text-primary-green hover:bg-primary-green/10 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-5 sm:p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-text-primary font-semibold mb-1">Failed to load medicines</p>
            <p className="text-text-secondary text-sm mb-6">{error}</p>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-green text-primary-green font-medium hover:bg-primary-green/10"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 sm:mb-6 space-y-4">
              <div className="relative max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search medicines..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green text-text-primary text-sm sm:text-base"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1">
                {categories.map((cat) => {
                  const sel = cat === category;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
                        sel
                          ? "bg-primary-green text-white shadow-lg shadow-primary-green/25"
                          : "bg-white text-text-secondary border border-gray-200 shadow-[0_4px_10px_var(--color-card-shadow)] hover:border-primary-green/50"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-6 sm:p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-green/10 flex items-center justify-center">
                  <Pill className="w-10 h-10 text-primary-green" />
                </div>
                <p className="text-text-secondary font-medium">No medicines found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 items-stretch">
                {filtered.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white rounded-2xl sm:rounded-[20px] border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full"
                  >
                    <button
                      type="button"
                      className="w-full text-left p-3 flex flex-col flex-1 min-h-0"
                      onClick={() => setDetailMedicine(m)}
                    >
                      <div className="w-full h-[72px] rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-primary-green/10 to-primary-green/5">
                        {m.imageUrl ? (
                          <img
                            src={m.imageUrl}
                            alt=""
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <Pill className="w-9 h-9 text-primary-green shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 min-h-0 flex flex-col mt-2">
                        <p className="font-bold text-text-primary line-clamp-2 text-sm leading-snug flex-1">
                          {m.name}
                        </p>
                        <p className="text-xs text-text-secondary mt-1 truncate shrink-0">{m.category}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3 shrink-0">
                        <span className="text-lg font-bold text-primary-green truncate min-w-0 mr-2">
                          ${(m.price || 0).toFixed(2)}
                        </span>
                        <div
                          role="button"
                          tabIndex={m.bestBatch ? 0 : -1}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0 transition-opacity ${
                            m.bestBatch ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-50"
                          }`}
                          style={{ background: "linear-gradient(135deg, #008F0B, #007009)" }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (m.bestBatch) handleAddToCart(m);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && m.bestBatch && handleAddToCart(m)}
                        >
                          <Plus className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Detail modal – matches my_fyp bottom sheet */}
        {detailMedicine && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
            onClick={() => setDetailMedicine(null)}
          >
            <div
              className="bg-white w-full max-w-lg max-h-[85vh] sm:max-h-[70vh] overflow-hidden flex flex-col rounded-t-3xl sm:rounded-2xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
                <div className="w-28 h-28 mx-auto rounded-2xl bg-gradient-to-br from-primary-green/20 to-primary-green/10 flex items-center justify-center mb-6">
                  {detailMedicine.imageUrl ? (
                    <img
                      src={detailMedicine.imageUrl}
                      alt=""
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <Pill className="w-14 h-14 text-primary-green" />
                  )}
                </div>
                <h3 className="text-2xl font-bold text-text-primary">{detailMedicine.name}</h3>
                <div className="mt-2">
                  <span className="inline-block px-3 py-1.5 rounded-lg bg-primary-green/10 text-primary-green text-sm font-semibold">
                    {detailMedicine.category}
                  </span>
                </div>

                {/* Pharmacy section – same as my_fyp */}
                {detailMedicine.bestBatch &&
                  (detailMedicine.bestBatch.pharmacyName ||
                    detailMedicine.bestBatch.pharmacyAddress ||
                    detailMedicine.bestBatch.pharmacyPhone) && (
                    <>
                      <h4 className="text-base font-bold text-text-primary mt-6">Pharmacy</h4>
                      <div className="mt-3 p-4 rounded-xl bg-background border border-border space-y-3">
                        {detailMedicine.bestBatch.pharmacyName && (
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-primary-green shrink-0" />
                            <span className="text-text-primary font-semibold">
                              {detailMedicine.bestBatch.pharmacyName}
                            </span>
                          </div>
                        )}
                        {(detailMedicine.bestBatch.pharmacyAddress ||
                          detailMedicine.bestBatch.pharmacyCity) && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
                            <span className="text-sm text-text-secondary">
                              {[
                                detailMedicine.bestBatch.pharmacyAddress,
                                detailMedicine.bestBatch.pharmacyCity,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                        {detailMedicine.bestBatch.pharmacyPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-text-secondary shrink-0" />
                            <span className="text-sm text-text-secondary">
                              {detailMedicine.bestBatch.pharmacyPhone}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                <h4 className="text-base font-bold text-text-primary mt-6">Description</h4>
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                  {detailMedicine.description || "No description available"}
                </p>

                {/* Stock & Expiry boxes – same as my_fyp */}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="p-4 rounded-xl bg-background text-center">
                    <Package className="w-6 h-6 text-primary-green mx-auto mb-2" />
                    <p className="text-sm font-bold text-text-primary">{detailMedicine.quantity}</p>
                    <p className="text-xs text-text-secondary mt-0.5">Stock</p>
                  </div>
                  <div className="p-4 rounded-xl bg-background text-center">
                    <Calendar className="w-6 h-6 text-primary-green mx-auto mb-2" />
                    <p className="text-sm font-bold text-text-primary">
                      {detailMedicine.expiryDate
                        ? detailMedicine.expiryDate.substring(0, 7)
                        : "—"}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">Expiry</p>
                  </div>
                </div>
              </div>

              {/* Add to Cart footer – same as my_fyp */}
              <div className="flex-shrink-0 p-5 border-t border-border bg-white">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-text-secondary">Total Price</p>
                    <p className="text-2xl font-bold text-primary-green">
                      ${(detailMedicine.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(detailMedicine)}
                    disabled={!detailMedicine.bestBatch}
                    className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-white font-bold shadow-lg hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #008F0B, #007009)" }}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
