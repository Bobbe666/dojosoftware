// ============================================================================
// PAYPAL PAYMENT PROVIDER
// Backend/services/PayPalProvider.js
// ============================================================================

const db = require('../db');
const logger = require('../utils/logger');
const axios = require('axios');

class PayPalProvider {
    constructor(config) {
        this.config = config;
        this.name = 'PayPal';
        this.baseUrl = config.paypal_sandbox
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // ========================================================================
    // AUTHENTICATION
    // ========================================================================

    /**
     * Holt einen Access Token von PayPal
     */
    async getAccessToken() {
        // Token noch gültig?
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        const clientId = this.config.paypal_client_id;
        const clientSecret = this.config.paypal_client_secret;

        if (!clientId || !clientSecret) {
            throw new Error('PayPal Client ID und Secret sind nicht konfiguriert');
        }

        try {
            const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

            const response = await axios.post(
                `${this.baseUrl}/v1/oauth2/token`,
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = response.data.access_token;
            // Token 5 Minuten vor Ablauf erneuern
            this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);

            logger.info('✅ PayPal: Access Token erhalten');
            return this.accessToken;

        } catch (error) {
            logger.error('❌ PayPal: Fehler beim Abrufen des Access Tokens:', {
                error: error.response?.data || error.message
            });
            throw new Error('PayPal Authentifizierung fehlgeschlagen');
        }
    }

    /**
     * Macht einen authentifizierten API-Call
     */
    async apiCall(method, endpoint, data = null) {
        const token = await this.getAccessToken();

        try {
            const response = await axios({
                method,
                url: `${this.baseUrl}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'PayPal-Request-Id': `dojo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                },
                data
            });

            return response.data;

        } catch (error) {
            logger.error('❌ PayPal API Error:', {
                endpoint,
                error: error.response?.data || error.message
            });
            throw error;
        }
    }

    // ========================================================================
    // ORDERS (Einmalzahlungen)
    // ========================================================================

