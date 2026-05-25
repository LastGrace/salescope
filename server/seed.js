const db = require('./db');
const bcrypt = require('bcryptjs');

const seed = async () => {
    let connection;
    try {
        connection = await db.getConnection();
        console.log('[DB Seed] Seeding database...');
        await connection.beginTransaction();

        // 1. Ensure Schema Updates (is_system column)
        try {
            await connection.query('SELECT is_system FROM users LIMIT 1');
        } catch (e) {
            console.log('Adding is_system column to users table...');
            await connection.query('ALTER TABLE users ADD COLUMN is_system BOOLEAN DEFAULT FALSE');
        }
        try {
            await connection.query('SELECT is_system FROM roles LIMIT 1');
        } catch (e) {
            console.log('Adding is_system column to roles table...');
            await connection.query('ALTER TABLE roles ADD COLUMN is_system BOOLEAN DEFAULT FALSE');
        }

        // 4. Ensure Super Admin Role
        let roleId;
        const [roles] = await connection.query('SELECT id FROM roles WHERE name = "Super Admin"');
        if (roles.length === 0) {
            console.log('Creating Super Admin role...');
            const [res] = await connection.query('INSERT INTO roles (name, description, is_system) VALUES (?, ?, ?)', ['Super Admin', 'Full Access', true]);
            roleId = res.insertId;

            // Assign all permissions
            const [allPerms] = await connection.query('SELECT id FROM permissions');
            for (const perm of allPerms) {
                await connection.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, perm.id]);
            }
        } else {
            roleId = roles[0].id;
            // Ensure it is system
            await connection.query('UPDATE roles SET is_system = 1 WHERE id = ?', [roleId]);
        }

        // 5. Ensure Admin User
        const [users] = await connection.query('SELECT id FROM users WHERE username = "admin"');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        if (users.length === 0) {
            console.log('Creating admin user...');
            await connection.query(
                'INSERT INTO users (name, username, password_hash, role_id, status, is_system) VALUES (?, ?, ?, ?, ?, ?)',
                ['Super Admin', 'admin', hashedPassword, roleId, 'active', 1]
            );
        } else {
            console.log('Updating admin user...');
            // Enforce super admin state
            await connection.query(
                'UPDATE users SET role_id = ?, status = "active", is_system = 1 WHERE username = "admin"',
                [roleId]
            );
            await connection.query('UPDATE users SET password_hash = ? WHERE username = "admin"', [hashedPassword]);
        }

        await connection.commit();
        console.log('[DB Seed] Database seeded/verified successfully! Admin: admin / admin123');

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('[DB Seed] Seed failed:', err.message);
    } finally {
        if (connection) connection.release();
    }
};

module.exports = seed;
