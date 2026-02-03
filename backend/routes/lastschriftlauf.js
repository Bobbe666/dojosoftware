const express = require("express");
const db = require("../db");
const logger = require("../utils/logger");
const SepaXmlGenerator = require("../utils/sepaXmlGenerator");
const router = express.Router();

/**
 * API-Route: Verfügbare Bankkonten für SEPA-Lastschrift abrufen
 * GET /api/lastschriftlauf/banken
 */
router.get("/banken", (req, res) => {
    const { dojo_id } = req.query;

    let query = `
        SELECT
            id, dojo_id, bank_name, iban, bic, kontoinhaber,
            sepa_glaeubiger_id, ist_standard, ist_aktiv
        FROM dojo_banken
        WHERE bank_typ = 'bank'
          AND ist_aktiv = 1
          AND iban IS NOT NULL
          AND iban != ''
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
            iban_masked: bank.iban ? bank.iban.substring(0, 4) + '****' + bank.iban.slice(-4) : '',
            iban_full: bank.iban
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
 */
router.get("/preview", (req, res) => {
    try {
        // Monat und Jahr aus Query-Parametern oder aktuelle Werte
        const now = new Date();
        const monat = parseInt(req.query.monat) || (now.getMonth() + 1);
        const jahr = parseInt(req.query.jahr) || now.getFullYear();

        // Berechne Start- und Enddatum des Monats für die Beitrags-Filterung
        const monatStart = `${jahr}-${String(monat).padStart(2, '0')}-01`;
        const monatEnde = `${jahr}-${String(monat).padStart(2, '0')}-31`;

        logger.debug('📢 Preview-Route aufgerufen', { monat, jahr, monatStart, monatEnde });

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
                b.betrag as beitrag_betrag,
                b.beitrag_id,
                COALESCE(v.monatsbeitrag, 0) as monatlicher_beitrag,
                COALESCE(GROUP_CONCAT(DISTINCT t.name SEPARATOR ', '), 'Kein Tarif') as tarif_name,
                'monatlich' as zahlungszyklus
            FROM mitglieder m
            JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
            LEFT JOIN tarife t ON v.tarif_id = t.id
            -- Nur Mitglieder mit offenen Beiträgen für den ausgewählten Monat
            JOIN beitraege b ON m.mitglied_id = b.mitglied_id
                AND b.bezahlt = 0
                AND b.zahlungsdatum >= ?
                AND b.zahlungsdatum <= ?
            INNER JOIN (
                SELECT mitglied_id, bankname, mandatsreferenz, glaeubiger_id
                FROM sepa_mandate
                WHERE status = 'aktiv' AND mandatsreferenz IS NOT NULL
            ) sm ON m.mitglied_id = sm.mitglied_id
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
            GROUP BY m.mitglied_id, m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                     m.zahlungsmethode, sm.bankname, sm.mandatsreferenz, sm.glaeubiger_id,
                     b.betrag, b.beitrag_id, v.monatsbeitrag
            ORDER BY m.nachname, m.vorname
        `;

        db.query(query, [monatStart, monatEnde], (err, results) => {
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

                const preview = results.map(r => ({
                    mitglied_id: r.mitglied_id,
                    name: `${r.vorname || ''} ${r.nachname || ''}`.trim(),
                    iban: maskIBAN(r.iban),
                    // Verwende Betrag aus beitraege-Tabelle
                    betrag: parseFloat(r.beitrag_betrag || r.monatlicher_beitrag || 0),
                    mandatsreferenz: r.mandatsreferenz || 'KEIN MANDAT',
                    tarif: r.tarif_name || 'Kein Tarif',
                    zahlungszyklus: r.zahlungszyklus || 'monatlich',
                    bank: r.bankname || 'Unbekannt',
                    beitrag_id: r.beitrag_id
                }));

                // Berechne Gesamtsumme aus den Beiträgen
                const totalAmount = results.reduce((sum, r) =>
                    sum + parseFloat(r.beitrag_betrag || r.monatlicher_beitrag || 0), 0
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

module.exports = router;
