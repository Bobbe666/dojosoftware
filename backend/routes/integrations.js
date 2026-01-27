// ============================================================================
// INTEGRATIONS API
// Backend/routes/integrations.js
// Zentrale Route für alle Integrationen (PayPal, LexOffice, DATEV)
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const PayPalProvider = require('../services/PayPalProvider');
const LexOfficeProvider = require('../services/LexOfficeProvider');
const DatevExportService = require('../services/DatevExportService');
const logger = require('../utils/logger');

router.use(authenticateToken);

// ============================================================================
// HELPER: Dojo-Config laden (inkl. Integration-Settings)
// ============================================================================

async function getDojoConfig(dojoId) {
    return new Promise((resolve, reject) => {
        // Lade Dojo-Basisdaten UND Integration-Settings
        const query = `
            SELECT
                d.*,
                di.paypal_client_id,
                di.paypal_client_secret,
                di.paypal_webhook_id,
                di.paypal_sandbox,
                di.lexoffice_api_key,
                di.datev_consultant_number,
                di.datev_client_number
            FROM dojo d
            LEFT JOIN dojo_integrations di ON d.id = di.dojo_id
            WHERE d.id = ?
        `;

        db.query(query, [dojoId], (err, results) => {
            if (err) return reject(err);
            if (results.length === 0) return reject(new Error('Dojo nicht gefunden'));
            resolve(results[0]);
        });
    });
}

// ============================================================================
// STATUS ALLER INTEGRATIONEN
// ============================================================================

