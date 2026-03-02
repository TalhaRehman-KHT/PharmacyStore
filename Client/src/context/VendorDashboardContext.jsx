import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext.jsx";
import { getPharmacyByVendorId } from "../lib/vendorPharmacyService.js";
import {
  getPharmacyOrders,
  getOrderCount,
  getTotalRevenue,
} from "../lib/vendorOrderService.js";
import {
  getPharmacyMedicines,
  getMedicineCount,
  getLowStockCount,
} from "../lib/vendorMedicineService.js";

export const VendorDashboardContext = createContext(null);

export function VendorDashboardProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [pharmacy, setPharmacy] = useState(null);
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalMedicines, setTotalMedicines] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id || user?.role !== "vendor") {
      setPharmacy(null);
      setOrders([]);
      setTotalOrders(0);
      setTotalMedicines(0);
      setLowStockCount(0);
      setTotalRevenue(0);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const p = await getPharmacyByVendorId(user.id);
      setPharmacy(p);

      if (!p?.id) {
        setOrders([]);
        setTotalOrders(0);
        setTotalMedicines(0);
        setLowStockCount(0);
        setTotalRevenue(0);
        setLoading(false);
        return;
      }

      const [ords, ordCount, medCount, lowStock, revenue] = await Promise.all([
        getPharmacyOrders(p.id, { limit: 10 }),
        getOrderCount(p.id),
        getMedicineCount(p.id),
        getLowStockCount(p.id),
        getTotalRevenue(p.id),
      ]);

      setOrders(ords);
      setTotalOrders(ordCount);
      setTotalMedicines(medCount);
      setLowStockCount(lowStock);
      setTotalRevenue(revenue);
    } catch (e) {
      setError(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <VendorDashboardContext.Provider
      value={{
        pharmacy,
        orders,
        totalOrders,
        totalMedicines,
        lowStockCount,
        totalRevenue,
        loading,
        error,
        refresh: load,
      }}
    >
      {children}
    </VendorDashboardContext.Provider>
  );
}

export function useVendorDashboard() {
  const ctx = useContext(VendorDashboardContext);
  if (!ctx) throw new Error("useVendorDashboard must be used within VendorDashboardProvider");
  return ctx;
}
