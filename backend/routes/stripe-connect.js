const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');

// Platform Stripe Client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper für DB-Queries als Promise
const queryAsync = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
};

/**
 * GET /stripe-connect/authorize
 * Startet den OAuth-Flow für Stripe Connect
 */
router.get('/authorize', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.dojo_id || req.user?.dojo_id;

        if (!dojoId) {
            return res.status(400).json({ error: 'dojo_id erforderlich' });
        }

        // Prüfe ob Dojo existiert
        const dojoResult = await queryAsync('SELECT id, dojoname FROM dojo WHERE id = ?', [dojoId]);
        if (dojoResult.length === 0) {
            return res.status(404).json({ error: 'Dojo nicht gefunden' });
        }

        // Generiere sicheren State-Parameter
        const state = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 Minuten

        // Speichere State in DB
        await queryAsync(
            `INSERT INTO stripe_connect_oauth_states (dojo_id, state, expires_at)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE state = VALUES(state), expires_at = VALUES(expires_at), used = FALSE`,
            [dojoId, state, expiresAt]
        );

        // Stripe Connect OAuth URL
        const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
        if (!clientId) {
            return res.status(500).json({ error: 'STRIPE_CONNECT_CLIENT_ID nicht konfiguriert' });
        }

        const redirectUri = `${process.env.API_BASE_URL || 'https://api.dojo-software.com'}/stripe-connect/callback`;

        const authUrl = `https://connect.stripe.com/oauth/authorize?` +
            `response_type=code&` +
            `client_id=${clientId}&` +
            `scope=read_write&` +
            `state=${state}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `stripe_user[business_type]=company&` +
            `stripe_user[country]=DE&` +
            `stripe_user[currency]=eur`;

        logger.info(`🔗 Stripe Connect OAuth gestartet für Dojo ${dojoId}`);

        res.json({
            success: true,
            authorization_url: authUrl,
            state: state
        });

    } catch (error) {
        logger.error('❌ Stripe Connect Authorize Fehler:', error);
        res.status(500).json({ error: 'Interner Serverfehler', details: error.message });
    }
});

/**
 * GET /stripe-connect/callback
 * OAuth Callback von Stripe
 */
router.get('/callback', async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        // Fehler von Stripe
        if (error) {
            logger.error(`❌ Stripe Connect OAuth Fehler: ${error} - ${error_description}`);
            return res.redirect(`${process.env.FRONTEND_URL}/dashboard/einstellungen?stripe_error=${encodeURIComponent(error_description || error)}`);
        }

        if (!code || !state) {
            return res.redirect(`${process.env.FRONTEND_URL}/dashboard/einstellungen?stripe_error=Fehlende Parameter`);
        }

        // Validiere State
        const stateResult = await queryAsync(
            `SELECT * FROM stripe_connect_oauth_states
             WHERE state = ? AND expires_at > NOW() AND used = FALSE`,
            [state]
        );

        if (stateResult.length === 0) {
            logger.error('❌ Ungültiger oder abgelaufener OAuth State');
            return res.redirect(`${process.env.FRONTEND_URL}/dashboard/einstellungen?stripe_error=Session abgelaufen`);
        }

        const oauthState = stateResult[0];
        const dojoId = oauthState.dojo_id;

        // Markiere State als verwendet
        await queryAsync('UPDATE stripe_connect_oauth_states SET used = TRUE WHERE id = ?', [oauthState.id]);

        // Tausche Code gegen Access Token
        const response = await stripe.oauth.token({
            grant_type: 'authorization_code',
            code: code
        });

        const stripeAccountId = response.stripe_user_id;
        const accessToken = response.access_token;
        const refreshToken = response.refresh_token;

        // Hole Account-Details
        const account = await stripe.accounts.retrieve(stripeAccountId);

        // Speichere Connected Account
        await queryAsync(
            `INSERT INTO stripe_connect_accounts
             (dojo_id, stripe_account_id, access_token, refresh_token, connection_status,
              charges_enabled, payouts_enabled, business_type, country, default_currency, connected_at)
             VALUES (?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
             stripe_account_id = VALUES(stripe_account_id),
             access_token = VALUES(access_token),
             refresh_token = VALUES(refresh_token),
             connection_status = 'connected',
             charges_enabled = VALUES(charges_enabled),
             payouts_enabled = VALUES(payouts_enabled),
             business_type = VALUES(business_type),
             country = VALUES(country),
             default_currency = VALUES(default_currency),
             connected_at = NOW(),
             disconnected_at = NULL`,
            [
                dojoId,
                stripeAccountId,
                accessToken,
                refreshToken,
                account.charges_enabled,
                account.payouts_enabled,
                account.business_type,
                account.country,
                account.default_currency
            ]
        );

        // Update payment_provider im Dojo
        await queryAsync(
            'UPDATE dojo SET payment_provider = ? WHERE id = ?',
            ['stripe_connect', dojoId]
        );

        logger.info(`✅ Stripe Connect erfolgreich verbunden: Dojo ${dojoId} → ${stripeAccountId}`);

        // Redirect zum Frontend mit Erfolg
        res.redirect(`${process.env.FRONTEND_URL}/dashboard/einstellungen?stripe_connected=true`);

    } catch (error) {
        logger.error('❌ Stripe Connect Callback Fehler:', error);
        res.redirect(`${process.env.FRONTEND_URL}/dashboard/einstellungen?stripe_error=${encodeURIComponent(error.message)}`);
    }
});

/**
 * POST /stripe-connect/disconnect
 * Trennt Stripe Connect Verbindung
 */
router.post('/disconnect', async (req, res) => {
    try {
        const dojoId = req.body.dojo_id || req.dojo_id || req.user?.dojo_id;

        if (!dojoId) {
            return res.status(400).json({ error: 'dojo_id erforderlich' });
        }

        // Hole Connect Account
        const connectResult = await queryAsync(
            'SELECT * FROM stripe_connect_accounts WHERE dojo_id = ? AND connection_status = ?',
            [dojoId, 'connected']
        );

        if (connectResult.length === 0) {
            return res.status(404).json({ error: 'Keine aktive Stripe Connect Verbindung' });
        }

        const connectAccount = connectResult[0];

        // Optional: Bei Stripe deauthorisieren
        try {
            await stripe.oauth.deauthorize({
                client_id: process.env.STRIPE_CONNECT_CLIENT_ID,
                stripe_user_id: connectAccount.stripe_account_id
            });
        } catch (stripeError) {
            logger.warn('⚠️ Stripe Deauthorize fehlgeschlagen (evtl. bereits getrennt):', stripeError.message);
        }

        // Update DB
        await queryAsync(
            `UPDATE stripe_connect_accounts
             SET connection_status = 'disconnected', disconnected_at = NOW()
             WHERE dojo_id = ?`,
            [dojoId]
        );

        // Reset payment_provider
        await queryAsync(
            'UPDATE dojo SET payment_provider = ? WHERE id = ?',
            ['manual_sepa', dojoId]
        );

        logger.info(`🔌 Stripe Connect getrennt für Dojo ${dojoId}`);

        res.json({ success: true, message: 'Stripe Connect erfolgreich getrennt' });

    } catch (error) {
        logger.error('❌ Stripe Connect Disconnect Fehler:', error);
        res.status(500).json({ error: 'Fehler beim Trennen', details: error.message });
    }
});

/**
 * GET /stripe-connect/status
 * Prüft den Verbindungsstatus
 */
router.get('/status', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.dojo_id || req.user?.dojo_id;

        if (!dojoId) {
            return res.status(400).json({ error: 'dojo_id erforderlich' });
        }

        // Hole Connect Account aus DB
        const connectResult = await queryAsync(
            'SELECT * FROM stripe_connect_accounts WHERE dojo_id = ?',
            [dojoId]
        );

        if (connectResult.length === 0) {
            return res.json({
                connected: false,
                status: 'not_connected',
                message: 'Keine Stripe Connect Verbindung'
            });
        }

        const connectAccount = connectResult[0];

        // Bei verbundenem Account: Live-Status von Stripe abrufen
        if (connectAccount.connection_status === 'connected') {
            try {
                const account = await stripe.accounts.retrieve(connectAccount.stripe_account_id);

                // Update lokale Daten
                await queryAsync(
                    `UPDATE stripe_connect_accounts
                     SET charges_enabled = ?, payouts_enabled = ?, updated_at = NOW()
                     WHERE id = ?`,
                    [account.charges_enabled, account.payouts_enabled, connectAccount.id]
                );

                return res.json({
                    connected: true,
                    status: 'connected',
                    stripe_account_id: connectAccount.stripe_account_id,
                    charges_enabled: account.charges_enabled,
                    payouts_enabled: account.payouts_enabled,
                    business_type: account.business_type,
                    country: account.country,
                    default_currency: account.default_currency,
                    requirements: account.requirements,
                    connected_at: connectAccount.connected_at,
                    platform_fee_percent: connectAccount.platform_fee_percent,
                    platform_fee_fixed_cents: connectAccount.platform_fee_fixed_cents
                });
            } catch (stripeError) {
                logger.error('❌ Stripe Account Abruf fehlgeschlagen:', stripeError);
                return res.json({
                    connected: true,
                    status: 'error',
                    error: 'Konnte Stripe Account nicht abrufen',
                    stripe_account_id: connectAccount.stripe_account_id
                });
            }
        }

        res.json({
            connected: false,
            status: connectAccount.connection_status,
            disconnected_at: connectAccount.disconnected_at
        });

    } catch (error) {
        logger.error('❌ Stripe Connect Status Fehler:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen des Status', details: error.message });
    }
});

/**
 * GET /stripe-connect/dashboard-link
 * Generiert einen Link zum Stripe Express Dashboard
 */
router.get('/dashboard-link', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.dojo_id || req.user?.dojo_id;

        if (!dojoId) {
            return res.status(400).json({ error: 'dojo_id erforderlich' });
        }

        // Hole Connect Account
        const connectResult = await queryAsync(
            'SELECT stripe_account_id FROM stripe_connect_accounts WHERE dojo_id = ? AND connection_status = ?',
            [dojoId, 'connected']
        );

        if (connectResult.length === 0) {
            return res.status(404).json({ error: 'Keine aktive Stripe Connect Verbindung' });
        }

        // Generiere Login Link
        const loginLink = await stripe.accounts.createLoginLink(connectResult[0].stripe_account_id);

        res.json({
            success: true,
            url: loginLink.url
        });

    } catch (error) {
        logger.error('❌ Stripe Dashboard Link Fehler:', error);
        res.status(500).json({ error: 'Fehler beim Generieren des Dashboard-Links', details: error.message });
    }
});

/**
 * POST /stripe-connect/update-fees
 * Aktualisiert die Platform-Gebühren für ein Dojo
 */
router.post('/update-fees', async (req, res) => {
    try {
        const { dojo_id, fee_percent, fee_fixed_cents } = req.body;
        const dojoId = dojo_id || req.dojo_id || req.user?.dojo_id;

        if (!dojoId) {
            return res.status(400).json({ error: 'dojo_id erforderlich' });
        }

        await queryAsync(
            `UPDATE stripe_connect_accounts
             SET platform_fee_percent = ?, platform_fee_fixed_cents = ?, updated_at = NOW()
             WHERE dojo_id = ?`,
            [fee_percent || 0, fee_fixed_cents || 0, dojoId]
        );

        logger.info(`💰 Platform-Gebühren aktualisiert für Dojo ${dojoId}: ${fee_percent}% + ${fee_fixed_cents}ct`);

        res.json({ success: true });

    } catch (error) {
        logger.error('❌ Fee Update Fehler:', error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Gebühren' });
    }
});

/**
 * GET /stripe-connect/balance
 * Ruft das aktuelle Guthaben des Connected Account ab
 */
router.get('/balance', async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.dojo_id || req.user?.dojo_id;

        if (!dojoId) {
            return res.status(400).json({ error: 'dojo_id erforderlich' });
        }

        // Hole Connect Account
        const connectResult = await queryAsync(
            'SELECT stripe_account_id FROM stripe_connect_accounts WHERE dojo_id = ? AND connection_status = ?',
            [dojoId, 'connected']
        );

        if (connectResult.length === 0) {
            return res.status(404).json({ error: 'Keine aktive Stripe Connect Verbindung' });
        }

        // Hole Balance vom Connected Account
        const balance = await stripe.balance.retrieve({
            stripeAccount: connectResult[0].stripe_account_id
        });

        res.json({
            success: true,
            balance: {
                available: balance.available,
                pending: balance.pending
            }
        });

    } catch (error) {
        logger.error('❌ Balance Abruf Fehler:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen des Guthabens' });
    }
});

module.exports = router;
