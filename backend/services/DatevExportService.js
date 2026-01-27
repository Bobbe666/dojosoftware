// ============================================================================
// DATEV EXPORT SERVICE
// Backend/services/DatevExportService.js
// Generiert echte DATEV-Export-Dateien (ASCII-Format)
// ============================================================================

const db = require('../db');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

class DatevExportService {
    constructor(config) {
        this.config = config;
        // DATEV Standard-Konten
        this.defaultAccounts = {
            erloes_mitgliedsbeitrag: '8400', // Erlöse 19% USt
            erloes_kurse: '8400',
            erloes_sonstiges: '8400',
            erloes_steuerfrei: '8120', // Erlöse steuerfrei
            bank: '1200', // Bank
            kasse: '1000', // Kasse
            forderungen: '1400', // Forderungen aus L+L
            verbindlichkeiten: '1600' // Verbindlichkeiten aus L+L
        };
    }

    // ========================================================================
    // DATEV HEADER (Pflichtformat)
    // ========================================================================

    /**
     * Generiert den DATEV-Header für Buchungsstapel
     */
    generateHeader(exportData) {
        const {
            beraterNr = this.config.datev_consultant_number || '0',
            mandantenNr = this.config.datev_client_number || '0',
            wjBeginn = new Date().getFullYear() + '0101',
            sachkontenlaenge = 4,
            datumVon,
            datumBis,
            bezeichnung = 'Dojo Export'
        } = exportData;

        // DATEV Header-Zeile (Format-Version 700)
        const headerFields = [
            'EXTF', // Kennzeichen für externes Format
            '700', // Format-Version
            '21', // Datenkategorie (21 = Buchungsstapel)
            'Buchungsstapel', // Formatname
            '12', // Format-Version
            this.formatDate(new Date()), // Erzeugt am
            '', // Importiert
            'DO', // Herkunft (DO = DojoSoftware)
            '', // Exportiert von
            '', // Importiert von
            beraterNr, // Berater-Nummer
            mandantenNr, // Mandanten-Nummer
            wjBeginn, // WJ-Beginn (YYYYMMDD)
            sachkontenlaenge, // Sachkontenlänge
            this.formatDate(new Date(datumVon)), // Datum von
            this.formatDate(new Date(datumBis)), // Datum bis
            bezeichnung, // Bezeichnung
            '', // Diktatkürzel
            '1', // Buchungstyp (1 = Fibu)
            '0', // Rechnungslegungszweck
            '', // Festschreibung
            'EUR' // Währungskennzeichen
        ];

        return headerFields.join(';') + '\r\n';
    }

