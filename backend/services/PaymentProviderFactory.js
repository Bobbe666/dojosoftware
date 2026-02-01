const db = require('../db');
const StripeDataevProvider = require('./StripeDataevProvider');
const ManualSepaProvider = require('./ManualSepaProvider');
const logger = require('../utils/logger');

class PaymentProviderFactory {
    static async getProvider(dojoId = null) {
        try {
            const dojoConfig = await this.getDojoConfig(dojoId);

            logger.info(`🏭 Payment Provider Factory: Selecting provider '${dojoConfig.payment_provider}' for Dojo ${dojoConfig.id}`);

            switch (dojoConfig.payment_provider) {
                case 'stripe_datev':
                    return new StripeDataevProvider(dojoConfig);

                case 'manual_sepa':
                default:
                    return new ManualSepaProvider(dojoConfig);
            }
        } catch (error) {
            logger.error('❌ PaymentProviderFactory: Error getting provider:', { error: error.message, stack: error.stack });
            // Fallback to manual SEPA
            const fallbackConfig = { payment_provider: 'manual_sepa', id: dojoId || 1 };
            return new ManualSepaProvider(fallbackConfig);
        }
    }

    static async getDojoConfig(dojoId = null) {
        return new Promise((resolve, reject) => {
            let query;
            let params = [];

            if (dojoId) {
                query = `
                    SELECT id, payment_provider, stripe_secret_key, stripe_publishable_key,
                           datev_api_key, datev_consultant_number, datev_client_number,
                           dojoname as name, sepa_glaeubiger_id
                    FROM dojo
                    WHERE id = ?
                `;
                params = [dojoId];
            } else {
                // Default to first dojo if no ID specified
                query = `
                    SELECT id, payment_provider, stripe_secret_key, stripe_publishable_key,
                           datev_api_key, datev_consultant_number, datev_client_number,
                           dojoname as name, sepa_glaeubiger_id
                    FROM dojo
                    LIMIT 1
                `;
            }

            db.query(query, params, (err, results) => {
                if (err) {
                    logger.error('❌ PaymentProviderFactory: DB Error:', { error: err.message, stack: err.stack });
                    return reject(err);
                }

                if (results.length === 0) {
                    logger.warn('⚠️  PaymentProviderFactory: No dojo found, using defaults');
                    return resolve({
                        id: 1,
                        payment_provider: 'manual_sepa',
                        name: 'Default Dojo'
                    });
                }

                const config = results[0];
                logger.info(`✅ PaymentProviderFactory: Loaded config for ${config.name} (Provider: ${config.payment_provider})`);
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
                    logger.error('❌ PaymentProviderFactory: Update Error:', { error: err.message, stack: err.stack });
                    return reject(err);
                }

                logger.info(`✅ PaymentProviderFactory: Updated provider to '${payment_provider}' for Dojo ${dojoId}`);

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
                logger.error('❌ Failed to log provider change:', { error: err.message, stack: err.stack });
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
                last_updated: config.updated_at,
                // Stripe-spezifische Daten für Frontend
                stripe: {
                    configured: config.payment_provider === 'stripe_datev' && !!config.stripe_publishable_key,
                    publishable_key: config.stripe_publishable_key || null
                }
            };
        } catch (error) {
            logger.error('❌ PaymentProviderFactory: Error getting status:', { error: error.message, stack: error.stack });
            return {
                current_provider: 'manual_sepa',
                provider_name: 'Manual SEPA (Fallback)',
                is_configured: false,
                error: error.message,
                stripe: { configured: false, publishable_key: null }
            };
        }
    }
}

module.exports = PaymentProviderFactory;