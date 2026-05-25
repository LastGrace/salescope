/**
 * Migration: User-Based Permission System
 * 
 * This migration:
 * 1. Adds is_admin column to users table
 * 2. Creates employee_permissions table
 * 3. Creates activity_logs table
 * 4. Seeds all permissions
 * 5. Migrates existing admin users to have all permissions
 * 6. Drops roles and role_permissions tables
 */

const db = require('../db');

// All permissions grouped by module
const PERMISSIONS = [
    // POS
    { code: 'pos.access', module: 'POS', category: 'POS', description: 'Access POS module' },
    { code: 'pos.cart.add', module: 'POS', category: 'POS', description: 'Add items to cart' },
    { code: 'pos.cart.update', module: 'POS', category: 'POS', description: 'Update cart items' },
    { code: 'pos.cart.remove', module: 'POS', category: 'POS', description: 'Remove items from cart' },
    { code: 'pos.discount.apply', module: 'POS', category: 'POS', description: 'Apply discounts' },
    { code: 'pos.coupon.apply', module: 'POS', category: 'POS', description: 'Apply coupons' },
    { code: 'pos.hold_bill', module: 'POS', category: 'POS', description: 'Hold bills for later' },
    { code: 'pos.resume_bill', module: 'POS', category: 'POS', description: 'Resume held bills' },
    { code: 'pos.checkout', module: 'POS', category: 'POS', description: 'Complete checkout' },
    { code: 'pos.pay_later', module: 'POS', category: 'POS', description: 'Create pay later transactions' },
    { code: 'pos.print_bill', module: 'POS', category: 'POS', description: 'Print bills' },
    { code: 'pos.whatsapp_bill', module: 'POS', category: 'POS', description: 'Send bills via WhatsApp' },

    // Inventory
    { code: 'inventory.view', module: 'Inventory', category: 'Inventory', description: 'View inventory' },
    { code: 'inventory.product.create', module: 'Inventory', category: 'Inventory', description: 'Create products' },
    { code: 'inventory.product.update', module: 'Inventory', category: 'Inventory', description: 'Update products' },
    { code: 'inventory.product.delete', module: 'Inventory', category: 'Inventory', description: 'Delete products' },
    { code: 'inventory.stock.adjust', module: 'Inventory', category: 'Inventory', description: 'Adjust stock levels' },
    { code: 'inventory.import', module: 'Inventory', category: 'Inventory', description: 'Import inventory data' },
    { code: 'inventory.export', module: 'Inventory', category: 'Inventory', description: 'Export inventory data' },
    { code: 'inventory.category.manage', module: 'Inventory', category: 'Inventory', description: 'Manage categories' },

    // Barcode
    { code: 'barcode.generate', module: 'Barcode', category: 'Barcode', description: 'Generate barcodes' },
    { code: 'barcode.print', module: 'Barcode', category: 'Barcode', description: 'Print barcodes' },
    { code: 'barcode.batch_print', module: 'Barcode', category: 'Barcode', description: 'Batch print barcodes' },

    // Customer
    { code: 'customer.view', module: 'Customer', category: 'Customer', description: 'View customers' },
    { code: 'customer.create', module: 'Customer', category: 'Customer', description: 'Create customers' },
    { code: 'customer.update', module: 'Customer', category: 'Customer', description: 'Update customers' },
    { code: 'customer.delete', module: 'Customer', category: 'Customer', description: 'Delete customers' },
    { code: 'customer.import', module: 'Customer', category: 'Customer', description: 'Import customers' },
    { code: 'customer.export', module: 'Customer', category: 'Customer', description: 'Export customers' },
    { code: 'customer.history.view', module: 'Customer', category: 'Customer', description: 'View customer history' },

    // Loyalty
    { code: 'loyalty.view', module: 'Loyalty', category: 'Loyalty', description: 'View loyalty settings' },
    { code: 'loyalty.settings.update', module: 'Loyalty', category: 'Loyalty', description: 'Update loyalty settings' },
    { code: 'loyalty.points.adjust', module: 'Loyalty', category: 'Loyalty', description: 'Adjust customer points' },
    { code: 'loyalty.rules.manage', module: 'Loyalty', category: 'Loyalty', description: 'Manage loyalty rules' },

    // Coupon
    { code: 'coupon.view', module: 'Coupon', category: 'Coupon', description: 'View coupons' },
    { code: 'coupon.create', module: 'Coupon', category: 'Coupon', description: 'Create coupons' },
    { code: 'coupon.update', module: 'Coupon', category: 'Coupon', description: 'Update coupons' },
    { code: 'coupon.delete', module: 'Coupon', category: 'Coupon', description: 'Delete coupons' },
    { code: 'coupon.assign', module: 'Coupon', category: 'Coupon', description: 'Assign coupons to customers' },

    // Credit Note
    { code: 'credit_note.view', module: 'Credit Note', category: 'Credit Note', description: 'View credit notes' },
    { code: 'credit_note.issue', module: 'Credit Note', category: 'Credit Note', description: 'Issue credit notes' },
    { code: 'credit_note.apply', module: 'Credit Note', category: 'Credit Note', description: 'Apply credit notes' },
    { code: 'credit_note.expiry.manage', module: 'Credit Note', category: 'Credit Note', description: 'Manage credit note expiry' },

    // Credit Bill
    { code: 'credit_bill.view', module: 'Credit Bill', category: 'Credit Bill', description: 'View credit bills' },
    { code: 'credit_bill.create', module: 'Credit Bill', category: 'Credit Bill', description: 'Create credit bills' },
    { code: 'credit_bill.collect_payment', module: 'Credit Bill', category: 'Credit Bill', description: 'Collect payment on credit bills' },

    // Returns
    { code: 'returns.view', module: 'Returns', category: 'Returns', description: 'View returns' },
    { code: 'returns.process', module: 'Returns', category: 'Returns', description: 'Process returns' },
    { code: 'exchange.process', module: 'Returns', category: 'Returns', description: 'Process exchanges' },
    { code: 'refund.cash', module: 'Returns', category: 'Returns', description: 'Issue cash refunds' },
    { code: 'refund.credit_note', module: 'Returns', category: 'Returns', description: 'Issue credit note refunds' },

    // Sales
    { code: 'sales.view', module: 'Sales', category: 'Sales', description: 'View sales records' },
    { code: 'sales.filter', module: 'Sales', category: 'Sales', description: 'Filter sales records' },
    { code: 'sales.export', module: 'Sales', category: 'Sales', description: 'Export sales data' },
    { code: 'sales.bill.view', module: 'Sales', category: 'Sales', description: 'View bill details' },

    // Expense
    { code: 'expense.view', module: 'Expense', category: 'Expense', description: 'View expenses' },
    { code: 'expense.create', module: 'Expense', category: 'Expense', description: 'Create expenses' },
    { code: 'expense.update', module: 'Expense', category: 'Expense', description: 'Update expenses' },
    { code: 'expense.delete', module: 'Expense', category: 'Expense', description: 'Delete expenses' },
    { code: 'expense.report.view', module: 'Expense', category: 'Expense', description: 'View expense reports' },

    // Purchase Order
    { code: 'purchase_order.view', module: 'Purchase Order', category: 'Purchase Order', description: 'View purchase orders' },
    { code: 'purchase_order.create', module: 'Purchase Order', category: 'Purchase Order', description: 'Create purchase orders' },
    { code: 'purchase_order.receive', module: 'Purchase Order', category: 'Purchase Order', description: 'Receive purchase orders' },

    // Backup
    { code: 'backup.view', module: 'Backup', category: 'Backup', description: 'View backups' },
    { code: 'backup.create', module: 'Backup', category: 'Backup', description: 'Create backups' },
    { code: 'backup.restore', module: 'Backup', category: 'Backup', description: 'Restore from backup' },
    { code: 'backup.delete', module: 'Backup', category: 'Backup', description: 'Delete backups' },
    { code: 'backup.drive.sync', module: 'Backup', category: 'Backup', description: 'Sync with Google Drive' },
    { code: 'database.reset', module: 'Backup', category: 'Backup', description: 'Reset database (danger zone)' },

    // WhatsApp
    { code: 'whatsapp.connect', module: 'WhatsApp', category: 'WhatsApp', description: 'Connect WhatsApp' },
    { code: 'whatsapp.disconnect', module: 'WhatsApp', category: 'WhatsApp', description: 'Disconnect WhatsApp' },
    { code: 'whatsapp.send_bill', module: 'WhatsApp', category: 'WhatsApp', description: 'Send bills via WhatsApp' },
    { code: 'whatsapp.bulk_message', module: 'WhatsApp', category: 'WhatsApp', description: 'Send bulk messages' },
    { code: 'whatsapp.view_logs', module: 'WhatsApp', category: 'WhatsApp', description: 'View WhatsApp logs' },

    // Reports
    { code: 'dashboard.view', module: 'Reports', category: 'Reports', description: 'View dashboard' },
    { code: 'reports.view', module: 'Reports', category: 'Reports', description: 'View reports' },
    { code: 'reports.export', module: 'Reports', category: 'Reports', description: 'Export reports' },
    { code: 'profit_analysis.view', module: 'Reports', category: 'Reports', description: 'View profit analysis' },

    // Employee
    { code: 'employee.view', module: 'Employee', category: 'Employee', description: 'View employees' },
    { code: 'employee.create', module: 'Employee', category: 'Employee', description: 'Create employees' },
    { code: 'employee.update', module: 'Employee', category: 'Employee', description: 'Update employees' },
    { code: 'employee.delete', module: 'Employee', category: 'Employee', description: 'Delete employees' },
    { code: 'employee.disable', module: 'Employee', category: 'Employee', description: 'Disable employees' },
    { code: 'permission.assign', module: 'Employee', category: 'Employee', description: 'Assign permissions' },
    { code: 'activity_log.view', module: 'Employee', category: 'Employee', description: 'View activity logs' }
];

