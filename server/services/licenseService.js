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
const axios = require('axios');
const jwt = require('jsonwebtoken');

// ── Node-Locked AES-256 Symmetric Encryption/Decryption ─────────────
function getEncryptionKey() {
    const hw = getHardwareProfile();
    const keyBasis = `salescope-secure-key-${hw.motherboard}-${hw.cpu}-${hw.disk}`;
    return crypto.createHash('sha256').update(keyBasis).digest('hex'); // 64 char hex string (32 bytes)
}

function encryptLicense(data) {
    try {
        const key = crypto.scryptSync(getEncryptionKey(), 'license-salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
        return JSON.stringify({
            iv: iv.toString('base64'),
            data: encrypted.toString('base64')
        });
    } catch (e) {
        console.error('[License] Encryption failed:', e.message);
        return JSON.stringify(data); // Fallback to raw if encryption crashes
    }
}

function decryptLicense(cipherText) {
    try {
        const parsed = JSON.parse(cipherText);
        if (!parsed.iv || !parsed.data) {
            // Backward compatibility: maybe it's unencrypted JSON
            return parsed; 
        }
        const key = crypto.scryptSync(getEncryptionKey(), 'license-salt', 32);
        const iv = Buffer.from(parsed.iv, 'base64');
        const encryptedText = Buffer.from(parsed.data, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch (e) {
        // Fallback to parsing raw unencrypted JSON
        try {
            return JSON.parse(cipherText);
        } catch (err) {
            return null;
        }
    }
}

// ── Asymmetric Token Verification Fallback (offline local validation)
const DEFAULT_LIC_SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvZ7UoZHo4dYXFliRcG7J
Z3iteeKaBReY9mQxjbvmOXpwGUNETKENS82yMdgGIWCAX9heSAmlmgtZ3eds5I53
MqYZBnk8YvM/xvvRF4qyoRGyo9L4bz+IB0eDqItA9v2rEEQ3D3bCWIiP8gyBsSn8
g1/Y61jv+i7Tu3Q60yg012Hm19uWHwEuWY3rZhR8kMHhDQxheM9C8grB21fI1nTz
b01FY4nBIzxQH8NBq9izc6R109ahIjCC7HX/+o+bN0O1uNguhO75SAdVhIVdehzx
i+VFtKLjTWYSO0rV2OlIB3fKgwAziorQ3HkGqXHG9GboaXaHTm3Dnar9ndVHyV0u
iwIDAQAB
-----END PUBLIC KEY-----`;

function getPhysicalMacAddresses() {
    const macs = [];
    const interfaces = os.networkInterfaces();
    const sortedNames = Object.keys(interfaces).sort();
    const virtualPattern = /veth|docker|vbox|vmnet|wsl|virtual|tap|tun|vpn|hyper-v|bridge|terredo/i;

    for (const name of sortedNames) {
        if (virtualPattern.test(name)) continue;
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                const upperMac = iface.mac.toUpperCase().trim();
                if (!macs.includes(upperMac)) {
                    macs.push(upperMac);
                }
            }
        }
    }
    return macs;
}

function verifyOnlineTokenLocally(token) {
    try {
        const metaKey = getHiddenMetadata()?.serverPublicKey;
        const publicKey = metaKey
            || (process.env.LIC_SERVER_PUBLIC_KEY ? process.env.LIC_SERVER_PUBLIC_KEY.replace(/\\n/g, '\n') : DEFAULT_LIC_SERVER_PUBLIC_KEY);
        
        if (!publicKey) {
            return { valid: false, reason: 'LIC_SERVER_PUBLIC_KEY environment variable is not defined.' };
        }
        
        const decoded = jwt.verify(token, publicKey, {
            algorithms: ['RS256'],
            issuer: 'salescope-licensing-server'
        });
        
        // Robust HWID binding check across all physical MAC addresses on the machine
        const currentHWID = getHardwareProfile();
        const physicalMacs = getPhysicalMacAddresses();
        if (currentHWID.mac && !physicalMacs.includes(currentHWID.mac)) {
            physicalMacs.push(currentHWID.mac);
        }
        
        let isHwidMatched = false;
        for (const mac of physicalMacs) {
            const hwidString = `BOARD:${currentHWID.motherboard}|CPU:${currentHWID.cpu}|DISK:${currentHWID.disk}|MAC:${mac}`;
            const localHashedHwid = crypto.createHash('sha256').update(hwidString).digest('hex').toLowerCase();
            if (decoded.hwid === localHashedHwid) {
                isHwidMatched = true;
                break;
            }
        }

        // Fallback: If MAC changed completely (e.g. USB adapter unplugged), check cached metadata HWID or core components
        if (!isHwidMatched) {
            const meta = getHiddenMetadata();
            if (meta && meta.savedHwid) {
                const saved = meta.savedHwid;
                let matchCount = 0;
                let knownCount = 0;
                if (saved.motherboard && saved.motherboard !== 'UNKNOWN_BOARD') { knownCount++; if (currentHWID.motherboard === saved.motherboard) matchCount++; }
                if (saved.cpu && saved.cpu !== 'UNKNOWN_CPU') { knownCount++; if (currentHWID.cpu === saved.cpu) matchCount++; }
                if (saved.disk && saved.disk !== 'UNKNOWN_DISK') { knownCount++; if (currentHWID.disk === saved.disk) matchCount++; }
                if (knownCount > 0 && matchCount >= Math.min(2, knownCount)) {
                    isHwidMatched = true;
                }
            }
        }
        
        if (!isHwidMatched) {
            return { valid: false, reason: 'License token belongs to a different hardware profile.' };
        }
        
        return { valid: true, payload: decoded };
    } catch (err) {
        return { valid: false, reason: `Local token verification failed: ${err.message}` };
    }
}

// ── Configuration Retrieval
const getLicenseConfig = () => {
    const serverUrl = process.env.LIC_SERVER_URL || 'https://salescope-api.onrender.com';
    const validationIntervalHours = parseInt(process.env.LIC_VALIDATION_INTERVAL_HOURS || '1', 10);
    const offlineGraceDays = parseInt(process.env.LIC_OFFLINE_GRACE_DAYS || '3', 10); // 3-day default offline grace
    return { serverUrl, validationIntervalHours, offlineGraceDays };
};

/**
 * Discovers and caches the latest RS256 Public Key from the Licensing Server.
 */
async function fetchServerPublicKey() {
    try {
        const { serverUrl } = getLicenseConfig();
        const response = await axios.get(`${serverUrl}/api/license/public-key`, { timeout: 10000 });
        if (response.data && response.data.publicKey) {
            const meta = getHiddenMetadata();
            meta.serverPublicKey = response.data.publicKey;
            saveHiddenMetadata(meta);
            return response.data.publicKey;
        }
    } catch (e) {
        // Silent fallback to local cached/default key
    }
    return null;
}

/**
 * Sends a background heartbeat telemetry ping to update lastSeen & status on lic-server
 */
async function sendLicenseHeartbeat() {
    try {
        if (!fs.existsSync(LICENSE_FILE)) return;
        let licenseData;
        try {
            licenseData = decryptLicense(fs.readFileSync(LICENSE_FILE, 'utf8'));
        } catch (e) {}

        if (!licenseData || licenseData.type !== 'online' || !licenseData.token) return;

        const { serverUrl } = getLicenseConfig();
        const currentHWID = getHardwareProfile();
        const hwidString = `BOARD:${currentHWID.motherboard}|CPU:${currentHWID.cpu}|DISK:${currentHWID.disk}|MAC:${currentHWID.mac}`;

        await axios.post(`${serverUrl}/api/license/heartbeat`, {
            token: licenseData.token,
            hwid: hwidString
        }, { timeout: 15000 });
    } catch (e) {
        // Silent background telemetry failure
    }
}

/**
 * Resolves a descriptive store + host device name for lic-server admin monitoring
 */
async function getStoreDeviceName() {
    let storeName = 'SaleScope POS';
    try {
        const db = require('../db');
        const [rows] = await db.query('SELECT store_name FROM store_settings WHERE id = 1 LIMIT 1');
        if (rows && rows.length > 0 && rows[0].store_name) {
            storeName = rows[0].store_name;
        }
    } catch (e) {}
    const host = os.hostname() || 'Device';
    return `${storeName} (${host})`;
}


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
const SYSTEM_LICENSE_BACKUP_FILE = 'C:\\Users\\Public\\Documents\\.salescope_license.dat';
const META_ENCRYPTION_KEY = 'salescope-secure-token-998'; // Key for hidden metadata encryption

/**
 * Multi-Location Permanent License Backup & Storage Engine
 * Saves license data redundantly to:
 * 1. Primary file (DATA_DIR/license.json)
 * 2. System backup file (C:\Users\Public\Documents\.salescope_license.dat)
 * 3. Hidden metadata (.salescope_meta.dat)
 * 4. Database store_settings table (license_key_data column)
 */
function saveStoredLicense(licenseData) {
    try {
        const encrypted = encryptLicense(licenseData);
        // 1. Primary file in DATA_DIR
        fs.writeFileSync(LICENSE_FILE, encrypted, 'utf8');

        // 2. System backup file in Public Documents
        try {
            fs.writeFileSync(SYSTEM_LICENSE_BACKUP_FILE, encrypted, 'utf8');
        } catch (e) {}

        // 3. Hidden metadata backup
        try {
            const meta = getHiddenMetadata();
            meta.savedLicenseData = encrypted;
            saveHiddenMetadata(meta);
        } catch (e) {}

        // 4. Database backup
        try {
            const db = require('../db');
            db.query('UPDATE store_settings SET license_key_data = ? WHERE id = 1', [encrypted]).catch(() => {});
        } catch (e) {}
    } catch (e) {
        console.error('[License] Failed to save stored license backup:', e.message);
    }
}

/**
 * Auto-recovers license from redundant backup sources if primary file is lost or corrupt.
 */
async function autoRestoreLicense() {
    let rawEncrypted = null;

    // Check Backup 1: System Public Documents file
    if (fs.existsSync(SYSTEM_LICENSE_BACKUP_FILE)) {
        try {
            rawEncrypted = fs.readFileSync(SYSTEM_LICENSE_BACKUP_FILE, 'utf8');
        } catch (e) {}
    }

    // Check Backup 2: Hidden Metadata
    if (!rawEncrypted) {
        try {
            const meta = getHiddenMetadata();
            if (meta && meta.savedLicenseData) {
                rawEncrypted = meta.savedLicenseData;
            }
        } catch (e) {}
    }

    // Check Backup 3: Database
    if (!rawEncrypted) {
        try {
            const db = require('../db');
            const [rows] = await db.query('SELECT license_key_data FROM store_settings WHERE id = 1 LIMIT 1');
            if (rows && rows.length > 0 && rows[0].license_key_data) {
                rawEncrypted = rows[0].license_key_data;
            }
        } catch (e) {}
    }

    if (rawEncrypted) {
        try {
            const decrypted = decryptLicense(rawEncrypted);
            if (decrypted && decrypted.key) {
                // Silently auto-restore primary file
                try {
                    fs.writeFileSync(LICENSE_FILE, rawEncrypted, 'utf8');
                } catch (e) {}
                console.log('[License Auto-Recovery] Successfully auto-restored license key from backup storage.');
                return decrypted;
            }
        } catch (e) {}
    }

    return null;
}

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
 * Executes a PowerShell command on Windows and returns clean output
 */
function execPowerShellCmd(cmd) {
    try {
        if (process.platform !== 'win32') return '';
        const output = execSync(`powershell -NoProfile -Command "${cmd}"`, { stdio: 'pipe', encoding: 'utf8' });
        return output.trim();
    } catch (e) {
        return '';
    }
}

const util = require('util');
const execAsync = util.promisify(require('child_process').exec);

async function execWinCmdAsync(cmd) {
    try {
        if (process.platform !== 'win32') return '';
        const { stdout } = await execAsync(cmd, { encoding: 'utf8' });
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
            return lines[1].trim(); 
        }
        return '';
    } catch (e) {
        return '';
    }
}

async function execPowerShellCmdAsync(cmd) {
    try {
        if (process.platform !== 'win32') return '';
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${cmd}"`, { encoding: 'utf8' });
        return stdout.trim();
    } catch (e) {
        return '';
    }
}

