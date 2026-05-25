const path = require('path');
const fs = require('fs');
const { CHROMIUM_PATH, WA_AUTH_DIR } = require('../paths');

let Client, LocalAuth, MessageMedia, QRCode;
function loadWaCore() {
    if (!Client) {
        const wa = require('whatsapp-web.js');
        Client = wa.Client;
        LocalAuth = wa.LocalAuth;
        MessageMedia = wa.MessageMedia;
        QRCode = require('qrcode');
    }
}

let clientInstance = null;
let qrCodeData = null;
let ready = false;
let isAuthenticated = false;
let heartbeatTimer = null;
let reconnectTimer = null;
let isInitializing = false;

// Stop heartbeat & reconnect timers
const stopTimers = () => {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
};

// Auto-reconnect after disconnect
const scheduleReconnect = (delayMs = 30000) => {
    stopTimers();
    console.log(`[WA] Scheduling auto-reconnect in ${delayMs / 1000}s...`);
    reconnectTimer = setTimeout(async () => {
        if (!clientInstance) {
            console.log('[WA] Auto-reconnecting...');
            try { await initWhatsApp(); } catch (e) { console.error('[WA] Auto-reconnect failed:', e.message); }
        }
    }, delayMs);
};

// Heartbeat: verify page is alive every 90s
const startHeartbeat = (client) => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
        if (!clientInstance) { clearInterval(heartbeatTimer); return; }
        try {
            await client.getState();
        } catch (e) {
            console.warn('[WA] Heartbeat failed — triggering reconnect:', e.message);
            ready = false;
            isAuthenticated = false;
            clientInstance = null;
            try { await client.destroy(); } catch (_) { }
            scheduleReconnect(10000);
        }
    }, 90000);
};

// Initialize WhatsApp Client
const initWhatsApp = async () => {
    if (clientInstance) {
        console.log('[WA] Client already initialized. Skipping.');
        return;
    }
    if (isInitializing) {
        console.log('[WA] Initialization already in progress. Skipping.');
        return;
    }
    isInitializing = true;

    try {
        console.log('[WA] Initializing WhatsApp Client...');

        const chromePath = CHROMIUM_PATH;
        console.log('[WA] Using Chrome at:', chromePath);

        // Prevent "browser is already running" error by removing session lock
        const sessionDir = path.join(WA_AUTH_DIR, 'session-ims_v1');
        const lockFile = path.join(sessionDir, 'SingletonLock');
        
        if (fs.existsSync(lockFile)) {
            try {
                // Try to remove it multiple times or wait a bit
                fs.unlinkSync(lockFile);
                console.log('[WA] Removed SingletonLock file.');
            } catch (e) {
                console.warn('[WA] Failed to remove SingletonLock:', e.message);
                // If it's locked by another process, we might still fail later, 
                // but sometimes it's just a stale handle.
            }
        }

        loadWaCore();

        const client = new Client({
            authStrategy: new LocalAuth({ clientId: 'ims_v1', dataPath: WA_AUTH_DIR }),
            puppeteer: {
                executablePath: chromePath,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-extensions',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-default-apps',
                    '--mute-audio',
                    '--no-default-browser-check',
                    '--no-first-run',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-breakpad',
                    '--disable-client-side-phishing-detection',
                    '--disable-hang-monitor',
                    '--disable-ipc-flooding-protection',
                    '--disable-notifications',
                    '--disable-prompt-on-repost',
                    '--disable-renderer-backgrounding',
                    '--disable-sync'
                ]
            }
        });

        // Set instance immediately so status moves from 'disconnected' to 'initializing'
        clientInstance = client;

        client.on('qr', (qr) => {
            console.log('[WA] QR RECEIVED', qr);
            qrCodeData = qr; // Save QR to variable
            isAuthenticated = false;
            ready = false;
        });

        client.on('ready', () => {
            console.log('[WA] Client is ready!');
            ready = true;
            isAuthenticated = true;
            qrCodeData = null; // Clear QR code once authenticated
        });

        client.on('authenticated', () => {
            console.log('[WA] Client is authenticated!');
            isAuthenticated = true;
            qrCodeData = null; // Clear QR code immediately
        });

        client.on('auth_failure', (msg) => {
            console.error('[WA] AUTHENTICATION FAILURE', msg);
            isAuthenticated = false;
            ready = false;
            clientInstance = null;
        });

        client.on('disconnected', async (reason) => {
            console.log('[WA] Client was logged out', reason);
            ready = false;
            isAuthenticated = false;
            stopTimers();
            try { await client.destroy(); } catch (e) { console.error('[WA] Error destroying client:', e); }
            clientInstance = null;
            // Auto-reconnect after 30s unless it was an explicit logout
            if (reason !== 'LOGOUT') scheduleReconnect(30000);
        });

        // DO NOT await this here — let it run in background so API/UI stays responsive
        client.initialize().then(() => {
            console.log('[WA] Background initialization finished.');
            startHeartbeat(client);
        }).catch(err => {
            console.error('[WA] Client initialization failed:', err);
            clientInstance = null;
            scheduleReconnect(15000);
        }).finally(() => {
            isInitializing = false;
        });

    } catch (err) {
        console.error('[WA] Client creation failed:', err);
        clientInstance = null;
        isInitializing = false;
        scheduleReconnect(15000);
    }
};

