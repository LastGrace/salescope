/**
 * db.js — MySQL connection pool.
 *
 * WHY changed: In production, .env lives in userData (not CWD).
 * The paths module resolves the correct .env location.
 */

const mysql = require('mysql2/promise');
const { ENV_FILE } = require('./paths');
// .env is loaded once in index.js

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'O*999',
  database: 'retail_shop_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true,             // Return date strings (avoids Date object parsing)
  timezone: '+05:30'             // Force IST (Indian Standard Time)
});

module.exports = pool;
