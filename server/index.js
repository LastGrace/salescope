// ── BOOT PROFILER ──────────────────────────────────────────────────
const BOOT_START = Date.now();
const _bp = (label) => console.log(`  [BOOT] ${label} @ +${Date.now() - BOOT_START}ms`);

// --- Node 18 Web Crypto Polyfill for Baileys ---
if (!globalThis.crypto) {
    globalThis.crypto = require('crypto').webcrypto;
} else if (!globalThis.crypto.subtle) {
    globalThis.crypto.subtle = require('crypto').webcrypto.subtle;
}
_bp('crypto polyfill');
// -----------------------------------------------

const express = require('express');
_bp('require(express)');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
_bp('require(cors/morgan/compression/path/fs)');
const paths = require('./paths');
_bp('require(paths)');

// Load environment variables from .env in the correct location (DATA_DIR in paths)
const envPath = path.join(paths.DATA_DIR, '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config(); // Fallback to standard CWD search
}
_bp('dotenv loaded');


const db = require('./db');
_bp('require(db) — MySQL pool created');

// ── Eagerly pre-warm a pool connection in background ──
// The TCP handshake + MySQL auth takes ~300-400ms. By firing getConnection()
// immediately (before we even start Express middleware), it runs in parallel
// with the rest of the synchronous boot work, so SELECT 1 is much faster.
db.getConnection().then(conn => { conn.release(); _bp('pool pre-warm connection released'); }).catch(() => {});

// ── Global Error Handlers (crash logging) ─────────────────────────
function logServerCrash(label, err) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = require('path').join(paths.LOG_DIR, `server-crash-${timestamp}.log`);
    const content = `[${label}] ${new Date().toISOString()}\n${err?.stack || err}\n`;
    try { fs.appendFileSync(logFile, content); } catch (e) { /* ignore */ }
    console.error(content);
}
process.on('uncaughtException', (err) => logServerCrash('uncaughtException', err));
process.on('unhandledRejection', (reason) => logServerCrash('unhandledRejection', reason));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('tiny', {
    skip: (req, res) => {
        const url = req.originalUrl || req.url;
        return url.includes('/api/whatsapp/status') || url.includes('/api/whatsapp/qr-data');
    }
}));
_bp('express app + middleware configured');

// Track whether DB initialization has completed
let dbStatus = { ready: false, error: null, hint: null };

// IPC handler for Electron main process messages (WhatsApp start/stop)
process.on('message', async (msg) => {
    if (msg === 'start-whatsapp') {
        console.log('[Server IPC] Received start-whatsapp command');
        try {
            // Defer lazy-loading of heavy whatsapp modules here as well if they are fully decoupled
            const { initWhatsApp } = require('./services/whatsappService');
            await initWhatsApp();
        } catch (e) {
            console.error('[Server IPC] WhatsApp init failed:', e.message);
        }
    } else if (msg === 'stop-whatsapp') {
        console.log('[Server IPC] Received stop-whatsapp command');
        try {
            const { destroyClient } = require('./services/whatsappService');
            await destroyClient();
        } catch (e) {
            console.error('[Server IPC] WhatsApp stop failed:', e.message);
        }
    }
});

// Start listening IMMEDIATELY so health checks don't time out
// DB init runs asynchronously after
const server = app.listen(PORT, () => {
    _bp(`HTTP server listening on port ${PORT}`);
});

