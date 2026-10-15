import { Pill, Plus, Store } from "lucide-react";
import { formatPrice, productKey } from "../utils.js";

/**
 * @param {{ product: import("../types.js").ProductCard, onAdd: (p: import("../types.js").ProductCard) => void,
 *   addingId?: string | null, compact?: boolean }} props
 */
export default function ProductMiniCard({ product, onAdd, addingId, compact = false }) {
  const adding = addingId === productKey(product);
  const alternatives = !product.inStock ? product.alternatives || [] : [];

  return (
    <div
      className={
        compact
          ? ""
          : "rounded-2xl border border-gray-100 bg-white shadow-[0_4px_10px_var(--color-card-shadow)] p-3 hover:border-primary-green/30 transition-colors"
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`${compact ? "w-9 h-9" : "w-12 h-12"} rounded-xl overflow-hidden bg-gradient-to-br from-primary-green/10 to-primary-green/5 flex items-center justify-center shrink-0`}
        >
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <Pill className={`${compact ? "w-4 h-4" : "w-6 h-6"} text-primary-green`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text-primary truncate">{product.name}</p>
          {product.genericName && (
            <p className="text-xs text-text-secondary truncate capitalize">{product.genericName}</p>
          )}
          {product.pharmacyName && (
            <p className="text-xs text-text-secondary truncate flex items-center gap-1">
              <Store className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{product.pharmacyName}</span>
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {product.price != null && (
              <span className="text-sm font-bold text-primary-green">
                {formatPrice(product.price, product.currency)}
              </span>
            )}
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap"
              style={
                product.inStock
                  ? { backgroundColor: "rgba(0,143,11,0.12)", color: "#008F0B" }
                  : { backgroundColor: "rgba(255,143,107,0.15)", color: "#c2410c" }
              }
            >
              {product.inStock ? "In stock" : "Out of stock"}
            </span>
          </div>
        </div>
        {product.inStock && (
          <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={adding}
            aria-label={`Add ${product.name} to cart`}
            className="inline-flex items-center justify-center gap-1 min-h-9 min-w-9 px-3 py-2 rounded-xl bg-primary-green text-white text-xs font-semibold hover:bg-dark-green transition-colors disabled:opacity-60 shrink-0"
          >
            {adding ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span className={compact ? "sr-only" : ""}>Add</span>
          </button>
        )}
      </div>

      {alternatives.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-text-secondary mb-2">Same medicine, available now</p>
          <ul className="space-y-2">
            {alternatives.map((alt) => (
              <li key={productKey(alt)}>
                <ProductMiniCard product={alt} onAdd={onAdd} addingId={addingId} compact />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
