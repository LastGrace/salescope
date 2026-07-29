module.exports = async function (connection) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS messaging_settings (
            id INT NOT NULL DEFAULT 1 PRIMARY KEY,
            baileys_enabled BOOLEAN DEFAULT TRUE,
            whatshub_enabled BOOLEAN DEFAULT FALSE,
            default_provider ENUM('baileys', 'whatshub') DEFAULT 'baileys',
            whatshub_api_key VARCHAR(255),
            override_invoices VARCHAR(50),
            override_bills VARCHAR(50),
            override_bulk VARCHAR(50),
            override_marketing VARCHAR(50),
            override_sync VARCHAR(50),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT messaging_single_row CHECK (id = 1)
        )
    `);
    
    // Insert default row
    await connection.query(`INSERT IGNORE INTO messaging_settings (id) VALUES (1)`);
};
