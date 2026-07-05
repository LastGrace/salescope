// ── ELECTRON BOOT PROFILER ─────────────────────────────────────────
const EBOOT_START = Date.now();
const _ebp = (label) => console.log(`  [E-BOOT] ${label} @ +${Date.now() - EBOOT_START}ms`);

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const http = require('http');
_ebp('electron requires loaded');

const SERVER_PORT = 3000;

// ── Force Kill Previous Instances ──────────────────────────────────
if (process.platform === 'win32') {
    const { execSync } = require('child_process');
    const exeName = path.basename(process.execPath);
    _ebp(`startup cleanup starting for ${exeName} (PID: ${process.pid})`);
    
    if (app.isPackaged) {
        const safeExec = (cmd) => {
            try { execSync(cmd, { stdio: 'ignore' }); } catch (e) {}
        };
        // In production, aggressively terminate other instances of our app to prevent zombie locks
        safeExec(`taskkill /F /IM "${exeName}" /FI "PID ne ${process.pid}" /T`);
        
        // Clean up any lingering node.exe background processes (the server)
        safeExec(`taskkill /F /IM "node.exe" /FI "PID ne ${process.pid}" /T`);
        
        // Clean up orphaned headless Chrome processes launched by whatsapp-web.js
        safeExec(`wmic process where "name='chrome.exe' and commandline like '%wwebjs_auth%'" call terminate`);
    }
}
_ebp('process cleanup complete');

// ── Single Instance Lock ───────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
_ebp('single instance lock acquired');

if (!gotTheLock) {
    console.log('[Main] Another instance is already running. Quitting.');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// ── Crash Logging ──────────────────────────────────────────────────
// Log all uncaught errors to %APPDATA%/Salescope/logs/ so failures
// on user machines are visible even without a console.
const logDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
_ebp('crash logging initialized');

function logCrash(label, err) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `crash-${timestamp}.log`);
    const content = `[${label}] ${new Date().toISOString()}\n${err?.stack || err}\n`;
    try {
        fs.appendFileSync(logFile, content);
        console.error(content);
    } catch (e) {
        console.error('Failed to write crash log:', e);
    }
}

process.on('uncaughtException', (err) => logCrash('uncaughtException', err));
process.on('unhandledRejection', (reason) => logCrash('unhandledRejection', reason));

// ── Helper: Resolve Resource Path ──────────────────────────────────
function resolveResource(relativePath) {
    // 1. Try process.resourcesPath (Electron Builder unpacked)
    const unpackedPath = path.join(process.resourcesPath, relativePath);
    if (fs.existsSync(unpackedPath)) return unpackedPath;

    // 2. Try __dirname (Electron Packager / ASAR / Dev)
    const bundledPath = path.join(__dirname, relativePath);
    return bundledPath;
}

// ── First-Run File Copy ────────────────────────────────────────────
// Copy schema.sql from the install directory to userData on
// first run, so the server can find them in a writable location.
function copyResourceIfMissing(filename) {
    const dest = path.join(app.getPath('userData'), filename);
    if (fs.existsSync(dest)) return; // Already copied

    const src = resolveResource(filename);

    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`[Main] Copied ${filename} to userData`);
    } else {
        console.warn(`[Main] Resource not found: ${src}`);
    }
}

