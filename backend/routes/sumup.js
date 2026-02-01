// ============================================================================
// SUMUP ROUTES
// Backend/routes/sumup.js
// Kartenterminal-Zahlungen über SumUp
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const SumUpProvider = require('../services/SumUpProvider');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Holt SumUp-Konfiguration für ein Dojo
 */
const getSumUpConfig = async (dojoId) => {
    return new Promise((resolve, reject) => {
        db.query(
            `SELECT id, dojoname, email, sumup_api_key, sumup_merchant_code,
                    sumup_client_id, sumup_client_secret, sumup_aktiv
             FROM dojo WHERE id = ?`,
            [dojoId],
            (err, results) => {
                if (err) return reject(err);
                if (results.length === 0) return reject(new Error('Dojo nicht gefunden'));
                resolve(results[0]);
            }
        );
    });
};

/**
 * Erstellt einen SumUp Provider für ein Dojo
 */
const createProvider = async (dojoId) => {
    const config = await getSumUpConfig(dojoId);

    if (!config.sumup_aktiv) {
        throw new Error('SumUp ist für dieses Dojo nicht aktiviert');
    }

    if (!config.sumup_api_key && (!config.sumup_client_id || !config.sumup_client_secret)) {
        throw new Error('SumUp ist nicht konfiguriert');
    }

    return new SumUpProvider(config);
};

// ============================================================================
// STATUS & CONFIGURATION
// ============================================================================

/**
 * GET /api/sumup/status
 * Prüft ob SumUp konfiguriert und verbunden ist
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const config = await getSumUpConfig(dojoId);

        // Wenn nicht aktiviert oder nicht konfiguriert
        if (!config.sumup_aktiv) {
            return res.json({
                configured: false,
                connected: false,
                active: false,
                message: 'SumUp ist nicht aktiviert'
            });
        }

        if (!config.sumup_api_key && (!config.sumup_client_id || !config.sumup_client_secret)) {
            return res.json({
                configured: false,
                connected: false,
                active: true,
                message: 'SumUp Zugangsdaten fehlen'
            });
        }

        // Verbindung testen
        const provider = new SumUpProvider(config);
        const status = await provider.getStatus();

        res.json({
            ...status,
            active: config.sumup_aktiv
        });

    } catch (error) {
        logger.error('SumUp Status Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sumup/test-connection
 * Testet die SumUp API-Verbindung
 */
router.post('/test-connection', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.body.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const provider = await createProvider(dojoId);
        const result = await provider.testConnection();

        res.json(result);

    } catch (error) {
        logger.error('SumUp Verbindungstest Fehler:', { error: error.message });
        res.status(500).json({
            success: false,
            connected: false,
            error: error.message
        });
    }
});

// ============================================================================
// CHECKOUT OPERATIONS
// ============================================================================

/**
 * POST /api/sumup/checkout
 * Erstellt einen neuen SumUp Checkout (Zahlungslink)
 */
