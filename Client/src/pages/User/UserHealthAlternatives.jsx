import React, { useState } from "react";
import { Link } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { getMedicineDetailsWithAlternatives } from "../../lib/geminiService.js";
import { ChevronLeft, Search, Pill, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

function openGoogleSearch(term) {
  const q = encodeURIComponent(`${term} medicine`);
  window.open(`https://www.google.com/search?q=${q}`, "_blank", "noopener,noreferrer");
}

export default function UserHealthAlternatives() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleSearch = async () => {
    const name = query.trim();
    if (!name) {
      toast.error("Please enter a medicine name");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await getMedicineDetailsWithAlternatives(name);
      setData(result);
      toast.success("Results loaded");
    } catch (err) {
      setError(err?.message || "Failed to load");
      toast.error(err?.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserLayout>
      <div className="min-h-full bg-gray-50/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <header className="flex items-center gap-3 mb-6">
            <Link
              to="/user/health"
              className="p-2 rounded-xl text-gray-600 hover:bg-white hover:border border border-transparent hover:border-gray-200 transition-colors"
              aria-label="Back to Health"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Medicine Alternatives</h1>
              <p className="text-sm text-gray-500 mt-0.5">Search by name; AI shows details and alternatives in simple language.</p>
            </div>
          </header>

          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-green" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Enter medicine name (e.g. Paracetamol, Panadol)"
                  className="w-full pl-11 pr-10 py-3.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green shadow-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="py-3.5 px-6 rounded-xl bg-primary-green text-white font-semibold flex items-center justify-center gap-2 hover:bg-dark-green disabled:opacity-60 transition-colors shrink-0"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Search with AI
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-5 rounded-xl bg-red-50 border border-red-100 text-center">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="mt-3 text-primary-green font-semibold text-sm hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!data && !loading && !error && (
              <div className="py-16 text-center rounded-2xl border border-gray-200 bg-white/80">
                <Pill className="w-16 h-16 text-primary-green/40 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Enter a medicine name and click Search</p>
                <p className="text-sm text-gray-500 mt-1">AI will show details and alternatives in simple language</p>
              </div>
            )}

            {data && (
              <div className="space-y-6">
                {data.details && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h2 className="font-bold text-gray-900 text-lg">Details</h2>
                      <button
                        type="button"
                        onClick={() => openGoogleSearch(query)}
                        className="text-primary-green text-sm font-semibold flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Google
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{data.details}</p>
                  </div>
                )}

                {data.alternatives?.length > 0 && (
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg mb-4">Alternatives</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {data.alternatives.map((alt, i) => (
                        <div
                          key={i}
                          className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-primary-green/20 transition-colors flex flex-col"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-gray-900 flex-1 min-w-0">{alt.name}</p>
                            <button
                              type="button"
                              onClick={() => openGoogleSearch(alt.name)}
                              className="text-blue-600 text-xs font-semibold flex items-center gap-0.5 shrink-0 hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Google
                            </button>
                          </div>
                          {alt.details && (
                            <p className="text-sm text-gray-600 mt-2 leading-relaxed flex-1">{alt.details}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {alt.brands && (
                              <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">
                                Brands: {alt.brands}
                              </span>
                            )}
                            {alt.price && (
                              <span className="px-2.5 py-1 rounded-lg bg-primary-green/10 text-primary-green text-xs font-semibold">
                                Price: {alt.price}
                              </span>
                            )}
                            {alt.effectiveness && (
                              <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">
                                {alt.effectiveness}
                              </span>
                            )}
                          </div>
                          {alt.notes && (
                            <p className="text-xs text-gray-500 mt-2 italic">{alt.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
