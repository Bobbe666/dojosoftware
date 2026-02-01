// ============================================================================
// SUMUP PAYMENT PROVIDER
// Backend/services/SumUpProvider.js
// ============================================================================

const db = require('../db');
const logger = require('../utils/logger');
const axios = require('axios');

class SumUpProvider {
    constructor(config) {
        this.config = config;
        this.name = 'SumUp';
        this.baseUrl = 'https://api.sumup.com';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // ========================================================================
    // AUTHENTICATION
    // ========================================================================

    /**
     * Holt einen Access Token von SumUp
     * SumUp verwendet OAuth 2.0 mit Client Credentials
     */
    async getAccessToken() {
        // Token noch gültig?
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        const clientId = this.config.sumup_client_id;
        const clientSecret = this.config.sumup_client_secret;

        // Wenn kein OAuth konfiguriert, versuche API Key
        if (!clientId || !clientSecret) {
            if (this.config.sumup_api_key) {
                this.accessToken = this.config.sumup_api_key;
                this.tokenExpiry = Date.now() + (3600 * 1000); // 1 Stunde
                return this.accessToken;
            }
            throw new Error('SumUp API Key oder OAuth Credentials sind nicht konfiguriert');
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/token`,
                new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: clientId,
                    client_secret: clientSecret
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = response.data.access_token;
            // Token 5 Minuten vor Ablauf erneuern
            this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);

            logger.info('SumUp: Access Token erhalten');
            return this.accessToken;

        } catch (error) {
            logger.error('SumUp: Fehler beim Abrufen des Access Tokens:', {
                error: error.response?.data || error.message
            });
            throw new Error('SumUp Authentifizierung fehlgeschlagen');
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
                    'Content-Type': 'application/json'
                },
                data
            });

            return response.data;

        } catch (error) {
            logger.error('SumUp API Error:', {
                endpoint,
                status: error.response?.status,
                error: error.response?.data || error.message
            });
            throw error;
        }
    }

    // ========================================================================
    // CHECKOUTS (Zahlungen)
    // ========================================================================

    /**
     * Erstellt einen SumUp Checkout (Zahlungslink)
     * @param {Object} checkoutData - Checkout-Daten
     * @returns {Object} Checkout-Ergebnis mit URL
     */
    async createCheckout(checkoutData) {
        const {
            amount,
            currency = 'EUR',
            description,
            reference,
            returnUrl,
            // Optionale Referenzen
            mitgliedId,
            rechnungId,
            verkaufId,
            eventAnmeldungId,
            verbandsmitgliedschaftId,
            zahlungstyp = 'sonstig'
        } = checkoutData;

        const merchantCode = this.config.sumup_merchant_code;
        if (!merchantCode) {
            throw new Error('SumUp Merchant Code ist nicht konfiguriert');
        }

        // Checkout-Referenz generieren (eindeutig)
        const checkoutReference = reference || `DOJO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const payload = {
            checkout_reference: checkoutReference,
            amount: parseFloat(amount).toFixed(2),
            currency: currency,
            pay_to_email: this.config.email, // Händler-E-Mail
            merchant_code: merchantCode,
            description: description || 'Zahlung',
        };

        // Return URL hinzufügen wenn vorhanden
        if (returnUrl) {
            payload.return_url = returnUrl;
        }

        try {
            const checkout = await this.apiCall('POST', '/v0.1/checkouts', payload);

            // In DB speichern
            await this.savePayment({
                checkoutId: checkout.id,
                checkoutReference: checkoutReference,
                dojoId: this.config.id,
                amount: amount,
                currency: currency,
                description: description,
                status: 'PENDING',
                checkoutUrl: `https://pay.sumup.com/b2c/Q${checkout.id}`,
                mitgliedId,
                rechnungId,
                verkaufId,
                eventAnmeldungId,
                verbandsmitgliedschaftId,
                zahlungstyp,
                responseData: checkout
            });

            logger.info('SumUp: Checkout erstellt:', {
                checkoutId: checkout.id,
                reference: checkoutReference
            });

            return {
                success: true,
                checkoutId: checkout.id,
                checkoutReference: checkoutReference,
                checkoutUrl: `https://pay.sumup.com/b2c/Q${checkout.id}`,
                amount: checkout.amount,
                currency: checkout.currency,
                status: checkout.status
            };

        } catch (error) {
            logger.error('SumUp: Fehler beim Erstellen des Checkouts:', {
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error_message || error.message
            };
        }
    }

    /**
     * Holt den Status eines Checkouts
     * @param {string} checkoutId - Checkout ID
     * @returns {Object} Checkout-Status
     */
    async getCheckoutStatus(checkoutId) {
        try {
            const checkout = await this.apiCall('GET', `/v0.1/checkouts/${checkoutId}`);

            // Status in DB aktualisieren wenn bezahlt
            if (checkout.status === 'PAID') {
                await this.updatePaymentStatus(checkoutId, 'PAID', {
                    transactionId: checkout.transaction_id,
                    transactionCode: checkout.transaction_code
                });
            } else if (checkout.status === 'FAILED') {
                await this.updatePaymentStatus(checkoutId, 'FAILED');
            }

            return {
                success: true,
                checkoutId: checkout.id,
                status: checkout.status,
                amount: checkout.amount,
                currency: checkout.currency,
                transactionId: checkout.transaction_id,
                transactionCode: checkout.transaction_code,
                paidAt: checkout.valid_until
            };

        } catch (error) {
            logger.error('SumUp: Fehler beim Abrufen des Checkout-Status:', {
                checkoutId,
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Löscht einen ausstehenden Checkout
     * @param {string} checkoutId - Checkout ID
     */
    async deleteCheckout(checkoutId) {
        try {
            await this.apiCall('DELETE', `/v0.1/checkouts/${checkoutId}`);

            // In DB als EXPIRED markieren
            await this.updatePaymentStatus(checkoutId, 'EXPIRED');

            logger.info('SumUp: Checkout gelöscht:', { checkoutId });
            return { success: true };

        } catch (error) {
            logger.error('SumUp: Fehler beim Löschen des Checkouts:', {
                checkoutId,
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // ========================================================================
    // TRANSACTIONS (Transaktionshistorie)
    // ========================================================================

    /**
     * Holt die Transaktionshistorie
     * @param {Object} params - Filter-Parameter
     */
    async getTransactions(params = {}) {
        const {
            limit = 10,
            startDate,
            endDate,
            order = 'descending'
        } = params;

        let endpoint = `/v0.1/me/transactions/history?limit=${limit}&order=${order}`;

        if (startDate) {
            endpoint += `&oldest_time=${startDate}`;
        }
        if (endDate) {
            endpoint += `&newest_time=${endDate}`;
        }

        try {
            const transactions = await this.apiCall('GET', endpoint);
            return {
                success: true,
                transactions: transactions.items || transactions
            };

        } catch (error) {
            logger.error('SumUp: Fehler beim Abrufen der Transaktionen:', {
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Holt Details zu einer Transaktion
     * @param {string} transactionId - Transaktions-ID
     */
    async getTransaction(transactionId) {
        try {
            const transaction = await this.apiCall('GET', `/v0.1/me/transactions/${transactionId}`);
            return {
                success: true,
                transaction: transaction
            };

        } catch (error) {
            logger.error('SumUp: Fehler beim Abrufen der Transaktion:', {
                transactionId,
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Holt die Quittung einer Transaktion
     * @param {string} transactionId - Transaktions-ID
     */
    async getReceipt(transactionId) {
        try {
            const receipt = await this.apiCall('GET', `/v0.1/me/transactions/${transactionId}/receipt`);
            return {
                success: true,
                receiptUrl: receipt.receipt_url || receipt
            };

        } catch (error) {
            logger.error('SumUp: Fehler beim Abrufen der Quittung:', {
                transactionId,
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // ========================================================================
    // REFUNDS (Rückerstattungen)
    // ========================================================================

    /**
     * Erstellt eine Rückerstattung
     * @param {string} transactionId - Transaktions-ID
     * @param {number} amount - Betrag (optional, für Teilrückerstattung)
     */
    async refund(transactionId, amount = null) {
        try {
            const payload = {};
            if (amount) {
                payload.amount = parseFloat(amount).toFixed(2);
            }

            const refund = await this.apiCall('POST', `/v0.1/me/refund/${transactionId}`, payload);

            logger.info('SumUp: Rückerstattung erstellt:', { transactionId });
            return {
                success: true,
                refundId: refund.id,
                status: refund.status
            };

        } catch (error) {
            logger.error('SumUp: Fehler bei Rückerstattung:', {
                transactionId,
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // ========================================================================
    // MERCHANT INFO
    // ========================================================================

    /**
     * Holt Händler-Informationen
     */
    async getMerchantInfo() {
        try {
            const merchant = await this.apiCall('GET', '/v0.1/me');
            return {
                success: true,
                merchant: merchant
            };

        } catch (error) {
            logger.error('SumUp: Fehler beim Abrufen der Händler-Info:', {
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // ========================================================================
    // DATABASE HELPERS
    // ========================================================================

    /**
     * Speichert eine Zahlung in der DB
     */
    async savePayment(paymentData) {
        const {
            checkoutId,
            checkoutReference,
            dojoId,
            amount,
            currency,
            description,
            status,
            checkoutUrl,
            mitgliedId,
            rechnungId,
            verkaufId,
            eventAnmeldungId,
            verbandsmitgliedschaftId,
            zahlungstyp,
            responseData
        } = paymentData;

        return new Promise((resolve, reject) => {
            db.query(`
                INSERT INTO sumup_payments (
                    checkout_id, checkout_reference, dojo_id, amount, currency,
                    description, status, checkout_url, mitglied_id, rechnung_id,
                    verkauf_id, event_anmeldung_id, verbandsmitgliedschaft_id,
                    zahlungstyp, response_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    status = VALUES(status),
                    updated_at = NOW()
            `, [
                checkoutId, checkoutReference, dojoId, amount, currency,
                description, status, checkoutUrl, mitgliedId, rechnungId,
                verkaufId, eventAnmeldungId, verbandsmitgliedschaftId,
                zahlungstyp, responseData ? JSON.stringify(responseData) : null
            ], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    /**
     * Aktualisiert den Status einer Zahlung
     */
    async updatePaymentStatus(checkoutId, status, additionalData = {}) {
        const { transactionId, transactionCode, receiptUrl } = additionalData;

        return new Promise((resolve, reject) => {
            let query = `
                UPDATE sumup_payments
                SET status = ?, updated_at = NOW()
            `;
            const params = [status];

            if (transactionId) {
                query += `, transaction_id = ?`;
                params.push(transactionId);
            }
            if (transactionCode) {
                query += `, transaction_code = ?`;
                params.push(transactionCode);
            }
            if (receiptUrl) {
                query += `, receipt_url = ?`;
                params.push(receiptUrl);
            }
            if (status === 'PAID') {
                query += `, paid_at = NOW()`;
            }

            query += ` WHERE checkout_id = ?`;
            params.push(checkoutId);

            db.query(query, params, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    /**
     * Holt eine Zahlung aus der DB
     */
    async getPaymentByCheckoutId(checkoutId) {
        return new Promise((resolve, reject) => {
            db.query(
                'SELECT * FROM sumup_payments WHERE checkout_id = ?',
                [checkoutId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results[0] || null);
                }
            );
        });
    }

    /**
     * Holt Zahlungen für ein Dojo
     */
    async getPaymentsByDojoId(dojoId, limit = 50) {
        return new Promise((resolve, reject) => {
            db.query(
                'SELECT * FROM sumup_payments WHERE dojo_id = ? ORDER BY created_at DESC LIMIT ?',
                [dojoId, limit],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });
    }

    // ========================================================================
    // STATUS & CONFIGURATION
    // ========================================================================

    /**
     * Prüft den Verbindungsstatus
     */
    async getStatus() {
        try {
            // Test API-Zugang
            const merchant = await this.getMerchantInfo();

            if (merchant.success) {
                return {
                    configured: true,
                    connected: true,
                    merchantCode: merchant.merchant?.merchant_code,
                    businessName: merchant.merchant?.business_name,
                    message: 'SumUp ist verbunden'
                };
            } else {
                return {
                    configured: true,
                    connected: false,
                    error: merchant.error
                };
            }

        } catch (error) {
            return {
                configured: !!(this.config.sumup_api_key || (this.config.sumup_client_id && this.config.sumup_client_secret)),
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * Testet die Verbindung
     */
    async testConnection() {
        return this.getStatus();
    }
}

module.exports = SumUpProvider;
