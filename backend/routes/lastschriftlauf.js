const express = require("express");
const db = require("../db");
const logger = require("../utils/logger");
const SepaXmlGenerator = require("../utils/sepaXmlGenerator");
const PaymentProviderFactory = require("../services/PaymentProviderFactory");
const { getSecureDojoId } = require("../middleware/tenantSecurity");
const router = express.Router();

function validateIban(iban) {
    if (!iban || iban.length < 5) return 'IBAN fehlt oder zu kurz';
    const lengths = { DE: 22, AT: 20, CH: 21, NL: 18, FR: 27, IT: 27, ES: 24, BE: 16, LU: 20, GB: 22, PL: 28, CZ: 24, HU: 28, RO: 24 };
    const cc = iban.substring(0, 2);
    const expected = lengths[cc];
    if (expected && iban.length !== expected) return `IBAN ungültige Länge (${cc}: ${expected} Zeichen erwartet, ${iban.length} erhalten)`;
    // Mod-97 Prüfsumme
    const rearranged = iban.substring(4) + iban.substring(0, 4);
    const numeric = rearranged.split('').map(c => isNaN(c) ? (c.charCodeAt(0) - 55).toString() : c).join('');
    let remainder = 0;
    for (const chunk of numeric.match(/.{1,9}/g) || []) {
        remainder = parseInt(String(remainder) + chunk, 10) % 97;
    }
    if (remainder !== 1) return 'IBAN Prüfsumme ungültig (Ziffern/Buchstaben prüfen)';
    return null;
}

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
            WHERE (v.status = 'aktiv' OR (v.status = 'gekuendigt' AND (v.vertragsende IS NULL OR v.vertragsende >= CURDATE())))
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

        const results = await queryAsync(query);

        // Marketing-Artikel-Bestellungen für SEPA-Mitglieder ebenfalls einziehen
        const maOrders = await queryAsync(`
            SELECT mb.id, mb.mitglied_id, mb.preis_cent, mb.menge, ma.name AS artikel_name,
                   m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                   sm.mandatsreferenz, sm.erstellungsdatum AS mandat_datum
            FROM marketing_bestellungen mb
            JOIN mitglieder m ON mb.mitglied_id = m.mitglied_id
            JOIN marketing_artikel ma ON mb.artikel_id = ma.id
            JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            WHERE mb.status = 'offen'
              AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND sm.mandatsreferenz IS NOT NULL
        `);
        const maRows = maOrders.map(ma => ({
            mandatsreferenz: ma.mandatsreferenz,
            iban: ma.iban,
            bic: ma.bic,
            kontoinhaber: ma.kontoinhaber || `${ma.vorname} ${ma.nachname}`,
            vorname: ma.vorname,
            nachname: ma.nachname,
            mitglied_id: ma.mitglied_id,
            mandat_datum: ma.mandat_datum,
            tarif_name: `Artikel: ${ma.artikel_name}`,
            monatlicher_beitrag: ma.preis_cent / 100,
            offene_rechnungen: 0,
            ratenplan_id: null,
        }));

        // Offene Starterpaket-Bestellungen für SEPA-Mitglieder ebenfalls einziehen
        const spOrders = await queryAsync(`
            SELECT sb.id, sb.mitglied_id, sb.gesamtpreis_cent,
                   sp.name AS paket_name,
                   m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                   sm.mandatsreferenz, sm.erstellungsdatum AS mandat_datum
            FROM starterpaket_bestellungen sb
            JOIN mitglieder m ON sb.mitglied_id = m.mitglied_id
            JOIN starterpakete sp ON sb.paket_id = sp.paket_id
            JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            WHERE sb.status = 'offen'
              AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND sm.mandatsreferenz IS NOT NULL
        `);

        const spRows = spOrders.map(sp => ({
            mandatsreferenz: sp.mandatsreferenz,
            iban: sp.iban,
            bic: sp.bic,
            kontoinhaber: sp.kontoinhaber || `${sp.vorname} ${sp.nachname}`,
            vorname: sp.vorname,
            nachname: sp.nachname,
            mitglied_id: sp.mitglied_id,
            mandat_datum: sp.mandat_datum,
            tarif_name: `Starterpaket: ${sp.paket_name}`,
            monatlicher_beitrag: sp.gesamtpreis_cent / 100,
            offene_rechnungen: 0,
            ratenplan_id: null,
        }));

        const allContracts = [...results, ...spRows, ...maRows];

        if (allContracts.length === 0) {
            return res.status(404).json({
                error: 'Keine aktiven Verträge mit SEPA-Lastschrift gefunden'
            });
        }

        logger.info(`Found ${results.length} contracts + ${spRows.length} Starterpaket orders for SEPA batch`);

        // Verwende ausgewählte Bank oder ermittle häufigste Bank
        const bankName = selectedBank ? selectedBank.bank_name : getMostCommonBank(results.length ? results : allContracts);

        // Generiere CSV mit Bankinfo
        const csvData = generateSepaCSV(allContracts, selectedBank);
        const dateStr = new Date().toISOString().split('T')[0];
        const monthStr = monat ? String(monat).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
        const yearStr = jahr || new Date().getFullYear();
        const filename = `SEPA_Lastschriftlauf_${yearStr}-${monthStr}_${dateStr}.csv`;

        // Send as downloadable file
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Mandate-Count', allContracts.length);
        res.setHeader('X-Total-Amount', calculateTotalAmount(allContracts));
        res.setHeader('X-Creditor-Bank', bankName || 'Unbekannt');
        if (selectedBank) {
            res.setHeader('X-Creditor-IBAN', selectedBank.iban || '');
            res.setHeader('X-Creditor-Name', selectedBank.kontoinhaber || '');
        }

        // Marketing-Artikel-Bestellungen als 'in_einzug' markieren
        if (maOrders.length > 0) {
            const maIds = maOrders.map(ma => ma.id);
            await queryAsync(
                'UPDATE marketing_bestellungen SET status = ? WHERE id IN (?)',
                ['in_einzug', maIds]
            );
            logger.info(`${maIds.length} Marketing-Artikel-Bestellungen als 'in_einzug' markiert`);
        }

        // Starterpaket-Bestellungen als 'in_einzug' markieren (warten auf Zahllauf-Bestätigung)
        if (spOrders.length > 0) {
            const spIds = spOrders.map(sp => sp.id);
            await queryAsync(
                'UPDATE starterpaket_bestellungen SET status = ? WHERE id IN (?)',
                ['in_einzug', spIds]
            );
            logger.info(`${spIds.length} Starterpaket-Bestellungen als 'in_einzug' markiert`);
        }

        res.send('\uFEFF' + csvData); // UTF-8 BOM für Excel

        logger.debug(`📄 SEPA batch file generated: ${filename} via ${bankName}`);

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
                WHERE (v.status = 'aktiv' OR (v.status = 'gekuendigt' AND (v.vertragsende IS NULL OR v.vertragsende >= CURDATE())))
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
    const secureDojoId = getSecureDojoId(req);
    const dojoFilter = secureDojoId ? 'AND m.dojo_id = ?' : '';
    const params = secureDojoId ? [secureDojoId] : [];

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
          ${dojoFilter}
        ORDER BY m.nachname, m.vorname
    `;

    db.query(query, params, (err, results) => {
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

    let whereClause = '';
    const params = [];
    if (secureDojoId) {
        whereClause = 'AND m.dojo_id = ?';
        params.push(secureDojoId);
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
        WHERE (v.status = 'aktiv' OR (v.status = 'gekuendigt' AND (v.vertragsende IS NULL OR v.vertragsende >= CURDATE())))
          AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
          AND sm.mandat_id IS NULL
          AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
          AND m.aktiv = 1
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
 * GET /api/lastschriftlauf/debug-member?name=xxx&dojo_id=X
 * Vollständige Diagnose für ein einzelnes Mitglied (Lastschriftlauf-Sicht)
 */
router.get("/debug-member", async (req, res) => {
    try {
        const { name, mitglied_id } = req.query;
        const dojoId = req.query.dojo_id || req.user?.dojo_id;
        const monat = parseInt(req.query.monat) || (new Date().getMonth() + 1);
        const jahr = parseInt(req.query.jahr) || new Date().getFullYear();
        const lastDay = new Date(jahr, monat, 0).getDate();
        const monatEnde = `${jahr}-${String(monat).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        if (!name && !mitglied_id) return res.status(400).json({ error: 'name oder mitglied_id erforderlich' });

        const where = mitglied_id
            ? 'm.mitglied_id = ?'
            : 'CONCAT(m.vorname, " ", m.nachname) LIKE ?';
        const whereParam = mitglied_id ? [parseInt(mitglied_id)] : [`%${name}%`];
        const dojoFilter = dojoId ? 'AND m.dojo_id = ?' : '';
        const params = [...whereParam, ...(dojoId ? [dojoId] : [])];

        const rows = await queryAsync(`
            SELECT m.mitglied_id, m.vorname, m.nachname,
                   m.zahlungsmethode, m.aktiv, m.vertragsfrei, m.dojo_id,
                   m.stripe_customer_id
            FROM mitglieder m
            WHERE ${where} ${dojoFilter}
            LIMIT 5
        `, params);

        if (rows.length === 0) return res.json({ found: false, query: name || mitglied_id });

        const results = await Promise.all(rows.map(async m => {
            const [mandate, beitraege, vertraege, stripeTx] = await Promise.all([
                queryAsync(`SELECT mandat_id, status, mandatsreferenz, iban, stripe_payment_method_id, erstellungsdatum FROM sepa_mandate WHERE mitglied_id = ? ORDER BY erstellungsdatum DESC`, [m.mitglied_id]),
                queryAsync(`SELECT beitrag_id, betrag, zahlungsdatum, bezahlt, art FROM beitraege WHERE mitglied_id = ? AND zahlungsdatum <= ? ORDER BY zahlungsdatum DESC LIMIT 12`, [m.mitglied_id, monatEnde]),
                queryAsync(`SELECT id as vertrag_id, status, vertragsbeginn, vertragsende, ruhepause_von, ruhepause_bis FROM vertraege WHERE mitglied_id = ? ORDER BY vertragsbeginn DESC LIMIT 3`, [m.mitglied_id]),
                queryAsync(`SELECT slt.id, slt.status, slt.betrag, slt.beitrag_ids, slb.monat, slb.jahr, slt.created_at FROM stripe_lastschrift_transaktion slt JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id WHERE slt.mitglied_id = ? ORDER BY slt.created_at DESC LIMIT 6`, [m.mitglied_id]),
            ]);

            const offeneBeitraege = beitraege.filter(b => b.bezahlt == 0);
            const aktivesMandat = mandate.find(mn => mn.status === 'aktiv' && mn.mandatsreferenz);
            const processingTx = stripeTx.filter(t => t.status === 'processing');
            const succeededTx = stripeTx.filter(t => t.status === 'succeeded');

            const diagnose = [];
            if (!m.aktiv) diagnose.push('INAKTIV (aktiv=0) — vom Preview ausgeschlossen');
            if (m.vertragsfrei == 1) diagnose.push('vertragsfrei=1 — von der Diagnose ausgeschlossen');
            if (m.zahlungsmethode !== 'SEPA-Lastschrift' && m.zahlungsmethode !== 'Lastschrift')
                diagnose.push(`zahlungsmethode="${m.zahlungsmethode}" — kein SEPA-Wert → weder Preview noch Diagnose`);
            if (!aktivesMandat) diagnose.push('Kein aktives Mandat mit mandatsreferenz');
            if (!m.stripe_customer_id) diagnose.push('Kein stripe_customer_id');
            if (offeneBeitraege.length === 0) diagnose.push('Keine offenen Beiträge bis Monatsende');
            if (processingTx.length > 0) diagnose.push(`${processingTx.length} Stripe-Tx in "processing" → blockiert Preview + Diagnose`);

            return {
                ...m,
                mandate, vertraege,
                offene_beitraege: offeneBeitraege.length,
                offener_betrag: offeneBeitraege.reduce((s, b) => s + parseFloat(b.betrag), 0),
                beitraege_sample: beitraege,
                stripe_transaktionen: stripeTx,
                diagnose: diagnose.length ? diagnose : ['Keine Probleme gefunden — sollte im Preview erscheinen'],
            };
        }));

        res.json({ found: true, monatEnde, members: results });
    } catch (err) {
        logger.error('debug-member error:', err);
        res.status(500).json({ error: err.message });
    }
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
              AND m2.aktiv = 1
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
                m.mitglied_id, m.vorname, m.nachname, m.email, m.telefon,
                m.zahlungsmethode, m.stripe_customer_id,
                v.status as vertrag_status,
                v.ruhepause_von, v.ruhepause_bis, v.vertragsende,
                sm.mandat_id, sm.mandatsreferenz,
                (SELECT sm2.iban FROM sepa_mandate sm2 WHERE sm2.mitglied_id = m.mitglied_id AND sm2.status = 'aktiv' LIMIT 1) as mandat_iban,
                (SELECT sm2.stripe_payment_method_id IS NOT NULL FROM sepa_mandate sm2 WHERE sm2.mitglied_id = m.mitglied_id AND sm2.status = 'aktiv' LIMIT 1) as has_stripe_pm,
                (SELECT COUNT(*) FROM sepa_mandate sm3 WHERE sm3.mitglied_id = m.mitglied_id) as mandat_gesamt,
                (SELECT COUNT(*) FROM beitraege b
                 WHERE b.mitglied_id = m.mitglied_id AND b.bezahlt = 0
                   AND b.zahlungsdatum <= ?) as offene_beitraege,
                (SELECT SUM(b2.betrag) FROM beitraege b2
                 WHERE b2.mitglied_id = m.mitglied_id AND b2.bezahlt = 0
                   AND b2.zahlungsdatum <= ?) as offener_betrag
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
            monatEnde, monatEnde,
            ...(dojoId ? [dojoId] : []),
            ...inRunIds
        ];

        const results = await queryAsync(query, queryParams);

        // Schritt 3: Mitglieder mit SEPA-Mandat aber falschem/fehlendem zahlungsmethode-Wert
        // → Diese tauchen weder im Preview noch in not-in-run auf, sind aber real Probleme
        const allSepaIds = new Set([...inRunIds, ...results.map(r => r.mitglied_id)]);
        const wrongZmWhere = allSepaIds.size > 0
            ? `AND m.mitglied_id NOT IN (${[...allSepaIds].map(() => '?').join(',')})`
            : '';

        const wrongZmQuery = `
            SELECT
                m.mitglied_id, m.vorname, m.nachname, m.email,
                m.zahlungsmethode, m.stripe_customer_id,
                v.status as vertrag_status, v.ruhepause_von, v.ruhepause_bis, v.vertragsende,
                sm.mandat_id, sm.mandatsreferenz,
                (SELECT sm2.iban FROM sepa_mandate sm2 WHERE sm2.mitglied_id = m.mitglied_id AND sm2.status = 'aktiv' LIMIT 1) as mandat_iban,
                (SELECT sm2.stripe_payment_method_id IS NOT NULL FROM sepa_mandate sm2 WHERE sm2.mitglied_id = m.mitglied_id AND sm2.status = 'aktiv' LIMIT 1) as has_stripe_pm,
                (SELECT COUNT(*) FROM sepa_mandate sm3 WHERE sm3.mitglied_id = m.mitglied_id) as mandat_gesamt,
                (SELECT COUNT(*) FROM beitraege b WHERE b.mitglied_id = m.mitglied_id AND b.bezahlt = 0 AND b.zahlungsdatum <= ?) as offene_beitraege,
                (SELECT SUM(b2.betrag) FROM beitraege b2 WHERE b2.mitglied_id = m.mitglied_id AND b2.bezahlt = 0 AND b2.zahlungsdatum <= ?) as offener_betrag
            FROM mitglieder m
            JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv' AND sm.mandatsreferenz IS NOT NULL
            LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status IN ('aktiv','gekuendigt','ruhepause')
            WHERE NOT (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
              ${dojoId ? 'AND m.dojo_id = ?' : ''}
              ${wrongZmWhere}
            GROUP BY m.mitglied_id
            ORDER BY m.nachname, m.vorname
        `;
        const wrongZmParams = [monatEnde, monatEnde, ...(dojoId ? [dojoId] : []), ...[...allSepaIds]];
        const wrongZmResults = await queryAsync(wrongZmQuery, wrongZmParams);

        const mapMember = (r, overrideGrundTyp) => {
            let grund = '', grundTyp = '';
            if (overrideGrundTyp === 'falsche_zahlungsmethode') {
                grund = `Zahlungsmethode "${r.zahlungsmethode || 'nicht gesetzt'}" — muss SEPA-Lastschrift sein`;
                grundTyp = 'falsche_zahlungsmethode';
            } else if (!r.mandat_id) {
                grund = 'Kein aktives SEPA-Mandat';
                grundTyp = 'kein_mandat';
            } else if (!r.vertrag_status) {
                grund = 'Kein Vertrag';
                grundTyp = 'kein_vertrag';
            } else if (r.vertrag_status === 'ruhepause') {
                grund = `Ruhepause (bis ${r.ruhepause_bis ? new Date(r.ruhepause_bis).toLocaleDateString('de-DE') : '?'})`;
                grundTyp = 'ruhepause';
            } else if (r.vertrag_status === 'gekuendigt') {
                grund = `Gekündigt (Ende ${r.vertragsende ? new Date(r.vertragsende).toLocaleDateString('de-DE') : '?'})`;
                grundTyp = 'gekuendigt';
            } else {
                grund = 'Unbekannt';
                grundTyp = 'unbekannt';
            }
            return {
                mitglied_id: r.mitglied_id,
                name: `${r.vorname} ${r.nachname}`,
                email: r.email,
                zahlungsmethode: r.zahlungsmethode,
                vertrag_status: r.vertrag_status,
                ruhepause_bis: r.ruhepause_bis,
                vertragsende: r.vertragsende,
                offene_beitraege: r.offene_beitraege,
                offener_betrag: parseFloat(r.offener_betrag || 0),
                grund, grundTyp,
                has_mandat_iban: !!r.mandat_iban,
                has_stripe_customer: !!r.stripe_customer_id,
                has_stripe_pm: !!r.has_stripe_pm,
                mandat_gesamt: r.mandat_gesamt || 0,
                needs_stripe_setup: !!r.mandat_iban && (!r.stripe_customer_id || !r.has_stripe_pm)
            };
        };

        // Schritt 4: Mitglieder mit laufender processing-Transaktion die weder im Preview noch in Diagnose auftauchen
        // (inRunQuery nimmt sie auf → schließt sie aus not-in-run aus, aber preview filtert sie wegen NOT EXISTS raus)
        const diagnosedIds = new Set([
            ...results.map(r => r.mitglied_id),
            ...wrongZmResults.map(r => r.mitglied_id)
        ]);
        const processingExcludeWhere = diagnosedIds.size > 0
            ? `AND slt.mitglied_id NOT IN (${[...diagnosedIds].map(() => '?').join(',')})`
            : '';
        const processingBlockedQuery = `
            SELECT
                m.mitglied_id, m.vorname, m.nachname, m.email,
                m.zahlungsmethode, m.stripe_customer_id,
                v.status as vertrag_status, v.ruhepause_bis, v.vertragsende,
                slt.id as slt_id, slt.betrag as tx_betrag, slt.created_at as tx_created,
                slb.monat as tx_monat, slb.jahr as tx_jahr,
                (SELECT COUNT(*) FROM beitraege b WHERE b.mitglied_id = m.mitglied_id AND b.bezahlt = 0 AND b.zahlungsdatum <= ?) as offene_beitraege,
                (SELECT SUM(b2.betrag) FROM beitraege b2 WHERE b2.mitglied_id = m.mitglied_id AND b2.bezahlt = 0 AND b2.zahlungsdatum <= ?) as offener_betrag
            FROM stripe_lastschrift_transaktion slt
            JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
            JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
            LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status IN ('aktiv','gekuendigt','ruhepause')
            WHERE slt.status = 'processing'
              ${dojoId ? 'AND m.dojo_id = ?' : ''}
              ${processingExcludeWhere}
            GROUP BY m.mitglied_id
            ORDER BY m.nachname, m.vorname
        `;
        const processingBlockedParams = [monatEnde, monatEnde, ...(dojoId ? [dojoId] : []), ...[...diagnosedIds]];
        const processingBlockedResults = await queryAsync(processingBlockedQuery, processingBlockedParams);

        const members = [
            ...results.filter(r => r.offene_beitraege > 0).map(r => mapMember(r, null)),
            ...wrongZmResults.filter(r => r.offene_beitraege > 0).map(r => mapMember(r, 'falsche_zahlungsmethode')),
            ...processingBlockedResults.map(r => ({
                mitglied_id: r.mitglied_id,
                name: `${r.vorname} ${r.nachname}`,
                email: r.email,
                zahlungsmethode: r.zahlungsmethode,
                vertrag_status: r.vertrag_status,
                ruhepause_bis: r.ruhepause_bis,
                vertragsende: r.vertragsende,
                offene_beitraege: r.offene_beitraege,
                offener_betrag: parseFloat(r.offener_betrag || 0),
                grund: `Stripe-Transaktion vom ${new Date(r.tx_created).toLocaleDateString('de-DE')} (${r.tx_monat}/${r.tx_jahr}) noch in Bearbeitung`,
                grundTyp: 'processing_blockiert',
                slt_id: r.slt_id,
                tx_betrag: parseFloat(r.tx_betrag || 0),
                has_mandat_iban: true,
                has_stripe_customer: !!r.stripe_customer_id,
                has_stripe_pm: true,
                mandat_gesamt: 1,
                needs_stripe_setup: false
            }))
        ].sort((a, b) => a.name.localeCompare(b.name));

        res.json({ success: true, count: members.length, members });
    } catch (error) {
        logger.error('Fehler bei not-in-run:', error);
        res.status(500).json({ error: 'Fehler', details: error.message });
    }
});

