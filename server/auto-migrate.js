const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { ENV_FILE, DATA_DIR } = require('./paths');
const { CURRENT_SCHEMA_VERSION } = require('./config');
// .env is loaded once in index.js at boot

const STAMP_PATH = path.join(DATA_DIR, '.migrate_stamp');

async function checkAndMigrate() {
    // ── FAST PATH: skip all DB queries if schema is already at current version ──
    // This saves ~3,500ms on every normal boot after the first one.
    try {
        const stamp = JSON.parse(fs.readFileSync(STAMP_PATH, 'utf8'));
        if (stamp.version === CURRENT_SCHEMA_VERSION) {
            console.log(`[AutoMigrate] Stamp matches v${CURRENT_SCHEMA_VERSION} — skipping schema checks.`);
            return;
        }
        console.log(`[AutoMigrate] Stamp version ${stamp.version} != current ${CURRENT_SCHEMA_VERSION} — running migrations.`);
    } catch (_) {
        // Stamp missing or corrupt — run full migration below
        console.log('[AutoMigrate] No stamp found — running full schema check.');
    }

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

        // 4. Ensure messaging_settings table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS messaging_settings (
                id INT NOT NULL DEFAULT 1 PRIMARY KEY,
                baileys_enabled BOOLEAN DEFAULT TRUE,
                whatshub_enabled BOOLEAN DEFAULT FALSE,
                default_provider ENUM('baileys', 'whatshub') DEFAULT 'baileys',
                whatshub_api_key VARCHAR(255),
                override_invoices VARCHAR(50),
                override_bills VARCHAR(50),
                override_bulk VARCHAR(50),
                override_marketing VARCHAR(50),
                override_sync VARCHAR(50),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT messaging_single_row CHECK (id = 1)
            )
        `);
        await connection.query(`INSERT IGNORE INTO messaging_settings (id) VALUES (1)`);

        // Create whatsapp_message_store table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_message_store (
                msg_id VARCHAR(128) PRIMARY KEY,
                message_payload JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        // Create whatsapp_blocklist table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_blocklist (
                phone VARCHAR(32) PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        // Create whatsapp_campaigns table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
                id VARCHAR(128) PRIMARY KEY,
                running TINYINT(1) DEFAULT 0,
                cancelled TINYINT(1) DEFAULT 0,
                mode VARCHAR(10) DEFAULT 'text',
                message TEXT,
                file_path VARCHAR(255),
                file_name VARCHAR(255),
                file_mimetype VARCHAR(100),
                total INT DEFAULT 0,
                sent INT DEFAULT 0,
                failed INT DEFAULT 0,
                started_at VARCHAR(100),
                finished_at VARCHAR(100),
                logs JSON,
                customers JSON
            ) ENGINE=InnoDB;
        `);

        // Create whatsapp_message_logs table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                recipient_phone VARCHAR(32) NOT NULL,
                recipient_name VARCHAR(255) DEFAULT 'Unknown Customer',
                message_type VARCHAR(10) NOT NULL DEFAULT 'text',
                message_text TEXT,
                media_filename VARCHAR(255),
                status VARCHAR(20) NOT NULL DEFAULT 'sent',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        // ── Write stamp file so next boot skips all of this ──
        try {
            fs.writeFileSync(STAMP_PATH, JSON.stringify({ version: CURRENT_SCHEMA_VERSION }));
            console.log(`[AutoMigrate] Stamp written for v${CURRENT_SCHEMA_VERSION}.`);
        } catch (stampErr) {
            console.warn('[AutoMigrate] Could not write stamp file:', stampErr.message);
        }

    } catch (err) {
        console.error('Migration check failed:', err.message);
    } finally {
        if (connection) await connection.end();
    }
}

module.exports = checkAndMigrate;
