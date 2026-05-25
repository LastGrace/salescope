const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

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

// Create customer
router.post('/', verifyToken, async (req, res) => {
    const { name, phone, email } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Check if phone already exists
        if (phone) {
            const [existing] = await connection.query('SELECT id FROM customers WHERE phone = ? LIMIT 1', [phone]);
            if (existing.length > 0) {
                await connection.rollback();
                connection.release();
                // User requirement: "cannot be saved... will show existing"
                // Returning 409 Conflict with clear message
                return res.status(409).json({ message: 'Customer with this phone number already exists.' });
            }
        }

        const [result] = await connection.query(
            'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
            [name, phone, email]
        );

        // Auto-issue loyalty card if phone exists
        if (phone) {
            try {
                // Remove spaces/dashes from phone for card number usage if needed, or keep raw
                await connection.query(
                    'INSERT INTO loyalty_cards (customer_id, card_number) VALUES (?, ?)',
                    [result.insertId, phone]
                );
            } catch (cardErr) {
                // Ignore duplicate card errors (rare but safely ignored)
                console.warn('Auto-issue card failed (might exist):', cardErr.message);
            }
        }

        await connection.commit();
        res.status(201).json({ id: result.insertId, ...req.body });
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
        const skippedPhones = [];

        for (const c of customers) {
            // Validate compulsory fields
            if (!c.name || !c.phone) {
                skippedCount++;
                continue;
            }

            // Check if phone exists
            const [existing] = await connection.query('SELECT id FROM customers WHERE phone = ? LIMIT 1', [c.phone]);
            if (existing.length > 0) {
                skippedCount++;
                skippedPhones.push(c.phone);
                continue; // SKIP existing
            }

            // Insert new
            await connection.query(`
                INSERT INTO customers (name, phone, email)
                VALUES (?, ?, ?)
            `, [c.name, c.phone, c.email || null]);
            importedCount++;
        }

        await connection.commit();
        res.json({
            message: `Imported ${importedCount} customers. Skipped ${skippedCount} duplicates.`,
            skipped: skippedPhones
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
    const { name, phone, email, loyalty_points } = req.body;
    try {
        // Check uniqueness for update (exclude current ID)
        if (phone) {
            const [existing] = await db.query('SELECT id FROM customers WHERE phone = ? AND id != ? LIMIT 1', [phone, req.params.id]);
            if (existing.length > 0) {
                return res.status(409).json({ message: 'Phone number already assigned to another customer.' });
            }
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
            deletedCount,
            skippedCount,
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
                status = 'partial'; // Or pending, but partial flag helps UI
                creditAmount = splitAmount;
            } else if (bill.was_pay_later && !isCurrentlyCredit) {
                status = 'paid';
                creditAmount = parseFloat(bill.total_amount);
            }

            // Prepare response fields
            // For Paid bills, pending_amount is 0.
            // For Pending/Partial, pending_amount is creditAmount.
            // We can reuse the structure from previous logic to minimize frontend changes.

            return {
                ...bill,
                status: status === 'partial' ? 'partial' : status, // explicit
                credit_amount: creditAmount,
                pending_amount: (status === 'paid') ? 0 : creditAmount,
                paid_amount: (status === 'paid') ? creditAmount : (parseFloat(bill.total_amount) - creditAmount) // approximation
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

        // 2. Fetch all sales that are 'pay_later' or 'split'
        const [sales] = await connection.query(`
            SELECT s.customer_id, s.payment_method, s.total_amount, sp.payment_method as sp_method, sp.amount as sp_amount
            FROM sales s
            LEFT JOIN sale_payments sp ON s.id = sp.sale_id
            WHERE s.customer_id IS NOT NULL AND (s.payment_method = 'pay_later' OR s.payment_method = 'split')
        `);

        // 3. Aggregate Credit per Customer
        const customerCredits = {};

        for (const s of sales) {
            // Check if this row contributes to credit
            let credit = 0;
            if (s.payment_method === 'pay_later') {
                // If main method is pay_later, use total. Avoid duplicates if joined with payments
                // Since we joined, we might get multiple rows per sale if split.
                // But pay_later usually single.
                // Better strategy: Filter distinct sales or handle logic carefully.
                // If joined, we get N rows. 
                // Let's rely on distinct sales or just use aggregation query directly?
                // Direct aggregation query is safer and faster.
                continue;
            }
        }

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

module.exports = router;