    /**
     * Generiert die Spaltenüberschriften
     */
    generateColumnHeaders() {
        const columns = [
            'Umsatz (ohne Soll/Haben-Kz)',
            'Soll/Haben-Kennzeichen',
            'WKZ Umsatz',
            'Kurs',
            'Basis-Umsatz',
            'WKZ Basis-Umsatz',
            'Konto',
            'Gegenkonto (ohne BU-Schlüssel)',
            'BU-Schlüssel',
            'Belegdatum',
            'Belegfeld 1',
            'Belegfeld 2',
            'Skonto',
            'Buchungstext',
            'Postensperre',
            'Diverse Adressnummer',
            'Geschäftspartnerbank',
            'Sachverhalt',
            'Zinssperre',
            'Beleglink',
            'Beleginfo - Art 1',
            'Beleginfo - Inhalt 1',
            'Beleginfo - Art 2',
            'Beleginfo - Inhalt 2',
            'Beleginfo - Art 3',
            'Beleginfo - Inhalt 3',
            'Beleginfo - Art 4',
            'Beleginfo - Inhalt 4',
            'Beleginfo - Art 5',
            'Beleginfo - Inhalt 5',
            'Beleginfo - Art 6',
            'Beleginfo - Inhalt 6',
            'Beleginfo - Art 7',
            'Beleginfo - Inhalt 7',
            'Beleginfo - Art 8',
            'Beleginfo - Inhalt 8',
            'KOST1 - Kostenstelle',
            'KOST2 - Kostenstelle',
            'Kost-Menge',
            'EU-Land u. UStID',
            'EU-Steuersatz',
            'Abw. Versteuerungsart',
            'Sachverhalt L+L',
            'Funktionsergänzung L+L',
            'BU 49 Hauptfunktionstyp',
            'BU 49 Hauptfunktionsnummer',
            'BU 49 Funktionsergänzung',
            'Zusatzinformation - Art 1',
            'Zusatzinformation- Inhalt 1',
            'Zusatzinformation - Art 2',
            'Zusatzinformation- Inhalt 2',
            'Zusatzinformation - Art 3',
            'Zusatzinformation- Inhalt 3',
            'Zusatzinformation - Art 4',
            'Zusatzinformation- Inhalt 4',
            'Zusatzinformation - Art 5',
            'Zusatzinformation- Inhalt 5',
            'Zusatzinformation - Art 6',
            'Zusatzinformation- Inhalt 6',
            'Zusatzinformation - Art 7',
            'Zusatzinformation- Inhalt 7',
            'Zusatzinformation - Art 8',
            'Zusatzinformation- Inhalt 8',
            'Zusatzinformation - Art 9',
            'Zusatzinformation- Inhalt 9',
            'Zusatzinformation - Art 10',
            'Zusatzinformation- Inhalt 10',
            'Zusatzinformation - Art 11',
            'Zusatzinformation- Inhalt 11',
            'Zusatzinformation - Art 12',
            'Zusatzinformation- Inhalt 12',
            'Zusatzinformation - Art 13',
            'Zusatzinformation- Inhalt 13',
            'Zusatzinformation - Art 14',
            'Zusatzinformation- Inhalt 14',
            'Zusatzinformation - Art 15',
            'Zusatzinformation- Inhalt 15',
            'Zusatzinformation - Art 16',
            'Zusatzinformation- Inhalt 16',
            'Zusatzinformation - Art 17',
            'Zusatzinformation- Inhalt 17',
            'Zusatzinformation - Art 18',
            'Zusatzinformation- Inhalt 18',
            'Zusatzinformation - Art 19',
            'Zusatzinformation- Inhalt 19',
            'Zusatzinformation - Art 20',
            'Zusatzinformation- Inhalt 20',
            'Stück',
            'Gewicht',
            'Zahlweise',
            'Forderungsart',
            'Veranlagungsjahr',
            'Zugeordnete Fälligkeit',
            'Skontotyp',
            'Auftragsnummer',
            'Buchungstyp',
            'USt-Schlüssel (Anzahlungen)',
            'EU-Land (Anzahlungen)',
            'Sachverhalt L+L (Anzahlungen)',
            'EU-Steuersatz (Anzahlungen)',
            'Erlöskonto (Anzahlungen)',
            'Herkunft-Kz',
            'Buchungs GUID',
            'KOST-Datum',
            'SEPA-Mandatsreferenz',
            'Skontosperre',
            'Gesellschaftername',
            'Beteiligtennummer',
            'Identifikationsnummer',
            'Zeichnernummer',
            'Postensperre bis',
            'Bezeichnung SoBil-Sachverhalt',
            'Kennzeichen SoBil-Buchung',
            'Festschreibung',
            'Leistungsdatum',
            'Datum Zuord. Steuerperiode',
            'Fälligkeit',
            'Generalumkehr (GU)',
            'Steuersatz',
            'Land'
        ];

        return columns.join(';') + '\r\n';
    }

    // ========================================================================
    // BUCHUNGSZEILEN
    // ========================================================================

    /**
     * Generiert eine Buchungszeile im DATEV-Format
     */
    generateBookingLine(booking) {
        const {
            betrag,
            sollHaben = 'S', // S = Soll, H = Haben
            konto,
            gegenkonto,
            belegdatum,
            belegnummer,
            buchungstext,
            kostenstelle = '',
            mwstSatz = 19
        } = booking;

        // Betrag formatieren (Komma als Dezimaltrenner)
        const formattedBetrag = Math.abs(betrag).toFixed(2).replace('.', ',');

        // BU-Schlüssel basierend auf MwSt
        let buSchluessel = '';
        if (mwstSatz === 19) buSchluessel = '3'; // 19% USt
        else if (mwstSatz === 7) buSchluessel = '2'; // 7% USt
        else if (mwstSatz === 0) buSchluessel = ''; // Steuerfrei

        // Belegdatum formatieren (DDMM)
        const belegDatumFormatted = this.formatBelegdatum(new Date(belegdatum));

        // Array mit allen 120 Feldern (leere Felder als '')
        const fields = new Array(120).fill('');

        // Pflichtfelder setzen
        fields[0] = formattedBetrag; // Umsatz
        fields[1] = sollHaben; // Soll/Haben
        fields[2] = 'EUR'; // WKZ
        fields[3] = ''; // Kurs
        fields[4] = ''; // Basis-Umsatz
        fields[5] = ''; // WKZ Basis
        fields[6] = konto; // Konto
        fields[7] = gegenkonto; // Gegenkonto
        fields[8] = buSchluessel; // BU-Schlüssel
        fields[9] = belegDatumFormatted; // Belegdatum
        fields[10] = belegnummer || ''; // Belegfeld 1
        fields[11] = ''; // Belegfeld 2
        fields[12] = ''; // Skonto
        fields[13] = this.sanitizeText(buchungstext || ''); // Buchungstext (max 60 Zeichen)
        fields[36] = kostenstelle; // KOST1

        return fields.join(';') + '\r\n';
    }

