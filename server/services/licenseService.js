/**
 * licenseService.js — Enterprise Offline Licensing & Security Service
 *
 * Implements:
 * 1. 4-Point Weighted HWID Profiling (Motherboard, CPU, MAC, C: Drive Volume)
 * 2. Cryptographic RSA-2048 Digital Signature Verification
 * 3. Hidden System Metadata Store (C:\Users\Public\Documents\.salescope_meta.dat)
 * 4. Clock-Tampering / Time-Travel Lockdown Detection
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { DATA_DIR } = require('../paths');

// ── Embed RSA-2048 Public Key ──────────────────────────────────────
// This Public Key is used to verify the digital signature of the license.
// The matching Private Key is kept secret on the developer's PC.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmDYxrmuV3Ug6NCJ+02XT
SnfByMVKzIbkSj9lh2MSDK6Uvh9+DHjkGQLdfpph8d3cppgNxDcPzAVdUnALVJy+
W6rGNWrkvLI6XXgQ1cfYEbKJvjqNFRBZquR6JTsfrzONHcwjmcRSeCifAX8EN8Wu
eo+t0ee0DcPXOk2K9RhJtnxRI5T/8foxwz10VEQAD3tDCEVb3Q9Wp0rNz51dRoic
mN6ZW2J/Hz6HPZpy9k/RPBmKx6+ujA0UBfciI4rpkjlz8vrzXfkxGY+OcFBZ/O56
2u/zD0Pyl8AIjPRCPekeyEcNEubzTjy5Y9Q4PXCfyc8FqVxbCheqS7DLP54VN/YF
1wIDAQAB
-----END PUBLIC KEY-----`;

// ── Configuration Paths ─────────────────────────────────────────────
const LICENSE_FILE = path.join(DATA_DIR, 'license.json');
const HIDDEN_META_FILE = 'C:\\Users\\Public\\Documents\\.salescope_meta.dat';
const META_ENCRYPTION_KEY = 'salescope-secure-token-998'; // Key for hidden metadata encryption

/**
 * Executes a shell command on Windows and cleans the output
 */
function execWinCmd(cmd) {
    try {
        if (process.platform !== 'win32') return '';
        const output = execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
        const lines = output.trim().split('\n');
        if (lines.length > 1) {
            return lines[1].trim(); // Get the second line containing the value
        }
        return '';
    } catch (e) {
        return '';
    }
}

/**
 * 1. Collect Hardware Fingerprint Profile
 */
const getHardwareProfile = () => {
    // A. Motherboard Serial Number
    let motherboard = execWinCmd('wmic baseboard get serialnumber');
    if (!motherboard || motherboard.includes('To Be Filled') || motherboard.includes('00000000')) {
        motherboard = execWinCmd('wmic bios get serialnumber');
    }

    // B. CPU Processor ID
    const cpu = execWinCmd('wmic cpu get processorid');

    // C. OS C: Drive Volume Serial Number
    const disk = execWinCmd('wmic logicaldisk where DeviceID="C:" get VolumeSerialNumber');

    // D. Primary Active MAC Address
    let mac = '';
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && iface.mac !== '00:00:00:00:00:00') {
                mac = iface.mac.toUpperCase();
                break;
            }
        }
        if (mac) break;
    }

    return {
        motherboard: motherboard ? motherboard.toUpperCase().trim() : 'UNKNOWN_BOARD',
        cpu: cpu ? cpu.toUpperCase().trim() : 'UNKNOWN_CPU',
        disk: disk ? disk.toUpperCase().trim() : 'UNKNOWN_DISK',
        mac: mac ? mac.trim() : 'UNKNOWN_MAC'
    };
};

/**
 * Encrypt and decrypt helper for hidden metadata
 */
function encryptMeta(data) {
    const cipher = crypto.createCipheriv('aes-256-ctr', crypto.scryptSync(META_ENCRYPTION_KEY, 'salt', 32), Buffer.alloc(16, 0));
    return Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]).toString('base64');
}

function decryptMeta(encryptedText) {
    try {
        const decipher = crypto.createDecipheriv('aes-256-ctr', crypto.scryptSync(META_ENCRYPTION_KEY, 'salt', 32), Buffer.alloc(16, 0));
        const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64')), decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch (e) {
        return null;
    }
}

/**
 * 2. Manage Hidden Metadata File
 */
