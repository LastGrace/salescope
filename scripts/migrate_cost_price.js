const db = require('../server/db');

async function migrate() {
    const connection = await db.getConnection();
    try {
        console.log('Starting migration...');

        // Add cost_price to products
        try {
            await connection.query('ALTER TABLE products ADD COLUMN cost_price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER price');
            console.log('Added cost_price to products');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') console.log('cost_price already exists in products');
            else throw err;
        }

        // Add cost_price_at_sale to sale_items
        try {
            await connection.query('ALTER TABLE sale_items ADD COLUMN cost_price_at_sale DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER price_at_sale');
            console.log('Added cost_price_at_sale to sale_items');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') console.log('cost_price_at_sale already exists in sale_items');
            else throw err;
        }

        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

migrate();