router.get('/status', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);

        const paypal = new PayPalProvider(config);
        const lexoffice = new LexOfficeProvider(config);
        const datev = new DatevExportService(config);

        const status = {
            paypal: await paypal.getStatus(),
            lexoffice: await lexoffice.getStatus(),
            datev: datev.getStatus(),
            ical: { configured: true, message: 'iCal Export ist verfügbar' },
            webhooks: { configured: true, message: 'Webhook System ist verfügbar' }
        };

        res.json(status);

    } catch (error) {
        logger.error('Fehler beim Laden des Integration-Status:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// PAYPAL ROUTES
// ============================================================================

/**
 * POST /api/integrations/paypal/create-order
 * Erstellt eine PayPal Order für eine Zahlung
 */
router.post('/paypal/create-order', async (req, res) => {
    try {
        const dojoId = req.body.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const paypal = new PayPalProvider(config);

        const result = await paypal.createOrder(req.body);
        res.json(result);

    } catch (error) {
        logger.error('PayPal Create Order Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/integrations/paypal/capture-order/:orderId
 * Captured eine genehmigte PayPal Order
 */
router.post('/paypal/capture-order/:orderId', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const paypal = new PayPalProvider(config);

        const result = await paypal.captureOrder(req.params.orderId);
        res.json(result);

    } catch (error) {
        logger.error('PayPal Capture Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/integrations/paypal/create-subscription
 * Erstellt ein PayPal Abo
 */
router.post('/paypal/create-subscription', async (req, res) => {
    try {
        const dojoId = req.body.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const paypal = new PayPalProvider(config);

        const result = await paypal.createSubscription(req.body);
        res.json(result);

    } catch (error) {
        logger.error('PayPal Subscription Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/integrations/paypal/cancel-subscription/:subscriptionId
 * Kündigt ein PayPal Abo
 */
router.post('/paypal/cancel-subscription/:subscriptionId', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const paypal = new PayPalProvider(config);

        const result = await paypal.cancelSubscription(
            req.params.subscriptionId,
            req.body.reason
        );
        res.json(result);

    } catch (error) {
        logger.error('PayPal Cancel Subscription Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/integrations/paypal/webhook
 * PayPal Webhook Endpoint (OHNE Auth!)
 */
router.post('/paypal/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        // Dojo aus Header oder Body ermitteln
        const body = JSON.parse(req.body.toString());
        const dojoId = body.resource?.custom_id?.split('D')[1] || 1;

        const config = await getDojoConfig(dojoId);
        const paypal = new PayPalProvider(config);

        // Signatur verifizieren
        const isValid = await paypal.verifyWebhookSignature(req.headers, body);

        if (!isValid) {
            logger.warn('PayPal Webhook: Ungültige Signatur');
            return res.status(401).send('Ungültige Signatur');
        }

        // Event verarbeiten
        await paypal.handleWebhook(body.event_type, body.resource);

        res.status(200).send('OK');

    } catch (error) {
        logger.error('PayPal Webhook Error:', error);
        res.status(500).send('Webhook Error');
    }
});

// ============================================================================
// LEXOFFICE ROUTES
// ============================================================================

/**
 * GET /api/integrations/lexoffice/status
 * LexOffice Verbindungsstatus
 */
router.get('/lexoffice/status', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const lexoffice = new LexOfficeProvider(config);

        const status = await lexoffice.getStatus();
        res.json(status);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/integrations/lexoffice/sync-contact/:mitgliedId
 * Synchronisiert ein Mitglied zu LexOffice
 */
router.post('/lexoffice/sync-contact/:mitgliedId', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const lexoffice = new LexOfficeProvider(config);

        // Mitglied laden
        const [mitglieder] = await db.promise().query(
            'SELECT * FROM mitglieder WHERE mitglied_id = ?',
            [req.params.mitgliedId]
        );

        if (mitglieder.length === 0) {
            return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        }

        const result = await lexoffice.syncContact(mitglieder[0]);
        res.json(result);

    } catch (error) {
        logger.error('LexOffice Sync Contact Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/integrations/lexoffice/sync-all-contacts
 * Synchronisiert alle Mitglieder zu LexOffice
 */
router.post('/lexoffice/sync-all-contacts', async (req, res) => {
    try {
        const dojoId = req.body.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const lexoffice = new LexOfficeProvider(config);

        const result = await lexoffice.syncAllContacts(dojoId);
        res.json(result);

    } catch (error) {
        logger.error('LexOffice Bulk Sync Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/integrations/lexoffice/create-invoice
 * Erstellt eine Rechnung in LexOffice
 */
router.post('/lexoffice/create-invoice', async (req, res) => {
    try {
        const dojoId = req.body.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const lexoffice = new LexOfficeProvider(config);

        const result = await lexoffice.createInvoice(req.body);
        res.json(result);

    } catch (error) {
        logger.error('LexOffice Create Invoice Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/integrations/lexoffice/invoice/:invoiceId/pdf
 * Lädt das PDF einer LexOffice Rechnung herunter
 */
router.get('/lexoffice/invoice/:invoiceId/pdf', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const lexoffice = new LexOfficeProvider(config);

        const result = await lexoffice.downloadInvoicePdf(req.params.invoiceId);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Rechnung_${req.params.invoiceId}.pdf`);
        res.send(result.pdf);

    } catch (error) {
        logger.error('LexOffice PDF Download Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// DATEV EXPORT ROUTES
// ============================================================================

/**
 * GET /api/integrations/datev/status
 * DATEV Export Status
 */
router.get('/datev/status', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const datev = new DatevExportService(config);

        res.json(datev.getStatus());

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/integrations/datev/export/invoices
 * Exportiert Rechnungen im DATEV-Format
 */
router.get('/datev/export/invoices', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date und end_date sind erforderlich' });
        }

        const config = await getDojoConfig(dojoId);
        const datev = new DatevExportService(config);

        const result = await datev.exportInvoices(dojoId, start_date, end_date);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        if (!result.content) {
            return res.json({ message: result.message });
        }

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
        res.send(result.content);

    } catch (error) {
        logger.error('DATEV Export Invoices Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/integrations/datev/export/payments
 * Exportiert Zahlungen im DATEV-Format
 */
router.get('/datev/export/payments', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date und end_date sind erforderlich' });
        }

        const config = await getDojoConfig(dojoId);
        const datev = new DatevExportService(config);

        const result = await datev.exportPayments(dojoId, start_date, end_date);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        if (!result.content) {
            return res.json({ message: result.message });
        }

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
        res.send(result.content);

    } catch (error) {
        logger.error('DATEV Export Payments Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/integrations/datev/export/debitoren
 * Exportiert Debitoren-Stammdaten im DATEV-Format
 */
router.get('/datev/export/debitoren', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const config = await getDojoConfig(dojoId);
        const datev = new DatevExportService(config);

        const result = await datev.exportDebitoren(dojoId);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        if (!result.content) {
            return res.json({ message: result.message });
        }

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
        res.send(result.content);

    } catch (error) {
        logger.error('DATEV Export Debitoren Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/integrations/datev/exports
 * Liste der bisherigen DATEV-Exporte
 */
router.get('/datev/exports', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user.dojo_id;
        const { limit = 50 } = req.query;

        const [exports] = await db.promise().query(`
            SELECT * FROM datev_exports
            WHERE dojo_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `, [dojoId, parseInt(limit)]);

        res.json(exports);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// KONFIGURATION SPEICHERN
// ============================================================================

/**
 * PUT /api/integrations/config
 * Speichert Integration-Konfiguration
 */
router.put('/config', async (req, res) => {
    try {
        const dojoId = req.body.dojo_id || req.user.dojo_id;

        // Nur Admin darf Konfiguration ändern
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Nur Admins können die Konfiguration ändern' });
        }

        const {
            paypal_client_id,
            paypal_client_secret,
            paypal_sandbox,
            paypal_webhook_id,
            lexoffice_api_key,
            datev_consultant_number,
            datev_client_number
        } = req.body;

        // Upsert in dojo_integrations Tabelle
        await db.promise().query(`
            INSERT INTO dojo_integrations (
                dojo_id,
                paypal_client_id,
                paypal_client_secret,
                paypal_webhook_id,
                paypal_sandbox,
                lexoffice_api_key,
                datev_consultant_number,
                datev_client_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                paypal_client_id = COALESCE(VALUES(paypal_client_id), paypal_client_id),
                paypal_client_secret = COALESCE(VALUES(paypal_client_secret), paypal_client_secret),
                paypal_webhook_id = COALESCE(VALUES(paypal_webhook_id), paypal_webhook_id),
                paypal_sandbox = COALESCE(VALUES(paypal_sandbox), paypal_sandbox),
                lexoffice_api_key = COALESCE(VALUES(lexoffice_api_key), lexoffice_api_key),
                datev_consultant_number = COALESCE(VALUES(datev_consultant_number), datev_consultant_number),
                datev_client_number = COALESCE(VALUES(datev_client_number), datev_client_number),
                updated_at = NOW()
        `, [
            dojoId,
            paypal_client_id || null,
            paypal_client_secret || null,
            paypal_webhook_id || null,
            paypal_sandbox !== undefined ? (paypal_sandbox ? 1 : 0) : null,
            lexoffice_api_key || null,
            datev_consultant_number || null,
            datev_client_number || null
        ]);

        res.json({ success: true, message: 'Konfiguration gespeichert' });

    } catch (error) {
        logger.error('Config Update Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