/**
 * POST /api/lastschriftlauf/preview-stornieren
 * Löscht offene Beiträge dauerhaft (aus der Preview heraus stornieren)
 * Body: { beitrag_ids: [1, 2, 3] }
 */
router.post('/preview-stornieren', async (req, res) => {
    const secureDojoId = getSecureDojoId(req);
    const { beitrag_ids, ma_ids } = req.body;
    const hasBeitraege = Array.isArray(beitrag_ids) && beitrag_ids.length > 0;
    const hasMaIds = Array.isArray(ma_ids) && ma_ids.length > 0;
    if (!hasBeitraege && !hasMaIds) {
        return res.status(400).json({ error: 'beitrag_ids oder ma_ids fehlt' });
    }
    try {
        const queryAsync = (sql, params) => new Promise((resolve, reject) => {
            db.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
        });
        let deleted = 0;
        let storniert = 0;
        if (hasBeitraege) {
            const dojoJoin = secureDojoId
                ? 'JOIN mitglieder m ON b.mitglied_id = m.mitglied_id AND m.dojo_id = ?'
                : 'JOIN mitglieder m ON b.mitglied_id = m.mitglied_id';
            // dojo_id kommt vor IN(?) im SQL → Reihenfolge: [secureDojoId, beitrag_ids]
            const params = secureDojoId ? [secureDojoId, beitrag_ids] : [beitrag_ids];
            const result = await queryAsync(
                `DELETE b FROM beitraege b ${dojoJoin} WHERE b.beitrag_id IN (?) AND b.bezahlt = 0`,
                params
            );
            deleted = result.affectedRows;
        }
        if (hasMaIds) {
            const maParams = secureDojoId ? [ma_ids, secureDojoId] : [ma_ids];
            const maWhere = secureDojoId ? 'WHERE id IN (?) AND dojo_id = ?' : 'WHERE id IN (?)';
            const result = await queryAsync(
                `UPDATE marketing_bestellungen SET status = 'storniert' ${maWhere}`,
                maParams
            );
            storniert = result.affectedRows;
        }
        res.json({ success: true, deleted, storniert });
    } catch (err) {
        logger.error('Fehler bei preview-stornieren', { error: err.message });
        res.status(500).json({ error: err.message });
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
            -- Vertrag optional: Trainer/Sondermitglieder ohne Vertrag können trotzdem per Lastschrift eingezogen werden
            LEFT JOIN (
                SELECT mitglied_id,
                    COALESCE(
                        MAX(CASE WHEN status = 'aktiv' THEN tarif_id END),
                        MAX(CASE WHEN status = 'gekuendigt' AND (vertragsende IS NULL OR vertragsende >= CURDATE()) THEN tarif_id END)
                    ) AS tarif_id
                FROM vertraege
                WHERE status = 'aktiv'
                   OR (status = 'gekuendigt' AND (vertragsende IS NULL OR vertragsende >= CURDATE()))
                GROUP BY mitglied_id
                HAVING tarif_id IS NOT NULL
            ) v ON m.mitglied_id = v.mitglied_id
            LEFT JOIN tarife t ON v.tarif_id = t.id
            LEFT JOIN mitglied_ratenplan rp ON m.mitglied_id = rp.mitglied_id AND rp.aktiv = 1
            JOIN beitraege b ON m.mitglied_id = b.mitglied_id
                AND b.bezahlt = 0
                AND b.zahlungsdatum <= ?
                -- Bei aktivem Ratenplan: nur Beiträge ab dem Monat der Ratenplan-Erstellung (Rückstand läuft über Aufschlag)
                AND (rp.id IS NULL OR DATE_FORMAT(b.zahlungsdatum, '%Y-%m') >= DATE_FORMAT(rp.erstellt_am, '%Y-%m'))
                -- Beitrag nicht einziehen wenn Mitglied in Ruhepause ist und der Beitrag in den Pausezeitraum fällt
                AND NOT EXISTS (
                    SELECT 1 FROM vertraege vr
                    WHERE vr.mitglied_id = m.mitglied_id
                      AND vr.status = 'ruhepause'
                      AND vr.ruhepause_von IS NOT NULL
                      AND vr.ruhepause_bis IS NOT NULL
                      AND b.zahlungsdatum BETWEEN vr.ruhepause_von AND vr.ruhepause_bis
                )
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
              AND m.aktiv = 1
              ${dojoFilter}
            GROUP BY m.mitglied_id, m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                     m.zahlungsmethode, sm.bankname, sm.mandatsreferenz, sm.glaeubiger_id,
                     rp.id, rp.monatlicher_aufschlag, rp.ausstehender_betrag, rp.bereits_abgezahlt
            ORDER BY m.nachname, m.vorname
        `;

        // Warnliste: SEPA-Mitglieder mit offenen Beiträgen aber OHNE aktives SEPA-Mandat → können nicht eingezogen werden
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
            WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND m.aktiv = 1
              ${dojoFilter}
              AND NOT EXISTS (
                  SELECT 1 FROM sepa_mandate sm2
                  WHERE sm2.mitglied_id = m.mitglied_id
                    AND sm2.status = 'aktiv'
                    AND sm2.mandatsreferenz IS NOT NULL
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

        const [results, warnResults, processingResults] = await Promise.all([
            queryAsync(mainQuery, mainParams),
            queryAsync(warnQuery, warnParams),
            queryAsync(processingQuery, processingParams)
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

        // Offene Gutschriften für alle Mitglieder im Lauf laden
        const mitgliedIds = results.map(r => r.mitglied_id);
        let gutschriftMap = {};
        if (mitgliedIds.length > 0) {
            const placeholders = mitgliedIds.map(() => '?').join(',');
            const gutschriften = await queryAsync(
                `SELECT mitglied_id, SUM(restbetrag) AS gutschrift_gesamt
                 FROM mitglied_gutschriften
                 WHERE mitglied_id IN (${placeholders}) AND verrechnet = 0
                 GROUP BY mitglied_id`,
                mitgliedIds
            );
            for (const g of gutschriften) {
                gutschriftMap[g.mitglied_id] = parseFloat(g.gutschrift_gesamt || 0);
            }
        }

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
            const bruttoBetrag = beitragsBetrag + ratenplanAufschlag;
            const gutschrift = gutschriftMap[r.mitglied_id] || 0;
            const nettoBetrag = Math.max(0, bruttoBetrag - gutschrift);
            return {
                mitglied_id: r.mitglied_id,
                name: `${r.vorname || ''} ${r.nachname || ''}`.trim(),
                iban: maskIBAN(r.iban),
                betrag: nettoBetrag,
                brutto_betrag: bruttoBetrag,
                gutschrift_betrag: gutschrift,
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

        // Marketing-Artikel-Bestellungen in Preview einbeziehen
        const maFilter = secureDojoId ? 'AND mb.dojo_id = ?' : '';
        const maPreviewRows = await queryAsync(
            `SELECT mb.id, mb.mitglied_id, mb.preis_cent, mb.menge, ma.name AS artikel_name,
                    m.vorname, m.nachname, m.iban, sm.mandatsreferenz, sm.bankname
             FROM marketing_bestellungen mb
             JOIN mitglieder m ON mb.mitglied_id = m.mitglied_id
             JOIN marketing_artikel ma ON mb.artikel_id = ma.id
             JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
             WHERE mb.status = 'offen'
               AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
               AND sm.mandatsreferenz IS NOT NULL
               ${maFilter}`,
            secureDojoId ? [secureDojoId] : []
        );
        const maPreviewItems = maPreviewRows.map(ma => ({
            mitglied_id: ma.mitglied_id,
            name: `${ma.vorname || ''} ${ma.nachname || ''}`.trim(),
            iban: maskIBAN(ma.iban),
            betrag: ma.preis_cent / 100,
            brutto_betrag: ma.preis_cent / 100,
            gutschrift_betrag: 0,
            beitraege_betrag: ma.preis_cent / 100,
            anzahl_monate: 0,
            offene_monate: 'Einmalig',
            beitraege: [],
            mandatsreferenz: ma.mandatsreferenz || 'KEIN MANDAT',
            tarif: `Artikel: ${ma.artikel_name}`,
            zahlungszyklus: 'einmalig',
            bank: ma.bankname || 'Unbekannt',
            ratenplan_id: null,
            ratenplan_aufschlag: 0,
            raten_ausstehend: 0,
            is_marketing_artikel: true,
            ma_id: ma.id
        }));

        // SP-Bestellungen (Starterpaket) in Preview einbeziehen
        const spFilter = secureDojoId ? 'AND sb.dojo_id = ?' : '';
        const spPreviewRows = await queryAsync(
            `SELECT sb.id, sb.mitglied_id, sb.gesamtpreis_cent, sp.name AS paket_name,
                    m.vorname, m.nachname, m.iban, sm.mandatsreferenz, sm.bankname
             FROM starterpaket_bestellungen sb
             JOIN mitglieder m ON sb.mitglied_id = m.mitglied_id
             JOIN starterpakete sp ON sb.paket_id = sp.paket_id
             JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
             WHERE sb.status = 'offen'
               AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
               AND sm.mandatsreferenz IS NOT NULL
               ${spFilter}`,
            secureDojoId ? [secureDojoId] : []
        );
        const spPreviewItems = spPreviewRows.map(sp => ({
            mitglied_id: sp.mitglied_id,
            name: `${sp.vorname || ''} ${sp.nachname || ''}`.trim(),
            iban: maskIBAN(sp.iban),
            betrag: sp.gesamtpreis_cent / 100,
            brutto_betrag: sp.gesamtpreis_cent / 100,
            gutschrift_betrag: 0,
            beitraege_betrag: sp.gesamtpreis_cent / 100,
            anzahl_monate: 0,
            offene_monate: 'Einmalig',
            beitraege: [],
            mandatsreferenz: sp.mandatsreferenz || 'KEIN MANDAT',
            tarif: `Starterpaket: ${sp.paket_name}`,
            zahlungszyklus: 'einmalig',
            bank: sp.bankname || 'Unbekannt',
            ratenplan_id: null,
            ratenplan_aufschlag: 0,
            raten_ausstehend: 0,
            is_starterpaket: true,
            sp_id: sp.id
        }));

        const totalAmount = (
            results.reduce((sum, r) => sum + parseFloat(r.gesamt_betrag || 0), 0) +
            spPreviewRows.reduce((sum, sp) => sum + sp.gesamtpreis_cent / 100, 0) +
            maPreviewRows.reduce((sum, ma) => sum + ma.preis_cent / 100, 0)
        ).toFixed(2);

        res.json({
            success: true,
            count: results.length + spPreviewItems.length + maPreviewItems.length,
            total_amount: totalAmount,
            monat: monat,
            jahr: jahr,
            primary_bank: mostCommonBank || 'Gemischte Banken',
            preview: [...preview, ...spPreviewItems, ...maPreviewItems],
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
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
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
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
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
        const dojoId = getSecureDojoId(req);

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
        const dojoId = getSecureDojoId(req);

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
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
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
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
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
            const rawIban = (mitglied.iban || '').replace(/\s/g, '').toUpperCase();
            const ibanError = validateIban(rawIban);
            if (ibanError) {
                results.failed++;
                results.details.push({
                    mitglied_id: mitglied.mitglied_id,
                    name: `${mitglied.vorname} ${mitglied.nachname}`,
                    iban: rawIban,
                    status: 'failed',
                    error: ibanError
                });
                continue;
            }
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
                    rawIban,
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
                    iban: rawIban,
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
                // Zweite Sicherheitslinie: Hat dieses Mitglied bereits eine erfolgreiche/laufende
                // Stripe-Transaktion für diesen Monat? Verhindert Doppelabbuchung auch wenn
                // durch Magicline-Import neue bezahlt=0 Beiträge für denselben Monat entstanden.
                const existingStripeTx = await queryAsync(
                    `SELECT slt.id FROM stripe_lastschrift_transaktion slt
                     JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
                     WHERE slt.mitglied_id = ?
                       AND slb.monat = ? AND slb.jahr = ?
                       AND slt.status IN ('processing','succeeded')
                     LIMIT 1`,
                    [mitglied.mitglied_id, parseInt(monat), parseInt(jahr)]
                );
                if (existingStripeTx.length > 0) {
                    logger.warn(`⛔ Stripe-Doppelabbuchung verhindert: Mitglied ${mitglied.mitglied_id} bereits verarbeitet für ${monat}/${jahr}`);
                    continue;
                }

                const beitragIds = mitglied.beitraege.map(b => b.beitrag_id);
                const placeholders = beitragIds.map(() => '?').join(',');
                const unbezahlteBeitraege = await queryAsync(
                    `SELECT beitrag_id, betrag FROM beitraege WHERE beitrag_id IN (${placeholders}) AND bezahlt = 0`,
                    beitragIds
                );

                if (unbezahlteBeitraege.length > 0) {
                    const neuerBetrag = unbezahlteBeitraege.reduce((sum, b) => sum + parseFloat(b.betrag), 0);
                    // Ratenplan-Aufschlag aus DB lesen — nicht dem Frontend-Wert vertrauen
                    let effektiverAufschlag = 0;
                    if (mitglied.ratenplan_id) {
                        const [rp] = await queryAsync(
                            `SELECT monatlicher_aufschlag, ausstehender_betrag, bereits_abgezahlt
                             FROM mitglied_ratenplan WHERE id = ? AND aktiv = 1`,
                            [mitglied.ratenplan_id]
                        );
                        if (rp) {
                            const aufschlag = parseFloat(rp.monatlicher_aufschlag || 0);
                            const offen = parseFloat(rp.ausstehender_betrag || 0) - parseFloat(rp.bereits_abgezahlt || 0);
                            effektiverAufschlag = aufschlag > 0 && offen > 0 ? Math.min(aufschlag, offen) : 0;
                        }
                    }
                    // Offene Gutschriften aus DB lesen und abziehen
                    const offeneGutschriften = await queryAsync(
                        `SELECT id, restbetrag FROM mitglied_gutschriften
                         WHERE mitglied_id = ? AND verrechnet = 0
                         ORDER BY erstellt_am ASC`,
                        [mitglied.mitglied_id]
                    );
                    const gutschriftGesamt = offeneGutschriften.reduce((s, g) => s + parseFloat(g.restbetrag || 0), 0);
                    const bruttoBetrag = neuerBetrag + effektiverAufschlag;
                    const nettoBetrag = Math.max(0, bruttoBetrag - gutschriftGesamt);

                    filteredMitglieder.push({
                        ...mitglied,
                        beitraege: unbezahlteBeitraege.map(b => ({ beitrag_id: b.beitrag_id })),
                        betrag: nettoBetrag,
                        brutto_betrag: bruttoBetrag,
                        ratenplan_aufschlag: effektiverAufschlag,
                        offene_gutschriften: offeneGutschriften,
                        gutschrift_betrag: gutschriftGesamt
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

        // Beiträge als bezahlt markieren sobald sie in einer Stripe-Transaktion sind
        // (succeeded = sofort bestätigt; processing = SEPA läuft, Geld wird eingezogen)
        // → verhindert Doppelabbuchung beim nächsten automatischen Lauf
        if (result.succeeded > 0 || result.processing > 0) {
            for (const trans of result.transactions) {
                if (trans.status === 'succeeded' || trans.status === 'processing') {
                    const mitgliedData = filteredMitglieder.find(m => m.mitglied_id === trans.mitglied_id);
                    if (mitgliedData && mitgliedData.beitraege) {
                        for (const beitrag of mitgliedData.beitraege) {
                            await queryAsync(
                                'UPDATE beitraege SET bezahlt = 1, bezahlt_am = NOW(), zahlungsart = ? WHERE beitrag_id = ?',
                                ['Stripe SEPA', beitrag.beitrag_id]
                            );
                            // Verknüpfte Rechnung + Prüfung als bezahlt markieren
                            if (beitrag.rechnung_id) {
                                await queryAsync(
                                    `UPDATE rechnungen SET status = 'bezahlt', bezahlt_am = CURDATE(), zahlungsart = 'Stripe SEPA'
                                     WHERE rechnung_id = ?`,
                                    [beitrag.rechnung_id]
                                );
                                await queryAsync(
                                    `UPDATE pruefungen SET gebuehr_bezahlt = 1, gebuehr_bezahlt_am = CURDATE()
                                     WHERE gebuehr_rechnung_id = ? AND gebuehr_bezahlt = 0`,
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
                        // Gutschriften verrechnen — FIFO, Restbetrag reduzieren
                        if (mitgliedData.offene_gutschriften?.length > 0 && mitgliedData.gutschrift_betrag > 0) {
                            let restVerrechnung = mitgliedData.gutschrift_betrag;
                            for (const g of mitgliedData.offene_gutschriften) {
                                if (restVerrechnung <= 0) break;
                                const verwendeter_rest = Math.min(parseFloat(g.restbetrag), restVerrechnung);
                                const neuer_rest = parseFloat(g.restbetrag) - verwendeter_rest;
                                await queryAsync(
                                    `UPDATE mitglied_gutschriften
                                     SET restbetrag = ?, verrechnet = ?, verrechnet_am = IF(? <= 0.001, NOW(), NULL)
                                     WHERE id = ?`,
                                    [neuer_rest, neuer_rest <= 0.001 ? 1 : 0, neuer_rest, g.id]
                                );
                                restVerrechnung -= verwendeter_rest;
                                logger.info(`💳 Gutschrift ${g.id} verrechnet: ${verwendeter_rest.toFixed(2)}€ → Restbetrag ${neuer_rest.toFixed(2)}€`);
                            }
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

/**
 * GET /lastschriftlauf/zahlungsauswertung
 * Echte Zahlungsstatistiken aus allen relevanten Quellen
 */
router.get("/zahlungsauswertung", async (req, res) => {
    try {
        const secureDojoId = getSecureDojoId(req);
        const dojoFilter   = secureDojoId ? 'AND m.dojo_id = ?' : '';
        const dojoFilterD  = secureDojoId ? 'AND dojo_id = ?' : '';
        const p            = secureDojoId ? [secureDojoId] : [];
        const today        = new Date().toISOString().split('T')[0];
        const thisMonth    = new Date();
        const monthStart   = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth()+1).padStart(2,'0')}-01`;

        const [
            offeneBeitraege,
            aktuellerMonat,
            failedStripe,
            processingStripe,
            ruecklastschriften,
            mitgliederMitProblem,
            letzteErfolge,
            monatsverlauf
        ] = await Promise.all([
            // 1. Überfällige offene Beiträge
            queryAsync(`
                SELECT COUNT(*) as anzahl, COALESCE(SUM(b.betrag),0) as summe,
                       COUNT(DISTINCT m.mitglied_id) as betroffene_mitglieder
                FROM beitraege b
                JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                WHERE b.bezahlt = 0
                  AND b.zahlungsdatum < ?
                  AND b.art = 'mitgliedsbeitrag'
                  AND m.aktiv = 1
                  ${dojoFilter}
            `, [today, ...p]),

            // 2. Aktueller Monat: eingezogen vs. offen
            queryAsync(`
                SELECT
                  SUM(CASE WHEN b.bezahlt=1 THEN b.betrag ELSE 0 END) as eingezogen,
                  SUM(CASE WHEN b.bezahlt=0 THEN b.betrag ELSE 0 END) as noch_offen,
                  COUNT(CASE WHEN b.bezahlt=1 THEN 1 END) as anzahl_bezahlt,
                  COUNT(CASE WHEN b.bezahlt=0 THEN 1 END) as anzahl_offen
                FROM beitraege b
                JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                WHERE DATE_FORMAT(b.zahlungsdatum,'%Y-%m') = DATE_FORMAT(NOW(),'%Y-%m')
                  AND b.art = 'mitgliedsbeitrag'
                  AND m.aktiv = 1
                  ${dojoFilter}
            `, p),

            // 3. Fehlgeschlagene Stripe-Transaktionen (noch offen)
            queryAsync(`
                SELECT COUNT(*) as anzahl, COALESCE(SUM(slt.betrag),0) as summe
                FROM stripe_lastschrift_transaktion slt
                JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
                JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
                WHERE slt.status = 'failed'
                  AND NOT EXISTS (
                      SELECT 1 FROM stripe_lastschrift_transaktion slt2
                      JOIN stripe_lastschrift_batch slb2 ON slt2.batch_id = slb2.batch_id
                      WHERE slt2.mitglied_id = slt.mitglied_id
                        AND slt2.status IN ('succeeded','processing')
                        AND slb2.monat = slb.monat AND slb2.jahr = slb.jahr
                        AND slt2.created_at >= slt.created_at
                  )
                  ${dojoFilter}
            `, p),

            // 4. Laufende (processing) Stripe-Transaktionen
            queryAsync(`
                SELECT COUNT(*) as anzahl, COALESCE(SUM(slt.betrag),0) as summe
                FROM stripe_lastschrift_transaktion slt
                JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
                WHERE slt.status = 'processing'
                  ${dojoFilter}
            `, p),

            // 5. Rücklastschriften (offene_zahlungen Tabelle)
            queryAsync(`
                SELECT COUNT(*) as anzahl, COALESCE(SUM(betrag),0) as summe
                FROM offene_zahlungen
                WHERE status = 'offen'
                  ${dojoFilterD}
            `, p),

            // 6. Mitglieder mit Zahlungsproblem-Flag
            queryAsync(`
                SELECT COUNT(*) as anzahl
                FROM mitglieder
                WHERE zahlungsproblem = 1 AND aktiv = 1
                  ${dojoFilterD}
            `, p),

            // 7. Letzte 5 erfolgreiche Einzüge
            queryAsync(`
                SELECT m.vorname, m.nachname, slt.betrag, slt.created_at,
                       slb.monat, slb.jahr
                FROM stripe_lastschrift_transaktion slt
                JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
                JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
                WHERE slt.status = 'succeeded'
                  ${dojoFilter}
                ORDER BY slt.created_at DESC LIMIT 5
            `, p),

            // 8. Monatsverlauf letzte 6 Monate (eingezogen)
            queryAsync(`
                SELECT DATE_FORMAT(b.zahlungsdatum,'%Y-%m') as monat,
                       COALESCE(SUM(b.betrag),0) as summe,
                       COUNT(*) as anzahl
                FROM beitraege b
                JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                WHERE b.bezahlt = 1
                  AND b.art = 'mitgliedsbeitrag'
                  AND b.zahlungsdatum >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                  AND m.aktiv = 1
                  ${dojoFilter}
                GROUP BY DATE_FORMAT(b.zahlungsdatum,'%Y-%m')
                ORDER BY monat ASC
            `, p)
        ]);

        res.json({
            success: true,
            offene_beitraege: {
                anzahl: offeneBeitraege[0]?.anzahl || 0,
                summe: parseFloat(offeneBeitraege[0]?.summe || 0),
                betroffene_mitglieder: offeneBeitraege[0]?.betroffene_mitglieder || 0
            },
            aktueller_monat: {
                eingezogen: parseFloat(aktuellerMonat[0]?.eingezogen || 0),
                noch_offen: parseFloat(aktuellerMonat[0]?.noch_offen || 0),
                anzahl_bezahlt: aktuellerMonat[0]?.anzahl_bezahlt || 0,
                anzahl_offen: aktuellerMonat[0]?.anzahl_offen || 0
            },
            failed_stripe: {
                anzahl: failedStripe[0]?.anzahl || 0,
                summe: parseFloat(failedStripe[0]?.summe || 0)
            },
            processing_stripe: {
                anzahl: processingStripe[0]?.anzahl || 0,
                summe: parseFloat(processingStripe[0]?.summe || 0)
            },
            ruecklastschriften: {
                anzahl: ruecklastschriften[0]?.anzahl || 0,
                summe: parseFloat(ruecklastschriften[0]?.summe || 0)
            },
            mitglieder_mit_problem: mitgliederMitProblem[0]?.anzahl || 0,
            letzte_erfolge: letzteErfolge,
            monatsverlauf
        });

    } catch (error) {
        logger.error('Fehler bei Zahlungsauswertung:', error);
        res.status(500).json({ error: 'Fehler bei der Auswertung', details: error.message });
    }
});

