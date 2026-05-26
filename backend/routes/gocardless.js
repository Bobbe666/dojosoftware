// ============================================================================
// GOCARDLESS SEPA DIRECT DEBIT ROUTES
// backend/routes/gocardless.js
// SEPA-Lastschrift-Integration über GoCardless
// ============================================================================

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Gibt den GoCardless API-Base-URL zurück (sandbox oder live)
 */
function getGcBaseUrl() {
    const env = process.env.GOCARDLESS_ENVIRONMENT || 'sandbox';
    return env === 'live'
        ? 'https://api.gocardless.com'
        : 'https://api-sandbox.gocardless.com';
}

/**
 * Erstellt einen vorbereiteten Axios-Client für die GoCardless API
 */
function gcClient() {
    const token = process.env.GOCARDLESS_ACCESS_TOKEN;
    if (!token) {
        throw new Error('GOCARDLESS_ACCESS_TOKEN nicht konfiguriert');
    }
    return axios.create({
        baseURL: getGcBaseUrl(),
        headers: {
            Authorization: `Bearer ${token}`,
            'GoCardless-Version': '2015-07-06',
            'Content-Type': 'application/json'
        }
    });
}

/**
 * Lädt ein Mitglied aus der DB (dojo-sicher)
 */
async function getMitglied(mitgliedId, dojoId) {
    const [rows] = await pool.query(
        `SELECT mitglied_id, vorname, nachname, email,
                gocardless_customer_id, gocardless_mandate_id, gocardless_mandate_status
         FROM mitglieder
         WHERE mitglied_id = ?
           AND (? IS NULL OR dojo_id = ?)`,
        [mitgliedId, dojoId, dojoId]
    );
    if (rows.length === 0) {
        throw new Error('Mitglied nicht gefunden oder kein Zugriff');
    }
    return rows[0];
}

// ============================================================================
// POST /api/gocardless/mandate/setup
// Erstellt GoCardless Customer + Redirect URL für Hosted Mandate Page
// ============================================================================

router.post('/mandate/setup', authenticateToken, async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        if (!dojoId) {
            return res.status(400).json({ error: 'dojo_id fehlt' });
        }

        const { mitglied_id } = req.body;
        if (!mitglied_id) {
            return res.status(400).json({ error: 'mitglied_id ist erforderlich' });
        }

        const mitglied = await getMitglied(mitglied_id, dojoId);
        const gc = gcClient();

        // Customer anlegen oder bestehenden nutzen
        let customerId = mitglied.gocardless_customer_id;

        if (!customerId) {
            logger.info('GoCardless: Erstelle Customer', { mitglied_id });
            const customerResp = await gc.post('/customers', {
                customers: {
                    email: mitglied.email,
                    given_name: mitglied.vorname,
                    family_name: mitglied.nachname,
                    metadata: { mitglied_id: String(mitglied_id), dojo_id: String(dojoId) }
                }
            });
            customerId = customerResp.data.customers.id;

            await pool.query(
                `UPDATE mitglieder SET gocardless_customer_id = ? WHERE mitglied_id = ?`,
                [customerId, mitglied_id]
            );
            logger.info('GoCardless: Customer erstellt', { customerId, mitglied_id });
        }

        // Redirect Flow (Hosted Mandate Page) erstellen
        const redirectFlowResp = await gc.post('/redirect_flows', {
            redirect_flows: {
                description: 'SEPA-Lastschrift Einzugsermächtigung',
                session_token: `session_${mitglied_id}_${Date.now()}`,
                success_redirect_url: process.env.GOCARDLESS_REDIRECT_URL || `${process.env.FRONTEND_URL || 'https://dojo.tda-intl.org'}/mandate-success`,
                prefilled_customer: {
                    email: mitglied.email,
                    given_name: mitglied.vorname,
                    family_name: mitglied.nachname
                }
            }
        });

        const flow = redirectFlowResp.data.redirect_flows;
        logger.info('GoCardless: Redirect Flow erstellt', { flowId: flow.id, mitglied_id });

        res.json({
            redirect_url: flow.redirect_url,
            flow_id: flow.id,
            customer_id: customerId
        });

    } catch (error) {
        const detail = error.response?.data || error.message;
        logger.error('GoCardless mandate/setup Fehler', { error: detail });
        res.status(500).json({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
    }
});

// ============================================================================
// POST /api/gocardless/mandate/confirm
// Bestätigt ein Mandat nach dem GoCardless Redirect (oder manuell via mandate_id)
// ============================================================================

