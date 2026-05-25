/**
 * license.js — Express Router for Licensing Endpoints
 */

const express = require('express');
const router = express.Router();
const { getLicenseStatus, activateLicense, getHardwareProfile } = require('../services/licenseService');

// Retrieve current status & local HWID info
router.get('/status', async (req, res) => {
    try {
        const validation = await getLicenseStatus();
        const hwid = getHardwareProfile();

        res.json({
            status: validation.status,
            reason: validation.reason,
            daysLeft: validation.daysLeft !== undefined ? validation.daysLeft : null,
            billsLeft: validation.billsLeft !== undefined ? validation.billsLeft : null,
            payload: validation.payload || null,
            hwid // Return local hardware identifiers for UI copy pasting
        });
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
        res.json({
            success: true,
            message: 'License deactivated successfully. Software locked.'
        });
    } catch (error) {
        console.error('[License Router POST Deactivate Error]', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
