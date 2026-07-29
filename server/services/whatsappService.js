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

// Rolling caches
const sentMessagesCache = new Map();
const recentAcks = new Map();

// Clean up message store records older than 7 days
const cleanOldMessages = async () => {
    try {
        const db = require('../db');
        const [res] = await db.query('DELETE FROM whatsapp_message_store WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)');
        if (res.affectedRows > 0) {
            console.log(`[WA Store] Cleaned up ${res.affectedRows} expired WhatsApp messages.`);
        }
    } catch (e) {
        console.error('[WA Store] Clean old messages failed:', e.message);
    }
};

// Check WhatsApp registration status
const checkWhatsAppRegistered = async (phone) => {
    try {
        const jid = formatPhone(phone);
        const result = await clientInstance.onWhatsApp(jid);
        if (result && result.length > 0 && result[0].exists) {
            return true;
        }
        return false;
    } catch (e) {
        console.warn('[WA Pre-check] onWhatsApp verification failed, falling back to sending:', e.message);
        return true; // Fallback to send anyway if verification fails
    }
};

// Set level to 'warn' to capture critical connection or crypto errors without spam
const logger = pino({ level: 'warn' });

// --- QUEUE SYSTEM (with Retry) ---
const MAX_RETRIES = 2;
const messageQueue = [];
let isProcessingQueue = false;
let queueSentCount = 0; // For anti-ban pauses

/**
 * Checks if an error is transient and worth retrying.
 */
const isTransientError = (err) => {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    const code = err?.output?.statusCode;
    // Retry on: connection closed, timed out, socket errors, Baileys 408/428/500/503
    return msg.includes('connection closed') ||
           msg.includes('timed out') ||
           msg.includes('socket') ||
           msg.includes('not connected') ||
           msg.includes('stream errored') ||
           msg.includes('rate-overlimit') ||
           [408, 428, 500, 503, 515].includes(code);
};

