const express = require('express');
const router = express.Router();
const PaymentProviderFactory = require('../services/PaymentProviderFactory');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// Get current payment provider status
router.get('/status', authenticateToken, async (req, res) => {
    try {
        // 🔒 SICHER: Verwende getSecureDojoId statt req.query.dojo_id
        const dojoId = getSecureDojoId(req) || 1;
        const status = await PaymentProviderFactory.getProviderStatus(dojoId);
        res.json(status);

    } catch (error) {
        logger.error('API: Error getting provider status:', { error: error });
        res.status(500).json({
            error: 'Fehler beim Abrufen des Provider-Status',
            details: error.message
        });
    }
});

// Configure payment provider
router.post('/configure', authenticateToken, async (req, res) => {
    try {
        // 🔒 SICHER: Verwende getSecureDojoId statt req.body.dojo_id
        const dojoId = getSecureDojoId(req);
        const {
            payment_provider,
            stripe_secret_key,
            stripe_publishable_key,
            datev_api_key,
            datev_consultant_number,
            datev_client_number
        } = req.body;

        if (!payment_provider) {
            return res.status(400).json({
                error: 'Payment provider is required'
            });
        }

        // Validate configuration
        try {
            await PaymentProviderFactory.validateProviderConfig(req.body);
        } catch (validationError) {
            return res.status(400).json({
                error: 'Konfigurationsfehler',
                details: validationError.message
            });
        }

        await PaymentProviderFactory.updatePaymentProvider(dojoId, req.body);

        // Get updated status
        const updatedStatus = await PaymentProviderFactory.getProviderStatus(dojoId);
        res.json({
            success: true,
            message: 'Payment provider successfully configured',
            status: updatedStatus
        });

    } catch (error) {
        logger.error('API: Error configuring provider:', { error: error });
        res.status(500).json({
            error: 'Fehler beim Konfigurieren des Payment Providers',
            details: error.message
        });
    }
});

// Test payment provider configuration
router.post('/test', authenticateToken, async (req, res) => {
    try {
        // 🔒 SICHER: Verwende getSecureDojoId statt req.body.dojo_id
        const dojoId = getSecureDojoId(req);
        const provider = await PaymentProviderFactory.getProvider(dojoId);
        const isConfigured = await provider.isConfigured();
        const configStatus = await provider.getConfigurationStatus();

        const testResult = {
            provider_name: provider.getProviderName(),
            is_configured: isConfigured,
            configuration_details: configStatus,
            test_timestamp: new Date().toISOString()
        };

        if (provider.constructor.name === 'StripeDataevProvider' && isConfigured) {
            testResult.stripe_connection = 'Ready to test';
            testResult.datev_connection = 'Ready to test';
        }
        res.json({
            success: true,
            test_result: testResult
        });

    } catch (error) {
        logger.error('API: Error testing provider:', { error: error });
        res.status(500).json({
            error: 'Fehler beim Testen des Payment Providers',
            details: error.message
        });
    }
});

// Get payment provider logs
router.get('/logs', authenticateToken, async (req, res) => {
    try {
        const dojoId = req.user?.dojo_id;
        const limit = parseInt(req.query.limit) || 50;
        const provider = req.query.provider || null;

        const logs = await getPaymentProviderLogs(limit, provider, dojoId);
        res.json({
            logs: logs,
            count: logs.length
        });

    } catch (error) {
        logger.error('API: Error getting logs:', { error: error });
        res.status(500).json({
            error: 'Fehler beim Abrufen der Logs',
            details: error.message
        });
    }
});

