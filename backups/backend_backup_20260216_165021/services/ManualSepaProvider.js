const db = require('../db');
const SepaPdfGenerator = require('../utils/sepaPdfGenerator');
const logger = require('../utils/logger');

class ManualSepaProvider {
    constructor(dojoConfig) {
        this.dojoConfig = dojoConfig;
    }

    getProviderName() {
        return 'Manueller SEPA Lastschrifteinzug';
    }

    async isConfigured() {
        // Manual SEPA is always "configured" as it uses existing infrastructure
        return !!(this.dojoConfig.sepa_glaeubiger_id);
    }

    async getConfigurationStatus() {
        return {
            sepa_glaeubiger_configured: !!this.dojoConfig.sepa_glaeubiger_id,
            manual_processing: true,
            pdf_generation: true,
            existing_mandates: await this.getActiveMandateCount(),
            fully_configured: !!this.dojoConfig.sepa_glaeubiger_id
        };
    }

    async getActiveMandateCount() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT COUNT(*) as count
                FROM sepa_mandate
                WHERE status = 'aktiv' AND provider = 'manual_sepa'
            `;

            db.query(query, (err, results) => {
                if (err) {
                    logger.error('❌ ManualSepa: Error counting mandates:', { error: err.message, stack: err.stack });
                    return resolve(0);
                }
                resolve(results[0]?.count || 0);
            });
        });
    }

    async createSepaMandate(mitgliedData, bankDetails) {
        try {
            logger.info(`📋 Manual SEPA: Creating mandate for ${mitgliedData.vorname} ${mitgliedData.nachname}`);

            // Generate mandate reference
            const mandatsreferenz = this.generateMandateReference(mitgliedData.mitglied_id);

            // Create SEPA mandate record
            const mandateResult = await this.saveSepaMandate(mitgliedData.mitglied_id, bankDetails, mandatsreferenz);

            // Update member payment information
            await this.updateMemberPaymentMethod(mitgliedData.mitglied_id, bankDetails);

            logger.info(`✅ Manual SEPA: Mandate created - ${mandatsreferenz}`);

            return {
                success: true,
                mandate_reference: mandatsreferenz,
                mandate_id: mandateResult.insertId,
                pdf_download_url: `/api/mitglieder/${mitgliedData.mitglied_id}/sepa-mandate/download`
            };

        } catch (error) {
            logger.error('❌ Manual SEPA: Error creating mandate:', { error: error.message, stack: error.stack });
            await this.logError(mitgliedData.mitglied_id, 'create_mandate', error.message);
            throw error;
        }
    }

    generateMandateReference(mitgliedId) {
        const timestamp = Date.now().toString().slice(-6);
        return `DOJO-${mitgliedId}-${timestamp}`;
    }

    async saveSepaMandate(mitgliedId, bankDetails, mandatsreferenz) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO sepa_mandate (
                    mitglied_id, mandatsreferenz, iban, bic, kontoinhaber, bankname,
                    glaeubiger_id, erstellungsdatum, status, provider
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'aktiv', 'manual_sepa')
            `;

            const params = [
                mitgliedId,
                mandatsreferenz,
                bankDetails.iban,
                bankDetails.bic,
                bankDetails.kontoinhaber,
                bankDetails.bankname,
                this.dojoConfig.sepa_glaeubiger_id
            ];

