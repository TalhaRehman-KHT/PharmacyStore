import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./src/Routes/authRoutes.js";
import prescriptionRoutes from "./src/Routes/prescriptionRoutes.js";
import aiRoutes from "./src/Routes/aiRoutes.js";
import remindersRoutes from "./src/Routes/remindersRoutes.js";
import vendorRoutes from "./src/Routes/vendorRoutes.js";

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

// User-side routes
app.use("/api/prescription", prescriptionRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/reminders", remindersRoutes);

// Vendor-side routes
app.use("/api/vendor", vendorRoutes);

export default app;
