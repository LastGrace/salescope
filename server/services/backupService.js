const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const drive = require('./googleDriveService');
const { BACKUP_DIR, CONFIG_FILE: BACKUP_CONFIG_FILE } = require('../paths');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Ensure config file exists
if (!fs.existsSync(BACKUP_CONFIG_FILE)) {
    fs.writeFileSync(BACKUP_CONFIG_FILE, JSON.stringify({
        schedule: '0 0 * * *',
        autoUploadDrive: false
    })); // Default daily at midnight
}

// Helper to find MySQL tools
const findMysqlTool = (toolName) => {
    // 1. Check if an explicit bin path is provided in .env
    if (process.env.MYSQL_BIN_PATH) {
        const envPath = path.join(process.env.MYSQL_BIN_PATH, `${toolName}.exe`);
        if (fs.existsSync(envPath)) return `"${envPath}"`;
    }

    // 2. Prioritize Standalone MySQL over XAMPP to avoid caching_sha2_password errors
    const commonPaths = [
        `C:\\Program Files\\MySQL\\MySQL Server 9.0\\bin\\${toolName}.exe`,
        `C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\${toolName}.exe`,
        `C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\${toolName}.exe`,
        `C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\${toolName}.exe`,
        `C:\\xampp\\mysql\\bin\\${toolName}.exe`,
        `D:\\xampp\\mysql\\bin\\${toolName}.exe`
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            return `"${p}"`;
        }
    }
    return toolName; // Fallback to system PATH
};

const MYSQLDUMP_CMD = findMysqlTool('mysqldump');
const MYSQL_CMD = findMysqlTool('mysql');

const getBackups = () => {
    try {
        const files = fs.readdirSync(BACKUP_DIR).filter(file => file.endsWith('.sql'));
        return files.map(file => {
            const stats = fs.statSync(path.join(BACKUP_DIR, file));
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime
            };
        }).sort((a, b) => b.created - a.created);
    } catch (error) {
        console.error('Error listing backups:', error);
        throw error;
    }
};

const createBackup = () => {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        const passwordPart = 'O*999' ? `-p"O*999"` : '';
        const command = `${MYSQLDUMP_CMD} -h 127.0.0.1 -u root ${passwordPart} retail_shop_db > "${filepath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Backup error: ${error.message}`);
                return reject(error);
            }
            resolve({ filename, filepath });
        });
    });
};

const restoreBackup = async (filename) => {
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
        throw new Error('Backup file not found');
    }

    const passwordPart = 'O*999' ? `-p"O*999"` : '';
    const host = '127.0.0.1';
    const user = 'root';
    const dbName = 'retail_shop_db';

    // Use database connection to drop all tables first
    const db = require('../db');

    try {
        // Disable foreign key checks
        await db.query('SET FOREIGN_KEY_CHECKS = 0');

        // Get all tables
        const [tables] = await db.query('SHOW TABLES');
        const tableKey = `Tables_in_${dbName}`;

        // Drop each table
        for (const table of tables) {
            const tableName = table[tableKey];
            if (tableName) {
                await db.query(`DROP TABLE IF EXISTS \`${tableName}\``);
                console.log(`[Restore] Dropped table: ${tableName}`);
            }
        }

        // Re-enable foreign key checks
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('[Restore] All existing tables dropped');
    } catch (dropError) {
        console.warn('[Restore] Warning dropping tables:', dropError.message);
    }

    // Now restore from backup file using mysql command
    return new Promise((resolve, reject) => {
        const restoreCommand = `${MYSQL_CMD} -h ${host} -u ${user} ${passwordPart} ${dbName} < "${filepath}"`;

        exec(restoreCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Restore] Error: ${error.message}`);
                return reject(error);
            }
            console.log('[Restore] Database restored successfully from:', filename);
            resolve({ message: 'Restore successful' });
        });
    });
};

let scheduledTask = null;

const scheduleBackup = (cronExpression, autoUploadDrive = false) => {
    if (scheduledTask) {
        scheduledTask.stop();
    }

    if (cron.validate(cronExpression)) {
        scheduledTask = cron.schedule(cronExpression, async () => {
            console.log('Running scheduled backup...');
            try {
                const { filename, filepath } = await createBackup();
                console.log('Scheduled backup completed locally:', filename);

                if (autoUploadDrive) {
                    const status = await drive.getStatus();
                    if (status.connected) {
                        console.log('[Backup] Auto-uploading to Google Drive...');
                        await drive.uploadFile(filepath, filename);
                        console.log('[Backup] Auto-upload successful.');
                    } else {
                        console.warn('[Backup] Skipping auto-upload: Drive not connected.');
                    }
                }
            } catch (err) {
                console.error('Scheduled backup failed:', err);
            }
        });

        // Save config
        fs.writeFileSync(BACKUP_CONFIG_FILE, JSON.stringify({
            schedule: cronExpression,
            autoUploadDrive
        }));
        console.log(`Backup scheduled with expression: ${cronExpression} (Auto-upload: ${autoUploadDrive})`);
    } else {
        throw new Error('Invalid cron expression');
    }
};

const getSchedule = () => {
    if (fs.existsSync(BACKUP_CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(BACKUP_CONFIG_FILE));
    }
    return { schedule: '0 0 * * *', autoUploadDrive: false };
};

const initBackupScheduler = () => {
    const config = getSchedule();
    if (config.schedule) {
        scheduleBackup(config.schedule, config.autoUploadDrive);
    }
};

module.exports = {
    getBackups,
    createBackup,
    restoreBackup,
    scheduleBackup,
    getSchedule,
    initBackupScheduler,
    BACKUP_DIR
};