/**
 * Check if a session already exists and initialize automatically.
 */
const autoInitIfPossible = async () => {
    const sessionDir = path.join(WA_AUTH_DIR, 'session-ims_v1');
    if (fs.existsSync(sessionDir)) {
        console.log('[WA] Found existing session folder. Attempting auto-init...');
        // Small delay to ensure everything else is ready
        setTimeout(() => {
            initWhatsApp().catch(e => console.error('[WA] Auto-init failed:', e.message));
        }, 2000);
    } else {
        console.log('[WA] No existing session found. Waiting for manual start.');
    }
};

const getQr = () => {
    return qrCodeData;
};

const getStatus = () => {
    // Note: 'ready' can take very long with accounts that have many messages
    // 'authenticated' means the session is valid and messaging typically works
    if (ready || isAuthenticated) return 'connected';
    if (qrCodeData) return 'qr_received';
    if (clientInstance) return 'initializing';
    return 'disconnected';
};

const getClient = () => {
    return clientInstance;
};

/**
 * Send text message and wait for delivery confirmation (ACK >= 2)
 * ACK levels: 0=PENDING, 1=SENT(single tick), 2=RECEIVED(double tick), 3=READ(blue ticks)
 * @param {string} phone
 * @param {string} message
 * @param {number} timeoutMs - how long to wait for delivery ack (default 15s)
 * @returns {Promise<{delivered: boolean, msgId: string}>}
 */
