const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Get all POs
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM purchase_orders ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create PO
router.post('/', verifyToken, checkPermission('purchase_order.create'), async (req, res) => {
    // ... existing ...
    const { vendor_name, items } = req.body; // items: [{ product_id, quantity, cost_price }]
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        let total_cost = 0;
        for (const item of items) {
            total_cost += item.cost_price * item.quantity;
        }

        const [poResult] = await connection.query(
            'INSERT INTO purchase_orders (vendor_name, total_cost) VALUES (?, ?)',
            [vendor_name, total_cost]
        );
        const po_id = poResult.insertId;

        // Fetch product info for persistence
        const [prodInfo] = await connection.query('SELECT id, name, barcode FROM products WHERE id IN (?)', [items.map(i => i.product_id)]);
        const prodMap = {};
        prodInfo.forEach(p => prodMap[p.id] = { name: p.name, barcode: p.barcode });

        for (const item of items) {
            const p = prodMap[item.product_id] || { name: 'Unknown', barcode: '' };
            await connection.query(
                'INSERT INTO po_items (po_id, product_id, product_name, barcode, quantity, cost_price) VALUES (?, ?, ?, ?, ?, ?)',
                [po_id, item.product_id, p.name, p.barcode, item.quantity, item.cost_price]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Purchase Order created', po_id });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// Batch Import POs (Flat file: Vendor, Barcode, Qty, Cost)
router.post('/batch', verifyToken, checkPermission('purchase_order.create'), async (req, res) => {
    const rawItems = req.body; // [{ vendor, barcode, quantity, cost }]
    if (!Array.isArray(rawItems) || rawItems.length === 0) return res.status(400).json({ message: 'Invalid data' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get all products to map Barcode -> ID
        const [products] = await connection.query('SELECT id, barcode FROM products');
        const productMap = {};
        products.forEach(p => { if (p.barcode) productMap[p.barcode] = p.id; });

        // 2. Group by Vendor
        const ordersByVendor = {};
        for (const item of rawItems) {
            const pid = productMap[item.barcode];
            if (!pid) continue; // Skip unknown products

            if (!ordersByVendor[item.vendor]) {
                ordersByVendor[item.vendor] = [];
            }
            ordersByVendor[item.vendor].push({
                product_id: pid,
                quantity: parseFloat(item.quantity) || 0,
                cost_price: parseFloat(item.cost) || 0
            });
        }

        // 3. Create POs
        let poCount = 0;
        for (const vendor in ordersByVendor) {
            const items = ordersByVendor[vendor];
            let total = 0;
            items.forEach(i => total += i.quantity * i.cost_price);

            const [res] = await connection.query(
                'INSERT INTO purchase_orders (vendor_name, total_cost) VALUES (?, ?)',
                [vendor, total]
            );
            const poId = res.insertId;

            // Fetch product info for these items
            const [pDet] = await connection.query('SELECT id, name, barcode FROM products WHERE id IN (?)', [items.map(i => i.product_id)]);
            const pDetMap = {};
            pDet.forEach(pd => pDetMap[pd.id] = { name: pd.name, barcode: pd.barcode });

            for (const i of items) {
                const pd = pDetMap[i.product_id] || { name: 'Unknown', barcode: '' };
                await connection.query(
                    'INSERT INTO po_items (po_id, product_id, product_name, barcode, quantity, cost_price) VALUES (?, ?, ?, ?, ?, ?)',
                    [poId, i.product_id, pd.name, pd.barcode, i.quantity, i.cost_price]
                );
            }
            poCount++;
        }

        await connection.commit();
        res.json({ message: `Created ${poCount} Purchase Orders from import` });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// Mark PO as Received (Update Stock)
router.post('/:id/receive', verifyToken, checkPermission('purchase_order.receive'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [po] = await connection.query('SELECT status FROM purchase_orders WHERE id = ?', [req.params.id]);
        if (po.length === 0) throw new Error('PO not found');
        if (po[0].status === 'RECEIVED') throw new Error('PO already received');

        await connection.query('UPDATE purchase_orders SET status = "RECEIVED" WHERE id = ?', [req.params.id]);

        const [items] = await connection.query('SELECT product_id, quantity FROM po_items WHERE po_id = ?', [req.params.id]);

        for (const item of items) {
            await connection.query(
                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        await connection.commit();
        res.json({ message: 'Stock updated from PO' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
