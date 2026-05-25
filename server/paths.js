/**
 * paths.js — Central path resolution for production & development.
 *
 * WHY: In production (Electron packaged app), all writable data must go to
 * app.getPath('userData') (e.g. %APPDATA%/Salescope), NOT the install directory
 * (which is often read-only under Program Files). In dev, we fall back to the
 * project directory structure.
 *
 * HOW: electron-main.js passes USER_DATA_PATH and RESOURCES_PATH via env vars
 * when forking the server process. This module reads those and exports resolved
 * paths for every file/dir the server needs.
 */

const path = require('path');
const fs = require('fs');

// ── Detect environment ──────────────────────────────────────────────
const IS_PACKAGED = !!process.env.USER_DATA_PATH; // Set by electron-main.js
const SERVER_DIR = __dirname;                     // Always the server folder

// ── Writable data root ──────────────────────────────────────────────
// In production: %APPDATA%/Salescope  (passed by Electron)
// In dev:        <project>/server     (same as before)
const DATA_DIR = IS_PACKAGED
    ? process.env.USER_DATA_PATH
    : SERVER_DIR;

// ── Read-only resources root ────────────────────────────────────────
// In production: process.resourcesPath (inside the installed app)
// In dev:        <project root>
const RESOURCES_DIR = IS_PACKAGED
    ? process.env.RESOURCES_PATH
    : path.join(SERVER_DIR, '..');

// ── Writable directories (all inside DATA_DIR) ─────────────────────
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const WA_AUTH_DIR = path.join(DATA_DIR, '.wwebjs_auth');

// ── Writable files ─────────────────────────────────────────────────
const CONFIG_FILE = path.join(DATA_DIR, 'backup-config.json');
const TOKEN_FILE = path.join(DATA_DIR, 'drive-tokens.json');
const DRIVE_CONFIG_FILE = path.join(DATA_DIR, 'drive-config.json');

// ── Read-only resources ─────────────────────────────────────────────
const SCHEMA_PATH = IS_PACKAGED
    ? path.join(RESOURCES_DIR, 'schema.sql')
    : path.join(SERVER_DIR, '..', 'schema.sql');

const CLIENT_DIST = IS_PACKAGED
    ? path.join(RESOURCES_DIR, 'client', 'dist')
    : path.join(SERVER_DIR, '..', 'client', 'dist');

const CLIENT_PUBLIC = IS_PACKAGED
    ? path.join(RESOURCES_DIR, 'client', 'dist')   // In prod, public assets are in dist
    : path.join(SERVER_DIR, '..', 'client', 'public');

const CHROMIUM_PATH = IS_PACKAGED
    ? path.join(RESOURCES_DIR, 'server', 'chromium', 'chrome.exe')
    : path.join(SERVER_DIR, 'chromium', 'chrome.exe');

const SAMPLE_FILES_DIR = IS_PACKAGED
    ? path.join(RESOURCES_DIR, 'server')
    : SERVER_DIR;

// ── Ensure writable directories exist ───────────────────────────────
[BACKUP_DIR, UPLOADS_DIR, LOG_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// ── Export ───────────────────────────────────────────────────────────
module.exports = {
    IS_PACKAGED,
    SERVER_DIR,
    DATA_DIR,
    RESOURCES_DIR,
    BACKUP_DIR,
    UPLOADS_DIR,
    LOG_DIR,
    WA_AUTH_DIR,
    CONFIG_FILE,
    TOKEN_FILE,
    DRIVE_CONFIG_FILE,
    SCHEMA_PATH,
    CLIENT_DIST,
    CLIENT_PUBLIC,
    CHROMIUM_PATH,
    SAMPLE_FILES_DIR,
};
