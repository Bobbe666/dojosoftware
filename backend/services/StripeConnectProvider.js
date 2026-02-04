const Stripe = require('stripe');
const db = require('../db');
const logger = require('../utils/logger');

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
 * StripeConnectProvider - Payment Provider für Stripe Connect
 *
 * Verwendet den Platform Stripe Account um Zahlungen auf Connected Accounts zu verarbeiten.
 * Jedes Dojo ist ein Connected Account mit eigenem Bankkonto für Auszahlungen.
 */
class StripeConnectProvider {
    constructor(dojoConfig, connectAccount) {
        this.dojoConfig = dojoConfig;
        this.connectAccount = connectAccount;

        // Platform Stripe Client (verwendet den Platform Secret Key)
        if (process.env.STRIPE_SECRET_KEY) {
            this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        } else {
            logger.error('❌ STRIPE_SECRET_KEY nicht konfiguriert!');
        }

        this.connectedAccountId = connectAccount?.stripe_account_id;
        this.platformFeePercent = parseFloat(connectAccount?.platform_fee_percent || 0);
        this.platformFeeFixedCents = parseInt(connectAccount?.platform_fee_fixed_cents || 0);
    }

    getProviderName() {
        return 'Stripe Connect';
    }

    async isConfigured() {
        return !!(
            process.env.STRIPE_SECRET_KEY &&
            this.connectedAccountId &&
            this.connectAccount?.connection_status === 'connected' &&
            this.connectAccount?.charges_enabled
        );
    }

    async getConfigurationStatus() {
        return {
            platform_configured: !!process.env.STRIPE_SECRET_KEY,
            connected_account: !!this.connectedAccountId,
            connection_status: this.connectAccount?.connection_status || 'not_connected',
            charges_enabled: this.connectAccount?.charges_enabled || false,
            payouts_enabled: this.connectAccount?.payouts_enabled || false,
            fully_configured: await this.isConfigured()
        };
    }

    /**
     * Berechnet die Platform-Gebühr für einen Betrag
     */
    calculatePlatformFee(amountCents) {
        if (this.platformFeePercent === 0 && this.platformFeeFixedCents === 0) {
            return 0;
        }
        const percentFee = Math.round(amountCents * (this.platformFeePercent / 100));
        return percentFee + this.platformFeeFixedCents;
    }

    /**
     * Erstellt einen Stripe Customer auf dem Connected Account
     */
    async createCustomer(mitgliedData) {
        if (!this.stripe || !this.connectedAccountId) {
            throw new Error('Stripe Connect nicht konfiguriert');
        }

        try {
            logger.info(`💳 Stripe Connect: Erstelle Customer für ${mitgliedData.vorname} ${mitgliedData.nachname}`);

            const customer = await this.stripe.customers.create({
                email: mitgliedData.email,
                name: `${mitgliedData.vorname} ${mitgliedData.nachname}`,
                metadata: {
                    mitglied_id: String(mitgliedData.mitglied_id),
                    dojo_id: String(this.dojoConfig.id)
                }
            }, {
                stripeAccount: this.connectedAccountId
            });

            // Speichere Customer ID beim Mitglied
            await queryAsync(
                'UPDATE mitglieder SET stripe_customer_id = ? WHERE mitglied_id = ?',
                [customer.id, mitgliedData.mitglied_id]
            );

            logger.info(`✅ Stripe Connect: Customer erstellt - ${customer.id}`);

            return customer;

        } catch (error) {
            logger.error('❌ Stripe Connect Customer Fehler:', error);
            throw error;
        }
    }

