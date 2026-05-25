const db = require('../db');

async function migrate(conn = null) {
    const connection = conn || await db.getConnection();
    let shouldRelease = !conn;

    try {
        console.log('Starting migration: Fix Product Deletion History Persistence...\n');
        if (shouldRelease) await connection.beginTransaction();

        // 1. Add columns to po_items
        console.log('1. Updating po_items table...');
        try {
            await connection.query(`
                ALTER TABLE po_items 
                ADD COLUMN product_name VARCHAR(255) AFTER product_id,
                ADD COLUMN barcode VARCHAR(50) AFTER product_name,
                MODIFY COLUMN product_id INT NULL
            `);
            console.log('   ✓ Added product_name, barcode columns and made product_id NULLable');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('   ✓ Columns already exist in po_items');
            } else {
                throw err;
            }
        }

        // 2. Add columns to return_items
        console.log('2. Updating return_items table...');
        try {
            await connection.query(`
                ALTER TABLE return_items 
                ADD COLUMN product_name VARCHAR(255) AFTER product_id,
                ADD COLUMN barcode VARCHAR(50) AFTER product_name
            `);
            console.log('   ✓ Added product_name, barcode columns to return_items');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('   ✓ Columns already exist in return_items');
            } else {
                throw err;
            }
        }

        // 3. Populate columns from products table
        console.log('3. Populating product names and barcodes for historical data...');
        await connection.query(`
            UPDATE po_items pi
            JOIN products p ON pi.product_id = p.id
            SET pi.product_name = p.name, pi.barcode = p.barcode
            WHERE pi.product_name IS NULL
        `);
        await connection.query(`
            UPDATE return_items ri
            JOIN products p ON ri.product_id = p.id
            SET ri.product_name = p.name, ri.barcode = p.barcode
            WHERE ri.product_name IS NULL
        `);
        console.log('   ✓ Populated historical data');

        // 4. Update Foreign Key for po_items
        console.log('4. Updating po_items foreign key to ON DELETE SET NULL...');
        const [constraints] = await connection.query(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'po_items' 
            AND COLUMN_NAME = 'product_id' 
            AND REFERENCED_TABLE_NAME = 'products'
            AND TABLE_SCHEMA = DATABASE()
        `);

        if (constraints.length > 0) {
            const constraintName = constraints[0].CONSTRAINT_NAME;
            console.log(`   Found constraint: ${constraintName}. Recreating...`);
            await connection.query(`ALTER TABLE po_items DROP FOREIGN KEY ${constraintName}`);
            await connection.query(`
                ALTER TABLE po_items 
                ADD CONSTRAINT fk_po_items_product 
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
            `);
            console.log('   ✓ Recreated foreign key with ON DELETE SET NULL');
        } else {
            console.log('   ⚠️ No foreign key found on po_items(product_id). Creating one...');
            await connection.query(`
                ALTER TABLE po_items 
                ADD CONSTRAINT fk_po_items_product 
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
            `);
            console.log('   ✓ Created foreign key with ON DELETE SET NULL');
        }

        // 5. Update foreign key for return_items
        console.log('5. Ensuring return_items foreign key is ON DELETE SET NULL...');
        const [retConstraints] = await connection.query(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'return_items' 
            AND COLUMN_NAME = 'product_id' 
            AND REFERENCED_TABLE_NAME = 'products'
            AND TABLE_SCHEMA = DATABASE()
        `);

        if (retConstraints.length > 0) {
            const constraintName = retConstraints[0].CONSTRAINT_NAME;
            await connection.query(`ALTER TABLE return_items DROP FOREIGN KEY ${constraintName}`);
            await connection.query(`
                ALTER TABLE return_items 
                ADD CONSTRAINT fk_return_items_product 
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
            `);
            console.log('   ✓ Recreated return_items foreign key with ON DELETE SET NULL');
        }

        if (shouldRelease) await connection.commit();
        console.log('\n✓ Migration completed successfully!');

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
