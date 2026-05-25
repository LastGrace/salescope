module.exports = async (connection) => {
    console.log('[Migration] Adding pos_background_opacity to store_settings...');

    try {
        // Check if column exists using information_schema
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'store_settings' 
              AND COLUMN_NAME = 'pos_background_opacity'
              AND TABLE_SCHEMA = DATABASE()
        `);

        if (columns.length === 0) {
            await connection.query(`
                ALTER TABLE store_settings 
                ADD COLUMN pos_background_opacity FLOAT DEFAULT 0.1
            `);
            console.log('[Migration] pos_background_opacity added successfully.');
        } else {
            console.log('[Migration] pos_background_opacity column already exists.');
        }
    } catch (err) {
        console.error('[Migration] Failed to add pos_background_opacity:', err.message);
        throw err;
    }
};
