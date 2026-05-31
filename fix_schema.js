const fs = require('fs');
let content = fs.readFileSync('schema.sql', 'utf8');

const indexes = [
    { table: 'sales', idx: 'idx_sales_created_at', col: 'created_at' },
    { table: 'sales', idx: 'idx_sales_customer_id', col: 'customer_id' },
    { table: 'sales', idx: 'idx_sales_user_id', col: 'user_id' },
    { table: 'sale_items', idx: 'idx_sale_items_sale_id', col: 'sale_id' },
    { table: 'sale_items', idx: 'idx_sale_items_product_id', col: 'product_id' },
    { table: 'sale_payments', idx: 'idx_sale_payments_sale_id', col: 'sale_id' },
    { table: 'products', idx: 'idx_products_category', col: 'category' },
    { table: 'products', idx: 'idx_products_stock', col: 'stock_quantity' },
    { table: 'activity_logs', idx: 'idx_activity_logs_created_at', col: 'created_at' },
    { table: 'activity_logs', idx: 'idx_activity_logs_employee_id', col: 'employee_id' },
    { table: 'loyalty_ledger', idx: 'idx_loyalty_ledger_customer_id', col: 'customer_id' },
    { table: 'credit_notes', idx: 'idx_credit_notes_customer_id', col: 'customer_id' },
    { table: 'coupon_usages', idx: 'idx_coupon_usages_sale_id', col: 'sale_id' },
    { table: 'credit_note_usage', idx: 'idx_credit_note_usage_cn_id', col: 'credit_note_id' },
    { table: 'returns', idx: 'idx_returns_original_sale_id', col: 'original_sale_id' },
    { table: 'return_items', idx: 'idx_return_items_return_id', col: 'return_id' },
    { table: 'po_items', idx: 'idx_po_items_po_id', col: 'po_id' },
    { table: 'expenses', idx: 'idx_expenses_date', col: 'date' },
    { table: 'shifts', idx: 'idx_shifts_user_id', col: 'user_id' },
    { table: 'subcategories', idx: 'idx_subcategories_category_id', col: 'category_id' }
];

indexes.forEach(idx => {
    const tableDefMatch = new RegExp(`CREATE TABLE IF NOT EXISTS ${idx.table} \\([\\s\\S]*?\\);`);
    const match = content.match(tableDefMatch);
    if (match) {
        let tableDef = match[0];
        // Insert INDEX before the last );
        let replacement = tableDef.replace(/\n\);$/, `,\n    INDEX ${idx.idx} (${idx.col})\n);`);
        content = content.replace(tableDef, replacement);
    }
});

// Remove the external CREATE INDEX statements
content = content.replace(/CREATE INDEX idx_.*?;(\r?\n)/g, '');

fs.writeFileSync('schema.sql', content);
console.log('Fixed schema.sql');