let cachedHWID = null;

const prewarmHardwareProfileAsync = async () => {
    if (cachedHWID) return cachedHWID;

    try {
        let motherboard = await execWinCmdAsync('wmic baseboard get serialnumber');
        if (!motherboard || motherboard.includes('To Be Filled') || motherboard.includes('00000000') || motherboard.trim() === '') {
            motherboard = await execPowerShellCmdAsync('Get-CimInstance -ClassName Win32_BaseBoard | Select-Object -ExpandProperty SerialNumber');
        }
        if (!motherboard || motherboard.includes('To Be Filled') || motherboard.includes('00000000') || motherboard.trim() === '') {
            motherboard = await execWinCmdAsync('wmic bios get serialnumber');
        }
        if (!motherboard || motherboard.includes('To Be Filled') || motherboard.includes('00000000') || motherboard.trim() === '') {
            motherboard = await execPowerShellCmdAsync('Get-CimInstance -ClassName Win32_BIOS | Select-Object -ExpandProperty SerialNumber');
        }

        let cpu = await execWinCmdAsync('wmic cpu get processorid');
        if (!cpu || cpu.trim() === '') {
            cpu = await execPowerShellCmdAsync('Get-CimInstance -ClassName Win32_Processor | Select-Object -ExpandProperty ProcessorId');
        }

        let disk = await execWinCmdAsync('wmic logicaldisk where DeviceID="C:" get VolumeSerialNumber');
        if (!disk || disk.trim() === '') {
            disk = await execPowerShellCmdAsync('Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID=\'C:\'" | Select-Object -ExpandProperty VolumeSerialNumber');
        }

        let mac = '';
        const physicalMacs = getPhysicalMacAddresses();
        if (physicalMacs.length > 0) {
            mac = physicalMacs[0];
        }

        const metaBackup = getHiddenMetadata();
        if (metaBackup && metaBackup.savedHwid) {
            if ((!motherboard || motherboard.includes('UNKNOWN')) && metaBackup.savedHwid.motherboard) {
                motherboard = metaBackup.savedHwid.motherboard;
            }
            if ((!cpu || cpu.includes('UNKNOWN')) && metaBackup.savedHwid.cpu) {
                cpu = metaBackup.savedHwid.cpu;
            }
            if ((!disk || disk.includes('UNKNOWN')) && metaBackup.savedHwid.disk) {
                disk = metaBackup.savedHwid.disk;
            }
            if (!mac && metaBackup.savedHwid.mac) {
                mac = metaBackup.savedHwid.mac;
            }
        }

        cachedHWID = {
            motherboard: motherboard ? motherboard.toUpperCase().trim() : 'UNKNOWN_BOARD',
            cpu: cpu ? cpu.toUpperCase().trim() : 'UNKNOWN_CPU',
            disk: disk ? disk.toUpperCase().trim() : 'UNKNOWN_DISK',
            mac: mac ? mac.trim() : 'UNKNOWN_MAC'
        };
        
        if (cachedHWID.motherboard !== 'UNKNOWN_BOARD' || cachedHWID.cpu !== 'UNKNOWN_CPU') {
            metaBackup.savedHwid = cachedHWID;
            saveHiddenMetadata(metaBackup);
        }

        return cachedHWID;
    } catch (e) {
        console.error('[License] Failed to prewarm hardware profile asynchronously:', e.message);
        return { motherboard: 'UNKNOWN_BOARD', cpu: 'UNKNOWN_CPU', disk: 'UNKNOWN_DISK', mac: 'UNKNOWN_MAC' };
    }
};

