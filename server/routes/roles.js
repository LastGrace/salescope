const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/roles - List all roles
router.get('/', async (req, res) => {
    try {
        const [roles] = await db.query('SELECT * FROM roles ORDER BY id');

        // Fetch permissions for each role
        for (let role of roles) {
            const [perms] = await db.query(`
                SELECT p.id, p.name, p.category, p.description 
                FROM role_permissions rp 
                JOIN permissions p ON rp.permission_id = p.id 
                WHERE rp.role_id = ?
            `, [role.id]);
            role.permissions = perms;
        }

        res.json(roles);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/roles/permissions - List all available permissions
router.get('/permissions', async (req, res) => {
    try {
        const [permissions] = await db.query('SELECT * FROM permissions ORDER BY category, name');
        res.json(permissions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/roles - Create new role
router.post('/', async (req, res) => {
    const { name, description, permissions } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.query('INSERT INTO roles (name, description, is_system) VALUES (?, ?, FALSE)', [name, description]);
        const roleId = result.insertId;

        if (permissions && permissions.length > 0) {
            // permissions is array of permission IDs
            const values = permissions.map(pid => [roleId, pid]);
            await connection.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [values]);
        }

        await connection.commit();
        res.status(201).json({ id: roleId, name, description, permissions });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Role name already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});

// PUT /api/roles/:id - Update role
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Check if system role
        const [rows] = await connection.query('SELECT is_system FROM roles WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Role not found' });

        // Allow updating name/desc only if NOT system role (or allow desc update?)
        // Let's allow updating name/desc for custom roles, but maybe only desc for system roles?
        // Simplicity: Update basic info

        if (!rows[0].is_system) {
            await connection.query('UPDATE roles SET name = ?, description = ? WHERE id = ?', [name, description, id]);
        } else {
            // For system roles, maybe just update description? Or keep them locked?
            // Let's allow updating permissions for system roles to allow customization.
        }

        // Update Permissions: Delete all and re-insert
        await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [id]);

        if (permissions && permissions.length > 0) {
            const values = permissions.map(pid => [id, pid]);
            await connection.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [values]);
        }

        await connection.commit();
        res.json({ message: 'Role updated successfully' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});

// DELETE /api/roles/:id - Delete role
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT is_system FROM roles WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Role not found' });
        if (rows[0].is_system) return res.status(403).json({ message: 'Cannot delete system roles' });

        // Check if assigned to users
        const [users] = await db.query('SELECT COUNT(*) as count FROM users WHERE role_id = ?', [id]);
        if (users[0].count > 0) return res.status(400).json({ message: 'Cannot delete role assigned to users' });

        await db.query('DELETE FROM roles WHERE id = ?', [id]);
        res.json({ message: 'Role deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