/**
 * GET /lastschriftlauf/stripe/failed-transactions
 * Fehlgeschlagene Stripe-Transaktionen auflisten
 */
router.get("/stripe/failed-transactions", async (req, res) => {
    try {
        const secureDojoId = getSecureDojoId(req);
        const dojoFilter = secureDojoId ? 'AND m.dojo_id = ?' : '';
        const params = secureDojoId ? [secureDojoId] : [];

        // Pro Mitglied+Monat nur den neuesten fehlgeschlagenen Eintrag
        const rows = await queryAsync(`
            SELECT
                slt.id, slt.batch_id, slt.mitglied_id, slt.betrag, slt.status,
                slt.error_code, slt.error_message, slt.stripe_payment_intent_id,
                slt.created_at, slt.beitrag_ids,
                slb.monat, slb.jahr,
                m.vorname, m.nachname, m.email, m.dojo_id,
                (SELECT sm.iban FROM sepa_mandate sm
                 WHERE sm.mitglied_id = slt.mitglied_id AND sm.status = 'aktiv'
                 LIMIT 1) AS iban
            FROM stripe_lastschrift_transaktion slt
            JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
            JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
            WHERE slt.status = 'failed'
              -- Nur der neueste Eintrag pro Mitglied+Monat+Jahr
              AND slt.id = (
                  SELECT slt3.id
                  FROM stripe_lastschrift_transaktion slt3
                  JOIN stripe_lastschrift_batch slb3 ON slt3.batch_id = slb3.batch_id
                  WHERE slt3.mitglied_id = slt.mitglied_id
                    AND slt3.status = 'failed'
                    AND slb3.monat = slb.monat
                    AND slb3.jahr = slb.jahr
                  ORDER BY slt3.created_at DESC
                  LIMIT 1
              )
              -- Kein neuerer succeeded/processing für denselben Monat
              AND NOT EXISTS (
                  SELECT 1 FROM stripe_lastschrift_transaktion slt2
                  JOIN stripe_lastschrift_batch slb2 ON slt2.batch_id = slb2.batch_id
                  WHERE slt2.mitglied_id = slt.mitglied_id
                    AND slt2.status IN ('succeeded', 'processing')
                    AND slb2.monat = slb.monat
                    AND slb2.jahr = slb.jahr
              )
              ${dojoFilter}
            ORDER BY slt.created_at DESC
            LIMIT 200
        `, params);

        // Prüfen ob Beiträge noch offen sind; bei fehlenden IDs Retry trotzdem erlauben
        const result = [];
        for (const row of rows) {
            let beitragIds = [];
            try { beitragIds = JSON.parse(row.beitrag_ids || '[]'); } catch {}
            if (beitragIds.length > 0) {
                const placeholders = beitragIds.map(() => '?').join(',');
                const beitraege = await queryAsync(
                    `SELECT beitrag_id, betrag FROM beitraege
                     WHERE beitrag_id IN (${placeholders}) AND bezahlt = 0`,
                    beitragIds
                );
                if (beitraege.length === 0) continue; // bereits bezahlt → überspringen
                row.offene_beitraege = beitraege;
                row.retry_betrag = beitraege.reduce((s, b) => s + parseFloat(b.betrag), 0);
            } else {
                // Keine beitrag_ids gespeichert — Betrag aus Transaktion nehmen, Retry erlauben
                row.offene_beitraege = [];
                row.retry_betrag = parseFloat(row.betrag);
            }
            row.can_retry = true;
            result.push(row);
        }

        res.json({ success: true, transactions: result, total: result.length });

    } catch (error) {
        logger.error('Fehler beim Laden fehlgeschlagener Transaktionen:', error);
        res.status(500).json({ error: 'Fehler beim Laden', details: error.message });
    }
});