const processQueue = async () => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        const job = messageQueue.shift();
        let lastErr = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const result = await job.execute();
                job.resolve({ delivered: result.delivered, msgId: result.sentMsg?.key?.id || 'unknown' });
                lastErr = null;
                break; // Success — exit retry loop
            } catch (err) {
                lastErr = err;
                if (attempt < MAX_RETRIES && isTransientError(err)) {
                    const delayMs = 3000 * (attempt + 1); // 3s, 6s
                    console.warn(`[WA Queue] Transient error on attempt ${attempt + 1}/${MAX_RETRIES + 1}: ${err.message}. Retrying in ${delayMs / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                } else {
                    break; // Non-transient error or max retries reached
                }
            }
        }

        if (lastErr) {
            job.reject(lastErr);
        }

        // Delay between messages (Anti-ban randomized delay + batch pauses)
        if (messageQueue.length > 0) {
            queueSentCount++;
            if (queueSentCount % 15 === 0) {
                console.log('[WA Queue] Anti-Ban: Taking a 30-second cool-down after 15 messages...');
                await new Promise(resolve => setTimeout(resolve, 30000));
            } else {
                const randomDelay = 2000 + Math.floor(Math.random() * 3000); // 2000ms to 5000ms
                await new Promise(resolve => setTimeout(resolve, randomDelay));
            }
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
    if (clientInstance && (connectionStatus === 'connected' || connectionStatus === 'connecting' || connectionStatus === 'initializing')) {
        console.log(`[WA] Client already in status: ${connectionStatus}. Skipping.`);
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
            browser: ['Salescope', 'Desktop', '1.0.0'],
            syncFullHistory: false,
            shouldSyncHistoryMessage: (history) => {
                if (!Baileys || !Baileys.proto || !Baileys.proto.HistorySync || !Baileys.proto.HistorySync.HistorySyncType) {
                    return false;
                }
                const HistorySyncType = Baileys.proto.HistorySync.HistorySyncType;
                const type = history?.syncType;
                // Only allow PUSH_NAME and NON_BLOCKING_DATA (carries LID mappings)
                return type === HistorySyncType.PUSH_NAME || type === HistorySyncType.NON_BLOCKING_DATA;
            },
            getMessage: async (key) => {
                if (sentMessagesCache.has(key.id)) {
                    return sentMessagesCache.get(key.id);
                }
                try {
                    const db = require('../db');
                    const [rows] = await db.query('SELECT message_payload FROM whatsapp_message_store WHERE msg_id = ?', [key.id]);
                    if (rows.length > 0) {
                        const payload = typeof rows[0].message_payload === 'string'
                            ? JSON.parse(rows[0].message_payload)
                            : rows[0].message_payload;
                        return payload;
                    }
                } catch (e) {
                    console.error('[WA Store] getMessage db read error:', e.message);
                }
                return undefined;
            }
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

                // Clean up expired message store records (older than 7 days)
                cleanOldMessages().catch(e => console.error('[WA Store] Clean up old messages failed:', e.message));
            }
        });

        sock.ev.on('messages.update', (updates) => {
            if (isDestroying) return;

            for (const update of updates) {
                if (update.update.status) {
                    const msgId = update.key.id;
                    const status = update.update.status;

                    recentAcks.set(msgId, status);
                    if (recentAcks.size > 2000) {
                        const firstKey = recentAcks.keys().next().value;
                        recentAcks.delete(firstKey);
                    }

                    sock.ev.emit('msg_ack', update);
                    // Emit event for the rest of the application
                    waEvents.emit('message_status', {
                        msgId: msgId,
                        status: status
                    });
                }
            }
        });

        // Incoming message handler (Opt-out/Opt-in processing)
        sock.ev.on('messages.upsert', async (upsert) => {
            if (isDestroying) return;
            if (upsert.type !== 'notify') return;

            try {
                const db = require('../db');
                for (const msg of upsert.messages) {
                    if (msg.key.fromMe) continue;

                    const text = (msg.message?.conversation || 
                                  msg.message?.extendedTextMessage?.text || 
                                  msg.message?.imageMessage?.caption || 
                                  '').trim().toLowerCase();

                    if (text === 'stop' || text === 'unsubscribe') {
                        const rawPhone = msg.key.remoteJid.split('@')[0];
                        console.log(`[WA] Opt-out keyword received from ${rawPhone}. Processing unsubscribe...`);
                        
                        await db.query('INSERT IGNORE INTO whatsapp_blocklist (phone) VALUES (?)', [rawPhone]);
                        
                        await sock.sendMessage(msg.key.remoteJid, { 
                            text: 'You have been successfully opted out of messages from this store. You will no longer receive invoices or promotional campaigns. Reply START to resubscribe.' 
                        });
                        console.log(`[WA] Successfully unsubscribed ${rawPhone}`);
                    } else if (text === 'start' || text === 'subscribe') {
                        const rawPhone = msg.key.remoteJid.split('@')[0];
                        console.log(`[WA] Opt-in keyword received from ${rawPhone}. Processing resubscribe...`);
                        
                        await db.query('DELETE FROM whatsapp_blocklist WHERE phone = ?', [rawPhone]);
                        
                        await sock.sendMessage(msg.key.remoteJid, { 
                            text: 'Welcome back! You have successfully opted in. You will now receive invoices and campaigns.' 
                        });
                        console.log(`[WA] Successfully subscribed ${rawPhone}`);
                    }
                }
            } catch (e) {
                console.error('[WA Incoming] Error handling upsert message:', e.message);
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

const normalizePhone = (phone) => {
    if (!phone) return '';
    let sanitized = phone.toString().replace(/\D/g, '');
    if (sanitized.length === 10) {
        sanitized = '91' + sanitized;
    }
    if (sanitized.length === 11 && sanitized.startsWith('0')) {
        sanitized = '91' + sanitized.substring(1);
    }
    return sanitized;
};

/**
 * Format phone number to Baileys format
 */
const formatPhone = (phone) => {
    let normalized = normalizePhone(phone);
    if (normalized && !normalized.endsWith('@s.whatsapp.net')) {
        normalized = `${normalized}@s.whatsapp.net`;
    }
    return normalized;
};

const logMessageToDb = async (phone, type, text, filename, status, errorMsg = null) => {
    try {
        const db = require('../db');
        const rawPhone = normalizePhone(phone);
        
        // Find customer name if exists
        let customerName = 'Unknown Customer';
        try {
            const [rows] = await db.query('SELECT name FROM customers WHERE phone LIKE ?', [`%${rawPhone.slice(-10)}`]);
            if (rows.length > 0) {
                customerName = rows[0].name;
            }
        } catch (e) {}

        await db.query(
            `INSERT INTO whatsapp_message_logs (recipient_phone, recipient_name, message_type, message_text, media_filename, status, error_message) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [rawPhone, customerName, type, text, filename, status, errorMsg]
        );
    } catch (err) {
        console.error('[WA DB Log] Failed to log message to DB:', err.message);
    }
};

