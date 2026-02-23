import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./src/Routes/authRoutes.js";
import { pool } from "./src/Config/db.js";
const app = express();

dotenv.config();

const allowedOrigins = [
    process.env.CLIENT_URL, // production frontend
    "http://localhost:5173", // local dev
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
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