// Create payment intent (Stripe)
router.post('/payment-intent', authenticateToken, async (req, res) => {
    try {
        // 🔒 SICHER: Verwende getSecureDojoId statt req.body.dojo_id
        const dojoId = getSecureDojoId(req);
        const { mitglied_id, amount, description, currency = 'eur', rechnung_id, reference, referenceType } = req.body;

        if (!amount) {
            return res.status(400).json({
                error: 'amount is required'
            });
        }

        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (provider.constructor.name !== 'StripeDataevProvider') {
            return res.status(400).json({
                error: 'Payment intents are only available with Stripe provider'
            });
        }

        // Create payment intent
        const result = await provider.createPaymentIntentDirect({
            amount: Math.round(amount), // amount in cents
            currency: currency,
            description: description || 'Zahlung',
            metadata: {
                dojo_id: dojoId,
                mitglied_id: mitglied_id,
                rechnung_id: rechnung_id,
                reference: reference,
                referenceType: referenceType
            }
        });

        res.json({
            client_secret: result.client_secret,
            payment_intent_id: result.id,
            status: result.status
        });

    } catch (error) {
        logger.error('API: Error creating payment intent:', { error: error });
        res.status(500).json({
            error: 'Fehler beim Erstellen des Payment Intent',
            details: error.message
        });
    }
});

// Stripe webhook handler
router.post('/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        if (endpointSecret) {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } else {
            event = JSON.parse(req.body.toString());
        }

        // Get dojoId from metadata if available
        const dojoId = event.data?.object?.metadata?.dojo_id || 1;
        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (provider.constructor.name === 'StripeDataevProvider') {
            await provider.handleWebhook(event);
        }
        res.json({received: true});

    } catch (error) {
        logger.error('API: Error processing webhook:', { error: error });
        res.status(400).json({
            error: 'Webhook processing failed',
            details: error.message
        });
    }
});

// Manueller Stripe-Sync: Offene Lastschriften des letzten Monats bei Stripe abfragen
// POST /api/payment-provider/stripe/sync-lastschriften
// Body (optional): { monat, jahr, dojo_id }  — lässt man weg → letzter Monat
router.post('/stripe/sync-lastschriften', authenticateToken, async (req, res) => {
    try {
        const db = require('../db');
        const Stripe = require('stripe');
        const { decrypt } = require('../utils/encryption');

        // dojoId: JWT > Body > automatisch (erstes Dojo mit offenen Transaktionen)
        const jwtDojoId = getSecureDojoId(req);
        const bodyDojoId = req.body.dojo_id ? parseInt(req.body.dojo_id) : null;

        let dojoId = jwtDojoId || bodyDojoId;
        if (!dojoId) {
            const [[firstBatch]] = await db.promise().query(
                `SELECT b.dojo_id FROM stripe_lastschrift_transaktion t
                 JOIN stripe_lastschrift_batch b ON t.batch_id = b.batch_id
                 WHERE t.status IN ('pending', 'processing') AND t.stripe_payment_intent_id IS NOT NULL
                   AND b.dojo_id IS NOT NULL LIMIT 1`
            );
            dojoId = firstBatch?.dojo_id || null;
        }
        if (!dojoId) {
            return res.json({ success: true, message: 'Keine offenen Transaktionen gefunden', synced: 0 });
        }

        // Stripe-Key direkt aus DB laden (ohne PaymentProviderFactory-Fallback auf ManualSepa)
        const [[dojoRow]] = await db.promise().query(
            `SELECT stripe_secret_key FROM dojo WHERE id = ? AND stripe_secret_key IS NOT NULL`,
            [dojoId]
        );
        if (!dojoRow) {
            return res.status(400).json({ error: `Stripe für Dojo ${dojoId} nicht konfiguriert` });
        }
        let stripeKey;
        try { stripeKey = decrypt(dojoRow.stripe_secret_key); } catch { stripeKey = dojoRow.stripe_secret_key; }
        const stripeClient = new Stripe(stripeKey);

        // ALLE offenen processing-Transaktionen für dieses Dojo laden (alle Monate)
        const [transaktionen] = await db.promise().query(
            `SELECT t.id, t.stripe_payment_intent_id, t.beitrag_ids, t.batch_id, t.betrag, t.mitglied_id,
                    b.monat, b.jahr
             FROM stripe_lastschrift_transaktion t
             JOIN stripe_lastschrift_batch b ON t.batch_id = b.batch_id
             WHERE b.dojo_id = ?
               AND t.status IN ('pending', 'processing')
               AND t.stripe_payment_intent_id IS NOT NULL`,
            [dojoId]
        );

        if (transaktionen.length === 0) {
            return res.json({ success: true, message: 'Keine offenen Transaktionen gefunden', synced: 0 });
        }

        // Provider nur für markLastschrift-Methoden (kein stripe-Client nötig)
        const provider = await PaymentProviderFactory.getProvider(dojoId);

        const ergebnisse = { succeeded: 0, failed: 0, still_processing: 0, errors: [] };

        for (const t of transaktionen) {
            try {
                const pi = await stripeClient.paymentIntents.retrieve(t.stripe_payment_intent_id);

                if (pi.status === 'succeeded') {
                    await provider.markLastschriftTransaktionBezahlt(pi.id);
                    ergebnisse.succeeded++;
                } else if (pi.status === 'payment_failed' || pi.status === 'canceled') {
                    await provider.markLastschriftTransaktionFehlgeschlagen(pi.id);
                    ergebnisse.failed++;
                } else {
                    ergebnisse.still_processing++;
                }
            } catch (err) {
                logger.error(`Sync-Fehler für PI ${t.stripe_payment_intent_id}:`, err.message);
                ergebnisse.errors.push({ payment_intent_id: t.stripe_payment_intent_id, error: err.message });
            }
        }

        logger.info(`✅ Lastschrift-Sync Dojo ${dojoId}: ${JSON.stringify(ergebnisse)}`);
        res.json({ success: true, synced: transaktionen.length, ...ergebnisse });

    } catch (error) {
        logger.error('Fehler beim Lastschrift-Sync:', error);
        res.status(500).json({ error: 'Sync fehlgeschlagen', details: error.message });
    }
});

