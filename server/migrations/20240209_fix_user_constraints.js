module.exports = async (connection) => {
    console.log('[Migration] Starting Final Database Consistency Fix...');

    try {
        // --- 1. Fix Sales Table ---
        console.log('[Migration] Processing sales table...');
        // Ensure all user_ids exists in users table or are NULL
        await connection.query('UPDATE sales SET user_id = NULL WHERE user_id NOT IN (SELECT id FROM users)');
        // Make user_id nullable first
        await connection.query('ALTER TABLE sales MODIFY user_id INT NULL');

        try {
            await connection.query('ALTER TABLE sales DROP FOREIGN KEY sales_ibfk_2');
        } catch (e) {
            console.log('[Migration] Note: sales_ibfk_2 not found in sales.');
        }
        try {
            await connection.query('ALTER TABLE sales DROP FOREIGN KEY sales_user_fk');
        } catch (e) {
            // Ignore
        }

        try {
            await connection.query('ALTER TABLE sales ADD CONSTRAINT sales_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        } catch (err) {
            if (err.errno === 121) {
                console.log('[Migration] Conflict (121) on sales_user_fk. Attempting to add with unique name...');
                await connection.query('ALTER TABLE sales ADD CONSTRAINT sales_user_fk_new FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
            } else {
                throw err;
            }
        }
        console.log('[Migration] ✓ Sales table updated.');

        // --- 2. Fix Returns Table ---
        console.log('[Migration] Processing returns table...');
        await connection.query('UPDATE returns SET user_id = NULL WHERE user_id NOT IN (SELECT id FROM users)');
        await connection.query('ALTER TABLE returns MODIFY user_id INT NULL');

        try {
            await connection.query('ALTER TABLE returns DROP FOREIGN KEY returns_ibfk_3');
        } catch (e) {
            console.log('[Migration] Note: returns_ibfk_3 not found in returns.');
        }
        try {
            await connection.query('ALTER TABLE returns DROP FOREIGN KEY returns_user_fk');
        } catch (e) {
            // Ignore
        }

        try {
            await connection.query('ALTER TABLE returns ADD CONSTRAINT returns_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        } catch (err) {
            if (err.errno === 121) {
                await connection.query('ALTER TABLE returns ADD CONSTRAINT returns_user_fk_new FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
            } else {
                throw err;
            }
        }
        console.log('[Migration] ✓ Returns table updated.');

        // --- 3. Fix Activity Logs Table ---
        console.log('[Migration] Processing activity_logs table...');
        await connection.query('UPDATE activity_logs SET employee_id = NULL WHERE employee_id NOT IN (SELECT id FROM users)');
        await connection.query('ALTER TABLE activity_logs MODIFY employee_id INT NULL');

        try {
            await connection.query('ALTER TABLE activity_logs DROP FOREIGN KEY fk_activity_logs_employee');
        } catch (e) {
            console.log('[Migration] Note: fk_activity_logs_employee not found in activity_logs.');
        }
        try {
            await connection.query('ALTER TABLE activity_logs DROP FOREIGN KEY activity_logs_user_fk');
        } catch (e) {
            // Ignore
        }

        try {
            await connection.query('ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_fk FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL');
        } catch (err) {
            if (err.errno === 121) {
                await connection.query('ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_fk_new FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL');
            } else {
                throw err;
            }
        }
        console.log('[Migration] ✓ Activity logs table updated.');

        // --- 4. Safe Index Creation ---
        console.log('[Migration] Processing indexes...');
        const indexes = [
            { table: 'sales', name: 'idx_sales_created_at', col: 'created_at' },
            { table: 'sales', name: 'idx_sales_payment_method', col: 'payment_method' },
            { table: 'sale_items', name: 'idx_sale_items_product_id', col: 'product_id' },
            { table: 'activity_logs', name: 'idx_activity_logs_action', col: 'action' },
            { table: 'customers', name: 'idx_customers_created_at', col: 'created_at' }
        ];

        for (const idx of indexes) {
            try {
                // Check if exists first (extra safe)
                const [rows] = await connection.query(`SHOW INDEX FROM ${idx.table} WHERE Key_name = ?`, [idx.name]);
                if (rows.length === 0) {
                    await connection.query(`CREATE INDEX ${idx.name} ON ${idx.table} (${idx.col})`);
                    console.log(`[Migration] ✓ Created index ${idx.name}`);
                } else {
                    console.log(`[Migration] Note: Index ${idx.name} already exists.`);
                }
            } catch (e) {
                console.warn(`[Migration] Warning: Failed to process index ${idx.name}:`, e.message);
            }
        }

    } catch (err) {
        console.error('[Migration] Critical Error during DB fix:', err.message);
        throw err; // Re-throw to signal failure to migration runner
    }

    console.log('[Migration] Database consistency fix completed successfully.');
};
