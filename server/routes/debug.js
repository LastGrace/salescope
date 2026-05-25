const express = require('express');
const router = express.Router();
const checkAndMigrate = require('../auto-migrate');

router.post('/fix-db', async (req, res) => {
    try {
        console.log('[Debug] Manually triggering DB migration...');
        await checkAndMigrate();
        res.json({ message: 'Database repair attempted. Please restart the app or try saving again.' });
    } catch (error) {
        console.error('[Debug] Manual migration failed:', error);
        res.status(500).json({ message: 'Repair failed: ' + error.message });
    }
});

module.exports = router;
