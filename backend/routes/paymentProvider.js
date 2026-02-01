const express = require('express');
const router = express.Router();
const PaymentProviderFactory = require('../services/PaymentProviderFactory');

// Get current payment provider status
router.get('/status', async (req, res) => {
    try {
        const status = await PaymentProviderFactory.getProviderStatus();
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
router.post('/configure', async (req, res) => {
    try {
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

        // Update configuration (assuming dojo ID 1 for now)
        const dojoId = 1;
        await PaymentProviderFactory.updatePaymentProvider(dojoId, req.body);

        // Get updated status
        const updatedStatus = await PaymentProviderFactory.getProviderStatus();
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
router.post('/test', async (req, res) => {
    try {
        const provider = await PaymentProviderFactory.getProvider();
        const isConfigured = await provider.isConfigured();
        const configStatus = await provider.getConfigurationStatus();

        const testResult = {
            provider_name: provider.getProviderName(),
            is_configured: isConfigured,
            configuration_details: configStatus,
            test_timestamp: new Date().toISOString()
        };

        if (provider.constructor.name === 'StripeDataevProvider' && isConfigured) {
            // Could add actual Stripe API test here
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
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const provider = req.query.provider || null;

        const logs = await getPaymentProviderLogs(limit, provider);
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
router.post('/payment-intent', async (req, res) => {
    try {
        const { mitglied_id, amount, description } = req.body;

        if (!mitglied_id || !amount) {
            return res.status(400).json({
                error: 'mitglied_id and amount are required'
            });
        }

        const provider = await PaymentProviderFactory.getProvider();

        if (provider.constructor.name !== 'StripeDataevProvider') {
            return res.status(400).json({
                error: 'Payment intents are only available with Stripe provider'
            });
        }

        // Get member data
        const memberData = await getMemberData(mitglied_id);
        if (!memberData) {
            return res.status(404).json({
                error: 'Member not found'
            });
        }

        const result = await provider.createPaymentIntent(memberData, amount, description);
        res.json(result);

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
            // Verify webhook signature in production
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } else {
            // For development, parse the body directly
            event = JSON.parse(req.body.toString());
        }

        const provider = await PaymentProviderFactory.getProvider();

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
async function getPaymentProviderLogs(limit, provider) {
    const db = require('../db');

    return new Promise((resolve, reject) => {
        let query = `
            SELECT ppl.*, m.vorname, m.nachname
            FROM payment_provider_logs ppl
            LEFT JOIN mitglieder m ON ppl.mitglied_id = m.mitglied_id
        `;

        const params = [];

        if (provider) {
            query += ' WHERE ppl.provider = ?';
            params.push(provider);
        }

        query += ' ORDER BY ppl.created_at DESC LIMIT ?';
        params.push(limit);

        db.query(query, params, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
}

async function getMemberData(mitgliedId) {
    const db = require('../db');

    return new Promise((resolve, reject) => {
        const query = `
            SELECT mitglied_id, vorname, nachname, email, strasse, plz, ort
            FROM mitglieder
            WHERE mitglied_id = ?
        `;

        db.query(query, [mitgliedId], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results[0] || null);
        });
    });
}

module.exports = router;