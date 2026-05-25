/**
 * Migration: Add performance indexes to high-traffic tables.
 * These indexes dramatically speed up dashboard, sales, reports, and analytics queries.
 */

const db = require('../db');

async function up() {
    const indexes = [
        // Sales — date range filters, customer/user lookups
        'CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id)',

        // Sale items — JOIN on sale_id and product_id
        'CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)',
        'CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)',

        // Sale payments — JOIN on sale_id
        'CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id)',

        // Products — category filter, stock threshold queries
        'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
        'CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity)',

        // Activity logs — date range, employee filter
        'CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_activity_logs_employee_id ON activity_logs(employee_id)',

        // Loyalty ledger — customer history
        'CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_customer_id ON loyalty_ledger(customer_id)',

        // Credit notes — customer lookup
        'CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id ON credit_notes(customer_id)',

        // Coupon & credit note usage — sale lookups
        'CREATE INDEX IF NOT EXISTS idx_coupon_usages_sale_id ON coupon_usages(sale_id)',
        'CREATE INDEX IF NOT EXISTS idx_credit_note_usage_cn_id ON credit_note_usage(credit_note_id)',

        // Returns — original sale lookup
        'CREATE INDEX IF NOT EXISTS idx_returns_original_sale_id ON returns(original_sale_id)',
        'CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id)',

        // PO items — po lookup
        'CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON po_items(po_id)',

        // Expenses — date range queries
        'CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)',

        // Shifts — user lookup
        'CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id)',

        // Subcategories — category FK lookup
        'CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id)',
    ];

    for (const sql of indexes) {
        try {
            await db.query(sql);
        } catch (err) {
            // Index might already exist (older MySQL doesn't support IF NOT EXISTS for indexes)
            if (err.code !== 'ER_DUP_KEYNAME') {
                console.warn(`[Migration] Index warning: ${err.message}`);
            }
        }
    }

    console.log('[Migration] Performance indexes added successfully');
}

module.exports = up;