// Helper functions
async function getPaymentProviderLogs(limit, provider, dojoId) {
    const db = require('../db');

    return new Promise((resolve, reject) => {
        let query = `
            SELECT ppl.*, m.vorname, m.nachname
            FROM payment_provider_logs ppl
            LEFT JOIN mitglieder m ON ppl.mitglied_id = m.mitglied_id
            WHERE 1=1
        `;

        const params = [];

        if (dojoId) {
            query += ' AND ppl.dojo_id = ?';
            params.push(dojoId);
        }

        if (provider) {
            query += ' AND ppl.provider = ?';
            params.push(provider);
        }

        query += ' ORDER BY ppl.created_at DESC LIMIT ?';
        params.push(limit);

        db.query(query, params, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results || []);
        });
    });
}

// ============================================================================
// MITGLIEDER-ZAHLUNGEN — Member-initiated credit card payments
// ============================================================================

// POST /api/payment-provider/member/payment-intent
// Mitglied zahlt eigene Rechnung — Betrag wird IMMER aus DB gelesen, nie vom Frontend
router.post('/member/payment-intent', authenticateToken, async (req, res) => {
    try {
        const mitgliedId = req.user?.mitglied_id;
        const dojoId = req.user?.dojo_id;

        if (!mitgliedId) {
            return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });
        }

        const { rechnung_id, save_card = false, gdpr_consent = false } = req.body;

        if (!rechnung_id) {
            return res.status(400).json({ error: 'rechnung_id erforderlich' });
        }

        // DSGVO-Einwilligung erforderlich wenn Karte gespeichert werden soll
        if (save_card && !gdpr_consent) {
            return res.status(400).json({
                error: 'DSGVO-Einwilligung ist erforderlich, um Zahlungsdaten zu speichern'
            });
        }

        const db = require('../db');
        const pool = db.promise();

        // Rechnung aus DB laden und Eigentümerschaft prüfen (niemals Frontend-Betrag vertrauen)
        const [invoices] = await pool.query(
            `SELECT r.rechnung_id, r.betrag, r.gesamtsumme, r.status, r.rechnungsnummer,
                    r.faelligkeitsdatum, m.stripe_customer_id, m.vorname, m.nachname
             FROM rechnungen r
             JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
             WHERE r.rechnung_id = ?
               AND r.mitglied_id = ?
               AND r.status IN ('offen','teilweise_bezahlt','ueberfaellig')
               AND r.archiviert = 0`,
            [rechnung_id, mitgliedId]
        );

        if (invoices.length === 0) {
            return res.status(404).json({ error: 'Rechnung nicht gefunden oder bereits bezahlt' });
        }

        const rechnung = invoices[0];
        const amountCents = Math.round(parseFloat(rechnung.gesamtsumme || rechnung.betrag) * 100);

        if (amountCents < 50) {
            return res.status(400).json({ error: 'Betrag muss mindestens 0,50 € betragen' });
        }

        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (!provider.stripe) {
            return res.status(400).json({ error: 'Online-Zahlung ist für dieses Dojo nicht konfiguriert' });
        }

        // DSGVO-Einwilligung in DB speichern
        if (save_card) {
            await pool.query(
                `INSERT INTO member_payment_consents
                    (mitglied_id, dojo_id, consent_type, ip_address, user_agent)
                 VALUES (?, ?, 'save_card', ?, ?)
                 ON DUPLICATE KEY UPDATE given_at = NOW(), ip_address = VALUES(ip_address)`,
                [mitgliedId, dojoId, req.ip, req.get('user-agent') || '']
            );
        }

        // Idempotency Key: verhindert Doppelabbuchung
        const idempotencyKey = `pi-r${rechnung_id}-m${mitgliedId}-${Date.now()}`;

        const piParams = {
            amount: amountCents,
            currency: 'eur',
            description: `Rechnung ${rechnung.rechnungsnummer}`,
            automatic_payment_methods: { enabled: true },
            payment_method_options: {
                card: {
                    request_three_d_secure: 'automatic'  // PSD2/SCA: 3DS wenn Risiko es erfordert
                }
            },
            metadata: {
                dojo_id: String(dojoId),
                mitglied_id: String(mitgliedId),
                rechnung_id: String(rechnung_id),
                source: 'member_portal'
            }
        };

        // Karte für zukünftige Zahlungen speichern (Lastschrift-Ersatz)
        if (save_card) {
            piParams.setup_future_usage = 'off_session';
            // Stripe Customer sicherstellen
            if (!rechnung.stripe_customer_id) {
                const customer = await provider.stripe.customers.create({
                    name: `${rechnung.vorname} ${rechnung.nachname}`,
                    metadata: { mitglied_id: String(mitgliedId), dojo_id: String(dojoId) }
                });
                await pool.query(
                    'UPDATE mitglieder SET stripe_customer_id = ? WHERE mitglied_id = ?',
                    [customer.id, mitgliedId]
                );
                piParams.customer = customer.id;
            } else {
                piParams.customer = rechnung.stripe_customer_id;
            }
        }

        const paymentIntent = await provider.stripe.paymentIntents.create(
            piParams,
            { idempotencyKey }
        );

        logger.info(`💳 Member PI erstellt: ${paymentIntent.id} — Mitglied ${mitgliedId} — Rechnung ${rechnung_id} — ${amountCents / 100} EUR`);

        res.json({
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
            amount_cents: amountCents,
            rechnungsnummer: rechnung.rechnungsnummer,
            publishable_key: provider.dojoConfig?.stripe_publishable_key
        });

    } catch (error) {
        logger.error('Member PaymentIntent Fehler:', { error: error.message });
        res.status(500).json({ error: 'Fehler beim Erstellen der Zahlung', details: error.message });
    }
});

