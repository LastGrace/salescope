const whatsappService = require('../services/whatsappService');
const path = require('path');
const fs = require('fs');

// Initialize Engine
exports.initialize = async (req, res) => {
    try {
        await whatsappService.initialize();
        res.json({ success: true, message: 'WhatsApp Engine Initialization Triggered' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get Status
exports.getStatus = async (req, res) => {
    try {
        const stats = await whatsappService.getStatus();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get QR Code
exports.getQr = async (req, res) => {
    const qr = whatsappService.getQr();
    res.json({ qr });
};

// Send Text Message
exports.sendText = async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message required' });
    }

    try {
        const result = await whatsappService.sendText(phone, message);
        res.json({ success: true, result });
    } catch (error) {
        console.error('SendText Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Send Media (Images/Docs)
exports.sendMedia = async (req, res) => {
    if (!req.file || !req.body.phone) {
        return res.status(400).json({ error: 'File and phone number required' });
    }

    const { phone, caption } = req.body;
    const filePath = path.resolve(req.file.path);
    const mime = req.file.mimetype;

    try {
        let result;
        if (mime.includes('image')) {
            result = await whatsappService.sendImage(phone, filePath, caption);
        } else {
            result = await whatsappService.sendDocument(phone, filePath, req.file.originalname, caption);
        }
        res.json({ success: true, result });
    } catch (error) {
        console.error('SendMedia Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Legacy Support for 'Send Bill'
exports.sendBill = async (req, res) => {
    const { phone, customMessage } = req.body;
    try {
        const result = await whatsappService.sendText(phone, customMessage);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Bulk Sender
exports.sendBulk = async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages array' });
    }

    try {
        const result = await whatsappService.sendBulk(messages);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
