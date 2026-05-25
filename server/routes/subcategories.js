const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Get all subcategories (optional ?category_id= filter)
router.get('/', verifyToken, async (req, res) => {
    const { category_id } = req.query;
    try {
        let query = 'SELECT s.*, c.name as category_name FROM subcategories s JOIN categories c ON s.category_id = c.id';
        const params = [];

        if (category_id) {
            query += ' WHERE s.category_id = ?';
            params.push(category_id);
        }

        query += ' ORDER BY s.name';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('GET /subcategories error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Create subcategory (Manager only)
router.post('/', verifyToken, checkPermission('inventory.category.manage'), async (req, res) => {
    const { name, category_id } = req.body;
    if (!name || !category_id) return res.status(400).json({ message: 'Name and Category ID are required' });

    try {
        const [result] = await db.query('INSERT INTO subcategories (name, category_id) VALUES (?, ?)', [name, category_id]);
        res.status(201).json({ id: result.insertId, name, category_id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update subcategory (Manager only)
router.put('/:id', verifyToken, checkPermission('inventory.category.manage'), async (req, res) => {
    const { name, category_id } = req.body;
    if (!name || !category_id) return res.status(400).json({ message: 'Name and Category ID are required' });

    try {
        await db.query('UPDATE subcategories SET name = ?, category_id = ? WHERE id = ?', [name, category_id, req.params.id]);
        res.json({ message: 'Subcategory updated', id: req.params.id, name, category_id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete subcategory (Manager only)
router.delete('/:id', verifyToken, checkPermission('inventory.category.manage'), async (req, res) => {
    try {
        await db.query('DELETE FROM subcategories WHERE id = ?', [req.params.id]);
        res.json({ message: 'Subcategory deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Bulk Delete Subcategories
router.post('/bulk-delete', verifyToken, checkPermission('inventory.category.manage'), async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Invalid or empty IDs list' });
    }

    try {
        await db.query('DELETE FROM subcategories WHERE id IN (?)', [ids]);
        res.json({ message: `${ids.length} subcategories deleted successfully` });
    } catch (err) {
        console.error('Bulk delete subcategories error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