// POST /api/payment-provider/member/setup-intent
// Mitglied speichert Kreditkarte für zukünftige Zahlungen (SetupIntent)
router.post('/member/setup-intent', authenticateToken, async (req, res) => {
    try {
        const mitgliedId = req.user?.mitglied_id;
        const dojoId = req.user?.dojo_id;

        if (!mitgliedId) {
            return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });
        }

        const { gdpr_consent } = req.body;

        if (!gdpr_consent) {
            return res.status(400).json({
                error: 'DSGVO-Einwilligung ist erforderlich, um Zahlungsdaten zu speichern'
            });
        }

        const db = require('../db');
        const pool = db.promise();

        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (!provider.stripe) {
            return res.status(400).json({ error: 'Stripe ist für dieses Dojo nicht konfiguriert' });
        }

        // Mitglied aus DB laden
        const [[mitglied]] = await pool.query(
            'SELECT mitglied_id, vorname, nachname, email, stripe_customer_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
            [mitgliedId, dojoId]
        );

        if (!mitglied) {
            return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        }

        // Stripe Customer anlegen falls nicht vorhanden
        let customerId = mitglied.stripe_customer_id;
        if (!customerId) {
            const customer = await provider.stripe.customers.create({
                name: `${mitglied.vorname} ${mitglied.nachname}`,
                email: mitglied.email || undefined,
                metadata: { mitglied_id: String(mitgliedId), dojo_id: String(dojoId) }
            });
            customerId = customer.id;
            await pool.query(
                'UPDATE mitglieder SET stripe_customer_id = ? WHERE mitglied_id = ?',
                [customerId, mitgliedId]
            );
        }

        // DSGVO-Einwilligung speichern
        await pool.query(
            `INSERT INTO member_payment_consents
                (mitglied_id, dojo_id, consent_type, ip_address, user_agent)
             VALUES (?, ?, 'save_card', ?, ?)
             ON DUPLICATE KEY UPDATE given_at = NOW(), ip_address = VALUES(ip_address)`,
            [mitgliedId, dojoId, req.ip, req.get('user-agent') || '']
        );

        // SetupIntent mit Idempotency Key
        const idempotencyKey = `si-m${mitgliedId}-${Date.now()}`;

        const setupIntent = await provider.stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
            usage: 'off_session',
            metadata: {
                dojo_id: String(dojoId),
                mitglied_id: String(mitgliedId),
                source: 'member_portal'
            }
        }, { idempotencyKey });

        logger.info(`🔐 SetupIntent erstellt: ${setupIntent.id} — Mitglied ${mitgliedId}`);

        res.json({
            client_secret: setupIntent.client_secret,
            setup_intent_id: setupIntent.id,
            publishable_key: provider.dojoConfig?.stripe_publishable_key
        });

    } catch (error) {
        logger.error('SetupIntent Fehler:', { error: error.message });
        res.status(500).json({ error: 'Fehler beim Einrichten der Zahlungsmethode', details: error.message });
    }
});

