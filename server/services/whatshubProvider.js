const axios = require('axios');
const fs = require('fs');
const db = require('../db');

// Read config to get API URL.
const WHATSHUB_API_URL = process.env.WHATSHUB_API_URL || 'https://backend-whatshub.onrender.com/api/v1/integration';

async function getApiKey() {
    const [rows] = await db.query('SELECT whatshub_api_key FROM messaging_settings WHERE id = 1');
    if (rows.length === 0 || !rows[0].whatshub_api_key) {
        throw new Error('WhatsHub API Key is not configured');
    }
    return rows[0].whatshub_api_key;
}

const normalizePhone = (phone) => {
    if (!phone) return null;
    let digits = phone.toString().replace(/\D/g, '');
    if (digits.length === 10) {
        digits = '91' + digits;
    }
    return digits;
};

const sendText = async (phone, message) => {
    const apiKey = await getApiKey();
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error('Invalid phone number');

    try {
        const response = await axios.post(`${WHATSHUB_API_URL}/messages/send`, {
            phone: normalizedPhone,
            text: message
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        return { delivered: true, msgId: response.data?.messageId };
    } catch (error) {
        console.error('[WhatsHub] Error sending text:', error?.response?.data || error.message);
        throw new Error('Failed to send message via WhatsHub');
    }
};

const sendMedia = async (phone, file, caption) => {
    const apiKey = await getApiKey();
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error('Invalid phone number');

    const FormData = require('form-data');
    try {
        const form = new FormData();
        form.append('phone', normalizedPhone);
        // Still include caption in form for image/video media where it works
        if (caption) {
            form.append('caption', caption);
        }
        form.append('file', fs.createReadStream(file.path), file.originalname);

        const response = await axios.post(`${WHATSHUB_API_URL}/messages/send-media`, form, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...form.getHeaders()
            }
        });

        // WhatsHub API doesn't reliably deliver captions on document-type media (PDFs, etc.)
        // Send a follow-up text message with the caption so the customer always receives it
        const isDocument = file.mimetype && !file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/');
        if (caption && isDocument) {
            try {
                // Use original phone as sendText will re-normalize it
                await sendText(phone, caption);
            } catch (e) {
                console.warn('[WhatsHub] Follow-up caption text failed (media was sent):', e.message);
            }
        }

        return { delivered: true, msgId: response.data?.messageId, mediaUrl: response.data?.mediaUrl };
    } catch (error) {
        console.error('[WhatsHub] Error sending media:', error?.response?.data || error.message);
        throw new Error('Failed to send media via WhatsHub');
    }
};

const syncContact = async (phone, name, email = '') => {
    const apiKey = await getApiKey();
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error('Invalid phone number for sync');

    try {
        const response = await axios.post(`${WHATSHUB_API_URL}/contacts/sync`, {
            phone: normalizedPhone,
            name: name,
            email: email
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('[WhatsHub] Error syncing contact:', error?.response?.data || error.message);
        throw new Error('Failed to sync contact with WhatsHub');
    }
};

module.exports = {
    sendText,
    sendMedia,
    syncContact,
    normalizePhone
};
