const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');
const contactSyncService = require('../services/contactSyncService');
const whatshubProvider = require('../services/whatshubProvider');

// ─────────────────────────────────────────────────────────────────────────────
// Shared Phone Normalization Utility (mirrors client/src/utils/phoneUtils.js)
// Rules:
//   +91XXXXXXXXXX  → valid as-is
//   91XXXXXXXXXX   → add + prefix → +91XXXXXXXXXX
//   XXXXXXXXXX     → add +91 prefix → +91XXXXXXXXXX
//   Anything else  → { error: '<reason>' }
// ─────────────────────────────────────────────────────────────────────────────
function normalizePhone(raw) {
    if (!raw || String(raw).trim() === '') {
        return { error: 'Phone number is required.' };
    }

    const trimmed = String(raw).trim();

    // Already correctly formatted: +91 + exactly 10 digits
    if (/^\+91\d{10}$/.test(trimmed)) {
        return { phone: trimmed };
    }

    // Strip all non-digit characters for analysis
    const digits = trimmed.replace(/\D/g, '');

    if (digits.length === 0) {
        return { error: 'Phone number is required.' };
    }

    if (digits.length < 10) {
        return { error: `Phone number too short — enter a 10-digit number (got ${digits.length} digit${digits.length === 1 ? '' : 's'}).` };
    }

    // Exactly 10 digits → prepend +91
    if (digits.length === 10) {
        return { phone: '+91' + digits };
    }

    if (digits.length === 11) {
        return { error: 'Invalid phone — 11-digit numbers are not accepted. Please enter a 10-digit number.' };
    }

    // Exactly 12 digits starting with 91 → prepend +
    if (digits.length === 12) {
        if (digits.startsWith('91')) {
            return { phone: '+' + digits };
        }
        return { error: `12-digit number must start with 91 (India country code), but got "${digits.slice(0, 2)}". Enter a 10-digit number.` };
    }

    // Too long
    return { error: `Phone number too long — enter a 10-digit number (got ${digits.length} digits).` };
}

// Get all customers (with credit notes aggregation and dynamic pending credit)
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.*, 
                   COALESCE((SELECT SUM(cn.balance) FROM credit_notes cn WHERE cn.customer_id = c.id AND cn.balance > 0), 0) as total_credit_note_balance,
                   COALESCE((
                       SELECT SUM(
                           CASE 
                               WHEN s.payment_method = 'pay_later' THEN s.total_amount
                               ELSE (SELECT amount FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.payment_method = 'pay_later' LIMIT 1)
                           END
                       )
                       FROM sales s 
                       WHERE s.customer_id = c.id 
                         AND (s.payment_method = 'pay_later' 
                              OR EXISTS (SELECT 1 FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.payment_method = 'pay_later'))
                   ), 0) as credit_balance
            FROM customers c
            ORDER BY c.id DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /invalid-numbers — Hidden diagnostic: list customers with invalid phones
