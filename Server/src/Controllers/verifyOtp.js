import { pool } from "../Config/db.js";
import { signToken } from "../Services/jwtService.js";

export async function verifyOtp(req, res) {
    const { email, code } = req.body;
    try {
        const userRes = await pool.query(
            "SELECT id, email, name, role, is_verified FROM users WHERE email=$1",
            [email]
        );
        if (!userRes.rows.length)
            return res.status(400).json({ message: "User not found" });

        const user = userRes.rows[0];

        // Find OTP record
        const otpRes = await pool.query(
            "SELECT * FROM otps WHERE user_id=$1 AND code=$2 AND used=false ORDER BY created_at DESC LIMIT 1",
            [user.id, code]
        );
        const otp = otpRes.rows[0];
        if (!otp)
            return res.status(400).json({ message: "Invalid or expired OTP" });

        if (new Date(otp.expires_at) < new Date())
            return res.status(400).json({ message: "OTP expired" });

        // Mark OTP as used and verify user
        await pool.query("UPDATE otps SET used=true WHERE id=$1", [otp.id]);
        await pool.query("UPDATE users SET is_verified=true WHERE id=$1", [user.id]);

        // Create JWT token after verification
        const token = signToken({
            id: user.id,
            role: user.role,
            email: user.email,
        });

        // Optionally save session (if using sessions table)
        const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
        await pool.query(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [user.id, token, expiry]
        );

        // Return success + token + user info
        res.status(200).json({
            message: "Email verified successfully!",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                is_verified: true,
            },
        });
    } catch (err) {
        console.error("OTP verify error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
}