const getHiddenMetadata = () => {
    if (!fs.existsSync(HIDDEN_META_FILE)) {
        const defaultMeta = {
            installTimestamp: Date.now(),
            lastRunTimestamp: Date.now(),
            lockout: false
        };
        saveHiddenMetadata(defaultMeta);
        return defaultMeta;
    }
    try {
        const cipherText = fs.readFileSync(HIDDEN_META_FILE, 'utf8');
        const meta = decryptMeta(cipherText);
        if (!meta) throw new Error('Decryption failed');
        return meta;
    } catch (e) {
        // Tampered metadata or read error -> trigger lockout
        const lockoutMeta = {
            installTimestamp: 0,
            lastRunTimestamp: Date.now() + 1000000000,
            lockout: true
        };
        saveHiddenMetadata(lockoutMeta);
        return lockoutMeta;
    }
};

const saveHiddenMetadata = (meta) => {
    try {
        const cipherText = encryptMeta(meta);
        fs.writeFileSync(HIDDEN_META_FILE, cipherText, 'utf8');
    } catch (e) {
        console.error('[License] Failed to write hidden metadata:', e.message);
    }
};

/**
 * 3. Update Last Run Time (To catch time travel)
 */
const touchLastRunTime = async () => {
    const meta = getHiddenMetadata();
    const now = Date.now();

    // Catch backward clock-tampering
    if (now < meta.lastRunTimestamp) {
        meta.lockout = true;
        console.error('[License] CLOCK TAMPERING DETECTED! Lockout triggered.');
    } else {
        meta.lastRunTimestamp = now;
    }
    saveHiddenMetadata(meta);

    // Also update in Database to ensure double locking
    try {
        const db = require('../db');
        await db.query('UPDATE store_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = 1');
    } catch (e) {
        // Database might not be initialized yet during early boot
    }
};

/**
 * 4. Verify License Key Cryptographically
 * Returns: { valid: boolean, payload: object, reason: string }
 */
const verifyLicenseKey = (keyString) => {
    try {
        if (!keyString) return { valid: false, reason: 'License key is missing.' };

        // Parse keyString format: Base64-encoded signed JSON payload
        const rawJson = Buffer.from(keyString, 'base64').toString('utf8');
        const license = JSON.parse(rawJson);

        const { data, signature } = license;
        if (!data || !signature) return { valid: false, reason: 'Invalid license key format.' };

        // Verify cryptographic signature using RSA Public Key
        const isSignatureValid = crypto.verify(
            'sha256',
            Buffer.from(JSON.stringify(data)),
            {
                key: PUBLIC_KEY,
                padding: crypto.constants.RSA_PKCS1_PADDING
            },
            Buffer.from(signature, 'base64')
        );

        if (!isSignatureValid) {
            return { valid: false, reason: 'License signature verification failed (key tampered).' };
        }

        // Signature is 100% genuine! Now check Hardware and Expiry
        const currentHWID = getHardwareProfile();
        const licenseHWID = data.hwid;

        // Calculate Weighted HWID Match Score (MAC, motherboard, CPU, disk)
        let matchCount = 0;
        let knownCount = 0;

        if (licenseHWID.motherboard !== 'UNKNOWN_BOARD') {
            knownCount++;
            if (currentHWID.motherboard === licenseHWID.motherboard) matchCount++;
        }
        if (licenseHWID.cpu !== 'UNKNOWN_CPU') {
            knownCount++;
            if (currentHWID.cpu === licenseHWID.cpu) matchCount++;
        }
        if (licenseHWID.disk !== 'UNKNOWN_DISK') {
            knownCount++;
            if (currentHWID.disk === licenseHWID.disk) matchCount++;
        }
        if (licenseHWID.mac !== 'UNKNOWN_MAC') {
            knownCount++;
            if (currentHWID.mac === licenseHWID.mac) matchCount++;
        }

        // Adaptive matching rule:
        // - If we have 3 or 4 known components, at least 2 must match.
        // - If we have 1 or 2 known components, all known components must match (minimum 1).
        const requiredMatches = knownCount >= 3 ? 2 : Math.max(1, knownCount);
        if (matchCount < requiredMatches) {
            return { valid: false, reason: `License locked to a different computer (Match: ${matchCount}/${knownCount}, Required: ${requiredMatches}).` };
        }

        // Check Expiry Date
        const expiryDate = new Date(data.expiry);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (expiryDate < today) {
            return { valid: false, reason: `License expired on ${data.expiry}.` };
        }

        return { valid: true, payload: data };
    } catch (e) {
        return { valid: false, reason: 'Malformed license string structure.' };
    }
};

