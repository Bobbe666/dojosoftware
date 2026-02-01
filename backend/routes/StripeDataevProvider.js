const Stripe = require('stripe');
const db = require('../db');

class StripeDataevProvider {
    constructor(dojoConfig) {
        this.dojoConfig = dojoConfig;
        this.stripe = null;

        if (dojoConfig.stripe_secret_key) {
            this.stripe = new Stripe(dojoConfig.stripe_secret_key);
        }
    }

    getProviderName() {
        return 'Stripe + DATEV Integration';
    }

    async isConfigured() {
        return !!(
            this.dojoConfig.stripe_secret_key &&
            this.dojoConfig.stripe_publishable_key &&
            this.dojoConfig.datev_api_key
        );
    }

    async getConfigurationStatus() {
        const status = {
            stripe_configured: !!(this.dojoConfig.stripe_secret_key && this.dojoConfig.stripe_publishable_key),
            datev_configured: !!this.dojoConfig.datev_api_key,
            consultant_number: !!this.dojoConfig.datev_consultant_number,
            client_number: !!this.dojoConfig.datev_client_number
        };

        status.fully_configured = Object.values(status).every(Boolean);
        return status;
    }

    async createPaymentIntent(mitgliedData, amount, description = null) {
        if (!this.stripe) {
            throw new Error('Stripe not configured for this dojo');
        }

        try {
            // Create Stripe Payment Intent with SEPA Direct Debit
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: 'eur',
                payment_method_types: ['sepa_debit'],
                setup_future_usage: 'off_session', // For recurring payments
                metadata: {
                    mitglied_id: mitgliedData.mitglied_id,
                    dojo_id: this.dojoConfig.id,
                    member_name: `${mitgliedData.vorname} ${mitgliedData.nachname}`
                },
                description: description || `Mitgliedsbeitrag ${mitgliedData.vorname} ${mitgliedData.nachname}`
            });

            // Save to database
            const dbResult = await this.savePaymentIntent(mitgliedData.mitglied_id, paymentIntent, amount);
            return {
                success: true,
                payment_intent_id: paymentIntent.id,
                client_secret: paymentIntent.client_secret,
                database_id: dbResult.insertId,
                publishable_key: this.dojoConfig.stripe_publishable_key
            };

        } catch (error) {
            logger.error('Stripe: Error creating payment intent:', error);
            await this.logError(mitgliedData.mitglied_id, 'create_payment_intent', error.message);
            throw error;
        }
    }

    async savePaymentIntent(mitgliedId, paymentIntent, amount) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO stripe_payment_intents (
                    mitglied_id, stripe_payment_intent_id, amount, currency, status,
                    mandate_reference, description, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                mitgliedId,
                paymentIntent.id,
                Math.round(amount * 100), // Store in cents
                paymentIntent.currency,
                paymentIntent.status,
                paymentIntent.metadata.mandate_reference || null,
                paymentIntent.description,
                JSON.stringify(paymentIntent.metadata)
            ];

            db.query(query, params, (err, result) => {
                if (err) {
                    logger.error('Database: Error saving payment intent:', err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    async handleWebhook(event) {
        try {
            // Save webhook event first
            await this.saveWebhookEvent(event);

            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;

                case 'payment_intent.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;

                case 'setup_intent.succeeded':
                    await this.handleSetupIntentSucceeded(event.data.object);
                    break;

                default:
            }

            return { received: true };

        } catch (error) {
            logger.error('Stripe Webhook: Error processing:', error);
            throw error;
        }
    }

    async handlePaymentSucceeded(paymentIntent) {
        try {
            // Update payment intent status
            await this.updatePaymentIntentStatus(paymentIntent.id, 'succeeded');

            // Trigger DATEV export
            const dbPaymentIntent = await this.getPaymentIntentFromDB(paymentIntent.id);
            if (dbPaymentIntent) {
                await this.exportToDatev(dbPaymentIntent);
            }
        } catch (error) {
            logger.error('Error handling payment success:', error);
            throw error;
        }
    }

    async handlePaymentFailed(paymentIntent) {
        try {
            await this.updatePaymentIntentStatus(paymentIntent.id, 'failed');
            // Could send notification to admin here

        } catch (error) {
            logger.error('Error handling payment failure:', error);
        }
    }

    async exportToDatev(paymentIntentData) {
        try {
            // Create DATEV export entry
            const exportId = await this.createDatevExportEntry(paymentIntentData.id);

            // TODO: Implement actual DATEV API call
            // For now, simulate the export
            const datevResult = await this.simulateDatevExport(paymentIntentData);

            // Update export status
            await this.updateDatevExportStatus(exportId, 'success', datevResult);
            return datevResult;

        } catch (error) {
            logger.error('DATEV: Export failed:', error);
            await this.updateDatevExportStatus(exportId, 'failed', null, error.message);
            throw error;
        }
    }

    async simulateDatevExport(paymentIntentData) {
        // Simulated DATEV export - replace with real DATEV API call
        const exportData = {
            booking_id: `DOJO-${Date.now()}`,
            amount: paymentIntentData.amount / 100, // Convert from cents
            account_from: '1200', // Debitor
            account_to: '1000',   // Bank
            booking_text: `Mitgliedsbeitrag via Stripe ${paymentIntentData.stripe_payment_intent_id}`,
            export_date: new Date().toISOString()
        };
        return exportData;
    }

    async createDatevExportEntry(paymentIntentId) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO datev_exports (payment_intent_id, export_status)
                VALUES (?, 'pending')
            `;

            db.query(query, [paymentIntentId], (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result.insertId);
            });
        });
    }

    async updateDatevExportStatus(exportId, status, datevResponse = null, errorMessage = null) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE datev_exports
                SET export_status = ?, datev_response = ?, error_message = ?, processed_at = NOW()
                WHERE id = ?
            `;

            const params = [
                status,
                datevResponse ? JSON.stringify(datevResponse) : null,
                errorMessage,
                exportId
            ];

            db.query(query, params, (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    async saveWebhookEvent(event) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO stripe_webhooks (stripe_event_id, event_type, webhook_data)
                VALUES (?, ?, ?)
            `;

            const params = [
                event.id,
                event.type,
                JSON.stringify(event)
            ];

            db.query(query, params, (err, result) => {
                if (err && err.code !== 'ER_DUP_ENTRY') {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    async updatePaymentIntentStatus(stripePaymentIntentId, status) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE stripe_payment_intents
                SET status = ?, updated_at = NOW()
                WHERE stripe_payment_intent_id = ?
            `;

            db.query(query, [status, stripePaymentIntentId], (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    async getPaymentIntentFromDB(stripePaymentIntentId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM stripe_payment_intents
                WHERE stripe_payment_intent_id = ?
            `;

            db.query(query, [stripePaymentIntentId], (err, results) => {
                if (err) {
                    return reject(err);
                }
                resolve(results[0] || null);
            });
        });
    }

    async logError(mitgliedId, action, message) {
        const query = `
            INSERT INTO payment_provider_logs (dojo_id, mitglied_id, provider, action, status, message)
            VALUES (?, ?, 'stripe_datev', ?, 'error', ?)
        `;

        db.query(query, [this.dojoConfig.id, mitgliedId, action, message], (err) => {
            if (err) {
                logger.error('Failed to log error:', err);
            }
        });
    }
}

module.exports = StripeDataevProvider;