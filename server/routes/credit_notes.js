const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// Get ALL Credit Notes (for Management Page)
router.get('/', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT cn.*, c.name as customer_name, c.phone as customer_phone 
            FROM credit_notes cn
            LEFT JOIN customers c ON cn.customer_id = c.id
            ORDER BY cn.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get Credit Note by Code (for validation during POS)
router.get('/:code', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM credit_notes WHERE code = ?', [req.params.code]);
        if (rows.length === 0) return res.status(404).json({ message: 'Invalid Credit Note' });

        const note = rows[0];
        if (new Date(note.expiry_date) < new Date()) {
            return res.status(400).json({ message: 'Credit Note Expired' });
        }
        if (parseFloat(note.balance) <= 0) {
            return res.status(400).json({ message: 'Credit Note has zero balance' });
        }

        res.json(note);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get Credit Notes for a Customer
router.get('/customer/:id', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM credit_notes WHERE customer_id = ? AND balance > 0 AND expiry_date > NOW() ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
