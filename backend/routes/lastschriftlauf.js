const express = require("express");
const db = require("../db");
const logger = require("../utils/logger");
const SepaXmlGenerator = require("../utils/sepaXmlGenerator");
const PaymentProviderFactory = require("../services/PaymentProviderFactory");
const { getSecureDojoId } = require("../middleware/tenantSecurity");
const router = express.Router();

/**
 * API-Route: Verfügbare Bankkonten für SEPA-Lastschrift abrufen
 * GET /api/lastschriftlauf/banken
 */
router.get("/banken", (req, res) => {
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

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

    if (secureDojoId) {
        query += ' AND dojo_id = ?';
        params.push(secureDojoId);
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

        // Query für alle aktiven Verträge mit SEPA-Mandat (inkl. offene Rechnungen + aktiver Ratenplan)
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
                sm.erstellungsdatum as mandat_datum,
                rp.id as ratenplan_id,
                rp.monatlicher_aufschlag,
                rp.ausstehender_betrag as raten_ausstehend,
                rp.bereits_abgezahlt as raten_abgezahlt
            FROM vertraege v
            JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
            LEFT JOIN tarife t ON v.tarif_id = t.id
            LEFT JOIN sepa_mandate sm ON v.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            LEFT JOIN rechnungen r ON v.mitglied_id = r.mitglied_id
                AND r.status IN ('offen', 'teilweise_bezahlt', 'ueberfaellig')
                AND r.archiviert = 0
            LEFT JOIN mitglied_ratenplan rp ON v.mitglied_id = rp.mitglied_id AND rp.aktiv = 1
            WHERE v.status = 'aktiv'
              AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND sm.mandatsreferenz IS NOT NULL
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
            GROUP BY v.id, v.mitglied_id, v.monatsbeitrag, v.billing_cycle, v.vertragsbeginn,
                     m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                     sm.bankname, m.zahlungsmethode, t.name, t.price_cents,
                     sm.mandatsreferenz, sm.glaeubiger_id, sm.erstellungsdatum,
                     rp.id, rp.monatlicher_aufschlag, rp.ausstehender_betrag, rp.bereits_abgezahlt
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
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    const dojoId = req.query.dojo_id || req.user?.dojo_id;

    let whereClause = '';
    const params = [];
    if (dojoId) {
        whereClause = 'AND m.dojo_id = ?';
        params.push(parseInt(dojoId));
    }

    const query = `
        SELECT DISTINCT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.email,
            m.telefon,
            m.zahlungsmethode,
            COUNT(v.id) as anzahl_vertraege
        FROM mitglieder m
        JOIN vertraege v ON m.mitglied_id = v.mitglied_id
        LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
        WHERE v.status = 'aktiv'
          AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
          AND sm.mandat_id IS NULL
          AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
          ${whereClause}
        GROUP BY m.mitglied_id
        ORDER BY m.nachname, m.vorname
    `;

    db.query(query, params, (err, results) => {
        if (err) {
            logger.error('Database error in missing-mandates:', err);
            logger.error('Query params:', params);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message,
                sqlMessage: err.sqlMessage || null
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
 * GET /api/lastschriftlauf/not-in-run
 * Alle SEPA-Mitglieder die NICHT im aktuellen Lastschriftlauf sind, mit Grund
 */
router.get("/not-in-run", async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        const monat = parseInt(req.query.monat) || (new Date().getMonth() + 1);
        const jahr = parseInt(req.query.jahr) || new Date().getFullYear();
        const lastDayNIR = new Date(jahr, monat, 0).getDate();
        const monatEnde = `${jahr}-${String(monat).padStart(2, '0')}-${String(lastDayNIR).padStart(2, '0')}`;

        // Schritt 1: Wer ist im Lauf (wie preview-Query — kumulativ bis Monatsende)
        const inRunQuery = `
            SELECT DISTINCT m2.mitglied_id
            FROM mitglieder m2
            LEFT JOIN vertraege v2 ON m2.mitglied_id = v2.mitglied_id AND v2.status = 'aktiv'
            JOIN beitraege b2 ON m2.mitglied_id = b2.mitglied_id
                AND b2.bezahlt = 0 AND b2.zahlungsdatum <= ?
            INNER JOIN (
                SELECT mitglied_id FROM sepa_mandate
                WHERE status = 'aktiv' AND mandatsreferenz IS NOT NULL
            ) sm2 ON m2.mitglied_id = sm2.mitglied_id
            WHERE (m2.zahlungsmethode = 'SEPA-Lastschrift' OR m2.zahlungsmethode = 'Lastschrift')
              ${dojoId ? 'AND m2.dojo_id = ?' : ''}
        `;
        const inRunParams = dojoId ? [monatEnde, dojoId] : [monatEnde];
        const inRunRows = await queryAsync(inRunQuery, inRunParams);
        const inRunIds = inRunRows.map(r => r.mitglied_id);

        // Schritt 2: Alle SEPA-Mitglieder die NICHT im Lauf sind
        const notInRunWhere = inRunIds.length > 0
            ? `AND m.mitglied_id NOT IN (${inRunIds.map(() => '?').join(',')})`
            : '';

        const query = `
            SELECT
                m.mitglied_id, m.vorname, m.nachname, m.zahlungsmethode,
                v.status as vertrag_status,
                v.ruhepause_von, v.ruhepause_bis, v.vertragsende,
                sm.mandat_id, sm.mandatsreferenz,
                (SELECT COUNT(*) FROM beitraege b
                 WHERE b.mitglied_id = m.mitglied_id AND b.bezahlt = 0
                   AND b.zahlungsdatum <= ?) as offene_beitraege
            FROM mitglieder m
            LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id
                AND v.status IN ('aktiv','gekuendigt','ruhepause')
            LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id
                AND sm.status = 'aktiv' AND sm.mandatsreferenz IS NOT NULL
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
              ${dojoId ? 'AND m.dojo_id = ?' : ''}
              ${notInRunWhere}
            GROUP BY m.mitglied_id
            ORDER BY m.nachname, m.vorname
        `;

        const queryParams = [
            monatEnde,
            ...(dojoId ? [dojoId] : []),
            ...inRunIds
        ];

        const results = await queryAsync(query, queryParams);

        const members = results
            .filter(r => r.offene_beitraege > 0)
            .map(r => {
                let grund = '';
                if (!r.mandat_id) {
                    grund = 'Kein aktives SEPA-Mandat';
                } else if (!r.vertrag_status) {
                    grund = 'Kein Vertrag';
                } else if (r.vertrag_status === 'ruhepause') {
                    grund = `Ruhepause (bis ${r.ruhepause_bis ? new Date(r.ruhepause_bis).toLocaleDateString('de-DE') : '?'})`;
                } else if (r.vertrag_status === 'gekuendigt') {
                    grund = `Gekündigt (Ende ${r.vertragsende ? new Date(r.vertragsende).toLocaleDateString('de-DE') : '?'})`;
                } else {
                    grund = 'Unbekannt';
                }
                return {
                    mitglied_id: r.mitglied_id,
                    name: `${r.vorname} ${r.nachname}`,
                    zahlungsmethode: r.zahlungsmethode,
                    vertrag_status: r.vertrag_status,
                    offene_beitraege: r.offene_beitraege,
                    grund
                };
            });

        res.json({ success: true, count: members.length, members });
    } catch (error) {
        logger.error('Fehler bei not-in-run:', error);
        res.status(500).json({ error: 'Fehler', details: error.message });
    }
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
router.get("/preview", async (req, res) => {
    try {
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const secureDojoId = getSecureDojoId(req);

        // Monat und Jahr aus Query-Parametern oder aktuelle Werte
        const now = new Date();
        const monat = parseInt(req.query.monat) || (now.getMonth() + 1);
        const jahr = parseInt(req.query.jahr) || now.getFullYear();

        // Korrektes Monatsende berechnen
        const lastDay = new Date(jahr, monat, 0).getDate();
        const monatEnde = `${jahr}-${String(monat).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        logger.debug('📢 Preview-Route aufgerufen', { monat, jahr, monatEnde, dojoId: secureDojoId });

        const dojoFilter = secureDojoId ? 'AND m.dojo_id = ?' : '';

        const queryAsync = (sql, params) => new Promise((resolve, reject) => {
            db.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
        });

        // Hauptquery: nur Mitglieder MIT aktivem Vertrag + Tarif
        // UND ohne laufende Stripe-Transaktion (processing)
        const mainParams = [monatEnde];
        if (secureDojoId) mainParams.push(secureDojoId);

        const mainQuery = `
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
                SUM(b.betrag) as gesamt_betrag,
                COUNT(b.beitrag_id) as anzahl_offene_monate,
                MIN(b.zahlungsdatum) as aeltester_beitrag,
                MAX(b.zahlungsdatum) as neuester_beitrag,
                GROUP_CONCAT(DISTINCT DATE_FORMAT(b.zahlungsdatum, '%m/%Y') ORDER BY b.zahlungsdatum SEPARATOR ', ') as offene_monate,
                GROUP_CONCAT(CONCAT(b.betrag, '|', DATE_FORMAT(b.zahlungsdatum, '%Y-%m-%d'), '|', b.beitrag_id, '|', COALESCE(b.magicline_description, '')) ORDER BY b.zahlungsdatum SEPARATOR ';') as beitraege_details,
                GROUP_CONCAT(DISTINCT t.name SEPARATOR ', ') as tarif_name,
                'monatlich' as zahlungszyklus,
                rp.id as ratenplan_id,
                rp.monatlicher_aufschlag,
                rp.ausstehender_betrag as raten_ausstehend,
                rp.bereits_abgezahlt as raten_abgezahlt
            FROM mitglieder m
            -- Nur Mitglieder MIT aktivem Vertrag UND Tarif
            INNER JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
            INNER JOIN tarife t ON v.tarif_id = t.id
            LEFT JOIN mitglied_ratenplan rp ON m.mitglied_id = rp.mitglied_id AND rp.aktiv = 1
            JOIN beitraege b ON m.mitglied_id = b.mitglied_id
                AND b.bezahlt = 0
                AND b.zahlungsdatum <= ?
                -- Bei aktivem Ratenplan: nur Beiträge ab dem Monat der Ratenplan-Erstellung (Rückstand läuft über Aufschlag)
                AND (rp.id IS NULL OR DATE_FORMAT(b.zahlungsdatum, '%Y-%m') >= DATE_FORMAT(rp.erstellt_am, '%Y-%m'))
                -- Beitrag nicht einziehen wenn er bereits in einer laufenden/abgeschlossenen Transaktion ist
                -- Präzise Prüfung per beitrag_id; Monats-Fallback NUR für Monatsbeiträge (veraltete beitrag_id-Referenzen in Stripe)
                AND NOT EXISTS (
                    SELECT 1 FROM stripe_lastschrift_transaktion slt
                    JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
                    WHERE slt.mitglied_id = m.mitglied_id
                      AND slt.status IN ('processing', 'succeeded')
                      AND (
                          JSON_CONTAINS(slt.beitrag_ids, CAST(b.beitrag_id AS CHAR))
                          OR (
                              b.art = 'mitgliedsbeitrag'
                              AND MONTH(b.zahlungsdatum + INTERVAL 2 HOUR) = slb.monat
                              AND YEAR(b.zahlungsdatum + INTERVAL 2 HOUR) = slb.jahr
                          )
                      )
                )
            INNER JOIN (
                SELECT mitglied_id, bankname, mandatsreferenz, glaeubiger_id
                FROM sepa_mandate
                WHERE status = 'aktiv' AND mandatsreferenz IS NOT NULL
            ) sm ON m.mitglied_id = sm.mitglied_id
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              ${dojoFilter}
            GROUP BY m.mitglied_id, m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                     m.zahlungsmethode, sm.bankname, sm.mandatsreferenz, sm.glaeubiger_id,
                     rp.id, rp.monatlicher_aufschlag, rp.ausstehender_betrag, rp.bereits_abgezahlt
            ORDER BY m.nachname, m.vorname
        `;

        // Warnliste: SEPA-Mitglieder ohne aktiven Tarif aber mit offenen Beiträgen
        const warnParams = [monatEnde];
        if (secureDojoId) warnParams.push(secureDojoId);

        const warnQuery = `
            SELECT
                m.mitglied_id,
                m.vorname,
                m.nachname,
                SUM(b.betrag) as gesamt_betrag,
                COUNT(b.beitrag_id) as anzahl,
                GROUP_CONCAT(DISTINCT DATE_FORMAT(b.zahlungsdatum, '%m/%Y') ORDER BY b.zahlungsdatum SEPARATOR ', ') as offene_monate
            FROM mitglieder m
            JOIN beitraege b ON m.mitglied_id = b.mitglied_id
                AND b.bezahlt = 0
                AND b.zahlungsdatum <= ?
            INNER JOIN (
                SELECT mitglied_id FROM sepa_mandate
                WHERE status = 'aktiv' AND mandatsreferenz IS NOT NULL
            ) sm ON m.mitglied_id = sm.mitglied_id
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              ${dojoFilter}
              AND NOT EXISTS (
                  SELECT 1 FROM vertraege v2
                  INNER JOIN tarife t2 ON v2.tarif_id = t2.id
                  WHERE v2.mitglied_id = m.mitglied_id AND v2.status = 'aktiv'
              )
            GROUP BY m.mitglied_id, m.vorname, m.nachname
            ORDER BY m.nachname, m.vorname
        `;

        // In-Verarbeitung-Liste: Mitglieder mit laufendem Stripe-Einzug (processing)
        const processingParams = secureDojoId ? [secureDojoId] : [];
        const processingQuery = `
            SELECT
                m.mitglied_id,
                m.vorname,
                m.nachname,
                slt.betrag,
                slt.batch_id,
                slt.created_at,
                slb.monat,
                slb.jahr
            FROM stripe_lastschrift_transaktion slt
            JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
            JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
            WHERE slt.status = 'processing'
              ${secureDojoId ? 'AND m.dojo_id = ?' : ''}
            ORDER BY m.nachname, m.vorname
        `;

        const verkaufParams = secureDojoId ? [secureDojoId] : [];
        const verkaufQuery = `
            SELECT
                m.mitglied_id,
                m.vorname,
                m.nachname,
                m.iban,
                sm.bankname,
                sm.mandatsreferenz,
                SUM(v.brutto_gesamt_cent) / 100 AS verkauf_betrag,
                GROUP_CONCAT(v.verkauf_id) AS verkauf_ids,
                GROUP_CONCAT(CONCAT(v.brutto_gesamt_cent / 100, '|', DATE_FORMAT(v.verkauf_datum, '%Y-%m-%d'), '|', v.verkauf_id, '|', COALESCE(v.bon_nummer, '')) ORDER BY v.verkauf_datum SEPARATOR ';') AS verkauf_details
            FROM verkaeufe v
            JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
            INNER JOIN (
                SELECT mitglied_id, bankname, mandatsreferenz
                FROM sepa_mandate WHERE status = 'aktiv' AND mandatsreferenz IS NOT NULL
            ) sm ON m.mitglied_id = sm.mitglied_id
            WHERE v.zahlungsart = 'lastschrift'
              AND v.zahlungsstatus = 'offen'
              AND v.storniert = 0
              ${secureDojoId ? 'AND v.dojo_id = ?' : ''}
            GROUP BY m.mitglied_id, m.vorname, m.nachname, m.iban, sm.bankname, sm.mandatsreferenz
        `;

        const [results, warnResults, processingResults, verkaufResults] = await Promise.all([
            queryAsync(mainQuery, mainParams),
            queryAsync(warnQuery, warnParams),
            queryAsync(processingQuery, processingParams),
            queryAsync(verkaufQuery, verkaufParams)
        ]);

        // Hilfsfunktion zum Parsen der Beiträge-Details
        const parseBeitraegeDetails = (detailsStr) => {
            if (!detailsStr) return [];
            return detailsStr.split(';').map(item => {
                const [betrag, datum, beitrag_id, beschreibung] = item.split('|');
                const dateParts = datum.split('-');
                const formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
                const displayText = beschreibung && beschreibung.trim()
                    ? beschreibung.trim()
                    : `Beitrag ${dateParts[1]}/${dateParts[0]}`;
                return {
                    beitrag_id: parseInt(beitrag_id),
                    betrag: parseFloat(betrag),
                    datum: formattedDate,
                    monat: `${dateParts[1]}/${dateParts[0]}`,
                    beschreibung: displayText
                };
            });
        };

        // Ermittle häufigste Bank
        const mostCommonBank = getMostCommonBank(results);

        const preview = results.map(r => {
            const beitragsBetrag = parseFloat(r.gesamt_betrag || 0);
            let ratenplanAufschlag = 0;
            if (r.ratenplan_id) {
                const aufschlag = parseFloat(r.monatlicher_aufschlag || 0);
                const offen = parseFloat(r.raten_ausstehend || 0) - parseFloat(r.raten_abgezahlt || 0);
                if (aufschlag > 0 && offen > 0) {
                    ratenplanAufschlag = Math.min(aufschlag, offen);
                }
            }
            return {
                mitglied_id: r.mitglied_id,
                name: `${r.vorname || ''} ${r.nachname || ''}`.trim(),
                iban: maskIBAN(r.iban),
                betrag: beitragsBetrag + ratenplanAufschlag,
                beitraege_betrag: beitragsBetrag,
                anzahl_monate: r.anzahl_offene_monate || 1,
                offene_monate: r.offene_monate || '',
                beitraege: parseBeitraegeDetails(r.beitraege_details),
                mandatsreferenz: r.mandatsreferenz || 'KEIN MANDAT',
                tarif: r.tarif_name || 'Kein Tarif',
                zahlungszyklus: r.zahlungszyklus || 'monatlich',
                bank: r.bankname || 'Unbekannt',
                ratenplan_id: r.ratenplan_id || null,
                ratenplan_aufschlag: ratenplanAufschlag,
                raten_ausstehend: r.ratenplan_id ? parseFloat(r.raten_ausstehend || 0) - parseFloat(r.raten_abgezahlt || 0) : 0
            };
        });

        // Verkäufe in Preview einmergen
        for (const vr of verkaufResults) {
            const verkaufBetrag = parseFloat(vr.verkauf_betrag || 0);
            const verkaufDetails = (vr.verkauf_details || '').split(';').map(item => {
                const [betrag, datum, vid, bon] = item.split('|');
                const dp = datum.split('-');
                return { verkauf_id: parseInt(vid), betrag: parseFloat(betrag), datum: `${dp[2]}.${dp[1]}.${dp[0]}`, beschreibung: `Verkauf Bon ${bon}` };
            });
            const existing = preview.find(p => p.mitglied_id === vr.mitglied_id);
            if (existing) {
                existing.betrag += verkaufBetrag;
                existing.verkaeufe_betrag = verkaufBetrag;
                existing.verkaeufe = verkaufDetails;
            } else {
                preview.push({
                    mitglied_id: vr.mitglied_id,
                    name: `${vr.vorname || ''} ${vr.nachname || ''}`.trim(),
                    iban: maskIBAN(vr.iban),
                    betrag: verkaufBetrag,
                    beitraege_betrag: 0,
                    anzahl_monate: 0,
                    offene_monate: '',
                    beitraege: [],
                    verkaeufe_betrag: verkaufBetrag,
                    verkaeufe: verkaufDetails,
                    mandatsreferenz: vr.mandatsreferenz || 'KEIN MANDAT',
                    tarif: '',
                    zahlungszyklus: 'einmalig',
                    bank: vr.bankname || 'Unbekannt',
                    ratenplan_id: null,
                    ratenplan_aufschlag: 0,
                    raten_ausstehend: 0
                });
            }
        }

        const ohne_tarif = warnResults.map(r => ({
            mitglied_id: r.mitglied_id,
            name: `${r.vorname || ''} ${r.nachname || ''}`.trim(),
            gesamt_betrag: parseFloat(r.gesamt_betrag || 0),
            anzahl: r.anzahl || 0,
            offene_monate: r.offene_monate || ''
        }));

        // Mitglieder mit laufendem Stripe-Einzug — gruppiert nach mitglied_id
        const processingMap = {};
        for (const r of processingResults) {
            const key = r.mitglied_id;
            if (!processingMap[key]) {
                processingMap[key] = {
                    mitglied_id: r.mitglied_id,
                    name: `${r.vorname || ''} ${r.nachname || ''}`.trim(),
                    transaktionen: []
                };
            }
            processingMap[key].transaktionen.push({
                betrag: parseFloat(r.betrag || 0),
                batch_id: r.batch_id,
                monat: r.monat,
                jahr: r.jahr,
                seit: r.created_at
            });
        }
        const in_verarbeitung = Object.values(processingMap);

        const totalAmount = results.reduce((sum, r) => sum + parseFloat(r.gesamt_betrag || 0), 0).toFixed(2);

        res.json({
            success: true,
            count: results.length,
            total_amount: totalAmount,
            monat: monat,
            jahr: jahr,
            primary_bank: mostCommonBank || 'Gemischte Banken',
            preview: preview,
            ohne_tarif: ohne_tarif,
            in_verarbeitung: in_verarbeitung
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

        // 2. Offene Rechnungen / Ratenplan-Aufschlag
        if (contract.ratenplan_id) {
            // Aktiver Ratenplan: nur monatlicher Aufschlag, NICHT alle offenen Rechnungen auf einmal
            const aufschlag = parseFloat(contract.monatlicher_aufschlag || 0);
            const ausstehend = parseFloat(contract.raten_ausstehend || 0);
            const abgezahlt = parseFloat(contract.raten_abgezahlt || 0);
            const offen = ausstehend - abgezahlt;
            if (aufschlag > 0 && offen > 0) {
                // Letzter Monat: nur noch den Restbetrag abbuchen
                totalAmount += Math.min(aufschlag, offen);
            }
        } else if (contract.offene_rechnungen != null && contract.offene_rechnungen !== undefined) {
            // Kein Ratenplan: offene Rechnungen normal einziehen
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

/**
 * POST /api/lastschriftlauf/ratenplan-mark-collected
 * Markiert Ratenplan-Aufschläge als eingezogen (für den Bankeinzug via CSV/XML).
 * Wird nach erfolgreicher Bankverarbeitung durch den Admin aufgerufen.
 * Body: { mitglieder: [{ mitglied_id, ratenplan_id, ratenplan_aufschlag }] }
 */
router.post("/ratenplan-mark-collected", async (req, res) => {
    try {
        const secureDojoId = getSecureDojoId(req);
        const { mitglieder } = req.body;

        if (!mitglieder || !Array.isArray(mitglieder) || mitglieder.length === 0) {
            return res.status(400).json({ success: false, error: 'Keine Mitglieder angegeben' });
        }

        const queryAsync = (sql, params) => new Promise((resolve, reject) => {
            db.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
        });

        let updated = 0;
        for (const m of mitglieder) {
            if (!m.ratenplan_id || !m.ratenplan_aufschlag || m.ratenplan_aufschlag <= 0) continue;

            // Sicherheitscheck: Ratenplan gehört zum richtigen Dojo
            const dojoCheck = secureDojoId
                ? `AND mi.dojo_id = ${db.escape(secureDojoId)}`
                : '';

            const rows = await queryAsync(
                `SELECT rp.id FROM mitglied_ratenplan rp
                 JOIN mitglieder mi ON rp.mitglied_id = mi.mitglied_id
                 WHERE rp.id = ? AND rp.aktiv = 1 ${dojoCheck}`,
                [m.ratenplan_id]
            );
            if (rows.length === 0) continue;

            await queryAsync(
                `UPDATE mitglied_ratenplan
                 SET bereits_abgezahlt = LEAST(bereits_abgezahlt + ?, ausstehender_betrag)
                 WHERE id = ? AND aktiv = 1`,
                [parseFloat(m.ratenplan_aufschlag), m.ratenplan_id]
            );
            updated++;
            logger.info(`✅ Ratenplan ${m.ratenplan_id} für Mitglied ${m.mitglied_id}: +${m.ratenplan_aufschlag}€ manuell als eingezogen markiert`);
        }

        res.json({ success: true, updated });

    } catch (error) {
        logger.error('Fehler in ratenplan-mark-collected:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// STRIPE SEPA LASTSCHRIFT ROUTES
// ============================================================================

/**
 * GET /lastschriftlauf/stripe/status
 * Prüft ob Stripe konfiguriert ist und gibt Setup-Status der Mitglieder zurück
 */
router.get("/stripe/status", async (req, res) => {
    try {
        const dojoId = req.query.dojo_id || req.user?.dojo_id;

        // Prüfe Stripe-Konfiguration (mind. ein Dojo mit Stripe-Key)
        const dojoQuery = dojoId
            ? 'SELECT stripe_secret_key, stripe_publishable_key FROM dojo WHERE id = ?'
            : 'SELECT stripe_secret_key, stripe_publishable_key FROM dojo WHERE stripe_secret_key IS NOT NULL AND stripe_secret_key != "" LIMIT 1';
        const dojoResult = await queryAsync(dojoQuery, dojoId ? [dojoId] : []);

        if (dojoResult.length === 0) {
            return res.json({ stripe_configured: false, message: 'Stripe nicht konfiguriert' });
        }

        const stripeConfigured = !!(dojoResult[0].stripe_secret_key && dojoResult[0].stripe_publishable_key);

        // Zähle Mitglieder mit/ohne Stripe Setup (alle Dojos bei Super-Admin)
        const countQuery = dojoId ? `
            SELECT
                COUNT(DISTINCT m.mitglied_id) as total_mit_sepa,
                COUNT(DISTINCT CASE WHEN m.stripe_customer_id IS NOT NULL AND sm.stripe_payment_method_id IS NOT NULL THEN m.mitglied_id END) as stripe_ready,
                COUNT(DISTINCT CASE WHEN m.stripe_customer_id IS NULL OR sm.stripe_payment_method_id IS NULL THEN m.mitglied_id END) as needs_setup
            FROM mitglieder m
            INNER JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND m.dojo_id = ?
        ` : `
            SELECT
                COUNT(DISTINCT m.mitglied_id) as total_mit_sepa,
                COUNT(DISTINCT CASE WHEN m.stripe_customer_id IS NOT NULL AND sm.stripe_payment_method_id IS NOT NULL THEN m.mitglied_id END) as stripe_ready,
                COUNT(DISTINCT CASE WHEN m.stripe_customer_id IS NULL OR sm.stripe_payment_method_id IS NULL THEN m.mitglied_id END) as needs_setup
            FROM mitglieder m
            INNER JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            JOIN dojo d ON m.dojo_id = d.id AND d.stripe_secret_key IS NOT NULL AND d.stripe_secret_key != ''
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
        `;

        const countResult = await queryAsync(countQuery, dojoId ? [dojoId] : []);

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
        const dojoId = req.body.dojo_id || req.user?.dojo_id;

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
        const dojoId = req.body.dojo_id || req.user?.dojo_id;

        // Finde alle Mitglieder die Setup benötigen (bei Super-Admin alle Dojos mit Stripe)
        const mitgliederQuery = dojoId ? `
            SELECT
                m.mitglied_id, m.vorname, m.nachname, m.email, m.stripe_customer_id, m.dojo_id,
                sm.iban, sm.kontoinhaber, sm.stripe_payment_method_id
            FROM mitglieder m
            INNER JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND sm.iban IS NOT NULL
              AND (m.stripe_customer_id IS NULL OR sm.stripe_payment_method_id IS NULL)
              AND m.dojo_id = ?
        ` : `
            SELECT
                m.mitglied_id, m.vorname, m.nachname, m.email, m.stripe_customer_id, m.dojo_id,
                sm.iban, sm.kontoinhaber, sm.stripe_payment_method_id
            FROM mitglieder m
            INNER JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            JOIN dojo d ON m.dojo_id = d.id AND d.stripe_secret_key IS NOT NULL AND d.stripe_secret_key != ''
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND sm.iban IS NOT NULL
              AND (m.stripe_customer_id IS NULL OR sm.stripe_payment_method_id IS NULL)
        `;
        const mitglieder = await queryAsync(mitgliederQuery, dojoId ? [dojoId] : []);

        if (mitglieder.length === 0) {
            return res.json({
                success: true,
                message: 'Alle Mitglieder haben bereits ein Stripe Setup',
                processed: 0,
                succeeded: 0,
                failed: 0
            });
        }

        // Provider-Cache pro Dojo (vermeidet mehrfache DB-Abfragen)
        const providerCache = {};

        const results = {
            processed: mitglieder.length,
            succeeded: 0,
            failed: 0,
            details: []
        };

        // Verarbeite jeden Mitglied mit dem richtigen Provider für sein Dojo
        for (const mitglied of mitglieder) {
            try {
                const memberDojoId = mitglied.dojo_id || dojoId;
                if (!providerCache[memberDojoId]) {
                    providerCache[memberDojoId] = await PaymentProviderFactory.getProvider(memberDojoId);
                }
                const provider = providerCache[memberDojoId];
                if (!provider || !provider.createSepaCustomer) {
                    throw new Error(`Stripe nicht konfiguriert für Dojo ${memberDojoId}`);
                }
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

        if (!monat || !jahr) {
            return res.status(400).json({ error: 'Monat und Jahr erforderlich' });
        }

        if (!mitglieder || mitglieder.length === 0) {
            return res.status(400).json({ error: 'Keine Mitglieder ausgewählt' });
        }

        // dojo_id aus den tatsächlichen Mitgliedern lesen (zuverlässiger als UI-Parameter,
        // da Super-Admin ggf. falsche Bank-dojo_id übergibt)
        let dojoId = req.user?.dojo_id;
        if (!dojoId) {
            const [memberRow] = await queryAsync(
                'SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?',
                [mitglieder[0].mitglied_id]
            );
            dojoId = memberRow?.dojo_id || req.body.dojo_id || req.query.dojo_id;
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
                    // Ratenplan-Aufschlag dazurechnen (nicht in beitraege-Tabelle, kommt vom Frontend)
                    const ratenplanAufschlag = parseFloat(mitglied.ratenplan_aufschlag || 0);
                    const ratenOffen = parseFloat(mitglied.raten_ausstehend || 0);
                    const effektiverAufschlag = ratenplanAufschlag > 0 && ratenOffen > 0
                        ? Math.min(ratenplanAufschlag, ratenOffen) : 0;
                    filteredMitglieder.push({
                        ...mitglied,
                        beitraege: unbezahlteBeitraege.map(b => ({ beitrag_id: b.beitrag_id })),
                        betrag: neuerBetrag + effektiverAufschlag,
                        ratenplan_aufschlag: effektiverAufschlag
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

        // Markiere NUR sofort bestätigte (succeeded) Beiträge als bezahlt.
        // processing-Transaktionen bleiben offen — Stripe Sync markiert sie
        // wenn der Webhook (payment_intent.succeeded) eintrifft.
        // Verhindert Doppelabbuchung bei erneutem Lauf während SEPA-Clearing läuft.
        if (result.succeeded > 0) {
            for (const trans of result.transactions) {
                if (trans.status === 'succeeded') {
                    const mitgliedData = filteredMitglieder.find(m => m.mitglied_id === trans.mitglied_id);
                    if (mitgliedData && mitgliedData.beitraege) {
                        for (const beitrag of mitgliedData.beitraege) {
                            await queryAsync(
                                'UPDATE beitraege SET bezahlt = 1, zahlungsart = ? WHERE beitrag_id = ?',
                                ['Stripe SEPA', beitrag.beitrag_id]
                            );
                            // Verknüpfte Rechnung als bezahlt markieren
                            if (beitrag.rechnung_id) {
                                await queryAsync(
                                    `UPDATE rechnungen SET status = 'bezahlt', bezahlt_am = CURDATE(), zahlungsart = 'Stripe SEPA'
                                     WHERE rechnung_id = ?`,
                                    [beitrag.rechnung_id]
                                );
                            }
                        }
                        // Ratenplan: bereits_abgezahlt um monatlichen Aufschlag erhöhen
                        if (mitgliedData.ratenplan_id && mitgliedData.ratenplan_aufschlag > 0) {
                            await queryAsync(
                                `UPDATE mitglied_ratenplan
                                 SET bereits_abgezahlt = LEAST(bereits_abgezahlt + ?, ausstehender_betrag)
                                 WHERE id = ? AND aktiv = 1`,
                                [mitgliedData.ratenplan_aufschlag, mitgliedData.ratenplan_id]
                            );
                            logger.info(`✅ Ratenplan ${mitgliedData.ratenplan_id} für Mitglied ${mitgliedData.mitglied_id}: +${mitgliedData.ratenplan_aufschlag}€ abgezahlt`);
                        }
                    }
                }
                // trans.status === 'processing': bleibt bezahlt=0
                // Der bestehende NOT EXISTS-Guard in der Preview-Query verhindert,
                // dass diese Beiträge nochmals im nächsten Lauf auftauchen.
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
        const isConfigError = error.message?.includes('nicht konfiguriert') ||
                              error.message?.includes('not configured');
        res.status(isConfigError ? 400 : 500).json({
            error: isConfigError ? `Stripe nicht konfiguriert für dieses Dojo: ${error.message}` : 'Fehler beim Lastschriftlauf',
            details: error.message
        });
    }
});

/**
 * GET /lastschriftlauf/stripe/batch/:batchId
 * Ruft den Status eines Lastschrift-Batches ab
 */
router.get("/stripe/batch/:batchId", async (req, res) => {
    try {
        const { batchId } = req.params;
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);

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