    /**
     * Erstellt eine PayPal Order (für Checkout)
     */
    async createOrder(orderData) {
        const { amount, currency = 'EUR', description, mitgliedId, rechnungId } = orderData;

        const payload = {
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: `R${rechnungId || Date.now()}`,
                description: description || 'Dojo Zahlung',
                custom_id: `M${mitgliedId}`,
                amount: {
                    currency_code: currency,
                    value: amount.toFixed(2)
                }
            }],
            application_context: {
                brand_name: this.config.dojoname || 'Dojo',
                locale: 'de-DE',
                landing_page: 'LOGIN',
                user_action: 'PAY_NOW',
                return_url: `${this.config.frontend_url || 'https://dojo.tda-intl.org'}/payment/success`,
                cancel_url: `${this.config.frontend_url || 'https://dojo.tda-intl.org'}/payment/cancel`
            }
        };

        try {
            const order = await this.apiCall('POST', '/v2/checkout/orders', payload);

            // In DB speichern
            await this.savePaymentIntent(order.id, mitgliedId, rechnungId, amount, 'pending');

            logger.info('✅ PayPal: Order erstellt:', { orderId: order.id });

            // Approval URL finden
            const approvalLink = order.links.find(l => l.rel === 'approve');

            return {
                success: true,
                orderId: order.id,
                approvalUrl: approvalLink?.href,
                status: order.status
            };

        } catch (error) {
            logger.error('❌ PayPal: Fehler beim Erstellen der Order:', { error: error.message });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Captured eine genehmigte Order
     */
    async captureOrder(orderId) {
        try {
            const capture = await this.apiCall('POST', `/v2/checkout/orders/${orderId}/capture`);

            // Status in DB aktualisieren
            const status = capture.status === 'COMPLETED' ? 'completed' : 'failed';
            await this.updatePaymentStatus(orderId, status, capture);

            if (capture.status === 'COMPLETED') {
                logger.info('✅ PayPal: Zahlung erfolgreich captured:', { orderId });

                // Webhook triggern
                const { triggerWebhooks } = require('./webhooks');
                if (triggerWebhooks) {
                    await triggerWebhooks('payment.received', this.config.id, {
                        provider: 'paypal',
                        order_id: orderId,
                        amount: capture.purchase_units[0]?.payments?.captures[0]?.amount?.value,
                        currency: capture.purchase_units[0]?.payments?.captures[0]?.amount?.currency_code
                    });
                }
            }

            return {
                success: capture.status === 'COMPLETED',
                status: capture.status,
                captureId: capture.purchase_units[0]?.payments?.captures[0]?.id,
                details: capture
            };

        } catch (error) {
            logger.error('❌ PayPal: Fehler beim Capturen:', { orderId, error: error.message });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // ========================================================================
    // SUBSCRIPTIONS (Wiederkehrende Zahlungen)
    // ========================================================================

    /**
     * Erstellt einen Billing Plan (Abo-Vorlage)
     */
    async createBillingPlan(planData) {
        const { name, description, amount, currency = 'EUR', interval = 'MONTH', intervalCount = 1 } = planData;

        // Zuerst ein Product erstellen
        const product = await this.apiCall('POST', '/v1/catalogs/products', {
            name: name,
            description: description || 'Mitgliedsbeitrag',
            type: 'SERVICE',
            category: 'SPORTS_AND_FITNESS'
        });

        // Dann den Billing Plan
        const plan = await this.apiCall('POST', '/v1/billing/plans', {
            product_id: product.id,
            name: name,
            description: description,
            billing_cycles: [{
                frequency: {
                    interval_unit: interval,
                    interval_count: intervalCount
                },
                tenure_type: 'REGULAR',
                sequence: 1,
                total_cycles: 0, // Unbegrenzt
                pricing_scheme: {
                    fixed_price: {
                        value: amount.toFixed(2),
                        currency_code: currency
                    }
                }
            }],
            payment_preferences: {
                auto_bill_outstanding: true,
                payment_failure_threshold: 3
            }
        });

        logger.info('✅ PayPal: Billing Plan erstellt:', { planId: plan.id });

        return {
            success: true,
            productId: product.id,
            planId: plan.id
        };
    }

    /**
     * Erstellt ein Subscription (Abo)
     */
    async createSubscription(subscriptionData) {
        const { planId, mitgliedId, email, startDate } = subscriptionData;

        const payload = {
            plan_id: planId,
            start_time: startDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            subscriber: {
                email_address: email
            },
            application_context: {
                brand_name: this.config.dojoname || 'Dojo',
                locale: 'de-DE',
                user_action: 'SUBSCRIBE_NOW',
                return_url: `${this.config.frontend_url || 'https://dojo.tda-intl.org'}/subscription/success`,
                cancel_url: `${this.config.frontend_url || 'https://dojo.tda-intl.org'}/subscription/cancel`
            }
        };

        try {
            const subscription = await this.apiCall('POST', '/v1/billing/subscriptions', payload);

            // In DB speichern
            await this.saveSubscription(subscription.id, mitgliedId, planId, 'pending');

            const approvalLink = subscription.links.find(l => l.rel === 'approve');

            return {
                success: true,
                subscriptionId: subscription.id,
                approvalUrl: approvalLink?.href,
                status: subscription.status
            };

        } catch (error) {
            logger.error('❌ PayPal: Fehler beim Erstellen des Abos:', { error: error.message });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Kündigt ein Subscription
     */
    async cancelSubscription(subscriptionId, reason = 'Kündigung durch Benutzer') {
        try {
            await this.apiCall('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, {
                reason: reason
            });

            await this.updateSubscriptionStatus(subscriptionId, 'cancelled');

            logger.info('✅ PayPal: Abo gekündigt:', { subscriptionId });

            return { success: true };

        } catch (error) {
            logger.error('❌ PayPal: Fehler beim Kündigen:', { error: error.message });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // ========================================================================
    // REFUNDS
    // ========================================================================

    /**
     * Erstellt eine Rückerstattung
     */
    async refund(captureId, amount = null, reason = '') {
        try {
            const payload = {
                note_to_payer: reason || 'Rückerstattung'
            };

            if (amount) {
                payload.amount = {
                    value: amount.toFixed(2),
                    currency_code: 'EUR'
                };
            }

            const refund = await this.apiCall('POST', `/v2/payments/captures/${captureId}/refund`, payload);

            logger.info('✅ PayPal: Rückerstattung erstellt:', { refundId: refund.id });

            return {
                success: true,
                refundId: refund.id,
                status: refund.status
            };

        } catch (error) {
            logger.error('❌ PayPal: Fehler bei Rückerstattung:', { error: error.message });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // ========================================================================
    // WEBHOOKS
    // ========================================================================

    /**
     * Verifiziert eine Webhook-Signatur
     */
    async verifyWebhookSignature(headers, body) {
        const webhookId = this.config.paypal_webhook_id;

        if (!webhookId) {
            logger.warn('⚠️ PayPal: Webhook ID nicht konfiguriert');
            return false;
        }

        try {
            const response = await this.apiCall('POST', '/v1/notifications/verify-webhook-signature', {
                auth_algo: headers['paypal-auth-algo'],
                cert_url: headers['paypal-cert-url'],
                transmission_id: headers['paypal-transmission-id'],
                transmission_sig: headers['paypal-transmission-sig'],
                transmission_time: headers['paypal-transmission-time'],
                webhook_id: webhookId,
                webhook_event: body
            });

            return response.verification_status === 'SUCCESS';

        } catch (error) {
            logger.error('❌ PayPal: Webhook-Verifikation fehlgeschlagen:', { error: error.message });
            return false;
        }
    }

    /**
     * Verarbeitet einen Webhook-Event
     */
    async handleWebhook(eventType, resource) {
        logger.info('📥 PayPal Webhook:', { eventType });

        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                await this.handlePaymentCompleted(resource);
                break;

            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.REFUNDED':
                await this.handlePaymentFailed(resource);
                break;

            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                await this.handleSubscriptionActivated(resource);
                break;

            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.EXPIRED':
                await this.handleSubscriptionCancelled(resource);
                break;

            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
                await this.handleSubscriptionPaymentFailed(resource);
                break;

            default:
                logger.info('ℹ️ PayPal: Unbekannter Webhook-Event:', { eventType });
        }
    }

    async handlePaymentCompleted(resource) {
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
            await this.updatePaymentStatus(orderId, 'completed', resource);
        }
    }

    async handlePaymentFailed(resource) {
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
            await this.updatePaymentStatus(orderId, 'failed', resource);
        }
    }

    async handleSubscriptionActivated(resource) {
        await this.updateSubscriptionStatus(resource.id, 'active');
    }

    async handleSubscriptionCancelled(resource) {
        await this.updateSubscriptionStatus(resource.id, 'cancelled');
    }

    async handleSubscriptionPaymentFailed(resource) {
        logger.warn('⚠️ PayPal: Abo-Zahlung fehlgeschlagen:', { subscriptionId: resource.id });
        // Hier könnte eine Benachrichtigung an den Admin gesendet werden
    }

    // ========================================================================
    // DATABASE HELPERS
    // ========================================================================

    async savePaymentIntent(orderId, mitgliedId, rechnungId, amount, status) {
        return new Promise((resolve, reject) => {
            db.query(`
                INSERT INTO paypal_payments (order_id, mitglied_id, rechnung_id, amount, status, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE status = ?, updated_at = NOW()
            `, [orderId, mitgliedId, rechnungId, amount, status, status], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    async updatePaymentStatus(orderId, status, details = null) {
        return new Promise((resolve, reject) => {
            db.query(`
                UPDATE paypal_payments
                SET status = ?, details = ?, updated_at = NOW()
                WHERE order_id = ?
            `, [status, details ? JSON.stringify(details) : null, orderId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    async saveSubscription(subscriptionId, mitgliedId, planId, status) {
        return new Promise((resolve, reject) => {
            db.query(`
                INSERT INTO paypal_subscriptions (subscription_id, mitglied_id, plan_id, status, created_at)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE status = ?, updated_at = NOW()
            `, [subscriptionId, mitgliedId, planId, status, status], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    async updateSubscriptionStatus(subscriptionId, status) {
        return new Promise((resolve, reject) => {
            db.query(`
                UPDATE paypal_subscriptions
                SET status = ?, updated_at = NOW()
                WHERE subscription_id = ?
            `, [status, subscriptionId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    // ========================================================================
    // STATUS & CONFIGURATION
    // ========================================================================

    async getStatus() {
        try {
            // Test API-Zugang
            await this.getAccessToken();

            return {
                configured: true,
                connected: true,
                sandbox: this.config.paypal_sandbox || false,
                message: 'PayPal ist verbunden'
            };

        } catch (error) {
            return {
                configured: !!(this.config.paypal_client_id && this.config.paypal_client_secret),
                connected: false,
                error: error.message
            };
        }
    }
}

module.exports = PayPalProvider;