/**
 * GET /lastschriftlauf/ueberfaellige-beitraege
 * Alle Mitglieder mit überfälligen offenen Beiträgen (vor heute, unbezahlt)
 */
router.get("/ueberfaellige-beitraege", async (req, res) => {
    try {
        const secureDojoId = getSecureDojoId(req);
        const dojoFilter = secureDojoId ? 'AND m.dojo_id = ?' : '';
        const params = secureDojoId ? [secureDojoId] : [];

        const rows = await queryAsync(`
            SELECT
                m.mitglied_id, m.vorname, m.nachname, m.email, m.telefon,
                m.iban, m.zahlungsmethode, m.zahlungsproblem,
                COUNT(b.beitrag_id) as anzahl_monate,
                COALESCE(SUM(b.betrag), 0) as gesamtbetrag,
                MIN(b.zahlungsdatum) as aeltestes_datum,
                MAX(b.zahlungsdatum) as neuestes_datum,
                DATEDIFF(CURDATE(), MIN(b.zahlungsdatum)) as tage_ueberfaellig,
                GROUP_CONCAT(DATE_FORMAT(b.zahlungsdatum,'%m/%Y') ORDER BY b.zahlungsdatum SEPARATOR ', ') as offene_monate
            FROM mitglieder m
            JOIN beitraege b ON m.mitglied_id = b.mitglied_id
            WHERE b.bezahlt = 0
              AND (b.art = 'mitgliedsbeitrag' OR b.art IS NULL)
              AND b.zahlungsdatum < CURDATE()
              AND m.aktiv = 1
              ${dojoFilter}
            GROUP BY m.mitglied_id
            ORDER BY gesamtbetrag DESC
        `, params);

        res.json({ success: true, mitglieder: rows, total: rows.length });
    } catch (error) {
        logger.error('Fehler bei überfälligen Beiträgen:', error);
        res.status(500).json({ error: 'Fehler beim Laden', details: error.message });
    }
});

