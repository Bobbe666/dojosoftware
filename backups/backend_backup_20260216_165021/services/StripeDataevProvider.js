const Stripe = require('stripe');
const db = require('../db');
const logger = require('../utils/logger');

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
            logger.info(`💳 Stripe: Creating payment intent for ${mitgliedData.vorname} ${mitgliedData.nachname} - €${amount}`);

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

            logger.info(`✅ Stripe: Payment Intent created - ${paymentIntent.id}`);

            return {
                success: true,
                payment_intent_id: paymentIntent.id,
                client_secret: paymentIntent.client_secret,
                database_id: dbResult.insertId,
                publishable_key: this.dojoConfig.stripe_publishable_key
            };

        } catch (error) {
            logger.error('❌ Stripe: Error creating payment intent:', { error: error.message, stack: error.stack });
            await this.logError(mitgliedData.mitglied_id, 'create_payment_intent', error.message);
            throw error;
        }
    }

    // Direct payment intent creation without member data
    async createPaymentIntentDirect(options) {
        if (!this.stripe) {
            throw new Error('Stripe not configured for this dojo');
        }

        try {
            const { amount, currency = 'eur', description, metadata = {} } = options;

            logger.info(`💳 Stripe: Creating direct payment intent - €${amount / 100}`);

            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount),
                currency: currency,
                automatic_payment_methods: {
                    enabled: true,
                },
                metadata: {
                    ...metadata,
                    dojo_id: this.dojoConfig.id
                },
                description: description || 'Zahlung'
            });

            // Save to database if we have a mitglied_id
            if (metadata.mitglied_id) {
                await this.savePaymentIntentDirect(metadata.mitglied_id, paymentIntent, amount);
            }

            logger.info(`✅ Stripe: Payment Intent created - ${paymentIntent.id}`);

            return {
                id: paymentIntent.id,
                client_secret: paymentIntent.client_secret,
                status: paymentIntent.status,
                publishable_key: this.dojoConfig.stripe_publishable_key
            };

        } catch (error) {
            logger.error('❌ Stripe: Error creating direct payment intent:', { error: error.message });
            throw error;
        }
    }

    async savePaymentIntentDirect(mitgliedId, paymentIntent, amount) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO stripe_payment_intents (
                    dojo_id, mitglied_id, stripe_payment_intent_id, amount, currency, status,
                    description, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                this.dojoConfig.id,
                mitgliedId || null,
                paymentIntent.id,
                amount,
                paymentIntent.currency,
                paymentIntent.status,
                paymentIntent.description,
                JSON.stringify(paymentIntent.metadata)
            ];

            db.query(query, params, (err, result) => {
                if (err) {
                    logger.error('❌ Database: Error saving payment intent:', { error: err.message });
                    return reject(err);
                }
                logger.info(`✅ Database: Payment intent saved with ID ${result.insertId}`);
                resolve(result);
            });
        });
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
                    logger.error('❌ Database: Error saving payment intent:', { error: err.message, stack: err.stack });
                    return reject(err);
                }

                logger.info(`✅ Database: Payment intent saved with ID ${result.insertId}`);
                resolve(result);
            });
        });
    }

    async handleWebhook(event) {
        try {
            logger.info(`🔔 Stripe Webhook: ${event.type} - ${event.data.object.id}`);

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

                // Chargeback / Dispute Events
                case 'charge.dispute.created':
                    await this.handleDisputeCreated(event.data.object);
                    break;

                case 'charge.dispute.updated':
                    await this.handleDisputeUpdated(event.data.object);
                    break;

                case 'charge.dispute.closed':
                    await this.handleDisputeClosed(event.data.object);
                    break;

                // Refund Events
                case 'charge.refunded':
                    await this.handleChargeRefunded(event.data.object);
                    break;

                // SEPA-specific failures
                case 'payment_intent.requires_action':
                    logger.info(`ℹ️  Payment requires action: ${event.data.object.id}`);
                    break;

                case 'charge.failed':
                    await this.handleChargeFailed(event.data.object);
                    break;

                default:
                    logger.info(`ℹ️  Stripe Webhook: Unhandled event type ${event.type}`);
            }

            return { received: true };

        } catch (error) {
            logger.error('❌ Stripe Webhook: Error processing:', { error: error.message, stack: error.stack });
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

            logger.info(`✅ Payment succeeded: ${paymentIntent.id}`);

        } catch (error) {
            logger.error('❌ Error handling payment success:', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    async handlePaymentFailed(paymentIntent) {
        try {
            await this.updatePaymentIntentStatus(paymentIntent.id, 'failed');
            logger.info(`❌ Payment failed: ${paymentIntent.id}`);

            // Erstelle offene Zahlung für das Mitglied
            const mitgliedId = paymentIntent.metadata?.mitglied_id;
            if (mitgliedId) {
                await this.createOpenPaymentFromFailure(mitgliedId, paymentIntent, 'payment_failed');
            }

        } catch (error) {
            logger.error('❌ Error handling payment failure:', { error: error.message, stack: error.stack });
        }
    }

    // ============================================================================
    // CHARGEBACK / DISPUTE HANDLING
    // ============================================================================

    async handleDisputeCreated(dispute) {
        try {
            logger.warn(`⚠️ Stripe Dispute Created: ${dispute.id} - Amount: ${dispute.amount / 100} EUR`);

            // Lade die zugehörige Charge
            const chargeId = dispute.charge;
            const reason = dispute.reason || 'unknown';
            const amount = dispute.amount / 100;

            // Speichere den Dispute in der Datenbank
            await this.saveDispute(dispute);

            // Finde das Mitglied über die Charge
            const mitgliedId = await this.getMitgliedIdFromCharge(chargeId);

            if (mitgliedId) {
                // Erstelle offene Zahlung (Rücklastschrift)
                await this.createOpenPaymentFromDispute(mitgliedId, dispute);

                // Markiere Mitglied als zahlungsproblematisch
                await this.markMemberPaymentProblem(mitgliedId, 'chargeback', `Stripe Dispute: ${reason}`);

                logger.info(`✅ Dispute processed for member ${mitgliedId}`);
            } else {
                logger.warn(`⚠️ Could not find member for dispute ${dispute.id}`);
            }

        } catch (error) {
            logger.error('❌ Error handling dispute created:', { error: error.message, stack: error.stack });
        }
    }

    async handleDisputeUpdated(dispute) {
        try {
            logger.info(`ℹ️ Stripe Dispute Updated: ${dispute.id} - Status: ${dispute.status}`);

            // Update Dispute-Status in DB
            await this.updateDisputeStatus(dispute.id, dispute.status);

        } catch (error) {
            logger.error('❌ Error handling dispute update:', { error: error.message, stack: error.stack });
        }
    }

    async handleDisputeClosed(dispute) {
        try {
            const won = dispute.status === 'won';
            logger.info(`${won ? '✅' : '❌'} Stripe Dispute Closed: ${dispute.id} - Result: ${dispute.status}`);

            await this.updateDisputeStatus(dispute.id, dispute.status);

            // Wenn gewonnen, offene Zahlung entfernen
            if (won) {
                const mitgliedId = await this.getMitgliedIdFromCharge(dispute.charge);
                if (mitgliedId) {
                    await this.resolveOpenPaymentFromDispute(dispute.id, mitgliedId);
                    logger.info(`✅ Dispute won - Open payment resolved for member ${mitgliedId}`);
                }
            }

        } catch (error) {
            logger.error('❌ Error handling dispute closed:', { error: error.message, stack: error.stack });
        }
    }

    async handleChargeRefunded(charge) {
        try {
            const refundAmount = charge.amount_refunded / 100;
            logger.info(`💸 Stripe Charge Refunded: ${charge.id} - Amount: ${refundAmount} EUR`);

            const mitgliedId = charge.metadata?.mitglied_id;
            if (mitgliedId) {
                // Bei Refund keine offene Zahlung erstellen, aber loggen
                await this.logPaymentEvent(mitgliedId, 'refund', refundAmount, charge.id);
            }

        } catch (error) {
            logger.error('❌ Error handling refund:', { error: error.message, stack: error.stack });
        }
    }

    async handleChargeFailed(charge) {
        try {
            logger.warn(`❌ Stripe Charge Failed: ${charge.id} - Reason: ${charge.failure_message || 'unknown'}`);

            const mitgliedId = charge.metadata?.mitglied_id;
            if (mitgliedId) {
                await this.createOpenPaymentFromFailure(mitgliedId, {
                    id: charge.id,
                    amount: charge.amount,
                    metadata: charge.metadata
                }, 'charge_failed');

                // Bei bestimmten Fehlern Zahlungsmethode deaktivieren
                const criticalErrors = ['card_declined', 'expired_card', 'insufficient_funds'];
                if (criticalErrors.includes(charge.failure_code)) {
                    await this.markMemberPaymentProblem(mitgliedId, 'payment_method_invalid', charge.failure_message);
                }
            }

        } catch (error) {
            logger.error('❌ Error handling charge failed:', { error: error.message, stack: error.stack });
        }
    }

    // ============================================================================
    // HELPER METHODS FOR DISPUTES/CHARGEBACKS
    // ============================================================================

    async saveDispute(dispute) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO stripe_disputes (
                    stripe_dispute_id, stripe_charge_id, amount, currency, reason,
                    status, evidence_due_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()
            `;

            const params = [
                dispute.id,
                dispute.charge,
                dispute.amount,
                dispute.currency,
                dispute.reason,
                dispute.status,
                dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : null
            ];

            db.query(query, params, (err, result) => {
                if (err) {
                    logger.error('❌ Error saving dispute:', { error: err.message });
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    async updateDisputeStatus(disputeId, status) {
        return new Promise((resolve, reject) => {
            db.query(
                'UPDATE stripe_disputes SET status = ?, updated_at = NOW() WHERE stripe_dispute_id = ?',
                [status, disputeId],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });
    }

    async getMitgliedIdFromCharge(chargeId) {
        return new Promise((resolve, reject) => {
            // Zuerst in stripe_payment_intents suchen
            const query = `
                SELECT spi.mitglied_id
                FROM stripe_payment_intents spi
                WHERE spi.stripe_payment_intent_id IN (
                    SELECT metadata->>'$.payment_intent' FROM stripe_webhooks
                    WHERE webhook_data LIKE ?
                )
                LIMIT 1
            `;

            // Fallback: Direkt in den Webhooks suchen
            db.query(
                `SELECT webhook_data FROM stripe_webhooks WHERE webhook_data LIKE ? LIMIT 1`,
                [`%${chargeId}%`],
                (err, results) => {
                    if (err) return reject(err);
                    if (results.length > 0) {
                        try {
                            const data = JSON.parse(results[0].webhook_data);
                            const mitgliedId = data.data?.object?.metadata?.mitglied_id;
                            resolve(mitgliedId || null);
                        } catch (e) {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    async createOpenPaymentFromDispute(mitgliedId, dispute) {
        const amount = dispute.amount / 100;
        const reason = dispute.reason || 'chargeback';

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO offene_zahlungen (
                    mitglied_id, dojo_id, betrag, typ, status, beschreibung,
                    referenz, erstellt_am
                ) VALUES (?, ?, ?, 'ruecklastschrift', 'offen', ?, ?, NOW())
            `;

            const beschreibung = `Stripe Chargeback: ${this.getDisputeReasonText(reason)} (${dispute.id})`;

            db.query(query, [mitgliedId, this.dojoConfig.id, amount, beschreibung, dispute.id], (err, result) => {
                if (err) {
                    logger.error('❌ Error creating open payment from dispute:', { error: err.message });
                    return reject(err);
                }
                logger.info(`✅ Created open payment for dispute ${dispute.id}`);
                resolve(result);
            });
        });
    }

    async createOpenPaymentFromFailure(mitgliedId, paymentData, failureType) {
        const amount = (paymentData.amount || 0) / 100;

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO offene_zahlungen (
                    mitglied_id, dojo_id, betrag, typ, status, beschreibung,
                    referenz, erstellt_am
                ) VALUES (?, ?, ?, 'fehlgeschlagen', 'offen', ?, ?, NOW())
            `;

            const beschreibung = `Stripe Zahlung fehlgeschlagen: ${failureType} (${paymentData.id})`;

            db.query(query, [mitgliedId, this.dojoConfig.id, amount, beschreibung, paymentData.id], (err, result) => {
                if (err) {
                    // Ignoriere Duplikate
                    if (err.code !== 'ER_DUP_ENTRY') {
                        logger.error('❌ Error creating open payment from failure:', { error: err.message });
                    }
                    return reject(err);
                }
                logger.info(`✅ Created open payment for failed payment ${paymentData.id}`);
                resolve(result);
            });
        });
    }

    async resolveOpenPaymentFromDispute(disputeId, mitgliedId) {
        return new Promise((resolve, reject) => {
            db.query(
                `UPDATE offene_zahlungen SET status = 'erledigt', bearbeitet_am = NOW()
                 WHERE referenz = ? AND mitglied_id = ?`,
                [disputeId, mitgliedId],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });
    }

    async markMemberPaymentProblem(mitgliedId, problemType, details) {
        return new Promise((resolve, reject) => {
            // Update Mitglied-Status
            db.query(
                `UPDATE mitglieder SET zahlungsproblem = 1, zahlungsproblem_details = ?, zahlungsproblem_datum = NOW()
                 WHERE mitglied_id = ?`,
                [`${problemType}: ${details}`, mitgliedId],
                (err, result) => {
                    if (err) {
                        // Spalte existiert eventuell nicht
                        logger.warn('⚠️ Could not mark payment problem - column may not exist');
                        return resolve(null);
                    }
                    logger.info(`⚠️ Member ${mitgliedId} marked with payment problem: ${problemType}`);
                    resolve(result);
                }
            );
        });
    }

    async logPaymentEvent(mitgliedId, eventType, amount, referenz) {
        return new Promise((resolve, reject) => {
            db.query(
                `INSERT INTO payment_provider_logs (dojo_id, mitglied_id, provider, action, status, message)
                 VALUES (?, ?, 'stripe', ?, 'info', ?)`,
                [this.dojoConfig.id, mitgliedId, eventType, `Amount: ${amount} EUR, Ref: ${referenz}`],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });
    }

    getDisputeReasonText(reason) {
        const reasons = {
            'bank_cannot_process': 'Bank kann nicht verarbeiten',
            'check_returned': 'Scheck zurückgegeben',
            'credit_not_processed': 'Gutschrift nicht verarbeitet',
            'customer_initiated': 'Vom Kunden initiiert',
            'debit_not_authorized': 'Lastschrift nicht autorisiert',
            'duplicate': 'Doppelte Buchung',
            'fraudulent': 'Betrugsverdacht',
            'general': 'Allgemein',
            'incorrect_account_details': 'Falsche Kontodaten',
            'insufficient_funds': 'Deckung nicht ausreichend',
            'product_not_received': 'Produkt nicht erhalten',
            'product_unacceptable': 'Produkt nicht akzeptabel',
            'subscription_canceled': 'Abo gekündigt',
            'unrecognized': 'Nicht erkannt'
        };
        return reasons[reason] || reason;
    }

    async handleSetupIntentSucceeded(setupIntent) {
        // Placeholder for setup intent handling
        logger.info(`✅ Setup Intent succeeded: ${setupIntent.id}`);
    }

    async exportToDatev(paymentIntentData) {
        try {
            logger.info(`📊 DATEV: Starting export for payment ${paymentIntentData.stripe_payment_intent_id}`);

            // Create DATEV export entry
            const exportId = await this.createDatevExportEntry(paymentIntentData.id);

            // TODO: Implement actual DATEV API call
            // For now, simulate the export
            const datevResult = await this.simulateDatevExport(paymentIntentData);

            // Update export status
            await this.updateDatevExportStatus(exportId, 'success', datevResult);

            logger.info(`✅ DATEV: Export completed for payment ${paymentIntentData.stripe_payment_intent_id}`);

            return datevResult;

        } catch (error) {
            logger.error('❌ DATEV: Export failed:', { error: error.message, stack: error.stack });
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

        logger.info(`📊 DATEV Simulation: ${JSON.stringify(exportData, null, 2)}`);

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
                logger.error('❌ Failed to log error:', { error: err.message, stack: err.stack });
            }
        });
    }

    // ============================================================================
    // SEPA LASTSCHRIFT BATCH METHODS
    // ============================================================================

    /**
     * Erstellt einen Stripe Customer mit SEPA PaymentMethod für ein Mitglied
     * @param {Object} mitglied - Mitglied-Daten mit vorname, nachname, email
     * @param {string} iban - IBAN des Bankkontos
     * @param {string} kontoinhaber - Name des Kontoinhabers
     * @returns {Object} - Stripe Customer und PaymentMethod IDs
     */
    async createSepaCustomer(mitglied, iban, kontoinhaber) {
        if (!this.stripe) {
            throw new Error('Stripe nicht konfiguriert für dieses Dojo');
        }

        try {
            logger.info(`💳 Stripe SEPA: Erstelle Customer für ${mitglied.vorname} ${mitglied.nachname}`);

            // 1. Prüfe ob bereits ein Stripe Customer existiert
            let customerId = mitglied.stripe_customer_id;

            if (!customerId) {
                // Erstelle neuen Stripe Customer
                const customer = await this.stripe.customers.create({
                    email: mitglied.email || `mitglied_${mitglied.mitglied_id}@placeholder.local`,
                    name: `${mitglied.vorname} ${mitglied.nachname}`,
                    metadata: {
                        mitglied_id: mitglied.mitglied_id.toString(),
                        dojo_id: this.dojoConfig.id.toString()
                    }
                });
                customerId = customer.id;

                // Speichere Customer ID beim Mitglied
                await this.updateMitgliedStripeCustomerId(mitglied.mitglied_id, customerId);
                logger.info(`✅ Stripe Customer erstellt: ${customerId}`);
            } else {
                logger.info(`ℹ️  Verwende existierenden Stripe Customer: ${customerId}`);
            }

            // 2. Erstelle SEPA PaymentMethod
            const paymentMethod = await this.stripe.paymentMethods.create({
                type: 'sepa_debit',
                sepa_debit: {
                    iban: iban.replace(/\s/g, '') // Entferne Leerzeichen
                },
                billing_details: {
                    name: kontoinhaber || `${mitglied.vorname} ${mitglied.nachname}`,
                    email: mitglied.email || `mitglied_${mitglied.mitglied_id}@placeholder.local`
                }
            });

            // 3. Hänge PaymentMethod an Customer an
            await this.stripe.paymentMethods.attach(paymentMethod.id, {
                customer: customerId
            });

            // 4. Setze als Standard-Zahlungsmethode
            await this.stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethod.id
                }
            });

            // 5. Speichere PaymentMethod ID in sepa_mandate
            await this.updateSepaMandateStripeIds(mitglied.mitglied_id, paymentMethod.id, null);

            logger.info(`✅ SEPA PaymentMethod erstellt und angehängt: ${paymentMethod.id}`);

            return {
                success: true,
                stripe_customer_id: customerId,
                stripe_payment_method_id: paymentMethod.id
            };

        } catch (error) {
            logger.error('❌ Stripe SEPA Setup Fehler:', {
                error: error.message,
                mitglied_id: mitglied.mitglied_id
            });
            throw error;
        }
    }

    /**
     * Führt eine SEPA-Lastschrift für ein Mitglied durch
     * @param {number} mitgliedId - ID des Mitglieds
     * @param {number} amount - Betrag in EUR
     * @param {string} description - Beschreibung für die Zahlung
     * @param {Array<number>} beitragIds - Array der Beitrags-IDs
     * @returns {Object} - PaymentIntent Details
     */
    async chargeSepaDirectDebit(mitgliedId, amount, description, beitragIds = []) {
        if (!this.stripe) {
            throw new Error('Stripe nicht konfiguriert für dieses Dojo');
        }

        try {
            // Lade Mitglied mit Stripe-Daten
            const mitglied = await this.getMitgliedWithStripeData(mitgliedId);

            if (!mitglied) {
                throw new Error(`Mitglied ${mitgliedId} nicht gefunden`);
            }
            if (!mitglied.stripe_customer_id) {
                throw new Error(`Mitglied ${mitgliedId} hat keinen Stripe Customer`);
            }
            if (!mitglied.stripe_payment_method_id) {
                throw new Error(`Mitglied ${mitgliedId} hat keine SEPA PaymentMethod`);
            }

            logger.info(`💳 Stripe SEPA: Lastschrift für ${mitglied.vorname} ${mitglied.nachname} - €${amount}`);

            // Erstelle PaymentIntent mit off_session (keine Kundeninteraktion)
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // In Cents
                currency: 'eur',
                customer: mitglied.stripe_customer_id,
                payment_method: mitglied.stripe_payment_method_id,
                payment_method_types: ['sepa_debit'],
                confirm: true,
                off_session: true,
                mandate_data: {
                    customer_acceptance: {
                        type: 'offline'
                    }
                },
                description: description || `Mitgliedsbeitrag ${mitglied.vorname} ${mitglied.nachname}`,
                metadata: {
                    mitglied_id: mitgliedId.toString(),
                    dojo_id: this.dojoConfig.id.toString(),
                    beitrag_ids: JSON.stringify(beitragIds),
                    member_name: `${mitglied.vorname} ${mitglied.nachname}`
                }
            });

            logger.info(`✅ PaymentIntent erstellt: ${paymentIntent.id} - Status: ${paymentIntent.status}`);

            return {
                success: true,
                payment_intent_id: paymentIntent.id,
                status: paymentIntent.status,
                amount: amount,
                mitglied_id: mitgliedId
            };

        } catch (error) {
            logger.error('❌ Stripe SEPA Lastschrift Fehler:', {
                error: error.message,
                code: error.code,
                mitglied_id: mitgliedId
            });

            // Bei bestimmten Fehlern spezifische Meldung
            if (error.code === 'payment_intent_authentication_failure') {
                error.userMessage = 'Authentifizierung erforderlich - Kunde muss Zahlung bestätigen';
            } else if (error.code === 'payment_method_invalid') {
                error.userMessage = 'Zahlungsmethode ungültig - SEPA-Mandat neu einrichten';
            }

            throw error;
        }
    }

    /**
     * Verarbeitet einen Batch von Lastschriften
     * @param {Array} mitgliederMitBeitraegen - Array mit Mitgliedern und deren offenen Beiträgen
     * @param {number} monat - Abrechnungsmonat
     * @param {number} jahr - Abrechnungsjahr
     * @returns {Object} - Batch-Ergebnis mit erfolgreichen und fehlgeschlagenen Transaktionen
     */
    async processLastschriftBatch(mitgliederMitBeitraegen, monat, jahr) {
        if (!this.stripe) {
            throw new Error('Stripe nicht konfiguriert für dieses Dojo');
        }

        const batchId = `BATCH-${this.dojoConfig.id}-${jahr}${String(monat).padStart(2, '0')}-${Date.now()}`;

        logger.info(`📦 Stripe Lastschrift-Batch gestartet: ${batchId}`);
        logger.info(`   Anzahl Mitglieder: ${mitgliederMitBeitraegen.length}`);

        // Erstelle Batch-Eintrag
        await this.createBatchEntry(batchId, monat, jahr, mitgliederMitBeitraegen);

        const results = {
            batch_id: batchId,
            total: mitgliederMitBeitraegen.length,
            succeeded: 0,
            failed: 0,
            processing: 0,
            transactions: []
        };

        // Verarbeite jeden Mitglied
        for (const item of mitgliederMitBeitraegen) {
            try {
                const beitragIds = item.beitraege ? item.beitraege.map(b => b.beitrag_id) : [];
                const description = `Mitgliedsbeitrag ${monat}/${jahr} - ${item.offene_monate || ''}`;

                const result = await this.chargeSepaDirectDebit(
                    item.mitglied_id,
                    item.betrag,
                    description,
                    beitragIds
                );

                // Speichere Transaktion
                await this.saveTransaktion(batchId, item.mitglied_id, result.payment_intent_id, beitragIds, item.betrag, result.status);

                // SEPA ist initially 'processing'
                if (result.status === 'succeeded') {
                    results.succeeded++;
                } else if (result.status === 'processing') {
                    results.processing++;
                }

                results.transactions.push({
                    mitglied_id: item.mitglied_id,
                    name: item.name,
                    betrag: item.betrag,
                    status: result.status,
                    payment_intent_id: result.payment_intent_id
                });

            } catch (error) {
                results.failed++;

                // Speichere fehlgeschlagene Transaktion
                await this.saveTransaktion(batchId, item.mitglied_id, null, [], item.betrag, 'failed', error.message);

                results.transactions.push({
                    mitglied_id: item.mitglied_id,
                    name: item.name,
                    betrag: item.betrag,
                    status: 'failed',
                    error: error.userMessage || error.message
                });
            }
        }

        // Update Batch-Status
        const finalStatus = results.failed === results.total ? 'failed'
            : results.succeeded + results.processing === results.total ? 'completed'
            : 'partial';

        await this.updateBatchStatus(batchId, finalStatus, results.succeeded, results.failed);

        logger.info(`✅ Batch ${batchId} abgeschlossen: ${results.succeeded} erfolgreich, ${results.processing} in Verarbeitung, ${results.failed} fehlgeschlagen`);

        return results;
    }

    // ============================================================================
    // HELPER METHODS FOR SEPA LASTSCHRIFT
    // ============================================================================

    async updateMitgliedStripeCustomerId(mitgliedId, customerId) {
        return new Promise((resolve, reject) => {
            db.query(
                'UPDATE mitglieder SET stripe_customer_id = ? WHERE mitglied_id = ?',
                [customerId, mitgliedId],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });
    }

    async updateSepaMandateStripeIds(mitgliedId, paymentMethodId, mandateId) {
        return new Promise((resolve, reject) => {
            db.query(
                `UPDATE sepa_mandate
                 SET stripe_payment_method_id = ?, stripe_mandate_id = ?
                 WHERE mitglied_id = ? AND status = 'aktiv'`,
                [paymentMethodId, mandateId, mitgliedId],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });
    }

    async getMitgliedWithStripeData(mitgliedId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    m.mitglied_id, m.vorname, m.nachname, m.email,
                    m.stripe_customer_id,
                    sm.stripe_payment_method_id, sm.iban, sm.kontoinhaber
                FROM mitglieder m
                LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
                WHERE m.mitglied_id = ?
            `;
            db.query(query, [mitgliedId], (err, results) => {
                if (err) return reject(err);
                resolve(results[0] || null);
            });
        });
    }

    async createBatchEntry(batchId, monat, jahr, mitglieder) {
        const gesamtbetrag = mitglieder.reduce((sum, m) => sum + parseFloat(m.betrag || 0), 0);

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO stripe_lastschrift_batch
                (batch_id, dojo_id, monat, jahr, anzahl_transaktionen, gesamtbetrag, status)
                VALUES (?, ?, ?, ?, ?, ?, 'processing')
            `;
            db.query(query, [batchId, this.dojoConfig.id, monat, jahr, mitglieder.length, gesamtbetrag], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    async saveTransaktion(batchId, mitgliedId, paymentIntentId, beitragIds, betrag, status, errorMessage = null) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO stripe_lastschrift_transaktion
                (batch_id, mitglied_id, stripe_payment_intent_id, beitrag_ids, betrag, status, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            db.query(query, [batchId, mitgliedId, paymentIntentId, JSON.stringify(beitragIds), betrag, status, errorMessage], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    async updateBatchStatus(batchId, status, erfolgreiche, fehlgeschlagene) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE stripe_lastschrift_batch
                SET status = ?, erfolgreiche = ?, fehlgeschlagene = ?, completed_at = NOW()
                WHERE batch_id = ?
            `;
            db.query(query, [status, erfolgreiche, fehlgeschlagene, batchId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    async getBatchStatus(batchId) {
        return new Promise((resolve, reject) => {
            const batchQuery = 'SELECT * FROM stripe_lastschrift_batch WHERE batch_id = ?';
            const transQuery = 'SELECT * FROM stripe_lastschrift_transaktion WHERE batch_id = ? ORDER BY id';

            db.query(batchQuery, [batchId], (err, batchResults) => {
                if (err) return reject(err);
                if (batchResults.length === 0) return resolve(null);

                db.query(transQuery, [batchId], (err2, transResults) => {
                    if (err2) return reject(err2);
                    resolve({
                        batch: batchResults[0],
                        transaktionen: transResults
                    });
                });
            });
        });
    }

    /**
     * Prüft welche Mitglieder noch kein Stripe SEPA Setup haben
     * @param {Array} mitgliederIds - Array von Mitglieder-IDs
     * @returns {Object} - ready und needsSetup Arrays
     */
    async checkSepaSetupStatus(mitgliederIds) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    m.mitglied_id,
                    m.vorname,
                    m.nachname,
                    m.stripe_customer_id,
                    sm.stripe_payment_method_id,
                    sm.iban
                FROM mitglieder m
                LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
                WHERE m.mitglied_id IN (?)
            `;
            db.query(query, [mitgliederIds], (err, results) => {
                if (err) return reject(err);

                const ready = [];
                const needsSetup = [];

                for (const m of results) {
                    if (m.stripe_customer_id && m.stripe_payment_method_id) {
                        ready.push(m);
                    } else if (m.iban) {
                        needsSetup.push(m);
                    }
                    // Mitglieder ohne IBAN können nicht eingerichtet werden
                }

                resolve({ ready, needsSetup });
            });
        });
    }
}

module.exports = StripeDataevProvider;