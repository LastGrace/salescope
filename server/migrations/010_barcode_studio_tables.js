const db = require('../db');

module.exports = async function (connection) {
    const conn = connection || await db.getConnection();
    const shouldRelease = !connection;

    try {
        console.log('[Migration 010] Creating barcode_presets and printer_profiles tables...');

        // 1. Create barcode_presets table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS barcode_presets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) DEFAULT 'Product Barcode',
                is_default TINYINT(1) DEFAULT 0,
                is_favorite TINYINT(1) DEFAULT 0,
                label_width DECIMAL(6,2) NOT NULL DEFAULT 50.00,
                label_height DECIMAL(6,2) NOT NULL DEFAULT 25.00,
                paper_type VARCHAR(50) DEFAULT 'thermal',
                page_layout JSON,
                canvas_data JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Create printer_profiles table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS printer_profiles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                printer_type VARCHAR(50) DEFAULT 'thermal',
                dpi INT DEFAULT 203,
                print_mode VARCHAR(50) DEFAULT 'gap',
                darkness INT DEFAULT 10,
                speed INT DEFAULT 3,
                offset_x DECIMAL(5,2) DEFAULT 0.00,
                offset_y DECIMAL(5,2) DEFAULT 0.00,
                feed_direction VARCHAR(50) DEFAULT 'normal',
                page_size VARCHAR(50) DEFAULT 'Custom',
                is_default TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 3. Seed default presets if empty
        const [existingPresets] = await conn.query('SELECT COUNT(*) as count FROM barcode_presets');
        if (existingPresets[0].count === 0) {
            const defaultPresets = [
                {
                    name: 'Product Barcode (Standard)',
                    category: 'Product Barcode',
                    is_default: 1,
                    is_favorite: 1,
                    label_width: 50.00,
                    label_height: 25.00,
                    paper_type: 'thermal',
                    page_layout: JSON.stringify({ rows: 1, cols: 1, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 }),
                    canvas_data: JSON.stringify([
                        { id: '1', type: 'text', text: '{{shop_name}}', x: 2, y: 1.5, width: 46, height: 4.5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
                        { id: '2', type: 'text', text: '{{product_name}}', x: 2, y: 6.2, width: 46, height: 4, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
                        { id: '3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 5, y: 10.5, width: 40, height: 9.5, showText: true, fontSize: 8, visibility: 'always' },
                        { id: '4', type: 'text', text: 'MRP: ₹{{mrp}}', x: 2, y: 20.5, width: 46, height: 3.8, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' }
                    ])
                },
                {
                    name: 'Jewellery Label (Tail Tag)',
                    category: 'Jewellery Label',
                    is_default: 0,
                    is_favorite: 1,
                    label_width: 60.00,
                    label_height: 15.00,
                    paper_type: 'thermal',
                    page_layout: JSON.stringify({ rows: 1, cols: 1, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 }),
                    canvas_data: JSON.stringify([
                        { id: '1', type: 'text', text: '{{product_name}}', x: 1, y: 1, width: 28, height: 3.5, fontSize: 8, fontWeight: 'bold', align: 'left', color: '#000000', visibility: 'always' },
                        { id: '2', type: 'text', text: 'W: {{weight}}g', x: 1, y: 5, width: 28, height: 3, fontSize: 7, fontWeight: 'normal', align: 'left', color: '#000000', visibility: 'hide_if_empty' },
                        { id: '3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 31, y: 1, width: 28, height: 9, showText: true, fontSize: 7, visibility: 'always' },
                        { id: '4', type: 'text', text: '₹{{selling_price}}', x: 1, y: 9, width: 28, height: 4, fontSize: 9, fontWeight: 'bold', align: 'left', color: '#000000', visibility: 'always' }
                    ])
                },
                {
                    name: 'Price Tag (Shelf / Apparel)',
                    category: 'Price Tag',
                    is_default: 0,
                    is_favorite: 0,
                    label_width: 38.00,
                    label_height: 25.00,
                    paper_type: 'thermal',
                    page_layout: JSON.stringify({ rows: 1, cols: 2, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 3, gapV: 0 }),
                    canvas_data: JSON.stringify([
                        { id: '1', type: 'text', text: '{{brand}}', x: 1, y: 1, width: 36, height: 3.5, fontSize: 8, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'hide_if_empty' },
                        { id: '2', type: 'text', text: '{{product_name}}', x: 1, y: 5, width: 36, height: 3.5, fontSize: 8, fontWeight: 'normal', align: 'center', color: '#000000', visibility: 'always' },
                        { id: '3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 3, y: 9, width: 32, height: 9, showText: true, fontSize: 7, visibility: 'always' },
                        { id: '4', type: 'text', text: 'PRICE: ₹{{selling_price}}', x: 1, y: 19, width: 36, height: 4.5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' }
                    ])
                },
                {
                    name: 'QR Code Label',
                    category: 'QR Label',
                    is_default: 0,
                    is_favorite: 0,
                    label_width: 40.00,
                    label_height: 40.00,
                    paper_type: 'thermal',
                    page_layout: JSON.stringify({ rows: 1, cols: 1, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 }),
                    canvas_data: JSON.stringify([
                        { id: '1', type: 'text', text: '{{product_name}}', x: 2, y: 2, width: 36, height: 4, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
                        { id: '2', type: 'qrcode', text: '{{barcode}}', x: 10, y: 7, width: 20, height: 20, visibility: 'always' },
                        { id: '3', type: 'text', text: 'SKU: {{sku}}', x: 2, y: 28, width: 36, height: 3.5, fontSize: 8, fontWeight: 'normal', align: 'center', color: '#000000', visibility: 'always' },
                        { id: '4', type: 'text', text: '₹{{selling_price}}', x: 2, y: 32.5, width: 36, height: 5, fontSize: 11, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' }
                    ])
                },
                {
                    name: 'A4 Sticker Sheet (3x8 - 24 Labels)',
                    category: 'Shelf Label',
                    is_default: 0,
                    is_favorite: 0,
                    label_width: 63.50,
                    label_height: 33.90,
                    paper_type: 'sheet',
                    page_layout: JSON.stringify({ rows: 8, cols: 3, marginTop: 12, marginBottom: 12, marginLeft: 7, marginRight: 7, gapH: 2.5, gapV: 0 }),
                    canvas_data: JSON.stringify([
                        { id: '1', type: 'text', text: '{{shop_name}}', x: 2, y: 2, width: 59.5, height: 4, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
                        { id: '2', type: 'text', text: '{{product_name}}', x: 2, y: 6.5, width: 59.5, height: 4, fontSize: 9, fontWeight: 'normal', align: 'center', color: '#000000', visibility: 'always' },
                        { id: '3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 8, y: 11, width: 47.5, height: 13, showText: true, fontSize: 8, visibility: 'always' },
                        { id: '4', type: 'text', text: 'MRP: ₹{{mrp}} | OUR PRICE: ₹{{selling_price}}', x: 2, y: 25.5, width: 59.5, height: 4.5, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' }
                    ])
                }
            ];

            for (const p of defaultPresets) {
                await conn.query(`
                    INSERT INTO barcode_presets 
                    (name, category, is_default, is_favorite, label_width, label_height, paper_type, page_layout, canvas_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [p.name, p.category, p.is_default, p.is_favorite, p.label_width, p.label_height, p.paper_type, p.page_layout, p.canvas_data]);
            }
            console.log('[Migration 010] Seeded default barcode presets.');
        }

        // 4. Seed default printer profiles if empty
        const [existingPrinters] = await conn.query('SELECT COUNT(*) as count FROM printer_profiles');
        if (existingPrinters[0].count === 0) {
            const defaultPrinters = [
                { name: 'Generic Thermal Printer (203 DPI)', printer_type: 'thermal', dpi: 203, print_mode: 'gap', darkness: 10, speed: 3, offset_x: 0, offset_y: 0, feed_direction: 'normal', page_size: 'Custom', is_default: 1 },
                { name: 'TSC TE244 / TE200 (203 DPI)', printer_type: 'thermal', dpi: 203, print_mode: 'gap', darkness: 12, speed: 4, offset_x: 0, offset_y: 0, feed_direction: 'normal', page_size: 'Custom', is_default: 0 },
                { name: 'Zebra ZD220 / ZD420 (203 DPI)', printer_type: 'thermal', dpi: 203, print_mode: 'gap', darkness: 10, speed: 4, offset_x: 0, offset_y: 0, feed_direction: 'normal', page_size: 'Custom', is_default: 0 },
                { name: 'Xprinter / TVS Electronics (203 DPI)', printer_type: 'thermal', dpi: 203, print_mode: 'gap', darkness: 10, speed: 3, offset_x: 0, offset_y: 0, feed_direction: 'normal', page_size: 'Custom', is_default: 0 },
                { name: 'Standard Office Printer (A4 Sheet)', printer_type: 'office', dpi: 300, print_mode: 'continuous', darkness: 0, speed: 0, offset_x: 0, offset_y: 0, feed_direction: 'normal', page_size: 'A4', is_default: 0 }
            ];

            for (const pr of defaultPrinters) {
                await conn.query(`
                    INSERT INTO printer_profiles
                    (name, printer_type, dpi, print_mode, darkness, speed, offset_x, offset_y, feed_direction, page_size, is_default)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [pr.name, pr.printer_type, pr.dpi, pr.print_mode, pr.darkness, pr.speed, pr.offset_x, pr.offset_y, pr.feed_direction, pr.page_size, pr.is_default]);
            }
            console.log('[Migration 010] Seeded default printer profiles.');
        }

        console.log('[Migration 010] Done.');
    } catch (err) {
        console.error('[Migration 010] Failed:', err.message);
        throw err;
    } finally {
        if (shouldRelease && conn) conn.release();
    }
};
