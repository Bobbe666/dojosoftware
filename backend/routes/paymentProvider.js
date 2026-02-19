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

module.exports = router;