/**
 * GET /lastschriftlauf/stripe/processing-transactions
 * Laufende SEPA-Clearing Transaktionen
 */
router.get("/stripe/processing-transactions", async (req, res) => {
    try {
        const secureDojoId = getSecureDojoId(req);
        const dojoFilter = secureDojoId ? 'AND m.dojo_id = ?' : '';
        const params = secureDojoId ? [secureDojoId] : [];

        const rows = await queryAsync(`
            SELECT
                slt.id, slt.batch_id, slt.mitglied_id, slt.betrag, slt.status,
                slt.stripe_payment_intent_id, slt.created_at, slt.beitrag_ids,
                slb.monat, slb.jahr,
                m.vorname, m.nachname, m.email, m.iban,
                DATEDIFF(CURDATE(), slt.created_at) as tage_im_clearing
            FROM stripe_lastschrift_transaktion slt
            JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
            JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
            WHERE slt.status = 'processing'
              ${dojoFilter}
            ORDER BY slt.created_at DESC
        `, params);

        res.json({ success: true, transactions: rows, total: rows.length });
    } catch (error) {
        logger.error('Fehler bei Processing-Transaktionen:', error);
        res.status(500).json({ error: 'Fehler beim Laden', details: error.message });
    }
});

/**
 * POST /lastschriftlauf/stripe/retry-single
 * Einzelne fehlgeschlagene Transaktion erneut einziehen
 */