// GET /api/payment-provider/member/payment-methods
// Mitglied ruft seine gespeicherten Zahlungsmethoden ab
router.get('/member/payment-methods', authenticateToken, async (req, res) => {
    try {
        const mitgliedId = req.user?.mitglied_id;
        const dojoId = req.user?.dojo_id;

        if (!mitgliedId) {
            return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });
        }

        const db = require('../db');
        const [[mitglied]] = await db.promise().query(
            'SELECT stripe_customer_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
            [mitgliedId, dojoId]
        );

        if (!mitglied?.stripe_customer_id) {
            return res.json({ payment_methods: [] });
        }

        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (!provider.stripe) {
            return res.json({ payment_methods: [] });
        }

        const methods = await provider.stripe.paymentMethods.list({
            customer: mitglied.stripe_customer_id,
            type: 'card'
        });

        const formatted = methods.data.map(pm => ({
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
            fingerprint: pm.card.fingerprint,
            country: pm.card.country,
            wallet: pm.card.wallet?.type || null,
            created: pm.created
        }));

        res.json({ payment_methods: formatted });

    } catch (error) {
        logger.error('PaymentMethods abrufen Fehler:', { error: error.message });
        res.status(500).json({ error: 'Fehler beim Abrufen der Zahlungsmethoden', details: error.message });
    }
});

