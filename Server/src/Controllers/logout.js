import { pool } from "../Config/db.js";


export async function logout(req, res) {
    const token = req.get('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(400).end();
    // remove from sessions (or set expires_at in past)
    await pool.query('DELETE FROM sessions WHERE token=$1', [token]);
    res.json({ message: 'Logged out' });
}