async function migrate(conn = null) {
    const connection = conn || await db.getConnection();
    let shouldRelease = !conn;

    try {
        console.log('Starting migration: User-Based Permission System...\n');
        if (shouldRelease) await connection.beginTransaction();

        // 1. Add is_admin column to users (if not exists)
        console.log('1. Adding is_admin column to users table...');
        try {
            await connection.query(`
                ALTER TABLE users ADD COLUMN is_admin TINYINT(1) DEFAULT 0
            `);
            console.log('   ✓ Added is_admin column');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('   ✓ is_admin column already exists');
            } else {
                throw err;
            }
        }

        // 1b. Add last_login_at column to users table (if not exists)
        console.log('1b. Adding last_login_at column to users table...');
        try {
            await connection.query(`
                ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL
            `);
            console.log('   ✓ Added last_login_at column');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('   ✓ last_login_at column already exists');
            } else {
                // Ignore other errors
                console.log('   ⚠️ Failed to add last_login_at (might exist or other error):', err.message);
            }
        }

        // 2. Create employee_permissions table
        console.log('2. Creating employee_permissions table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS employee_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                permission_id INT NOT NULL,
                granted_by INT,
                granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
                UNIQUE KEY unique_emp_perm (employee_id, permission_id)
            )
        `);
        console.log('   ✓ Created employee_permissions table');

        // 3. Create activity_logs table
        console.log('3. Creating activity_logs table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                action VARCHAR(100) NOT NULL,
                module VARCHAR(50),
                entity_id INT,
                details TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_employee (employee_id),
                INDEX idx_created (created_at)
            )
        `);
        console.log('   ✓ Created activity_logs table');

        // 4. Seed permissions (upsert)
        console.log('4. Seeding permissions...');

        // First check if permissions table has 'code' column or 'name' column
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions'
        `);
        const columnNames = columns.map(c => c.COLUMN_NAME);
        const hasCode = columnNames.includes('code');
        const hasModule = columnNames.includes('module');

        // Add missing columns
        if (!hasCode) {
            console.log('   Adding code column to permissions table...');
            await connection.query(`ALTER TABLE permissions ADD COLUMN code VARCHAR(100)`);
            // Copy name to code for existing rows
            await connection.query(`UPDATE permissions SET code = name WHERE code IS NULL`);
        }
        if (!hasModule) {
            console.log('   Adding module column to permissions table...');
            await connection.query(`ALTER TABLE permissions ADD COLUMN module VARCHAR(50)`);
        }

        // Clear existing permissions and insert fresh
        await connection.query(`DELETE FROM employee_permissions`);
        await connection.query(`DELETE FROM role_permissions`);
        await connection.query(`DELETE FROM permissions`);

        for (const perm of PERMISSIONS) {
            await connection.query(`
                INSERT INTO permissions (code, name, module, category, description) 
                VALUES (?, ?, ?, ?, ?)
            `, [perm.code, perm.code, perm.module, perm.category, perm.description]);
        }
        console.log(`   ✓ Seeded ${PERMISSIONS.length} permissions`);

        // 5. Migrate admin users - set is_admin flag and assign all permissions
        console.log('5. Migrating admin users...');

        // Get admin users (is_system = 1 OR role is Super Admin/Admin)
        const [adminUsers] = await connection.query(`
            SELECT u.id, u.username, u.is_system, r.name as role_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.is_system = 1 OR r.name IN ('Super Admin', 'Admin', 'admin', 'super admin')
        `);

        // Get all permission IDs
        const [allPerms] = await connection.query(`SELECT id FROM permissions`);
        const permIds = allPerms.map(p => p.id);

        for (const user of adminUsers) {
            // Set is_admin flag
            await connection.query(`UPDATE users SET is_admin = 1 WHERE id = ?`, [user.id]);

            // Assign all permissions
            for (const permId of permIds) {
                await connection.query(`
                    INSERT IGNORE INTO employee_permissions (employee_id, permission_id, granted_by)
                    VALUES (?, ?, ?)
                `, [user.id, permId, user.id]);
            }
            console.log(`   ✓ Migrated user: ${user.username} (is_admin=1, ${permIds.length} permissions)`);
        }

        // 6. Remove role_id from non-admin users (optional - keep for reference)
        console.log('6. Cleanup...');
        // We'll keep role_id column for now but it won't be used
        // Drop roles tables after confirming migration works

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
