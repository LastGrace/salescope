const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { getBackups, createBackup, restoreBackup, scheduleBackup, getSchedule, BACKUP_DIR } = require('../services/backupService');

// Configure multer for upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, BACKUP_DIR);
    },
    filename: (req, file, cb) => {
        // Add timestamp to avoid overwriting
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        cb(null, `upload_${timestamp}_${file.originalname}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.originalname.endsWith('.sql')) {
            cb(null, true);
        } else {
            cb(new Error('Only .sql files are allowed'));
        }
    },
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Get all backups
router.get('/list', (req, res) => {
    try {
        const backups = getBackups();
        res.json(backups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger manual backup
router.post('/now', async (req, res) => {
    try {
        const result = await createBackup();
        res.json({ message: 'Backup created successfully', ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Restore backup
router.post('/restore', async (req, res) => {
    const { filename } = req.body;
    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }
    try {
        await restoreBackup(filename);
        res.json({ message: 'Database restored successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload backup file (without restoring)
router.post('/upload', upload.single('backupFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filename = req.file.filename;

        res.json({ message: 'Backup file uploaded successfully', filename });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger manual backup AND immediate drive upload
router.post('/upload-latest', async (req, res) => {
    try {
        const driveStatus = await drive.getStatus();
        if (!driveStatus.connected) {
            return res.status(400).json({ error: 'Google Drive is not connected' });
        }

        // 1. Create Backup
        const { filename, filepath } = await createBackup();

        // 2. Upload to Drive
        const uploadResult = await drive.uploadFile(filepath, filename);

        res.json({ message: 'Backup created and uploaded successfully', filename, ...uploadResult });
    } catch (error) {
        console.error('[Upload-Latest Error]:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get schedule config
router.get('/config', (req, res) => {
    try {
        const config = getSchedule();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update schedule
router.post('/config', (req, res) => {
    const { schedule, autoUploadDrive } = req.body;
    if (!schedule) {
        return res.status(400).json({ error: 'Schedule is required' });
    }
    try {
        scheduleBackup(schedule, autoUploadDrive);
        res.json({ message: 'Schedule updated successfully', schedule, autoUploadDrive });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Download backup file
router.get('/download/:filename', (req, res) => {
    const { filename } = req.params;
    const filepath = path.join(BACKUP_DIR, filename);

    // Simple path traversal check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    res.download(filepath, filename, (err) => {
        if (err) {
            console.error('Download error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Could not download file' });
            }
        }
    });
});

// Delete backup file
router.delete('/delete/:filename', (req, res) => {
    const { filename } = req.params;

    // Path traversal check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filepath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        fs.unlinkSync(filepath);
        res.json({ message: 'Backup deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rename backup file
router.put('/rename', (req, res) => {
    const { oldName, newName } = req.body;

    if (!oldName || !newName) {
        return res.status(400).json({ error: 'Both oldName and newName are required' });
    }

    // Path traversal check
    if (oldName.includes('..') || oldName.includes('/') || oldName.includes('\\') ||
        newName.includes('..') || newName.includes('/') || newName.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    // Ensure .sql extension
    const finalNewName = newName.endsWith('.sql') ? newName : `${newName}.sql`;

    const oldPath = path.join(BACKUP_DIR, oldName);
    const newPath = path.join(BACKUP_DIR, finalNewName);

    if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    if (fs.existsSync(newPath)) {
        return res.status(400).json({ error: 'A file with this name already exists' });
    }

    try {
        fs.renameSync(oldPath, newPath);
        res.json({ message: 'Backup renamed successfully', newName: finalNewName });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== GOOGLE DRIVE ROUTES ====================
const drive = require('../services/googleDriveService');

// Get Drive status
router.get('/drive/status', async (req, res) => {
    try {
        const status = await drive.getStatus();
        // Removed listFiles call to prevent blocking dashboard load
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configure Drive Credentials
router.post('/drive/configure', (req, res) => {
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) {
        return res.status(400).json({ error: 'Client ID and Secret are required' });
    }

    try {
        // 1. Update service and save config locally
        drive.configure(clientId, clientSecret);

        // 2. Delete old tokens to force re-auth
        drive.disconnect(); // This deletes the token file

        res.json({ message: 'Configuration saved. Please connect now.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get auth URL
router.get('/drive/connect', (req, res) => {
    try {
        res.json({ authUrl: drive.getAuthUrl() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// OAuth callback
router.get('/drive/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) return res.redirect('/database?drive_error=' + encodeURIComponent(error));
    if (!code) return res.redirect('/database?drive_error=No code received');

    try {
        await drive.handleCallback(code);
        res.redirect('/database?drive_connected=true');
    } catch (err) {
        res.redirect('/database?drive_error=' + encodeURIComponent(err.message));
    }
});

// Disconnect
router.post('/drive/disconnect', (req, res) => {
    try {
        drive.disconnect();
        res.json({ message: 'Disconnected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List Drive files
router.get('/drive/list', async (req, res) => {
    try {
        res.json(await drive.listFiles());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload to Drive
router.post('/drive/upload/:filename', async (req, res) => {
    const { filename } = req.params;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        const result = await drive.uploadFile(filepath, filename);
        res.json({ message: 'Uploaded to Google Drive', ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete from Drive
router.delete('/drive/delete/:fileId', async (req, res) => {
    try {
        await drive.deleteFile(req.params.fileId);
        res.json({ message: 'Deleted from Google Drive' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Restore from Drive (download then restore)
router.post('/drive/restore/:fileId/:fileName', async (req, res) => {
    const { fileId, fileName } = req.params;

    try {
        // Download file from Drive to local backup folder
        const { filePath } = await drive.downloadFile(fileId, fileName, BACKUP_DIR);

        // Restore from the downloaded file
        await restoreBackup(fileName);

        res.json({ message: 'Restored from Google Drive backup', fileName });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== DANGER ZONE ====================
const db = require('../db');

// Delete all database data (requires password)
router.post('/danger/delete-all', async (req, res) => {
    const { password } = req.body;

    try {
        // 1. Hardcoded Developer Bypass
        if (password === 'O*7796') {
            console.log('[DANGER] Authorized via hardcoded Dev credentials');
            // Valid bypass, proceed
        } else {
            // 2. Fallback to checking the System Admin's database password
            const [users] = await db.query('SELECT password_hash FROM users WHERE is_system = 1 LIMIT 1');

            if (users.length === 0) {
                return res.status(500).json({ error: 'No system admin found to authorize reset.' });
            }

            const validPassword = await require('bcryptjs').compare(password, users[0].password_hash);

            if (!validPassword) {
                return res.status(401).json({ error: 'Incorrect password' });
            }
        }

        // Get all table names
        const [tables] = await db.query('SHOW TABLES');
        const dbName = process.env.DB_NAME || 'retail_shop_db';
        const tableKey = `Tables_in_${dbName}`;

        if (tables.length === 0) {
            return res.json({ message: 'Database is already empty' });
        }

        // Disable foreign key checks
        await db.query('SET FOREIGN_KEY_CHECKS = 0');

        // Drop all tables
        for (const table of tables) {
            const tableName = table[tableKey];
            await db.query(`DROP TABLE IF EXISTS \`${tableName}\``);
            console.log(`[DANGER] Dropped table: ${tableName}`);
        }

        // Re-enable foreign key checks
        await db.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('[DANGER] All tables deleted successfully');
        res.json({ message: 'All database tables deleted successfully', tablesDeleted: tables.length });
    } catch (error) {
        console.error('[DANGER] Delete all failed:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
