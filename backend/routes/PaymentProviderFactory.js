const db = require('../db');
const logger = require('../utils/logger');
const StripeDataevProvider = require('./StripeDataevProvider');
const ManualSepaProvider = require('./ManualSepaProvider');

class PaymentProviderFactory {
    static async getProvider(dojoId = null) {
        // Ohne gültige dojoId hart fehlschlagen — niemals ein beliebiges Dojo
        // (und dessen Stripe/DATEV-Credentials) verwenden.
        if (!dojoId) {
            throw new Error('PaymentProviderFactory.getProvider: dojoId erforderlich');
        }
        try {
            const dojoConfig = await this.getDojoConfig(dojoId);
            switch (dojoConfig.payment_provider) {
                case 'stripe_datev':
                    return new StripeDataevProvider(dojoConfig);

                case 'manual_sepa':
                default:
                    return new ManualSepaProvider(dojoConfig);
            }
        } catch (error) {
            logger.error('PaymentProviderFactory: Error getting provider:', error);
            // Fallback nur für DIESES Dojo auf manual_sepa — kein Fremd-Dojo.
            const fallbackConfig = { payment_provider: 'manual_sepa', id: dojoId };
            return new ManualSepaProvider(fallbackConfig);
        }
    }

    static async getDojoConfig(dojoId = null) {
        // Ohne gültige dojoId hart fehlschlagen — kein "erstes Dojo" (LIMIT 1),
        // sonst würden fremde Stripe/DATEV-Credentials verwendet.
        if (!dojoId) {
            throw new Error('PaymentProviderFactory.getDojoConfig: dojoId erforderlich');
        }
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, payment_provider, stripe_secret_key, stripe_publishable_key,
                       datev_api_key, datev_consultant_number, datev_client_number,
                       dojoname as name, sepa_glaeubiger_id
                FROM dojo
                WHERE id = ?
            `;
            const params = [dojoId];

            db.query(query, params, (err, results) => {
                if (err) {
                    logger.error('PaymentProviderFactory: DB Error:', err);
                    return reject(err);
                }

                if (results.length === 0) {
                    // Kein Dojo mit dieser id — nicht auf ein Default-Dojo ausweichen.
                    return reject(new Error(`PaymentProviderFactory: Dojo ${dojoId} nicht gefunden`));
                }

                const config = results[0];
                resolve(config);
            });
        });
    }

    static async updatePaymentProvider(dojoId, providerConfig) {
        return new Promise((resolve, reject) => {
            const {
                payment_provider,
                stripe_secret_key,
                stripe_publishable_key,
                datev_api_key,
                datev_consultant_number,
                datev_client_number
            } = providerConfig;

            const query = `
                UPDATE dojo
                SET payment_provider = ?,
                    stripe_secret_key = ?,
                    stripe_publishable_key = ?,
                    datev_api_key = ?,
                    datev_consultant_number = ?,
                    datev_client_number = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;

            const params = [
                payment_provider,
                stripe_secret_key,
                stripe_publishable_key,
                datev_api_key,
                datev_consultant_number,
                datev_client_number,
                dojoId
            ];

            db.query(query, params, (err, result) => {
                if (err) {
                    logger.error('PaymentProviderFactory: Update Error:', err);
                    return reject(err);
                }
                // Log the configuration change
                this.logProviderChange(dojoId, payment_provider, 'updated');

                resolve(result);
            });
        });
    }

    static async validateProviderConfig(providerConfig) {
        const { payment_provider } = providerConfig;

        if (payment_provider === 'stripe_datev') {
            // Validate Stripe + DATEV configuration
            const required = ['stripe_secret_key', 'stripe_publishable_key', 'datev_api_key'];
            const missing = required.filter(field => !providerConfig[field]);

            if (missing.length > 0) {
                throw new Error(`Missing required fields for Stripe+DATEV: ${missing.join(', ')}`);
            }

            // Validate Stripe key format
            if (!providerConfig.stripe_secret_key.startsWith('sk_')) {
                throw new Error('Invalid Stripe secret key format');
            }

            if (!providerConfig.stripe_publishable_key.startsWith('pk_')) {
                throw new Error('Invalid Stripe publishable key format');
            }
        }

        return true;
    }

    static async logProviderChange(dojoId, provider, action) {
        const query = `
            INSERT INTO payment_provider_logs (dojo_id, provider, action, status, message)
            VALUES (?, ?, ?, 'success', ?)
        `;

        const message = `Payment provider ${action}: ${provider}`;

        db.query(query, [dojoId, provider, action, message], (err) => {
            if (err) {
                logger.error('Failed to log provider change:', err);
            }
        });
    }

    static async getProviderStatus(dojoId = null) {
        try {
            const config = await this.getDojoConfig(dojoId);
            const provider = await this.getProvider(dojoId);

            return {
                current_provider: config.payment_provider,
                provider_name: provider.getProviderName(),
                is_configured: await provider.isConfigured(),
                configuration_status: await provider.getConfigurationStatus(),
                last_updated: config.updated_at
            };
        } catch (error) {
            logger.error('PaymentProviderFactory: Error getting status:', error);
            return {
                current_provider: 'manual_sepa',
                provider_name: 'Manual SEPA (Fallback)',
                is_configured: false,
                error: error.message
            };
        }
    }
}

module.exports = PaymentProviderFactory;