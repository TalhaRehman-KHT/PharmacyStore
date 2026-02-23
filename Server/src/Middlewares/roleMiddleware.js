/**
 * Restrict route access by role.
 * Use after requireAuth.
 */
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({ message: "Forbidden: insufficient permissions" });
        }
        next();
    };
}
