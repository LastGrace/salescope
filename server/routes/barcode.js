const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// Helper to parse JSON fields safely
const parseJsonField = (field) => {
    if (!field) return null;
    if (typeof field === 'object') return field;
    try {
        return JSON.parse(field);
    } catch (e) {
        return null;
    }
};

// ── PRESETS API ───────────────────────────────────────────────────

// GET /api/barcode/presets - List all presets
router.get('/presets', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM barcode_presets ORDER BY is_default DESC, is_favorite DESC, name ASC');
        const presets = rows.map(r => ({
            ...r,
            page_layout: parseJsonField(r.page_layout),
            canvas_data: parseJsonField(r.canvas_data)
        }));
        res.json(presets);
    } catch (err) {
        console.error('GET /api/barcode/presets error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET /api/barcode/presets/:id - Get single preset details
router.get('/presets/:id', verifyToken, async (req, res) => {
    try {
        if (isNaN(Number(req.params.id))) {
            return res.status(404).json({ message: 'Preset not found' });
        }
        const [rows] = await db.query('SELECT * FROM barcode_presets WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Preset not found' });
        }
        const r = rows[0];
        res.json({
            ...r,
            page_layout: parseJsonField(r.page_layout),
            canvas_data: parseJsonField(r.canvas_data)
        });
    } catch (err) {
        console.error('GET /api/barcode/presets/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/barcode/presets - Create new preset
router.post('/presets', verifyToken, async (req, res) => {
    const { name, category, is_default, is_favorite, label_width, label_height, paper_type, page_layout, canvas_data } = req.body;
    if (!name || !canvas_data) {
        return res.status(400).json({ message: 'Name and canvas_data are required' });
    }

    try {
        if (is_default) {
            await db.query('UPDATE barcode_presets SET is_default = 0');
        }

        const layoutStr = typeof page_layout === 'string' ? page_layout : JSON.stringify(page_layout || {});
        const canvasStr = typeof canvas_data === 'string' ? canvas_data : JSON.stringify(canvas_data || []);

        const [result] = await db.query(`
            INSERT INTO barcode_presets
            (name, category, is_default, is_favorite, label_width, label_height, paper_type, page_layout, canvas_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name,
            category || 'Product Barcode',
            is_default ? 1 : 0,
            is_favorite ? 1 : 0,
            label_width || 50.00,
            label_height || 25.00,
            paper_type || 'thermal',
            layoutStr,
            canvasStr
        ]);

        res.status(201).json({ id: result.insertId, message: 'Preset created successfully' });
    } catch (err) {
        console.error('POST /api/barcode/presets error:', err);
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/barcode/presets/:id - Update preset (or insert if built-in string ID)
router.put('/presets/:id', verifyToken, async (req, res) => {
    const { name, category, is_default, is_favorite, label_width, label_height, paper_type, page_layout, canvas_data } = req.body;

    try {
        if (is_default) {
            await db.query('UPDATE barcode_presets SET is_default = 0');
        }

        const layoutStr = typeof page_layout === 'string' ? page_layout : JSON.stringify(page_layout || {});
        const canvasStr = typeof canvas_data === 'string' ? canvas_data : JSON.stringify(canvas_data || []);

        const isNumericId = !isNaN(Number(req.params.id));

        if (isNumericId) {
            await db.query(`
                UPDATE barcode_presets SET
                name = ?, category = ?, is_default = ?, is_favorite = ?,
                label_width = ?, label_height = ?, paper_type = ?,
                page_layout = ?, canvas_data = ?
                WHERE id = ?
            `, [
                name,
                category || 'Product Barcode',
                is_default ? 1 : 0,
                is_favorite ? 1 : 0,
                label_width,
                label_height,
                paper_type,
                layoutStr,
                canvasStr,
                req.params.id
            ]);

            res.json({ message: 'Preset updated successfully', id: req.params.id });
        } else {
            // Built-in preset with string ID saved by user: create as new custom preset
            const [result] = await db.query(`
                INSERT INTO barcode_presets
                (name, category, is_default, is_favorite, label_width, label_height, paper_type, page_layout, canvas_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                name,
                category || 'Product Barcode',
                is_default ? 1 : 0,
                is_favorite ? 1 : 0,
                label_width || 50.00,
                label_height || 25.00,
                paper_type || 'thermal',
                layoutStr,
                canvasStr
            ]);

            res.json({ message: 'Preset saved successfully as custom preset', id: result.insertId });
        }
    } catch (err) {
        console.error('PUT /api/barcode/presets/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/barcode/presets/:id - Delete preset
router.delete('/presets/:id', verifyToken, async (req, res) => {
    try {
        if (isNaN(Number(req.params.id))) {
            return res.json({ message: 'Built-in preset skipped' });
        }
        await db.query('DELETE FROM barcode_presets WHERE id = ?', [req.params.id]);
        res.json({ message: 'Preset deleted successfully' });
    } catch (err) {
        console.error('DELETE /api/barcode/presets/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/barcode/presets/:id/duplicate - Duplicate preset
router.post('/presets/:id/duplicate', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM barcode_presets WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Preset not found' });

        const original = rows[0];
        const newName = `${original.name} (Copy)`;

        const [result] = await db.query(`
            INSERT INTO barcode_presets
            (name, category, is_default, is_favorite, label_width, label_height, paper_type, page_layout, canvas_data)
            VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?)
        `, [
            newName,
            original.category,
            original.label_width,
            original.label_height,
            original.paper_type,
            typeof original.page_layout === 'string' ? original.page_layout : JSON.stringify(original.page_layout),
            typeof original.canvas_data === 'string' ? original.canvas_data : JSON.stringify(original.canvas_data)
        ]);

        res.status(201).json({ id: result.insertId, message: 'Preset duplicated successfully' });
    } catch (err) {
        console.error('POST /api/barcode/presets/:id/duplicate error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/barcode/presets/:id/default - Toggle / set default preset
router.post('/presets/:id/default', verifyToken, async (req, res) => {
    try {
        await db.query('UPDATE barcode_presets SET is_default = 0');
        await db.query('UPDATE barcode_presets SET is_default = 1 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Default preset updated' });
    } catch (err) {
        console.error('POST /api/barcode/presets/:id/default error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/barcode/presets/:id/favorite - Toggle favorite status
router.post('/presets/:id/favorite', verifyToken, async (req, res) => {
    try {
        await db.query('UPDATE barcode_presets SET is_favorite = NOT is_favorite WHERE id = ?', [req.params.id]);
        res.json({ message: 'Favorite status updated' });
    } catch (err) {
        console.error('POST /api/barcode/presets/:id/favorite error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/barcode/presets/import - Import preset JSON payload
router.post('/presets/import', verifyToken, async (req, res) => {
    const { name, category, label_width, label_height, paper_type, page_layout, canvas_data } = req.body;
    if (!name || !canvas_data) {
        return res.status(400).json({ message: 'Invalid preset JSON payload' });
    }

    try {
        const [result] = await db.query(`
            INSERT INTO barcode_presets
            (name, category, is_default, is_favorite, label_width, label_height, paper_type, page_layout, canvas_data)
            VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?)
        `, [
            name,
            category || 'Imported Preset',
            label_width || 50.00,
            label_height || 25.00,
            paper_type || 'thermal',
            JSON.stringify(page_layout || {}),
            JSON.stringify(canvas_data || [])
        ]);

        res.status(201).json({ id: result.insertId, message: 'Preset imported successfully' });
    } catch (err) {
        console.error('POST /api/barcode/presets/import error:', err);
        res.status(500).json({ message: err.message });
    }
});


// ── PRINTER PROFILES API ──────────────────────────────────────────

// GET /api/barcode/printer-profiles
router.get('/printer-profiles', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM printer_profiles ORDER BY is_default DESC, name ASC');
        res.json(rows);
    } catch (err) {
        console.error('GET /api/barcode/printer-profiles error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/barcode/printer-profiles
router.post('/printer-profiles', verifyToken, async (req, res) => {
    const { name, printer_type, dpi, print_mode, darkness, speed, offset_x, offset_y, feed_direction, page_size, is_default } = req.body;
    if (!name) return res.status(400).json({ message: 'Profile name is required' });

    try {
        if (is_default) {
            await db.query('UPDATE printer_profiles SET is_default = 0');
        }

        const [result] = await db.query(`
            INSERT INTO printer_profiles
            (name, printer_type, dpi, print_mode, darkness, speed, offset_x, offset_y, feed_direction, page_size, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name,
            printer_type || 'thermal',
            dpi || 203,
            print_mode || 'gap',
            darkness || 10,
            speed || 3,
            offset_x || 0,
            offset_y || 0,
            feed_direction || 'normal',
            page_size || 'Custom',
            is_default ? 1 : 0
        ]);

        res.status(201).json({ id: result.insertId, message: 'Printer profile created' });
    } catch (err) {
        console.error('POST /api/barcode/printer-profiles error:', err);
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/barcode/printer-profiles/:id
router.put('/printer-profiles/:id', verifyToken, async (req, res) => {
    const { name, printer_type, dpi, print_mode, darkness, speed, offset_x, offset_y, feed_direction, page_size, is_default } = req.body;

    try {
        if (is_default) {
            await db.query('UPDATE printer_profiles SET is_default = 0');
        }

        await db.query(`
            UPDATE printer_profiles SET
            name = ?, printer_type = ?, dpi = ?, print_mode = ?, darkness = ?,
            speed = ?, offset_x = ?, offset_y = ?, feed_direction = ?,
            page_size = ?, is_default = ?
            WHERE id = ?
        `, [
            name,
            printer_type || 'thermal',
            dpi || 203,
            print_mode || 'gap',
            darkness || 10,
            speed || 3,
            offset_x || 0,
            offset_y || 0,
            feed_direction || 'normal',
            page_size || 'Custom',
            is_default ? 1 : 0,
            req.params.id
        ]);

        res.json({ message: 'Printer profile updated' });
    } catch (err) {
        console.error('PUT /api/barcode/printer-profiles/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/barcode/printer-profiles/:id
router.delete('/printer-profiles/:id', verifyToken, async (req, res) => {
    try {
        await db.query('DELETE FROM printer_profiles WHERE id = ?', [req.params.id]);
        res.json({ message: 'Printer profile deleted' });
    } catch (err) {
        console.error('DELETE /api/barcode/printer-profiles/:id error:', err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/barcode/printer-profiles/:id/default - Set as default printer profile
router.post('/printer-profiles/:id/default', verifyToken, async (req, res) => {
    try {
        await db.query('UPDATE printer_profiles SET is_default = 0');
        await db.query('UPDATE printer_profiles SET is_default = 1 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Default printer profile updated' });
    } catch (err) {
        console.error('POST /api/barcode/printer-profiles/:id/default error:', err);
        res.status(500).json({ message: err.message });
    }
});


// ── BATCH PRODUCT DATA API ──────────────────────────────────────────

// GET /api/barcode/batch-products - Multi-source product retrieval for label printing
router.get('/batch-products', verifyToken, async (req, res) => {
    const { source, category, search, po_id, sale_id, limit = 500 } = req.query;

    try {
        let sql = 'SELECT * FROM products WHERE 1=1';
        const params = [];

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (search) {
            sql += ' AND (name LIKE ? OR barcode LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (po_id) {
            // Fetch items directly from purchase order
            const [poItems] = await db.query(`
                SELECT poi.product_id as id, poi.product_name as name, poi.barcode, poi.quantity as print_qty,
                       p.price, p.cost_price, p.category, p.low_stock_threshold
                FROM po_items poi
                LEFT JOIN products p ON poi.product_id = p.id
                WHERE poi.po_id = ?
            `, [po_id]);
            return res.json(poItems);
        }

        if (sale_id) {
            // Fetch items directly from sale
            const [saleItems] = await db.query(`
                SELECT si.product_id as id, si.product_name as name, si.barcode, si.quantity as print_qty,
                       si.price_at_sale as price, p.cost_price, p.category
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = ?
            `, [sale_id]);
            return res.json(saleItems);
        }

        sql += ' ORDER BY name ASC LIMIT ?';
        params.push(parseInt(limit));

        const [products] = await db.query(sql, params);
        res.json(products);
    } catch (err) {
        console.error('GET /api/barcode/batch-products error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