// Catch server bind errors (e.g. port already in use)
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[Server] FATAL: Port ${PORT} is already in use! A previous instance may still be running.`);
    } else {
        console.error(`[Server] FATAL server error: ${err.code} - ${err.message}`);
    }
    process.exit(1);
});

(async () => {
    try {
        _bp('async boot sequence started');
        const { CURRENT_SCHEMA_VERSION } = require('./config');
        const fs = require('fs');
        const path = require('path');
        const paths = require('./paths');
        const STAMP_PATH = path.join(paths.DATA_DIR, '.migrate_stamp');

        // ── FAST PATH: check stamp before touching the DB ──────────────────
        // If the stamp matches the current schema version we know:
        //   1. schema_version table already exists
        //   2. All columns are up-to-date (auto-migrate already confirmed this)
        // So we can skip CREATE TABLE schema_version + SELECT version entirely
        // (these two queries cause ~3,000ms of InnoDB cold-start delay on Windows)
        let stampMatchesSchema = false;
        try {
            const stamp = JSON.parse(fs.readFileSync(STAMP_PATH, 'utf8'));
            if (stamp.version === CURRENT_SCHEMA_VERSION) {
                stampMatchesSchema = true;
                _bp(`stamp matches v${CURRENT_SCHEMA_VERSION} — schema_version queries SKIPPED`);
            }
        } catch (_) {
            // Stamp missing or unreadable — will run full schema check below
        }

        // Pre-warm the HWID cache in background asynchronously so it doesn't block boot
        setImmediate(() => {
            try {
                const { prewarmHardwareProfileAsync } = require('./services/licenseService');
                prewarmHardwareProfileAsync().then(() => {
                    console.log('[License] HWID cache pre-warmed.');
                });
            } catch (e) {
                // Non-critical
            }
        });

        // Verify connection FIRST with retry loop
        let connected = false;
        while (!connected) {
            try {
                // First simple query to ensure DB is up
                await db.query('SELECT 1');
                _bp('DB connection verified (SELECT 1)');
                connected = true;
                dbStatus = { ready: false, error: null, hint: null };
            } catch (err) {
                console.error('[DB] Connection failed:', err.message);
                const isConnRefused = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.errno === -4078 || err.errno === -3008;
                const isAccessDenied = err.code === 'ER_ACCESS_DENIED_ERROR';
                const isUnknownDB = err.code === 'ER_BAD_DB_ERROR';

                if (isUnknownDB) {
                    console.log('[DB] Unknown database "retail_shop_db" detected. Attempting automatic creation...');
                    try {
                        const initSchema = require('./init_schema');
                        await initSchema();
                        console.log('[DB] Automatic database creation complete. Retrying connection...');
                        continue;
                    } catch (initErr) {
                        console.error('[DB] Automatic database creation failed:', initErr.message);
                    }
                }

                let hint = 'Unknown database error. Retrying...';
                if (isConnRefused) hint = 'Cannot connect to MySQL. Please start the MySQL Service from Windows Services. Retrying...';
                else if (isAccessDenied) hint = 'MySQL access denied. Check your DB_USER and DB_PASSWORD in the .env file. Retrying...';
                else if (isUnknownDB) hint = 'Database "retail_shop_db" does not exist. Automatically initializing...';

                dbStatus = { ready: false, error: err.message, hint };

                // Wait 100ms before retrying — pool is usually ready within 200ms
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // ── Schema version check ────────────────────────────────────────────
        // Skipped entirely when stamp matches — saves ~3,000ms of InnoDB cold-start
        let versionRows = [];
        if (!stampMatchesSchema) {
            await db.query(`CREATE TABLE IF NOT EXISTS schema_version (version INT NOT NULL)`);
            [versionRows] = await db.query('SELECT version FROM schema_version LIMIT 1');
            _bp('schema_version table checked (DB query)');
        } else {
            // Stamp already verified — treat as if schema_version returned current version
            versionRows = [{ version: CURRENT_SCHEMA_VERSION }];
            _bp('schema_version check SKIPPED (stamp fast-path)');
        }

        if (versionRows.length === 0 || versionRows[0].version < CURRENT_SCHEMA_VERSION) {
            console.log(`[DB] First run or new schema detected. Initializing database (v${CURRENT_SCHEMA_VERSION})...`);
            const initSchema = require('./init_schema');
            const migrationRunner = require('./migration_runner');
            const seed = require('./seed');

            await initSchema();
            _bp('initSchema complete');
            try { await require('./auto-migrate')(); } catch (e) { console.error('[DB] Auto-migrate failed:', e.message); }
            _bp('auto-migrate complete');
            await migrationRunner();
            _bp('migrationRunner complete');
            await seed();
            _bp('seed complete');

            // Save the schema version
            await db.query('DELETE FROM schema_version');
            await db.query('INSERT INTO schema_version (version) VALUES (?)', [CURRENT_SCHEMA_VERSION]);
            console.log('[DB] Initialization complete and version updated.');
        } else {
            _bp('Fast boot: schema already initialized');
            // auto-migrate has its own stamp check — returns instantly if version matches
            try { await require('./auto-migrate')(); } catch (e) { console.error('[DB] Auto-migrate failed during fast boot:', e.message); }
        }

        startBackgroundServices();

    } catch (e) {
        console.error('[DB] Unexpected error during initialization:', e.message);
    }
})();

// Health Check — responds instantly without hitting DB
app.get('/api/health', (req, res) => {
    if (!dbStatus.ready) {
        if (dbStatus.error) {
            return res.status(503).json({ status: 'error', message: dbStatus.error, hint: dbStatus.hint });
        }
        return res.status(503).json({ status: 'initializing', hint: null });
    }
    res.status(200).json({ status: 'ok' });
});

// Root QR Endpoint (for WhatsAppQRCode.jsx)
app.get("/qr", (req, res) => {
    try {
        const { getQr } = require('./services/whatsappService');
        const qr = getQr();
        if (qr) {
            res.json({ qr });
        } else {
            res.status(204).send();
        }
    } catch (e) {
        res.status(204).send(); // Service not loaded yet
    }
});

function startBackgroundServices() {
    _bp('startBackgroundServices() called');

    // 1. Load Licensing routes (Unprotected to allow activation)
    let s = Date.now();
    app.use('/api/license', require('./routes/license'));
    _bp(`license route loaded in ${Date.now() - s}ms`);

    // 2. Enforce Licensing security globally on subsequent API routes
    s = Date.now();
    app.use(require('./middleware/licenseMiddleware'));
    _bp(`licenseMiddleware loaded in ${Date.now() - s}ms`);

    // 3. Start background license validation scheduler
    try {
        const { startLicenseScheduler } = require('./services/licenseService');
        startLicenseScheduler();
    } catch (e) {
        console.error('[License Scheduler] Failed to initialize scheduler:', e.message);
    }

    // ── DEFER HEAVY BACKUP INITIATION ──
    setTimeout(() => {
        try {
            const { initBackupScheduler } = require('./services/backupService');
            initBackupScheduler();
            console.log('[Backup] Scheduler initialized');
        } catch (e) {
            console.error('[Backup] Scheduler failed to start:', e.message);
        }
    }, 5000);

    // ── DEFER WHATSAPP AUTO-INIT SESSION ──
    setTimeout(() => {
        try {
            const { autoInitIfPossible } = require('./services/whatsappService');
            autoInitIfPossible();
        } catch (e) {
            console.error('[WA Boot] Failed to auto-init WhatsApp:', e.message);
        }
    }, 5000);

    // ── Load CRITICAL routes immediately (needed for login screen) ──
    s = Date.now();
    app.use('/api/auth', require('./routes/auth'));
    _bp(`auth route loaded in ${Date.now() - s}ms`);
    s = Date.now();
    app.use('/api/settings', require('./routes/settings'));
    _bp(`settings route loaded in ${Date.now() - s}ms`);

    // ── Mark server READY now — health check passes, window opens ──
    dbStatus.ready = true;
    _bp('dbStatus.ready = true — health check will now pass');

    // ── Lazy-require pattern for non-critical routes ──
    // Routes are registered synchronously HERE (correct position, BEFORE the fallback handler).
    // The actual module require() is deferred to the FIRST request that hits each route.
    // Node.js caches require() so every subsequent request uses the cached module instantly.
    // This saves ~138ms from the critical boot path without breaking Express middleware order.
    const lazyRoute = (label, mod) => {
        let handler = null;
        return (req, res, next) => {
            if (!handler) {
                const s = Date.now();
                handler = require(mod);
                console.log(`  [Route:lazy] ${label} loaded on first request in ${Date.now() - s}ms`);
            }
            handler(req, res, next);
        };
    };

    console.log('[Server] Registering API routes (lazy)...');
    app.use('/api/products',        lazyRoute('products',        './routes/products'));
    app.use('/api/customers',       lazyRoute('customers',       './routes/customers'));
    app.use('/api/sales',           lazyRoute('sales',           './routes/sales'));
    app.use('/api/purchase-orders', lazyRoute('purchase-orders', './routes/purchase_orders'));
    app.use('/api/reports',         lazyRoute('reports',         './routes/reports'));
    app.use('/api/categories',      lazyRoute('categories',      './routes/categories'));
    app.use('/api/loyalty',         lazyRoute('loyalty',         './routes/loyalty'));
    app.use('/api/credit-notes',    lazyRoute('credit-notes',    './routes/credit_notes'));
    app.use('/api/subcategories',   lazyRoute('subcategories',   './routes/subcategories'));
    app.use('/api/coupons',         lazyRoute('coupons',         './routes/coupons'));
    app.use('/api/expenses',        lazyRoute('expenses',        './routes/expenses'));
    app.use('/api/dashboard',       lazyRoute('dashboard',       './routes/dashboard'));
    app.use('/api/employees',       lazyRoute('employees',       './routes/employees'));
    app.use('/api/files',           lazyRoute('files',           './routes/files'));
    app.use('/api/roles',           lazyRoute('roles',           './routes/roles'));
    app.use('/api/debug',           lazyRoute('debug',           './routes/debug'));
    app.use('/api/backup',          lazyRoute('backup',          './routes/backup'));
    app.use('/api/whatsapp',        lazyRoute('whatsapp',        './routes/whatsapp'));
    _bp('all lazy routes registered');

    // Fallback handlers must be attached last, so we attach them here after routes
    app.use((req, res, next) => {
        // If it's an API call that didn't match, don't return HTML
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ message: 'API Route not found' });
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.sendFile(path.join(distPath, 'index.html'), (err) => {
            if (err) {
                // Ignore benign request aborted errors
                if (err.code === 'ECONNABORTED' || err.message === 'Request aborted') {
                    return;
                }
                console.error('Error serving index.html:', err);
                next(err);
            }
        });
    });

    _bp('API routes fully loaded — APP READY');

    // WhatsApp Engine is now started on-demand via the /api/whatsapp/start API route
    // to prevent blocking the Event Loop during application boot.
}

// Serve static files from correct locations (paths module handles dev vs production)
const distPath = paths.CLIENT_DIST;
console.log('[Server] Serving static files from:', distPath);
if (fs.existsSync(path.join(distPath, 'index.html'))) {
    console.log('[Server] INDEX.HTML FOUND at:', path.join(distPath, 'index.html'));
} else {
    console.error('[Server] INDEX.HTML NOT FOUND at:', path.join(distPath, 'index.html'));
}

const staticCacheOpts = { maxAge: '1d', etag: true };
app.use('/downloads', express.static(paths.CLIENT_PUBLIC, staticCacheOpts));
app.use('/uploads', express.static(paths.UPLOADS_DIR, staticCacheOpts));

// Serve index.html with no-cache (it references hashed assets that change on each build)
app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(path.join(distPath, 'index.html'));
});
// Serve hashed static assets with long cache (filenames change on rebuild)
app.use(express.static(distPath, staticCacheOpts));


// Shutdown handling
const gracefulShutdown = async (signal) => {
    console.log(`[Server] Received ${signal}. Shutting down...`);

    // 1. Close WhatsApp Client
    try {
        const { destroyClient } = require('./services/whatsappService');
        await destroyClient();
        console.log('[Server] WhatsApp client destroyed');
    } catch (e) {
        console.error('[Server] Error destroying WA client:', e.message);
    }

    // 2. Close DB Connections
    try {
        await db.end();
        console.log('[Server] DB connections closed');
    } catch (e) {
        console.error('[Server] Error closing DB:', e.message);
    }

    // 3. Stop Server
    server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
    });

    // Forced exit after 5s
    setTimeout(() => {
        console.error('[Server] Could not close connections in time, forceful exit');
        process.exit(1);
    }, 5000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Trigger nodemon restart
