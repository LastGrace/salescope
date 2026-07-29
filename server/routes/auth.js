const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_generated_secret_key_849302194';

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[LOGIN ATTEMPT] Username: ${username}`);

    // Dev user backdoor removed for security

    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

        if (users.length === 0) {
            console.log('[LOGIN FAIL] User not found');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = users[0];

        // Check if user is disabled
        if (user.status === 'inactive' || user.status === 'disabled') {
            return res.status(403).json({ message: 'Account is disabled. Contact administrator.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            console.log('[LOGIN FAIL] Password mismatch');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Fetch permissions from employee_permissions (direct user-permission mapping)
        let permissions = [];
        try {
            const [perms] = await db.query(`
                SELECT p.code 
                FROM employee_permissions ep
                JOIN permissions p ON ep.permission_id = p.id
                WHERE ep.employee_id = ?
            `, [user.id]);
            permissions = perms.map(p => p.code);
            console.log(`[LOGIN] User ${username} has ${permissions.length} permissions`);
        } catch (permError) {
            console.error('[LOGIN ERROR] Failed to fetch permissions:', permError);
            // Don't block login if valid user, but return empty permissions or handle gracefully
            // For now, let's treat it as critical
            throw new Error('Failed to load user permissions: ' + permError.message);
        }

        // Create JWT with is_admin flag
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                is_admin: user.is_admin === 1 || user.is_admin === true
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update last login
        await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

        // Trigger background license status sync asynchronously upon login
        setImmediate(() => {
            const { getLicenseStatus } = require('../services/licenseService');
            getLicenseStatus(true).catch(err => console.error('[License Login Sync Failed]:', err.message));
        });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                image: user.profile_image,
                is_admin: user.is_admin === 1 || user.is_admin === true,
                permissions // List of permission codes e.g. ['pos.access', 'inventory.view']
            }
        });
    } catch (err) {
        console.error('[LOGIN CRITICAL ERROR]', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// Verify Password (for sensitive actions like Edit/Delete checks)
router.post('/verify-password', verifyToken, async (req, res) => {
    const { password, userId } = req.body;

    if (userId === undefined || userId === null || !password) {
        return res.status(400).json({ message: 'Missing credentials' });
    }

    try {

        const [users] = await db.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, users[0].password_hash);
        if (isMatch) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Invalid password' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get current user info (for refreshing permissions after changes)
router.get('/me', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Malformed token' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Dev user override removed for security

        const [users] = await db.query('SELECT id, username, name, is_admin, status, profile_image FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        // Fetch permissions
        const [perms] = await db.query(`
            SELECT p.code 
            FROM employee_permissions ep
            JOIN permissions p ON ep.permission_id = p.id
            WHERE ep.employee_id = ?
        `, [user.id]);

        res.json({
            id: user.id,
            username: user.username,
            name: user.name,
            image: user.profile_image,
            is_admin: user.is_admin === 1 || user.is_admin === true,
            permissions: perms.map(p => p.code)
        });
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: 'Invalid token' });
    }
});

module.exports = router;
