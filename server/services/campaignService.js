/**
 * campaignService.js
 * Manages bulk WhatsApp campaigns with database persistence.
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

const saveCampaignToDb = async () => {
    if (!campaign.id) return;
    try {
        const db = require('../db');
        await db.query(
            `INSERT INTO whatsapp_campaigns (id, running, cancelled, mode, message, file_path, file_name, file_mimetype, total, sent, failed, started_at, finished_at, logs, customers) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             running = VALUES(running), cancelled = VALUES(cancelled), sent = VALUES(sent), failed = VALUES(failed), 
             finished_at = VALUES(finished_at), logs = VALUES(logs)`,
            [
                campaign.id,
                campaign.running ? 1 : 0,
                campaign.cancelled ? 1 : 0,
                campaign.mode,
                campaign.message,
                campaign.filePath,
                campaign.fileOriginalName,
                campaign.fileMimetype,
                campaign.total,
                campaign.sent,
                campaign.failed,
                campaign.startedAt,
                campaign.finishedAt,
                JSON.stringify(campaign.logs),
                JSON.stringify(campaign.customers)
            ]
        );
    } catch (e) {
        console.error('[Campaign DB] Failed to save campaign:', e.message);
    }
};

const loadLatestCampaignFromDb = async () => {
    try {
        const db = require('../db');
        const [rows] = await db.query('SELECT * FROM whatsapp_campaigns ORDER BY started_at DESC LIMIT 1');
        if (rows.length > 0) {
            const row = rows[0];
            campaign = {
                id: row.id,
                running: row.running === 1,
                cancelled: row.cancelled === 1,
                mode: row.mode,
                message: row.message,
                filePath: row.file_path,
                fileOriginalName: row.file_name,
                fileMimetype: row.file_mimetype,
                total: row.total,
                sent: row.sent,
                failed: row.failed,
                startedAt: row.started_at,
                finishedAt: row.finished_at,
                logs: typeof row.logs === 'string' ? JSON.parse(row.logs) : row.logs || [],
                customers: typeof row.customers === 'string' ? JSON.parse(row.customers) : row.customers || []
            };
            
            // If the campaign is marked as running but the server has restarted, it means it got interrupted
            if (campaign.running) {
                console.log(`[Campaign DB] Campaign ${campaign.id} was running but got interrupted. Marking as stopped.`);
                campaign.running = false;
                campaign.logs.push({
                    time: new Date().toLocaleTimeString('en-IN'),
                    msg: '⚠️ Campaign interrupted by server shutdown.',
                    type: 'error'
                });
                await saveCampaignToDb();
            } else {
                console.log(`[Campaign DB] Loaded latest campaign state ${campaign.id} successfully.`);
            }
        }
    } catch (e) {
        console.error('[Campaign DB] Failed to load latest campaign:', e.message);
    }
};

// Eagerly load the last campaign on service import
loadLatestCampaignFromDb();

const addLog = (msg, type = 'info') => {
    campaign.logs.push({ time: new Date().toLocaleTimeString('en-IN'), msg, type });
    // Keep logs capped at 500 to avoid unbounded memory growth
    if (campaign.logs.length > 500) campaign.logs.shift();
    saveCampaignToDb();
};

const updateLastLog = (msg, type = 'success') => {
    if (campaign.logs.length > 0) {
        campaign.logs[campaign.logs.length - 1] = {
            time: new Date().toLocaleTimeString('en-IN'),
            msg,
            type
        };
        saveCampaignToDb();
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Campaign Runner ──────────────────────────────────────────────────────────
const runCampaign = async () => {
    const providerFactory = require('./messagingProviderFactory');
    const wa = await providerFactory.getProvider('bulk');

    addLog(`Starting batch (${campaign.mode.toUpperCase()}) for ${campaign.total} customers`, 'info');

    for (const customer of campaign.customers) {
        if (campaign.cancelled) {
            addLog('Campaign cancelled by user.', 'error');
            break;
        }

        // Skip sending if customer phone is in the blocklist
        try {
            const db = require('../db');
            const rawPhone = customer.phone.replace(/\D/g, '');
            const [blocklisted] = await db.query('SELECT 1 FROM whatsapp_blocklist WHERE phone = ?', [rawPhone]);
            if (blocklisted.length > 0) {
                addLog(`Skipped: ${customer.name} — Number has opted out (blocklisted)`, 'error');
                campaign.failed++;
                await saveCampaignToDb();
                continue;
            }
        } catch (dbErr) {
            console.error('[Campaign] Blocklist check error:', dbErr.message);
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

        await saveCampaignToDb();

        // Small delay between sends (on top of whatsappService queue's delay)
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
    
    await saveCampaignToDb();
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a new bulk campaign.
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

    saveCampaignToDb().then(() => {
        // Fire and forget — runs entirely in background
        runCampaign().catch(err => {
            console.error('[Campaign] Unexpected error in runCampaign:', err);
            campaign.running = false;
            addLog('Campaign crashed: ' + err.message, 'error');
            saveCampaignToDb();
        });
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
    saveCampaignToDb();
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
