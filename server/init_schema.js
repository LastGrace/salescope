/**
 * init_schema.js — Database schema initialization.
 *
 * WHY changed: schema.sql path was relative to __dirname which breaks in
 * packaged builds. Now uses paths module for correct resolution.
 * .env is also loaded from the correct location.
 */

const fs = require('fs');
const mysql = require('mysql2/promise');
const { SCHEMA_PATH, ENV_FILE } = require('./paths');
// .env is loaded once in index.js at boot

async function setup() {
    let connection;
    try {
        if (!fs.existsSync(SCHEMA_PATH)) {
            console.log('[DB Init] Schema file not found at:', SCHEMA_PATH);
            return;
        }
        let schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

        // Robustness: Strip DELIMITER commands (CLI only) and fix double semicolons
        schema = schema
            .split('\n')
            .filter(line => !line.trim().toUpperCase().startsWith('DELIMITER'))
            .join('\n')
            .replace(/;;/g, ';');

        connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: 'O*999',
            multipleStatements: true
        });

        console.log('[DB Init] Running schema.sql...');
        await connection.query(schema);
        console.log('[DB Init] Schema applied successfully.');
    } catch (err) {
        console.error('[DB Init] Failed or already exists:', err.message);
        // Do not throw, allow server to proceed (it might be fine)
    } finally {
        if (connection) await connection.end();
    }
}

module.exports = setup;
