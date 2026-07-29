const db = require('../db');
const baileysProvider = require('./whatsappService');
const whatshubProvider = require('./whatshubProvider');

/**
 * Returns the correct provider for a specific feature based on messaging_settings
 * Features: 'invoices', 'bills', 'bulk', 'marketing', 'sync'
 */
const getProvider = async (feature) => {
    const [rows] = await db.query('SELECT * FROM messaging_settings WHERE id = 1');
    if (rows.length === 0) return baileysProvider; // Fallback

    const settings = rows[0];
    
    // Check if there is a specific override for this feature
    const overrideKey = `override_${feature}`;
    let selectedProvider = settings[overrideKey] || settings.default_provider || 'baileys';

    // Verify the selected provider is enabled
    if (selectedProvider === 'whatshub' && !settings.whatshub_enabled) {
        selectedProvider = 'baileys'; // Fallback if disabled
    }
    if (selectedProvider === 'baileys' && !settings.baileys_enabled) {
        if (settings.whatshub_enabled) {
            selectedProvider = 'whatshub'; // Smart fallback to whatshub if baileys is disabled
        } else {
            throw new Error('No enabled messaging provider available');
        }
    }

    if (selectedProvider === 'whatshub') {
        return whatshubProvider;
    }

    return baileysProvider;
};

module.exports = {
    getProvider
};