router.post("/stripe/retry-single", async (req, res) => {
    try {
        const { transaktion_id, mitglied_id, monat, jahr } = req.body;

        if (!transaktion_id || !mitglied_id) {
            return res.status(400).json({ error: 'transaktion_id und mitglied_id erforderlich' });
        }

        // Original-Transaktion laden
        const [origTrans] = await queryAsync(
            `SELECT slt.*, slb.monat as orig_monat, slb.jahr as orig_jahr, m.dojo_id
             FROM stripe_lastschrift_transaktion slt
             JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
             JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
             WHERE slt.id = ? AND slt.mitglied_id = ?`,
            [transaktion_id, mitglied_id]
        );

        if (!origTrans) {
            return res.status(404).json({ error: 'Transaktion nicht gefunden' });
        }
        if (origTrans.status !== 'failed') {
            return res.status(400).json({ error: `Transaktion hat Status '${origTrans.status}' — nur fehlgeschlagene können wiederholt werden` });
        }

        // Offene Beiträge aus der ursprünglichen Transaktion
        let beitragIds = [];
        try { beitragIds = JSON.parse(origTrans.beitrag_ids || '[]'); } catch {}

        let beitraege = [];
        let betrag = parseFloat(origTrans.betrag);

        if (beitragIds.length > 0) {
            const placeholders = beitragIds.map(() => '?').join(',');
            beitraege = await queryAsync(
                `SELECT beitrag_id, betrag FROM beitraege WHERE beitrag_id IN (${placeholders}) AND bezahlt = 0`,
                beitragIds
            );
            if (beitraege.length === 0) {
                return res.status(400).json({ error: 'Alle Beiträge dieser Transaktion sind bereits bezahlt' });
            }
            betrag = beitraege.reduce((s, b) => s + parseFloat(b.betrag), 0);
        }

        const dojoId = origTrans.dojo_id;
        const useMonat = monat || origTrans.orig_monat;
        const useJahr = jahr || origTrans.orig_jahr;

        const provider = await PaymentProviderFactory.getProvider(dojoId);
        if (!provider || !provider.processLastschriftBatch) {
            return res.status(400).json({ error: 'Stripe nicht konfiguriert für dieses Dojo' });
        }

        const mitgliedData = [{
            mitglied_id,
            betrag,
            beitraege: beitraege.length > 0 ? beitraege.map(b => ({ beitrag_id: b.beitrag_id })) : []
        }];

        const result = await provider.processLastschriftBatch(mitgliedData, useMonat, useJahr);

        // Beiträge markieren sobald sie in einer Stripe-Transaktion sind
        // (succeeded = sofort bestätigt; processing = SEPA läuft) → verhindert
        // Doppelabbuchung beim nächsten Lauf (bei Rücklastschrift wird zurückgesetzt).
        const trans = result.transactions?.[0];
        if ((trans?.status === 'succeeded' || trans?.status === 'processing') && beitraege.length > 0) {
            for (const b of beitraege) {
                await queryAsync(
                    'UPDATE beitraege SET bezahlt = 1, bezahlt_am = NOW(), zahlungsart = ? WHERE beitrag_id = ?',
                    ['Stripe SEPA', b.beitrag_id]
                );
                if (b.rechnung_id) {
                    await queryAsync(
                        `UPDATE pruefungen SET gebuehr_bezahlt = 1, gebuehr_bezahlt_am = CURDATE()
                         WHERE gebuehr_rechnung_id = ? AND gebuehr_bezahlt = 0`,
                        [b.rechnung_id]
                    );
                }
            }
        }

        logger.info(`🔄 Retry Transaktion ${transaktion_id}: ${trans?.status} — Mitglied ${mitglied_id}${trans?.error ? ' — ' + trans.error : ''}`);

        res.json({
            success: true,
            status: trans?.status,
            error_detail: trans?.error || null,
            payment_intent_id: trans?.payment_intent_id,
            betrag,
            monat: useMonat,
            jahr: useJahr
        });

    } catch (error) {
        logger.error('Fehler beim Retry:', error);
        res.status(500).json({ error: 'Fehler beim erneuten Einzug', details: error.message });
    }
});