    /**
     * Erstellt einen SEPA PaymentMethod und hängt ihn an den Customer
     */
    async createSepaPaymentMethod(customerId, iban, kontoinhaber, email) {
        if (!this.stripe || !this.connectedAccountId) {
            throw new Error('Stripe Connect nicht konfiguriert');
        }

        try {
            logger.info(`💳 Stripe Connect: Erstelle SEPA PaymentMethod für ${kontoinhaber}`);

            // Erstelle PaymentMethod
            const paymentMethod = await this.stripe.paymentMethods.create({
                type: 'sepa_debit',
                sepa_debit: { iban: iban },
                billing_details: {
                    name: kontoinhaber,
                    email: email
                }
            }, {
                stripeAccount: this.connectedAccountId
            });

            // Hänge an Customer an
            await this.stripe.paymentMethods.attach(paymentMethod.id, {
                customer: customerId
            }, {
                stripeAccount: this.connectedAccountId
            });

            // Setze als Standard
            await this.stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: paymentMethod.id }
            }, {
                stripeAccount: this.connectedAccountId
            });

            logger.info(`✅ Stripe Connect: PaymentMethod erstellt - ${paymentMethod.id}`);

            return paymentMethod;

        } catch (error) {
            logger.error('❌ Stripe Connect PaymentMethod Fehler:', error);
            throw error;
        }
    }

    /**
     * Erstellt Customer + PaymentMethod für ein Mitglied mit SEPA-Mandat
     */
    async setupSepaCustomer(mitgliedId) {
        try {
            // Lade Mitglied mit SEPA-Mandat
            const mitgliedResult = await queryAsync(`
                SELECT m.*, sm.iban, sm.kontoinhaber, sm.mandatsreferenz
                FROM mitglieder m
                JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id
                WHERE m.mitglied_id = ? AND sm.status = 'aktiv' AND sm.archiviert = 0
            `, [mitgliedId]);

            if (mitgliedResult.length === 0) {
                throw new Error(`Mitglied ${mitgliedId} nicht gefunden oder kein aktives SEPA-Mandat`);
            }

            const mitglied = mitgliedResult[0];

            // Erstelle Customer
            const customer = await this.createCustomer(mitglied);

            // Erstelle PaymentMethod
            const paymentMethod = await this.createSepaPaymentMethod(
                customer.id,
                mitglied.iban,
                mitglied.kontoinhaber,
                mitglied.email
            );

            // Speichere PaymentMethod ID im SEPA-Mandat
            await queryAsync(
                'UPDATE sepa_mandate SET stripe_payment_method_id = ? WHERE mitglied_id = ? AND status = ?',
                [paymentMethod.id, mitgliedId, 'aktiv']
            );

            return {
                success: true,
                customer_id: customer.id,
                payment_method_id: paymentMethod.id
            };

        } catch (error) {
            logger.error(`❌ Stripe Connect Setup für Mitglied ${mitgliedId} fehlgeschlagen:`, error);
            throw error;
        }
    }

    /**
     * Führt eine SEPA-Lastschrift durch (auf dem Connected Account)
     */
    async chargeSepaDirectDebit(mitgliedId, amount, description, beitragIds = []) {
        if (!this.stripe || !this.connectedAccountId) {
            throw new Error('Stripe Connect nicht konfiguriert');
        }

        try {
            // Lade Mitglied mit Customer ID und PaymentMethod
            const mitgliedResult = await queryAsync(`
                SELECT m.mitglied_id, m.vorname, m.nachname, m.email, m.stripe_customer_id,
                       sm.stripe_payment_method_id, sm.mandatsreferenz
                FROM mitglieder m
                JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id
                WHERE m.mitglied_id = ? AND sm.status = 'aktiv'
            `, [mitgliedId]);

            if (mitgliedResult.length === 0) {
                throw new Error(`Mitglied ${mitgliedId} nicht gefunden`);
            }

            const mitglied = mitgliedResult[0];

            if (!mitglied.stripe_customer_id || !mitglied.stripe_payment_method_id) {
                throw new Error(`Mitglied ${mitgliedId} hat kein Stripe SEPA Setup`);
            }

            const amountCents = Math.round(amount * 100);
            const platformFee = this.calculatePlatformFee(amountCents);

            logger.info(`💳 Stripe Connect: SEPA Lastschrift für ${mitglied.vorname} ${mitglied.nachname} - €${amount}`);

            // PaymentIntent auf Connected Account erstellen
            const paymentIntentParams = {
                amount: amountCents,
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
                metadata: {
                    mitglied_id: String(mitgliedId),
                    dojo_id: String(this.dojoConfig.id),
                    mandatsreferenz: mitglied.mandatsreferenz,
                    beitrag_ids: JSON.stringify(beitragIds),
                    member_name: `${mitglied.vorname} ${mitglied.nachname}`
                },
                description: description || `Mitgliedsbeitrag ${mitglied.vorname} ${mitglied.nachname}`
            };

            // Platform-Gebühr hinzufügen wenn > 0
            if (platformFee > 0) {
                paymentIntentParams.application_fee_amount = platformFee;
            }

            const paymentIntent = await this.stripe.paymentIntents.create(
                paymentIntentParams,
                { stripeAccount: this.connectedAccountId }
            );

            logger.info(`✅ Stripe Connect: PaymentIntent erstellt - ${paymentIntent.id} - Status: ${paymentIntent.status}`);

            // Speichere Transfer in DB
            if (platformFee > 0) {
                await queryAsync(`
                    INSERT INTO stripe_connect_transfers
                    (dojo_id, stripe_account_id, stripe_payment_intent_id, amount_total, amount_fee, amount_net, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending')
                `, [
                    this.dojoConfig.id,
                    this.connectedAccountId,
                    paymentIntent.id,
                    amountCents,
                    platformFee,
                    amountCents - platformFee
                ]);
            }

            return {
                success: true,
                payment_intent_id: paymentIntent.id,
                status: paymentIntent.status,
                amount: amount,
                platform_fee: platformFee / 100
            };

        } catch (error) {
            logger.error('❌ Stripe Connect Charge Fehler:', error);

            // Benutzerfreundliche Fehlermeldung
            const userMessage = this.getUserFriendlyError(error);
            error.userMessage = userMessage;

            throw error;
        }
    }

    /**
     * Batch-Verarbeitung für Lastschriftlauf
     */
    async processLastschriftBatch(mitgliederMitBeitraegen, monat, jahr) {
        if (!this.stripe || !this.connectedAccountId) {
            throw new Error('Stripe Connect nicht konfiguriert für dieses Dojo');
        }

        const batchId = `BATCH-${this.dojoConfig.id}-${jahr}${String(monat).padStart(2, '0')}-${Date.now()}`;

        logger.info(`📦 Stripe Connect Lastschrift-Batch gestartet: ${batchId}`);
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
                const description = `Mitgliedsbeitrag ${monat}/${jahr}`;

                const result = await this.chargeSepaDirectDebit(
                    item.mitglied_id,
                    item.betrag,
                    description,
                    beitragIds
                );

                // Speichere Transaktion
                await this.saveTransaktion(batchId, item.mitglied_id, result.payment_intent_id, beitragIds, item.betrag, result.status);

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

                await this.saveTransaktion(batchId, item.mitglied_id, null, [], item.betrag, 'failed', error.userMessage || error.message);

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

    async createBatchEntry(batchId, monat, jahr, mitglieder) {
        const gesamtbetrag = mitglieder.reduce((sum, m) => sum + parseFloat(m.betrag || 0), 0);

        return queryAsync(`
            INSERT INTO stripe_lastschrift_batch
            (batch_id, dojo_id, monat, jahr, anzahl_transaktionen, gesamtbetrag, status)
            VALUES (?, ?, ?, ?, ?, ?, 'processing')
        `, [batchId, this.dojoConfig.id, monat, jahr, mitglieder.length, gesamtbetrag]);
    }

    async saveTransaktion(batchId, mitgliedId, paymentIntentId, beitragIds, betrag, status, errorMessage = null) {
        return queryAsync(`
            INSERT INTO stripe_lastschrift_transaktion
            (batch_id, mitglied_id, stripe_payment_intent_id, beitrag_ids, betrag, status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [batchId, mitgliedId, paymentIntentId, JSON.stringify(beitragIds), betrag, status, errorMessage]);
    }

    async updateBatchStatus(batchId, status, erfolgreiche, fehlgeschlagene) {
        return queryAsync(`
            UPDATE stripe_lastschrift_batch
            SET status = ?, erfolgreiche = ?, fehlgeschlagene = ?, completed_at = NOW()
            WHERE batch_id = ?
        `, [status, erfolgreiche, fehlgeschlagene, batchId]);
    }

    getUserFriendlyError(error) {
        const code = error.code || error.decline_code;

        const errorMessages = {
            'card_declined': 'Zahlung wurde abgelehnt',
            'insufficient_funds': 'Nicht genügend Deckung auf dem Konto',
            'debit_not_authorized': 'Lastschrift nicht autorisiert',
            'account_closed': 'Bankkonto geschlossen',
            'bank_account_declined': 'Bank hat die Lastschrift abgelehnt',
            'invalid_bank_account_iban': 'Ungültige IBAN',
            'sepa_unsupported_bank': 'Bank unterstützt kein SEPA',
            'authentication_required': 'Authentifizierung erforderlich',
            'no_such_customer': 'Kunde nicht gefunden',
            'no_such_payment_method': 'Zahlungsmethode nicht gefunden'
        };

        return errorMessages[code] || error.message || 'Unbekannter Fehler';
    }
}

module.exports = StripeConnectProvider;
