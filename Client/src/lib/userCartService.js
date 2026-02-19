import { supabase } from "./supabase.js";

async function getOrCreateCartId(userId, pharmacyId) {
  const { data: existing } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .eq("pharmacy_id", pharmacyId)
    .maybeSingle();

  if (existing?.id) return existing.id.toString();

  const { data: inserted, error } = await supabase
    .from("carts")
    .insert({ user_id: userId, pharmacy_id: pharmacyId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return inserted.id.toString();
}

function parseCart(row) {
  const cartId = row.id?.toString();
  const items = (row.cart_items || []).map((i) => ({
    id: i.id,
    cartId,
    batchId: i.batch_id ?? i.batchId,
    medicineId: i.medicine_id ?? i.medicineId,
    medicineName: i.medicines?.name ?? "Medicine",
    quantity: i.quantity ?? 0,
    unitPrice: typeof i.unit_price !== "undefined" ? parseFloat(i.unit_price) : parseFloat(i.unitPrice) || 0,
    total: (i.quantity ?? 0) * (parseFloat(i.unit_price ?? i.unitPrice) || 0),
  }));
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  return {
    id: row.id,
    pharmacyId: row.pharmacy_id ?? row.pharmacyId,
    pharmacyName: row.pharmacies?.name ?? "Pharmacy",
    items,
    subtotal,
  };
}

export async function getCartsForUser(userId) {
  const { data, error } = await supabase
    .from("carts")
    .select(
      `
      *,
      pharmacies ( name ),
      cart_items (
        *,
        medicines ( name )
      )
    `
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(parseCart).filter((c) => c.items.length > 0);
}

export async function addToCart({ userId, pharmacyId, batchId, medicineId, quantity = 1, unitPrice }) {
  const cartId = await getOrCreateCartId(userId, pharmacyId);

  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("batch_id", batchId)
    .maybeSingle();

  if (existing) {
    const newQty = (existing.quantity || 0) + quantity;
    await supabase.from("cart_items").update({ quantity: newQty }).eq("id", existing.id);
  } else {
    await supabase.from("cart_items").insert({
      cart_id: cartId,
      batch_id: batchId,
      medicine_id: medicineId,
      quantity,
      unit_price: unitPrice,
    });
  }

  await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
}

export async function updateItemQuantity(cartItemId, quantity) {
  if (quantity < 1) {
    await removeItem(cartItemId);
    return;
  }
  const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", cartItemId);
  if (error) throw new Error(error.message);

  const { data: item } = await supabase.from("cart_items").select("cart_id").eq("id", cartItemId).single();
  if (item?.cart_id) {
    await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", item.cart_id);
  }
}

export async function removeItem(cartItemId) {
  const { data: item } = await supabase.from("cart_items").select("cart_id").eq("id", cartItemId).maybeSingle();
  await supabase.from("cart_items").delete().eq("id", cartItemId);
  if (item?.cart_id) {
    await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", item.cart_id);
  }
}

export async function clearCart(cartId) {
  await supabase.from("cart_items").delete().eq("cart_id", cartId);
  await supabase.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
}
