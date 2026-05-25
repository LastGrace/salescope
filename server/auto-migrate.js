const mysql = require('mysql2/promise');
const { ENV_FILE } = require('./paths');
// .env is loaded once in index.js at boot

async function checkAndMigrate() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'O*999',
            database: process.env.DB_NAME || 'retail_shop_db'
        });

        console.log('Checking database schema...');

        // Helper to check and add column
        const ensureColumn = async (table, column, definition) => {
            try {
                const [cols] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
                if (cols.length === 0) {
                    console.log(`Migrating: Adding ${column} to ${table}...`);
                    await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                    console.log(`Migration done: ${column} added.`);
                } else {
                    console.log(`Schema check: ${column} exists.`);
                }
            } catch (e) {
                console.error(`Failed to check/add ${column}:`, e.message);
            }
        };

        // 1. Check for product_add_sound_url
        await ensureColumn('store_settings', 'product_add_sound_url', 'VARCHAR(255) AFTER login_logo_height');

        // 2. Check for pos_background fields individually
        await ensureColumn('store_settings', 'pos_background_url', 'VARCHAR(255) AFTER login_logo_height');
        await ensureColumn('store_settings', 'pos_background_width', 'VARCHAR(50) AFTER pos_background_url');
        await ensureColumn('store_settings', 'pos_background_height', 'VARCHAR(50) AFTER pos_background_width');
        await ensureColumn('store_settings', 'pos_background_opacity', 'DECIMAL(3,2) DEFAULT 0.10 AFTER pos_background_height');

        // 3. Check for Dashboard Logo fields
        await ensureColumn('store_settings', 'dashboard_logo_url', 'VARCHAR(255) AFTER pos_background_opacity');
        await ensureColumn('store_settings', 'dashboard_logo_width', 'VARCHAR(50) AFTER dashboard_logo_url');
        await ensureColumn('store_settings', 'dashboard_logo_height', 'VARCHAR(50) AFTER dashboard_logo_width');
        await ensureColumn('store_settings', 'show_dashboard_logo', 'TINYINT(1) DEFAULT 1 AFTER dashboard_logo_height');

        // 3. Check for visibility toggles
        await ensureColumn('store_settings', 'show_logo', 'TINYINT(1) DEFAULT 1 AFTER logo_height');
        await ensureColumn('store_settings', 'show_bill_logo', 'TINYINT(1) DEFAULT 1 AFTER bill_logo_height');
        await ensureColumn('store_settings', 'show_login_logo', 'TINYINT(1) DEFAULT 1 AFTER login_logo_height');
        await ensureColumn('store_settings', 'show_pos_background', 'TINYINT(1) DEFAULT 1 AFTER pos_background_opacity');
        await ensureColumn('store_settings', 'show_product_add_sound', 'TINYINT(1) DEFAULT 1 AFTER product_add_sound_url');

    } catch (err) {
        console.error('Migration check failed:', err.message);
    } finally {
        if (connection) await connection.end();
    }
}

module.exports = checkAndMigrate;
