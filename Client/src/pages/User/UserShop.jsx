import React, { useState, useEffect, useMemo, useContext } from "react";
import UserLayout from "../../components/UserLayout.jsx";
import { getShopMedicines } from "../../lib/userShopService.js";
import { addToCart } from "../../lib/userCartService.js";
import { AuthContext } from "../../context/AuthContext.jsx";
import { Search, X, Plus, ShoppingCart, MapPin, Phone } from "lucide-react";
import toast from "react-hot-toast";

export default function UserShop() {
  const { user } = useContext(AuthContext);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [detailBatch, setDetailBatch] = useState(null);

  const categories = useMemo(() => {
    const cats = [...new Set(medicines.map((m) => m.category).filter(Boolean))].sort();
    return ["All", ...cats];
  }, [medicines]);

  const filtered = useMemo(() => {
    let list = medicines;
    if (category !== "All") list = list.filter((m) => m.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.medicineName?.toLowerCase().includes(q));
    }
    return list;
  }, [medicines, category, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getShopMedicines()
      .then((data) => {
        if (!cancelled) setMedicines(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load medicines");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function handleAddToCart(batch) {
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
      toast.success(`${batch.medicineName} added to cart`);
      setDetailBatch(null);
    } catch (err) {
      toast.error(err.message || "Failed to add to cart");
    }
  }

  return (
    <UserLayout>
      <div className="px-4 sm:px-6 py-4 max-w-7xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Shop</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-6 text-center">
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-primary-green font-semibold hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search medicines..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green text-text-primary"
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
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => {
                  const sel = cat === category;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
                        sel
                          ? "bg-primary-green text-white shadow-lg shadow-primary-green/25"
                          : "bg-white text-gray-500 border border-gray-200 shadow-sm hover:border-primary-green/50"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-green/10 flex items-center justify-center">
                  <Search className="w-8 h-8 text-primary-green" />
                </div>
                <p className="text-text-secondary font-medium">No medicines found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <button
                      type="button"
                      className="w-full text-left p-3"
                      onClick={() => setDetailBatch(m)}
                    >
                      <div className="w-full h-16 rounded-xl bg-primary-green/10 flex items-center justify-center mb-3">
                        <span className="text-2xl">💊</span>
                      </div>
                      <p className="font-bold text-text-primary line-clamp-2 text-sm">{m.medicineName}</p>
                      <p className="text-xs text-text-secondary mt-0.5 truncate">{m.pharmacyName || m.category}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-lg font-bold text-primary-green">${(m.sellingPrice || 0).toFixed(2)}</span>
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg"
                          style={{ background: "linear-gradient(135deg, #008F0B, #007009)" }}
                          onClick={(e) => { e.stopPropagation(); handleAddToCart(m); }}
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

        {detailBatch && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
            onClick={() => setDetailBatch(null)}
          >
            <div
              className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-primary-green/10 flex items-center justify-center mb-4">
                  <span className="text-4xl">💊</span>
                </div>
                <h3 className="text-xl font-bold text-text-primary text-center">{detailBatch.medicineName}</h3>
                <div className="flex justify-center mt-2">
                  <span className="px-3 py-1 rounded-lg bg-primary-green/10 text-primary-green text-sm font-semibold">
                    {detailBatch.pharmacyName || detailBatch.category}
                  </span>
                </div>
                {(detailBatch.pharmacyName || detailBatch.pharmacyAddress || detailBatch.pharmacyPhone) && (
                  <div className="mt-4 p-4 rounded-xl bg-background border border-border space-y-2">
                    {detailBatch.pharmacyName && (
                      <div className="flex items-center gap-2">
                        <span className="text-primary-green">🏥</span>
                        <span className="text-text-primary font-medium">{detailBatch.pharmacyName}</span>
                      </div>
                    )}
                    {(detailBatch.pharmacyAddress || detailBatch.pharmacyCity) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
                        <span className="text-sm text-text-secondary">
                          {[detailBatch.pharmacyAddress, detailBatch.pharmacyCity].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                    {detailBatch.pharmacyPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-text-secondary" />
                        <span className="text-sm text-text-secondary">{detailBatch.pharmacyPhone}</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-sm text-text-secondary mt-4">{detailBatch.description || "No description available."}</p>
                <div className="mt-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-text-secondary">Total Price</p>
                    <p className="text-2xl font-bold text-primary-green">${(detailBatch.sellingPrice || 0).toFixed(2)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(detailBatch)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl text-white font-bold shadow-lg"
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
