/**
 * license.js — Express Router for Licensing Endpoints
 */

const express = require('express');
const router = express.Router();
const { getLicenseStatus, activateLicense, getHardwareProfile } = require('../services/licenseService');

// ── In-memory cache for /status endpoint (same TTL as middleware) ────
let statusCache = null;
let statusCacheTime = 0;
const STATUS_CACHE_TTL = 60 * 1000; // 60 seconds

// Retrieve current status & local HWID info
router.get('/status', async (req, res) => {
    try {
        const now = Date.now();

        // Return cached result if fresh (avoids expensive HWID + crypto on every poll, unless status is pending)
        if (statusCache && statusCache.status !== 'pending' && (now - statusCacheTime) < STATUS_CACHE_TTL) {
            return res.json(statusCache);
        }

        const validation = await getLicenseStatus();
        const hwid = getHardwareProfile();

        const result = {
            status: validation.status,
            reason: validation.reason,
            daysLeft: validation.daysLeft !== undefined ? validation.daysLeft : null,
            billsLeft: validation.billsLeft !== undefined ? validation.billsLeft : null,
            payload: validation.payload || null,
            hwid // Return local hardware identifiers for UI copy pasting
        };

        statusCache = result;
        statusCacheTime = now;

        res.json(result);
    } catch (error) {
        console.error('[License Router GET Status Error]', error);
        res.status(500).json({ error: error.message });
    }
});

// Activate license key
router.post('/activate', async (req, res) => {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ error: 'Activation key is required.' });
    }

    try {
        const payload = await activateLicense(key);
        statusCache = null; // Invalidate cache so next status check reflects new state
        
        // If the activation is pending admin approval, return a different response
        if (payload.status === 'pending') {
            return res.json({
                success: true,
                pending: true,
                message: payload.reason || 'Activation request submitted. Waiting for admin approval.',
            });
        }
        
        res.json({
            success: true,
            message: 'Activation successful! Software unlocked.',
            payload
        });
    } catch (error) {
        console.error('[License Router POST Activate Error]', error);
        res.status(400).json({ error: error.message });
    }
});

// Deactivate license
router.post('/deactivate', async (req, res) => {
    try {
        const { deactivateLicense } = require('../services/licenseService');
        await deactivateLicense();
        statusCache = null; // Invalidate cache
        res.json({
            success: true,
            message: 'License deactivated successfully. Software locked.'
        });
    } catch (error) {
        console.error('[License Router POST Deactivate Error]', error);
        res.status(500).json({ error: error.message });
    }
});

// Sync license (force network check)
router.post('/sync', async (req, res) => {
    try {
        statusCache = null; // Force fresh check
        const validation = await getLicenseStatus(true); // true forces sync
        const hwid = getHardwareProfile();
        
        res.json({
            success: true,
            status: validation.status,
            reason: validation.reason,
            daysLeft: validation.daysLeft !== undefined ? validation.daysLeft : null,
            payload: validation.payload || null,
            hwid
        });
    } catch (error) {
        console.error('[License Router POST Sync Error]', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