// ── Window Creation ────────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        frame: false,
        backgroundColor: '#ffffff',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
            spellcheck: false,
            preload: path.join(__dirname, app.isPackaged ? 'preload.obfuscated.js' : 'preload.js'),
            devTools: !app.isPackaged
        },
        autoHideMenuBar: true,
        icon: resolveResource(path.join('client', 'public', 'favicon.png'))
    });

    // Load loading screen first
    mainWindow.loadFile(resolveResource('loading.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
        mainWindow.focus();
    });

    // DevTools in development only
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        // Prevent DevTools from being opened in production
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow.webContents.closeDevTools();
        });
    }

    // Close Confirmation Handler
    let isQuitting = false;
    let closeFailsafeTimeout = null;

    function forceQuitApp() {
        isQuitting = true;
        if (closeFailsafeTimeout) {
            clearTimeout(closeFailsafeTimeout);
            closeFailsafeTimeout = null;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.destroy();
        }

        if (serverProcess) {
            try {
                if (process.platform === 'win32') {
                    require('child_process').execSync(`taskkill /F /T /PID ${serverProcess.pid}`, { stdio: 'ignore' });
                } else {
                    serverProcess.kill();
                }
            } catch(e) {}
            serverProcess = null;
        }

        if (process.platform === 'win32' && app.isPackaged) {
            try {
                const { execSync } = require('child_process');
                const exeName = require('path').basename(process.execPath);
                execSync('taskkill /F /IM "node.exe" /T', { stdio: 'ignore' });
                execSync(`taskkill /F /IM "${exeName}" /FI "PID ne ${process.pid}" /T`, { stdio: 'ignore' });
            } catch(e) {}
        }

        app.exit(0);
    }

    mainWindow.on('close', (e) => {
        if (isQuitting) return;
        e.preventDefault();
        mainWindow.webContents.send('close-app-request');

        if (closeFailsafeTimeout) {
            clearTimeout(closeFailsafeTimeout);
        }

        // Failsafe: if the renderer crashes or doesn't respond in 5 seconds, force quit.
        closeFailsafeTimeout = setTimeout(() => {
            if (!isQuitting) {
                console.log('[Main] Renderer did not respond to close request. Forcing exit.');
                forceQuitApp();
            }
        }, 5000);
    });

    ipcMain.on('close-app-acknowledge', () => {
        console.log('[Main] Renderer acknowledged close request. Clearing failsafe timer.');
        if (closeFailsafeTimeout) {
            clearTimeout(closeFailsafeTimeout);
            closeFailsafeTimeout = null;
        }
    });

    ipcMain.on('quit-app', () => {
        forceQuitApp();
    });

    ipcMain.on('minimize-app', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('maximize-app', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on('close-window', () => {
        if (mainWindow) mainWindow.close();
    });

    ipcMain.on('retry-startup', () => {
        console.log('[Main] Retry requested by user...');
        checkServer();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── Server Launch ──────────────────────────────────────────────────
function startServer() {
    _ebp('startServer() called');

    const serverScript = resolveResource('server/index.js');
    const cwd = path.dirname(serverScript);

    _ebp(`server script resolved: ${serverScript}`);
    console.log(`[Main] userData: ${app.getPath('userData')}`);

    if (!fs.existsSync(serverScript)) {
        logCrash('ServerLaunchFailed', new Error(`Server script not found at ${serverScript}`));
        return;
    }

    const resourcesPath = path.dirname(resolveResource('server'));
    console.log(`[Main] RESOURCES_PATH: ${resourcesPath}`);

    serverProcess = fork(serverScript, [], {
        cwd: cwd,
        env: {
            ...process.env,
            PORT: SERVER_PORT,
            NODE_ENV: app.isPackaged ? 'production' : 'development',
            USER_DATA_PATH: app.getPath('userData'),
            RESOURCES_PATH: resourcesPath
        },
        stdio: 'pipe'
    });
    _ebp('server process forked');

    if (serverProcess.stdout) {
        serverProcess.stdout.on('data', (data) => console.log(`[Server]: ${data}`));
    }
    if (serverProcess.stderr) {
        serverProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            console.error(`[Server Error]: ${msg}`);
            // Write server stderr to crash log for visibility in production
            logCrash('ServerStderr', new Error(msg.substring(0, 2000)));
        });
    }

    serverProcess.on('close', (code) => {
        console.log(`[Main] Server process exited with code ${code}`);
    });

    serverProcess.on('error', (err) => {
        logCrash('ServerProcessError', err);
    });
}

// ── Cleanup Orphaned Processes ─────────────────────────────────────
// Cleans up any leftover process that might be locking port 3000
// before we start the application, but only if the port is actually in use.
async function cleanupOrphanedProcesses() {
    if (process.platform !== 'win32') return;

    return new Promise((resolve) => {
        const net = require('net');
        const client = new net.Socket();

        // Very short timeout (100ms) to check if the port is even open
        client.setTimeout(100);

        client.on('connect', async () => {
            // Someone is listening! We must run cleanup.
            client.destroy();
            _ebp('Port 3000 is occupied — running heavy cleanup');
            await runHeavyCleanup();
            resolve();
        });

        client.on('error', (err) => {
            // Port is free (Connection Refused), skip the 1-2s delay!
            client.destroy();
            _ebp('Port 3000 is clear — skipping heavy cleanup');
            resolve();
        });

        client.on('timeout', () => {
            // Timing out also means we probably can't connect, but try cleanup just in case
            client.destroy();
            resolve();
        });

        client.connect(SERVER_PORT, '127.0.0.1');
    });
}

// The original heavy Windows CLI cleanup logic extracted here
async function runHeavyCleanup() {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
        // Find PID of process listening on port 3000
        const { stdout } = await execAsync(`netstat -ano | findstr :${SERVER_PORT}`);
        const lines = stdout.split('\n');
        const pidsToKill = new Set();

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            // Example line: TCP    0.0.0.0:3000    0.0.0.0:0   LISTENING   1234
            if (parts.length >= 5 && parts[1].endsWith(`:${SERVER_PORT}`) && parts[3] === 'LISTENING') {
                const pid = parts[4];
                // Don't kill system process (PID 0 or 4)
                if (pid && pid !== '0' && pid !== '4') {
                    pidsToKill.add(pid);
                }
            }
        }

        for (const pid of pidsToKill) {
            console.log(`[Main] Killing process holding port ${SERVER_PORT} (PID: ${pid})...`);
            try {
                await execAsync(`taskkill /F /PID ${pid}`);
            } catch (err) { }
        }
    } catch (e) {
        // Silently ignore if no process is found on port 3000
    }

    // Brief cooling period to let OS release handles
    await new Promise(r => setTimeout(r, 500));
}