// DELETE /api/payment-provider/member/payment-methods/:pmId
// Mitglied löscht gespeicherte Karte
router.delete('/member/payment-methods/:pmId', authenticateToken, async (req, res) => {
    try {
        const mitgliedId = req.user?.mitglied_id;
        const dojoId = req.user?.dojo_id;
        const { pmId } = req.params;

        if (!mitgliedId) {
            return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });
        }

        if (!pmId || !pmId.startsWith('pm_')) {
            return res.status(400).json({ error: 'Ungültige Payment Method ID' });
        }

        const db = require('../db');
        const [[mitglied]] = await db.promise().query(
            'SELECT stripe_customer_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
            [mitgliedId, dojoId]
        );

        if (!mitglied?.stripe_customer_id) {
            return res.status(404).json({ error: 'Keine Zahlungsmethoden hinterlegt' });
        }

        const provider = await PaymentProviderFactory.getProvider(dojoId);

        // Sicherheitsprüfung: Karte gehört wirklich diesem Kunden?
        const pm = await provider.stripe.paymentMethods.retrieve(pmId);
        if (pm.customer !== mitglied.stripe_customer_id) {
            return res.status(403).json({ error: 'Zugriff verweigert' });
        }

        await provider.stripe.paymentMethods.detach(pmId);

        logger.info(`🗑 PaymentMethod ${pmId} entfernt — Mitglied ${mitgliedId}`);
        res.json({ success: true, message: 'Zahlungsmethode erfolgreich entfernt' });

    } catch (error) {
        logger.error('PaymentMethod löschen Fehler:', { error: error.message });
        res.status(500).json({ error: 'Fehler beim Entfernen der Zahlungsmethode', details: error.message });
    }
});

// POST /api/payment-provider/refund
// Admin erstattet eine Zahlung zurück
router.post('/refund', authenticateToken, async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { payment_intent_id, amount_cents, reason = 'requested_by_customer', rechnung_id } = req.body;

        if (!payment_intent_id) {
            return res.status(400).json({ error: 'payment_intent_id erforderlich' });
        }

        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (!provider.stripe) {
            return res.status(400).json({ error: 'Stripe nicht konfiguriert' });
        }

        // Sicherheitsprüfung: PI gehört zu diesem Dojo
        const db = require('../db');
        const [piRows] = await db.promise().query(
            'SELECT id, amount FROM stripe_payment_intents WHERE stripe_payment_intent_id = ? AND dojo_id = ?',
            [payment_intent_id, dojoId]
        );

        if (piRows.length === 0) {
            return res.status(403).json({ error: 'Payment Intent nicht gefunden oder kein Zugriff' });
        }

        const refundParams = {
            payment_intent: payment_intent_id,
            reason: reason
        };

        // Teilerstattung wenn amount_cents angegeben
        if (amount_cents && amount_cents > 0) {
            refundParams.amount = Math.round(amount_cents);
        }

        const refund = await provider.stripe.refunds.create(refundParams);

        logger.info(`💸 Rückerstattung: ${refund.id} — PI: ${payment_intent_id} — ${refund.amount / 100} EUR`);

        // Rechnung zurücksetzen falls vollständige Erstattung
        if (rechnung_id && (!amount_cents || amount_cents >= piRows[0].amount)) {
            await db.promise().query(
                "UPDATE rechnungen SET status = 'offen', bezahlt_am = NULL WHERE rechnung_id = ? AND dojo_id = ?",
                [rechnung_id, dojoId]
            );
        }

        res.json({
            success: true,
            refund_id: refund.id,
            amount_refunded: refund.amount,
            status: refund.status
        });

    } catch (error) {
        logger.error('Refund Fehler:', { error: error.message });
        res.status(500).json({ error: 'Fehler bei der Rückerstattung', details: error.message });
    }
});

module.exports = router;
