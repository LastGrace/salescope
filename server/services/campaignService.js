/**
 * campaignService.js
 * Manages bulk WhatsApp campaigns entirely on the server side.
 * The send loop runs in Node.js — it persists regardless of frontend navigation.
 */

const fs = require('fs');

// ─── Campaign State ──────────────────────────────────────────────────────────
let campaign = {
    id: null,
    running: false,
    cancelled: false,
    mode: 'text',        // 'text' | 'media'
    message: '',
    filePath: null,      // temp file path for media campaigns
    fileOriginalName: null,
    fileMimetype: null,
    customers: [],       // [{ id, name, phone }]
    total: 0,
    sent: 0,
    failed: 0,
    logs: [],            // [{ time, msg, type }]
    startedAt: null,
    finishedAt: null
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const generateId = () => `camp_${Date.now()}`;

const addLog = (msg, type = 'info') => {
    campaign.logs.push({ time: new Date().toLocaleTimeString('en-IN'), msg, type });
    // Keep logs capped at 500 to avoid unbounded memory growth
    if (campaign.logs.length > 500) campaign.logs.shift();
};

const updateLastLog = (msg, type = 'success') => {
    if (campaign.logs.length > 0) {
        campaign.logs[campaign.logs.length - 1] = {
            time: new Date().toLocaleTimeString('en-IN'),
            msg,
            type
        };
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Campaign Runner ──────────────────────────────────────────────────────────
const runCampaign = async () => {
    const wa = require('./whatsappService');

    addLog(`Starting batch (${campaign.mode.toUpperCase()}) for ${campaign.total} customers`, 'info');

    for (const customer of campaign.customers) {
        if (campaign.cancelled) {
            addLog('Campaign cancelled by user.', 'error');
            break;
        }

        addLog(`Sending to ${customer.name}...`, 'info');

        try {
            if (campaign.mode === 'media') {
                // Build a file-like object that sendMedia expects (mimics multer's req.file)
                const fileObj = {
                    path: campaign.filePath,
                    originalname: campaign.fileOriginalName,
                    mimetype: campaign.fileMimetype,
                    size: fs.existsSync(campaign.filePath) ? fs.statSync(campaign.filePath).size : 0
                };
                await wa.sendMedia(customer.phone, fileObj, campaign.message);
            } else {
                await wa.sendText(customer.phone, campaign.message);
            }

            updateLastLog(`✓ Sent to ${customer.name}`, 'success');
            campaign.sent++;
        } catch (err) {
            updateLastLog(`✗ Failed: ${customer.name} — ${err.message}`, 'error');
            campaign.failed++;
        }

        // Small delay between sends (on top of whatsappService queue's 2.5s delay)
        await sleep(500);
    }

    // Cleanup temp file if it was a media campaign
    if (campaign.mode === 'media' && campaign.filePath && fs.existsSync(campaign.filePath)) {
        try {
            fs.unlinkSync(campaign.filePath);
        } catch (e) {
            console.error('[Campaign] Failed to delete temp file:', e.message);
        }
        campaign.filePath = null;
    }

    campaign.running = false;
    campaign.finishedAt = new Date().toISOString();

    if (campaign.cancelled) {
        addLog(`Campaign stopped. Sent: ${campaign.sent}, Failed: ${campaign.failed}`, 'error');
    } else {
        addLog(`✅ Batch complete! Sent: ${campaign.sent}, Failed: ${campaign.failed}`, 'success');
    }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a new bulk campaign.
 * @param {object} options
 * @param {'text'|'media'} options.mode
 * @param {string} options.message
 * @param {Array<{id,name,phone}>} options.customers
 * @param {string} [options.filePath]       - Absolute path to the uploaded temp file
 * @param {string} [options.fileOriginalName]
 * @param {string} [options.fileMimetype]
 * @returns {{ success: boolean, campaignId: string, error?: string }}
 */
const startCampaign = (options) => {
    if (campaign.running) {
        return { success: false, error: 'A campaign is already running.' };
    }

    const { mode, message, customers, filePath, fileOriginalName, fileMimetype } = options;

    if (!customers || customers.length === 0) {
        return { success: false, error: 'No customers provided.' };
    }
    if (mode === 'text' && !message) {
        return { success: false, error: 'Message is required for text mode.' };
    }
    if (mode === 'media' && !filePath) {
        return { success: false, error: 'File is required for media mode.' };
    }

    // Reset campaign state
    campaign = {
        id: generateId(),
        running: true,
        cancelled: false,
        mode,
        message: message || '',
        filePath: filePath || null,
        fileOriginalName: fileOriginalName || null,
        fileMimetype: fileMimetype || null,
        customers,
        total: customers.length,
        sent: 0,
        failed: 0,
        logs: [],
        startedAt: new Date().toISOString(),
        finishedAt: null
    };

    // Fire and forget — runs entirely in background
    runCampaign().catch(err => {
        console.error('[Campaign] Unexpected error in runCampaign:', err);
        campaign.running = false;
        addLog('Campaign crashed: ' + err.message, 'error');
    });

    return { success: true, campaignId: campaign.id };
};

/**
 * Cancel a running campaign.
 */
const cancelCampaign = () => {
    if (!campaign.running) {
        return { success: false, error: 'No campaign is running.' };
    }
    campaign.cancelled = true;
    return { success: true };
};

/**
 * Get the current campaign status snapshot.
 */
const getStatus = () => {
    return {
        id: campaign.id,
        running: campaign.running,
        cancelled: campaign.cancelled,
        mode: campaign.mode,
        total: campaign.total,
        sent: campaign.sent,
        failed: campaign.failed,
        logs: campaign.logs,
        startedAt: campaign.startedAt,
        finishedAt: campaign.finishedAt
    };
};

module.exports = { startCampaign, cancelCampaign, getStatus };
