const express = require('express');
const router = express.Router();
const db = require('../db');
const XLSX = require('xlsx');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Helper to send Excel file
const sendExcel = (res, data, sheetName, fileName) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
};

// Export Sales
router.get('/sales', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate, paymentMethod, search } = req.query;
        let query = `
            SELECT s.id, s.created_at, c.name as customer_name, c.phone as customer_phone, s.payment_method, s.total_amount 
            FROM sales s 
            LEFT JOIN customers c ON s.customer_id = c.id 
            WHERE 1=1
        `;
        const params = [];

        if (startDate) { query += ' AND date(s.created_at) >= ?'; params.push(startDate); }
        if (endDate) { query += ' AND date(s.created_at) <= ?'; params.push(endDate); }
        if (paymentMethod && paymentMethod !== 'all') { query += ' AND s.payment_method = ?'; params.push(paymentMethod); }
        if (search) {
            query += ' AND (s.id LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
            const t = `%${search}%`;
            params.push(t, t, t);
        }
        query += ' ORDER BY s.created_at DESC';

        const [rows] = await db.query(query, params);

        const data = rows.map(s => ({
            'Bill No': s.id,
            'Date': new Date(s.created_at).toLocaleDateString(),
            'Customer': s.customer_name || 'Guest',
            'Phone': s.customer_phone || '-',
            'Payment': s.payment_method,
            'Amount': s.total_amount
        }));

        sendExcel(res, data, 'Sales', `sales_report_${startDate || 'all'}.xlsx`);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Export Inventory
router.get('/products', verifyToken, checkPermission('inventory.export'), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, s.name as subcategory_name 
            FROM products p 
            LEFT JOIN subcategories s ON p.subcategory_id = s.id 
            ORDER BY p.name
        `);
        const data = rows.map(p => ({
            'Barcode': p.barcode,
            'Product Name': p.name,
            'Category': p.category,
            'Subcategory': p.subcategory_name || '',
            'Cost Price': p.cost_price,
            'Selling Price': p.price,
            'Stock': p.stock_quantity,
            'Min Stock': p.low_stock_threshold
        }));
        sendExcel(res, data, 'Inventory', `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Export Customers
router.get('/customers', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM customers ORDER BY name');
        const data = rows.map(c => ({
            'Customer Name': c.name,
            'Phone Number': c.phone,
            'Loyalty Points': c.loyalty_points
        }));
        sendExcel(res, data, 'Customers', `customers_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Export Purchase Orders
router.get('/purchase-orders', verifyToken, checkPermission('purchase_order.view'), async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM purchase_orders ORDER BY created_at DESC');
        const data = rows.map(p => ({
            'ID': p.id,
            'Vendor': p.vendor_name,
            'Status': p.status,
            'Total Cost': p.total_cost,
            'Date': new Date(p.created_at).toLocaleDateString()
        }));
        sendExcel(res, data, 'Purchase Orders', `purchase_orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
