const express = require("express");
const router = express.Router();
const multer = require("multer");

let waService = null;
const getWa = () => {
    if (!waService) {
        waService = require("../services/whatsappService");
    }
    return waService;
};

const campaignService = require("../services/campaignService");

// GET current connection status
router.get("/status", (req, res) => {
    const status = getWa().getStatus();
    res.json({ status });
});

// Start WhatsApp engine
router.post("/start", async (req, res) => {
    try {
        await getWa().initWhatsApp();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Restart WhatsApp engine
router.post("/restart", async (req, res) => {
    try {
        await getWa().destroyClient();
        await getWa().initWhatsApp();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Disconnect/Logout WhatsApp
router.post("/logout", async (req, res) => {
    try {
        await getWa().logout();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// SSE endpoint for real-time status updates
router.get("/stream", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE with client

    const wa = getWa();
    
    // Send initial state immediately
    const initialState = {
        status: wa.getStatus(),
        qr: wa.getQr()
    };
    res.write(`data: ${JSON.stringify(initialState)}\n\n`);
    if (res.flush) res.flush();

    // Listeners for updates
    const onStatusChange = (status) => {
        res.write(`data: ${JSON.stringify({ status, qr: wa.getQr() })}\n\n`);
        if (res.flush) res.flush();
    };

    const onQrChange = (qr) => {
        res.write(`data: ${JSON.stringify({ status: wa.getStatus(), qr })}\n\n`);
        if (res.flush) res.flush();
    };

    wa.waEvents.on('status_change', onStatusChange);
    wa.waEvents.on('qr_change', onQrChange);

    // Clean up when client disconnects
    req.on('close', () => {
        wa.waEvents.off('status_change', onStatusChange);
        wa.waEvents.off('qr_change', onQrChange);
    });
});

// Browser-friendly QR rendering (Raw text for debugging)
router.get("/qr", (req, res) => {
    const qr = getWa().getQr();
    if (!qr) {
        return res.send(`
      <html>
        <body style="text-align:center;font-family:sans-serif">
          <h2>QR not ready yet...</h2>
          <p>Status: ${getWa().getStatus()}</p>
          <p>Refresh in a few seconds.</p>
        </body>
      </html>
    `);
    }

    res.send({ qr });
});

// REST endpoint for QR
router.get("/qr-data", (req, res) => {
    const status = getWa().getStatus();
    const qr = getWa().getQr();

    if (status === "connected") {
        return res.json({ status: "connected", qr: null });
    }

    if (!qr) {
        return res.json({ status: "pending", qr: null });
    }

    res.json({ status: "qr", qr: qr });
});

router.post("/init", async (req, res) => {
    try {
        await getWa().initWhatsApp();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Logout endpoint - clears session and forces new QR
router.post("/logout", async (req, res) => {
    try {
        await getWa().logout();
        res.json({ success: true, message: 'Logged out. Restart server and click Start Engine to get new QR.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post("/sendText", async (req, res) => {
    try {
        const { phone, message, feature } = req.body;
        const provider = await require("../services/messagingProviderFactory").getProvider(feature || 'general');
        const result = await provider.sendText(phone, message);
        // result = { delivered: boolean, msgId: string }
        res.json({ success: true, delivered: result.delivered, msgId: result.msgId });
    } catch (e) {
        console.error('[API] sendText failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

const fs = require("fs");
const path = require("path");
const paths = require("../paths");

const uploadDir = path.join(paths.UPLOADS_DIR, "temp");
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch(e) {
        console.error("Failed to create temp upload dir:", e.message);
    }
}

const upload = multer({ dest: uploadDir });

router.post("/sendMedia", upload.single('file'), async (req, res) => {
    try {
        const { phone, caption, feature } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const provider = await require("../services/messagingProviderFactory").getProvider(feature || 'general');
        const result = await provider.sendMedia(phone, file, caption);
        res.json({ success: true, delivered: result.delivered, msgId: result.msgId });
    } catch (e) {
        console.error("Send Media Error:", e);
        res.status(500).json({ error: e.message });
    } finally {
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error cleaning up temp file:", err);
            });
        }
    }
});

// ─── Bulk Campaign Endpoints ─────────────────────────────────────────────────

// Start a bulk campaign (runs entirely on the server in background)
router.post("/campaign/start", upload.single('file'), async (req, res) => {
    try {
        const { mode, message, customers: customersJson } = req.body;
        let customers;
        try {
            customers = JSON.parse(customersJson);
        } catch (e) {
            return res.status(400).json({ success: false, error: 'Invalid customers JSON' });
        }

        const result = campaignService.startCampaign({
            mode: mode || 'text',
            message: message || '',
            customers,
            filePath: req.file ? req.file.path : null,
            fileOriginalName: req.file ? req.file.originalname : null,
            fileMimetype: req.file ? req.file.mimetype : null
        });

        if (!result.success) {
            // Clean up uploaded file if campaign could not start
            if (req.file && req.file.path) {
                const fs = require('fs');
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (e) {
        console.error('[API] campaign/start error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get current campaign status (poll this from the frontend)
router.get("/campaign/status", (req, res) => {
    res.json(campaignService.getStatus());
});

// Cancel a running campaign
router.post("/campaign/cancel", (req, res) => {
    const result = campaignService.cancelCampaign();
    res.json(result);
});

// GET all blocklisted numbers
router.get("/blocklist", async (req, res) => {
    try {
        const db = require("../db");
        const [rows] = await db.query("SELECT * FROM whatsapp_blocklist ORDER BY created_at DESC");
        res.json({ success: true, blocklist: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ADD number to blocklist manually
router.post("/blocklist/add", async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: "Phone number is required" });
        const rawPhone = phone.replace(/\D/g, '');
        const db = require("../db");
        await db.query("INSERT IGNORE INTO whatsapp_blocklist (phone) VALUES (?)", [rawPhone]);
        res.json({ success: true, message: `Number ${rawPhone} added to blocklist` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// REMOVE number from blocklist manually
router.post("/blocklist/remove", async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: "Phone number is required" });
        const rawPhone = phone.replace(/\D/g, '');
        const db = require("../db");
        await db.query("DELETE FROM whatsapp_blocklist WHERE phone = ?", [rawPhone]);
        res.json({ success: true, message: `Number ${rawPhone} removed from blocklist` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET campaign history logs from DB
router.get("/campaigns/history", async (req, res) => {
    try {
        const db = require("../db");
        const [rows] = await db.query("SELECT * FROM whatsapp_campaigns ORDER BY started_at DESC LIMIT 50");
        
        // Parse JSON fields safely
        const parsed = rows.map(row => ({
            ...row,
            running: row.running === 1,
            cancelled: row.cancelled === 1,
            logs: typeof row.logs === 'string' ? JSON.parse(row.logs) : row.logs,
            customers: typeof row.customers === 'string' ? JSON.parse(row.customers) : row.customers
        }));
        
        res.json({ success: true, campaigns: parsed });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET individual message logs from DB
router.get("/logs", async (req, res) => {
    try {
        const db = require("../db");
        const [rows] = await db.query("SELECT * FROM whatsapp_message_logs ORDER BY created_at DESC LIMIT 200");
        res.json({ success: true, logs: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