/**
 * POST /lastschriftlauf/stripe/storno/:id
 * Storniert eine laufende Stripe-Transaktion (nur status=processing möglich)
 */
router.post("/stripe/storno/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { grund } = req.body;
        const secureDojoId = getSecureDojoId(req);

        // Transaktion laden
        const [trans] = await queryAsync(
            `SELECT slt.*, slb.monat, slb.jahr, m.dojo_id
             FROM stripe_lastschrift_transaktion slt
             JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
             JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
             WHERE slt.id = ?`,
            [id]
        );

        if (!trans) return res.status(404).json({ error: 'Transaktion nicht gefunden' });

        // Dojo-Sicherheit
        if (secureDojoId && trans.dojo_id !== secureDojoId) {
            return res.status(403).json({ error: 'Kein Zugriff auf diese Transaktion' });
        }

        if (trans.status !== 'processing') {
            return res.status(400).json({
                error: `Transaktion hat Status '${trans.status}' — nur laufende (processing) können storniert werden`
            });
        }

        // Stripe Payment Intent stornieren
        let stripeResult = null;
        let stripeError = null;
        if (trans.stripe_payment_intent_id) {
            try {
                const provider = await PaymentProviderFactory.getProvider(trans.dojo_id);
                if (provider?.stripe) {
                    stripeResult = await provider.stripe.paymentIntents.cancel(trans.stripe_payment_intent_id);
                }
            } catch (stripeErr) {
                stripeError = stripeErr.message;
                // Stripe meldet: bereits abgeschlossen — PI kann nicht mehr storniert werden
                if (stripeErr.code === 'payment_intent_unexpected_state') {
                    return res.status(400).json({
                        error: 'Stripe: Diese Zahlung kann nicht mehr storniert werden (bereits abgeschlossen oder eingezogen)',
                        stripe_error: stripeErr.message
                    });
                }
                logger.warn('Stripe-Storno Fehler (PI trotzdem in DB als canceled markieren):', stripeErr.message);
            }
        }

        // Transaktion in DB als canceled markieren
        await queryAsync(
            `UPDATE stripe_lastschrift_transaktion
             SET status = 'canceled', error_message = ?, updated_at = NOW()
             WHERE id = ?`,
            [grund ? `Manuell storniert: ${grund}${stripeError ? ` | Stripe: ${stripeError}` : ''}` : 'Manuell storniert', id]
        );

        // Verknüpfte Beiträge wieder als unbezahlt markieren
        let beitragIds = [];
        try { beitragIds = JSON.parse(trans.beitrag_ids || '[]'); } catch {}
        if (beitragIds.length > 0) {
            const placeholders = beitragIds.map(() => '?').join(',');
            await queryAsync(
                `UPDATE beitraege SET bezahlt = 0, zahlungsart = NULL WHERE beitrag_id IN (${placeholders})`,
                beitragIds
            );
        }

        logger.info(`🚫 Storno Transaktion ${id} (PI: ${trans.stripe_payment_intent_id}) — Mitglied ${trans.mitglied_id} — ${trans.betrag}€${grund ? ` — Grund: ${grund}` : ''}`);

        res.json({
            success: true,
            message: `Transaktion erfolgreich storniert${stripeError ? ' (Stripe-Storno fehlgeschlagen, DB aktualisiert)' : ''}`,
            stripe_canceled: !!stripeResult,
            beitraege_zurueckgesetzt: beitragIds.length
        });

    } catch (error) {
        logger.error('Fehler beim Storno:', error);
        res.status(500).json({ error: 'Fehler beim Stornieren', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GUTSCHRIFTEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/lastschriftlauf/gutschrift
 * Gutschrift für ein Mitglied anlegen (z.B. nach Doppelabbuchung)
 */
router.post("/gutschrift", async (req, res) => {
    try {
        const { mitglied_id, betrag, grund, stripe_transaktion_id } = req.body;
        const secureDojoId = getSecureDojoId(req);

        if (!mitglied_id || !betrag || parseFloat(betrag) <= 0) {
            return res.status(400).json({ error: 'mitglied_id und betrag (> 0) erforderlich' });
        }

        const [mitglied] = await queryAsync(
            'SELECT mitglied_id, dojo_id, vorname, nachname FROM mitglieder WHERE mitglied_id = ?',
            [mitglied_id]
        );
        if (!mitglied) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        if (secureDojoId && mitglied.dojo_id !== secureDojoId) {
            return res.status(403).json({ error: 'Kein Zugriff' });
        }

        const betragNum = parseFloat(betrag);
        const result = await queryAsync(
            `INSERT INTO mitglied_gutschriften
             (mitglied_id, dojo_id, betrag, restbetrag, grund, erstellt_von, stripe_transaktion_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [mitglied_id, mitglied.dojo_id, betragNum, betragNum, grund || null, req.user?.id || null, stripe_transaktion_id || null]
        );

        logger.info(`💳 Gutschrift ${result.insertId}: ${betragNum}€ für Mitglied ${mitglied_id} — ${grund || 'kein Grund'}`);

        res.json({
            success: true,
            id: result.insertId,
            mitglied: `${mitglied.vorname} ${mitglied.nachname}`,
            betrag: betragNum,
            message: `Gutschrift über ${betragNum.toFixed(2)} € für ${mitglied.vorname} ${mitglied.nachname} angelegt`
        });
    } catch (error) {
        logger.error('Fehler beim Anlegen der Gutschrift:', error);
        res.status(500).json({ error: 'Fehler beim Anlegen der Gutschrift', details: error.message });
    }
});

/**
 * GET /api/lastschriftlauf/gutschriften?mitglied_id=X&alle=1
 * Offene (oder alle) Gutschriften eines Mitglieds abrufen
 */
router.get("/gutschriften", async (req, res) => {
    try {
        const { mitglied_id, alle } = req.query;
        const secureDojoId = getSecureDojoId(req);

        if (!mitglied_id) return res.status(400).json({ error: 'mitglied_id erforderlich' });

        let sql = `SELECT g.*, m.vorname, m.nachname, m.dojo_id
                   FROM mitglied_gutschriften g
                   JOIN mitglieder m ON g.mitglied_id = m.mitglied_id
                   WHERE g.mitglied_id = ?`;
        const params = [mitglied_id];

        if (secureDojoId) { sql += ' AND m.dojo_id = ?'; params.push(secureDojoId); }
        if (!alle) { sql += ' AND g.verrechnet = 0'; }
        sql += ' ORDER BY g.erstellt_am DESC';

        const rows = await queryAsync(sql, params);
        res.json({ success: true, gutschriften: rows });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden der Gutschriften', details: error.message });
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

// ── Auto-Lastschrift Protokoll ────────────────────────────────────────────────

/**
 * GET /api/lastschriftlauf/auto-protokoll
 * Ungelesene Einträge für Banner-Benachrichtigung
 */
router.get('/auto-protokoll', async (req, res) => {
    const dojoId = getSecureDojoId(req);
    const isSuperAdmin = !req.user?.dojo_id;
    if (!dojoId && !isSuperAdmin) return res.status(400).json({ error: 'Kein Dojo' });
    try {
        let rows;
        if (isSuperAdmin) {
            // Super-Admin sieht alle ungelesenen Einträge (mit Dojo-Name)
            rows = await queryAsync(
                `SELECT p.id, p.dojo_id, d.dojoname, p.erstellt_am, p.anzahl_verkaeufe,
                        p.gesamt_betrag_cent, p.status, p.fehler_meldung, p.gelesen
                 FROM lastschrift_auto_protokoll p
                 JOIN dojo d ON p.dojo_id = d.id
                 WHERE p.gelesen = 0
                 ORDER BY p.erstellt_am DESC LIMIT 20`
            );
        } else {
            rows = await queryAsync(
                `SELECT id, dojo_id, erstellt_am, anzahl_verkaeufe, gesamt_betrag_cent, status, fehler_meldung, gelesen
                 FROM lastschrift_auto_protokoll
                 WHERE dojo_id = ? AND gelesen = 0
                 ORDER BY erstellt_am DESC LIMIT 10`,
                [dojoId]
            );
        }
        res.json({ success: true, entries: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/lastschriftlauf/auto-protokoll/:id/lesen
 * Eintrag als gelesen markieren
 */
router.put('/auto-protokoll/:id/lesen', async (req, res) => {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo' });
    try {
        await queryAsync(
            `UPDATE lastschrift_auto_protokoll SET gelesen = 1, gelesen_am = NOW()
             WHERE id = ? AND dojo_id = ?`,
            [req.params.id, dojoId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/lastschriftlauf/auto-protokoll/:id/csv
 * CSV-Datei herunterladen
 */
router.get('/auto-protokoll/:id/csv', async (req, res) => {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo' });
    try {
        const rows = await queryAsync(
            `SELECT csv_inhalt, erstellt_am FROM lastschrift_auto_protokoll
             WHERE id = ? AND dojo_id = ?`,
            [req.params.id, dojoId]
        );
        if (!rows.length || !rows[0].csv_inhalt) {
            return res.status(404).json({ error: 'Nicht gefunden' });
        }
        const dateStr = new Date(rows[0].erstellt_am).toISOString().split('T')[0];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="Auto_Lastschrift_${dateStr}.csv"`);
        res.send('﻿' + rows[0].csv_inhalt);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================================================================
// GET /api/lastschriftlauf/zusammensetzung?mitglied_id=&dojo_id=&bis=
// Read-only: woraus sich eine anstehende Abbuchung zusammensetzt
// (offene Beiträge + Rechnungen + Verkäufe). Basis für Vorschau-Detail,
// Verwendungszweck und Member-App-Anzeige.
// =====================================================================
router.get('/zusammensetzung', async (req, res) => {
    try {
        const pool = db.promise();
        const secureDojoId = getSecureDojoId(req);
        const mid = parseInt(req.query.mitglied_id);
        if (!mid) return res.status(400).json({ error: 'mitglied_id erforderlich' });

        let bis = req.query.bis;
        if (!bis) { const n = new Date(); bis = new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().slice(0, 10); }

        const [[m]] = await pool.query(
            `SELECT mitglied_id, vorname, nachname, dojo_id FROM mitglieder WHERE mitglied_id = ?`, [mid]);
        if (!m) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        if (secureDojoId && m.dojo_id !== secureDojoId) return res.status(403).json({ error: 'Kein Zugriff auf dieses Mitglied' });

        const [beitraege] = await pool.query(
            `SELECT beitrag_id, art, betrag, zahlungsdatum, beschreibung FROM beitraege
             WHERE mitglied_id = ? AND bezahlt = 0 AND zahlungsdatum <= ? ORDER BY zahlungsdatum`, [mid, bis]);
        const [rechnungen] = await pool.query(
            `SELECT rechnung_id, rechnungsnummer, COALESCE(gesamtsumme, betrag) AS betrag, COALESCE(rechnungsdatum, datum) AS datum, beschreibung
             FROM rechnungen WHERE mitglied_id = ? AND archiviert = 0 AND status IN ('offen','teilweise_bezahlt','ueberfaellig')
             ORDER BY COALESCE(rechnungsdatum, datum)`, [mid]);
        const [verkaeufe] = await pool.query(
            `SELECT verkauf_id, bon_nummer, brutto_gesamt_cent / 100 AS betrag, verkauf_datum, bemerkung FROM verkaeufe
             WHERE mitglied_id = ? AND zahlungsart = 'lastschrift' AND zahlungsstatus = 'offen' AND (storniert = 0 OR storniert IS NULL)
             ORDER BY verkauf_datum`, [mid]);

        const num = (v) => parseFloat(v) || 0;
        const ART = { mitgliedsbeitrag: 'Mitgliedsbeitrag', pruefungsgebuehr: 'Prüfungsgebühr', artikel: 'Artikel', aufnahmegebuehr: 'Aufnahmegebühr' };
        const posten = [
            ...beitraege.map(b => ({ typ: 'beitrag', label: ART[b.art] || b.art || 'Beitrag', betrag: num(b.betrag), datum: b.zahlungsdatum, info: b.beschreibung || null })),
            ...rechnungen.map(r => ({ typ: 'rechnung', label: `Rechnung ${r.rechnungsnummer || r.rechnung_id}`, betrag: num(r.betrag), datum: r.datum, info: r.beschreibung || null })),
            ...verkaeufe.map(v => ({ typ: 'verkauf', label: `Verkauf ${v.bon_nummer || v.verkauf_id}`, betrag: num(v.betrag), datum: v.verkauf_datum, info: v.bemerkung || null })),
        ];
        const gesamt = posten.reduce((s, p) => s + p.betrag, 0);

        // Kurz-Verwendungszweck (für SEPA, ~140 Zeichen)
        const counts = {};
        posten.forEach(p => { counts[p.label] = (counts[p.label] || 0) + 1; });
        let verwendungszweck = Object.entries(counts).map(([l, c]) => (c > 1 ? `${c}x ${l}` : l)).join(' + ');
        if (verwendungszweck.length > 130) verwendungszweck = verwendungszweck.slice(0, 127) + '...';

        res.json({ success: true, mitglied: `${m.vorname} ${m.nachname}`, bis, gesamt, anzahl: posten.length, posten, verwendungszweck });
    } catch (err) {
        logger.error('Fehler bei lastschriftlauf/zusammensetzung:', { error: err });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
