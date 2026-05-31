const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { verifyToken, checkPermission, requireAdmin } = require('../middleware/authMiddleware');

// GET /api/employees - List all employees
router.get('/', verifyToken, checkPermission('employee.view'), async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, u.name, u.username, u.email, u.phone, 
                u.status, u.is_admin, u.is_system, u.created_at, u.last_login_at,
                (SELECT COUNT(*) FROM employee_permissions WHERE employee_id = u.id) as permission_count
            FROM users u
            ORDER BY u.is_system DESC, u.is_admin DESC, u.created_at DESC
        `;
        const [employees] = await db.query(query);
        res.json(employees);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/employees/permissions/all - Get all available permissions
router.get('/permissions/all', verifyToken, checkPermission('employee.view'), async (req, res) => {
    try {
        const [permissions] = await db.query(`
            SELECT id, code, module, category, description
            FROM permissions
            ORDER BY category, module, code
        `);
        res.json(permissions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/employees/activity-logs - Get activity logs
router.get('/activity-logs', verifyToken, checkPermission('activity_log.view'), async (req, res) => {
    try {
        const { employee_id, limit = 100 } = req.query;
        let limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) limitNum = 100;

        let query = `
            SELECT al.*, u.name as employee_name, u.username
            FROM activity_logs al
            LEFT JOIN users u ON al.employee_id = u.id
        `;
        const params = [];

        if (employee_id) {
            query += ' WHERE al.employee_id = ?';
            params.push(employee_id);
        }

        query += ' ORDER BY al.created_at DESC LIMIT ?';
        params.push(limitNum);

        const [logs] = await db.query(query, params);
        res.json(logs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/employees/:id - Get single employee
router.get('/:id', verifyToken, checkPermission('employee.view'), async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT id, name, username, email, phone, status, is_admin, is_system, profile_image, created_at, last_login_at
            FROM users WHERE id = ?
        `, [req.params.id]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json(users[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/employees/:id/permissions - Get employee's permissions
router.get('/:id/permissions', verifyToken, checkPermission('employee.view'), async (req, res) => {
    try {
        const [permissions] = await db.query(`
            SELECT p.id, p.code, p.module, p.category, p.description
            FROM employee_permissions ep
            JOIN permissions p ON ep.permission_id = p.id
            WHERE ep.employee_id = ?
            ORDER BY p.category, p.code
        `, [req.params.id]);
        res.json(permissions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/employees/:id/permissions - Update employee's permissions
router.put('/:id/permissions', verifyToken, checkPermission('permission.assign'), async (req, res) => {
    const { id } = req.params;
    const { permission_ids } = req.body; // Array of permission IDs

    if (!Array.isArray(permission_ids)) {
        return res.status(400).json({ message: 'permission_ids must be an array' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Check if target is system user
        const [target] = await connection.query('SELECT is_system FROM users WHERE id = ?', [id]);
        if (target.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Super Admin permissions cannot be modified
        if (target[0].is_system) {
            await connection.rollback();
            return res.status(403).json({ message: 'Cannot modify Super Admin permissions' });
        }

        // Delete existing permissions
        await connection.query('DELETE FROM employee_permissions WHERE employee_id = ?', [id]);

        // Insert new permissions
        if (permission_ids.length > 0) {
            const values = permission_ids.map(pid => [id, pid, req.user.id]);
            await connection.query(
                'INSERT INTO employee_permissions (employee_id, permission_id, granted_by) VALUES ?',
                [values]
            );
        }

        // Log activity
        await connection.query(
            'INSERT INTO activity_logs (employee_id, action, module, entity_id, details) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'permission.update', 'Employee', id, JSON.stringify({ permissions_count: permission_ids.length })]
        );

        await connection.commit();
        res.json({ message: 'Permissions updated', count: permission_ids.length });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});

// POST /api/employees - Create employee
router.post('/', verifyToken, checkPermission('employee.create'), async (req, res) => {
    const { name, username, password, phone, role, status = 'active', is_admin = false } = req.body;

    // Basic validation
    if (!name || !username || !password) {
        return res.status(400).json({ message: 'Name, username, and password are required' });
    }

    try {
        // Check availability
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await db.query(
            'INSERT INTO users (name, username, password_hash, phone, status, role, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, username, hashedPassword, phone, status, role || 'staff', is_admin ? 1 : 0]
        );

        // Log activity
        await db.query(
            'INSERT INTO activity_logs (employee_id, action, module, entity_id, details) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'employee.create', 'Employee', result.insertId, JSON.stringify({ username })]
        );

        res.status(201).json({ message: 'Employee created', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/employees/:id - Update employee
router.put('/:id', verifyToken, checkPermission('employee.update'), async (req, res) => {
    const { id } = req.params;
    const { name, username, phone, status, password, is_admin } = req.body;

    try {
        // Fetch current user to check if system
        const [currentUser] = await db.query('SELECT is_system, is_admin FROM users WHERE id = ?', [id]);
        if (currentUser.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Cannot modify system user's admin status
        if (currentUser[0].is_system) {
            if (is_admin === false || is_admin === 0) {
                return res.status(403).json({ message: 'Cannot revoke admin from Super Admin' });
            }
            if (status === 'inactive' || status === 'disabled') {
                return res.status(403).json({ message: 'Cannot disable Super Admin account' });
            }
        }

        let query = 'UPDATE users SET name = ?, username = ?, phone = ?, status = ?';
        let params = [name, username, phone, status];

        // Update is_admin only if not system user
        if (!currentUser[0].is_system) {
            query += ', is_admin = ?';
            params.push(is_admin ? 1 : 0);
        }

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            query += ', password_hash = ?';
            params.push(hashedPassword);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await db.query(query, params);

        // Log activity
        await db.query(
            'INSERT INTO activity_logs (employee_id, action, module, entity_id, details) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'employee.update', 'Employee', id, JSON.stringify({ name })]
        );

        res.json({ message: 'Employee updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/employees/:id - Delete employee
router.delete('/:id', verifyToken, checkPermission('employee.delete'), async (req, res) => {
    const { id } = req.params;

    try {
        // Check if system user
        const [user] = await db.query('SELECT is_system, username FROM users WHERE id = ?', [id]);

        if (user.length > 0) {
            const isSystem = user[0].is_system;
            if (isSystem === 1 || isSystem === true || isSystem === '1') {
                return res.status(403).json({ message: 'Cannot delete Super Admin account' });
            }
        }

        await db.query('DELETE FROM users WHERE id = ?', [id]);

        // Log activity
        await db.query(
            'INSERT INTO activity_logs (employee_id, action, module, entity_id, details) VALUES (?, ?, ?, ?, ?)',
            [req.user.id || null, 'employee.delete', 'Employee', id, JSON.stringify({ username: user[0]?.username })]
        );

        res.json({ message: 'Employee deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/employees/:id/disable - Disable employee
router.post('/:id/disable', verifyToken, checkPermission('employee.disable'), async (req, res) => {
    const { id } = req.params;

    try {
        const [user] = await db.query('SELECT is_system FROM users WHERE id = ?', [id]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        if (user[0].is_system) {
            return res.status(403).json({ message: 'Cannot disable Super Admin account' });
        }

        await db.query('UPDATE users SET status = ? WHERE id = ?', ['inactive', id]);
        res.json({ message: 'Employee disabled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/employees/:id/enable - Enable employee
router.post('/:id/enable', verifyToken, checkPermission('employee.disable'), async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('UPDATE users SET status = ? WHERE id = ?', ['active', id]);
        res.json({ message: 'Employee enabled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
