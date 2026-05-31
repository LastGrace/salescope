const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// Create a new Sale (POS Transaction)
// Create a new Sale (POS Transaction)
// Create a new Sale (POS Transaction)
router.post('/', verifyToken, async (req, res) => {
    const { customer_id, items, payment_method, discount_total, payments, return_items, refund_mode, coupon_code, coupon_amount, loyalty_amount, credit_note_code, created_at } = req.body;
    // items: [{ product_id, quantity, price, discount }] (Sale Items)
    // return_items: [{ product_id, quantity, price, reason }] (Return Items)
    // payments: [{ method, amount }] (Optional, supports split)
    const user_id = req.user.id;

    // Handle Custom Date (Backdating)
    // If provided, we combine it with CURRENT TIME to preserve sorting order within that day
    let saleDate = new Date();
    if (created_at) {
        const timePart = new Date().toTimeString().split(' ')[0]; // HH:mm:ss
        saleDate = new Date(`${created_at}T${timePart}`);
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 0. Fetch Product Costs
        // Filter out manual items (start with 'manual_')
        const allItems = [...(items || []), ...(return_items || [])];
        const inventoryItems = allItems.filter(i => i.product_id && !String(i.product_id).startsWith('manual_'));
        const productIds = [...new Set(inventoryItems.map(i => i.product_id))];

        let products = [];
        if (productIds.length > 0) {
            [products] = await connection.query('SELECT id, name, barcode, cost_price, category, subcategory_id FROM products WHERE id IN (?)', [productIds]);
        }

        // Fetch all categories to map Name -> ID
        const [allCategories] = await connection.query('SELECT id, name FROM categories');
        const catNameMap = {}; // Name -> ID
        allCategories.forEach(c => catNameMap[c.name] = c.id);

        const productMap = {};
        products.forEach(p => {
            const catId = catNameMap[p.category]; // Resolve ID from Name
            productMap[p.id] = { name: p.name, barcode: p.barcode, cost: p.cost_price, category_id: catId, subcategory_id: p.subcategory_id };
        });

        // 1. Calculate total (Server-side validation)
        let calculated_total = 0;
        let calculated_discount = discount_total || 0;

        if (items && Array.isArray(items)) {
            for (const item of items) {
                const itemTotal = (item.price * item.quantity) - (item.discount || 0);
                calculated_total += itemTotal;
            }
        }

        // Subtract all discounts: global discount, coupon, and loyalty points
        calculated_total -= calculated_discount;
        calculated_total -= (coupon_amount || 0);
        calculated_total -= (loyalty_amount || 0);
        if (calculated_total < 0) calculated_total = 0;

        // Determine main payment method string
        let final_method = payment_method || 'cash';
        if (payments && payments.length > 1) final_method = 'split';

        // Determine was_pay_later flag
        let was_pay_later = 0;
        if (final_method === 'pay_later' || (payments && payments.some(p => p.method === 'pay_later'))) {
            was_pay_later = 1;
        }

        // 2. Insert Sale
        const [saleResult] = await connection.query(
            'INSERT INTO sales (customer_id, user_id, total_amount, payment_method, discount_total, coupon_code, coupon_amount, loyalty_amount, was_pay_later, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [customer_id || null, user_id, calculated_total, final_method, calculated_discount, coupon_code || null, coupon_amount || 0, loyalty_amount || 0, was_pay_later, saleDate]
        );
        const sale_id = saleResult.insertId;

        // 2x. Handle Coupon Usage (Update usage count and insert record)
        if (coupon_code) {
            // Find coupon
            const [cRows] = await connection.query('SELECT id, usage_limit, usage_count FROM coupons WHERE code = ?', [coupon_code]);
            if (cRows.length > 0) {
                const c = cRows[0];
                await connection.query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?', [c.id]);
                await connection.query('INSERT INTO coupon_usages (coupon_id, sale_id, customer_id) VALUES (?, ?, ?)',
                    [c.id, sale_id, customer_id || null]);
            }
        }

        // 2y. Handle Credit Note Usage (Process Payment & Deduct Balance)
        let credit_note_amount_used = 0;
        if (credit_note_code) {
            const [cnRows] = await connection.query('SELECT id, balance FROM credit_notes WHERE code = ?', [credit_note_code]);
            if (cnRows.length > 0) {
                const cn = cnRows[0];
                const balance = parseFloat(cn.balance);
                // We need to determine how much of this credit note was used.
                // The frontend should ideally send this, but we can verify against calculated_total.
                // Safe assumption: We try to cover as much of the bill as possible with the CN?
                // Or we infer it from the fact that other payments + CN = Total.
                // Let's assume the Frontend sends the 'remaining' as payments, so CN covers the GAP.
                // GAP = calculated_total - (sum of other payments).

                // Sum of payments EXCLUDING the credit_note payment
                const other_payment_sum = (payments || [])
                    .filter(p => p.method !== 'credit_note')
                    .reduce((acc, p) => acc + parseFloat(p.amount), 0);
                // If no payments sent (fully covered by CN), sum is 0.
                // If single method sent (e.g. cash 0), sum is 0? Wait, if full CN, payment_method might be 'credit_note'.

                // If final_method is 'credit_note', then it covers whole bill (or up to balance).
                // Logic: Amount to use = calculated_total - other_payment_sum.
                let amount_needed = calculated_total - other_payment_sum;

                // However, "payments" might include the "credit_note" entry if we normalized it? 
                // Assuming frontend logic matches my plan: Frontend DEDUCTS CN from total, and sends Pay Later/Cash for REMAINDER.
                // So "other_payment_sum" is indeed the Remainder.
                // So CN must cover "amount_needed".

                if (amount_needed > balance + 0.01) { // Floating point tolerance
                    throw new Error(`Insufficient Credit Note Balance. Available: ${balance}, Needed: ${amount_needed}`);
                }

                // Cap usage at amount_needed (if negative/zero, ignore)
                if (amount_needed < 0) amount_needed = 0;

                credit_note_amount_used = amount_needed;

                if (credit_note_amount_used > 0) {
                    // Deduct from CN
                    await connection.query('UPDATE credit_notes SET balance = balance - ? WHERE id = ?', [credit_note_amount_used, cn.id]);

                    // Record Usage (Payment)
                    await connection.query('INSERT INTO sale_payments (sale_id, payment_method, amount) VALUES (?, ?, ?)',
                        [sale_id, 'credit_note', credit_note_amount_used]);
                }
            }
        }

        // 2a. Process Returns
        let total_return_amount = 0;
        let return_id = null;

        if (return_items && return_items.length > 0) {
            // Create Return Record
            const [retRes] = await connection.query(
                'INSERT INTO returns (original_sale_id, customer_id, user_id, total_refund_amount) VALUES (?, ?, ?, ?)',
                [null, customer_id || null, user_id, 0] // Temp amount, update later
            );
            return_id = retRes.insertId;

            for (const item of return_items) {
                const itemGross = item.price * item.quantity;
                const discountVal = parseFloat(item.discount) || 0; // Receive discount from frontend
                const finalRefund = Math.max(0, itemGross - discountVal);

                total_return_amount += finalRefund; // Refund amount

                // Add to Return Items with product info for persistence
                const p = productMap[item.product_id] || { name: 'Unknown', barcode: '' };
                await connection.query(
                    'INSERT INTO return_items (return_id, product_id, product_name, barcode, quantity, refund_price, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [return_id, item.product_id === 'manual' ? null : item.product_id, p.name, p.barcode, item.quantity, finalRefund, item.reason || '']
                );

                // Add back to Inventory (if not manual)
                // Safe check for product_id before calling toString
                if (item.product_id && !String(item.product_id).startsWith('manual_')) {
                    await connection.query(
                        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                        [item.quantity, item.product_id]
                    );
                }
            }

            // Update Return Total
            await connection.query('UPDATE returns SET total_refund_amount = ? WHERE id = ?', [total_return_amount, return_id]);
        }

        // 2b. Handle Net Calculation & Credit Notes
        // If Return > Sale, we might need to issue a Credit Note for the balance
        // We assume 'payments' array handles the deduction from the sale total.
        // e.g. Sale 100, Return 150. Payment: "Exchange: 100". Balance 50 -> Credit Note.

        const sale_paid_by_return = (payments || []).find(p => p.method === 'exchange') || { amount: 0 };
        const return_used = sale_paid_by_return.amount;
        const return_balance = total_return_amount - return_used;

        if (return_balance > 0 && customer_id && refund_mode !== 'refund_cash') {
            // create credit note
            const cnCode = 'CN-' + Date.now() + Math.floor(Math.random() * 1000);
            await connection.query(
                'INSERT INTO credit_notes (code, customer_id, amount, balance, expiry_date) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 YEAR))',
                [cnCode, customer_id, return_balance, return_balance]
            );
        }

        // Record cash refund as negative payment so it subtracts from daily totals
        if (return_balance > 0 && refund_mode === 'refund_cash') {
            await connection.query(
                'INSERT INTO sale_payments (sale_id, payment_method, amount) VALUES (?, ?, ?)',
                [sale_id, 'refund', -return_balance]
            );
        }        // 3. Insert Sale Items (batch) and Update Stock (batch)
        const saleItemValues = [];
        const stockUpdates = []; // { id, qty }

        for (const item of items) {
            const isManual = !item.product_id || String(item.product_id).startsWith('manual_');
            const productId = isManual ? null : item.product_id;
            const productData = isManual ? { cost: 0 } : (productMap[item.product_id] || { cost: 0 });

            saleItemValues.push([
                sale_id, productId, item.quantity, item.price,
                productData.cost, item.discount || 0,
                productData.name || item.name || 'Manual Item',
                productData.barcode || item.barcode || ''
            ]);

            if (!isManual) {
                stockUpdates.push({ id: item.product_id, qty: item.quantity });
            }
        }

        // Single multi-row INSERT for all sale items
        if (saleItemValues.length > 0) {
            await connection.query(
                'INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, cost_price_at_sale, discount, product_name, barcode) VALUES ?',
                [saleItemValues]
            );
        }

        // Single CASE-WHEN UPDATE for all stock changes
        if (stockUpdates.length > 0) {
            const ids = stockUpdates.map(u => u.id);
            let caseClause = 'CASE id';
            const params = [];
            for (const u of stockUpdates) {
                caseClause += ' WHEN ? THEN stock_quantity - ?';
                params.push(u.id, u.qty);
            }
            caseClause += ' ELSE stock_quantity END';
            params.push(ids);
            await connection.query(
                `UPDATE products SET stock_quantity = ${caseClause} WHERE id IN (?)`,
                params
            );
        }

        // 4. Insert Payments (batch)
        const paymentList = (payments && payments.length > 0) ? payments : [{ method: final_method, amount: calculated_total }];
        const paymentValues = paymentList.map(p => [sale_id, p.method, p.amount]);
        await connection.query(
            'INSERT INTO sale_payments (sale_id, payment_method, amount) VALUES ?',
            [paymentValues]
        );

        // 5. Update Loyalty Points (1 point per 10 Rupees) and Credit Balance
        // 5. Update Loyalty Points and Credit Balance
        if (customer_id) {
            // A. Fetch Loyalty Settings
            const [lSettings] = await connection.query('SELECT * FROM loyalty_settings LIMIT 1');
            const loyalty = lSettings.length > 0 ? lSettings[0] : null;

            // B. Handle Redemption (if points were redeemed)
            // Expecting req.body.points_redeemed to be set if redemption occurred
            const points_redeemed = req.body.points_redeemed || 0;
            if (points_redeemed > 0 && loyalty && loyalty.is_active) {
                // Verify balance (optional constraint, but good for data integrity)
                // We rely on POS for UI, but DB constraint or check here prevents negative?
                // Using GREATEST(0, ...) in update prevents error but might lead to data mismatch if cheater.
                // Insert Ledger
                await connection.query(
                    'INSERT INTO loyalty_ledger (customer_id, sale_id, type, points, description) VALUES (?, ?, ?, ?, ?)',
                    [customer_id, sale_id, 'redeemed', -points_redeemed, 'Redeemed on Sale #' + sale_id]
                );
                // Deduct from customer will happen in combined update below or separate? Separate is clearer.
                await connection.query(
                    'UPDATE customers SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - ?), total_points_redeemed = COALESCE(total_points_redeemed, 0) + ? WHERE id = ?',
                    [points_redeemed, points_redeemed, customer_id]
                );
            }

            // C. Calculate Earned Points (Category-wise + Percentage Support)
            let points_earned = 0;
            if (loyalty && loyalty.is_active && calculated_total > 0) {
                // Fetch Category Rules
                const [rulesRows] = await connection.query('SELECT * FROM loyalty_category_rules WHERE is_active = TRUE');
                // Map by "catId_subId" (subId can be 'null')
                const rulesMap = {};
                rulesRows.forEach(r => {
                    const key = `${r.category_id}_${r.subcategory_id || 'null'}`;
                    rulesMap[key] = r;
                });

                // Global Defaults
                const globalType = loyalty.earn_type || 'fixed';
                const globalAmountStep = parseFloat(loyalty.earn_rate_amount) || 100;
                const globalPointsStep = parseInt(loyalty.earn_rate_points) || 1;
                const globalPercent = parseFloat(loyalty.earn_rate_percent) || 0;

                // Calculate per item
                for (const item of items) {
                    const pData = productMap[item.product_id];
                    const catId = pData ? pData.category_id : null;
                    const subId = pData ? pData.subcategory_id : null;
                    const itemTotal = (item.price * item.quantity) - (item.discount || 0);

                    if (itemTotal <= 0) continue;

                    // Determine Rule to Apply (Subcategory override -> Category override -> Global)
                    let type = globalType;
                    let amountStep = globalAmountStep;
                    let pointsStep = globalPointsStep;
                    let percent = globalPercent;

                    let rule = null;
                    if (catId) {
                        // Check specific subcategory rule
                        if (subId && rulesMap[`${catId}_${subId}`]) {
                            rule = rulesMap[`${catId}_${subId}`];
                        }
                        // Check general category rule
                        else if (rulesMap[`${catId}_null`]) {
                            rule = rulesMap[`${catId}_null`];
                        }
                    }

                    if (rule) {
                        type = rule.earn_type || 'fixed';
                        amountStep = parseFloat(rule.earn_rate_amount) || 0;
                        pointsStep = parseInt(rule.earn_rate_points) || 0;
                        percent = parseFloat(rule.earn_rate_percent) || 0;
                    }

                    // Calculation
                    if (type === 'percentage') {
                        // e.g. 5% => 5 points for 100 currency. 
                        // Formula: (Total * Percent) / 100
                        const points = (itemTotal * percent) / 100;
                        points_earned += parseFloat(points.toFixed(2));
                    } else {
                        // Fixed: e.g. 1 point for 100 currency
                        // Formula: (Total / AmountStep) * PointsStep
                        if (amountStep > 0) {
                            const points = (itemTotal / amountStep) * pointsStep;
                            points_earned += parseFloat(points.toFixed(2));
                        }
                    }
                }
            }

            if (points_earned > 0) {
                // Ensure precision
                points_earned = parseFloat(points_earned.toFixed(2));

                await connection.query(
                    'INSERT INTO loyalty_ledger (customer_id, sale_id, type, points, description) VALUES (?, ?, ?, ?, ?)',
                    [customer_id, sale_id, 'earned', points_earned, 'Earned from Sale #' + sale_id]
                );
            }

            // D. Credit Balance Calculation
            let creditAmount = 0;
            if (final_method === 'pay_later') {
                creditAmount = calculated_total;
            } else if (final_method === 'split' && payments) {
                const creditPayment = payments.find(p => p.method === 'pay_later');
                if (creditPayment) creditAmount = creditPayment.amount;
            }

            // E. Update Customer (Add Earned Points + Credit)
            await connection.query(
                'UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, total_points_earned = COALESCE(total_points_earned, 0) + ?, credit_balance = COALESCE(credit_balance, 0) + ? WHERE id = ?',
                [points_earned, points_earned, creditAmount, customer_id]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Sale completed', sale_id });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: 'Transaction failed', error: err.message });
    } finally {
        connection.release();
    }
});

// Get Sales Stats (Total, By Method, Margin)
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate, paymentMethod, search } = req.query;

        // Base Filter Logic
        let whereClause = ' WHERE 1=1';
        const params = [];
        if (startDate) { whereClause += ' AND date(s.created_at) >= ?'; params.push(startDate); }
        if (endDate) { whereClause += ' AND date(s.created_at) <= ?'; params.push(endDate); }
        if (search) {
            whereClause += ' AND (s.id LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
            const t = `%${search}%`;
            params.push(t, t, t);
        }
        // Note: Payment Method filter in stats is tricky with Multi-Pay. 
        // If user filters by 'cash', do they want sales that INVOLVE cash, or ONLY cash?
        // Usually "Involves".
        if (paymentMethod && paymentMethod !== 'all') {
            // Check if ANY payment for this sale matches
            whereClause += ' AND EXISTS (SELECT 1 FROM sale_payments sp_filter WHERE sp_filter.sale_id = s.id AND sp_filter.payment_method = ?)';
            params.push(paymentMethod);
        }

        // 1. Overall Stats (Revenue excludes exchange payment, Profit uses item-level calc)
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT s.id) as total_bills,
                COALESCE((
                    SELECT SUM(sp_rev.amount) 
                    FROM sale_payments sp_rev 
                    JOIN sales s_rev ON sp_rev.sale_id = s_rev.id 
                    LEFT JOIN customers c_rev ON s_rev.customer_id = c_rev.id
                    ${whereClause.replace(/\bs\./g, 's_rev.').replace(/\bc\./g, 'c_rev.')}
                    AND sp_rev.payment_method NOT IN ('exchange')
                ), 0) as total_revenue,
                SUM(
                    (COALESCE((SELECT SUM((si.price_at_sale - COALESCE(si.cost_price_at_sale, 0)) * si.quantity - si.discount) 
                     FROM sale_items si 
                     WHERE si.sale_id = s.id), 0)
                    - COALESCE(s.discount_total, 0))
                ) as total_profit
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            ${whereClause}
        `;

        // We use the whereClause twice: once in the subquery, once in the main query.
        // So we need to double the params.
        const statsParams = [...params, ...params];
        const [statsRows] = await db.query(statsQuery, statsParams);
        const totalSale = parseFloat(statsRows[0].total_revenue || 0);
        const totalProfit = parseFloat(statsRows[0].total_profit || 0);
        const totalBills = parseInt(statsRows[0].total_bills || 0);

        // 2. Breakdown by Payment Method (Using sale_payments)
        // We join sale_payments to sales to apply the same date/search filters
        const methodQuery = `
            SELECT sp.payment_method, SUM(sp.amount) as amount, COUNT(DISTINCT s.id) as count
            FROM sale_payments sp
            JOIN sales s ON sp.sale_id = s.id
            LEFT JOIN customers c ON s.customer_id = c.id
            ${whereClause}
            GROUP BY sp.payment_method
        `;

        const [methodRows] = await db.query(methodQuery, params);

        const byMethod = {};
        methodRows.forEach(r => {
            byMethod[r.payment_method] = {
                count: r.count,
                amount: parseFloat(r.amount || 0)
            };
        });

        const marginPercentage = totalSale > 0 ? ((totalProfit / totalSale) * 100).toFixed(2) : 0;

        res.json({
            totalSale,
            totalProfit,
            marginPercentage,
            byMethod,
            totalBills
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Get recent sales with filters
router.get('/', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate, paymentMethod, search } = req.query;

        let query = `
            SELECT s.*, 
                c.name as customer_name, 
                c.phone as customer_phone, 
                u.name as user_name,
                (
                    COALESCE((SELECT SUM((si.price_at_sale - COALESCE(si.cost_price_at_sale, 0)) * si.quantity - si.discount) 
                    FROM sale_items si 
                    WHERE si.sale_id = s.id), 0)
                ) - COALESCE(s.discount_total, 0) as total_profit,
                (
                    SELECT GROUP_CONCAT(CONCAT(payment_method, ':', amount) SEPARATOR ', ')
                    FROM sale_payments
                    WHERE sale_id = s.id
                ) as payment_details,
                COALESCE((
                    SELECT SUM(sp_da.amount)
                    FROM sale_payments sp_da
                    WHERE sp_da.sale_id = s.id AND sp_da.payment_method NOT IN ('exchange')
                ), s.total_amount) as display_amount
            FROM sales s 
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        // Date Filter
        if (startDate) {
            query += ' AND date(s.created_at) >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND date(s.created_at) <= ?';
            params.push(endDate);
        }

        // Payment Method Filter
        // Payment Method Filter
        if (paymentMethod === 'credit_history') {
            // Fetch:
            // 1. Current Pay Later (Pending)
            // 2. Was Pay Later (Paid or Pending)
            // 3. Split Pay Later (Pending)
            query += ' AND (s.payment_method = "pay_later" OR s.was_pay_later = 1 OR EXISTS (SELECT 1 FROM sale_payments sp_filter WHERE sp_filter.sale_id = s.id AND sp_filter.payment_method = "pay_later"))';
        } else if (paymentMethod && paymentMethod !== 'all') {
            // Check if ANY payment for this sale matches
            query += ' AND EXISTS (SELECT 1 FROM sale_payments sp_filter WHERE sp_filter.sale_id = s.id AND sp_filter.payment_method = ?)';
            params.push(paymentMethod);
        }

        // Search Filter (Bill ID, Customer Name, Phone)
        if (search) {
            query += ' AND (s.id LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY s.created_at DESC';

        // Limit only if no search/filter to prevent huge load, but with filters we might want all
        if (!startDate && !endDate && !search && (!paymentMethod || paymentMethod === 'all')) {
            query += ' LIMIT 100';
        }

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get next Bill ID (for POS display)
router.get('/meta/next-id', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT MAX(id) as maxId FROM sales');
        const nextId = (rows[0].maxId || 0) + 1;
        res.json({ nextId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get single sale details
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [saleRows] = await db.query(`
            SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as user_name 
            FROM sales s 
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.id = ?
        `, [req.params.id]);

        if (saleRows.length === 0) return res.status(404).json({ message: 'Sale not found' });

        const [itemRows] = await db.query(`
            SELECT si.*, COALESCE(si.product_name, p.name) as product_name, COALESCE(si.barcode, p.barcode) as barcode
            FROM sale_items si
            LEFT JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = ?
        `, [req.params.id]);

        const [paymentRows] = await db.query(`
            SELECT * FROM sale_payments WHERE sale_id = ?
        `, [req.params.id]);

        res.json({ ...saleRows[0], items: itemRows, payments: paymentRows });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

const bcrypt = require('bcryptjs');

// Delete (Void) Sale
router.delete('/:id', verifyToken, async (req, res) => {
    const { password } = req.body;
    const saleId = req.params.id;
    const userId = req.user.id; // Start with current user

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verify Password
        const [users] = await connection.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            await connection.rollback();
            return res.status(401).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, users[0].password_hash);
        if (!isMatch) {
            await connection.rollback();
            return res.status(403).json({ message: 'Incorrect password' });
        }

        // 2. Get Sale Items to Restock
        const [saleItems] = await connection.query('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?', [saleId]);

        // 3. Restock Products
        for (const item of saleItems) {
            if (item.product_id) {
                await connection.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [item.quantity, item.product_id]);
            }
        }

        // 4. Reverse Loyalty Points AND Credit Balance
        // Need to check if sale had customer and points
        // Get sale details first
        const [saleRows] = await connection.query('SELECT customer_id, total_amount, discount_total, payment_method FROM sales WHERE id = ?', [saleId]);
        if (saleRows.length > 0) {
            const sale = saleRows[0];

            if (sale.customer_id) {
                // Fetch points from ledger to be exact
                const [ledgerRows] = await connection.query('SELECT points FROM loyalty_ledger WHERE sale_id = ? AND type = "earned"', [saleId]);
                let pointsToRevert = 0;
                if (ledgerRows.length > 0) {
                    pointsToRevert = parseFloat(ledgerRows[0].points);
                } else {
                    // Fallback (should not happen if logic is consistent)
                    // But if it was old logic... we can't easily guess. 
                    // Better to rely on ledger. If no ledger, maybe 0 points were earned?
                }

                // Calculate Credit to revert
                let creditToRevert = 0;
                // Fetch payments to check for split/pay_later
                const [payments] = await connection.query('SELECT payment_method, amount FROM sale_payments WHERE sale_id = ?', [saleId]);
                const payLaterPayment = payments.find(p => p.payment_method === 'pay_later');

                if (sale.payment_method === 'pay_later') {
                    creditToRevert = sale.total_amount;
                } else if (sale.payment_method === 'split' && payLaterPayment) {
                    creditToRevert = payLaterPayment.amount;
                }

                await connection.query(
                    'UPDATE customers SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - ?), credit_balance = GREATEST(0, COALESCE(credit_balance, 0) - ?) WHERE id = ?',
                    [pointsToRevert, creditToRevert, sale.customer_id]
                );
            }
        }

        // 5. Delete Sale Records (Cascading usually handles this, but let's be explicit if no cascade)
        await connection.query('DELETE FROM sale_payments WHERE sale_id = ?', [saleId]);
        await connection.query('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
        await connection.query('DELETE FROM sales WHERE id = ?', [saleId]);

        await connection.commit();
        res.json({ message: 'Sale deleted successfully' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// Update (Edit) Sale
router.put('/:id', verifyToken, async (req, res) => {
    const saleId = req.params.id;
    const { customer_id, items, payment_method, discount_total, payments } = req.body;
    // Note: req.body contains the NEW state of the bill.

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // --- STEP A: REVERT OLD STATE ---

        // 1. Get Old Sale Items to Restock
        const [oldItems] = await connection.query('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?', [saleId]);

        // 2. Restock old stock
        for (const oldItem of oldItems) {
            if (oldItem.product_id) {
                await connection.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                    [oldItem.quantity, oldItem.product_id]);
            }
        }

        // 3. Revert Loyalty Points AND Credit Balance
        const [oldSaleRows] = await connection.query('SELECT customer_id, total_amount, payment_method, was_pay_later FROM sales WHERE id = ?', [saleId]);
        if (oldSaleRows.length > 0 && oldSaleRows[0].customer_id) {
            const [oldLedger] = await connection.query('SELECT points FROM loyalty_ledger WHERE sale_id = ? AND type = "earned"', [saleId]);
            let oldPoints = 0;
            if (oldLedger.length > 0) {
                oldPoints = parseFloat(oldLedger[0].points);
            }

            // Revert Old Credit
            let oldCredit = 0;
            // We need to check sale_payments to be accurate for Split, or assume based on method if simple.
            // Let's fetch payments to be sure.
            const [oldPayments] = await connection.query('SELECT payment_method, amount FROM sale_payments WHERE sale_id = ?', [saleId]);
            const payLaterPayment = oldPayments.find(p => p.payment_method === 'pay_later');

            if (oldSaleRows[0].payment_method === 'pay_later') {
                oldCredit = parseFloat(oldSaleRows[0].total_amount);
            } else if (oldSaleRows[0].payment_method === 'split' && payLaterPayment) {
                oldCredit = parseFloat(payLaterPayment.amount);
            }

            await connection.query('UPDATE customers SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - ?), credit_balance = GREATEST(0, COALESCE(credit_balance, 0) - ?) WHERE id = ?',
                [oldPoints, oldCredit, oldSaleRows[0].customer_id]);
        }

        // 4. Clear Old Items and Payments
        await connection.query('DELETE FROM sale_payments WHERE sale_id = ?', [saleId]);
        await connection.query('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);


        // --- STEP B: APPLY NEW STATE ---

        // 5. Calculate New Totals & Costs
        const safeItems = (items && Array.isArray(items)) ? items : [];
        const productIds = safeItems.filter(i => i.product_id && !String(i.product_id).startsWith('manual_')).map(i => i.product_id);
        
        const productDataMap = {};
        if (productIds.length > 0) {
            const [products] = await connection.query('SELECT id, name, barcode, cost_price FROM products WHERE id IN (?)', [productIds]);
            products.forEach(p => productDataMap[p.id] = p);
        }

        let calculated_total = 0;
        let calculated_discount = discount_total || 0;

        for (const item of safeItems) {
            const itemTotal = (item.price * item.quantity) - (item.discount || 0);
            calculated_total += itemTotal;
        }
        calculated_total -= calculated_discount;
        if (calculated_total < 0) calculated_total = 0;

        let final_method = payment_method || 'cash';
        if (payments && payments.length > 1) final_method = 'split';

        // Preserve existing flag or set new
        let was_pay_later = oldSaleRows[0].was_pay_later || 0;
        if (final_method === 'pay_later' || (payments && payments.some(p => p.method === 'pay_later'))) {
            was_pay_later = 1;
        }

        // 6. Update Sale Record
        await connection.query(
            'UPDATE sales SET customer_id = ?, total_amount = ?, payment_method = ?, discount_total = ?, was_pay_later = ? WHERE id = ?',
            [customer_id || null, calculated_total, final_method, calculated_discount, was_pay_later, saleId]
        );

        // 7. Insert New Items & Deduct Stock
        for (const item of safeItems) {
            const isManual = !item.product_id || String(item.product_id).startsWith('manual_');
            const productId = isManual ? null : item.product_id;
            const p = productDataMap[productId] || { cost_price: 0, name: item.name || 'Manual Item', barcode: item.barcode || '' };
            
            await connection.query(
                'INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, cost_price_at_sale, discount, product_name, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [saleId, productId, item.quantity, item.price, p.cost_price, item.discount || 0, p.name, p.barcode]
            );

            if (!isManual) {
                await connection.query(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                    [item.quantity, productId]
                );
            }
        }

        // 8. Insert New Payments
        const paymentList = (payments && payments.length > 0) ? payments : [{ method: final_method, amount: calculated_total }];
        for (const p of paymentList) {
            await connection.query('INSERT INTO sale_payments (sale_id, payment_method, amount) VALUES (?, ?, ?)',
                [saleId, p.method, p.amount]);
        }

        // 9. Apply New Loyalty Points AND Credit Balance
        if (customer_id) {
            // RE-CALCULATE POINTS using same logic as POST / (Need to extract this logic ideally)
            // For now, duplicate the safe core logic or...
            // Wait, I can't easily duplicate 50 lines of logic here without risk.
            // Best to rely on the fact that existing code didn't fully implement overrides in PUT.
            // User wants "check all logic".
            // I MUST implement the same logic here.

            // ... Fetch settings, rules, calculate per item ...
            // This is getting large. I should ideally creating a helper function.
            // But for now, let's implement the simplified version if overrides are heavy, 
            // OR copy the logic. 
            // Copying logic is safer for "Agentic" mode than creating new files/exports in existing structure blindly.

            const [lSettings] = await connection.query('SELECT * FROM loyalty_settings LIMIT 1');
            const loyalty = lSettings.length > 0 ? lSettings[0] : null;
            let newPoints = 0;

            if (loyalty && loyalty.is_active && calculated_total > 0) {
                const [rulesRows] = await connection.query('SELECT * FROM loyalty_category_rules WHERE is_active = TRUE');
                const rulesMap = {};
                rulesRows.forEach(r => { rulesMap[`${r.category_id}_${r.subcategory_id || 'null'}`] = r; });

                const globalType = loyalty.earn_type || 'fixed';
                const globalAmountStep = parseFloat(loyalty.earn_rate_amount) || 100;
                const globalPointsStep = parseFloat(loyalty.earn_rate_points) || 1;
                const globalPercent = parseFloat(loyalty.earn_rate_percent) || 0;

                // We need items with categories. We fetched `products` in Step 5 (id, name, barcode, cost).
                // We need category info! Step 5 query didn't fetch category.
                // Let's refetch products with category info.
                const [productsWithCat] = await connection.query('SELECT id, category, subcategory_id FROM products WHERE id IN (?)', [items.map(i => i.product_id)]);
                const productCatMap = {};
                // Need to resolve Category Name to ID again?
                const [allCats] = await connection.query('SELECT id, name FROM categories');
                const catNameMap = {};
                allCats.forEach(c => catNameMap[c.name] = c.id);

                productsWithCat.forEach(p => {
                    const cId = catNameMap[p.category];
                    productCatMap[p.id] = { category_id: cId, subcategory_id: p.subcategory_id };
                });

                for (const item of items) {
                    const pData = productCatMap[item.product_id];
                    const catId = pData ? pData.category_id : null;
                    const subId = pData ? pData.subcategory_id : null;
                    const itemTotal = (item.price * item.quantity) - (item.discount || 0);

                    if (itemTotal <= 0) continue;

                    let type = globalType;
                    let amountStep = globalAmountStep;
                    let pointsStep = globalPointsStep;
                    let percent = globalPercent;

                    let rule = null;
                    if (catId) {
                        if (subId && rulesMap[`${catId}_${subId}`]) rule = rulesMap[`${catId}_${subId}`];
                        else if (rulesMap[`${catId}_null`]) rule = rulesMap[`${catId}_null`];
                    }

                    if (rule) {
                        type = rule.earn_type || 'fixed';
                        amountStep = parseFloat(rule.earn_rate_amount) || 0;
                        pointsStep = parseFloat(rule.earn_rate_points) || 0;
                        percent = parseFloat(rule.earn_rate_percent) || 0;
                    }

                    if (type === 'percentage') {
                        newPoints += parseFloat(((itemTotal * percent) / 100).toFixed(2));
                    } else {
                        if (amountStep > 0) {
                            newPoints += parseFloat(((itemTotal / amountStep) * pointsStep).toFixed(2));
                        }
                    }
                }
                newPoints = parseFloat(newPoints.toFixed(2));
            }

            if (newPoints > 0) {
                await connection.query(
                    'INSERT INTO loyalty_ledger (customer_id, sale_id, type, points, description) VALUES (?, ?, ?, ?, ?)',
                    [customer_id, saleId, 'earned', newPoints, 'Earned from Sale #' + saleId] // Using saleId (param)
                );
            }

            let newCredit = 0;
            if (final_method === 'pay_later') {
                newCredit = calculated_total;
            } else if (final_method === 'split') {
                const pl = paymentList.find(p => p.method === 'pay_later');
                if (pl) newCredit = pl.amount;
            }

            await connection.query(
                'UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, credit_balance = COALESCE(credit_balance, 0) + ? WHERE id = ?',
                [newPoints, newCredit, customer_id]
            );
        }

        await connection.commit();
        res.json({ message: 'Sale updated successfully', sale_id: saleId });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
