const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { verifyToken } = require('../middleware/authMiddleware');
const { ENV_FILE, UPLOADS_DIR } = require('../paths');
// `.env` is already configured in index.js at boot time
const checkAndMigrate = require('../auto-migrate');

const db = require('../db');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for Logo Upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'store-logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|mp3|wav|mpeg/;
        const mimetype = /image\/|audio\//.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images and audio files are allowed'));
    }
});

// POST /api/settings/factory-reset - Developer Danger Zone
router.post('/factory-reset', verifyToken, async (req, res) => {
    const { password } = req.body;

    try {
        // Find the Super Admin or Dev account
        const [users] = await db.query('SELECT password_hash FROM users WHERE username = "Dev" OR is_system = 1 LIMIT 1');

        if (users.length === 0) {
            return res.status(500).json({ message: 'No system admin found to authorize reset.' });
        }

        const validPassword = await bcrypt.compare(password, users[0].password_hash);

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid developer password' });
        }
        // The rest of the factory reset logic would go here
        res.status(200).json({ message: 'Developer password validated. Proceeding with factory reset...' });

    } catch (error) {
        console.error('Error during factory reset authorization:', error);
        res.status(500).json({ message: 'Internal server error during authorization' });
    }
});

// GET /api/settings/store - Fetch store settings
router.get('/store', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM store_settings WHERE id = 1');

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Settings not initialized' });
        }

        const settings = rows[0];

        // Apply Default Fallback Logos (Salescope Branding Trial Mode)
        if (!settings.logo_url) settings.logo_url = '/Salescope.png';
        if (!settings.bill_logo_url) settings.bill_logo_url = '/Salescope.png';
        if (!settings.login_logo_url) settings.login_logo_url = '/Salescope.png';
        if (!settings.pos_background_url) settings.pos_background_url = '/Salescope.png';

        res.json(settings);
    } catch (error) {
        if (error.errno === 1054) {
            console.log('[LazyMigrate] Detected missing columns in GET. Running auto-migrate...');
            try {
                await checkAndMigrate();
                // Retry query once
                const [rows] = await db.query('SELECT * FROM store_settings WHERE id = 1');
                const settings = rows[0];
                if (settings) {
                    if (!settings.logo_url) settings.logo_url = '/Salescope.png';
                    if (!settings.bill_logo_url) settings.bill_logo_url = '/Salescope.png';
                    if (!settings.login_logo_url) settings.login_logo_url = '/Salescope.png';
                    if (!settings.pos_background_url) settings.pos_background_url = '/Salescope.png';
                }
                return res.json(settings);
            } catch (retryErr) {
                console.error('[LazyMigrate] Failed:', retryErr);
                return res.status(500).json({ message: 'Database schema error', details: retryErr.message });
            }
        }
        console.error('Error fetching store settings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /api/settings/store - Update store settings (with Logo Uploads)
router.post('/store', verifyToken, upload.any(), async (req, res) => {
    const {
        store_name,
        address,
        phone_1,
        phone_2,
        instagram_link,
        exchange_policy_text,
        whatsapp_caption,
        logo_width,
        logo_height,
        bill_logo_width,
        bill_logo_height,
        login_logo_width,
        login_logo_height,
        pos_background_width,
        pos_background_height,
        pos_background_opacity,
        show_logo,
        show_bill_logo,
        show_login_logo,
        show_pos_background,
        show_product_add_sound,
        logo_url,
        bill_logo_url,
        login_logo_url,
        pos_background_url,
        product_add_sound_url
    } = req.body || {};

    let logoUrl = null;
    let billLogoUrl = null;
    let loginLogoUrl = null;
    let posBackgroundUrl = null;
    let productAddSoundUrl = null;

    try {
        // 1. Get current settings to handle logo updates (safe selection sub-block)
        try {
            const [currentRows] = await db.query('SELECT logo_url, bill_logo_url, login_logo_url, pos_background_url, product_add_sound_url FROM store_settings WHERE id = 1');
            if (currentRows && currentRows.length > 0) {
                // If explicitly cleared by user (passed as empty string), set to empty string. Otherwise keep database value.
                logoUrl = logo_url === '' ? '' : (currentRows[0].logo_url || null);
                billLogoUrl = bill_logo_url === '' ? '' : (currentRows[0].bill_logo_url || null);
                loginLogoUrl = login_logo_url === '' ? '' : (currentRows[0].login_logo_url || null);
                posBackgroundUrl = pos_background_url === '' ? '' : (currentRows[0].pos_background_url || null);
                productAddSoundUrl = product_add_sound_url === '' ? '' : (currentRows[0].product_add_sound_url || null);
            }
        } catch (selectErr) {
            console.log('[Settings SELECT] Missing columns or uninitialized, proceeding with defaults:', selectErr.message);
        }

        // Process files from upload.any()
        if (req.files && Array.isArray(req.files)) {
            const logoFile = req.files.find(f => f.fieldname === 'logo');
            const billLogoFile = req.files.find(f => f.fieldname === 'bill_logo');
            const loginLogoFile = req.files.find(f => f.fieldname === 'login_logo');
            const posBgFile = req.files.find(f => f.fieldname === 'pos_background');
            const soundFile = req.files.find(f => f.fieldname === 'product_add_sound');

            if (logoFile) logoUrl = '/uploads/' + logoFile.filename;
            if (billLogoFile) billLogoUrl = '/uploads/' + billLogoFile.filename;
            if (loginLogoFile) loginLogoUrl = '/uploads/' + loginLogoFile.filename;
            if (posBgFile) posBackgroundUrl = '/uploads/' + posBgFile.filename;
            if (soundFile) productAddSoundUrl = '/uploads/' + soundFile.filename;
        }

        const query = `
            UPDATE store_settings SET 
                store_name = ?, address = ?, phone_1 = ?, phone_2 = ?, 
                instagram_link = ?, exchange_policy_text = ?, whatsapp_caption = ?,
                logo_url = ?, bill_logo_url = ?, login_logo_url = ?, pos_background_url = ?,
                pos_background_width = ?, pos_background_height = ?,
                pos_background_opacity = ?,
                product_add_sound_url = ?,
                logo_width = ?, logo_height = ?,
                bill_logo_width = ?, bill_logo_height = ?,
                login_logo_width = ?, login_logo_height = ?,
                show_logo = ?, show_bill_logo = ?, show_login_logo = ?, show_pos_background = ?, show_product_add_sound = ?
            WHERE id = 1
        `;
        const values = [
            store_name, address, phone_1, phone_2,
            instagram_link, exchange_policy_text, whatsapp_caption,
            logoUrl, billLogoUrl, loginLogoUrl, posBackgroundUrl,
            pos_background_width || null, pos_background_height || null,
            (pos_background_opacity !== undefined && pos_background_opacity !== null) ? pos_background_opacity : 0.1,
            productAddSoundUrl,
            logo_width || null, logo_height || null,
            bill_logo_width || null, bill_logo_height || null,
            login_logo_width || null, login_logo_height || null,
            show_logo === 'true' || show_logo === true ? 1 : 0,
            show_bill_logo === 'true' || show_bill_logo === true ? 1 : 0,
            show_login_logo === 'true' || show_login_logo === true ? 1 : 0,
            show_pos_background === 'true' || show_pos_background === true ? 1 : 0,
            show_product_add_sound === 'true' || show_product_add_sound === true ? 1 : 0
        ];

        await db.query(query, values);

        res.json({
            message: 'Settings updated successfully',
            logo_url: logoUrl,
            bill_logo_url: billLogoUrl,
            login_logo_url: loginLogoUrl,
            pos_background_url: posBackgroundUrl,
            product_add_sound_url: productAddSoundUrl
        });
    } catch (error) {
        console.error('Error updating store settings:', error);

        // Lazy Migration for POST
        if (error.errno === 1054) {
            console.log('[LazyMigrate] Detected missing columns during UPDATE. Running auto-migrate...');
            try {
                await checkAndMigrate();
                // Retry update once
                const retryQuery = `
                    UPDATE store_settings SET 
                        store_name = ?, address = ?, phone_1 = ?, phone_2 = ?, 
                        instagram_link = ?, exchange_policy_text = ?, whatsapp_caption = ?,
                        logo_url = ?, bill_logo_url = ?, login_logo_url = ?, pos_background_url = ?,
                        logo_width = ?, logo_height = ?,
                        bill_logo_width = ?, bill_logo_height = ?,
                        login_logo_width = ?, login_logo_height = ?,
                        pos_background_width = ?, pos_background_height = ?,
                        pos_background_opacity = ?,
                        product_add_sound_url = ?,
                        show_logo = ?, show_bill_logo = ?, show_login_logo = ?, show_pos_background = ?, show_product_add_sound = ?
                    WHERE id = 1
                `;
                const retryValues = [
                    store_name, address, phone_1, phone_2,
                    instagram_link, exchange_policy_text, whatsapp_caption,
                    logoUrl, billLogoUrl, loginLogoUrl, posBackgroundUrl,
                    logo_width || null, logo_height || null,
                    bill_logo_width || null, bill_logo_height || null,
                    login_logo_width || null, login_logo_height || null,
                    pos_background_width || null, pos_background_height || null,
                    (pos_background_opacity !== undefined && pos_background_opacity !== null) ? pos_background_opacity : 0.1,
                    productAddSoundUrl,
                    show_logo === 'true' || show_logo === true ? 1 : 0,
                    show_bill_logo === 'true' || show_bill_logo === true ? 1 : 0,
                    show_login_logo === 'true' || show_login_logo === true ? 1 : 0,
                    show_pos_background === 'true' || show_pos_background === true ? 1 : 0,
                    show_product_add_sound === 'true' || show_product_add_sound === true ? 1 : 0
                ];
                await db.query(retryQuery, retryValues);
                return res.json({
                    message: 'Settings updated successfully (after migration)',
                    logo_url: logoUrl,
                    bill_logo_url: billLogoUrl,
                    login_logo_url: loginLogoUrl,
                    pos_background_url: posBackgroundUrl,
                    product_add_sound_url: productAddSoundUrl
                });
            } catch (retryErr) {
                console.error('[LazyMigrate] Retry failed:', retryErr);
            }
        }

        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /api/settings/messaging
router.get('/messaging', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM messaging_settings WHERE id = 1');
        res.json(rows[0] || {});
    } catch (e) {
        if (e.errno === 1146 || e.errno === 1054) {
            console.log('[LazyMigrate] Detected missing messaging_settings table or column. Running auto-migrate...');
            try {
                await checkAndMigrate();
                const [rows] = await db.query('SELECT * FROM messaging_settings WHERE id = 1');
                return res.json(rows[0] || {});
            } catch (retryErr) {
                console.error('[LazyMigrate] Failed:', retryErr);
            }
        }
        res.status(500).json({ error: e.message });
    }
});

// POST /api/settings/messaging
router.post('/messaging', verifyToken, async (req, res) => {
    const {
        baileys_enabled, whatshub_enabled, default_provider, whatshub_api_key,
        override_invoices, override_bills, override_bulk, override_marketing, override_sync
    } = req.body;

    const query = `
        UPDATE messaging_settings SET 
            baileys_enabled = ?, whatshub_enabled = ?, default_provider = ?, 
            whatshub_api_key = ?, override_invoices = ?, override_bills = ?, 
            override_bulk = ?, override_marketing = ?, override_sync = ?
        WHERE id = 1
    `;
    const values = [
        baileys_enabled ? 1 : 0, whatshub_enabled ? 1 : 0, default_provider || 'baileys',
        whatshub_api_key || null, override_invoices || null, override_bills || null,
        override_bulk || null, override_marketing || null, override_sync || null
    ];

    try {
        await db.query(query, values);
        res.json({ success: true });
    } catch (e) {
        if (e.errno === 1146 || e.errno === 1054) {
            console.log('[LazyMigrate] Detected missing messaging_settings table or column on UPDATE. Running auto-migrate...');
            try {
                await checkAndMigrate();
                await db.query(query, values);
                return res.json({ success: true });
            } catch (retryErr) {
                console.error('[LazyMigrate] Retry failed:', retryErr);
            }
        }
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
