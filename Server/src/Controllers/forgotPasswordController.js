import crypto from "crypto";
import { pool } from "../Config/db.js";
import { sendEmail } from "../Services/mailService.js"; // assuming you already have email sending setup

export async function forgotPassword(req, res) {
    const { email } = req.body;

    try {
        // Find user by email
        const userRes = await pool.query("SELECT id, email FROM users WHERE email=$1", [email]);
        const user = userRes.rows[0];

        if (!user)
            return res.status(404).json({ message: "No account found with this email" });

        // Generate secure token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Save token to DB
        await pool.query(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [user.id, token, expiresAt]
        );

        // Send reset link
        const resetLink = `http://localhost:5173/reset-password?token=${token}`;
        await sendEmail(
            user.email,
            "Password Reset Request",
            `Click the following link to reset your password:\n\n${resetLink}\n\nThis link will expire in 15 minutes.`
        );

        res.status(200).json({ message: "Password reset email sent successfully!" });
    } catch (err) {
        console.error("Forgot Password Error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
}
