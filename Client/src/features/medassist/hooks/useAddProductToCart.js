import { useCallback, useContext, useState } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "../../../context/AuthContext.jsx";
import { getShopMedicines } from "../../../lib/userShopService.js";
import { addToCart } from "../../../lib/userCartService.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Match a MedAssist ProductCard to a shop medicine: by id first (FastAPI returns medicines.id),
 * then by brand name (first word, e.g. "Panadol 500mg (10 tablets)" -> "panadol").
 */
function findShopMedicine(medicines, product) {
  const byId = medicines.find((m) => String(m.id) === String(product.id));
  if (byId) return byId;
  const full = norm(product.name);
  const brand = full.split(" ")[0];
  return (
    medicines.find((m) => norm(m.name) === full) ||
    medicines.find((m) => brand && norm(m.name).split(" ")[0] === brand) ||
    null
  );
}

/** Add a MedAssist ProductCard to the cart using the shop's cheapest in-stock batch. */
export function useAddProductToCart() {
  const { user } = useContext(AuthContext);
  const [addingId, setAddingId] = useState(null);

  const add = useCallback(
    async (product) => {
      if (!user?.id) {
        toast.error("Please sign in to add to cart");
        return;
      }
      setAddingId(product.id);
      try {
        const { medicines } = await getShopMedicines();
        const medicine = findShopMedicine(medicines, product);
        const batch = medicine?.bestBatch;
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
        toast.success(`${medicine.name} added to cart`);
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
