import express from "express";
import { requireAuth } from "../Middlewares/authMiddleware.js";
import { requireRole } from "../Middlewares/roleMiddleware.js";
import { getAlternative } from "../Controllers/aiAlternativeController.js";

const aiRoutes = express.Router();

aiRoutes.post("/alternative", requireAuth, requireRole("user"), getAlternative);

export default aiRoutes;
