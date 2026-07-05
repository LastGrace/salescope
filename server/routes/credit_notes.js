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

// Get usages (redemption history) for a credit note
router.get('/:id/usages', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT cnu.*, s.id as sale_id, s.total_amount as sale_total_amount, s.created_at as sale_created_at
            FROM credit_note_usage cnu
            JOIN sales s ON cnu.sale_id = s.id
            WHERE cnu.credit_note_id = ?
            ORDER BY cnu.used_at DESC
        `;
        const [rows] = await db.query(query, [req.params.id]);
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