// ── Health Check ───────────────────────────────────────────────────
function checkServer(attemptCount = 0) {
    // Capture mainWindow at call time to avoid null-ref in async callbacks
    const win = mainWindow;

    if (win && attemptCount % 10 === 0) {
        win.webContents.send('status-update', {
            status: 'checking',
            message: `Starting up...`
        });
    }

    // Force IPv4 using 127.0.0.1 instead of localhost
    const req = http.get(`http://127.0.0.1:${SERVER_PORT}/api/health`, (res) => {
        // Always drain the response body to avoid ECONNRESET
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                _ebp('Server is healthy — opening window');
                if (win) {
                    win.webContents.send('status-update', { status: 'ready', message: 'Finalizing...' });
                    win.loadURL(`http://127.0.0.1:${SERVER_PORT}`);
                    _ebp('loadURL dispatched — UI loading');
                }
                return;
            }

            // Server responded with an error (e.g. MySQL down) or is initializing
            let status = null;
            let hint = null;
            let message = null;
            try {
                const data = JSON.parse(body);
                status = data.status;
                hint = data.hint;
                message = data.message;
            } catch (_) { }

            if (status === 'initializing') {
                // Keep retrying, database is doing work (migrations, seeds)
                if (win && attemptCount % 10 === 0) {
                    win.webContents.send('status-update', {
                        status: 'checking',
                        message: 'Initializing Database... This may take a minute.'
                    });
                }
                setTimeout(() => checkServer(attemptCount + 1), 20);
            } else if (status === 'error') {
                const msg = hint || message || 'Database connection failed. Retrying...';
                if (win && attemptCount % 10 === 0) {
                    console.error(`[Main] Health check status error: ${msg}`);
                    win.webContents.send('status-update', { status: 'checking', message: msg });
                }
                // Keep retrying non-stop
                setTimeout(() => checkServer(attemptCount + 1), 20);
            } else {
                const msg = hint || message || 'Server starting...';
                if (win && attemptCount % 10 === 0) {
                    win.webContents.send('status-update', { status: 'checking', message: msg });
                }
                setTimeout(() => checkServer(attemptCount + 1), 20);
            }
        });
    });

    req.on('error', (err) => {
        if (win && attemptCount % 10 === 0) {
            console.error(`[Main] Server unreachable (attempt ${attemptCount}). Error: ${err.message}`);
            win.webContents.send('status-update', {
                status: 'checking',
                message: `Waiting for local server to start...`
            });
        }
        // Retry indefinitely
        setTimeout(() => checkServer(attemptCount + 1), 20);
    });
}

// ── App Lifecycle ──────────────────────────────────────────────────
app.on('ready', async () => {
    _ebp('app.on(ready) fired');
    // Copy essential files to userData on first run
    copyResourceIfMissing('schema.sql');
    _ebp('schema.sql copy check done');

    createWindow();
    _ebp('createWindow() complete');

    // Ensure we start fresh
    await cleanupOrphanedProcesses();
    _ebp('orphan cleanup complete');

    startServer();
    checkServer();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (serverProcess) {
        console.log('[Main] App quitting, killing server process tree...');
        try {
            if (process.platform === 'win32') {
                require('child_process').execSync(`taskkill /F /T /PID ${serverProcess.pid}`, { stdio: 'ignore' });
            } else {
                serverProcess.kill();
            }
        } catch (e) {}
        serverProcess = null;
    }
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});
