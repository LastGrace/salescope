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

// Removed global static require for heavy module:
// const { initWhatsApp, destroyClient, getStatus, getQr } = require('./services/whatsappService');
// Also removed backupService synchronous require to speed up obfuscated boot time

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
                dbStatus = { ready: false, error: null, hint: null }; // Clear any previous errors
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
                        continue; // Retry connection query immediately
                    } catch (initErr) {
                        console.error('[DB] Automatic database creation failed:', initErr.message);
                    }
                }

                let hint = 'Unknown database error. Retrying in 3 seconds...';
                if (isConnRefused) hint = 'Cannot connect to MySQL. Please start the MySQL Service from Windows Services. Retrying...';
                else if (isAccessDenied) hint = 'MySQL access denied. Check your DB_USER and DB_PASSWORD in the .env file. Retrying...';
                else if (isUnknownDB) hint = 'Database "retail_shop_db" does not exist. Automatically initializing...';

                dbStatus = { ready: false, error: err.message, hint };

                // Wait 500ms before retrying (faster than 1s)
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        await db.query(`CREATE TABLE IF NOT EXISTS schema_version (version INT NOT NULL)`);
        const [versionRows] = await db.query('SELECT version FROM schema_version LIMIT 1');
        _bp('schema_version table checked');

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
        }

        // Mark DB ready FIRST so health checks pass, THEN load routes
        dbStatus.ready = true;
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

    // Load critical routes immediately for Login screen
    s = Date.now();
    app.use('/api/auth', require('./routes/auth'));
    _bp(`auth route loaded in ${Date.now() - s}ms`);
    s = Date.now();
    app.use('/api/settings', require('./routes/settings'));
    _bp(`settings route loaded in ${Date.now() - s}ms`);

    console.log('[Server] Loading standard API routes...');
    const _t = Date.now();
    const _r = (label, path, mod) => {
        const s = Date.now();
        app.use(path, require(mod));
        console.log(`  [Route] ${label} loaded in ${Date.now() - s}ms`);
    };
    _r('products',        '/api/products',         './routes/products');
    _r('customers',       '/api/customers',        './routes/customers');
    _r('sales',           '/api/sales',            './routes/sales');
    _r('purchase-orders', '/api/purchase-orders',  './routes/purchase_orders');
    _r('reports',         '/api/reports',           './routes/reports');
    _r('categories',      '/api/categories',        './routes/categories');
    _r('loyalty',         '/api/loyalty',           './routes/loyalty');
    _r('credit-notes',    '/api/credit-notes',      './routes/credit_notes');
    _r('subcategories',   '/api/subcategories',     './routes/subcategories');
    _r('coupons',         '/api/coupons',           './routes/coupons');
    _r('expenses',        '/api/expenses',          './routes/expenses');
    _r('dashboard',       '/api/dashboard',         './routes/dashboard');
    _r('employees',       '/api/employees',         './routes/employees');
    _r('files',           '/api/files',             './routes/files');
    _r('roles',           '/api/roles',             './routes/roles');
    _r('debug',           '/api/debug',             './routes/debug');
    _r('whatsapp',        '/api/whatsapp',          './routes/whatsapp');
    console.log(`[Server] All routes loaded in ${Date.now() - _t}ms total`);

    // ── DEFERRED HEAVY ROUTES (loaded 15s after boot) ──
    // Export (xlsx) and Backup (archiver/googleapis) are heavy to require.
    // We use Router "slots" registered NOW (before the 404 fallback) so they
    // keep their position in the middleware stack. The real route handlers are
    // mounted into these routers after the timeout.
    const exportRouter = express.Router();
    const backupRouter = express.Router();

    // Temporary 503 guard until the real handlers are loaded
    let exportLoaded = false;
    let backupLoaded = false;

    exportRouter.use((req, res, next) => {
        if (!exportLoaded) return res.status(503).json({ message: 'Export module is loading, please try again in a few seconds.' });
        next();
    });
    backupRouter.use((req, res, next) => {
        if (!backupLoaded) return res.status(503).json({ message: 'Backup module is loading, please try again in a few seconds.' });
        next();
    });

    // Register the routers at the correct position (before the fallback handler)
    app.use('/api/export', exportRouter);
    app.use('/api/backup', backupRouter);

    setTimeout(() => {
        const s = Date.now();
        exportRouter.use('/', require('./routes/export'));
        exportLoaded = true;
        console.log(`  [Deferred] export loaded in ${Date.now() - s}ms`);

        const s2 = Date.now();
        backupRouter.use('/', require('./routes/backup'));
        backupLoaded = true;
        console.log(`  [Deferred] backup loaded in ${Date.now() - s2}ms`);
    }, 15000);

    // Fallback handlers must be attached last, so we attach them here after routes
    app.use((req, res, next) => {
        // If it's an API call that didn't match, don't return HTML
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ message: 'API Route not found' });
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
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
