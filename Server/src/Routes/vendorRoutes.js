import express from "express";
import { requireAuth } from "../Middlewares/authMiddleware.js";
import { requireRole } from "../Middlewares/roleMiddleware.js";
import {
    createStore,
    addMedicine,
    addBatch,
    getStock,
    getDashboardStats,
} from "../Controllers/vendorController.js";

const vendorRoutes = express.Router();

vendorRoutes.post("/create-store", requireAuth, requireRole("vendor"), createStore);
vendorRoutes.post("/add-medicine", requireAuth, requireRole("vendor"), addMedicine);
vendorRoutes.post("/add-batch", requireAuth, requireRole("vendor"), addBatch);
vendorRoutes.get("/stock", requireAuth, requireRole("vendor"), getStock);
vendorRoutes.get("/dashboard-stats", requireAuth, requireRole("vendor"), getDashboardStats);

export default vendorRoutes;
