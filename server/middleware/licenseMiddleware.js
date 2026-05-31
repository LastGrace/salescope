/**
 * licenseMiddleware.js — Express Middleware to Enforce Licensing & Security Lockouts
 *
 * Protects critical business endpoints by checking software validity.
 * Allows login, logs, and licensing endpoints through.
 *
 * PERFORMANCE: Caches license status for 60 seconds so we don't hit disk/DB
 * on every single API request. This alone eliminates ~90% of per-request overhead.
 */

const { getLicenseStatus } = require('../services/licenseService');

// ── In-memory license result cache ──────────────────────────────────
let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Invalidate the cache (called after activation/deactivation/restore)
 */
const invalidateLicenseCache = () => {
    cachedResult = null;
    cacheTimestamp = 0;
};

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

    // 3. Also bypass for backup endpoints during restore to prevent deadlocks
    if (path.includes('/api/backup')) {
        return next();
    }

    try {
        const now = Date.now();

        // Use cached result if fresh
        if (cachedResult && (now - cacheTimestamp) < CACHE_TTL_MS) {
            if (cachedResult.status === 'licensed') {
                return next();
            }
            // Cached denial
            return res.status(403).json({
                error: 'LICENSE_LOCKED',
                status: cachedResult.status,
                reason: cachedResult.reason,
                daysLeft: cachedResult.daysLeft || 0,
                billsLeft: cachedResult.billsLeft || 0
            });
        }

        // Full license check (expensive — only runs once per 60s)
        const validation = await getLicenseStatus();
        cachedResult = validation;
        cacheTimestamp = Date.now();

        if (validation.status === 'licensed') {
            // Software is valid, continue
            return next();
        }

        // Lock down and return 403 Forbidden for all other routes
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
module.exports.invalidateLicenseCache = invalidateLicenseCache;
