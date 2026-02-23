// src/controllers/authController.js
import bcrypt from 'bcryptjs';
import { pool } from '../Config/db.js';
import { createOtp } from '../Services/otpService.js';
import { sendEmail } from '../Services/mailService.js';


export async function
    register(req, res) {
    const { email, password, name, role } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email & password required' });

    // check existing
    const userCheck = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (userCheck.rows.length) return res.status(409).json({ message: 'Email already used' });

    const pwHash = await bcrypt.hash(password, 12);
    const userRes = await pool.query(
        `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4) RETURNING id, email, is_verified`,
        [email, pwHash, name || null, role || 'user']
    );
    const user = userRes.rows[0];

    // create OTP
    const otp = await createOtp(user.id, 'email_confirmation', Number(process.env.OTP_EXPIRY_MINUTES || 10));
    // send via email
    const html = `<p>Your verification code is <strong>${otp.code}</strong>. Expires in 10 minutes.</p>`;
    await sendEmail(email, 'Verify your email', html);

    return res.status(201).json({ message: 'Registered. Check email for 4-digit OTP', userId: user.id });
}
