import { useCallback, useContext, useState } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "../../../context/AuthContext.jsx";
import { getShopMedicines } from "../../../lib/userShopService.js";
import { addToCart } from "../../../lib/userCartService.js";
import { productKey } from "../utils.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Mock cards have no batchId: match them to a shop medicine by id, then by brand name
 * (first word, e.g. "Panadol 500mg (10 tablets)" -> "panadol").
 */
function findShopMedicine(medicines, product) {
  const byId = medicines.find((m) => String(m.id) === String(product.medicineId));
  if (byId) return byId;
  const full = norm(product.name);
  const brand = full.split(" ")[0];
  return (
    medicines.find((m) => norm(m.name) === full) ||
    medicines.find((m) => brand && norm(m.name).split(" ")[0] === brand) ||
    null
  );
}

/** The batch to add: the card's own batch (real API), else the shop's best batch (mock cards). */
async function resolveBatch(product) {
  if (product.batchId) {
    return {
      name: product.name,
      batch: {
        id: product.batchId,
        pharmacyId: product.pharmacyId,
        medicineId: product.medicineId,
        sellingPrice: product.price,
      },
    };
  }
  const { medicines } = await getShopMedicines();
  const medicine = findShopMedicine(medicines, product);
  return { name: medicine?.name, batch: medicine?.bestBatch };
}

/** Add a MedAssist ProductCard to the cart with the shop's own addToCart (it re-checks the stock). */
export function useAddProductToCart() {
  const { user } = useContext(AuthContext);
  const [addingId, setAddingId] = useState(null);

  const add = useCallback(
    async (product) => {
      if (!user?.id) {
        toast.error("Please sign in to add to cart");
        return;
      }
      setAddingId(productKey(product));
      try {
        const { name, batch } = await resolveBatch(product);
        if (!batch) {
          toast.error(`${product.name} is not available in the shop right now`);
          return;
        }
        await addToCart({
          userId: user.id,
          pharmacyId: batch.pharmacyId,
          batchId: batch.id,
          medicineId: batch.medicineId,
          quantity: 1,
          unitPrice: batch.sellingPrice,
        });
        toast.success(`${name} added to cart`);
      } catch (err) {
        toast.error(err?.message || "Failed to add to cart");
      } finally {
        setAddingId(null);
      }
    },
    [user?.id]
  );

  return { add, addingId };
}
