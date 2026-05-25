const db = require('../db');

/**
 * Migration: Fix Payment Method Truncation
 * 
 * Ensures that payment_method columns are VARCHAR(50) instead of ENUMs
 * which might have been used in older DB versions, causing truncation 
 * errors during 'split' payments.
 */
async function up(conn = null) {
    const connection = conn || await db.getConnection();
    const shouldRelease = !conn;

    try {
        console.log('[Migration] Ensuring payment_method is VARCHAR(50) in sales and sale_payments...');

        // 1. Fix sales table
        await connection.query(`
            ALTER TABLE sales 
            MODIFY COLUMN payment_method VARCHAR(50) DEFAULT 'cash'
        `);
        console.log('   ✓ Updated sales.payment_method to VARCHAR(50)');

        // 2. Fix sale_payments table
        await connection.query(`
            ALTER TABLE sale_payments 
            MODIFY COLUMN payment_method VARCHAR(50) NOT NULL
        `);
        console.log('   ✓ Updated sale_payments.payment_method to VARCHAR(50)');

    } catch (err) {
        console.error('[Migration] Failed to update payment_method columns:', err.message);
        throw err;
    } finally {
        if (shouldRelease) connection.release();
    }
}

module.exports = up;
