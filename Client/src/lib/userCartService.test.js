import { describe, it, expect, vi } from "vitest";
import { createSupabaseMock } from "../test/supabaseMock.js";

let mock;
vi.mock("./supabase.js", () => ({
  get supabase() {
    return mock.supabase;
  },
}));

const { addToCart, updateItemQuantity, removeItem, clearCart } = await import("./userCartService.js");

const ADD = { userId: "u1", pharmacyId: "p1", batchId: "b1", medicineId: "m1", quantity: 1, unitPrice: 4 };

/** Cart with one existing line (qty) for batch b1 whose stock is `stock`. */
function cartDb({ qty = null, stock = 2, fail = {} } = {}) {
  return createSupabaseMock((c) => {
    const key = `${c.table}.${c.op}`;
    if (fail[key]) return { data: null, error: { message: `${key} failed` } };
    if (key === "carts.select") return { data: { id: "c1" }, error: null };
    if (key === "cart_items.select") {
      if (c.columns?.includes("batch_id")) return { data: { cart_id: "c1", batch_id: "b1", quantity: qty }, error: null };
      return { data: qty == null ? null : { id: "i1", quantity: qty }, error: null };
    }
    if (key === "medicine_batches.select") return { data: { quantity: stock }, error: null };
    return { data: null, error: null };
  });
}

describe("addToCart", () => {
  it("rejects when the new quantity exceeds batch stock (B5)", async () => {
    mock = cartDb({ qty: 2, stock: 2 });
    await expect(addToCart(ADD)).rejects.toThrow(/only 2/i);
    expect(mock.calls.some((c) => c.table === "cart_items" && c.op === "update")).toBe(false);
  });

  it("increments within stock", async () => {
    mock = cartDb({ qty: 1, stock: 2 });
    await addToCart(ADD);
    const upd = mock.calls.find((c) => c.table === "cart_items" && c.op === "update");
    expect(upd.payload).toEqual({ quantity: 2 });
  });

  it("throws when the insert fails instead of reporting success (K7)", async () => {
    mock = cartDb({ qty: null, fail: { "cart_items.insert": true } });
    await expect(addToCart(ADD)).rejects.toThrow(/insert failed/);
  });
});

describe("updateItemQuantity", () => {
  it("rejects quantity above stock (B5)", async () => {
    mock = cartDb({ qty: 2, stock: 2 });
    await expect(updateItemQuantity("i1", 3)).rejects.toThrow(/only 2/i);
  });

  it("allows quantity within stock", async () => {
    mock = cartDb({ qty: 1, stock: 2 });
    await updateItemQuantity("i1", 2);
    const upd = mock.calls.find((c) => c.table === "cart_items" && c.op === "update");
    expect(upd.payload).toEqual({ quantity: 2 });
  });
});

describe("removeItem / clearCart (K7)", () => {
  it("removeItem throws when delete fails", async () => {
    mock = cartDb({ qty: 1, fail: { "cart_items.delete": true } });
    await expect(removeItem("i1")).rejects.toThrow(/delete failed/);
  });

  it("clearCart throws when delete fails", async () => {
    mock = cartDb({ fail: { "cart_items.delete": true } });
    await expect(clearCart("c1")).rejects.toThrow(/delete failed/);
  });
});