router.post('/mandate/confirm', authenticateToken, async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        if (!dojoId) {
            return res.status(400).json({ error: 'dojo_id fehlt' });
        }

        const { mitglied_id, mandate_id, flow_id, session_token } = req.body;

        if (!mitglied_id) {
            return res.status(400).json({ error: 'mitglied_id ist erforderlich' });
        }

        // Sicherheitscheck: Mitglied muss zum Dojo gehören
        await getMitglied(mitglied_id, dojoId);

        const gc = gcClient();
        let resolvedMandateId = mandate_id;

        // Wenn flow_id + session_token vorhanden: Redirect Flow abschließen
        if (flow_id && session_token && !mandate_id) {
            logger.info('GoCardless: Schließe Redirect Flow ab', { flow_id, mitglied_id });
            const completeResp = await gc.post(`/redirect_flows/${flow_id}/actions/complete`, {
                data: { session_token }
            });
            const completedFlow = completeResp.data.redirect_flows;
            resolvedMandateId = completedFlow.links?.mandate;
        }

        if (!resolvedMandateId) {
            return res.status(400).json({ error: 'mandate_id konnte nicht ermittelt werden' });
        }

        // Mandat-Status bei GoCardless prüfen
        const mandateResp = await gc.get(`/mandates/${resolvedMandateId}`);
        const mandateStatus = mandateResp.data.mandates.status;

        // In DB speichern
        await pool.query(
            `UPDATE mitglieder
             SET gocardless_mandate_id = ?,
                 gocardless_mandate_status = ?
             WHERE mitglied_id = ?`,
            [resolvedMandateId, mandateStatus, mitglied_id]
        );

        logger.info('GoCardless: Mandat gespeichert', { resolvedMandateId, mandateStatus, mitglied_id });

        res.json({
            success: true,
            mandate_id: resolvedMandateId,
            mandate_status: mandateStatus
        });

    } catch (error) {
        const detail = error.response?.data || error.message;
        logger.error('GoCardless mandate/confirm Fehler', { error: detail });
        res.status(500).json({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
    }
});

// ============================================================================
// POST /api/gocardless/payment/create
// Erstellt eine einmalige Zahlung gegen ein gespeichertes Mandat
// ============================================================================

router.post('/payment/create', authenticateToken, async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        if (!dojoId) {
            return res.status(400).json({ error: 'dojo_id fehlt' });
        }

        const { mitglied_id, amount_cents, description } = req.body;

        if (!mitglied_id || !amount_cents || !description) {
            return res.status(400).json({ error: 'mitglied_id, amount_cents und description sind erforderlich' });
        }

        const mitglied = await getMitglied(mitglied_id, dojoId);

        if (!mitglied.gocardless_mandate_id) {
            return res.status(400).json({ error: 'Kein aktives SEPA-Mandat für dieses Mitglied' });
        }

        if (mitglied.gocardless_mandate_status !== 'active') {
            return res.status(400).json({
                error: `SEPA-Mandat hat Status "${mitglied.gocardless_mandate_status}" — Zahlung nicht möglich`
            });
        }

        const gc = gcClient();
        const paymentResp = await gc.post('/payments', {
            payments: {
                amount: parseInt(amount_cents, 10),
                currency: 'EUR',
                description,
                metadata: {
                    mitglied_id: String(mitglied_id),
                    dojo_id: String(dojoId)
                },
                links: {
                    mandate: mitglied.gocardless_mandate_id
                }
            }
        });

        const payment = paymentResp.data.payments;
        logger.info('GoCardless: Zahlung erstellt', { paymentId: payment.id, amount_cents, mitglied_id });

        res.json({
            success: true,
            payment_id: payment.id,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency
        });

    } catch (error) {
        const detail = error.response?.data || error.message;
        logger.error('GoCardless payment/create Fehler', { error: detail });
        res.status(500).json({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
    }
});

