import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import {
  getCartsForUser,
  updateItemQuantity,
  removeItem,
  clearCart,
} from "../../lib/userCartService.js";
import { createOrder } from "../../lib/userOrderService.js";
import { AuthContext } from "../../context/AuthContext.jsx";
import { ShoppingCart, Minus, Plus, Trash2, CreditCard } from "lucide-react";
import toast from "react-hot-toast";

export default function UserCart() {
  const { user } = useContext(AuthContext);
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [clearingIds, setClearingIds] = useState(new Set());

  const loadCarts = () => {
    if (!user?.id) {
      setCarts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getCartsForUser(user.id)
      .then(setCarts)
      .catch((err) => setError(err.message || "Failed to load cart"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCarts();
  }, [user?.id]);

  const grandTotal = carts.reduce((s, c) => s + c.subtotal, 0);

  async function handleUpdateQty(item, newQty) {
    if (newQty < 1) {
      await handleRemove(item.id);
      return;
    }
    setUpdatingIds((prev) => new Set(prev).add(item.id));
    try {
      await updateItemQuantity(item.id, newQty);
      loadCarts();
    } catch (err) {
      toast.error(err.message || "Failed to update quantity");
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleRemove(cartItemId) {
    setUpdatingIds((prev) => new Set(prev).add(cartItemId));
    try {
      await removeItem(cartItemId);
      loadCarts();
      toast.success("Item removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove item");
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(cartItemId);
        return next;
      });
    }
  }

  async function handleClearCart(cartId) {
    setClearingIds((prev) => new Set(prev).add(cartId));
    try {
      await clearCart(cartId);
      loadCarts();
      toast.success("Cart cleared");
    } catch (err) {
      toast.error(err.message || "Failed to clear cart");
    } finally {
      setClearingIds((prev) => {
        const next = new Set(prev);
        next.delete(cartId);
        return next;
      });
    }
  }

  async function handleCheckout() {
    if (!user?.id) {
      toast.error("Please sign in to checkout");
      return;
    }
    if (carts.length === 0) return;

    setCheckingOut(true);
    try {
      let count = 0;
      for (const cart of carts) {
        const items = cart.items.map((i) => ({
          batch_id: i.batchId,
          medicine_id: i.medicineId,
          quantity: i.quantity,
          unit_price: i.unitPrice,
        }));
        await createOrder(user.id, cart.pharmacyId, items);
        await clearCart(cart.id);
        count++;
      }
      loadCarts();
      toast.success(count > 1 ? `${count} orders placed successfully` : "Order placed successfully");
    } catch (err) {
      toast.error(err.message || "Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <UserLayout>
        <div className="px-6 py-6 flex justify-center">
          <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="px-4 sm:px-6 py-4 max-w-7xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Cart</h2>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-700">{error}</div>
        )}

        {carts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-primary-green/10 flex items-center justify-center">
              <ShoppingCart className="w-10 h-10 text-primary-green" />
            </div>
            <p className="text-lg font-bold text-text-primary">Your cart is empty</p>
            <p className="text-text-secondary mt-2">Browse medicines and add to cart</p>
            <Link
              to="/user/shop"
              className="inline-block mt-4 px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
              style={{ background: "linear-gradient(135deg, #008F0B, #007009)" }}
            >
              Browse Shop
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-5">
              {carts.map((cart) => (
                <div
                  key={cart.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] overflow-hidden"
                >
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                    <span className="font-bold text-text-primary">{cart.pharmacyName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary-green">${cart.subtotal.toFixed(2)}</span>
                      <button
                        type="button"
                        disabled={clearingIds.has(cart.id)}
                        onClick={() => handleClearCart(cart.id)}
                        className="text-sm font-semibold text-primary-orange hover:underline disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="px-4 py-3 flex items-center gap-3 border-t border-gray-100"
                    >
                      <div className="w-14 h-14 rounded-xl bg-primary-green/10 flex items-center justify-center shrink-0">
                        <span className="text-2xl">💊</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text-primary">{item.medicineName}</p>
                        <p className="text-sm text-text-secondary">${item.unitPrice.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-xl bg-background">
                          <button
                            type="button"
                            disabled={updatingIds.has(item.id)}
                            onClick={() => handleUpdateQty(item, item.quantity - 1)}
                            className="p-2 text-text-secondary hover:text-primary-green"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-3 font-bold">{item.quantity}</span>
                          <button
                            type="button"
                            disabled={updatingIds.has(item.id)}
                            onClick={() => handleUpdateQty(item, item.quantity + 1)}
                            className="p-2 text-text-secondary hover:text-primary-green"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={updatingIds.has(item.id)}
                          onClick={() => handleRemove(item.id)}
                          className="p-2 text-primary-orange hover:bg-orange-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-bold text-text-primary">${grandTotal.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center mb-4">
                <span className="text-lg font-bold text-text-primary">Total</span>
                <span className="text-2xl font-bold text-primary-green">${grandTotal.toFixed(2)}</span>
              </div>
              <button
                type="button"
                disabled={checkingOut}
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-white font-bold text-sm shadow-lg disabled:opacity-70"
                style={{ background: "linear-gradient(135deg, #008F0B, #007009)" }}
              >
                <CreditCard className="w-5 h-5" />
                {checkingOut ? "Processing..." : "Proceed to Checkout"}
              </button>
            </div>
          </>
        )}
      </div>
    </UserLayout>
  );
}
