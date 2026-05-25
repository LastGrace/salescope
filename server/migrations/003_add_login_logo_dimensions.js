const db = require('../db');

async function migrate(conn = null) {
    const connection = conn || await db.getConnection();
    let shouldRelease = !conn;

    try {
        console.log('Starting migration: Add Login Logo Dimensions...\n');
        if (shouldRelease) await connection.beginTransaction();

        console.log('1. Adding login_logo_width column to store_settings table...');
        try {
            await connection.query(`
                ALTER TABLE store_settings ADD COLUMN login_logo_width VARCHAR(50) DEFAULT NULL
            `);
            console.log('   ✓ Added login_logo_width column');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('   ✓ login_logo_width column already exists');
            } else {
                throw err;
            }
        }

        console.log('2. Adding login_logo_height column to store_settings table...');
        try {
            await connection.query(`
                ALTER TABLE store_settings ADD COLUMN login_logo_height VARCHAR(50) DEFAULT NULL
            `);
            console.log('   ✓ Added login_logo_height column');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('   ✓ login_logo_height column already exists');
            } else {
                throw err;
            }
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
