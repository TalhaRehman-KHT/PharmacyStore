import express from "express";
import cors from "cors";
import authRoutes from "./src/Routes/authRoutes.js";
import { pool } from "./src/Config/db.js";

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

// basic route
app.get("/", (req, res) => {
    res.send("Pharmacy Store Server is running 🚀");
});

// mount auth routes
app.use("/api/auth", authRoutes);

export default app;
