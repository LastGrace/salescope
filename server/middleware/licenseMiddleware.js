/**
 * licenseMiddleware.js — Express Middleware to Enforce Licensing & Security Lockouts
 *
 * Protects critical business endpoints by checking software validity.
 * Allows login, logs, and licensing endpoints through.
 */

const { getLicenseStatus } = require('../services/licenseService');

const enforceLicense = async (req, res, next) => {
    // 1. Bypass check for non-API requests (static assets, index.html)
    const path = req.originalUrl || req.url;
    if (!path.startsWith('/api')) {
        return next();
    }

    // 2. Bypass check for licensing, health, and login endpoints themselves to allow activation
    if (path.includes('/api/license') || path.includes('/api/auth/login') || path.includes('/api/health')) {
        return next();
    }

    try {
        const validation = await getLicenseStatus();

        if (validation.status === 'licensed') {
            // Software is valid, continue
            return next();
        }

        // 2. Lock down and return 403 Forbidden for all other routes
        console.warn(`[License Block] Request to ${path} blocked. Status: ${validation.status}. Reason: ${validation.reason}`);
        
        return res.status(403).json({
            error: 'LICENSE_LOCKED',
            status: validation.status,
            reason: validation.reason,
            daysLeft: validation.daysLeft || 0,
            billsLeft: validation.billsLeft || 0
        });
    } catch (e) {
        console.error('[License Middleware Error]', e.message);
        // Safety lock: block access if license check itself crashes
        return res.status(500).json({
            error: 'LICENSE_ERROR',
            reason: 'Internal security manager error. Access temporarily blocked.'
        });
    }
};

module.exports = enforceLicense;
