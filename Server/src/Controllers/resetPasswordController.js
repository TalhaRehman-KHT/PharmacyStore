import bcrypt from "bcryptjs";
import { pool } from "../Config/db.js";

export async function resetPassword(req, res) {
    const { token, newPassword } = req.body;

    try {
        // Find reset token
        const tokenRes = await pool.query(
            "SELECT * FROM password_reset_tokens WHERE token=$1 AND used=false",
            [token]
        );

        const record = tokenRes.rows[0];
        if (!record)
            return res.status(400).json({ message: "Invalid or expired token" });

        if (new Date(record.expires_at) < new Date())
            return res.status(400).json({ message: "Token expired" });

        // Hash new password
        const hash = await bcrypt.hash(newPassword, 10);

        // Update password in users table
        await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [hash, record.user_id]);

        // Mark token as used
        await pool.query("UPDATE password_reset_tokens SET used=true WHERE id=$1", [record.id]);

        res.status(200).json({ message: "Password reset successfully!" });
    } catch (err) {
        console.error("Reset Password Error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
}