// Immediately prewarm hardware profile asynchronously on module load
prewarmHardwareProfileAsync().catch(() => {});

/**
 * 1. Collect Hardware Fingerprint Profile
 */
const getHardwareProfile = () => {
    if (cachedHWID) return cachedHWID;

    // A. Motherboard Serial Number
    let motherboard = execWinCmd('wmic baseboard get serialnumber');
    if (!motherboard || motherboard.includes('To Be Filled') || motherboard.includes('00000000') || motherboard.trim() === '') {
        motherboard = execPowerShellCmd('Get-CimInstance -ClassName Win32_BaseBoard | Select-Object -ExpandProperty SerialNumber');
    }
    if (!motherboard || motherboard.includes('To Be Filled') || motherboard.includes('00000000') || motherboard.trim() === '') {
        motherboard = execWinCmd('wmic bios get serialnumber');
    }
    if (!motherboard || motherboard.includes('To Be Filled') || motherboard.includes('00000000') || motherboard.trim() === '') {
        motherboard = execPowerShellCmd('Get-CimInstance -ClassName Win32_BIOS | Select-Object -ExpandProperty SerialNumber');
    }

    // B. CPU Processor ID
    let cpu = execWinCmd('wmic cpu get processorid');
    if (!cpu || cpu.trim() === '') {
        cpu = execPowerShellCmd('Get-CimInstance -ClassName Win32_Processor | Select-Object -ExpandProperty ProcessorId');
    }

    // C. OS C: Drive Volume Serial Number
    let disk = execWinCmd('wmic logicaldisk where DeviceID="C:" get VolumeSerialNumber');
    if (!disk || disk.trim() === '') {
        disk = execPowerShellCmd('Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID=\'C:\'" | Select-Object -ExpandProperty VolumeSerialNumber');
    }

    // D. Primary Active MAC Address (filtered)
    let mac = '';
    const physicalMacs = getPhysicalMacAddresses();
    if (physicalMacs.length > 0) {
        mac = physicalMacs[0];
    }

    const metaBackup = getHiddenMetadata();
    if (metaBackup && metaBackup.savedHwid) {
        if ((!motherboard || motherboard.includes('UNKNOWN')) && metaBackup.savedHwid.motherboard) {
            motherboard = metaBackup.savedHwid.motherboard;
        }
        if ((!cpu || cpu.includes('UNKNOWN')) && metaBackup.savedHwid.cpu) {
            cpu = metaBackup.savedHwid.cpu;
        }
        if ((!disk || disk.includes('UNKNOWN')) && metaBackup.savedHwid.disk) {
            disk = metaBackup.savedHwid.disk;
        }
        if (!mac && metaBackup.savedHwid.mac) {
            mac = metaBackup.savedHwid.mac;
        }
    }

    cachedHWID = {
        motherboard: motherboard ? motherboard.toUpperCase().trim() : 'UNKNOWN_BOARD',
        cpu: cpu ? cpu.toUpperCase().trim() : 'UNKNOWN_CPU',
        disk: disk ? disk.toUpperCase().trim() : 'UNKNOWN_DISK',
        mac: mac ? mac.trim() : 'UNKNOWN_MAC'
    };

    if (cachedHWID.motherboard !== 'UNKNOWN_BOARD' || cachedHWID.cpu !== 'UNKNOWN_CPU') {
        metaBackup.savedHwid = cachedHWID;
        saveHiddenMetadata(metaBackup);
    }

    return cachedHWID;
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
 * PERFORMANCE: Cached in-memory for 30s to avoid disk read + crypto on every call.
 */
let cachedMeta = null;
let metaCacheTime = 0;
const META_CACHE_TTL = 30000; // 30 seconds

const getHiddenMetadata = (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedMeta && (now - metaCacheTime) < META_CACHE_TTL) {
        return cachedMeta;
    }

    if (!fs.existsSync(HIDDEN_META_FILE)) {
        const defaultMeta = {
            installTimestamp: Date.now(),
            lastRunTimestamp: Date.now(),
            lockout: false
        };
        saveHiddenMetadata(defaultMeta);
        cachedMeta = defaultMeta;
        metaCacheTime = Date.now();
        return defaultMeta;
    }
    try {
        const cipherText = fs.readFileSync(HIDDEN_META_FILE, 'utf8');
        const meta = decryptMeta(cipherText);
        if (!meta) throw new Error('Decryption failed');
        cachedMeta = meta;
        metaCacheTime = Date.now();
        return meta;
    } catch (e) {
        // Tampered metadata or read error -> trigger lockout
        const lockoutMeta = {
            installTimestamp: 0,
            lastRunTimestamp: Date.now() + 1000000000,
            lockout: true
        };
        saveHiddenMetadata(lockoutMeta);
        cachedMeta = lockoutMeta;
        metaCacheTime = Date.now();
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
 * PERFORMANCE: Throttled to once per 60 seconds. Writing to disk + DB on every
 * API request was causing extreme I/O pressure.
 */
let lastTouchTime = 0;
const TOUCH_THROTTLE_MS = 60000; // 60 seconds

const CLOCK_BUFFER_MS = 10 * 60 * 1000; // 10 minutes tolerance for NTP sync & sleep/wake

const touchLastRunTime = async () => {
    const now = Date.now();
    // Throttle: skip if we wrote less than 60s ago
    if ((now - lastTouchTime) < TOUCH_THROTTLE_MS) {
        return;
    }

    const meta = getHiddenMetadata(true); // force-refresh from disk for accuracy

    // Catch backward clock-tampering (beyond 10 minutes tolerance)
    if (now < (meta.lastRunTimestamp - CLOCK_BUFFER_MS)) {
        meta.lockout = true;
        console.error('[License] CLOCK TAMPERING DETECTED! Lockout triggered.');
    } else {
        if (now > meta.lastRunTimestamp) {
            meta.lastRunTimestamp = now;
        }
    }
    saveHiddenMetadata(meta);
    cachedMeta = meta;
    metaCacheTime = Date.now();
    lastTouchTime = now;

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
let activeLicenseStatus = null;

const performFullLicenseCheck = async (forceSync) => {
    const meta = getHiddenMetadata();
    const now = Date.now();

    const CLOCK_BUFFER_MS = 10 * 60 * 1000; // 10 minutes buffer for NTP time sync

    // Enforce clock tampering lockout
    if (meta.lockout || now < (meta.lastRunTimestamp - CLOCK_BUFFER_MS)) {
        return {
            status: 'clock_tampered',
            reason: 'System clock has been set backward significantly. Please correct your PC system time.'
        };
    }

    // Verify double-lock with database timestamp
    try {
        const db = require('../db');
        const [settings] = await db.query('SELECT UNIX_TIMESTAMP(updated_at) AS updated_at_unix FROM store_settings WHERE id = 1 LIMIT 1');
        if (settings.length > 0) {
            const dbUpdatedAt = settings[0].updated_at_unix * 1000;
            if (now < (dbUpdatedAt - CLOCK_BUFFER_MS)) { // 10 min buffer for minor sync deviance
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

    if (!fs.existsSync(LICENSE_FILE)) {
        const restored = await autoRestoreLicense();
        if (!restored) {
            await touchLastRunTime();
            return {
                status: 'trial_expired',
                daysLeft: 0,
                billsLeft: 0,
                reason: 'Please activate your software license key.'
            };
        }
    }

    let licenseData = null;
    try {
        licenseData = decryptLicense(fs.readFileSync(LICENSE_FILE, 'utf8'));
    } catch (e) {
        // Malformed license file
    }

    if (!licenseData || !licenseData.key) {
        licenseData = await autoRestoreLicense();
    }

    if (!licenseData || !licenseData.key) {
        await touchLastRunTime();
        return {
            status: 'trial_expired',
            daysLeft: 0,
            billsLeft: 0,
            reason: 'Malformed license file. Please reactivate.'
        };
    }

    // Determine license type (default to offline if no type is saved)
    const isOnline = licenseData.type === 'online';
    const isPending = licenseData.type === 'pending_online';

    if (isPending) {
        const { serverUrl } = getLicenseConfig();
        try {
            const currentHWID = getHardwareProfile();
            const hwidString = `BOARD:${currentHWID.motherboard}|CPU:${currentHWID.cpu}|DISK:${currentHWID.disk}|MAC:${currentHWID.mac}`;
            const response = await axios.post(`${serverUrl}/api/license/status-check`, {
                license_key: licenseData.key,
                hwid: hwidString
            }, { timeout: 45000 });

            if (response.data.status === 'ACTIVE') {
                // Admin approved! Upgrade to fully licensed online key.
                const token = response.data.token;
                const decodedPayload = jwt.decode(token);
                
                licenseData.token = token;
                licenseData.type = 'online';
                licenseData.lastVerified = Date.now();
                licenseData.expiresAt = response.data.expiresAt;
                licenseData.payload = decodedPayload;
                
                saveStoredLicense(licenseData);
                
                meta.lockout = false;
                meta.lastRunTimestamp = Date.now();
                saveHiddenMetadata(meta);
                await touchLastRunTime();
                
                return {
                    status: 'licensed',
                    payload: { issuedTo: decodedPayload.customerName || 'Premium Subscriber', expiry: response.data.expiresAt, type: 'online' },
                    daysLeft: Math.max(0, Math.ceil((new Date(response.data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
                    reason: 'Software is fully activated.'
                };
            } else if (response.data.status === 'PENDING') {
                return { status: 'pending', reason: 'Activation request submitted. Waiting for Admin Approval.' };
            } else if (response.data.status === 'DECLINED') {
                try { fs.unlinkSync(LICENSE_FILE); } catch (e) {}
                return { status: 'invalid', reason: 'Activation request was declined by the administrator.' };
            }
        } catch (err) {
            return { status: 'pending', reason: 'Checking activation status... Unable to reach server.' };
        }
    } else if (isOnline) {
        const { serverUrl, validationIntervalHours, offlineGraceDays } = getLicenseConfig();
        
        // A. Dynamic Expiry Check
        const expiryDate = new Date(licenseData.expiresAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (expiryDate < today) {
            await touchLastRunTime();
            return {
                status: 'invalid',
                reason: `License expired on ${licenseData.expiresAt}.`
            };
        }

        const msPerHour = 1000 * 60 * 60;
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / msPerDay));
        
        // B. Check if we need to contact server (e.g. interval exceeded or forced)
        const lastVerified = licenseData.lastVerified || 0;
        const hoursSinceVerification = (Date.now() - lastVerified) / msPerHour;
        const daysSinceVerification = (Date.now() - lastVerified) / msPerDay;

        if (forceSync || hoursSinceVerification > validationIntervalHours) {
            // Need online validation check!
            try {
                const response = await axios.post(`${serverUrl}/api/license/validate`, {
                    token: licenseData.token
                }, { timeout: 45000 }); // 45 second timeout to allow Render cold starts
                
                if (response.data && response.data.valid) {
                    // Update cache state & backup storage
                    licenseData.lastVerified = Date.now();
                    saveStoredLicense(licenseData);
                    await touchLastRunTime();
                    
                    return {
                        status: 'licensed',
                        payload: {
                            issuedTo: response.data.customerName || 'Premium Subscriber',
                            expiry: response.data.expiry,
                            type: 'online'
                        },
                        daysLeft,
                        reason: 'Software is fully activated (online validated).'
                    };
                } else {
                    // Server explicitly responded invalid (revoked by admin)
                    await touchLastRunTime();
                    return {
                        status: 'invalid',
                        reason: response.data?.error || 'License revoked or disabled by server administrator.'
                    };
                }
            } catch (error) {
                // Check if the server explicitly rejected the validation (e.g., 401 Unauthorized due to revoked/expired license)
                if (error.response && (error.response.status === 401 || error.response.status === 400)) {
                    await touchLastRunTime();
                    return {
                        status: 'invalid',
                        reason: error.response.data?.error || 'License revoked or expired by server administrator.'
                    };
                }

                // Online check failed (network downtime, Render cold start, or server unreachable)
                
                // Enforce strictly 3-day offline threshold
                if (daysSinceVerification > offlineGraceDays) {
                    await touchLastRunTime();
                    return {
                        status: 'invalid',
                        reason: `Software has been offline for more than ${offlineGraceDays} days. Please connect to the internet to verify your license status.`
                    };
                }

                // When network disconnects, as long as activation key hasn't passed expiry date and is within 3 days, STAY LICENSED!
                if (expiryDate >= today) {
                    await touchLastRunTime();
                    return {
                        status: 'licensed',
                        payload: {
                            issuedTo: licenseData.payload?.customerName || 'Premium Subscriber',
                            expiry: licenseData.expiresAt,
                            type: 'online'
                        },
                        daysLeft,
                        reason: 'Software is fully activated (Offline mode).'
                    };
                } else {
                    await touchLastRunTime();
                    return {
                        status: 'invalid',
                        reason: `License expired on ${licenseData.expiresAt}.`
                    };
                }
            }
        } else {
            // Under validation interval, check expiration date
            if (expiryDate >= today) {
                await touchLastRunTime();
                return {
                    status: 'licensed',
                    payload: {
                        issuedTo: licenseData.payload?.customerName || 'Premium Subscriber',
                        expiry: licenseData.expiresAt,
                        type: 'online'
                    },
                    daysLeft,
                    reason: 'Software is fully activated.'
                };
            } else {
                await touchLastRunTime();
                return {
                    status: 'invalid',
                    reason: `License expired on ${licenseData.expiresAt}.`
                };
            }
        }
    } else {
        // Traditional offline RSA-2048 licensing flow
        const verification = verifyLicenseKey(licenseData.key);
        if (verification.valid) {
            const expiryDate = new Date(verification.payload.expiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / msPerDay));

            await touchLastRunTime();
            return {
                status: 'licensed',
                payload: verification.payload,
                daysLeft,
                reason: 'Software is fully activated (offline authorized).'
            };
        } else {
            await touchLastRunTime();
            return {
                status: 'invalid',
                reason: verification.reason
            };
        }
    }
};

const getLicenseStatus = async (forceSync = false) => {
    if (!forceSync && activeLicenseStatus && activeLicenseStatus.status !== 'pending') {
        return activeLicenseStatus;
    }
    const result = await performFullLicenseCheck(forceSync);
    activeLicenseStatus = result;
    return result;
};

/**
 * 6. Save License Key File (Activate)
 */
const activateLicense = async (keyString) => {
    // Invalidate cached status so the next status check gets fresh data from disk/network
    activeLicenseStatus = null;

    // 1. Check if it's an online key (starts with SC-)
    const isOnlineKey = /^SC-/i.test(keyString.trim());
    
    if (isOnlineKey) {
        const { serverUrl } = getLicenseConfig();
        const currentHWID = getHardwareProfile();
        const hwidString = `BOARD:${currentHWID.motherboard}|CPU:${currentHWID.cpu}|DISK:${currentHWID.disk}|MAC:${currentHWID.mac}`;
        
        try {
            const deviceName = await getStoreDeviceName();
            // Activate online against lic-server
            const response = await axios.post(`${serverUrl}/api/license/activate`, {
                license_key: keyString.trim(),
                hwid: hwidString,
                device_name: deviceName
            }, { timeout: 45000 });
            
            if (response.data && response.data.success) {
                if (response.data.status === 'PENDING') {
                    // Pending Admin Approval Flow
                    const licenseData = {
                        key: keyString.trim(),
                        type: 'pending_online',
                        hwid: hwidString
                    };
                    saveStoredLicense(licenseData);
                    await touchLastRunTime();
                    
                    return {
                        status: 'pending',
                        reason: 'Activation request submitted. Waiting for admin approval.'
                    };
                }

                const token = response.data.token;
                const decodedPayload = jwt.decode(token);
                
                const licenseData = {
                    key: keyString.trim(),
                    token: token,
                    type: 'online',
                    lastVerified: Date.now(),
                    expiresAt: response.data.expiresAt,
                    payload: decodedPayload
                };
                
                // Write encrypted license to primary file + backups
                saveStoredLicense(licenseData);
                
                // Clear clock-tampering lockout upon successful cryptographic activation
                const meta = getHiddenMetadata();
                meta.lockout = false;
                meta.lastRunTimestamp = Date.now();
                saveHiddenMetadata(meta);
                
                // Refresh last run time to keep in sync
                await touchLastRunTime();
                
                return {
                    issuedTo: decodedPayload.customerName || 'Premium Subscriber',
                    expiry: response.data.expiresAt,
                    type: 'online'
                };
            } else {
                throw new Error(response.data?.error || 'Online activation failed.');
            }
        } catch (error) {
            console.error('[License] Online Activation Error:', error.message);
            const serverError = error.response?.data?.error || error.message;
            throw new Error(`Activation failed: ${serverError}`);
        }
    } else {
        // Traditional offline base64 license activation
        const verification = verifyLicenseKey(keyString);
        if (!verification.valid) {
            throw new Error(verification.reason);
        }

        const licenseData = {
            key: keyString,
            type: 'offline'
        };

        // Save key to primary file + backups
        saveStoredLicense(licenseData);
        
        // Clear clock-tampering lockout upon successful cryptographic activation
        const meta = getHiddenMetadata();
        meta.lockout = false;
        meta.lastRunTimestamp = Date.now();
        saveHiddenMetadata(meta);

        // Refresh last run time to keep in sync
        await touchLastRunTime();
        return verification.payload;
    }
};

/**
 * 7. Deactivate / Revoke License
 */
const deactivateLicense = async () => {
    if (fs.existsSync(LICENSE_FILE)) {
        let licenseData;
        try {
            licenseData = decryptLicense(fs.readFileSync(LICENSE_FILE, 'utf8'));
        } catch (e) {}

        if (licenseData && licenseData.type === 'online') {
            // Mandatory Online Deactivation
            const { serverUrl } = getLicenseConfig();
            const currentHWID = getHardwareProfile();
            const hwidString = `BOARD:${currentHWID.motherboard}|CPU:${currentHWID.cpu}|DISK:${currentHWID.disk}|MAC:${currentHWID.mac}`;
            
            try {
                const response = await axios.post(`${serverUrl}/api/license/deactivate`, {
                    token: licenseData.token,
                    hwid: hwidString
                }, { timeout: 45000 });
                
                if (!response.data.success) {
                    throw new Error('Server declined deactivation.');
                }
            } catch (e) {
                const errorMsg = e.response?.data?.error || e.message;
                throw new Error(`Internet connection is required to deactivate online licenses. Server error: ${errorMsg}`);
            }
        }

        try { fs.unlinkSync(LICENSE_FILE); } catch (err) {}
        try { fs.unlinkSync(SYSTEM_LICENSE_BACKUP_FILE); } catch (err) {}
        try {
            const meta = getHiddenMetadata();
            delete meta.savedLicenseData;
            saveHiddenMetadata(meta);
        } catch (e) {}
        try {
            const db = require('../db');
            await db.query('UPDATE store_settings SET license_key_data = NULL WHERE id = 1');
        } catch (e) {}
    }
    activeLicenseStatus = null;
    await touchLastRunTime();
    return { success: true };
};

/**
 * Starts a background periodic validation check for online licenses
 */
function startLicenseScheduler() {
    console.log('[License Scheduler] Starting background licensing scheduler & telemetry stream...');
    
    // Initial validation and public key discovery after 15 seconds
    setTimeout(async () => {
        try {
            await fetchServerPublicKey();
            await sendLicenseHeartbeat();
            await getLicenseStatus(true);
        } catch (e) {
            console.error('[License Scheduler] Initial sync error:', e.message);
        }
    }, 15000);

    // Send heartbeat telemetry every 5 minutes to keep admin dashboard live
    setInterval(async () => {
        await sendLicenseHeartbeat();
    }, 5 * 60 * 1000);

    // Full license re-validation every 30 minutes
    setInterval(async () => {
        try {
            console.log('[License Scheduler] Running background license re-validation...');
            await getLicenseStatus(true); // Force sync
        } catch (e) {
            console.error('[License Scheduler] Periodic re-validation error:', e.message);
        }
    }, 30 * 60 * 1000); 
}

const getRawLicenseKey = () => {
    try {
        const licenseData = decryptLicense(fs.readFileSync(LICENSE_FILE, 'utf8'));
        return licenseData?.key || '';
    } catch (e) {
        return '';
    }
};

module.exports = {
    getHardwareProfile,
    prewarmHardwareProfileAsync,
    getHiddenMetadata,
    touchLastRunTime,
    verifyLicenseKey,
    getLicenseStatus,
    activateLicense,
    getRawLicenseKey,
    deactivateLicense,
    startLicenseScheduler
};

// Start initial offline-only cache warming immediately on boot
setImmediate(() => {
    getLicenseStatus(false).catch(() => {});
});