    // ========================================================================
    // EXPORT FUNKTIONEN
    // ========================================================================

    /**
     * Exportiert Rechnungen in DATEV-Format
     */
    async exportInvoices(dojoId, startDate, endDate) {
        try {
            // Rechnungen laden
            const [rechnungen] = await db.promise().query(`
                SELECT
                    r.*,
                    m.vorname,
                    m.nachname,
                    m.mitglied_id
                FROM rechnungen r
                LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
                WHERE r.dojo_id = ?
                AND r.rechnungsdatum BETWEEN ? AND ?
                ORDER BY r.rechnungsdatum ASC
            `, [dojoId, startDate, endDate]);

            if (rechnungen.length === 0) {
                return {
                    success: true,
                    message: 'Keine Rechnungen im Zeitraum gefunden',
                    data: null
                };
            }

            // Export generieren
            let exportContent = this.generateHeader({
                datumVon: startDate,
                datumBis: endDate,
                bezeichnung: `Rechnungen ${startDate} - ${endDate}`
            });

            exportContent += this.generateColumnHeaders();

            // Buchungszeilen generieren
            for (const rechnung of rechnungen) {
                const buchungstext = `RE ${rechnung.rechnungsnummer} ${rechnung.vorname} ${rechnung.nachname}`.substring(0, 60);

                // Forderung an Erlöse
                exportContent += this.generateBookingLine({
                    betrag: rechnung.betrag_brutto || rechnung.betrag,
                    sollHaben: 'S',
                    konto: this.getDebitorkonto(rechnung.mitglied_id),
                    gegenkonto: this.getErloskonto(rechnung.typ || 'mitgliedsbeitrag'),
                    belegdatum: rechnung.rechnungsdatum,
                    belegnummer: rechnung.rechnungsnummer,
                    buchungstext: buchungstext,
                    mwstSatz: rechnung.mwst_satz || 19
                });
            }

            // In Windows-1252 konvertieren (DATEV-Standard)
            const encodedContent = iconv.encode(exportContent, 'win1252');

            // Dateiname generieren
            const filename = `EXTF_Buchungsstapel_${this.formatDate(new Date())}.csv`;

            // Export in DB loggen
            await this.logExport(dojoId, 'invoices', rechnungen.length, startDate, endDate);

            return {
                success: true,
                filename,
                content: encodedContent,
                contentType: 'text/csv; charset=windows-1252',
                recordCount: rechnungen.length
            };

        } catch (error) {
            logger.error('❌ DATEV Export Fehler:', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Exportiert Zahlungseingänge in DATEV-Format
     */
    async exportPayments(dojoId, startDate, endDate) {
        try {
            // Zahlungen laden
            const [zahlungen] = await db.promise().query(`
                SELECT
                    z.*,
                    m.vorname,
                    m.nachname,
                    m.mitglied_id,
                    r.rechnungsnummer
                FROM zahlungen z
                LEFT JOIN mitglieder m ON z.mitglied_id = m.mitglied_id
                LEFT JOIN rechnungen r ON z.rechnung_id = r.rechnung_id
                WHERE z.dojo_id = ?
                AND z.zahlungsdatum BETWEEN ? AND ?
                ORDER BY z.zahlungsdatum ASC
            `, [dojoId, startDate, endDate]);

            if (zahlungen.length === 0) {
                return {
                    success: true,
                    message: 'Keine Zahlungen im Zeitraum gefunden',
                    data: null
                };
            }

            // Export generieren
            let exportContent = this.generateHeader({
                datumVon: startDate,
                datumBis: endDate,
                bezeichnung: `Zahlungen ${startDate} - ${endDate}`
            });

            exportContent += this.generateColumnHeaders();

            for (const zahlung of zahlungen) {
                const buchungstext = `ZA ${zahlung.rechnungsnummer || ''} ${zahlung.vorname} ${zahlung.nachname}`.substring(0, 60);

                // Bank an Forderungen
                exportContent += this.generateBookingLine({
                    betrag: zahlung.betrag,
                    sollHaben: 'S',
                    konto: this.getBankkonto(zahlung.zahlungsart),
                    gegenkonto: this.getDebitorkonto(zahlung.mitglied_id),
                    belegdatum: zahlung.zahlungsdatum,
                    belegnummer: zahlung.referenz || zahlung.zahlung_id,
                    buchungstext: buchungstext,
                    mwstSatz: 0 // Zahlung ohne USt
                });
            }

            const encodedContent = iconv.encode(exportContent, 'win1252');
            const filename = `EXTF_Zahlungen_${this.formatDate(new Date())}.csv`;

            await this.logExport(dojoId, 'payments', zahlungen.length, startDate, endDate);

            return {
                success: true,
                filename,
                content: encodedContent,
                contentType: 'text/csv; charset=windows-1252',
                recordCount: zahlungen.length
            };

        } catch (error) {
            logger.error('❌ DATEV Export Fehler:', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Exportiert Stammdaten (Debitoren) in DATEV-Format
     */
    async exportDebitoren(dojoId) {
        try {
            const [mitglieder] = await db.promise().query(`
                SELECT * FROM mitglieder
                WHERE dojo_id = ? AND status = 'aktiv'
                ORDER BY nachname, vorname
            `, [dojoId]);

            if (mitglieder.length === 0) {
                return {
                    success: true,
                    message: 'Keine aktiven Mitglieder gefunden',
                    data: null
                };
            }

            // Stammdaten-Header (Format 16 = Debitoren/Kreditoren)
            const headerFields = [
                'EXTF', '700', '16', 'Debitoren/Kreditoren', '5',
                this.formatDate(new Date()), '', 'DO', '', '',
                this.config.datev_consultant_number || '0',
                this.config.datev_client_number || '0',
                new Date().getFullYear() + '0101', '4', '', '', 'Mitglieder', '', '', '', '', 'EUR'
            ];

            let exportContent = headerFields.join(';') + '\r\n';

            // Spaltenüberschriften für Stammdaten
            const columns = [
                'Konto', 'Name (Adressattyp Unternehmen)', 'Unternehmensgegenstand',
                'Name (Adressattyp natürl. Person)', 'Vorname (Adressattyp natürl. Person)',
                'Name (Adressattyp keine Angabe)', 'Adressattyp', 'Kurzbezeichnung',
                'EU-Land', 'EU-UStID', 'Anrede', 'Titel/Akad. Grad', 'Adelstitel',
                'Namensvorsatz', 'Adressart', 'Straße', 'Postfach', 'Postleitzahl',
                'Ort', 'Land', 'Versandzusatz', 'Adresszusatz', 'Abweichende Anrede',
                'Abw. Zustellbezeichnung 1', 'Abw. Zustellbezeichnung 2', 'Kennz. Korrespondenzadresse',
                'Adresse Gültig von', 'Adresse Gültig bis', 'Telefon', 'Bemerkung (Telefon)',
                'Telefon GL', 'Bemerkung (Telefon GL)', 'E-Mail', 'Bemerkung (E-Mail)',
                'Internet', 'Bemerkung (Internet)', 'Fax', 'Bemerkung (Fax)', 'Sonstige',
                'Bemerkung (Sonstige)', 'Bankleitzahl 1', 'Bankbezeichnung 1', 'Bank-Kontonummer 1',
                'Länderkennzeichen 1', 'IBAN-Nr. 1', 'Leerfeld', 'SWIFT-Code 1', 'Abw. Kontoinhaber 1',
                'Kennz. Hauptbankverb. 1', 'Bankverb 1 Gültig von', 'Bankverb 1 Gültig bis'
            ];

            exportContent += columns.join(';') + '\r\n';

            // Debitoren-Zeilen
            for (const m of mitglieder) {
                const fields = new Array(columns.length).fill('');

                fields[0] = this.getDebitorkonto(m.mitglied_id); // Konto
                fields[3] = this.sanitizeText(m.nachname); // Name natürl. Person
                fields[4] = this.sanitizeText(m.vorname); // Vorname
                fields[6] = '1'; // Adressattyp (1 = natürliche Person)
                fields[7] = `${m.nachname}, ${m.vorname}`.substring(0, 15); // Kurzbezeichnung
                fields[15] = this.sanitizeText(m.strasse || ''); // Straße
                fields[17] = m.plz || ''; // PLZ
                fields[18] = this.sanitizeText(m.ort || ''); // Ort
                fields[19] = 'DE'; // Land
                fields[28] = m.telefon || ''; // Telefon
                fields[32] = m.email || ''; // E-Mail
                fields[44] = m.iban || ''; // IBAN

                exportContent += fields.join(';') + '\r\n';
            }

            const encodedContent = iconv.encode(exportContent, 'win1252');
            const filename = `EXTF_Debitoren_${this.formatDate(new Date())}.csv`;

            await this.logExport(dojoId, 'debitoren', mitglieder.length, null, null);

            return {
                success: true,
                filename,
                content: encodedContent,
                contentType: 'text/csv; charset=windows-1252',
                recordCount: mitglieder.length
            };

        } catch (error) {
            logger.error('❌ DATEV Debitoren Export Fehler:', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ========================================================================
    // HELPER FUNKTIONEN
    // ========================================================================

    /**
     * Generiert ein Debitoren-Konto aus der Mitglied-ID
     * Standard: 10000 + Mitglied-ID
     */
    getDebitorkonto(mitgliedId) {
        return String(10000 + parseInt(mitgliedId));
    }

    /**
     * Gibt das passende Erlöskonto zurück
     */
    getErloskonto(typ) {
        const konten = {
            'mitgliedsbeitrag': this.defaultAccounts.erloes_mitgliedsbeitrag,
            'kurs': this.defaultAccounts.erloes_kurse,
            'pruefung': this.defaultAccounts.erloes_sonstiges,
            'shop': this.defaultAccounts.erloes_sonstiges,
            'steuerfrei': this.defaultAccounts.erloes_steuerfrei
        };
        return konten[typ] || this.defaultAccounts.erloes_mitgliedsbeitrag;
    }

    /**
     * Gibt das Bankkonto basierend auf Zahlungsart zurück
     */
    getBankkonto(zahlungsart) {
        if (zahlungsart === 'bar' || zahlungsart === 'kasse') {
            return this.defaultAccounts.kasse;
        }
        return this.defaultAccounts.bank;
    }

    /**
     * Formatiert Datum für DATEV (YYYYMMDD)
     */
    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Formatiert Belegdatum für DATEV (DDMM)
     */
    formatBelegdatum(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}${month}`;
    }

    /**
     * Bereinigt Text für DATEV (keine Sonderzeichen)
     */
    sanitizeText(text) {
        if (!text) return '';
        return text
            .replace(/[;"\r\n]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 60);
    }

    /**
     * Loggt einen Export in die Datenbank
     */
    async logExport(dojoId, exportType, recordCount, startDate, endDate) {
        return new Promise((resolve, reject) => {
            db.query(`
                INSERT INTO datev_exports (dojo_id, export_type, record_count, start_date, end_date, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            `, [dojoId, exportType, recordCount, startDate, endDate], (err, result) => {
                if (err) {
                    logger.error('Fehler beim Loggen des DATEV-Exports:', err);
                    return resolve(); // Nicht kritisch
                }
                resolve(result);
            });
        });
    }

    // ========================================================================
    // STATUS
    // ========================================================================

    getStatus() {
        const hasConfig = !!(
            this.config.datev_consultant_number &&
            this.config.datev_client_number
        );

        return {
            configured: hasConfig,
            exportReady: true,
            consultantNumber: this.config.datev_consultant_number || 'Nicht konfiguriert',
            clientNumber: this.config.datev_client_number || 'Nicht konfiguriert',
            message: hasConfig
                ? 'DATEV Export ist bereit'
                : 'Berater- und Mandantennummer müssen konfiguriert werden'
        };
    }
}

module.exports = DatevExportService;