/**
 * Send text message asynchronously using Job Queue
 */
const sendText = async (phone, message, timeoutMs = 15000) => {
    return enqueueMessage(async () => {
        const rawPhone = normalizePhone(phone);
        try {
            // If connection is briefly reconnecting, wait up to 5 seconds
            if (connectionStatus === 'initializing' || connectionStatus === 'connecting') {
                console.log(`[WA] Connection is ${connectionStatus}. Waiting for connected state...`);
                for (let i = 0; i < 10; i++) {
                    await new Promise(r => setTimeout(r, 500));
                    if (connectionStatus === 'connected') break;
                }
            }

            if (!clientInstance || connectionStatus !== 'connected') {
                console.error('[WA] sendText failed: Client is not connected');
                throw new Error("WhatsApp client not connected");
            }

            const db = require('../db');

            // 1. Opt-out validation check
            const [blocklisted] = await db.query('SELECT 1 FROM whatsapp_blocklist WHERE phone = ?', [rawPhone]);
            if (blocklisted.length > 0) {
                console.log(`[WA] Skipping message to ${phone}: Number is blocklisted (unsubscribed).`);
                throw new Error("Number has opted out of WhatsApp messages");
            }

            // 2. WhatsApp registration pre-check
            // REMOVED: Bypassing onWhatsApp() pre-check because it causes false negatives when rate-limited.
            // We directly attempt to send; if it's truly invalid, sendMessage will throw a robust error.

            const chatId = formatPhone(phone);
            console.log(`[WA] Preparing to send text to ${chatId}`);

            // 3. Simulating human typing indicator
            console.log(`[WA] Simulating typing presence update for ${chatId}...`);
            try {
                await clientInstance.sendPresenceUpdate('composing', chatId);
                await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 1500ms to send much faster
                await clientInstance.sendPresenceUpdate('paused', chatId);
            } catch (e) {}

            console.log(`[WA] Dispatching sendMessage to ${chatId}`);
            const sentMsg = await clientInstance.sendMessage(chatId, { text: message });
            console.log(`[WA] Message dispatched to server. MsgId: ${sentMsg?.key?.id}`);
            
            if (sentMsg && sentMsg.message) {
                const msgId = sentMsg.key.id;
                // Store in memory cache
                sentMessagesCache.set(msgId, sentMsg.message);
                if (sentMessagesCache.size > 5000) {
                    const firstKey = sentMessagesCache.keys().next().value;
                    sentMessagesCache.delete(firstKey);
                }

                // Store in MySQL database for retry decryption reliability
                try {
                    await db.query(
                        'INSERT INTO whatsapp_message_store (msg_id, message_payload) VALUES (?, ?) ON DUPLICATE KEY UPDATE message_payload = VALUES(message_payload)',
                        [msgId, JSON.stringify(sentMsg.message)]
                    );
                } catch (dbErr) {
                    console.error('[WA Store] Failed to save message to MySQL:', dbErr.message);
                }
            }

            let delivered = false;
            const msgId = sentMsg?.key?.id;

            if (msgId && recentAcks.has(msgId) && recentAcks.get(msgId) >= 2) {
                delivered = true;
                console.log(`[WA] ACK for ${msgId} was already received (race resolved)`);
            } else {
                try {
                    delivered = await new Promise((resolve) => {
                        const timer = setTimeout(() => {
                            clientInstance.ev.off('msg_ack', onAck);
                            console.log(`[WA] ACK timeout for ${msgId} — treating as sent (unconfirmed)`);
                            resolve(false);
                        }, 5000);
                        const onAck = (update) => {
                            if (update.key.id === msgId && update.update.status >= 2) {
                                clearTimeout(timer);
                                clientInstance.ev.off('msg_ack', onAck);
                                resolve(true);
                            }
                        };
                        clientInstance.ev.on('msg_ack', onAck);
                    });
                } catch (e) {
                    console.error('[WA] Error waiting for ACK:', e);
                }
            }

            // Log to database on success
            await logMessageToDb(phone, 'text', message, null, 'sent');

            return { sentMsg, delivered };
        } catch (err) {
            console.error(`[WA] sendMessage error for ${phone}:`, err.message);
            // Log to database on failure
            await logMessageToDb(phone, 'text', message, null, 'failed', err.message);
            throw err;
        }
    });
};

/**
 * Send media message asynchronously using Job Queue
 */
