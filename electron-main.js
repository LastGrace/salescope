const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const http = require('http');

const SERVER_PORT = 3000;

// ── Force Kill Previous Instances ──────────────────────────────────
if (process.platform === 'win32') {
    const { execSync } = require('child_process');
    const exeName = path.basename(process.execPath);
    console.log(`[Main] Running startup cleanup for ${exeName}. My PID: ${process.pid}`);
    
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

// ── Single Instance Lock ───────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

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

    mainWindow.on('close', (e) => {
        if (isQuitting) return;
        e.preventDefault();
        mainWindow.webContents.send('close-app-request');
    });

    ipcMain.on('quit-app', () => {
        isQuitting = true;
        if (mainWindow) mainWindow.close();
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
    console.log('[Main] Starting internal server...');

    const serverScript = resolveResource('server/index.js');
    const cwd = path.dirname(serverScript);

    console.log(`[Main] Server path: ${serverScript}`);
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
            console.log('[Main] Port 3000 is occupied. Running fresh-start process cleanup...');
            await runHeavyCleanup();
            resolve();
        });

        client.on('error', (err) => {
            // Port is free (Connection Refused), skip the 1-2s delay!
            client.destroy();
            console.log('[Main] Port 3000 is clear. Skipping heavy cleanup.');
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
                console.log(`[Main] Server is healthy. Opening window...`);
                if (win) {
                    win.webContents.send('status-update', { status: 'ready', message: 'Finalizing...' });
                    win.loadURL(`http://127.0.0.1:${SERVER_PORT}`);
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
                setTimeout(() => checkServer(attemptCount + 1), 100);
            } else if (status === 'error') {
                const msg = hint || message || 'Database connection failed. Retrying...';
                if (win && attemptCount % 10 === 0) {
                    console.error(`[Main] Health check status error: ${msg}`);
                    win.webContents.send('status-update', { status: 'checking', message: msg });
                }
                // Keep retrying non-stop
                setTimeout(() => checkServer(attemptCount + 1), 100);
            } else {
                const msg = hint || message || 'Server starting...';
                if (win && attemptCount % 10 === 0) {
                    win.webContents.send('status-update', { status: 'checking', message: msg });
                }
                setTimeout(() => checkServer(attemptCount + 1), 100);
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
        setTimeout(() => checkServer(attemptCount + 1), 100);
    });
}

// ── App Lifecycle ──────────────────────────────────────────────────
app.on('ready', async () => {
    // Copy essential files to userData on first run
    copyResourceIfMissing('schema.sql');

    createWindow();

    // Ensure we start fresh
    await cleanupOrphanedProcesses();

    startServer();
    checkServer();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (serverProcess) {
        console.log('[Main] App quitting, killing server process tree...');

        if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            console.log('[Main] Running aggressive Windows cleanup...');

            try {
                // Kill the specific child server process first
                console.log(`[Main] Killing child server process ${serverProcess.pid}`);
                require('child_process').exec(`taskkill /F /T /PID ${serverProcess.pid}`);
            } catch (e) { }

            if (app.isPackaged) {
                const safeExec = (cmd) => {
                    try { execSync(cmd, { stdio: 'ignore' }); } catch (e) {}
                };
                // System-wide cleanup as explicitly requested by user for the standalone packaged app
                console.log('[Main] Executing global taskkill for Salescope.exe and node.exe');
                safeExec('taskkill /F /IM "node.exe" /T');
                safeExec(`taskkill /F /IM "Salescope.exe" /FI "PID ne ${process.pid}" /T`);
            }
        } else {
            serverProcess.kill();
        }
        serverProcess = null;
    }
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});