router.post('/checkout', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.body.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const {
            amount,
            description,
            reference,
            returnUrl,
            // Optionale Referenzen
            mitgliedId,
            rechnungId,
            verkaufId,
            eventAnmeldungId,
            verbandsmitgliedschaftId,
            zahlungstyp
        } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Gültiger Betrag erforderlich' });
        }

        const provider = await createProvider(dojoId);
        const result = await provider.createCheckout({
            amount,
            description,
            reference,
            returnUrl,
            mitgliedId,
            rechnungId,
            verkaufId,
            eventAnmeldungId,
            verbandsmitgliedschaftId,
            zahlungstyp
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        logger.error('SumUp Checkout Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sumup/checkout/:checkoutId
 * Holt den Status eines Checkouts
 */
router.get('/checkout/:checkoutId', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const { checkoutId } = req.params;

        const provider = await createProvider(dojoId);
        const result = await provider.getCheckoutStatus(checkoutId);

        res.json(result);

    } catch (error) {
        logger.error('SumUp Checkout Status Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/sumup/checkout/:checkoutId
 * Löscht einen ausstehenden Checkout
 */
router.delete('/checkout/:checkoutId', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const { checkoutId } = req.params;

        const provider = await createProvider(dojoId);
        const result = await provider.deleteCheckout(checkoutId);

        res.json(result);

    } catch (error) {
        logger.error('SumUp Checkout Löschen Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// TRANSACTIONS
// ============================================================================

/**
 * GET /api/sumup/transactions
 * Holt die Transaktionshistorie
 */
router.get('/transactions', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const { limit, startDate, endDate } = req.query;

        const provider = await createProvider(dojoId);
        const result = await provider.getTransactions({
            limit: limit ? parseInt(limit) : 10,
            startDate,
            endDate
        });

        res.json(result);

    } catch (error) {
        logger.error('SumUp Transaktionen Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sumup/transactions/:transactionId
 * Holt Details zu einer Transaktion
 */
router.get('/transactions/:transactionId', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const { transactionId } = req.params;

        const provider = await createProvider(dojoId);
        const result = await provider.getTransaction(transactionId);

        res.json(result);

    } catch (error) {
        logger.error('SumUp Transaktion Details Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sumup/transactions/:transactionId/receipt
 * Holt die Quittung einer Transaktion
 */
router.get('/transactions/:transactionId/receipt', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const { transactionId } = req.params;

        const provider = await createProvider(dojoId);
        const result = await provider.getReceipt(transactionId);

        res.json(result);

    } catch (error) {
        logger.error('SumUp Quittung Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// REFUNDS
// ============================================================================

/**
 * POST /api/sumup/refund/:transactionId
 * Erstellt eine Rückerstattung
 */
router.post('/refund/:transactionId', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.body.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const { transactionId } = req.params;
        const { amount } = req.body;

        const provider = await createProvider(dojoId);
        const result = await provider.refund(transactionId, amount);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        logger.error('SumUp Rückerstattung Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// PAYMENTS (DB-Records)
// ============================================================================

/**
 * GET /api/sumup/payments
 * Holt alle SumUp-Zahlungen für ein Dojo aus der DB
 */
router.get('/payments', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const limit = parseInt(req.query.limit) || 50;
        const status = req.query.status;

        let query = 'SELECT * FROM sumup_payments WHERE dojo_id = ?';
        const params = [dojoId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        db.query(query, params, (err, results) => {
            if (err) {
                logger.error('SumUp Zahlungen DB Fehler:', { error: err.message });
                return res.status(500).json({ error: err.message });
            }
            res.json({ payments: results });
        });

    } catch (error) {
        logger.error('SumUp Zahlungen Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sumup/payments/:checkoutId
 * Holt eine spezifische Zahlung aus der DB
 */
router.get('/payments/:checkoutId', authenticateToken, async (req, res) => {
    try {
        const { checkoutId } = req.params;

        db.query(
            'SELECT * FROM sumup_payments WHERE checkout_id = ?',
            [checkoutId],
            (err, results) => {
                if (err) {
                    logger.error('SumUp Zahlung DB Fehler:', { error: err.message });
                    return res.status(500).json({ error: err.message });
                }
                if (results.length === 0) {
                    return res.status(404).json({ error: 'Zahlung nicht gefunden' });
                }
                res.json({ payment: results[0] });
            }
        );

    } catch (error) {
        logger.error('SumUp Zahlung Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// WEBHOOK (für SumUp Callbacks)
// ============================================================================

/**
 * POST /api/sumup/webhook
 * Webhook-Endpoint für SumUp Zahlungsbestätigungen
 * ACHTUNG: Kein authenticateToken - wird von SumUp aufgerufen!
 */
router.post('/webhook', async (req, res) => {
    try {
        const { event_type, id, status, transaction_id, transaction_code, checkout_reference } = req.body;

        logger.info('SumUp Webhook empfangen:', {
            eventType: event_type,
            checkoutId: id,
            status,
            transactionId: transaction_id
        });

        // Zahlung in DB finden und aktualisieren
        if (id && status) {
            const updateQuery = `
                UPDATE sumup_payments
                SET status = ?,
                    transaction_id = ?,
                    transaction_code = ?,
                    updated_at = NOW()
                    ${status === 'PAID' ? ', paid_at = NOW()' : ''}
                WHERE checkout_id = ?
            `;

            db.query(
                updateQuery,
                [status, transaction_id || null, transaction_code || null, id],
                (err, result) => {
                    if (err) {
                        logger.error('SumUp Webhook DB Fehler:', { error: err.message });
                    } else if (result.affectedRows > 0) {
                        logger.info('SumUp Zahlung aktualisiert:', { checkoutId: id, status });
                    }
                }
            );
        }

        // SumUp erwartet 200 OK
        res.status(200).json({ received: true });

    } catch (error) {
        logger.error('SumUp Webhook Fehler:', { error: error.message });
        // Trotzdem 200 zurückgeben, damit SumUp nicht retry macht
        res.status(200).json({ received: true, error: error.message });
    }
});

// ============================================================================
// MERCHANT INFO
// ============================================================================

/**
 * GET /api/sumup/merchant
 * Holt Händler-Informationen
 */
router.get('/merchant', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo ID erforderlich' });
        }

        const provider = await createProvider(dojoId);
        const result = await provider.getMerchantInfo();

        res.json(result);

    } catch (error) {
        logger.error('SumUp Merchant Info Fehler:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
