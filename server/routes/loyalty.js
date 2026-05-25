const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// --- SETTINGS ---

// Get Settings
router.get('/settings', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM loyalty_settings LIMIT 1');
        if (rows.length === 0) {
            return res.json({
                is_active: 0,
                earn_type: 'fixed',
                earn_rate_amount: 100,
                earn_rate_points: 1,
                earn_rate_percent: 0,
                redeem_rate_points: 1,
                redeem_rate_amount: 1
            });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update Settings
router.put('/settings', verifyToken, async (req, res) => {
    const {
        is_active,
        earn_type,
        earn_rate_amount,
        earn_rate_points,
        earn_rate_percent,
        redeem_rate_points,
        redeem_rate_amount,
        minimum_redeem_points,
        max_redeem_percent
    } = req.body;

    try {
        await db.query(`
            UPDATE loyalty_settings SET 
            is_active=?, 
            earn_type=?,
            earn_rate_amount=?, 
            earn_rate_points=?, 
            earn_rate_percent=?,
            redeem_rate_points=?, 
            redeem_rate_amount=?, 
            min_redeem_points=?, 
            max_redeem_percent=?
            WHERE id = (SELECT id FROM (SELECT id FROM loyalty_settings LIMIT 1) as sub)
        `, [
            is_active,
            earn_type || 'fixed',
            earn_rate_amount || 0,
            parseFloat(earn_rate_points) || 0,
            earn_rate_percent || 0,
            parseFloat(redeem_rate_points) || 0,
            redeem_rate_amount,
            minimum_redeem_points || 0,
            max_redeem_percent || 100
        ]);
        res.json({ message: 'Settings updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- CARDS ---

// Issue Card
router.post('/cards/issue', verifyToken, async (req, res) => {
    const { customer_id, card_number } = req.body;
    if (!customer_id || !card_number) return res.status(400).json({ message: 'Missing fields' });

    try {
        await db.query('INSERT INTO loyalty_cards (customer_id, card_number) VALUES (?, ?)', [customer_id, card_number]);
        res.json({ message: 'Card issued successfully' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Card number already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Lookup Customer by Card
router.get('/cards/:number', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.*, lc.status as card_status 
            FROM loyalty_cards lc
            JOIN customers c ON lc.customer_id = c.id
            WHERE lc.card_number = ?
        `, [req.params.number]);

        if (rows.length === 0) return res.status(404).json({ message: 'Card not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- HISTORY ---

// Get Customer Loyalty Ledger
router.get('/customer/:id/history', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT * FROM loyalty_ledger 
            WHERE customer_id = ? 
            ORDER BY created_at DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- CATEGORY RULES ---

// Get all rules
router.get('/rules', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.*, c.name as category_name, s.name as subcategory_name
            FROM loyalty_category_rules r 
            JOIN categories c ON r.category_id = c.id
            LEFT JOIN subcategories s ON r.subcategory_id = s.id
            ORDER BY c.name, s.name
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add/Update Rule
router.post('/rules', verifyToken, async (req, res) => {
    const { category_id, subcategory_id, earn_type, earn_rate_amount, earn_rate_points, earn_rate_percent } = req.body;
    try {
        // Note: ON DUPLICATE KEY UPDATE might behave unexpectedly if unique index isn't updated for subcategory_id.
        // Assuming we rely on a new unique index OR application logic. 
        // For simplicity in this rapid dev, let's just INSERT and if fails (due to index), handle it? 
        // Actually best to try UPDATE first, if 0 rows, then INSERT.

        // Check if rule exists
        let queryCheck = 'SELECT id FROM loyalty_category_rules WHERE category_id = ? AND (subcategory_id = ? OR (subcategory_id IS NULL AND ? IS NULL))';
        const [existing] = await db.query(queryCheck, [category_id, subcategory_id || null, subcategory_id || null]);

        if (existing.length > 0) {
            await db.query(`
                UPDATE loyalty_category_rules SET
                earn_type = ?, earn_rate_amount = ?, earn_rate_points = ?, earn_rate_percent = ?, is_active = TRUE
                WHERE id = ?
            `, [earn_type || 'fixed', earn_rate_amount || 0, parseFloat(earn_rate_points) || 0, earn_rate_percent || 0, existing[0].id]);
        } else {
            await db.query(`
                INSERT INTO loyalty_category_rules (category_id, subcategory_id, earn_type, earn_rate_amount, earn_rate_points, earn_rate_percent)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [category_id, subcategory_id || null, earn_type || 'fixed', earn_rate_amount || 0, parseFloat(earn_rate_points) || 0, earn_rate_percent || 0]);
        }
        res.json({ message: 'Rule saved successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete Rule
router.delete('/rules/:id', verifyToken, async (req, res) => {
    try {
        await db.query('DELETE FROM loyalty_category_rules WHERE id = ?', [req.params.id]);
        res.json({ message: 'Rule deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