/**
 * 5. Full Licensing Status Verification
 * Evaluates license keys, trials, and clock status.
 * Returns: { status: 'licensed' | 'trial_active' | 'trial_expired' | 'clock_tampered' | 'invalid', daysLeft: number, billsLeft: number, reason: string }
 */
const getLicenseStatus = async () => {
    const meta = getHiddenMetadata();
    const now = Date.now();

    // 1. Verify license key validity FIRST to enable self-healing
    let isKeyValid = false;
    let verificationPayload = null;
    let verificationDaysLeft = null;

    if (fs.existsSync(LICENSE_FILE)) {
        try {
            const licenseData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
            const verification = verifyLicenseKey(licenseData.key);
            if (verification.valid) {
                isKeyValid = true;
                verificationPayload = verification.payload;

                // Calculate days remaining dynamically
                const expiryDate = new Date(verification.payload.expiry);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const msPerDay = 1000 * 60 * 60 * 24;
                verificationDaysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / msPerDay));
            }
        } catch (e) {
            // Malformed license file
        }
    }

    // 2. Self-healing: If a valid license exists and the system clock is now correct (or forward), clear the lockout
    if (isKeyValid && meta.lockout && now >= meta.lastRunTimestamp) {
        meta.lockout = false;
        saveHiddenMetadata(meta);
        console.log('[License] Lockout self-healed successfully with valid cryptographic key.');
    }

    // 3. Enforce clock tampering lockout
    if (meta.lockout || now < meta.lastRunTimestamp) {
        return {
            status: 'clock_tampered',
            reason: 'System clock has been set backward. Please correct your PC system time.'
        };
    }

    // Verify double-lock with database timestamp
    try {
        const db = require('../db');
        const [settings] = await db.query('SELECT updated_at FROM store_settings WHERE id = 1 LIMIT 1');
        if (settings.length > 0) {
            const dbUpdatedAt = new Date(settings[0].updated_at).getTime();
            if (now < dbUpdatedAt - 60000) { // 1 min buffer for minor sync deviance
                meta.lockout = true;
                saveHiddenMetadata(meta);
                return {
                    status: 'clock_tampered',
                    reason: 'System clock differs significantly from last database transaction. Access blocked.'
                };
            }
        }
    } catch (e) {
        // Skip database check if DB connection is not initialized yet
    }

    // 4. Return valid license status if verified
    if (isKeyValid) {
        await touchLastRunTime();
        return {
            status: 'licensed',
            payload: verificationPayload,
            daysLeft: verificationDaysLeft,
            reason: 'Software is fully activated.'
        };
    }

    // --- NO TRIAL MODE ALLOWED (Locked from Day 1) ---
    await touchLastRunTime();

    return {
        status: 'trial_expired',
        daysLeft: 0,
        billsLeft: 0,
        reason: 'Please activate your software license key.'
    };
};

/**
 * 6. Save License Key File (Activate)
 */
const activateLicense = async (keyString) => {
    const verification = verifyLicenseKey(keyString);
    if (!verification.valid) {
        throw new Error(verification.reason);
    }

    // Save key to license.json
    fs.writeFileSync(LICENSE_FILE, JSON.stringify({ key: keyString }, null, 2), 'utf8');
    
    // Clear clock-tampering lockout upon successful cryptographic activation
    const meta = getHiddenMetadata();
    meta.lockout = false;
    meta.lastRunTimestamp = Date.now();
    saveHiddenMetadata(meta);

    // Refresh last run time to keep in sync
    await touchLastRunTime();
    return verification.payload;
};

/**
 * 7. Deactivate / Revoke License
 */
const deactivateLicense = async () => {
    if (fs.existsSync(LICENSE_FILE)) {
        fs.unlinkSync(LICENSE_FILE);
    }
    await touchLastRunTime();
    return { success: true };
};

module.exports = {
    getHardwareProfile,
    getHiddenMetadata,
    touchLastRunTime,
    verifyLicenseKey,
    getLicenseStatus,
    activateLicense,
    deactivateLicense
};