// ============================================================================
// POST /api/gocardless/webhook
// GoCardless Webhook Handler — verarbeitet Payment-Events
// ============================================================================

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const webhookSecret = process.env.GOCARDLESS_WEBHOOK_SECRET;
        const signature = req.headers['webhook-signature'];

        // Signatur-Verifikation
        if (webhookSecret && signature) {
            const rawBody = req.body; // Buffer dank express.raw()
            const expectedSig = crypto
                .createHmac('sha256', webhookSecret)
                .update(rawBody)
                .digest('hex');

            if (expectedSig !== signature) {
                logger.error('GoCardless Webhook: Ungültige Signatur');
                return res.status(401).json({ error: 'Ungültige Webhook-Signatur' });
            }
        }

        const payload = JSON.parse(req.body.toString());
        const events = payload.events || [];

        logger.info('GoCardless Webhook empfangen', { eventCount: events.length });

        for (const event of events) {
            const { resource_type, action, links, details } = event;

            if (resource_type === 'payments') {
                const paymentId = links?.payment;
                logger.info('GoCardless Payment Event', { action, paymentId });

                if (action === 'confirmed' || action === 'paid_out') {
                    // Zahlung erfolgreich — beitraege/rechnungen aktualisieren
                    await handlePaymentSuccess(paymentId);
                } else if (action === 'failed' || action === 'cancelled' || action === 'charged_back') {
                    await handlePaymentFailed(paymentId, action, details?.description);
                }
            } else if (resource_type === 'mandates') {
                const mandateId = links?.mandate;
                const newStatus = mapMandateAction(action);
                if (mandateId && newStatus) {
                    logger.info('GoCardless Mandate Event', { action, mandateId, newStatus });
                    await pool.query(
                        `UPDATE mitglieder SET gocardless_mandate_status = ? WHERE gocardless_mandate_id = ?`,
                        [newStatus, mandateId]
                    );
                }
            }
        }

        res.status(200).json({ success: true });

    } catch (error) {
        logger.error('GoCardless Webhook Fehler', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * Markiert eine Zahlung als erfolgreich in beitraege/rechnungen
 * Mapping: GoCardless payment_id → lokale Datensätze via Metadata
 */
async function handlePaymentSuccess(paymentId) {
    try {
        const gc = gcClient();
        const paymentResp = await gc.get(`/payments/${paymentId}`);
        const payment = paymentResp.data.payments;
        const mitgliedId = payment.metadata?.mitglied_id;

        if (!mitgliedId) {
            logger.warn('GoCardless Webhook: Keine mitglied_id in Payment-Metadata', { paymentId });
            return;
        }

        // Offene Beiträge des Mitglieds als bezahlt markieren (älteste zuerst)
        const amountEur = payment.amount / 100;
        const [updated] = await pool.query(
            `UPDATE beitraege
             SET bezahlt = 1, bezahlt_am = NOW(), zahlungsart = 'gocardless'
             WHERE mitglied_id = ?
               AND bezahlt = 0
             ORDER BY faellig_am ASC
             LIMIT 1`,
            [mitgliedId]
        );

        if (updated.affectedRows > 0) {
            logger.info('GoCardless: Beitrag als bezahlt markiert', { mitgliedId, paymentId, amountEur });
        } else {
            logger.info('GoCardless: Kein offener Beitrag gefunden', { mitgliedId, paymentId });
        }
    } catch (err) {
        logger.error('GoCardless handlePaymentSuccess Fehler', { error: err.message, paymentId });
    }
}

/**
 * Behandelt fehlgeschlagene Zahlungen
 */
async function handlePaymentFailed(paymentId, action, description) {
    try {
        logger.warn('GoCardless: Zahlung fehlgeschlagen', { paymentId, action, description });
        // Hier könnte man Benachrichtigungen auslösen oder Mahnungen erstellen
        // Vorerst nur Logging
    } catch (err) {
        logger.error('GoCardless handlePaymentFailed Fehler', { error: err.message, paymentId });
    }
}

/**
 * Mappt GoCardless Mandate-Actions auf interne Status-Strings
 */
function mapMandateAction(action) {
    const map = {
        created: 'pending_submission',
        submitted: 'submitted',
        active: 'active',
        cancelled: 'cancelled',
        failed: 'failed',
        expired: 'expired',
        reinstated: 'active'
    };
    return map[action] || null;
}

// ============================================================================
// GET /api/gocardless/mandate/status/:mitglied_id
// Gibt den aktuellen Mandat-Status eines Mitglieds zurück
// ============================================================================

router.get('/mandate/status/:mitglied_id', authenticateToken, async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const mitgliedId = parseInt(req.params.mitglied_id, 10);

        if (!mitgliedId) {
            return res.status(400).json({ error: 'Ungültige mitglied_id' });
        }

        const mitglied = await getMitglied(mitgliedId, dojoId);

        const status = {
            mitglied_id: mitgliedId,
            has_mandate: !!mitglied.gocardless_mandate_id,
            mandate_id: mitglied.gocardless_mandate_id || null,
            mandate_status: mitglied.gocardless_mandate_status || 'none',
            customer_id: mitglied.gocardless_customer_id || null
        };

        // Optional: Live-Status von GoCardless holen wenn Mandat vorhanden
        if (mitglied.gocardless_mandate_id) {
            try {
                const gc = gcClient();
                const mandateResp = await gc.get(`/mandates/${mitglied.gocardless_mandate_id}`);
                const liveStatus = mandateResp.data.mandates.status;

                if (liveStatus !== mitglied.gocardless_mandate_status) {
                    // Status aktualisieren
                    await pool.query(
                        `UPDATE mitglieder SET gocardless_mandate_status = ? WHERE mitglied_id = ?`,
                        [liveStatus, mitgliedId]
                    );
                    status.mandate_status = liveStatus;
                }
            } catch (gcErr) {
                logger.warn('GoCardless Live-Status konnte nicht abgerufen werden', { error: gcErr.message });
            }
        }

        logger.info('GoCardless Mandat-Status abgerufen', { mitgliedId, status: status.mandate_status });
        res.json(status);

    } catch (error) {
        logger.error('GoCardless mandate/status Fehler', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
