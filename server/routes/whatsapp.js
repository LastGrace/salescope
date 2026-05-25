const express = require("express");
const router = express.Router();
const multer = require("multer");

const whatsapp = require("../services/whatsappService");

// GET current connection status
router.get("/status", (req, res) => {
    const status = whatsapp.getStatus();
    res.json({ status });
});

// Browser-friendly QR rendering (Raw text for debugging)
router.get("/qr", (req, res) => {
    const qr = whatsapp.getQr();
    if (!qr) {
        return res.send(`
      <html>
        <body style="text-align:center;font-family:sans-serif">
          <h2>QR not ready yet...</h2>
          <p>Status: ${whatsapp.getStatus()}</p>
          <p>Refresh in a few seconds.</p>
        </body>
      </html>
    `);
    }

    res.send({ qr });
});

// REST endpoint for QR
router.get("/qr-data", (req, res) => {
    const status = whatsapp.getStatus();
    const qr = whatsapp.getQr();

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
        await whatsapp.initWhatsApp();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Logout endpoint - clears session and forces new QR
router.post("/logout", async (req, res) => {
    try {
        await whatsapp.logout();
        res.json({ success: true, message: 'Logged out. Restart server and click Start Engine to get new QR.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post("/sendText", async (req, res) => {
    try {
        const { phone, message } = req.body;
        const result = await whatsapp.sendText(phone, message);
        // result = { delivered: boolean, msgId: string }
        res.json({ success: true, delivered: result.delivered, msgId: result.msgId });
    } catch (e) {
        console.error('[API] sendText failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

const upload = multer({ storage: multer.memoryStorage() });

router.post("/sendMedia", upload.single('file'), async (req, res) => {
    try {
        const { phone, caption } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        await whatsapp.sendMedia(phone, file, caption);
        res.json({ success: true });
    } catch (e) {
        console.error("Send Media Error:", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
