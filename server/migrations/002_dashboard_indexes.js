const db = require('../db');

async function migrate(conn = null) {
    const connection = conn || await db.getConnection();
    let shouldRelease = !conn;

    try {
        console.log('Starting migration: Dashboard Optimization Indexes...\n');

        const indexes = [
            { table: 'sales', column: 'created_at', name: 'idx_sales_created_at' },
            { table: 'sales', column: 'payment_method', name: 'idx_sales_payment_method' },
            { table: 'sale_items', column: 'product_id', name: 'idx_sale_items_product_id' },
            { table: 'activity_logs', column: 'action', name: 'idx_activity_logs_action' },
            { table: 'customers', column: 'created_at', name: 'idx_customers_created_at' }
        ];

        for (const idx of indexes) {
            console.log(`Checking index ${idx.name} on ${idx.table}...`);

            const [rows] = await connection.query(`
                SHOW INDEX FROM ${idx.table} WHERE Key_name = ?
            `, [idx.name]);

            if (rows.length === 0) {
                console.log(`   Creating index ${idx.name}...`);
                await connection.query(`
                    CREATE INDEX ${idx.name} ON ${idx.table} (${idx.column})
                `);
                console.log('   ✓ Index created');
            } else {
                console.log('   ✓ Index already exists');
            }
        }

        console.log('\n✓ Index optimization completed successfully!');

    } catch (err) {
        console.error('\n✗ Migration failed:', err.message);
        throw err;
    } finally {
        if (shouldRelease) connection.release();
    }
}

module.exports = migrate;

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}
