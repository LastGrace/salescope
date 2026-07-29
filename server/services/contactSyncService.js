const axios = require('axios');
const db = require('../db');
const cron = require('node-cron');

const WHATSHUB_API_URL = process.env.WHATSHUB_API_URL || 'http://localhost:3001/api/v1/integration';

// Queue to store contacts that failed to sync
const pendingSyncQueue = [];

async function getApiKey() {
    const [rows] = await db.query('SELECT whatshub_api_key, whatshub_enabled FROM messaging_settings WHERE id = 1');
    if (rows.length === 0) return null;
    
    const settings = rows[0];
    
    // We sync if WhatsHub is enabled and API key is present.
    if (!settings.whatshub_enabled || !settings.whatshub_api_key) return null;
    
    return settings.whatshub_api_key;
}

const syncContact = async (contact) => {
    const apiKey = await getApiKey();
    if (!apiKey) return; // WhatsHub not enabled or configured

    try {
        await axios.post(`${WHATSHUB_API_URL}/contacts/sync`, {
            name: contact.name,
            phone: contact.phone,
            email: contact.email
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000 // 5 seconds timeout
        });
        console.log(`[Sync] Successfully synced contact: ${contact.name} (${contact.phone})`);
    } catch (error) {
        console.error(`[Sync] Failed to sync contact: ${contact.name}. Added to retry queue.`);
        // Add to in-memory queue if it fails (e.g. offline)
        // Avoid duplicates in queue
        const exists = pendingSyncQueue.find(c => c.phone === contact.phone);
        if (!exists) {
            pendingSyncQueue.push(contact);
        }
    }
};

// Retry failed syncs every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    if (pendingSyncQueue.length === 0) return;
    
    console.log(`[Sync] Attempting to retry ${pendingSyncQueue.length} pending contacts...`);
    
    // Create a copy of the queue and clear the original
    const queueCopy = [...pendingSyncQueue];
    pendingSyncQueue.length = 0;
    
    for (const contact of queueCopy) {
        await syncContact(contact);
        // Small delay to prevent rate limiting
        await new Promise(res => setTimeout(res, 500));
    }
});

module.exports = {
    syncContact
};
