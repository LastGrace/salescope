const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Get all products
// Get all products (Paginated & Filtered)
router.get('/', verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const category = req.query.category || '';

        const isLite = req.query.lite === 'true';

        let query;
        if (isLite) {
            // Light fetch for POS/Scanner (No joins, minimal fields)
            query = `SELECT id, barcode, name, price, stock_quantity, category FROM products WHERE 1=1`;
        } else {
            // Full fetch for Management
            query = `
                SELECT p.*, s.name as subcategory_name 
                FROM products p 
                LEFT JOIN subcategories s ON p.subcategory_id = s.id 
                WHERE 1=1
            `;
        }
        const params = [];

        if (search) {
            if (isLite) {
                query += ` AND (name LIKE ? OR barcode LIKE ?)`;
            } else {
                query += ` AND (p.name LIKE ? OR p.barcode LIKE ?)`;
            }
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            if (isLite) {
                query += ` AND category = ?`;
            } else {
                query += ` AND p.category = ?`;
            }
            params.push(category);
        }

        // Add sorting and pagination
        if (isLite) {
            query += ` ORDER BY name LIMIT ? OFFSET ?`;
        } else {
            query += ` ORDER BY p.name LIMIT ? OFFSET ?`;
        }
        params.push(limit, offset);

        const [rows] = await db.query(query, params);

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM products p 
            WHERE 1=1
        `;
        const countParams = [];

        if (search) {
            countQuery += ` AND (p.name LIKE ? OR p.barcode LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            countQuery += ` AND p.category = ?`;
            countParams.push(category);
        }

        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            products: rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('GET /products error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get single product by Barcode (for scan)
router.get('/barcode/:barcode', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM products WHERE barcode = ?', [req.params.barcode.toUpperCase()]);
        if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create product (Manager only)
router.post('/', verifyToken, checkPermission('inventory.product.create'), async (req, res) => {
    // ... existing single create logic ...
    console.log('POST /products body:', req.body);
    const { barcode, name, category, subcategory_id, price, cost_price, stock_quantity, low_stock_threshold } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO products (barcode, name, category, subcategory_id, price, cost_price, stock_quantity, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [barcode.toUpperCase(), name, category, subcategory_id || null, price, cost_price || 0, stock_quantity, low_stock_threshold || 10]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (err) {
        console.error('POST /products error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Batch Import Products (Manager only)
router.post('/batch', verifyToken, checkPermission('inventory.import'), async (req, res) => {
    const products = req.body; // Expects array of product objects
    if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: 'Invalid data format' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Cache subcategories to minimize DB calls
        const subMap = new Map(); // "Category:SubName" -> ID


        const [subsWithCats] = await connection.query(`
            SELECT s.id, s.name, c.name as category_name 
            FROM subcategories s 
            JOIN categories c ON s.category_id = c.id
        `);

        subsWithCats.forEach(s => {
            subMap.set(`${s.category_name}:${s.name}`.toLowerCase(), s.id);
        });

        // Also cache categories to create new subcategories correctly
        const [existingCats] = await connection.query('SELECT id, name FROM categories');
        const catMap = new Map(); // "Name" -> ID
        existingCats.forEach(c => catMap.set(c.name.toLowerCase(), c.id));

        for (const p of products) {
            let subId = p.subcategory_id || null; // If ID passed directly
            let catId = null;

            // If subcategory NAME is provided, try to find ID
            if (!subId && p.subcategory && p.category) {
                const key = `${p.category}:${p.subcategory}`.toLowerCase();
                if (subMap.has(key)) {
                    subId = subMap.get(key);
                } else {
                    // Create new subcategory? 
                    // First find category ID
                    const catKey = p.category.toLowerCase();
                    if (catMap.has(catKey)) {
                        catId = catMap.get(catKey);
                    } else {
                        // Create Category
                        const [cRes] = await connection.query('INSERT INTO categories (name) VALUES (?)', [p.category]);
                        catId = cRes.insertId;
                        catMap.set(catKey, catId);
                    }

                    // Create Subcategory
                    const [sRes] = await connection.query('INSERT INTO subcategories (name, category_id) VALUES (?, ?)', [p.subcategory, catId]);
                    subId = sRes.insertId;
                    subMap.set(key, subId);
                }
            }

            // Upsert based on barcode
            await connection.query(`
                INSERT INTO products (barcode, name, category, subcategory_id, price, cost_price, stock_quantity, low_stock_threshold)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                category = VALUES(category),
                subcategory_id = VALUES(subcategory_id),
                price = VALUES(price),
                cost_price = VALUES(cost_price),
                stock_quantity = VALUES(stock_quantity),
                low_stock_threshold = VALUES(low_stock_threshold)
            `, [p.barcode.toUpperCase(), p.name, p.category, subId, p.price, p.cost_price || 0, p.stock_quantity, p.low_stock_threshold || 10]);
        }

        await connection.commit();
        res.json({ message: `Imported ${products.length} products successfully` });
    } catch (err) {
        await connection.rollback();
        console.error('Batch import error:', err);
        res.status(500).json({ message: 'Batch import failed', error: err.message });
    } finally {
        connection.release();
    }
});

// Update product (Manager only)
router.put('/:id', verifyToken, checkPermission('inventory.product.update'), async (req, res) => {
    const { barcode, name, category, subcategory_id, price, cost_price, stock_quantity, low_stock_threshold } = req.body;
    try {
        await db.query(
            'UPDATE products SET barcode=?, name=?, category=?, subcategory_id=?, price=?, cost_price=?, stock_quantity=?, low_stock_threshold=? WHERE id=?',
            [barcode.toUpperCase(), name, category, subcategory_id || null, price, cost_price || 0, stock_quantity, low_stock_threshold, req.params.id]
        );
        res.json({ message: 'Product updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete product (Manager only)
router.delete('/:id', verifyToken, checkPermission('inventory.product.delete'), async (req, res) => {
    try {
        await db.query('DELETE FROM products WHERE id=?', [req.params.id]);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Bulk Delete Products
router.post('/bulk-delete', verifyToken, checkPermission('inventory.product.delete'), async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Invalid or empty IDs list' });
    }

    try {
        await db.query('DELETE FROM products WHERE id IN (?)', [ids]);
        res.json({ message: `${ids.length} products deleted successfully` });
    } catch (err) {
        console.error('Bulk delete products error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Add Stock (Increment Quantity)
router.put('/barcode/:barcode/add-stock', verifyToken, checkPermission('inventory.stock.adjust'), async (req, res) => {
    const { quantity } = req.body;
    const qty = parseInt(quantity);

    if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ message: 'Invalid quantity' });
    }

    try {
        const [result] = await db.query(
            'UPDATE products SET stock_quantity = stock_quantity + ? WHERE barcode = ?',
            [qty, req.params.barcode.toUpperCase()]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });

        res.json({ message: `Stock increased by ${qty}` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update Product Details (Name, Price, etc.) - No Stock Change
router.put('/barcode/:barcode/details', verifyToken, checkPermission('inventory.product.update'), async (req, res) => {
    const { name, category, price, cost_price, low_stock_threshold } = req.body;

    try {
        const [result] = await db.query(
            'UPDATE products SET name=?, category=?, price=?, cost_price=?, low_stock_threshold=? WHERE barcode=?',
            [name, category, price, cost_price || 0, low_stock_threshold || 10, req.params.barcode.toUpperCase()]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });

        res.json({ message: 'Product details updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