// ─────────────────────────────────────────────────────────────────────────────
router.get('/invalid-numbers', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name, phone, email, created_at FROM customers ORDER BY id ASC');

        res.json({
            success: true,
            total_customers: rows.length,
            customers: rows
        });
    } catch (err) {
        console.error('[Diagnostic Router Error]:', err);
        res.status(500).json({ message: 'Failed to initialize audit list', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /check-whatsapp-batch — Check a batch of phone numbers via Baileys
// ─────────────────────────────────────────────────────────────────────────────
router.post('/check-whatsapp-batch', verifyToken, async (req, res) => {
    try {
        const waService = require('../services/whatsappService');
        const status = waService.getStatus();
        if (status !== 'connected') {
            return res.status(400).json({ 
                success: false, 
                error_type: 'whatsapp_disconnected',
                message: 'WhatsApp client is not connected.' 
            });
        }

        const { customers } = req.body;
        if (!customers || !Array.isArray(customers)) {
            return res.status(400).json({ message: 'Customers array is required' });
        }

        const results = [];

        // Check each customer in the batch sequentially to maintain socket stability
        for (const c of customers) {
            if (!c.phone || c.phone.trim() === '') {
                results.push({
                    id: c.id,
                    name: c.name,
                    stored_phone: '(empty)',
                    email: c.email || '',
                    created_at: c.created_at,
                    isRegistered: false,
                    error: 'Phone number is missing'
                });
                continue;
            }

            let isRegistered = false;
            let success = false;
            let retries = 3;
            let lastError = null;

            while (retries > 0 && !success) {
                try {
                    const currentStatus = waService.getStatus();
                    if (currentStatus !== 'connected') {
                        throw new Error('WhatsApp client disconnected during check');
                    }
                    isRegistered = await waService.isOnWhatsApp(c.phone);
                    success = true;
                } catch (err) {
                    lastError = err;
                    retries--;
                    console.warn(`[WA Retry] Retrying check for ${c.phone} in 1s. Retries remaining: ${retries}. Error: ${err.message}`);
                    if (retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            if (success) {
                results.push({
                    id: c.id,
                    name: c.name,
                    stored_phone: c.phone,
                    email: c.email || '',
                    created_at: c.created_at,
                    isRegistered,
                    error: isRegistered ? null : 'Not registered on WhatsApp'
                });
                // 100ms polite pause to avoid overloading the Baileys websocket
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                // Graceful failure - do not break the whole batch
                results.push({
                    id: c.id,
                    name: c.name,
                    stored_phone: c.phone,
                    email: c.email || '',
                    created_at: c.created_at,
                    isRegistered: false,
                    error: `Verification Failed: ${lastError ? lastError.message : 'Unknown error'}`
                });
            }
        }

        res.json({ success: true, results });
    } catch (err) {
        console.error('[Batch check error]:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /check-single-whatsapp — Check if a single phone number is registered on WA
// ─────────────────────────────────────────────────────────────────────────────
router.post('/check-single-whatsapp', verifyToken, async (req, res) => {
    try {
        const waService = require('../services/whatsappService');
        const status = waService.getStatus();
        if (status !== 'connected') {
            return res.status(400).json({ 
                success: false, 
                error_type: 'whatsapp_disconnected',
                message: 'WhatsApp client is not connected.' 
            });
        }

        const { phone } = req.body;
        if (!phone || phone.trim() === '') {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        let isRegistered = false;
        let success = false;
        let retries = 3;
        let lastError = null;

        while (retries > 0 && !success) {
            try {
                const currentStatus = waService.getStatus();
                if (currentStatus !== 'connected') {
                    throw new Error('WhatsApp client disconnected during check');
                }
                isRegistered = await waService.isOnWhatsApp(phone);
                success = true;
            } catch (err) {
                lastError = err;
                retries--;
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        if (success) {
            res.json({ success: true, phone, isRegistered });
        } else {
            res.status(500).json({ message: `Single check failed after 3 attempts. Last error: ${lastError.message}` });
        }
    } catch (err) {
        console.error('[Single check error]:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /normalize-all — Bulk normalize all existing phone numbers in database
// ─────────────────────────────────────────────────────────────────────────────
router.post('/normalize-all', verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [customers] = await connection.query('SELECT id, phone FROM customers');
        let updatedCount = 0;
        let skippedCount = 0;

        for (const c of customers) {
            if (!c.phone || c.phone.trim() === '') {
                skippedCount++;
                continue;
            }

            const result = normalizePhone(c.phone);
            if (!result.error && result.phone && result.phone !== c.phone) {
                // Check if the new phone number already exists to avoid Unique Constraint violation
                const [existing] = await connection.query('SELECT id FROM customers WHERE phone = ? AND id != ?', [result.phone, c.id]);
                
                if (existing.length === 0) {
                    await connection.query('UPDATE customers SET phone = ? WHERE id = ?', [result.phone, c.id]);
                    updatedCount++;
                } else {
                    // Cannot update, another customer has this phone number
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }
        }

        await connection.commit();
        res.json({ 
            message: `Successfully normalized ${updatedCount} contacts. Skipped ${skippedCount} contacts.`,
            updated: updatedCount,
            skipped: skippedCount
        });
    } catch (err) {
        await connection.rollback();
        console.error('Normalization error:', err);
        res.status(500).json({ message: 'Failed to normalize contacts', error: err.message });
    } finally {
        connection.release();
    }
});

// Create customer
router.post('/', verifyToken, async (req, res) => {
    const { name, email } = req.body;
    const rawPhone = req.body.phone;

    // Server-side phone normalization (defense in depth)
    const phoneResult = normalizePhone(rawPhone);
    if (phoneResult.error) {
        return res.status(400).json({ message: phoneResult.error });
    }
    const phone = phoneResult.phone;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Check if phone already exists
        const [existing] = await connection.query('SELECT id FROM customers WHERE phone = ? LIMIT 1', [phone]);
        if (existing.length > 0) {
            await connection.rollback();
            connection.release();
            return res.status(409).json({ message: 'A customer with this phone number already exists.' });
        }

        const [result] = await connection.query(
            'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
            [name, phone, email]
        );

        // Auto-issue loyalty card if phone exists
        try {
            await connection.query(
                'INSERT INTO loyalty_cards (customer_id, card_number) VALUES (?, ?)',
                [result.insertId, phone]
            );
        } catch (cardErr) {
            // Ignore duplicate card errors (rare but safely ignored)
            console.warn('Auto-issue card failed (might exist):', cardErr.message);
        }

        contactSyncService.syncContact({ name, phone, email }).catch(console.error);

        await connection.commit();
        res.status(201).json({ id: result.insertId, name, phone, email });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// Batch Import Customers
router.post('/batch', verifyToken, async (req, res) => {
    const customers = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
        return res.status(400).json({ message: 'Invalid data format' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        let importedCount = 0;
        let skippedCount = 0;
        const skippedDetails = [];

        for (const c of customers) {
            // Validate name
            if (!c.name || !String(c.name).trim()) {
                skippedCount++;
                skippedDetails.push({ phone: c.phone, reason: 'Name is required' });
                continue;
            }

            // Server-side phone normalization for each row
            const phoneResult = normalizePhone(c.phone);
            if (phoneResult.error) {
                skippedCount++;
                skippedDetails.push({ name: c.name, phone: c.phone, reason: phoneResult.error });
                continue;
            }

            const normalizedPhone = phoneResult.phone;

            // Check if phone exists
            const [existing] = await connection.query('SELECT id FROM customers WHERE phone = ? LIMIT 1', [normalizedPhone]);
            if (existing.length > 0) {
                skippedCount++;
                skippedDetails.push({ name: c.name, phone: normalizedPhone, reason: 'Phone number already exists' });
                continue;
            }

            // Insert new
            await connection.query(
                'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
                [String(c.name).trim(), normalizedPhone, c.email || null]
            );

            contactSyncService.syncContact({ name: c.name, phone: normalizedPhone, email: c.email }).catch(console.error);
            importedCount++;
        }

        await connection.commit();
        res.json({
            message: `Imported ${importedCount} customers. Skipped ${skippedCount} (duplicates or invalid phones).`,
            imported: importedCount,
            skipped: skippedCount,
            skipped_details: skippedDetails
        });
    } catch (err) {
        await connection.rollback();
        console.error('Batch import error:', err);
        res.status(500).json({ message: 'Batch import failed', error: err.message });
    } finally {
        connection.release();
    }
});

// Update customer
router.put('/:id', verifyToken, async (req, res) => {
    const { name, email, loyalty_points } = req.body;
    const rawPhone = req.body.phone;

    // Server-side phone normalization
    const phoneResult = normalizePhone(rawPhone);
    if (phoneResult.error) {
        return res.status(400).json({ message: phoneResult.error });
    }
    const phone = phoneResult.phone;

    try {
        // Check uniqueness for update (exclude current ID)
        const [existing] = await db.query('SELECT id FROM customers WHERE phone = ? AND id != ? LIMIT 1', [phone, req.params.id]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Phone number already assigned to another customer.' });
        }

        // Build dynamic update
        let updateQuery = 'UPDATE customers SET name=?, phone=?, email=?';
        const params = [name, phone, email];

        if (loyalty_points !== undefined && loyalty_points !== null && loyalty_points !== '') {
            updateQuery += ', loyalty_points=?';
            params.push(parseInt(loyalty_points) || 0);
        }

        updateQuery += ' WHERE id=?';
        params.push(req.params.id);

        await db.query(updateQuery, params);

        contactSyncService.syncContact({ name, phone, email }).catch(console.error);

        res.json({ message: 'Customer updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete customer
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        // Check for dependencies (Sales, Credit Notes)
        const [sales] = await db.query('SELECT 1 FROM sales WHERE customer_id = ? LIMIT 1', [req.params.id]);
        if (sales.length > 0) {
            return res.status(400).json({ message: 'Cannot delete customer with existing sales history.' });
        }

        const [credits] = await db.query('SELECT 1 FROM credit_notes WHERE customer_id = ? LIMIT 1', [req.params.id]);
        if (credits.length > 0) {
            return res.status(400).json({ message: 'Cannot delete customer with active credit notes.' });
        }

        await db.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Bulk Delete Customers
router.post('/bulk-delete', verifyToken, async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Invalid or empty IDs list' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        let deletedCount = 0;
        let skippedCount = 0;
        const skippedReasons = [];

        for (const id of ids) {
            // Check dependencies
            const [sales] = await connection.query('SELECT 1 FROM sales WHERE customer_id = ? LIMIT 1', [id]);
            const [credits] = await connection.query('SELECT 1 FROM credit_notes WHERE customer_id = ? LIMIT 1', [id]);

            if (sales.length > 0 || credits.length > 0) {
                skippedCount++;
                skippedReasons.push({ id, reason: 'Has active history or credit' });
                continue;
            }

            await connection.query('DELETE FROM customers WHERE id = ?', [id]);
            deletedCount++;
        }

        await connection.commit();
        res.json({
            message: `Deleted ${deletedCount} customers successfully. Skipped ${skippedCount}.`,
            deleted: deletedCount,
            skipped: skippedCount,
            skippedReasons
        });
    } catch (err) {
        await connection.rollback();
        console.error('Bulk delete customers error:', err);
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// Get customer history
router.get('/:id/history', verifyToken, async (req, res) => {
    try {
        const [sales] = await db.query(
            'SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json(sales);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get customer credit bills (pay_later sales) with logic for Paid/Pending status
router.get('/:id/credit-bills', verifyToken, async (req, res) => {
    try {
        const [bills] = await db.query(`
            SELECT s.id, s.total_amount, s.created_at, s.payment_method, s.was_pay_later,
                   (SELECT sp.amount FROM sale_payments sp 
                    WHERE sp.sale_id = s.id AND sp.payment_method = 'pay_later' LIMIT 1) as split_credit_amount
            FROM sales s
            WHERE s.customer_id = ? 
              AND (s.payment_method = 'pay_later' 
                   OR EXISTS (SELECT 1 FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.payment_method = 'pay_later')
                   OR s.was_pay_later = 1)
            ORDER BY s.created_at DESC
        `, [req.params.id]);

        const processedBills = bills.map(bill => {
            const splitAmount = parseFloat(bill.split_credit_amount || 0);
            const isCurrentlyCredit = (bill.payment_method === 'pay_later' || splitAmount > 0);

            let status = 'pending';
            let creditAmount = parseFloat(bill.total_amount);

            if (bill.payment_method === 'pay_later') {
                status = 'pending';
                creditAmount = parseFloat(bill.total_amount);
            } else if (splitAmount > 0) {
                status = 'partial';
                creditAmount = splitAmount;
            } else if (bill.was_pay_later && !isCurrentlyCredit) {
                status = 'paid';
                creditAmount = parseFloat(bill.total_amount);
            }

            return {
                ...bill,
                status: status === 'partial' ? 'partial' : status,
                credit_amount: creditAmount,
                pending_amount: (status === 'paid') ? 0 : creditAmount,
                paid_amount: (status === 'paid') ? creditAmount : (parseFloat(bill.total_amount) - creditAmount)
            };
        });

        res.json(processedBills);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Recalibrate Customer Credit Balances (Fix Corruption)
router.post('/recalibrate-credit', verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Reset all credit balances to 0
        await connection.query('UPDATE customers SET credit_balance = 0');

        // BETTER APPROACH: Use SQL Aggregation directly
        await connection.query(`
            UPDATE customers c
            JOIN (
                SELECT customer_id, SUM(credit_amount) as total_credit
                FROM (
                    -- Case 1: Pure Pay Later
                    SELECT customer_id, total_amount as credit_amount
                    FROM sales
                    WHERE payment_method = 'pay_later' AND customer_id IS NOT NULL
                    
                    UNION ALL
                    
                    -- Case 2: Split Payment (only the pay_later portion)
                    SELECT s.customer_id, sp.amount as credit_amount
                    FROM sales s
                    JOIN sale_payments sp ON s.id = sp.sale_id
                    WHERE s.payment_method = 'split' AND sp.payment_method = 'pay_later' AND s.customer_id IS NOT NULL
                ) as combined_credits
                GROUP BY customer_id
            ) as totals ON c.id = totals.customer_id
            SET c.credit_balance = totals.total_credit
        `);

        await connection.commit();
        res.json({ message: 'Credit balances recalibrated successfully' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: 'Recalibration failed', error: err.message });
    } finally {
        connection.release();
    }
});

// Bulk/Manual Sync Customers to WhatsHub
router.post('/sync-whatshub', verifyToken, async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Invalid or empty IDs list' });
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        const [customers] = await db.query(`SELECT id, name, phone, email FROM customers WHERE id IN (${placeholders})`, ids);

        let syncedCount = 0;
        let skippedCount = 0;

        for (const c of customers) {
            if (!c.phone) {
                skippedCount++;
                continue;
            }
            try {
                await whatshubProvider.syncContact(c.phone, c.name, c.email || '');
                syncedCount++;
            } catch (err) {
                console.error(`Failed to sync customer ${c.id} to WhatsHub:`, err.message);
                skippedCount++;
            }
        }

        res.json({
            message: `Synced ${syncedCount} contacts to WhatsHub. Skipped ${skippedCount}.`,
            synced: syncedCount,
            skipped: skippedCount
        });
    } catch (err) {
        console.error('Error in bulk sync-whatshub:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
