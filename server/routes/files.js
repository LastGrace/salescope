const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const db = require('../db');
const { UPLOADS_DIR, SAMPLE_FILES_DIR } = require('../paths');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // Keep original filename but prepend timestamp to avoid collisions
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// GET /api/files/sample/:type - Download sample excel files
router.get('/sample/:type', async (req, res) => {
    const { type } = req.params;
    let filename;

    if (type === 'customer') {
        filename = 'Sample_Customer_excel.xlsx';
    } else if (type === 'inventory') {
        filename = 'Sample_Inventory_Excel.xlsx';
    } else {
        return res.status(400).json({ message: 'Invalid sample type' });
    }

    const filePath = path.join(SAMPLE_FILES_DIR, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ message: 'Sample file not found on server' });
    }
});

// GET /api/files - List all files
router.get('/', verifyToken, checkPermission('files.view'), async (req, res) => {
    try {
        const uploadDir = UPLOADS_DIR;

        if (!fs.existsSync(uploadDir)) {
            return res.json([]);
        }

        const files = fs.readdirSync(uploadDir).map(file => {
            const filePath = path.join(uploadDir, file);
            const stats = fs.statSync(filePath);

            return {
                name: file,
                size: stats.size,
                created_at: stats.birthtime,
                url: `/uploads/${file}`,
                type: path.extname(file).toLowerCase()
            };
        });

        // Sort by newest first
        files.sort((a, b) => b.created_at - a.created_at);

        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error listing files' });
    }
});

// POST /api/files - Upload file
router.post('/', verifyToken, checkPermission('files.upload'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Log activity
        await db.query(
            'INSERT INTO activity_logs (employee_id, action, module, details) VALUES (?, ?, ?, ?)',
            [req.user.id, 'file.upload', 'Files', JSON.stringify({ filename: req.file.filename, size: req.file.size })]
        );

        res.status(201).json({
            message: 'File uploaded successfully',
            file: {
                name: req.file.filename,
                size: req.file.size,
                url: `/uploads/${req.file.filename}`
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error uploading file' });
    }
});

// DELETE /api/files/:filename - Delete file
router.delete('/:filename', verifyToken, checkPermission('files.delete'), async (req, res) => {
    const { filename } = req.params;

    try {
        // Prevent directory traversal
        const safeFilename = path.basename(filename);
        const filePath = path.join(UPLOADS_DIR, safeFilename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        fs.unlinkSync(filePath);

        // Log activity
        await db.query(
            'INSERT INTO activity_logs (employee_id, action, module, details) VALUES (?, ?, ?, ?)',
            [req.user.id, 'file.delete', 'Files', JSON.stringify({ filename })]
        );

        res.json({ message: 'File deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error downloading file' });
    }
});

module.exports = router;
