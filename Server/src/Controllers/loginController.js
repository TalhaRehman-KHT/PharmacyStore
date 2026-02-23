import bcrypt from "bcryptjs";
import { pool } from "../Config/db.js";
import { signToken } from "../Services/jwtService.js";

export async function login(req, res) {
    const { email, password } = req.body;

    try {
        // Find user
        const r = await pool.query(
            "SELECT id, email, name, password_hash, is_verified, role FROM users WHERE email=$1",
            [email]
        );

        const user = r.rows[0];
        if (!user)
            return res.status(401).json({ message: "Invalid credentials" });

        // Compare password
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok)
            return res.status(401).json({ message: "Invalid credentials" });

        // Check verification
        if (!user.is_verified)
            return res.status(403).json({ message: "Email not verified" });

        // Create JWT token
        const token = signToken({
            id: user.id,
            role: user.role,
            email: user.email,
        });

        // Store in sessions table (optional)
        const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
        await pool.query(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1,$2,$3)",
            [user.id, token, expiry]
        );

        // Send back token and user data
        res.status(200).json({
            message: "Login successful",
            token,
            expiresAt: expiry,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                is_verified: user.is_verified,
            },
        });
    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
}
