/**
 * keygen.js — SaleScope RSA-2048 License Key Generator
 *
 * A developer CLI utility to:
 * 1. Generate secure RSA-2048 Private/Public Keypairs
 * 2. Sign client hardware profile IDs and generate offline license keys
 *
 * Usage:
 *   node scripts/keygen.js --action=generate-keys
 *   node scripts/keygen.js --action=sign --board="XYZ" --cpu="ABC" --disk="123" --mac="00:11:22:33:44:55" --expiry="2027-05-24" [--plan="premium"]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Resolve command line arguments
const args = {};
process.argv.slice(2).forEach(val => {
    if (val.startsWith('--')) {
        const parts = val.substring(2).split('=');
        args[parts[0]] = parts[1] || true;
    }
});

const action = args.action;
const privateKeyPath = path.join(__dirname, 'private_key.pem');
const publicKeyPath = path.join(__dirname, 'public_key.pem');

console.log('===================================================');
console.log('SaleScope Developer Security Tools & Keygen');
console.log('===================================================');

if (action === 'generate-keys') {
    console.log('Generating secure RSA-2048 keypair...');
    try {
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });

        fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
        fs.writeFileSync(publicKeyPath, publicKey, 'utf8');

        console.log('\n✓ Keys generated successfully!');
        console.log(`- Private Key saved to: ${privateKeyPath}`);
        console.log(`- Public Key saved to:  ${publicKeyPath}`);
        
        console.log('\nCopy and paste this PUBLIC KEY into server/services/licenseService.js:');
        console.log('---------------------------------------------------');
        console.log(publicKey.trim());
        console.log('---------------------------------------------------');
        console.log('WARNING: Keep the Private Key strictly confidential and secure!');

    } catch (e) {
        console.error('Error generating keypair:', e.message);
    }
} 

else if (action === 'sign') {
    // Collect parameters
    const board = args.board;
    const cpu = args.cpu;
    const disk = args.disk;
    const mac = args.mac;
    const expiry = args.expiry;
    const plan = args.plan || 'premium';

    if (!expiry) {
        console.error('Error: Missing --expiry="YYYY-MM-DD" parameter.');
        process.exit(1);
    }

    if (!fs.existsSync(privateKeyPath)) {
        console.error(`Error: Private key not found at ${privateKeyPath}.`);
        console.error('Please run the key generator first:');
        console.error('  node scripts/keygen.js --action=generate-keys');
        process.exit(1);
    }

    try {
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

        // Form weighted hardware validation profile
        const hwid = {
            motherboard: board ? board.toUpperCase().trim() : 'UNKNOWN_BOARD',
            cpu: cpu ? cpu.toUpperCase().trim() : 'UNKNOWN_CPU',
            disk: disk ? disk.toUpperCase().trim() : 'UNKNOWN_DISK',
            mac: mac ? mac.toUpperCase().trim() : 'UNKNOWN_MAC'
        };

        // Check if parsing from combined string format is needed (copy pasted directly from UI)
        if (args.hwid) {
            // Format: BOARD:X|CPU:Y|DISK:Z|MAC:W
            const parts = args.hwid.split('|');
            parts.forEach(part => {
                const colonIndex = part.indexOf(':');
                if (colonIndex !== -1) {
                    const key = part.substring(0, colonIndex);
                    const value = part.substring(colonIndex + 1);
                    if (key === 'BOARD') hwid.motherboard = value || 'UNKNOWN_BOARD';
                    if (key === 'CPU') hwid.cpu = value || 'UNKNOWN_CPU';
                    if (key === 'DISK') hwid.disk = value || 'UNKNOWN_DISK';
                    if (key === 'MAC') hwid.mac = value || 'UNKNOWN_MAC';
                }
            });
        }

        const data = {
            hwid,
            expiry,
            plan
        };

        console.log('Target Hardware Profile:');
        console.log(`- Motherboard: ${hwid.motherboard}`);
        console.log(`- CPU ID:      ${hwid.cpu}`);
        console.log(`- Volume ID:   ${hwid.disk}`);
        console.log(`- MAC Address: ${hwid.mac}`);
        console.log(`- Plan:        ${plan}`);
        console.log(`- Expiry Date: ${expiry}`);

        // Sign data using RSA Private Key
        const signature = crypto.sign(
            'sha256',
            Buffer.from(JSON.stringify(data)),
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_PADDING
            }
        );

        // Bundle data + signature into a Base64 license key
        const licenseBundle = {
            data,
            signature: signature.toString('base64')
        };

        const licenseKey = Buffer.from(JSON.stringify(licenseBundle)).toString('base64');

        console.log('\n✓ License Key generated successfully!');
        console.log('\n---------------- LICENSE KEY START ----------------');
        console.log(licenseKey);
        console.log('----------------- LICENSE KEY END -----------------\n');
        console.log('Copy this complete key block and paste it inside the activation page box.');

    } catch (e) {
        console.error('Error generating license key:', e.message);
    }
} 

else {
    console.log('Error: Invalid action. Please select a valid action:');
    console.log('  Generate new keys:');
    console.log('    node scripts/keygen.js --action=generate-keys');
    console.log('\n  Sign hardware profile for client:');
    console.log('    node scripts/keygen.js --action=sign --hwid="BOARD:X|CPU:Y|DISK:Z|MAC:W" --expiry="YYYY-MM-DD"');
}
console.log('===================================================');
