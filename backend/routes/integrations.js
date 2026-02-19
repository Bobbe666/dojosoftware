// ============================================================================
// INTEGRATIONS API
// Backend/routes/integrations.js
// Zentrale Route für alle Integrationen (PayPal, SumUp, LexOffice, DATEV)
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const PayPalProvider = require('../services/PayPalProvider');
const SumUpProvider = require('../services/SumUpProvider');
const LexOfficeProvider = require('../services/LexOfficeProvider');
const DatevExportService = require('../services/DatevExportService');
const logger = require('../utils/logger');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

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
                d.stripe_publishable_key,
                d.stripe_secret_key,
                d.sumup_api_key,
                d.sumup_merchant_code,
                d.sumup_client_id,
                d.sumup_client_secret,
                d.sumup_aktiv,
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
        const config = await getDojoConfig(dojoId);

        const paypal = new PayPalProvider(config);
        const lexoffice = new LexOfficeProvider(config);
        const datev = new DatevExportService(config);

        // PayPal Status mit Client-ID für Frontend
        const paypalStatus = await paypal.getStatus();
        if (paypalStatus.configured && config.paypal_client_id) {
            paypalStatus.client_id = config.paypal_client_id;
            paypalStatus.sandbox = config.paypal_sandbox === 1 || config.paypal_sandbox === true;
        }

        // Stripe Status aus Dojo-Config
        const stripeConfigured = !!(config.stripe_publishable_key && config.stripe_secret_key);

        // SumUp Status
        const sumupConfigured = !!(config.sumup_api_key || (config.sumup_client_id && config.sumup_client_secret));
        const sumupStatus = {
            configured: sumupConfigured,
            active: config.sumup_aktiv === 1 || config.sumup_aktiv === true,
            connected: false
        };
        if (sumupConfigured && config.sumup_aktiv) {
            try {
                const sumup = new SumUpProvider(config);
                const sumupFullStatus = await sumup.getStatus();
                sumupStatus.connected = sumupFullStatus.connected;
                sumupStatus.merchantCode = sumupFullStatus.merchantCode;
            } catch (e) {
                sumupStatus.error = e.message;
            }
        }

        const status = {
            paypal: paypalStatus,
            stripe: {
                configured: stripeConfigured,
                publishable_key: stripeConfigured ? config.stripe_publishable_key : null
            },
            sumup: sumupStatus,
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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

/**
 * POST /api/integrations/paypal/test
 * PayPal Verbindungstest
 */
router.post('/paypal/test', async (req, res) => {
    try {
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
        const config = await getDojoConfig(dojoId);
        const paypal = new PayPalProvider(config);

        const status = await paypal.getStatus();
        res.json({
            success: status.connected,
            message: status.connected ? 'PayPal-Verbindung erfolgreich' : 'Verbindung fehlgeschlagen'
        });

    } catch (error) {
        logger.error('PayPal Test Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// SUMUP ROUTES
// ============================================================================

/**
 * POST /api/integrations/sumup/test
 * SumUp Verbindungstest
 */
router.post('/sumup/test', async (req, res) => {
    try {
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
        const config = await getDojoConfig(dojoId);

        if (!config.sumup_api_key && (!config.sumup_client_id || !config.sumup_client_secret)) {
            return res.json({
                success: false,
                message: 'SumUp ist nicht konfiguriert'
            });
        }

        const sumup = new SumUpProvider(config);
        const status = await sumup.testConnection();

        res.json({
            success: status.connected,
            message: status.connected ? 'SumUp-Verbindung erfolgreich' : 'Verbindung fehlgeschlagen',
            merchantCode: status.merchantCode,
            businessName: status.businessName
        });

    } catch (error) {
        logger.error('SumUp Test Error:', error);
        res.status(500).json({ success: false, error: error.message });
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
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
// KONFIGURATION LADEN UND SPEICHERN
// ============================================================================

/**
 * GET /api/integrations/config
 * Lädt Integration-Konfiguration (ohne Secrets)
 */
router.get('/config', async (req, res) => {
    try {
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
        const config = await getDojoConfig(dojoId);

        // Maskiere sensible Daten
        const maskedConfig = {
            // Stripe (aus dojo Tabelle)
            stripe_publishable_key: config.stripe_publishable_key || '',
            stripe_secret_key: config.stripe_secret_key ? '••••••••' + config.stripe_secret_key.slice(-4) : '',
            // PayPal
            paypal_client_id: config.paypal_client_id || '',
            paypal_client_secret: config.paypal_client_secret ? '••••••••' + config.paypal_client_secret.slice(-4) : '',
            paypal_sandbox: config.paypal_sandbox === 1 || config.paypal_sandbox === true,
            // SumUp
            sumup_api_key: config.sumup_api_key ? '••••••••' + config.sumup_api_key.slice(-4) : '',
            sumup_merchant_code: config.sumup_merchant_code || '',
            sumup_client_id: config.sumup_client_id || '',
            sumup_client_secret: config.sumup_client_secret ? '••••••••' + config.sumup_client_secret.slice(-4) : '',
            sumup_aktiv: config.sumup_aktiv === 1 || config.sumup_aktiv === true,
            // LexOffice
            lexoffice_api_key: config.lexoffice_api_key ? '••••••••' + config.lexoffice_api_key.slice(-4) : '',
            // DATEV
            datev_consultant_number: config.datev_consultant_number || '',
            datev_client_number: config.datev_client_number || ''
        };

        res.json(maskedConfig);

    } catch (error) {
        logger.error('Config Load Error:', error);
        res.status(500).json({ error: error.message });
    }
});

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
            stripe_publishable_key,
            stripe_secret_key,
            paypal_client_id,
            paypal_client_secret,
            paypal_sandbox,
            paypal_webhook_id,
            sumup_api_key,
            sumup_merchant_code,
            sumup_client_id,
            sumup_client_secret,
            sumup_aktiv,
            lexoffice_api_key,
            datev_consultant_number,
            datev_client_number
        } = req.body;

        // Helper function to check if a key is masked
        const isMasked = (key) => key && key.startsWith('••••');

        // Update dojo Tabelle für Stripe und SumUp
        const dojoUpdates = [];
        const dojoParams = [];

        // Stripe Keys
        if (stripe_publishable_key !== undefined && !isMasked(stripe_publishable_key)) {
            dojoUpdates.push('stripe_publishable_key = ?');
            dojoParams.push(stripe_publishable_key || null);
        }
        if (stripe_secret_key !== undefined && !isMasked(stripe_secret_key)) {
            dojoUpdates.push('stripe_secret_key = ?');
            dojoParams.push(stripe_secret_key || null);
        }

        // SumUp Keys
        if (sumup_api_key !== undefined && !isMasked(sumup_api_key)) {
            dojoUpdates.push('sumup_api_key = ?');
            dojoParams.push(sumup_api_key || null);
        }
        if (sumup_merchant_code !== undefined) {
            dojoUpdates.push('sumup_merchant_code = ?');
            dojoParams.push(sumup_merchant_code || null);
        }
        if (sumup_client_id !== undefined) {
            dojoUpdates.push('sumup_client_id = ?');
            dojoParams.push(sumup_client_id || null);
        }
        if (sumup_client_secret !== undefined && !isMasked(sumup_client_secret)) {
            dojoUpdates.push('sumup_client_secret = ?');
            dojoParams.push(sumup_client_secret || null);
        }
        if (sumup_aktiv !== undefined) {
            dojoUpdates.push('sumup_aktiv = ?');
            dojoParams.push(sumup_aktiv ? 1 : 0);
        }

        // Update payment_provider basierend auf Stripe
        if (stripe_publishable_key !== undefined || stripe_secret_key !== undefined) {
            const hasStripe = (stripe_publishable_key && !isMasked(stripe_publishable_key)) &&
                              (stripe_secret_key && !isMasked(stripe_secret_key));
            dojoUpdates.push('payment_provider = ?');
            dojoParams.push(hasStripe ? 'stripe_datev' : 'manual_sepa');
        }

        if (dojoUpdates.length > 0) {
            dojoParams.push(dojoId);
            await db.promise().query(`
                UPDATE dojo SET ${dojoUpdates.join(', ')}, updated_at = NOW() WHERE id = ?
            `, dojoParams);
        }

        // Upsert in dojo_integrations Tabelle (PayPal, LexOffice, DATEV)
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