            db.query(query, params, (err, result) => {
                if (err) {
                    logger.error('❌ Database: Error saving SEPA mandate:', { error: err.message, stack: err.stack });
                    return reject(err);
                }

                logger.info(`✅ Database: SEPA mandate saved with ID ${result.insertId}`);
                resolve(result);
            });
        });
    }

    async updateMemberPaymentMethod(mitgliedId, bankDetails) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE mitglieder
                SET iban = ?, bic = ?, kontoinhaber = ?, bankname = ?, zahlungsmethode = 'SEPA-Lastschrift'
                WHERE mitglied_id = ?
            `;

            const params = [
                bankDetails.iban,
                bankDetails.bic,
                bankDetails.kontoinhaber,
                bankDetails.bankname,
                mitgliedId
            ];

            db.query(query, params, (err, result) => {
                if (err) {
                    logger.error('❌ Database: Error updating member payment method:', { error: err.message, stack: err.stack });
                    return reject(err);
                }

                logger.info(`✅ Database: Member payment method updated for ID ${mitgliedId}`);
                resolve(result);
            });
        });
    }

    async revokeSepaMandate(mitgliedId) {
        try {
            logger.info(`🚫 Manual SEPA: Revoking mandate for member ${mitgliedId}`);

            const result = await new Promise((resolve, reject) => {
                const query = `
                    UPDATE sepa_mandate
                    SET status = 'widerrufen', widerrufsdatum = NOW()
                    WHERE mitglied_id = ? AND status = 'aktiv' AND provider = 'manual_sepa'
                `;

                db.query(query, [mitgliedId], (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });

            if (result.affectedRows === 0) {
                throw new Error('No active SEPA mandate found to revoke');
            }

            logger.info(`✅ Manual SEPA: Mandate revoked for member ${mitgliedId}`);

            return {
                success: true,
                message: 'SEPA mandate revoked successfully'
            };

        } catch (error) {
            logger.error('❌ Manual SEPA: Error revoking mandate:', { error: error.message, stack: error.stack });
            await this.logError(mitgliedId, 'revoke_mandate', error.message);
            throw error;
        }
    }

    async getSepaMandate(mitgliedId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT sm.*, m.vorname, m.nachname, m.email
                FROM sepa_mandate sm
                JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
                WHERE sm.mitglied_id = ? AND sm.status = 'aktiv' AND sm.provider = 'manual_sepa'
                ORDER BY sm.erstellungsdatum DESC
                LIMIT 1
            `;

            db.query(query, [mitgliedId], (err, results) => {
                if (err) {
                    logger.error('❌ Database: Error getting SEPA mandate:', { error: err.message, stack: err.stack });
                    return reject(err);
                }

                resolve(results[0] || null);
            });
        });
    }

    async generateMandatePdf(mitgliedId) {
        try {
            logger.info(`📄 Manual SEPA: Generating PDF for member ${mitgliedId}`);

            // Get mandate data with member and dojo information
            const mandateData = await this.getMandateDataForPdf(mitgliedId);

            if (!mandateData) {
                throw new Error('No active SEPA mandate found for PDF generation');
            }

            // Generate PDF using existing utility
            const pdfBuffer = await SepaPdfGenerator.generatePdf(mandateData);

            logger.info(`✅ Manual SEPA: PDF generated for mandate ${mandateData.mandatsreferenz}`);

            return {
                success: true,
                pdf: pdfBuffer,
                filename: `SEPA-Mandat_${mandateData.nachname}_${mandateData.vorname}.pdf`
            };

        } catch (error) {
            logger.error('❌ Manual SEPA: Error generating PDF:', { error: error.message, stack: error.stack });
            await this.logError(mitgliedId, 'generate_pdf', error.message);
            throw error;
        }
    }

    async getMandateDataForPdf(mitgliedId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    sm.*,
                    m.vorname, m.nachname, m.email, m.strasse, m.plz, m.ort,
                    d.name as dojo_name, d.strasse as dojo_strasse,
                    d.plz as dojo_plz, d.ort as dojo_ort, d.sepa_glaeubiger_id
                FROM sepa_mandate sm
                JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
                JOIN dojo d ON 1=1  -- Assuming single dojo
                WHERE sm.mitglied_id = ? AND sm.status = 'aktiv' AND sm.provider = 'manual_sepa'
                ORDER BY sm.erstellungsdatum DESC
                LIMIT 1
            `;

            db.query(query, [mitgliedId], (err, results) => {
                if (err) {
                    logger.error('❌ Database: Error getting mandate data for PDF:', { error: err.message, stack: err.stack });
                    return reject(err);
                }

                resolve(results[0] || null);
            });
        });
    }

    async getAllMandates() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    sm.*,
                    m.vorname, m.nachname, m.email
                FROM sepa_mandate sm
                JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
                WHERE sm.provider = 'manual_sepa'
                ORDER BY sm.erstellungsdatum DESC
            `;

            db.query(query, (err, results) => {
                if (err) {
                    logger.error('❌ Database: Error getting all mandates:', { error: err.message, stack: err.stack });
                    return reject(err);
                }

                logger.info(`✅ Manual SEPA: Retrieved ${results.length} mandates`);
                resolve(results);
            });
        });
    }

    async generateBatchFile() {
        try {
            logger.info('📦 Manual SEPA: Generating batch file for manual processing');

            const mandates = await this.getAllMandates();
            const activeMandates = mandates.filter(m => m.status === 'aktiv');

            if (activeMandates.length === 0) {
                throw new Error('No active mandates found for batch processing');
            }

            // Generate batch processing data (could be CSV, XML, etc.)
            const batchData = this.generateBatchData(activeMandates);

            logger.info(`✅ Manual SEPA: Batch file generated with ${activeMandates.length} mandates`);

            return {
                success: true,
                batch_data: batchData,
                mandate_count: activeMandates.length,
                filename: `SEPA_Batch_${new Date().toISOString().split('T')[0]}.csv`
            };

        } catch (error) {
            logger.error('❌ Manual SEPA: Error generating batch file:', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    generateBatchData(mandates) {
        // Generate CSV format for bank processing
        const headers = ['Mandatsreferenz', 'IBAN', 'BIC', 'Kontoinhaber', 'Betrag', 'Verwendungszweck'];
        const csvData = [headers.join(',')];

        mandates.forEach(mandate => {
            const row = [
                mandate.mandatsreferenz,
                mandate.iban,
                mandate.bic,
                `"${mandate.kontoinhaber}"`,
                '0.00', // Amount to be filled manually
                `"Mitgliedsbeitrag ${mandate.vorname} ${mandate.nachname}"`
            ];
            csvData.push(row.join(','));
        });

        return csvData.join('\n');
    }

    async logError(mitgliedId, action, message) {
        const query = `
            INSERT INTO payment_provider_logs (dojo_id, mitglied_id, provider, action, status, message)
            VALUES (?, ?, 'manual_sepa', ?, 'error', ?)
        `;

        db.query(query, [this.dojoConfig.id, mitgliedId, action, message], (err) => {
            if (err) {
                logger.error('❌ Failed to log error:', { error: err.message, stack: err.stack });
            }
        });
    }

    async getPaymentHistory(mitgliedId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    sm.mandatsreferenz,
                    sm.erstellungsdatum,
                    sm.status,
                    sm.widerrufsdatum,
                    'Manual SEPA' as payment_type
                FROM sepa_mandate sm
                WHERE sm.mitglied_id = ? AND sm.provider = 'manual_sepa'
                ORDER BY sm.erstellungsdatum DESC
            `;

            db.query(query, [mitgliedId], (err, results) => {
                if (err) {
                    logger.error('❌ Database: Error getting payment history:', { error: err.message, stack: err.stack });
                    return reject(err);
                }

                resolve(results);
            });
        });
    }
}

module.exports = ManualSepaProvider;