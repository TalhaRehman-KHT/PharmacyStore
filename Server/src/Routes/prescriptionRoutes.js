import express from "express";
import { requireAuth } from "../Middlewares/authMiddleware.js";
import { requireRole } from "../Middlewares/roleMiddleware.js";
import { uploadMiddleware, uploadPrescription } from "../Controllers/prescriptionController.js";

const prescriptionRoutes = express.Router();

prescriptionRoutes.post("/upload", requireAuth, requireRole("user"), uploadMiddleware, uploadPrescription);

export default prescriptionRoutes;
