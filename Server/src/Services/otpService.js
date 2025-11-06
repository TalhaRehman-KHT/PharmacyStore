// src/services/otpService.js
import { pool } from '../Config/db.js';
import crypto from 'crypto';

export function generate4Digit() {
    // generate 4-digit with leading zeros
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

export async function createOtp(userId, purpose, minutes = 10) {
    const code = generate4Digit();
    const expires_at = new Date(Date.now() + minutes * 60 * 1000);
    const res = await pool.query(
        `INSERT INTO otps (user_id, code, purpose, expires_at) VALUES ($1,$2,$3,$4) RETURNING *`,
        [userId, code, purpose, expires_at]
    );
    return res.rows[0];
}
