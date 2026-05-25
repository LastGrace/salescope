const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyManager } = require('../middleware/authMiddleware');

router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const [todayStats, dailySales, topProducts, lowStock] = await Promise.all([
            db.query(`
                SELECT COALESCE(SUM(total_amount), 0) as total 
                FROM sales 
                WHERE created_at >= CURDATE()
            `),
            db.query(`
                SELECT DATE(created_at) as date, SUM(total_amount) as total 
                FROM sales 
                WHERE created_at >= NOW() - INTERVAL 7 DAY 
                GROUP BY DATE(created_at) 
                ORDER BY date DESC
            `),
            db.query(`
                SELECT p.name, SUM(si.quantity) as total_sold
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                GROUP BY si.product_id
                ORDER BY total_sold DESC
                LIMIT 5
            `),
            db.query(`
                SELECT name, stock_quantity, low_stock_threshold 
                FROM products 
                WHERE stock_quantity <= low_stock_threshold
            `)
        ]);

        res.json({
            sales_today: todayStats[0][0].total,
            daily_sales: dailySales[0],
            top_products: topProducts[0],
            low_stock: lowStock[0]
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
