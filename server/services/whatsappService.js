const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const waEvents = new EventEmitter();
const pino = require('pino');
const { WA_AUTH_DIR } = require('../paths');

let clientInstance = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let reconnectTimer = null;
let isInitializing = false;
let isDestroying = false; // Flag to prevent zombie reconnects
let Baileys = null; // Dynamically imported module
let reconnectAttempts = 0;

// Set level to 'warn' to capture critical connection or crypto errors without spam
const logger = pino({ level: 'warn' });

// --- QUEUE SYSTEM ---
const messageQueue = [];
let isProcessingQueue = false;

const processQueue = async () => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        const job = messageQueue.shift();
        try {
            const sentMsg = await job.execute();
            job.resolve({ delivered: true, msgId: sentMsg?.key?.id || 'unknown' });
        } catch (err) {
            job.reject(err);
        }
        // Delay 2.5 seconds between messages
        if (messageQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 2500));
        }
    }
    isProcessingQueue = false;
};

const enqueueMessage = (executeFn) => {
    return new Promise((resolve, reject) => {
        messageQueue.push({ execute: executeFn, resolve, reject });
        processQueue();
    });
};
// --------------------

const stopTimers = () => {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
};

const scheduleReconnect = () => {
    stopTimers();
    // Exponential backoff: 5s, 10s, 20s, 40s... max 5 mins
    const delayMs = Math.min(5000 * Math.pow(2, reconnectAttempts), 300000);
    console.log(`[WA] Scheduling auto-reconnect in ${delayMs / 1000}s (Attempt ${reconnectAttempts + 1})...`);
    
    reconnectTimer = setTimeout(async () => {
        if (!clientInstance || connectionStatus !== 'connected') {
            console.log('[WA] Auto-reconnecting...');
            try {
                reconnectAttempts++;
                await initWhatsApp();
            } catch (e) {
                console.error('[WA] Auto-reconnect failed:', e.message);
            }
        }
    }, delayMs);
};

const initWhatsApp = async () => {
    isDestroying = false;
    if (clientInstance && connectionStatus === 'connected') {
        console.log('[WA] Client already connected. Skipping.');
        return;
    }
    if (isInitializing) {
        console.log('[WA] Initialization already in progress. Skipping.');
        return;
    }
    isInitializing = true;
    connectionStatus = 'initializing';
    qrCodeData = null;
    waEvents.emit('status_change', connectionStatus);
    waEvents.emit('qr_change', qrCodeData);

    try {
        if (!Baileys) {
            Baileys = await import('@whiskeysockets/baileys');
        }

        console.log('[WA] Initializing WhatsApp Client (Baileys)...');

        // Ensure auth dir exists
        if (!fs.existsSync(WA_AUTH_DIR)) {
            fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
        }

        const { state, saveCreds } = await Baileys.useMultiFileAuthState(WA_AUTH_DIR);
        const { version } = await Baileys.fetchLatestBaileysVersion();

        const sock = Baileys.makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            auth: state,
            browser: ['Salescope', 'Desktop', '1.0.0']
        });

        clientInstance = sock;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            if (isDestroying) return; // Prevent zombie events during restart/logout

            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('[WA] QR RECEIVED');
                qrCodeData = qr;
                connectionStatus = 'qr_received';
                waEvents.emit('status_change', connectionStatus);
                waEvents.emit('qr_change', qrCodeData);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== Baileys.DisconnectReason.loggedOut;
                console.log('[WA] Client was logged out or disconnected', { reason: lastDisconnect?.error?.message || lastDisconnect?.error });
                connectionStatus = 'disconnected';
                qrCodeData = null;
                clientInstance = null;
                waEvents.emit('status_change', connectionStatus);
                waEvents.emit('qr_change', qrCodeData);

                if (shouldReconnect) {
                    scheduleReconnect();
                } else {
                    // It was an explicit logout
                    console.log('[WA] Explicit logout detected. Clearing session...');
                    if (fs.existsSync(WA_AUTH_DIR)) {
                        fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
                    }
                }
            } else if (connection === 'connecting') {
                if (!qr) { // don't override if a QR just came in the same event
                    console.log('[WA] Client is connecting...');
                    connectionStatus = 'connecting';
                    waEvents.emit('status_change', connectionStatus);
                }
            } else if (connection === 'open') {
                console.log('[WA] Client is connected!');
                reconnectAttempts = 0; // Reset attempts on successful connection
                connectionStatus = 'connected';
                qrCodeData = null;
                waEvents.emit('status_change', connectionStatus);
                waEvents.emit('qr_change', qrCodeData);
                stopTimers();
            }
        });

        sock.ev.on('messages.update', (updates) => {
            if (isDestroying) return;

            for (const update of updates) {
                if (update.update.status) {
                    sock.ev.emit('msg_ack', update);
                    // Emit event for the rest of the application
                    waEvents.emit('message_status', {
                        msgId: update.key.id,
                        status: update.update.status
                    });
                }
            }
        });

        isInitializing = false;

    } catch (err) {
        console.error('[WA] Client creation failed:', err);
        clientInstance = null;
        connectionStatus = 'disconnected';
        isInitializing = false;
        waEvents.emit('status_change', connectionStatus);
        scheduleReconnect();
    }
};

