/**
 * Migration: Comprehensive Product Foreign Key Fix
 * 
 * This migration ensures all tables referencing the products table:
 * 1. Have product_id as a NULLable column.
 * 2. Have product_name and barcode columns for history.
 * 3. Have the foreign key configured as ON DELETE SET NULL.
 * 
 * Tables affected: sale_items, po_items, return_items.
 */

const db = require('../db');

async function migrate(conn = null) {
    const connection = conn || await db.getConnection();
    let shouldRelease = !conn;

    try {
        console.log('Starting migration: Comprehensive Product Foreign Key Fix...\n');
        if (shouldRelease) await connection.beginTransaction();

        const tables = ['sale_items', 'po_items', 'return_items'];

        for (const table of tables) {
            console.log(`\n--- Processing Table: ${table} ---`);

            try {
                const [cols] = await connection.query(`DESCRIBE ${table}`);
                const colNames = cols.map(c => c.Field);

                if (!colNames.includes('product_name')) {
                    console.log(`Adding product_name to ${table}...`);
                    await connection.query(`ALTER TABLE ${table} ADD COLUMN product_name VARCHAR(255) AFTER product_id`);
                }
                if (!colNames.includes('barcode')) {
                    console.log(`Adding barcode to ${table}...`);
                    await connection.query(`ALTER TABLE ${table} ADD COLUMN barcode VARCHAR(255) AFTER product_name`);
                }
            } catch (err) {
                console.log(`Error checking/adding columns to ${table}: ${err.message}`);
            }

            console.log(`Ensuring ${table}.product_id is NULLable...`);
            await connection.query(`ALTER TABLE ${table} MODIFY COLUMN product_id INT NULL`);

            console.log(`Populating history data for ${table}...`);
            await connection.query(`
                UPDATE ${table} t
                JOIN products p ON t.product_id = p.id
                SET t.product_name = p.name, t.barcode = p.barcode
                WHERE t.product_name IS NULL
            `);

            console.log(`Updating Foreign Key for ${table}...`);
            const [constraints] = await connection.query(`
                SELECT CONSTRAINT_NAME 
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE TABLE_NAME = ? 
                AND COLUMN_NAME = 'product_id' 
                AND REFERENCED_TABLE_NAME = 'products'
                AND TABLE_SCHEMA = DATABASE()
            `, [table]);

            for (const row of constraints) {
                console.log(`   Dropping constraint: ${row.CONSTRAINT_NAME}`);
                await connection.query(`ALTER TABLE ${table} DROP FOREIGN KEY ${row.CONSTRAINT_NAME}`);
            }

            console.log(`   Adding new constraint fk_${table}_product_id...`);
            await connection.query(`
                ALTER TABLE ${table} 
                ADD CONSTRAINT fk_${table}_product_id
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
            `);
        }

        if (shouldRelease) await connection.commit();
        console.log('\n✓ Comprehensive migration completed successfully!');

    } catch (err) {
        if (shouldRelease) await connection.rollback();
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
