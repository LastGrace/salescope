const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigrations() {
    const connection = await db.getConnection();
    try {
        console.log('[Migrations] Checking for pending migrations...');

        // 1. Ensure migrations table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Read migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        if (!fs.existsSync(migrationsDir)) {
            console.log('[Migrations] No migrations directory found.');
            return;
        }

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.js'))
            .sort();

        // 3. Get applied migrations
        const [applied] = await connection.query('SELECT name FROM _migrations');
        const appliedNames = new Set(applied.map(m => m.name));

        // 4. Run pending migrations
        for (const file of files) {
            if (!appliedNames.has(file)) {
                console.log(`[Migrations] Applying: ${file}`);

                try {
                    const migrationPath = path.join(migrationsDir, file);
                    const migration = require(migrationPath);

                    if (typeof migration === 'function') {
                        // Pass the connection to the migration for transaction atomicity (optional)
                        // But most migrations handle their own transaction. 
                        // I'll pass NULL so they get their own, or I could pass 'connection'.
                        // To be safe and reuse the connection, I'll pass it.
                        await migration(connection);

                        // Record success
                        await connection.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
                        console.log(`[Migrations] ✓ Successfully applied ${file}`);
                    } else {
                        console.warn(`[Migrations] ⚠️ ${file} does not export a migrate function.`);
                    }
                } catch (err) {
                    console.error(`[Migrations] ✗ Failed to apply ${file}:`, err.message);
                    // Stop if a migration fails to prevent further issues
                    throw err;
                }
            }
        }

        console.log('[Migrations] Database is up to date.');
    } catch (err) {
        console.error('[Migrations] Process failed:', err.message);
    } finally {
        connection.release();
    }
}

module.exports = runMigrations;
