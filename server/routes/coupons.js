const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Helper to generate random code
const generateCode = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

// GET / - List all coupons
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /generate - Batch Generate Coupons
router.post('/generate', verifyToken, checkPermission('coupon.create'), async (req, res) => {
    const {
        count, // How many to generate
        discount_type, discount_value,
        min_order_amount, max_discount_amount,
        start_date, expiry_date, usage_limit,
        target_type, target_value,
        prefix // Optional prefix
    } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const generatedCodes = [];
        const numToGen = parseInt(count) || 1;

        for (let i = 0; i < numToGen; i++) {
            let code = (prefix || '') + generateCode(8);
            // Ensure uniqueness check (simplified, could retry)
            generatedCodes.push(code);

            await connection.query(`
                INSERT INTO coupons 
                (code, discount_type, discount_value, min_order_amount, max_discount_amount, start_date, expiry_date, usage_limit, target_type, target_value)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                code, discount_type, discount_value,
                min_order_amount || 0, max_discount_amount || null,
                start_date || null, expiry_date || null, usage_limit || 1,
                target_type || 'all', target_value ? JSON.stringify(target_value) : null
            ]);
        }

        await connection.commit();
        res.json({ message: `Generated ${numToGen} coupons`, codes: generatedCodes });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// POST /create - Create Single Custom Coupon
router.post('/create', verifyToken, checkPermission('coupon.create'), async (req, res) => {
    const {
        code, description,
        discount_type, discount_value,
        min_order_amount, max_discount_amount,
        start_date, expiry_date, usage_limit,
        target_type, target_value
    } = req.body;

    try {
        await db.query(`
            INSERT INTO coupons 
            (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, start_date, expiry_date, usage_limit, target_type, target_value)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            code.toUpperCase(), description,
            discount_type, discount_value,
            min_order_amount || 0, max_discount_amount || null,
            start_date || null, expiry_date || null, usage_limit || 1,
            target_type || 'all', target_value ? JSON.stringify(target_value) : null
        ]);
        res.json({ message: 'Coupon created successfully' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Coupon code already exists' });
        res.status(500).json({ message: err.message });
    }
});

// POST /validate - Check coupon validity
router.post('/validate', verifyToken, async (req, res) => {
    const { code, cartTotal, cartItems, customerId } = req.body;
    // cartItems: [{ product_id, category_id, subcategory_id, price, quantity, total }]

    try {
        const [rows] = await db.query('SELECT * FROM coupons WHERE code = ?', [code.toUpperCase()]);
        if (rows.length === 0) return res.status(404).json({ message: 'Invalid coupon code' });

        const coupon = rows[0];
        const now = new Date();

        // 1. Basic Checks
        if (coupon.start_date && new Date(coupon.start_date) > now) return res.status(400).json({ message: 'Coupon not yet active' });
        if (coupon.expiry_date && new Date(coupon.expiry_date) < now) return res.status(400).json({ message: 'Coupon expired' });
        if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) return res.status(400).json({ message: 'Coupon usage limit reached' });
        if (coupon.min_order_amount && cartTotal < parseFloat(coupon.min_order_amount)) return res.status(400).json({ message: `Minimum order of ₹${coupon.min_order_amount} required` });

        // 2. Target Validation
        let eligibleAmount = 0;
        let validItems = [];

        if (coupon.target_type === 'all') {
            eligibleAmount = cartTotal;
            validItems = cartItems;
        } else if (['product', 'category', 'subcategory'].includes(coupon.target_type)) {
            const targets = coupon.target_value; // Array of IDs
            // Filter items that match target
            // NOTE: We need cartItems to contain category/subcategory info OR we fetch it here.
            // Assuming frontend sends enriched cartItems or we fetch products.
            // For efficiency, let's assume cartItems has { product_id, category, subcategory_id } or similar.
            // If not, we might need to query DB.
            // Let's query products DB for safety if ids are present.

            const pIds = cartItems.map(i => i.product_id);
            if (pIds.length > 0) {
                const [products] = await db.query('SELECT id, category, subcategory_id FROM products WHERE id IN (?)', [pIds]);
                const pMap = {};
                products.forEach(p => pMap[p.id] = p);

                // Fetch categories to map name->id if needed, but coupon targets stores IDs usually?
                // Wait, our implementation plan said JSON.
                // Re-eval: Frontend sends IDs? Or Names?
                // Let's assume Coupon target_value stores array of IDs (integers).

                // Get Category Map for ID resolution (since product has category NAME)
                const [cats] = await db.query('SELECT id, name FROM categories');
                const catMap = {};
                cats.forEach(c => catMap[c.name] = c.id);

                // Calculate eligible amount
                for (const item of cartItems) {
                    const p = pMap[item.product_id];
                    if (!p) continue;

                    let isMatch = false;
                    if (coupon.target_type === 'product' && targets.includes(p.id)) isMatch = true;
                    if (coupon.target_type === 'category') {
                        const cId = catMap[p.category];
                        if (targets.includes(cId)) isMatch = true;
                    }
                    if (coupon.target_type === 'subcategory' && targets.includes(p.subcategory_id)) isMatch = true;

                    if (isMatch) {
                        eligibleAmount += (item.price * item.quantity);
                        validItems.push(item);
                    }
                }
            }
        } else if (coupon.target_type === 'price_range') {
            const { min, max } = coupon.target_value;
            for (const item of cartItems) {
                if (item.price >= min && item.price <= max) {
                    eligibleAmount += (item.price * item.quantity);
                    validItems.push(item);
                }
            }
        } else if (coupon.target_type === 'customer') {
            const eligibleCustomers = coupon.target_value;
            if (!customerId || !eligibleCustomers.includes(customerId)) {
                return res.status(400).json({ message: 'This coupon is not valid for this customer' });
            }
            eligibleAmount = cartTotal;
        }

        if (eligibleAmount <= 0) return res.status(400).json({ message: 'No eligible items for this coupon' });

        // 3. Calculate Discount
        let discount = 0;
        if (coupon.discount_type === 'percentage') {
            discount = (eligibleAmount * parseFloat(coupon.discount_value)) / 100;
        } else {
            discount = parseFloat(coupon.discount_value);
        }

        // Cap discount
        if (coupon.max_discount_amount && discount > parseFloat(coupon.max_discount_amount)) {
            discount = parseFloat(coupon.max_discount_amount);
        }

        // Ensure discount doesn't exceed total (or eligible amount?) Usually total.
        if (discount > cartTotal) discount = cartTotal;

        res.json({
            valid: true,
            discount: parseFloat(discount.toFixed(2)),
            code: coupon.code,
            coupon_id: coupon.id
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE /:id
router.delete('/:id', verifyToken, checkPermission('coupon.delete'), async (req, res) => {
    try {
        await db.query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
        res.json({ message: 'Coupon deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Bulk Delete Coupons
router.post('/bulk-delete', verifyToken, checkPermission('coupon.delete'), async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Invalid or empty IDs list' });
    }

    try {
        await db.query('DELETE FROM coupons WHERE id IN (?)', [ids]);
        res.json({ message: `${ids.length} coupons deleted successfully` });
    } catch (err) {
        console.error('Bulk delete coupons error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
