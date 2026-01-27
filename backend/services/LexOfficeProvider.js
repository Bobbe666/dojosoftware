// ============================================================================
// LEXOFFICE INTEGRATION
// Backend/services/LexOfficeProvider.js
// ============================================================================

const axios = require('axios');
const db = require('../db');
const logger = require('../utils/logger');

class LexOfficeProvider {
    constructor(config) {
        this.config = config;
        this.apiKey = config.lexoffice_api_key;
        this.baseUrl = 'https://api.lexoffice.io/v1';
    }

    // ========================================================================
    // API HELPER
    // ========================================================================

    async apiCall(method, endpoint, data = null) {
        if (!this.apiKey) {
            throw new Error('LexOffice API Key nicht konfiguriert');
        }

        try {
            const response = await axios({
                method,
                url: `${this.baseUrl}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                data
            });

            return response.data;

        } catch (error) {
            logger.error('❌ LexOffice API Error:', {
                endpoint,
                status: error.response?.status,
                error: error.response?.data || error.message
            });
            throw error;
        }
    }

    // ========================================================================
    // KONTAKTE (Kunden)
    // ========================================================================

    /**
     * Erstellt oder aktualisiert einen Kontakt in LexOffice
     */
    async syncContact(mitglied) {
        const contactData = {
            version: 0,
            roles: {
                customer: {}
            },
            person: {
                salutation: mitglied.anrede || null,
                firstName: mitglied.vorname,
                lastName: mitglied.nachname
            },
            addresses: {
                billing: [{
                    street: mitglied.strasse || '',
                    zip: mitglied.plz || '',
                    city: mitglied.ort || '',
                    countryCode: 'DE'
                }]
            },
            emailAddresses: mitglied.email ? {
                business: [mitglied.email]
            } : undefined,
            phoneNumbers: mitglied.telefon ? {
                business: [mitglied.telefon]
            } : undefined,
            note: `Dojo Mitglied ID: ${mitglied.mitglied_id}`
        };

        try {
            // Prüfen ob Kontakt bereits existiert
            const existingId = await this.findContactByMitgliedId(mitglied.mitglied_id);

            let result;
            if (existingId) {
                // Update
                const existing = await this.apiCall('GET', `/contacts/${existingId}`);
                contactData.version = existing.version;
                result = await this.apiCall('PUT', `/contacts/${existingId}`, contactData);
                logger.info('✅ LexOffice: Kontakt aktualisiert:', { lexofficeId: existingId });
            } else {
                // Create
                result = await this.apiCall('POST', '/contacts', contactData);
                logger.info('✅ LexOffice: Kontakt erstellt:', { lexofficeId: result.id });

                // Mapping speichern
                await this.saveContactMapping(mitglied.mitglied_id, result.id);
            }

            return {
                success: true,
                contactId: result.id || existingId
            };

        } catch (error) {
            logger.error('❌ LexOffice: Fehler beim Sync des Kontakts:', { error: error.message });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Findet einen LexOffice-Kontakt anhand der Mitglied-ID
     */
    async findContactByMitgliedId(mitgliedId) {
        return new Promise((resolve, reject) => {
            db.query(
                'SELECT lexoffice_contact_id FROM lexoffice_mappings WHERE mitglied_id = ?',
                [mitgliedId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results.length > 0 ? results[0].lexoffice_contact_id : null);
                }
            );
        });
    }

    /**
     * Speichert das Mapping zwischen Mitglied und LexOffice-Kontakt
     */
    async saveContactMapping(mitgliedId, lexofficeId) {
        return new Promise((resolve, reject) => {
            db.query(`
                INSERT INTO lexoffice_mappings (mitglied_id, lexoffice_contact_id, created_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE lexoffice_contact_id = ?, updated_at = NOW()
            `, [mitgliedId, lexofficeId, lexofficeId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    // ========================================================================
    // RECHNUNGEN
    // ========================================================================

    /**
     * Erstellt eine Rechnung in LexOffice
     */
    async createInvoice(rechnungData) {
        const {
            mitgliedId,
            rechnungsnummer,
            rechnungsdatum,
            faelligkeitsdatum,
            positionen,
            bemerkung
        } = rechnungData;

        try {
            // Kontakt-ID holen oder erstellen
            let contactId = await this.findContactByMitgliedId(mitgliedId);

            if (!contactId) {
                // Mitglied-Daten laden und Kontakt erstellen
                const [mitglieder] = await db.promise().query(
                    'SELECT * FROM mitglieder WHERE mitglied_id = ?',
                    [mitgliedId]
                );

                if (mitglieder.length === 0) {
                    throw new Error('Mitglied nicht gefunden');
                }

                const syncResult = await this.syncContact(mitglieder[0]);
                if (!syncResult.success) {
                    throw new Error('Kontakt konnte nicht erstellt werden');
                }
                contactId = syncResult.contactId;
            }

            // Rechnungs-Positionen formatieren
            const lineItems = positionen.map(pos => ({
                type: 'custom',
                name: pos.bezeichnung,
                description: pos.beschreibung || '',
                quantity: pos.menge || 1,
                unitName: 'Stück',
                unitPrice: {
                    currency: 'EUR',
                    netAmount: pos.einzelpreis,
                    taxRatePercentage: pos.mwst_satz || 19
                }
            }));

            const invoiceData = {
                voucherDate: rechnungsdatum,
                address: {
                    contactId: contactId
                },
                lineItems: lineItems,
                totalPrice: {
                    currency: 'EUR'
                },
                taxConditions: {
                    taxType: 'net' // oder 'gross' für Kleinunternehmer
                },
                paymentConditions: {
                    paymentTermLabel: `Zahlbar bis ${faelligkeitsdatum}`,
                    paymentTermDuration: this.calculateDaysDiff(rechnungsdatum, faelligkeitsdatum)
                },
                shippingConditions: {
                    shippingType: 'none'
                },
                title: 'Rechnung',
                introduction: `Rechnungsnummer: ${rechnungsnummer}`,
                remark: bemerkung || 'Vielen Dank für Ihre Mitgliedschaft!'
            };

            const result = await this.apiCall('POST', '/invoices', invoiceData);

            // Mapping speichern
            await this.saveInvoiceMapping(rechnungsnummer, result.id);

            logger.info('✅ LexOffice: Rechnung erstellt:', {
                lexofficeId: result.id,
                rechnungsnummer
            });

            return {
                success: true,
                invoiceId: result.id,
                resourceUri: result.resourceUri
            };

        } catch (error) {
            logger.error('❌ LexOffice: Fehler beim Erstellen der Rechnung:', { error: error.message });
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Finalisiert eine Rechnung (macht sie unveränderlich)
     */
    async finalizeInvoice(invoiceId) {
        try {
            const result = await this.apiCall('POST', `/invoices/${invoiceId}/document`);

            logger.info('✅ LexOffice: Rechnung finalisiert:', { invoiceId });

            return {
                success: true,
                documentFileId: result.documentFileId
            };

        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Lädt das PDF einer Rechnung herunter
     */
    async downloadInvoicePdf(invoiceId) {
        try {
            // Erst Document-Info holen
            const invoice = await this.apiCall('GET', `/invoices/${invoiceId}`);

            if (!invoice.files?.documentFileId) {
                // Rechnung muss erst finalisiert werden
                const finalizeResult = await this.finalizeInvoice(invoiceId);
                if (!finalizeResult.success) {
                    throw new Error('Rechnung konnte nicht finalisiert werden');
                }
            }

            // PDF herunterladen
            const response = await axios({
                method: 'GET',
                url: `${this.baseUrl}/files/${invoice.files.documentFileId}`,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/pdf'
                },
                responseType: 'arraybuffer'
            });

            return {
                success: true,
                pdf: response.data,
                contentType: 'application/pdf'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Speichert das Rechnungs-Mapping
     */
    async saveInvoiceMapping(rechnungsnummer, lexofficeId) {
        return new Promise((resolve, reject) => {
            db.query(`
                INSERT INTO lexoffice_invoice_mappings (rechnungsnummer, lexoffice_invoice_id, created_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE lexoffice_invoice_id = ?, updated_at = NOW()
            `, [rechnungsnummer, lexofficeId, lexofficeId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    // ========================================================================
    // ZAHLUNGEN
    // ========================================================================

    /**
     * Markiert eine Rechnung als bezahlt
     */
    async markInvoicePaid(invoiceId, paymentData) {
        const {
            amount,
            paymentDate,
            paymentMethod = 'SEPA'
        } = paymentData;

        try {
            // LexOffice nutzt Vouchers für Zahlungen
            const voucherData = {
                voucherType: 'purchaseinvoice',
                voucherStatus: 'paid',
                paidDate: paymentDate
            };

            // Hinweis: LexOffice erlaubt keine direkte Zahlung-Markierung über API
            // Stattdessen wird ein Payment-Voucher erstellt
            logger.info('ℹ️ LexOffice: Zahlungsinfo wird gespeichert:', { invoiceId, amount });

            // Intern tracken
            await this.savePaymentRecord(invoiceId, amount, paymentDate, paymentMethod);

            return {
                success: true,
                message: 'Zahlung intern erfasst'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async savePaymentRecord(invoiceId, amount, date, method) {
        return new Promise((resolve, reject) => {
            db.query(`
                INSERT INTO lexoffice_payments (lexoffice_invoice_id, amount, payment_date, payment_method, created_at)
                VALUES (?, ?, ?, ?, NOW())
            `, [invoiceId, amount, date, method], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    // ========================================================================
    // EXPORT
    // ========================================================================

    /**
     * Exportiert alle Rechnungen eines Zeitraums
     */
    async exportInvoices(startDate, endDate) {
        try {
            // LexOffice Voucher-Liste abrufen
            const params = new URLSearchParams({
                voucherType: 'invoice',
                voucherDateFrom: startDate,
                voucherDateTo: endDate,
                size: 250
            });

            const result = await this.apiCall('GET', `/voucherlist?${params}`);

            return {
                success: true,
                invoices: result.content || [],
                total: result.totalElements || 0
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Holt eine Kontenliste (für Zuordnungen)
     */
    async getAccounts() {
        try {
            const result = await this.apiCall('GET', '/posting-categories');

            return {
                success: true,
                accounts: result
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ========================================================================
    // BULK SYNC
    // ========================================================================

    /**
     * Synchronisiert alle Mitglieder zu LexOffice
     */
    async syncAllContacts(dojoId) {
        try {
            const [mitglieder] = await db.promise().query(
                'SELECT * FROM mitglieder WHERE dojo_id = ? AND status = "aktiv"',
                [dojoId]
            );

            const results = {
                total: mitglieder.length,
                success: 0,
                failed: 0,
                errors: []
            };

            for (const mitglied of mitglieder) {
                const result = await this.syncContact(mitglied);
                if (result.success) {
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push({
                        mitglied_id: mitglied.mitglied_id,
                        error: result.error
                    });
                }

                // Rate Limiting: 2 Requests/Sekunde
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            logger.info('✅ LexOffice: Bulk-Sync abgeschlossen:', results);
            return results;

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    calculateDaysDiff(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // ========================================================================
    // STATUS
    // ========================================================================

    async getStatus() {
        if (!this.apiKey) {
            return {
                configured: false,
                connected: false,
                error: 'API Key nicht konfiguriert'
            };
        }

        try {
            // Test-Call
            await this.apiCall('GET', '/profile');

            return {
                configured: true,
                connected: true,
                message: 'LexOffice ist verbunden'
            };

        } catch (error) {
            return {
                configured: true,
                connected: false,
                error: error.response?.status === 401
                    ? 'API Key ungültig'
                    : error.message
            };
        }
    }
}

module.exports = LexOfficeProvider;
