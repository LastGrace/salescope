const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// GET all expenses (with filters)
router.get('/', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;
        let query = 'SELECT * FROM expenses WHERE 1=1';
        const params = [];

        if (startDate) { query += ' AND date >= ?'; params.push(startDate); }
        if (endDate) { query += ' AND date <= ?'; params.push(endDate); }
        if (category && category !== 'all') { query += ' AND category = ?'; params.push(category); }

        query += ' ORDER BY date DESC, created_at DESC';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// BATCH POST Expenses (Add multiple rows)
router.post('/batch', verifyToken, async (req, res) => {
    const expenses = req.body; // Array of { date, reason, amount, category }
    if (!Array.isArray(expenses) || expenses.length === 0) {
        return res.status(400).json({ message: 'Invalid payload' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const values = expenses.map(exp => [exp.date, exp.reason, exp.amount, exp.category || 'General']);
        await connection.query(
            'INSERT INTO expenses (date, reason, amount, category) VALUES ?',
            [values]
        );

        await connection.commit();
        res.status(201).json({ message: `Added ${expenses.length} expenses` });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// UPDATE Expense
router.put('/:id', verifyToken, checkPermission('expense.update'), async (req, res) => {
    const { date, reason, amount, category } = req.body;
    try {
        await db.query(
            'UPDATE expenses SET date = ?, reason = ?, amount = ?, category = ? WHERE id = ?',
            [date, reason, amount, category, req.params.id]
        );
        res.json({ message: 'Expense updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE Expense
router.delete('/:id', verifyToken, checkPermission('expense.delete'), async (req, res) => {
    try {
        await db.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
        res.json({ message: 'Expense deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- ANALYTICS ENDPOINTS ---

// GET Analytics Overview (Total Sales, Margin, Stock Purchases, Expenses)
router.get('/analytics', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ message: 'Date range required' });

        const [salesRows, poRows, expRows] = await Promise.all([
            // 1. Total Sales & Margin
            db.query(`
                SELECT 
                    SUM(s.total_amount) as total_sales,
                    SUM(
                        (COALESCE((SELECT SUM((si.price_at_sale - COALESCE(si.cost_price_at_sale, 0)) * si.quantity - si.discount) 
                         FROM sale_items si 
                         WHERE si.sale_id = s.id), 0)
                        - COALESCE(s.discount_total, 0))
                    ) as total_margin
                FROM sales s 
                WHERE s.created_at >= ? AND s.created_at < ? + INTERVAL 1 DAY
            `, [startDate, endDate]),
            // 2. Total Stock Purchases
            db.query(`
                SELECT SUM(total_cost) as total_purchases 
                FROM purchase_orders 
                WHERE created_at >= ? AND created_at < ? + INTERVAL 1 DAY
            `, [startDate, endDate]),
            // 3. Total Expenses
            db.query(`
                SELECT SUM(amount) as total_expenses 
                FROM expenses 
                WHERE date >= ? AND date <= ?
            `, [startDate, endDate])
        ]);

        const totalSales = parseFloat(salesRows[0][0].total_sales || 0);
        const totalMargin = parseFloat(salesRows[0][0].total_margin || 0);
        const totalpurchases = parseFloat(poRows[0][0].total_purchases || 0);
        const totalExpenses = parseFloat(expRows[0][0].total_expenses || 0);

        res.json({
            sales: totalSales,
            margin: totalMargin,
            purchases: totalpurchases,
            expenses: totalExpenses,
            net_profit: totalMargin - totalExpenses
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// GET Daily Report (For Excel-like Table)
router.get('/daily-report', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Logic: Generate range of dates, left join data? 
        // Or just fetch all data grouped by date and merge in JS. Merging in JS is easier for heterogeneous sources.

        // Run both queries in parallel
        const [[salesRows], [expRows]] = await Promise.all([
            db.query(`
                SELECT 
                    DATE(s.created_at) as date,
                    SUM(s.total_amount) as sales,
                    SUM(
                        (COALESCE((SELECT SUM((si.price_at_sale - COALESCE(si.cost_price_at_sale, 0)) * si.quantity - si.discount) 
                         FROM sale_items si 
                         WHERE si.sale_id = s.id), 0)
                        - COALESCE(s.discount_total, 0))
                    ) as margin
                FROM sales s
                WHERE s.created_at >= ? AND s.created_at < ? + INTERVAL 1 DAY
                GROUP BY DATE(s.created_at)
            `, [startDate, endDate]),
            db.query(`
                SELECT date, SUM(amount) as expenses
                FROM expenses
                WHERE date >= ? AND date <= ?
                GROUP BY date
            `, [startDate, endDate])
        ]);

        // 3. Purchases by Date (if needed in daily table? User said "date - sale - margin - expenses"). 
        // Adding Purchases too for completeness if they want complete cashflow view?
        // User request: "date - sale - margin - expenses"

        // Merge Data
        const report = {};

        salesRows.forEach(r => {
            // With dateStrings: true, r.date is a string like "2026-02-10" or "2026-02-10 12:30:00"
            const d = typeof r.date === 'string' ? r.date.split(' ')[0] : r.date.toISOString().split('T')[0];
            if (!report[d]) report[d] = { date: d, sales: 0, margin: 0, expenses: 0 };
            report[d].sales = parseFloat(r.sales || 0);
            report[d].margin = parseFloat(r.margin || 0);
        });

        expRows.forEach(r => {
            // dateStrings: true returns strings; handle both cases for safety
            let d = r.date;
            if (typeof d === 'object' && d !== null) d = d.toISOString().split('T')[0];
            else if (typeof d === 'string') d = d.split(' ')[0];

            if (!report[d]) report[d] = { date: d, sales: 0, margin: 0, expenses: 0 };
            report[d].expenses = parseFloat(r.expenses || 0);
        });

        // Convert to array and sort DESC
        const result = Object.values(report).sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