const sendMedia = async (phone, file, caption) => {
    return enqueueMessage(async () => {
        const rawPhone = normalizePhone(phone);
        try {
            // If connection is briefly reconnecting, wait up to 5 seconds
            if (connectionStatus === 'initializing' || connectionStatus === 'connecting') {
                console.log(`[WA] Connection is ${connectionStatus}. Waiting for connected state...`);
                for (let i = 0; i < 10; i++) {
                    await new Promise(r => setTimeout(r, 500));
                    if (connectionStatus === 'connected') break;
                }
            }

            if (!clientInstance || connectionStatus !== 'connected') {
                throw new Error("WhatsApp client not connected");
            }

            const db = require('../db');

            // 1. Opt-out validation check
            const [blocklisted] = await db.query('SELECT 1 FROM whatsapp_blocklist WHERE phone = ?', [rawPhone]);
            if (blocklisted.length > 0) {
                console.log(`[WA] Skipping media to ${phone}: Number is blocklisted (unsubscribed).`);
                throw new Error("Number has opted out of WhatsApp messages");
            }

            // 2. WhatsApp registration pre-check
            // REMOVED: Bypassing onWhatsApp() pre-check because it causes false negatives when rate-limited.
            // We directly attempt to send; if it's truly invalid, sendMessage will throw a robust error.

            const chatId = formatPhone(phone);
            console.log(`[WA] Sending media to ${chatId} (Original: ${phone})`);
            console.log(`[WA] File details: ${file.mimetype}, ${file.originalname}, size: ${file.size}`);

            // 3. Simulating human typing indicator
            console.log(`[WA] Simulating typing presence update for ${chatId}...`);
            try {
                await clientInstance.sendPresenceUpdate('composing', chatId);
                await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 1500ms to send much faster
                await clientInstance.sendPresenceUpdate('paused', chatId);
            } catch (e) {}

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

            if (sentMsg && sentMsg.message) {
                const msgId = sentMsg.key.id;
                // Store in memory cache
                sentMessagesCache.set(msgId, sentMsg.message);
                if (sentMessagesCache.size > 5000) {
                    const firstKey = sentMessagesCache.keys().next().value;
                    sentMessagesCache.delete(firstKey);
                }

                // Store in MySQL database for retry decryption reliability
                try {
                    await db.query(
                        'INSERT INTO whatsapp_message_store (msg_id, message_payload) VALUES (?, ?) ON DUPLICATE KEY UPDATE message_payload = VALUES(message_payload)',
                        [msgId, JSON.stringify(sentMsg.message)]
                    );
                } catch (dbErr) {
                    console.error('[WA Store] Failed to save message to MySQL:', dbErr.message);
                }
            }

            let delivered = false;
            const msgId = sentMsg?.key?.id;

            if (msgId && recentAcks.has(msgId) && recentAcks.get(msgId) >= 2) {
                delivered = true;
                console.log(`[WA] ACK for ${msgId} was already received (race resolved)`);
            } else {
                try {
                    delivered = await new Promise((resolve) => {
                        const timer = setTimeout(() => {
                            clientInstance.ev.off('msg_ack', onAck);
                            console.log(`[WA] ACK timeout for ${msgId} — treating as sent (unconfirmed)`);
                            resolve(false);
                        }, 5000);
                        const onAck = (update) => {
                            if (update.key.id === msgId && update.update.status >= 2) {
                                clearTimeout(timer);
                                clientInstance.ev.off('msg_ack', onAck);
                                resolve(true);
                            }
                        };
                        clientInstance.ev.on('msg_ack', onAck);
                    });
                } catch (e) {
                    console.error('[WA] Error waiting for ACK:', e);
                }
            }

            // Log to database on success
            await logMessageToDb(phone, 'media', caption || 'Media Message', file.originalname, 'sent');

            return { sentMsg, delivered };
        } catch (err) {
            console.error(`[WA] sendMedia error for ${phone}:`, err.message);
            // Log to database on failure
            await logMessageToDb(phone, 'media', caption || 'Media Message', file.originalname, 'failed', err.message);
            throw err;
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

const isOnWhatsApp = async (phone) => {
    if (!clientInstance || connectionStatus !== 'connected') {
        throw new Error('WhatsApp client is not connected');
    }
    const jid = formatPhone(phone);
    if (!jid) return false;
    const result = await clientInstance.onWhatsApp(jid);
    if (result && result.length > 0 && result[0].exists) {
        return true;
    }
    return false;
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
    waEvents,
    isOnWhatsApp
};
