const express = require("express");
const db = require("../db");
const logger = require("../utils/logger");
const SepaXmlGenerator = require("../utils/sepaXmlGenerator");
const PaymentProviderFactory = require("../services/PaymentProviderFactory");
const router = express.Router();

/**
 * API-Route: Verfügbare Bankkonten für SEPA-Lastschrift abrufen
 * GET /api/lastschriftlauf/banken
 */
router.get("/banken", (req, res) => {
    const { dojo_id } = req.query;

    let query = `
        SELECT
            db.id, db.dojo_id, db.bank_name, db.bank_typ, db.iban, db.bic, db.kontoinhaber,
            db.sepa_glaeubiger_id, db.ist_standard, db.ist_aktiv,
            d.dojoname
        FROM dojo_banken db
        LEFT JOIN dojo d ON db.dojo_id = d.id
        WHERE db.ist_aktiv = 1
    `;
    const params = [];

    if (dojo_id) {
        query += ' AND dojo_id = ?';
        params.push(parseInt(dojo_id));
    }

    query += ' ORDER BY ist_standard DESC, bank_name ASC';

    db.query(query, params, (err, results) => {
        if (err) {
            logger.error('Fehler beim Laden der Bankkonten:', err);
            return res.status(500).json({
                success: false,
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        // IBAN maskieren für die Anzeige
        const banken = results.map(bank => ({
            ...bank,
            iban_masked: bank.iban ? bank.iban.substring(0, 4) + '****' + bank.iban.slice(-4) : '(keine IBAN)',
            iban_full: bank.iban,
            typ_label: bank.bank_typ === 'bank' ? 'Bank' :
                       bank.bank_typ === 'stripe' ? 'Stripe' :
                       bank.bank_typ === 'paypal' ? 'PayPal' : 'Sonstige'
        }));

        res.json({
            success: true,
            count: banken.length,
            banken: banken
        });
    });
});

/**
 * API-Route: Generiere SEPA-Lastschrift CSV für alle aktiven Verträge
 * GET /api/lastschriftlauf
 * Query-Parameter:
 *   - monat: Monat (1-12)
 *   - jahr: Jahr
 *   - bank_id: ID des Bankkontos für den Einzug
 */
router.get("/", async (req, res) => {
    try {
        const { monat, jahr, bank_id } = req.query;
        logger.debug('📦 Starting SEPA batch file generation...', { monat, jahr, bank_id });

        // Hole Bankdaten wenn bank_id angegeben
        let selectedBank = null;
        if (bank_id) {
            const bankQuery = 'SELECT * FROM dojo_banken WHERE id = ? AND ist_aktiv = 1';
            const bankResult = await new Promise((resolve, reject) => {
                db.query(bankQuery, [bank_id], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
            if (bankResult.length > 0) {
                selectedBank = bankResult[0];
                logger.debug('💳 Ausgewählte Bank:', { bank_name: selectedBank.bank_name, iban: selectedBank.iban });
            }
        }

        // Query für alle aktiven Verträge mit SEPA-Mandat (inkl. offene Rechnungen)
        const query = `
            SELECT
                v.id as vertrag_id,
                v.mitglied_id,
                v.monatsbeitrag as monatlicher_beitrag,
                COALESCE(SUM(r.betrag), 0) as offene_rechnungen,
                v.billing_cycle as zahlungszyklus,
                v.vertragsbeginn,
                m.vorname,
                m.nachname,
                m.iban,
                m.bic,
                m.kontoinhaber,
                sm.bankname,
                m.zahlungsmethode,
                t.name as tarif_name,
                t.price_cents,
                sm.mandatsreferenz,
                sm.glaeubiger_id,
                sm.erstellungsdatum as mandat_datum
            FROM vertraege v
            JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
            LEFT JOIN tarife t ON v.tarif_id = t.id
            LEFT JOIN sepa_mandate sm ON v.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            LEFT JOIN rechnungen r ON v.mitglied_id = r.mitglied_id
                AND r.status IN ('offen', 'teilweise_bezahlt', 'ueberfaellig')
                AND r.archiviert = 0
            WHERE v.status = 'aktiv'
              AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND sm.mandatsreferenz IS NOT NULL
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
            GROUP BY v.id, v.mitglied_id, v.monatsbeitrag, v.billing_cycle, v.vertragsbeginn,
                     m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                     sm.bankname, m.zahlungsmethode, t.name, t.price_cents,
                     sm.mandatsreferenz, sm.glaeubiger_id, sm.erstellungsdatum
            ORDER BY m.nachname, m.vorname
        `;

        db.query(query, (err, results) => {
            if (err) {
                logger.error('Database error:', err);
                return res.status(500).json({
                    error: 'Datenbankfehler',
                    details: err.message
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    error: 'Keine aktiven Verträge mit SEPA-Lastschrift gefunden'
                });
            }

            logger.info(`Found ${results.length} active contracts with SEPA mandate`);

            // Verwende ausgewählte Bank oder ermittle häufigste Bank
            const bankName = selectedBank ? selectedBank.bank_name : getMostCommonBank(results);

            // Generiere CSV mit Bankinfo
            const csvData = generateSepaCSV(results, selectedBank);
            const dateStr = new Date().toISOString().split('T')[0];
            const monthStr = monat ? String(monat).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
            const yearStr = jahr || new Date().getFullYear();
            const filename = `SEPA_Lastschriftlauf_${yearStr}-${monthStr}_${dateStr}.csv`;

            // Send as downloadable file
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('X-Mandate-Count', results.length);
            res.setHeader('X-Total-Amount', calculateTotalAmount(results));
            res.setHeader('X-Creditor-Bank', bankName || 'Unbekannt');
            if (selectedBank) {
                res.setHeader('X-Creditor-IBAN', selectedBank.iban || '');
                res.setHeader('X-Creditor-Name', selectedBank.kontoinhaber || '');
            }

            res.send('\uFEFF' + csvData); // UTF-8 BOM für Excel

            logger.debug(`📄 SEPA batch file generated: ${filename} via ${bankName}`);
        });

    } catch (error) {
        logger.error('Error generating SEPA batch file:', error);
        res.status(500).json({
            error: 'Fehler bei der Lastschrift-Generierung',
            details: error.message
        });
    }
});

/**
 * API-Route: Generiere SEPA-XML (PAIN.008.001.02)
 * GET /api/lastschriftlauf/xml
 */
router.get("/xml", async (req, res) => {
    try {
        logger.debug('📦 Starting SEPA XML generation (PAIN.008.001.02)...');

        // Hole Dojo-Daten fuer Glaeubigerr-Informationen
        const dojoQuery = `
            SELECT
                dojoname, inhaber, strasse, hausnummer, plz, ort,
                sepa_glaeubiger_id, iban, bic, bank_iban, bank_bic
            FROM dojo
            WHERE ist_aktiv = TRUE
            ORDER BY ist_hauptdojo DESC
            LIMIT 1
        `;

        db.query(dojoQuery, (dojoErr, dojoResults) => {
            if (dojoErr) {
                logger.error('Dojo data error:', dojoErr);
                return res.status(500).json({
                    error: 'Dojo-Daten konnten nicht geladen werden',
                    details: dojoErr.message
                });
            }

            if (!dojoResults || dojoResults.length === 0) {
                return res.status(400).json({
                    error: 'Kein aktives Dojo gefunden',
                    details: 'Bitte konfigurieren Sie ein Hauptdojo in den Einstellungen'
                });
            }

            const dojo = dojoResults[0];

            // Validiere Glaeubigerr-ID
            if (!dojo.sepa_glaeubiger_id) {
                return res.status(400).json({
                    error: 'Keine SEPA Glaeubigerr-ID konfiguriert',
                    details: 'Bitte hinterlegen Sie die Glaeubigerr-ID in den Dojo-Einstellungen'
                });
            }

            // Validiere Glaeubigerr-IBAN
            const creditorIban = dojo.iban || dojo.bank_iban;
            if (!creditorIban) {
                return res.status(400).json({
                    error: 'Keine Dojo-IBAN konfiguriert',
                    details: 'Bitte hinterlegen Sie die IBAN des Dojos in den Einstellungen'
                });
            }

            // Hole Lastschrift-Daten (gleiche Query wie CSV)
            const query = `
                SELECT
                    v.id as vertrag_id,
                    v.mitglied_id,
                    v.monatsbeitrag as monatlicher_beitrag,
                    COALESCE(SUM(r.betrag), 0) as offene_rechnungen,
                    m.vorname,
                    m.nachname,
                    m.iban,
                    m.bic,
                    m.kontoinhaber,
                    t.name as tarif_name,
                    t.price_cents,
                    sm.mandatsreferenz,
                    sm.glaeubiger_id,
                    sm.erstellungsdatum as mandat_datum
                FROM vertraege v
                JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
                LEFT JOIN tarife t ON v.tarif_id = t.id
                LEFT JOIN sepa_mandate sm ON v.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
                LEFT JOIN rechnungen r ON v.mitglied_id = r.mitglied_id
                    AND r.status IN ('offen', 'teilweise_bezahlt', 'ueberfaellig')
                    AND r.archiviert = 0
                WHERE v.status = 'aktiv'
                  AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
                  AND sm.mandatsreferenz IS NOT NULL
                  AND m.iban IS NOT NULL
                  AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
                GROUP BY v.id, v.mitglied_id, v.monatsbeitrag,
                         m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                         t.name, t.price_cents, sm.mandatsreferenz, sm.glaeubiger_id, sm.erstellungsdatum
                ORDER BY m.nachname, m.vorname
            `;

            db.query(query, (err, results) => {
                if (err) {
                    logger.error('Database error:', err);
                    return res.status(500).json({
                        error: 'Datenbankfehler',
                        details: err.message
                    });
                }

                if (results.length === 0) {
                    return res.status(404).json({
                        error: 'Keine aktiven Vertraege mit SEPA-Lastschrift gefunden'
                    });
                }

                // Transformiere Daten fuer XML-Generator
                const transactions = results.map(r => ({
                    mitglied_id: r.mitglied_id,
                    vorname: r.vorname,
                    nachname: r.nachname,
                    iban: r.iban,
                    bic: r.bic,
                    kontoinhaber: r.kontoinhaber || `${r.vorname} ${r.nachname}`,
                    betrag: calculateAmount(r),
                    mandatsreferenz: r.mandatsreferenz,
                    mandat_datum: r.mandat_datum,
                    verwendungszweck: `Mitgliedsbeitrag ${r.tarif_name || 'Standard'} - ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`
                }));

                // Berechne Einzugsdatum (5 Bankarbeitstage in der Zukunft)
                const collectionDate = calculateCollectionDate(5);

                // Generiere XML
                const generator = new SepaXmlGenerator(dojo);
                const xml = generator.generatePainXml(transactions, collectionDate);

                // Sende als Download
                const filename = `SEPA_Lastschrift_${new Date().toISOString().split('T')[0]}.xml`;
                const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.betrag), 0).toFixed(2);

                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('X-Transaction-Count', results.length);
                res.setHeader('X-Total-Amount', totalAmount);
                res.setHeader('X-Collection-Date', collectionDate.toISOString().substring(0, 10));

                res.send(xml);

                logger.info('SEPA XML generated: ${filename} with ${results.length} transactions, total: ${totalAmount} EUR');
            });
        });

    } catch (error) {
        logger.error('Error generating SEPA XML:', error);
        res.status(500).json({
            error: 'Fehler bei der XML-Generierung',
            details: error.message
        });
    }
});

/**
 * Berechnet das naechste gueltige Einzugsdatum (Bankarbeitstage)
 */
function calculateCollectionDate(businessDays) {
    const date = new Date();
    let added = 0;

    while (added < businessDays) {
        date.setDate(date.getDate() + 1);
        const dayOfWeek = date.getDay();
        // 0 = Sonntag, 6 = Samstag
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            added++;
        }
    }

    return date;
}

/**
 * API-Route: Mitglieder mit Lastschrift aber ohne SEPA-Mandat
 * GET /api/lastschriftlauf/missing-mandates
 */
// Diagnose-Route: Zeige alle Mitglieder mit Lastschrift und ihren Status
router.get("/diagnose", (req, res) => {
    const query = `
        SELECT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.zahlungsmethode,
            (SELECT COUNT(*) FROM vertraege WHERE mitglied_id = m.mitglied_id) as total_contracts,
            (SELECT COUNT(*) FROM vertraege WHERE mitglied_id = m.mitglied_id AND status = 'aktiv') as active_contracts,
            (SELECT COUNT(*) FROM sepa_mandate WHERE mitglied_id = m.mitglied_id) as total_mandates,
            (SELECT COUNT(*) FROM sepa_mandate WHERE mitglied_id = m.mitglied_id AND status = 'aktiv' AND mandatsreferenz IS NOT NULL) as active_mandates,
            (SELECT status FROM sepa_mandate WHERE mitglied_id = m.mitglied_id LIMIT 1) as mandate_status
        FROM mitglieder m
        WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
        ORDER BY m.nachname, m.vorname
    `;

    db.query(query, (err, results) => {
        if (err) {
            logger.error('Database error:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        const summary = {
            total: results.length,
            with_active_contract: results.filter(r => r.active_contracts > 0).length,
            with_active_mandate: results.filter(r => r.active_mandates > 0).length,
            with_both: results.filter(r => r.active_contracts > 0 && r.active_mandates > 0).length,
            missing_contract: results.filter(r => r.active_contracts === 0).length,
            missing_mandate: results.filter(r => r.active_mandates === 0).length
        };

        res.json({
            success: true,
            summary,
            details: results
        });
    });
});

router.get("/missing-mandates", (req, res) => {
    const query = `
        SELECT DISTINCT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.email,
            m.zahlungsmethode,
            COUNT(v.id) as anzahl_vertraege
        FROM mitglieder m
        JOIN vertraege v ON m.mitglied_id = v.mitglied_id
        LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
        WHERE v.status = 'aktiv'
          AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
          AND sm.mandat_id IS NULL
          AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
        GROUP BY m.mitglied_id
        ORDER BY m.nachname, m.vorname
    `;

    db.query(query, (err, results) => {
        if (err) {
            logger.error('Database error:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        res.json({
            success: true,
            count: results.length,
            members: results
        });
    });
});

/**
 * API-Route: Vorschau der Lastschriften (JSON)
 * GET /api/lastschriftlauf/preview
 * Query-Parameter:
 *   - monat: Monat (1-12), default: aktueller Monat
 *   - jahr: Jahr (z.B. 2026), default: aktuelles Jahr
 *
 * WICHTIG: Zeigt ALLE offenen Beiträge bis einschließlich dem ausgewählten Monat,
 * kumuliert pro Mitglied als Gesamtsumme.
 */
router.get("/preview", (req, res) => {
    try {
        // Monat und Jahr aus Query-Parametern oder aktuelle Werte
        const now = new Date();
        const monat = parseInt(req.query.monat) || (now.getMonth() + 1);
        const jahr = parseInt(req.query.jahr) || now.getFullYear();

        // Enddatum des ausgewählten Monats (alle offenen Beiträge BIS zu diesem Datum)
        const monatEnde = `${jahr}-${String(monat).padStart(2, '0')}-31`;

        logger.debug('📢 Preview-Route aufgerufen', { monat, jahr, monatEnde });

        const query = `
            SELECT
                m.mitglied_id,
                m.vorname,
                m.nachname,
                m.iban,
                m.bic,
                m.kontoinhaber,
                m.zahlungsmethode,
                sm.bankname,
                sm.mandatsreferenz,
                sm.glaeubiger_id,
                -- Summe aller offenen Beiträge bis zum ausgewählten Monat
                SUM(b.betrag) as gesamt_betrag,
                COUNT(b.beitrag_id) as anzahl_offene_monate,
                MIN(b.zahlungsdatum) as aeltester_beitrag,
                MAX(b.zahlungsdatum) as neuester_beitrag,
                GROUP_CONCAT(DISTINCT DATE_FORMAT(b.zahlungsdatum, '%m/%Y') ORDER BY b.zahlungsdatum SEPARATOR ', ') as offene_monate,
                -- Details der einzelnen Beiträge (Format: betrag|datum|beitrag_id;...)
                GROUP_CONCAT(CONCAT(b.betrag, '|', DATE_FORMAT(b.zahlungsdatum, '%Y-%m-%d'), '|', b.beitrag_id) ORDER BY b.zahlungsdatum SEPARATOR ';') as beitraege_details,
                COALESCE(GROUP_CONCAT(DISTINCT t.name SEPARATOR ', '), 'Kein Tarif') as tarif_name,
                'monatlich' as zahlungszyklus
            FROM mitglieder m
            JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
            LEFT JOIN tarife t ON v.tarif_id = t.id
            -- Alle offenen Beiträge BIS ZUM ausgewählten Monat (kumuliert)
            JOIN beitraege b ON m.mitglied_id = b.mitglied_id
                AND b.bezahlt = 0
                AND b.zahlungsdatum <= ?
            INNER JOIN (
                SELECT mitglied_id, bankname, mandatsreferenz, glaeubiger_id
                FROM sepa_mandate
                WHERE status = 'aktiv' AND mandatsreferenz IS NOT NULL
            ) sm ON m.mitglied_id = sm.mitglied_id
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
            GROUP BY m.mitglied_id, m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                     m.zahlungsmethode, sm.bankname, sm.mandatsreferenz, sm.glaeubiger_id
            ORDER BY m.nachname, m.vorname
        `;

        db.query(query, [monatEnde], (err, results) => {
            if (err) {
                logger.error('Database error in /preview:', err);
                logger.error('SQL Query:', query);
                return res.status(500).json({
                    success: false,
                    error: 'Datenbankfehler',
                    details: err.message,
                    sqlState: err.sqlState,
                    sqlMessage: err.sqlMessage
                });
            }

            try {
                // Ermittle häufigste Bank
                const mostCommonBank = getMostCommonBank(results);

                // Hilfsfunktion zum Parsen der Beiträge-Details
                const parseBeitraegeDetails = (detailsStr) => {
                    if (!detailsStr) return [];
                    return detailsStr.split(';').map(item => {
                        const [betrag, datum, beitrag_id] = item.split('|');
                        const dateParts = datum.split('-');
                        const formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
                        return {
                            beitrag_id: parseInt(beitrag_id),
                            betrag: parseFloat(betrag),
                            datum: formattedDate,
                            monat: `${dateParts[1]}/${dateParts[0]}`
                        };
                    });
                };

                const preview = results.map(r => ({
                    mitglied_id: r.mitglied_id,
                    name: `${r.vorname || ''} ${r.nachname || ''}`.trim(),
                    iban: maskIBAN(r.iban),
                    // Gesamtbetrag aller offenen Beiträge
                    betrag: parseFloat(r.gesamt_betrag || 0),
                    anzahl_monate: r.anzahl_offene_monate || 1,
                    offene_monate: r.offene_monate || '',
                    // Einzelne Beiträge als Array
                    beitraege: parseBeitraegeDetails(r.beitraege_details),
                    mandatsreferenz: r.mandatsreferenz || 'KEIN MANDAT',
                    tarif: r.tarif_name || 'Kein Tarif',
                    zahlungszyklus: r.zahlungszyklus || 'monatlich',
                    bank: r.bankname || 'Unbekannt'
                }));

                // Berechne Gesamtsumme aller Beiträge
                const totalAmount = results.reduce((sum, r) =>
                    sum + parseFloat(r.gesamt_betrag || 0), 0
                ).toFixed(2);

                res.json({
                    success: true,
                    count: results.length,
                    total_amount: totalAmount,
                    monat: monat,
                    jahr: jahr,
                    primary_bank: mostCommonBank || 'Gemischte Banken',
                    preview: preview
                });
            } catch (processingError) {
                logger.error('Error processing preview results:', processingError);
                return res.status(500).json({
                    success: false,
                    error: 'Fehler bei der Verarbeitung der Daten',
                    details: processingError.message
                });
            }
        });
    } catch (error) {
        logger.error('Error in /preview route:', error);
        return res.status(500).json({
            success: false,
            error: 'Fehler in der Preview-Route',
            details: error.message
        });
    }
});

/**
 * Generiere SEPA-CSV im PAIN.008 Format (vereinfacht)
 * @param {Array} contracts - Liste der Verträge
 * @param {Object} creditorBank - Gläubiger-Bank (optional)
 */
function generateSepaCSV(contracts, creditorBank = null) {
    const rows = [];

    // Kopfzeile mit Gläubiger-Informationen
    if (creditorBank) {
        rows.push(`# SEPA-Lastschriftlauf - Gläubiger: ${creditorBank.kontoinhaber || creditorBank.bank_name}`);
        rows.push(`# Gläubiger-IBAN: ${creditorBank.iban}`);
        rows.push(`# Gläubiger-BIC: ${creditorBank.bic || ''}`);
        rows.push(`# Gläubiger-ID: ${creditorBank.sepa_glaeubiger_id || ''}`);
        rows.push(`# Erstellt am: ${new Date().toLocaleString('de-DE')}`);
        rows.push('');
    }

    // CSV Headers (Deutsche Bank Format)
    const headers = [
        'Mandatsreferenz',
        'IBAN',
        'BIC',
        'Kontoinhaber',
        'Betrag',
        'Währung',
        'Verwendungszweck',
        'Mandat-Datum',
        'Mitgliedsnummer',
        'Tarif'
    ];

    rows.push(headers.join(';'));

    contracts.forEach(contract => {
        const betrag = calculateAmount(contract);
        const verwendungszweck = `Mitgliedsbeitrag ${contract.tarif_name || 'Standard'} - ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;

        const row = [
            contract.mandatsreferenz || `DOJO-${contract.mitglied_id}-TEMP`,
            contract.iban,
            contract.bic || '',
            `"${contract.kontoinhaber || `${contract.vorname} ${contract.nachname}`}"`,
            betrag.toFixed(2),
            'EUR',
            `"${verwendungszweck}"`,
            contract.mandat_datum ? new Date(contract.mandat_datum).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            contract.mitglied_id,
            contract.tarif_name || 'Standard'
        ];

        rows.push(row.join(';'));
    });

    return rows.join('\n');
}

/**
 * Berechne Betrag für einen Vertrag (inkl. offene Rechnungen)
 */
function calculateAmount(contract) {
    try {
        let totalAmount = 0;

        // 1. Monatsbeitrag
        if (contract.monatlicher_beitrag != null && contract.monatlicher_beitrag !== undefined) {
            const amount = parseFloat(contract.monatlicher_beitrag);
            if (!isNaN(amount) && amount > 0) {
                totalAmount += amount;
            }
        } else if (contract.price_cents != null && contract.price_cents !== undefined) {
            // Fallback zu Tarif-Preis
            const amount = parseFloat(contract.price_cents) / 100;
            if (!isNaN(amount) && amount > 0) {
                totalAmount += amount;
            }
        }

        // 2. Offene Rechnungen hinzufügen
        if (contract.offene_rechnungen != null && contract.offene_rechnungen !== undefined) {
            const invoiceAmount = parseFloat(contract.offene_rechnungen);
            if (!isNaN(invoiceAmount) && invoiceAmount > 0) {
                totalAmount += invoiceAmount;
            }
        }

        return totalAmount;
    } catch (error) {
        logger.error('Error calculating amount for contract:', contract, error);
        return 0.00;
    }
}

/**
 * Berechne Gesamtsumme
 */
function calculateTotalAmount(contracts) {
    return contracts.reduce((sum, contract) => {
        return sum + calculateAmount(contract);
    }, 0).toFixed(2);
}

/**
 * Maskiere IBAN für Preview (zeige nur letzte 4 Stellen)
 */
function maskIBAN(iban) {
    if (!iban || iban.length < 4) return '****';
    return '****' + iban.slice(-4);
}

/**
 * Ermittle die häufigste Bank aus den Mandaten
 */
function getMostCommonBank(contracts) {
    if (!contracts || contracts.length === 0) return null;

    // Zähle Banken
    const bankCounts = {};
    contracts.forEach(contract => {
        const bank = contract.bankname || 'Unbekannt';
        bankCounts[bank] = (bankCounts[bank] || 0) + 1;
    });

    // Finde häufigste Bank
    let mostCommonBank = null;
    let maxCount = 0;

    for (const [bank, count] of Object.entries(bankCounts)) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonBank = bank;
        }
    }

    // Wenn mehrere Banken gleich häufig sind, zeige alle
    const topBanks = Object.entries(bankCounts)
        .filter(([bank, count]) => count === maxCount)
        .map(([bank]) => bank);

    if (topBanks.length > 1) {
        return topBanks.join(' / ');
    }

    return mostCommonBank;
}

// ============================================================================
// STRIPE SEPA LASTSCHRIFT ROUTES
// ============================================================================

/**
 * GET /lastschriftlauf/stripe/status
 * Prüft ob Stripe konfiguriert ist und gibt Setup-Status der Mitglieder zurück
 */
router.get("/stripe/status", async (req, res) => {
    try {
        const dojoId = req.dojo_id || req.user?.dojo_id || req.query.dojo_id;

        // Prüfe Stripe-Konfiguration
        const dojoQuery = 'SELECT stripe_secret_key, stripe_publishable_key FROM dojo WHERE id = ?';
        const dojoResult = await queryAsync(dojoQuery, [dojoId]);

        if (dojoResult.length === 0) {
            return res.json({ stripe_configured: false, message: 'Dojo nicht gefunden' });
        }

        const stripeConfigured = !!(dojoResult[0].stripe_secret_key && dojoResult[0].stripe_publishable_key);

        // Zähle Mitglieder mit/ohne Stripe Setup
        const countQuery = `
            SELECT
                COUNT(DISTINCT m.mitglied_id) as total_mit_sepa,
                COUNT(DISTINCT CASE WHEN m.stripe_customer_id IS NOT NULL AND sm.stripe_payment_method_id IS NOT NULL THEN m.mitglied_id END) as stripe_ready,
                COUNT(DISTINCT CASE WHEN m.stripe_customer_id IS NULL OR sm.stripe_payment_method_id IS NULL THEN m.mitglied_id END) as needs_setup
            FROM mitglieder m
            INNER JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
        `;

        const countResult = await queryAsync(countQuery, []);

        res.json({
            stripe_configured: stripeConfigured,
            total_mit_sepa: countResult[0]?.total_mit_sepa || 0,
            stripe_ready: countResult[0]?.stripe_ready || 0,
            needs_setup: countResult[0]?.needs_setup || 0
        });

    } catch (error) {
        logger.error('Fehler beim Prüfen des Stripe-Status:', error);
        res.status(500).json({ error: 'Fehler beim Prüfen des Stripe-Status', details: error.message });
    }
});

/**
 * POST /lastschriftlauf/stripe/setup-customer
 * Erstellt Stripe Customer + SEPA PaymentMethod für ein einzelnes Mitglied
 */
router.post("/stripe/setup-customer", async (req, res) => {
    try {
        const { mitglied_id } = req.body;
        const dojoId = req.dojo_id || req.user?.dojo_id || req.body.dojo_id;

        if (!mitglied_id) {
            return res.status(400).json({ error: 'mitglied_id erforderlich' });
        }

        // Lade Mitglied mit SEPA-Daten
        const mitgliedQuery = `
            SELECT
                m.mitglied_id, m.vorname, m.nachname, m.email, m.stripe_customer_id,
                sm.iban, sm.kontoinhaber, sm.stripe_payment_method_id
            FROM mitglieder m
            LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            WHERE m.mitglied_id = ?
        `;
        const mitgliedResult = await queryAsync(mitgliedQuery, [mitglied_id]);

        if (mitgliedResult.length === 0) {
            return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        }

        const mitglied = mitgliedResult[0];

        if (!mitglied.iban) {
            return res.status(400).json({ error: 'Mitglied hat kein aktives SEPA-Mandat mit IBAN' });
        }

        // Hole Stripe Provider
        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (!provider || !provider.createSepaCustomer) {
            return res.status(400).json({ error: 'Stripe nicht konfiguriert oder Provider unterstützt SEPA nicht' });
        }

        // Erstelle Stripe Customer + PaymentMethod
        const result = await provider.createSepaCustomer(
            mitglied,
            mitglied.iban,
            mitglied.kontoinhaber || `${mitglied.vorname} ${mitglied.nachname}`
        );

        res.json({
            success: true,
            mitglied_id: mitglied_id,
            stripe_customer_id: result.stripe_customer_id,
            stripe_payment_method_id: result.stripe_payment_method_id
        });

    } catch (error) {
        logger.error('Fehler beim Stripe Setup:', error);
        res.status(500).json({ error: 'Fehler beim Stripe Setup', details: error.message });
    }
});

/**
 * POST /lastschriftlauf/stripe/setup-all
 * Erstellt Stripe Setup für alle Mitglieder mit SEPA-Mandat aber ohne Stripe-Setup
 */
router.post("/stripe/setup-all", async (req, res) => {
    try {
        const dojoId = req.dojo_id || req.user?.dojo_id || req.body.dojo_id;

        // Finde alle Mitglieder die Setup benötigen
        const mitgliederQuery = `
            SELECT
                m.mitglied_id, m.vorname, m.nachname, m.email, m.stripe_customer_id,
                sm.iban, sm.kontoinhaber, sm.stripe_payment_method_id
            FROM mitglieder m
            INNER JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND sm.iban IS NOT NULL
              AND (m.stripe_customer_id IS NULL OR sm.stripe_payment_method_id IS NULL)
        `;
        const mitglieder = await queryAsync(mitgliederQuery, []);

        if (mitglieder.length === 0) {
            return res.json({
                success: true,
                message: 'Alle Mitglieder haben bereits ein Stripe Setup',
                processed: 0,
                succeeded: 0,
                failed: 0
            });
        }

        // Hole Stripe Provider
        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (!provider || !provider.createSepaCustomer) {
            return res.status(400).json({ error: 'Stripe nicht konfiguriert' });
        }

        const results = {
            processed: mitglieder.length,
            succeeded: 0,
            failed: 0,
            details: []
        };

        // Verarbeite jeden Mitglied
        for (const mitglied of mitglieder) {
            try {
                await provider.createSepaCustomer(
                    mitglied,
                    mitglied.iban,
                    mitglied.kontoinhaber || `${mitglied.vorname} ${mitglied.nachname}`
                );
                results.succeeded++;
                results.details.push({
                    mitglied_id: mitglied.mitglied_id,
                    name: `${mitglied.vorname} ${mitglied.nachname}`,
                    status: 'success'
                });
            } catch (error) {
                results.failed++;
                results.details.push({
                    mitglied_id: mitglied.mitglied_id,
                    name: `${mitglied.vorname} ${mitglied.nachname}`,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        res.json({
            success: results.failed === 0,
            ...results
        });

    } catch (error) {
        logger.error('Fehler beim Stripe Setup für alle:', error);
        res.status(500).json({ error: 'Fehler beim Stripe Setup', details: error.message });
    }
});

/**
 * POST /lastschriftlauf/stripe/execute
 * Führt den Lastschriftlauf über Stripe aus
 */
router.post("/stripe/execute", async (req, res) => {
    try {
        const { monat, jahr, mitglieder } = req.body;
        const dojoId = req.dojo_id || req.user?.dojo_id || req.body.dojo_id;

        if (!monat || !jahr) {
            return res.status(400).json({ error: 'Monat und Jahr erforderlich' });
        }

        if (!mitglieder || mitglieder.length === 0) {
            return res.status(400).json({ error: 'Keine Mitglieder ausgewählt' });
        }

        // Prüfe ob Beiträge bereits bezahlt sind (verhindert Doppelabbuchung)
        const filteredMitglieder = [];
        for (const mitglied of mitglieder) {
            if (mitglied.beitraege && mitglied.beitraege.length > 0) {
                const beitragIds = mitglied.beitraege.map(b => b.beitrag_id);
                const placeholders = beitragIds.map(() => '?').join(',');
                const unbezahlteBeitraege = await queryAsync(
                    `SELECT beitrag_id, betrag FROM beitraege WHERE beitrag_id IN (${placeholders}) AND bezahlt = 0`,
                    beitragIds
                );

                if (unbezahlteBeitraege.length > 0) {
                    // Nur unbezahlte Beiträge einziehen
                    const neuerBetrag = unbezahlteBeitraege.reduce((sum, b) => sum + parseFloat(b.betrag), 0);
                    filteredMitglieder.push({
                        ...mitglied,
                        beitraege: unbezahlteBeitraege.map(b => ({ beitrag_id: b.beitrag_id })),
                        betrag: neuerBetrag
                    });
                } else {
                    logger.info(`⏭️ Mitglied ${mitglied.mitglied_id}: Alle Beiträge bereits bezahlt - übersprungen`);
                }
            }
        }

        if (filteredMitglieder.length === 0) {
            return res.status(400).json({ error: 'Alle ausgewählten Beiträge sind bereits bezahlt' });
        }

        // Hole Stripe Provider
        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (!provider || !provider.processLastschriftBatch) {
            return res.status(400).json({ error: 'Stripe nicht konfiguriert' });
        }

        // Führe Batch aus (nur mit unbezahlten Beiträgen)
        const result = await provider.processLastschriftBatch(filteredMitglieder, monat, jahr);

        // Markiere erfolgreiche Beiträge als bezahlt
        if (result.succeeded > 0 || result.processing > 0) {
            for (const trans of result.transactions) {
                if (trans.status === 'succeeded' || trans.status === 'processing') {
                    // Finde die Beitrags-IDs für dieses Mitglied
                    const mitgliedData = mitglieder.find(m => m.mitglied_id === trans.mitglied_id);
                    if (mitgliedData && mitgliedData.beitraege) {
                        for (const beitrag of mitgliedData.beitraege) {
                            await queryAsync(
                                'UPDATE beitraege SET bezahlt = 1, zahlungsart = ? WHERE beitrag_id = ?',
                                ['Stripe SEPA', beitrag.beitrag_id]
                            );
                        }
                    }
                }
            }
        }

        res.json({
            success: true,
            batch_id: result.batch_id,
            total: result.total,
            succeeded: result.succeeded,
            processing: result.processing,
            failed: result.failed,
            transactions: result.transactions
        });

    } catch (error) {
        logger.error('Fehler beim Stripe Lastschriftlauf:', error);
        res.status(500).json({ error: 'Fehler beim Lastschriftlauf', details: error.message });
    }
});

/**
 * GET /lastschriftlauf/stripe/batch/:batchId
 * Ruft den Status eines Lastschrift-Batches ab
 */
router.get("/stripe/batch/:batchId", async (req, res) => {
    try {
        const { batchId } = req.params;
        const dojoId = req.dojo_id || req.user?.dojo_id || req.query.dojo_id;

        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (!provider || !provider.getBatchStatus) {
            return res.status(400).json({ error: 'Stripe nicht konfiguriert' });
        }

        const status = await provider.getBatchStatus(batchId);

        if (!status) {
            return res.status(404).json({ error: 'Batch nicht gefunden' });
        }

        res.json(status);

    } catch (error) {
        logger.error('Fehler beim Abrufen des Batch-Status:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen des Status', details: error.message });
    }
});

// Helper: Promise-basierte DB-Query
function queryAsync(sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

module.exports = router;
