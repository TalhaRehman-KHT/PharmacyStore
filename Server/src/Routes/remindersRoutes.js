import express from "express";
import { requireAuth } from "../Middlewares/authMiddleware.js";
import { requireRole } from "../Middlewares/roleMiddleware.js";
import { getReminders, createReminder } from "../Controllers/remindersController.js";

const remindersRoutes = express.Router();

remindersRoutes.get("/", requireAuth, requireRole("user"), getReminders);
remindersRoutes.post("/", requireAuth, requireRole("user"), createReminder);

export default remindersRoutes;
