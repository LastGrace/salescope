const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

async function obfuscate() {
    console.log('--- Starting Production Build & Obfuscation ---');

    const rootDir = path.join(__dirname, '..');
    const distObfuscated = path.join(rootDir, 'dist-obfuscated');
    const clientDir = path.join(rootDir, 'client');
    const serverDir = path.join(rootDir, 'server');

    // 1. Clean previous builds
    console.log('Cleaning old build artifacts...');
    if (fs.existsSync(distObfuscated)) fs.removeSync(distObfuscated);

    // 2. Build Client (Obfuscation is handled by Vite plugin there)
    console.log('Building client...');
    execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });

    // 3. Prepare dist-obfuscated for server
    console.log('Preparing obfuscation directory...');
    fs.ensureDirSync(distObfuscated);
    const distServerDir = path.join(distObfuscated, 'server');
    fs.copySync(serverDir, distServerDir, {
        filter: (src) => !src.includes('node_modules') && 
                         !src.includes('backups') && 
                         !src.includes('uploads') &&
                         !src.includes('.wwebjs_auth') &&
                         !src.includes('logs')
    });

    // 4. Install production dependencies for server (skip downloading standard Chromium as we bundle a portable version)
    console.log('Installing production dependencies for server...');
    execSync('npm install --omit=dev', { 
        cwd: distServerDir, 
        stdio: 'inherit',
        env: {
            ...process.env,
            PUPPETEER_SKIP_DOWNLOAD: 'true'
        }
    });

    const obfuscateOptions = {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: false,
        renameGlobals: false,
        selfDefending: false,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 10,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayCallsTransformThreshold: 0.5,
        stringArrayEncoding: ['base64'],
        stringArrayIndexesType: ['hexadecimal-number'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 1,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 2,
        stringArrayWrappersType: 'function',
        stringArrayThreshold: 0.5,
        transformObjectKeys: false,
        unicodeEscapeSequence: false
    };

    // Critical boot files — skip obfuscation to prevent anti-debug crashes and 10s+ startup blocks
    const SKIP_OBFUSCATION = ['index.js', 'paths.js', 'db.js', 'seed.js', 'init_schema.js', 'migration_runner.js'];


    const filesToObfuscate = [];

    function walkDir(dir) {
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.lstatSync(fullPath).isDirectory()) {
                if (file !== 'node_modules') {
                    walkDir(fullPath);
                }
            } else if (file.endsWith('.js')) {
                filesToObfuscate.push(fullPath);
            }
        });
    }

    walkDir(distObfuscated);

    console.log(`Obfuscating ${filesToObfuscate.length} server files...`);

    for (const file of filesToObfuscate) {
        const filename = path.basename(file);
        if (SKIP_OBFUSCATION.includes(filename)) {
            console.log(`  [skip] ${filename}`);
            continue; // Leave as-is — no obfuscation for critical boot files
        }
        console.log(`  [obfuscate] ${file}`);
        try {
            const code = fs.readFileSync(file, 'utf8');
            const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, obfuscateOptions).getObfuscatedCode();
            fs.writeFileSync(file, obfuscatedCode);
        } catch (fileErr) {
            console.error(`  [FAILED] ${file}: ${fileErr.message}`);
            throw fileErr;
        }
    }

    // Obfuscate main and preload into root with .obfuscated extension
    console.log('Obfuscating main process and preload...');
    const mainCode = fs.readFileSync(path.join(rootDir, 'electron-main.js'), 'utf8');
    const mainObfuscated = JavaScriptObfuscator.obfuscate(mainCode, obfuscateOptions).getObfuscatedCode();
    fs.writeFileSync(path.join(rootDir, 'electron-main.obfuscated.js'), mainObfuscated);

    const preloadCode = fs.readFileSync(path.join(rootDir, 'preload.js'), 'utf8');
    const preloadObfuscated = JavaScriptObfuscator.obfuscate(preloadCode, obfuscateOptions).getObfuscatedCode();
    fs.writeFileSync(path.join(rootDir, 'preload.obfuscated.js'), preloadObfuscated);

    console.log('--- Obfuscation Complete ---');
}

obfuscate().catch(err => {
    console.error('Obfuscation failed:', err);
    process.exit(1);
});
