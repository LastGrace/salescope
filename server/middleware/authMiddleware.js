const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Verify JWT token and attach user to request
 */
const verifyToken = (req, res, next) => {
    let token = req.headers['authorization'];

    // Check query param if header is missing (for file downloads)
    if (!token && req.query.token) {
        token = 'Bearer ' + req.query.token;
    }

    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    // Bearer <token>
    const tokenParts = token.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
        return res.status(401).json({ message: 'Invalid token format' });
    }

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_generated_secret_key_849302194';
        jwt.verify(tokenParts[1], JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            req.user = decoded;
            next();
        });
    } catch (e) {
        return res.status(500).json({ message: 'Internal Server Error (Auth)', error: e.message });
    }
};

/**
 * Check if user has a specific permission
 * Uses employee_permissions table for direct user-permission lookup
 * Admin users (is_admin=1) bypass all permission checks
 */
const checkPermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: 'Forbidden: Not authenticated' });
        }

        // Admin users have all permissions
        if (req.user.is_admin) {
            return next();
        }

        try {
            // Check employee_permissions directly
            const [rows] = await db.query(`
                SELECT 1 FROM employee_permissions ep
                JOIN permissions p ON ep.permission_id = p.id
                WHERE ep.employee_id = ? AND p.code = ?
            `, [req.user.id, permission]);

            if (rows.length > 0) {
                next();
            } else {
                res.status(403).json({ message: `Forbidden: Requires '${permission}' permission` });
            }
        } catch (err) {
            console.error('Permission check error:', err);
            res.status(500).json({
                message: 'Internal Server Error (Permission Check)',
                error: err.message,
                stack: err.stack
            });
        }
    };
};

/**
 * Check if user has ANY of the specified permissions
 */
const checkAnyPermission = (permissions) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: 'Forbidden: Not authenticated' });
        }

        // Admin users have all permissions
        if (req.user.is_admin) {
            return next();
        }

        try {
            const placeholders = permissions.map(() => '?').join(',');
            const [rows] = await db.query(`
                SELECT 1 FROM employee_permissions ep
                JOIN permissions p ON ep.permission_id = p.id
                WHERE ep.employee_id = ? AND p.code IN (${placeholders})
                LIMIT 1
            `, [req.user.id, ...permissions]);

            if (rows.length > 0) {
                next();
            } else {
                res.status(403).json({ message: `Forbidden: Requires one of: ${permissions.join(', ')}` });
            }
        } catch (err) {
            console.error('Permission check error:', err);
            res.status(500).json({
                message: 'Internal Server Error (Permission Check)',
                error: err.message,
                stack: err.stack
            });
        }
    };
};

/**
 * Check if user is admin (is_admin=1)
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(403).json({ message: 'Forbidden: Not authenticated' });
    }

    if (req.user.is_admin) {
        return next();
    }

    return res.status(403).json({ message: 'Forbidden: Admin access required' });
};

// Legacy alias for backward compatibility
const verifyManager = checkPermission('inventory.product.update');

module.exports = {
    verifyToken,
    verifyManager,
    checkPermission,
    checkAnyPermission,
    requireAdmin
};
