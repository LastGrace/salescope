const fs = require('fs');
const path = require('path');
const { TOKEN_FILE, DRIVE_CONFIG_FILE } = require('../paths');

// OAuth2 Configuration defaults
let CLIENT_ID = '';
let CLIENT_SECRET = '';
let folderName = 'retail_shop_backup';
const REDIRECT_URI = 'http://localhost:3000/api/backup/drive/callback';

// Load config from file if it exists
if (fs.existsSync(DRIVE_CONFIG_FILE)) {
    try {
        const configStr = fs.readFileSync(DRIVE_CONFIG_FILE, 'utf8');
        const config = JSON.parse(configStr);
        if (config.CLIENT_ID) CLIENT_ID = config.CLIENT_ID;
        if (config.CLIENT_SECRET) CLIENT_SECRET = config.CLIENT_SECRET;
        if (config.FOLDER_NAME) folderName = config.FOLDER_NAME;
    } catch (e) {
        console.error('[Drive] Error reading config:', e.message);
    }
}

let google;
let oauth2Client;
let driveClient = null;

let cachedDriveStatus = null;
let lastDriveStatusCheck = 0;

function loadGoogleCore() {
    if (!google) {
        google = require('googleapis').google;
        oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    }
}

/**
 * Configure credentials dynamically
 */
const configure = (clientId, clientSecret) => {
    CLIENT_ID = clientId;
    CLIENT_SECRET = clientSecret;

    // Save to drive-config.json
    try {
        const configStr = JSON.stringify({
            CLIENT_ID,
            CLIENT_SECRET,
            FOLDER_NAME: folderName
        }, null, 2);
        fs.writeFileSync(DRIVE_CONFIG_FILE, configStr);
    } catch (e) {
        console.error('[Drive] Error saving config:', e.message);
    }

    if (google) {
        oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    }
    // Reset drive client to force reconnection with new creds (optional)
    driveClient = null;
};

/**
 * Check if OAuth is configured
 */
const isConfigured = () => {
    return !!(CLIENT_ID && CLIENT_SECRET);
};

/**
 * Load tokens from file
 */
const loadTokens = () => {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            loadGoogleCore();
            const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
            oauth2Client.setCredentials(tokens);
            driveClient = google.drive({ version: 'v3', auth: oauth2Client });
            return true;
        }
    } catch (error) {
        console.error('[Drive] Error loading tokens:', error.message);
    }
    return false;
};

/**
 * Save tokens to file
 */
const saveTokens = (tokens) => {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
};

/**
 * Get OAuth URL for login
 */
const getAuthUrl = () => {
    loadGoogleCore();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/userinfo.email'
        ],
        prompt: 'consent'
    });
};

/**
 * Handle OAuth callback
 */
const handleCallback = async (code) => {
    loadGoogleCore();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    saveTokens(tokens);
    driveClient = google.drive({ version: 'v3', auth: oauth2Client });
    return { success: true };
};

/**
 * Get connection status
 */
const getStatus = async () => {
    if (!isConfigured()) {
        return { connected: false, configured: false, reason: 'Please configure Google Drive Client ID and Secret in settings' };
    }

    if (!fs.existsSync(TOKEN_FILE)) {
        return { connected: false, configured: true };
    }

    const now = Date.now();
    // Cache the status for 60 seconds to prevent blocking UI and Google API rate limits
    if (cachedDriveStatus && (now - lastDriveStatusCheck < 60000)) {
        return cachedDriveStatus;
    }

    try {
        if (!driveClient) loadTokens();
        loadGoogleCore();
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();
        
        cachedDriveStatus = { connected: true, configured: true, email: data.email };
        lastDriveStatusCheck = now;
        return cachedDriveStatus;
    } catch (error) {
        cachedDriveStatus = { connected: false, configured: true, reason: 'Session expired' };
        lastDriveStatusCheck = now;
        return cachedDriveStatus;
    }
};

/**
 * Disconnect
 */
const disconnect = () => {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
    driveClient = null;
};

/**
 * Get or create backup folder
 */
const getBackupFolder = async () => {
    if (!driveClient) loadTokens();

    const folderName = 'Salescope Backups';
    const res = await driveClient.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)'
    });

    if (res.data.files?.length > 0) return res.data.files[0].id;

    const folder = await driveClient.files.create({
        requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id'
    });
    return folder.data.id;
};

/**
 * Upload file to Drive
 */
const uploadFile = async (filePath, fileName) => {
    if (!driveClient) loadTokens();
    if (!driveClient) throw new Error('Not connected to Google Drive');

    const folderId = await getBackupFolder();

    const response = await driveClient.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType: 'application/sql', body: fs.createReadStream(filePath) },
        fields: 'id, name, webViewLink'
    });

    return { fileId: response.data.id, webViewLink: response.data.webViewLink };
};

/**
 * List files in backup folder
 */
const listFiles = async () => {
    if (!driveClient) loadTokens();
    if (!driveClient) return [];

    try {
        const folderId = await getBackupFolder();
        const res = await driveClient.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, size, createdTime, webViewLink)',
            orderBy: 'createdTime desc'
        });
        return res.data.files || [];
    } catch {
        return [];
    }
};

/**
 * Delete file from Drive
 */
const deleteFile = async (fileId) => {
    if (!driveClient) loadTokens();
    await driveClient.files.delete({ fileId });
};

/**
 * Download file from Drive to local backup folder
 */
const downloadFile = async (fileId, fileName, destDir) => {
    if (!driveClient) loadTokens();
    if (!driveClient) throw new Error('Not connected to Google Drive');

    const destPath = path.join(destDir, fileName);
    const dest = fs.createWriteStream(destPath);

    const response = await driveClient.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
        response.data
            .on('error', reject)
            .pipe(dest)
            .on('error', reject)
            .on('finish', () => resolve({ filePath: destPath, fileName }));
    });
};

// Initialize
// Check for tokens without evaluating require graph
// loadTokens is now called only if token file exists
if (fs.existsSync(TOKEN_FILE)) {
    loadTokens();
}

module.exports = { isConfigured, getAuthUrl, handleCallback, getStatus, disconnect, uploadFile, listFiles, deleteFile, downloadFile, configure };
