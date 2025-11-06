// src/Controllers/authController.js
import { createOtp } from "../Services/otpService.js";
import { sendEmail } from "../Services/mailService.js";
import { pool } from "../Config/db.js";

export async function resendOtp(req, res) {
    const { email } = req.body;
    try {
        // Check if user exists
        const userRes = await pool.query("SELECT id, is_verified FROM users WHERE email=$1", [email]);
        if (!userRes.rows.length)
            return res.status(404).json({ message: "User not found" });
        const user = userRes.rows[0];

        if (user.is_verified)
            return res.status(400).json({ message: "Email already verified" });

        // Optional: mark previous OTPs as used to avoid confusion
        await pool.query("UPDATE otps SET used=true WHERE user_id=$1", [user.id]);

        // Create new OTP
        const otp = await createOtp(user.id, "email_confirmation", 10);

        // Send new OTP email
        const html = `<p>Your new verification code is <b>${otp.code}</b></p>
                  <p>This code expires in 10 minutes.</p>`;
        await sendEmail(email, "New Pharmacy Store Verification Code", html);

        res.json({ message: "New OTP sent successfully. Please check your email." });
    } catch (err) {
        console.error("Resend OTP error:", err.message);
        res.status(500).json({ message: "Server error while resending OTP" });
    }
}
