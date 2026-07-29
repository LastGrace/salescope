const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Helper: Get date ranges
const getRanges = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    return { today, startOfMonth, startOfLastMonth };
};

// GET /api/dashboard/summary - High-level KPIs
router.get('/summary', verifyToken, checkPermission('dashboard.view'), async (req, res) => {
    try {
        const { range = 'this_month', start, end } = req.query;
        let startDate = new Date();
        let endDate = new Date();
        let useExactRange = false;

        if (range === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (range === 'this_month') {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        } else if (range === '30days') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else if (range === '3months') {
            startDate.setMonth(startDate.getMonth() - 3);
        } else if (range === '6months') {
            startDate.setMonth(startDate.getMonth() - 6);
        } else if (range === '1year') {
            startDate.setFullYear(startDate.getFullYear() - 1);
        } else if (range === 'exact' && start && end) {
            startDate = new Date(start);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            useExactRange = true;
        } else {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        }

        const dateQueryParam = useExactRange ? [startDate, endDate] : [startDate];
        const dateWhereClause = useExactRange ? 'created_at >= ? AND created_at <= ?' : 'created_at >= ?';
        const dateWhereClauseDate = useExactRange ? 'date >= ? AND date <= ?' : 'date >= ?';
        const sDateWhereClause = useExactRange ? 's.created_at >= ? AND s.created_at <= ?' : 's.created_at >= ?';

        // Parallel execution for speed
        const [
            salesTotal,
            billsTotal,
            lowStockCount,
            creditResult,
            inventoryValue,
            expensesTotal,
            profitTotal,
            pendingPOs,
            activeCoupons,
            loyaltyLiability,
            returnsTotal,
            deadStockValue,
            itemsTotal
        ] = await Promise.all([
            // Gross Sales
            db.query(`SELECT COALESCE(SUM(total_amount - credit_note_amount), 0) as total FROM sales WHERE ${dateWhereClause}`, dateQueryParam),
            // Bill Count
            db.query(`SELECT COUNT(*) as count FROM sales WHERE ${dateWhereClause}`, dateQueryParam),
            // Low Stock Count
            db.query('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= low_stock_threshold'),
            // Outstanding Credit
            db.query('SELECT COALESCE(SUM(balance), 0) as total FROM credit_notes'),
            // Total Inventory Value
            db.query('SELECT COALESCE(SUM(stock_quantity * cost_price), 0) as total FROM products'),
            // Store Expenses
            db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${dateWhereClauseDate}`, dateQueryParam),
            // Total Profit (Sales Margin - Discounts)
            db.query(`
                SELECT COALESCE(SUM((si.price_at_sale - si.cost_price_at_sale) * si.quantity - si.discount), 0) as total
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                WHERE ${sDateWhereClause}
            `, dateQueryParam),
            // Pending Purchase Orders
            db.query("SELECT COUNT(*) as count FROM purchase_orders WHERE status = 'PENDING'"),
            // Active Coupons
            db.query("SELECT COUNT(*) as count FROM coupons WHERE (expiry_date > NOW() OR expiry_date IS NULL) AND (usage_count < usage_limit OR usage_limit IS NULL)"),
            // Loyalty Points Liability
            db.query(`
                SELECT COALESCE(SUM(c.loyalty_points * COALESCE(ls.redeem_rate_amount / ls.redeem_rate_points, 0)), 0) as total
                FROM customers c
                CROSS JOIN (SELECT redeem_rate_amount, redeem_rate_points FROM loyalty_settings WHERE is_active = 1 LIMIT 1) ls
            `),
            // Returns
            db.query(`SELECT COUNT(*) as count, COALESCE(SUM(total_refund_amount), 0) as total FROM returns WHERE ${dateWhereClause}`, dateQueryParam),
            // Dead Stock Value
            db.query(`
                SELECT COALESCE(SUM(p.stock_quantity * p.cost_price), 0) as total 
                FROM products p
                LEFT JOIN (
                    SELECT DISTINCT si.product_id 
                    FROM sale_items si 
                    JOIN sales s ON si.sale_id = s.id 
                    WHERE ${sDateWhereClause}
                ) sold ON p.id = sold.product_id
                WHERE sold.product_id IS NULL AND p.stock_quantity > 0
            `, dateQueryParam),
            // Items Sold
            db.query(`SELECT COALESCE(SUM(quantity), 0) as total FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE ${sDateWhereClause}`, dateQueryParam)
        ]);

        const sTotal = salesTotal[0][0].total || 0;
        const bTotal = billsTotal[0][0].count || 0;
        const iTotal = itemsTotal[0][0].total || 0;

        res.json({
            sales: sTotal,
            bills: bTotal,
            avg_bill_value: (sTotal / (bTotal || 1)),
            avg_items_per_bill: (iTotal / (bTotal || 1)),
            low_stock_count: lowStockCount[0][0].count || 0,
            outstanding_credit: creditResult[0][0].total || 0,
            inventory_value: inventoryValue[0][0].total || 0,
            expenses: expensesTotal[0][0].total || 0,
            profit: profitTotal[0][0].total || 0,
            net_margin: ((profitTotal[0][0].total || 0) / (sTotal || 1)) * 100,
            pending_pos: pendingPOs[0][0].count || 0,
            active_coupons: activeCoupons[0][0].count || 0,
            loyalty_liability: loyaltyLiability[0][0].total || 0,
            returns: returnsTotal[0][0].total || 0,
            dead_stock_value: deadStockValue[0][0].total || 0
        });

    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({
            message: 'Error processing request',
            error: err.message
        });
    }
});

// GET /api/dashboard/sales-analytics - Detailed Sales Charts
router.get('/sales-analytics', verifyToken, checkPermission('dashboard.view'), async (req, res) => {
    try {
        const { range = '7days', start, end } = req.query;
        let startDate = new Date();
        let endDate = new Date();
        let useExactRange = false;

        if (range === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (range === 'this_month') {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        } else if (range === '30days') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else if (range === '3months') {
            startDate.setMonth(startDate.getMonth() - 3);
        } else if (range === '6months') {
            startDate.setMonth(startDate.getMonth() - 6);
        } else if (range === '1year') {
            startDate.setFullYear(startDate.getFullYear() - 1);
        } else if (range === 'exact' && start && end) {
            startDate = new Date(start);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            useExactRange = true;
        } else {
            startDate.setDate(startDate.getDate() - 7);
        }

        const dateQueryParam = useExactRange ? [startDate, endDate] : [startDate];
        const dateWhereClause = useExactRange ? 'created_at >= ? AND created_at <= ?' : 'created_at >= ?';
        const sDateWhereClause = useExactRange ? 's.created_at >= ? AND s.created_at <= ?' : 's.created_at >= ?';

        // Run all analytics queries in parallel
        const [dailySales, categories, products, atRisk, profitableItems] = await Promise.all([
            // Daily Sales Trend
            db.query(`
                SELECT 
                    DATE(created_at) as date, 
                    SUM(total_amount - credit_note_amount) as total,
                    COUNT(*) as count
                FROM sales 
                WHERE ${dateWhereClause}
                GROUP BY DATE(created_at) 
                ORDER BY date ASC
            `, dateQueryParam),
            // Top Selling Categories (Value)
            db.query(`
                SELECT 
                    p.category as name, 
                    SUM(si.quantity * si.price_at_sale) as value
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                JOIN sales s ON si.sale_id = s.id
                WHERE ${sDateWhereClause}
                GROUP BY p.category
                ORDER BY value DESC
                LIMIT 5
            `, dateQueryParam),
            // Top Selling Products (Qty)
            db.query(`
                SELECT 
                    p.name, 
                    p.barcode,
                    SUM(si.quantity) as qty,
                    SUM(si.quantity * si.price_at_sale) as revenue
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                JOIN sales s ON si.sale_id = s.id
                WHERE ${sDateWhereClause}
                GROUP BY p.id, p.name, p.barcode
                ORDER BY qty DESC
                LIMIT 5
            `, dateQueryParam),
            // At-Risk Loyal Customers (30+ days no visit)
            db.query(`
                SELECT 
                    c.name, 
                    c.phone,
                    c.loyalty_points,
                    MAX(s.created_at) as last_visit,
                    DATEDIFF(NOW(), MAX(s.created_at)) as days_since,
                    COUNT(s.id) as total_bills,
                    SUM(s.total_amount - COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.payment_method = 'credit_note'), 0)) as lifetime_spend
                FROM customers c
                JOIN sales s ON c.id = s.customer_id
                GROUP BY c.id, c.name, c.phone, c.loyalty_points
                HAVING days_since >= 30 AND total_bills >= 3
                ORDER BY total_bills DESC, lifetime_spend DESC
                LIMIT 10
            `),
            // Most Profitable Products (By Margin %)
            db.query(`
                SELECT 
                    p.name,
                    p.barcode,
                    SUM(si.quantity) as total_qty,
                    AVG((si.price_at_sale - si.cost_price_at_sale) / NULLIF(si.price_at_sale, 0) * 100) as avg_margin_percent,
                    SUM((si.price_at_sale - si.cost_price_at_sale) * si.quantity) as total_profit_contribution
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                GROUP BY p.id, p.name, p.barcode
                HAVING total_qty >= 3
                ORDER BY avg_margin_percent DESC
                LIMIT 10
            `)
        ]);

        res.json({
            trend: dailySales[0],
            categories: categories[0],
            top_products: products[0],
            at_risk_customers: atRisk[0],
            profitable_items: profitableItems[0]
        });

    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({
            message: 'Error processing request',
            error: err.message
        });
    }
});

// GET /api/dashboard/inventory-analytics - Stock Insights
router.get('/inventory-analytics', verifyToken, checkPermission('dashboard.view'), async (req, res) => {
    try {
        const { range = '30days', start, end } = req.query;
        let startDate = new Date();
        let endDate = new Date();
        let useExactRange = false;

        if (range === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (range === 'this_month') {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        } else if (range === '7days') {
            startDate.setDate(startDate.getDate() - 7);
        } else if (range === '30days') {
            startDate.setDate(startDate.getDate() - 30);
        } else if (range === '3months') {
            startDate.setMonth(startDate.getMonth() - 3);
        } else if (range === '6months') {
            startDate.setMonth(startDate.getMonth() - 6);
        } else if (range === '1year') {
            startDate.setFullYear(startDate.getFullYear() - 1);
        } else if (range === 'exact' && start && end) {
            startDate = new Date(start);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            useExactRange = true;
        } else {
            startDate.setDate(startDate.getDate() - 30);
        }

        const dateQueryParam = useExactRange ? [startDate, endDate] : [startDate];
        const sDateWhereClause = useExactRange ? 's.created_at >= ? AND s.created_at <= ?' : 's.created_at >= ?';

        // Run all queries in parallel
        const [lowStock, outOfStock, fastMoving] = await Promise.all([
            db.query(`
                SELECT name, barcode, stock_quantity, low_stock_threshold as min_stock_level, price
                FROM products 
                WHERE stock_quantity <= low_stock_threshold 
                ORDER BY stock_quantity ASC 
                LIMIT 10
            `),
            db.query(`
                SELECT COUNT(*) as count FROM products WHERE stock_quantity = 0
            `),
            db.query(`
                SELECT p.name, p.barcode, SUM(si.quantity) as sold
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                JOIN sales s ON si.sale_id = s.id
                WHERE ${sDateWhereClause}
                GROUP BY p.id, p.name, p.barcode
                ORDER BY sold DESC
                LIMIT 5
            `, dateQueryParam)
        ]);

        res.json({
            low_stock_items: lowStock[0],
            out_of_stock_count: outOfStock[0][0].count,
            fast_moving: fastMoving[0]
        });

    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({
            message: 'Error processing request',
            error: err.message
        });
    }
});

// GET /api/dashboard/staff-performance - Employee Metrics
router.get('/staff-performance', verifyToken, checkPermission('dashboard.view'), async (req, res) => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);

        // Sales per Cashier
        const [cashierStats] = await db.query(`
            SELECT 
                u.name, 
                COUNT(*) as bills, 
                SUM(s.total_amount - COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.payment_method = 'credit_note'), 0)) as revenue
            FROM sales s
            JOIN users u ON s.user_id = u.id
            WHERE s.created_at >= ?
            GROUP BY u.id, u.name
            ORDER BY revenue DESC
        `, [startOfMonth]);

        res.json({
            cashiers: cashierStats
        });

    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({
            message: 'Error processing request',
            error: err.message
        });
    }
});

// GET /api/dashboard/customer-analytics - Loyalty & Spenders
router.get('/customer-analytics', verifyToken, checkPermission('dashboard.view'), async (req, res) => {
    try {
        const { range = '30days', start, end } = req.query;
        let startDate = new Date();
        let endDate = new Date();
        let useExactRange = false;

        if (range === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (range === 'this_month') {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        } else if (range === '30days') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else if (range === '3months') {
            startDate.setMonth(startDate.getMonth() - 3);
        } else if (range === '6months') {
            startDate.setMonth(startDate.getMonth() - 6);
        } else if (range === '1year') {
            startDate.setFullYear(startDate.getFullYear() - 1);
        } else if (range === 'exact' && start && end) {
            startDate = new Date(start);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            useExactRange = true;
        } else {
            startDate.setDate(startDate.getDate() - 30);
        }

        const dateQueryParam = useExactRange ? [startDate, endDate] : [startDate];
        const dateWhereClause = useExactRange ? 'created_at >= ? AND created_at <= ?' : 'created_at >= ?';
        const sDateWhereClause = useExactRange ? 's.created_at >= ? AND s.created_at <= ?' : 's.created_at >= ?';

        // Run both queries in parallel
        const [repeatCustomers, topSpenders] = await Promise.all([
            db.query(`
                SELECT 
                    c.id, 
                    c.name, 
                    c.phone,
                    COUNT(s.id) as order_count,
                    SUM(s.total_amount - COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.payment_method = 'credit_note'), 0)) as total_spent
                FROM sales s
                JOIN customers c ON s.customer_id = c.id
                WHERE ${sDateWhereClause}
                GROUP BY c.id, c.name, c.phone
                HAVING order_count > 1
                ORDER BY order_count DESC
                LIMIT 10
            `, dateQueryParam),
            db.query(`
                SELECT 
                    c.id,
                    c.name, 
                    c.phone,
                    COUNT(s.id) as order_count,
                    SUM(s.total_amount - COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.payment_method = 'credit_note'), 0)) as total_spent
                FROM sales s
                JOIN customers c ON s.customer_id = c.id
                WHERE ${sDateWhereClause}
                GROUP BY c.id, c.name, c.phone
                ORDER BY total_spent DESC
                LIMIT 10
            `, dateQueryParam)
        ]);

        res.json({
            repeat_customers: repeatCustomers[0],
            top_spenders: topSpenders[0]
        });

    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({
            message: 'Error processing request',
            error: err.message
        });
    }
});



// GET /api/dashboard/recent-activity - Audit Feed
router.get('/recent-activity', verifyToken, checkPermission('dashboard.view'), async (req, res) => {
    try {
        const [activity] = await db.query(`
            SELECT 
                a.action, 
                a.module, 
                a.details, 
                a.created_at,
                u.name as employee_name
            FROM activity_logs a
            LEFT JOIN users u ON a.employee_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 10
        `);
        res.json(activity);
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({
            message: 'Error processing request',
            error: err.message
        });
    }
});

// GET /api/dashboard/today-activity - Real-time Today's Pulse
router.get('/today-activity', verifyToken, checkPermission('dashboard.view'), async (req, res) => {
    try {
        // Build explicit 24-hour ranges in Node using local IST timezone boundaries
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

        const thirtyDaysAgo = new Date(startOfToday);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Convert exactly to local YYYY-MM-DD HH:MM:SS format suited for MySQL DATETIME comparison
        // to bypass whatever internal @@timezone Windows or the Connection Pool is negotiating.
        const off = now.getTimezoneOffset() * 60000;
        const startTodayStr = new Date(startOfToday.getTime() - off).toISOString().replace('T', ' ').substring(0, 19);
        const endTodayStr = new Date(startOfTomorrow.getTime() - off).toISOString().replace('T', ' ').substring(0, 19);
        const thirtyDaysAgoStr = new Date(thirtyDaysAgo.getTime() - off).toISOString().replace('T', ' ').substring(0, 19);

        const [hourly, payments, trending, todayStats, typicalStats, diag] = await Promise.all([
            // 1. Hourly Traffic Heatmap
            db.query(`
                SELECT 
                    HOUR(created_at) as hour, 
                    SUM(total_amount - COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id = sales.id AND sp.payment_method = 'credit_note'), 0)) as revenue,
                    COUNT(id) as bills
                FROM sales 
                WHERE created_at >= ? AND created_at < ?
                GROUP BY HOUR(created_at)
                ORDER BY hour ASC
            `, [startTodayStr, endTodayStr]),

            // 2. Today's Payment Methods
            db.query(`
                SELECT 
                    sp.payment_method, 
                    SUM(sp.amount) as amount
                FROM sale_payments sp
                JOIN sales s ON sp.sale_id = s.id
                WHERE s.created_at >= ? AND s.created_at < ?
                GROUP BY sp.payment_method
            `, [startTodayStr, endTodayStr]),

            // 3. Real-time Trending Items
            db.query(`
                SELECT 
                    p.name, 
                    p.barcode,
                    SUM(si.quantity) as qty
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                JOIN products p ON si.product_id = p.id
                WHERE s.created_at >= ? AND s.created_at < ?
                GROUP BY p.id
                ORDER BY qty DESC
                LIMIT 3
            `, [startTodayStr, endTodayStr]),

            // 4. Today's Discount & Checkout Value
            db.query(`
                SELECT 
                    SUM(discount_total) + SUM(coupon_amount) + SUM(loyalty_amount) as total_discount_given,
                    AVG(total_amount - COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id = sales.id AND sp.payment_method = 'credit_note'), 0)) as avg_checkout
                FROM sales
                WHERE created_at >= ? AND created_at < ?
            `, [startTodayStr, endTodayStr]),

            // 5. Typical Average Checkout (Last 30 Days)
            db.query(`
                SELECT AVG(total_amount - COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id = sales.id AND sp.payment_method = 'credit_note'), 0)) as typical_checkout
                FROM sales
                WHERE created_at >= ? AND created_at < ?
            `, [thirtyDaysAgoStr, startTodayStr]),

            // Diagnostic timezone check
            db.query(`SELECT NOW() as n, CURDATE() as c, @@session.time_zone as st, @@global.time_zone as gt`),
            db.query(`SELECT created_at FROM sales ORDER BY created_at DESC LIMIT 1`)
        ]);

        // No filesystem write on API request

        res.json({
            hourly_traffic: hourly[0],
            payment_methods: payments[0],
            trending_items: trending[0],
            discount_impact: todayStats[0][0].total_discount_given || 0,
            avg_checkout_today: todayStats[0][0].avg_checkout || 0,
            typical_checkout: typicalStats[0][0].typical_checkout || 0
        });

    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({
            message: 'Error processing request',
            error: err.message
        });
    }
});

module.exports = router;
