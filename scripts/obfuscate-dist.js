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

    // 0. Auto-increment version in package.json
    console.log('Checking and incrementing version number...');
    const packageJsonPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = fs.readJsonSync(packageJsonPath);
        const oldVersion = packageJson.version;
        const parts = oldVersion.split('.');
        if (parts.length === 3) {
            parts[2] = (parseInt(parts[2], 10) + 1).toString();
            const newVersion = parts.join('.');
            packageJson.version = newVersion;
            fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 4 });
            console.log(`Version bumped from ${oldVersion} to ${newVersion}`);
        } else {
            console.warn(`Could not parse version: ${oldVersion}. Skipping auto-increment.`);
        }
    } else {
        console.warn('package.json not found. Skipping auto-increment.');
    }

    // 1. Clean previous builds
    console.log('Cleaning old build artifacts...');
    if (fs.existsSync(distObfuscated)) fs.removeSync(distObfuscated);

    // 2. Build Client (Obfuscation is handled by Vite plugin there)
    console.log('Building client...');
    execSync('cmd /c npm run build', { cwd: clientDir, stdio: 'inherit' });

    // 3. Prepare dist-obfuscated for server
    console.log('Preparing obfuscation directory...');
    fs.ensureDirSync(distObfuscated);
    const distServerDir = path.join(distObfuscated, 'server');
    fs.copySync(serverDir, distServerDir, {
        filter: (src) => !src.includes('node_modules') && 
                         !src.includes('backups') && 
                         !src.includes('uploads') &&
                         !src.includes('.baileys_auth') &&
                         !src.includes('logs')
    });

    // 4. Install production dependencies for server
    console.log('Installing production dependencies for server...');
    execSync('cmd /c npm install --omit=dev', { 
        cwd: distServerDir, 
        stdio: 'inherit'
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
    const SKIP_OBFUSCATION = ['index.js', 'paths.js', 'db.js', 'seed.js', 'init_schema.js', 'migration_runner.js', 'whatsappService.js'];


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

    console.log(`Compiling ${filesToObfuscate.length} server files to bytecode...`);

    const filesToCompile = [];
    for (const file of filesToObfuscate) {
        const filename = path.basename(file);
        if (SKIP_OBFUSCATION.includes(filename)) {
            console.log(`  [skip] ${filename}`);
            continue;
        }
        filesToCompile.push(file);
    }

    if (filesToCompile.length > 0) {
        const electronPath = require('electron');
        const compileScriptPath = path.join(distObfuscated, 'temp-compile.js');
        
        const compileCode = `
            const bytenode = require('bytenode');
            const files = ${JSON.stringify(filesToCompile)};
            for (const file of files) {
                const jscFile = file.replace(/\\.js$/, '.jsc');
                console.log('  [bytenode] ' + file);
                try {
                    bytenode.compileFile({
                        filename: file,
                        output: jscFile,
                        compileAsModule: true
                    });
                } catch (e) {
                    console.error('Failed to compile: ' + file, e);
                    process.exit(1);
                }
            }
        `;
        fs.writeFileSync(compileScriptPath, compileCode);
        
        execSync(`"${electronPath}" "${compileScriptPath}"`, { 
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
            stdio: 'inherit'
        });
        
        fs.unlinkSync(compileScriptPath);
        
        for (const file of filesToCompile) {
            const filename = path.basename(file);
            const loaderCode = `require('bytenode');\nmodule.exports = require('./${filename.replace('.js', '.jsc')}');`;
            fs.writeFileSync(file, loaderCode);
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
