import { verifyToken } from '../Services/jwtService.js';
import { pool } from '../Config/db.js';

export async function requireAuth(req, res, next) {
    try {
        const auth = req.get('Authorization') || '';
        const token = auth.replace('Bearer ', '');
        if (!token) return res.status(401).json({ message: 'Not authenticated' });

        const payload = verifyToken(token); // throws on invalid
        // optional: check session still exists
        const s = await pool.query('SELECT id FROM sessions WHERE token=$1 AND expires_at > now()', [token]);
        if (!s.rows.length) return res.status(401).json({ message: 'Session expired' });

        req.user = { id: payload.sub ?? payload.id, role: payload.role };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}
