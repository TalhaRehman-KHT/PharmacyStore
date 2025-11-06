import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./src/Routes/authRoutes.js";
import { pool } from "./src/Config/db.js";
const app = express();

dotenv.config();

app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json());

// basic route
app.get("/", (req, res) => {
    res.send("Pharmacy Store Server is running 🚀");
});

// mount auth routes
app.use("/api/auth", authRoutes);

export default app;