const autoInitIfPossible = async () => {
    if (fs.existsSync(WA_AUTH_DIR)) {
        // Checking if there's a valid session folder containing creds.json
        const credsFile = path.join(WA_AUTH_DIR, 'creds.json');
        if (fs.existsSync(credsFile)) {
            console.log('[WA] Found existing session folder. Attempting auto-init...');
            setTimeout(() => {
                initWhatsApp().catch(e => console.error('[WA] Auto-init failed:', e.message));
            }, 2000);
        } else {
            console.log('[WA] No existing creds found. Waiting for manual start.');
        }
    } else {
        console.log('[WA] No existing session found. Waiting for manual start.');
    }
};

const getQr = () => {
    return qrCodeData;
};

const getStatus = () => {
    return connectionStatus;
};

const getClient = () => {
    return clientInstance;
};

/**
 * Format phone number to Baileys format
 */
const formatPhone = (phone) => {
    let sanitized = phone.replace(/\D/g, '');
    if (!sanitized.endsWith('@s.whatsapp.net')) {
        sanitized = `${sanitized}@s.whatsapp.net`;
    }
    return sanitized;
};

/**
 * Send text message asynchronously using Job Queue
 */
const sendText = async (phone, message, timeoutMs = 15000) => {
    return enqueueMessage(async () => {
        if (!clientInstance || connectionStatus !== 'connected') {
            console.error('[WA] sendText failed: Client is not connected');
            throw new Error("WhatsApp client not connected");
        }

        const chatId = formatPhone(phone);
        console.log(`[WA] Preparing to send text to ${chatId}`);

        try {
            console.log(`[WA] Dispatching sendMessage to ${chatId}`);
            const sentMsg = await clientInstance.sendMessage(chatId, { text: message });
            console.log(`[WA] Message dispatched to server. MsgId: ${sentMsg?.key?.id}`);
            return sentMsg;
        } catch (err) {
            console.error(`[WA] sendMessage error for ${chatId}:`, err);
            throw err;
        }
    });
};

/**
 * Send media message asynchronously using Job Queue
 */
const sendMedia = async (phone, file, caption) => {
    return enqueueMessage(async () => {
        if (!clientInstance || connectionStatus !== 'connected') {
            throw new Error("WhatsApp client not connected");
        }

        const chatId = formatPhone(phone);
        console.log(`[WA] Sending media to ${chatId} (Original: ${phone})`);
        console.log(`[WA] File details: ${file.mimetype}, ${file.originalname}, size: ${file.size}`);

        try {
            let messagePayload = {};
            // Read from the temp file written by multer diskStorage
            const mediaBuffer = fs.readFileSync(file.path);

            if (file.mimetype.startsWith('image/')) {
                messagePayload = {
                    image: mediaBuffer,
                    caption: caption || ''
                };
            } else {
                messagePayload = {
                    document: mediaBuffer,
                    mimetype: file.mimetype,
                    fileName: file.originalname,
                    caption: caption || ''
                };
            }

            const sentMsg = await clientInstance.sendMessage(chatId, messagePayload);
            return sentMsg;
        } catch (e) {
            console.error("[WA] Internal sendMedia error:", e);
            throw e;
        }
    });
};

const destroyClient = async () => {
    isDestroying = true;
    stopTimers();
    if (clientInstance) {
        try {
            // Remove event listeners to prevent auto-reconnect zombies
            clientInstance.ev.removeAllListeners('connection.update');
            clientInstance.ev.removeAllListeners('messages.update');
            clientInstance.ev.removeAllListeners('creds.update');

            clientInstance.end(undefined);
            clientInstance = null;
            connectionStatus = 'disconnected';
            waEvents.emit('status_change', connectionStatus);
            waEvents.emit('qr_change', null);
            console.log('[WA] Client destroyed');
        } catch (e) {
            console.error('[WA] Error destroying client:', e);
        }
    }
};

const logout = async () => {
    console.log('[WA] Logging out...');
    isDestroying = true;
    stopTimers();
    connectionStatus = 'disconnected';
    qrCodeData = null;
    waEvents.emit('status_change', connectionStatus);
    waEvents.emit('qr_change', qrCodeData);

    if (clientInstance) {
        try {
            clientInstance.ev.removeAllListeners('connection.update');
            clientInstance.ev.removeAllListeners('messages.update');
            clientInstance.ev.removeAllListeners('creds.update');
            await clientInstance.logout();
            console.log('[WA] Logged out successfully');
        } catch (e) {
            console.error('[WA] Error during logout:', e);
        }
        clientInstance = null;
    }

    if (fs.existsSync(WA_AUTH_DIR)) {
        fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
        console.log('[WA] Session folder deleted');
    }

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
    autoInitIfPossible,
    waEvents
};
