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
        const { phone, message } = req.body;
        const result = await getWa().sendText(phone, message);
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
        const { phone, caption } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        await getWa().sendMedia(phone, file, caption);
        res.json({ success: true });
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

module.exports = router;
