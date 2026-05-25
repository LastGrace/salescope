const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Get all categories
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
        res.json(rows);
    } catch (err) {
        console.error('GET /categories error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Create category (Manager only)
router.post('/', verifyToken, checkPermission('inventory.category.manage'), async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    try {
        const [result] = await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
        res.status(201).json({ id: result.insertId, name });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Category already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Update category (Manager only)
router.put('/:id', verifyToken, checkPermission('inventory.category.manage'), async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    try {
        await db.query('UPDATE categories SET name = ? WHERE id = ?', [name, req.params.id]);
        res.json({ message: 'Category updated', id: req.params.id, name });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Category name already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Delete category (Manager only)
router.delete('/:id', verifyToken, checkPermission('inventory.category.manage'), async (req, res) => {
    try {
        await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Bulk Delete Categories
router.post('/bulk-delete', verifyToken, checkPermission('inventory.category.manage'), async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Invalid or empty IDs list' });
    }

    try {
        await db.query('DELETE FROM categories WHERE id IN (?)', [ids]);
        res.json({ message: `${ids.length} categories deleted successfully` });
    } catch (err) {
        console.error('Bulk delete categories error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