const sendText = async (phone, message, timeoutMs = 15000) => {
    if (!clientInstance) {
        console.error('[WA] sendText failed: ClientInstance is null');
        throw new Error("WhatsApp client not initialized");
    }
    loadWaCore();
    const sanitizedPhone = phone.replace(/\D/g, '');
    const chatId = sanitizedPhone + "@c.us";
    console.log(`[WA] Preparing to send text to ${chatId}`);

    return new Promise(async (resolve, reject) => {
        let settled = false;
        let sentMsgId = null;
        const pendingAcks = new Map(); // Store ACKs that arrive before sentMsgId is known

        const onAck = (msg, ack) => {
            const currentId = msg.id._serialized;
            if (sentMsgId) {
                if (currentId === sentMsgId && ack >= 2) {
                    console.log(`[WA] Targeted ACK received for ${currentId}: level ${ack}`);
                    settled = true;
                    clientInstance.removeListener('message_ack', onAck);
                    resolve({ delivered: true, msgId: sentMsgId });
                }
            } else {
                // Buffer the ACK if we don't know the ID yet
                pendingAcks.set(currentId, ack);
            }
        };

        // Attach listener BEFORE sending, to avoid missing instant ACKs
        clientInstance.on('message_ack', onAck);

        try {
            console.log(`[WA] Dispatching sendMessage to ${chatId}`);
            const sentMsg = await clientInstance.sendMessage(chatId, message);
            sentMsgId = sentMsg.id._serialized;
            console.log(`[WA] Message dispatched. MsgId: ${sentMsgId}. Checking pending ACKs...`);

            // Check if we already received an ACK for this ID while sendMessage was in flight
            if (pendingAcks.has(sentMsgId)) {
                const ack = pendingAcks.get(sentMsgId);
                console.log(`[WA] Found buffered ACK for ${sentMsgId}: level ${ack}`);
                if (ack >= 2) {
                    settled = true;
                    clientInstance.removeListener('message_ack', onAck);
                    resolve({ delivered: true, msgId: sentMsgId });
                }
            }
        } catch (err) {
            console.error(`[WA] sendMessage error for ${chatId}:`, err);
            clientInstance.removeListener('message_ack', onAck);

            // AUTO-RECOVERY: Detect if the browser engine has crashed/detached
            const errorMsg = err.message || "";
            if (errorMsg.includes('detached Frame') || errorMsg.includes('Execution context was destroyed')) {
                console.warn('[WA] Stale browser context detected. Triggering self-healing restart...');
                const staleClient = clientInstance;
                clientInstance = null; // Mark as null immediately to prevent further calls
                ready = false;
                isAuthenticated = false;

                try {
                    await staleClient.destroy();
                } catch (e) {
                    console.error('[WA] Error during emergency destroy:', e);
                }

                // Silent restart
                initWhatsApp().catch(e => console.error('[WA] Emergency restart failed:', e));

                return reject(new Error("WhatsApp service encountered a frame error and is restarting. Please try again in a few seconds."));
            }

            return reject(err);
        }

        // Timeout fallback
        setTimeout(() => {
            if (!settled) {
                clientInstance.removeListener('message_ack', onAck);
                console.warn(`[WA] ACK timeout for ${sentMsgId} after ${timeoutMs}ms.`);
                resolve({ delivered: false, msgId: sentMsgId });
            }
        }, timeoutMs);
    });
};

/**
 * Send media message
 * @param {string} phone
 * @param {object} file - Multer file object
 * @param {string} caption
 */
const sendMedia = async (phone, file, caption) => {
    if (!clientInstance) throw new Error("WhatsApp client not initialized");

    loadWaCore();

    // Strip non-numeric characters to ensure valid ID (e.g. remove +)
    const sanitizedPhone = phone.replace(/\D/g, '');

    // 1. Verify if number is registered on WhatsApp
    const numberDetails = await clientInstance.getNumberId(sanitizedPhone);
    if (!numberDetails) {
        throw new Error(`Number ${sanitizedPhone} is not registered on WhatsApp`);
    }

    const chatId = numberDetails._serialized;
    console.log(`[WA] Sending media to ${chatId} (Original: ${phone})`);
    console.log(`[WA] File details: ${file.mimetype}, ${file.originalname}, size: ${file.size}`);

    try {
        const media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);

        // 2. Get Chat object explicitly to ensure it's loaded
        const chat = await clientInstance.getChatById(chatId);

        // 3. Send using chat object
        return await chat.sendMessage(media, { caption: caption || '' });
    } catch (e) {
        console.error("[WA] Internal sendMessage error:", e);
        throw e;
    }
};

const destroyClient = async () => {
    stopTimers();
    if (clientInstance) {
        try {
            await clientInstance.destroy();
            clientInstance = null;
            console.log('[WA] Client destroyed');
        } catch (e) {
            console.error('[WA] Error destroying client:', e);
        }
    }
};

// Logout and clear session (forces new QR on next init)
const logout = async () => {
    console.log('[WA] Logging out...');
    ready = false;
    isAuthenticated = false;
    qrCodeData = null;

    if (clientInstance) {
        try {
            await clientInstance.logout();
            console.log('[WA] Logged out successfully');
        } catch (e) {
            console.error('[WA] Error during logout:', e);
        }
        try {
            await clientInstance.destroy();
        } catch (e) {
            console.error('[WA] Error destroying client:', e);
        }
        clientInstance = null;
    }

    // Delete session folder to force fresh QR
    const sessionPath = WA_AUTH_DIR;
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log('[WA] Session folder deleted');
    }
    stopTimers();
    return true;
};

module.exports = {
    initWhatsApp,
    getQr,
    getStatus,
    getClient,
    sendText,
    sendMedia,
    destroyClient,
    logout,
    autoInitIfPossible
};
