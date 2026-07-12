const express = require("express");
const db = require("../db");
const logger = require("../utils/logger");
const { getSecureDojoId } = require("../middleware/tenantSecurity");
const router = express.Router();

/**
 * API: Alle Zahlläufe abrufen (inkl. Stripe-Batches)
 * GET /api/zahllaeufe
 */
router.get("/", async (req, res) => {
    try {
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const secureDojoId = getSecureDojoId(req);

        // 1. Klassische SEPA-Zahlläufe aus der zahllaeufe Tabelle
        const sepaQuery = secureDojoId
            ? `SELECT zahllauf_id, buchungsnummer, erstellt_am, forderungen_bis,
                      geplanter_einzug, zahlungsanbieter, status, anzahl_buchungen,
                      betrag, ruecklastschrift_anzahl, ruecklastschrift_prozent,
                      csv_datei_pfad, xml_datei_pfad, notizen, ersteller_user_id,
                      abgeschlossen_am, 'sepa' as quelle
               FROM zahllaeufe WHERE dojo_id = ? ORDER BY erstellt_am DESC`
            : `SELECT zahllauf_id, buchungsnummer, erstellt_am, forderungen_bis,
                      geplanter_einzug, zahlungsanbieter, status, anzahl_buchungen,
                      betrag, ruecklastschrift_anzahl, ruecklastschrift_prozent,
                      csv_datei_pfad, xml_datei_pfad, notizen, ersteller_user_id,
                      abgeschlossen_am, 'sepa' as quelle
               FROM zahllaeufe ORDER BY erstellt_am DESC`;

        const sepaParams = secureDojoId ? [secureDojoId] : [];

        // 2. Stripe-Lastschrift-Batches
        const stripeQuery = secureDojoId
            ? `SELECT id as zahllauf_id, batch_id as buchungsnummer, created_at as erstellt_am,
                      DATE(CONCAT(jahr, '-', LPAD(monat, 2, '0'), '-01')) as forderungen_bis,
                      NULL as geplanter_einzug, 'Stripe SEPA' as zahlungsanbieter,
                      CASE status WHEN 'completed' THEN 'abgeschlossen' WHEN 'partial' THEN 'teilweise'
                          WHEN 'processing' THEN 'offen' WHEN 'pending' THEN 'geplant'
                          WHEN 'failed' THEN 'fehler' ELSE status END as status,
                      anzahl_transaktionen as anzahl_buchungen, gesamtbetrag as betrag,
                      fehlgeschlagene as ruecklastschrift_anzahl,
                      CASE WHEN anzahl_transaktionen > 0
                          THEN ROUND((fehlgeschlagene / anzahl_transaktionen) * 100, 1) ELSE 0
                      END as ruecklastschrift_prozent,
                      NULL as csv_datei_pfad, NULL as xml_datei_pfad, NULL as notizen,
                      NULL as ersteller_user_id, completed_at as abgeschlossen_am, 'stripe' as quelle
               FROM stripe_lastschrift_batch WHERE dojo_id = ? ORDER BY created_at DESC`
            : `SELECT id as zahllauf_id, batch_id as buchungsnummer, created_at as erstellt_am,
                      DATE(CONCAT(jahr, '-', LPAD(monat, 2, '0'), '-01')) as forderungen_bis,
                      NULL as geplanter_einzug, 'Stripe SEPA' as zahlungsanbieter,
                      CASE status WHEN 'completed' THEN 'abgeschlossen' WHEN 'partial' THEN 'teilweise'
                          WHEN 'processing' THEN 'offen' WHEN 'pending' THEN 'geplant'
                          WHEN 'failed' THEN 'fehler' ELSE status END as status,
                      anzahl_transaktionen as anzahl_buchungen, gesamtbetrag as betrag,
                      fehlgeschlagene as ruecklastschrift_anzahl,
                      CASE WHEN anzahl_transaktionen > 0
                          THEN ROUND((fehlgeschlagene / anzahl_transaktionen) * 100, 1) ELSE 0
                      END as ruecklastschrift_prozent,
                      NULL as csv_datei_pfad, NULL as xml_datei_pfad, NULL as notizen,
                      NULL as ersteller_user_id, completed_at as abgeschlossen_am, 'stripe' as quelle
               FROM stripe_lastschrift_batch ORDER BY created_at DESC`;

        const stripeParams = secureDojoId ? [secureDojoId] : [];

        // Führe beide Queries aus
        const sepaPromise = new Promise((resolve, reject) => {
            db.query(sepaQuery, sepaParams, (err, results) => {
                if (err) {
                    if (err.code === 'ER_NO_SUCH_TABLE') return resolve([]);
                    return reject(err);
                }
                resolve(results || []);
            });
        });

        const stripePromise = new Promise((resolve, reject) => {
            db.query(stripeQuery, stripeParams, (err, results) => {
                if (err) {
                    if (err.code === 'ER_NO_SUCH_TABLE') return resolve([]);
                    return reject(err);
                }
                resolve(results || []);
            });
        });

        const [sepaResults, stripeResults] = await Promise.all([sepaPromise, stripePromise]);

        // Kombiniere und sortiere nach Erstellungsdatum (neueste zuerst)
        const combinedResults = [...sepaResults, ...stripeResults].sort((a, b) => {
            const dateA = new Date(a.erstellt_am);
            const dateB = new Date(b.erstellt_am);
            return dateB - dateA;
        });

        res.json({
            success: true,
            count: combinedResults.length,
            data: combinedResults
        });

    } catch (err) {
        logger.error('Fehler beim Abrufen der Zahlläufe:', err);
        return res.status(500).json({
            error: 'Datenbankfehler',
            details: err.message
        });
    }
});

/**
 * API: Einzelnen Zahllauf abrufen
 * GET /api/zahllaeufe/:id
 */
router.get("/:id", (req, res) => {
    // 🔒 SICHERHEIT
    const secureDojoId = getSecureDojoId(req);
    const { id } = req.params;

    const dojoFilter = secureDojoId ? ' AND z.dojo_id = ?' : '';
    const query = `
        SELECT z.*, u.username as ersteller_username
        FROM zahllaeufe z
        LEFT JOIN users u ON z.ersteller_user_id = u.user_id
        WHERE z.zahllauf_id = ?${dojoFilter}
    `;
    const params = secureDojoId ? [id, secureDojoId] : [id];

    db.query(query, params, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen des Zahllaufs:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: 'Zahllauf nicht gefunden'
            });
        }

        res.json({
            success: true,
            data: results[0]
        });
    });
});

/**
 * API: Transaktionen/Details eines Zahllaufs abrufen
 * GET /api/zahllaeufe/:quelle/:id/transaktionen
 * quelle: 'stripe' oder 'sepa'
 */
router.get("/:quelle/:id/transaktionen", async (req, res) => {
    try {
        const { quelle, id } = req.params;

        if (quelle === 'stripe') {
            // 🔒 DOJO-FILTER: nur Transaktionen eigener Mitglieder (Super-Admin (null) → alle)
            const secureDojoId = getSecureDojoId(req);
            // Stripe-Transaktionen aus stripe_lastschrift_transaktion
            const query = `
                SELECT
                    t.id as transaktion_id,
                    t.mitglied_id,
                    t.betrag,
                    t.status,
                    t.beitrag_ids,
                    t.error_message,
                    t.created_at,
                    t.processed_at,
                    m.vorname,
                    m.nachname,
                    m.mitglied_id as mitgliedsnummer
                FROM stripe_lastschrift_transaktion t
                LEFT JOIN mitglieder m ON t.mitglied_id = m.mitglied_id
                WHERE t.batch_id = (
                    SELECT batch_id FROM stripe_lastschrift_batch WHERE id = ?
                )
                ${secureDojoId ? 'AND m.dojo_id = ?' : ''}
                ORDER BY m.nachname, m.vorname
            `;

            const transaktionen = await new Promise((resolve, reject) => {
                db.query(query, secureDojoId ? [id, secureDojoId] : [id], (err, results) => {
                    if (err) {
                        if (err.code === 'ER_NO_SUCH_TABLE') {
                            return resolve([]);
                        }
                        return reject(err);
                    }
                    resolve(results || []);
                });
            });

            // Für jede Transaktion die Beitrags-Details laden
            const transaktionenMitDetails = await Promise.all(
                transaktionen.map(async (t) => {
                    let beitraege = [];
                    if (t.beitrag_ids) {
                        try {
                            const beitragIds = typeof t.beitrag_ids === 'string'
                                ? JSON.parse(t.beitrag_ids)
                                : t.beitrag_ids;

                            if (Array.isArray(beitragIds) && beitragIds.length > 0) {
                                const placeholders = beitragIds.map(() => '?').join(',');
                                const beitraegeQuery = `
                                    SELECT beitrag_id, betrag, zahlungsdatum, magicline_description
                                    FROM beitraege
                                    WHERE beitrag_id IN (${placeholders})
                                `;
                                beitraege = await new Promise((resolve, reject) => {
                                    db.query(beitraegeQuery, beitragIds, (err, results) => {
                                        if (err) return resolve([]);
                                        resolve(results || []);
                                    });
                                });
                            }
                        } catch (e) {
                            logger.error('Fehler beim Parsen der beitrag_ids:', e);
                        }
                    }
                    return {
                        ...t,
                        beitraege
                    };
                })
            );

            return res.json({
                success: true,
                quelle: 'stripe',
                count: transaktionenMitDetails.length,
                transaktionen: transaktionenMitDetails
            });

        } else {
            // SEPA-Zahlläufe haben keine einzelnen Transaktionen in der DB
            // Gib eine leere Liste zurück oder lade aus CSV wenn vorhanden
            return res.json({
                success: true,
                quelle: 'sepa',
                count: 0,
                transaktionen: [],
                hinweis: 'SEPA-Zahlläufe haben keine detaillierten Transaktionsdaten in der Datenbank. Die Details sind in der CSV-Datei enthalten.'
            });
        }

    } catch (err) {
        logger.error('Fehler beim Abrufen der Transaktionen:', err);
        return res.status(500).json({
            error: 'Datenbankfehler',
            details: err.message
        });
    }
});

/**
 * API: Zahllauf erstellen + Beiträge als bezahlt markieren
 * POST /api/zahllaeufe
 * Body: { ..., beitrag_ids: [1,2,3,...] }  (aus der Vorschau)
 */
router.post("/", async (req, res) => {
    // 🔒 SICHERHEIT
    const secureDojoId = getSecureDojoId(req);

    const {
        buchungsnummer,
        forderungen_bis,
        geplanter_einzug,
        zahlungsanbieter,
        anzahl_buchungen,
        betrag,
        csv_datei_pfad,
        xml_datei_pfad,
        ersteller_user_id,
        notizen,
        dojo_id,
        beitrag_ids
    } = req.body;

    if (!buchungsnummer || !anzahl_buchungen || !betrag) {
        return res.status(400).json({
            error: 'Buchungsnummer, Anzahl Buchungen und Betrag sind erforderlich'
        });
    }

    // Effektive dojo_id: aus JWT bevorzugen (verhindert Fremdzugriff)
    const effectiveDojoId = secureDojoId || dojo_id || null;

    const pool = db.promise ? db.promise() : db;
    const queryAsync = (sql, params) => new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
    });

    try {
        // Betrag aus DB berechnen wenn beitrag_ids vorhanden (Frontend-Wert ignorieren)
        let verifiedBetrag = parseFloat(betrag) || 0;
        let verifiedAnzahl = parseInt(anzahl_buchungen) || 0;
        if (Array.isArray(beitrag_ids) && beitrag_ids.length > 0) {
            const validIds = beitrag_ids.filter(id => Number.isInteger(Number(id)));
            if (validIds.length > 0) {
                const placeholders = validIds.map(() => '?').join(',');
                const sumSql = effectiveDojoId
                    ? `SELECT COUNT(*) AS cnt, COALESCE(SUM(b.betrag),0) AS total
                       FROM beitraege b JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                       WHERE b.beitrag_id IN (${placeholders}) AND b.bezahlt = 0 AND m.dojo_id = ?`
                    : `SELECT COUNT(*) AS cnt, COALESCE(SUM(betrag),0) AS total
                       FROM beitraege WHERE beitrag_id IN (${placeholders}) AND bezahlt = 0`;
                const sumParams = effectiveDojoId ? [...validIds, effectiveDojoId] : validIds;
                const [sumRow] = await queryAsync(sumSql, sumParams);
                verifiedBetrag = parseFloat(sumRow.total) || 0;
                verifiedAnzahl = sumRow.cnt || validIds.length;
            }
        }

        // 1. Zahllauf anlegen
        const insertResult = await queryAsync(`
            INSERT INTO zahllaeufe (
                dojo_id, buchungsnummer, forderungen_bis, geplanter_einzug,
                zahlungsanbieter, status, anzahl_buchungen, betrag,
                csv_datei_pfad, xml_datei_pfad, ersteller_user_id, notizen
            ) VALUES (?, ?, ?, ?, ?, 'abgeschlossen', ?, ?, ?, ?, ?, ?)
        `, [
            effectiveDojoId, buchungsnummer, forderungen_bis, geplanter_einzug,
            zahlungsanbieter || 'SEPA (Lastschrift)', verifiedAnzahl, verifiedBetrag,
            csv_datei_pfad || null, xml_datei_pfad || null, ersteller_user_id || null, notizen || null
        ]);

        const zahllauf_id = insertResult.insertId;

        // 2. Beiträge als bezahlt markieren wenn IDs mitgegeben
        // 🔒 Dojo-Isolation: Nur Beiträge des eigenen Dojos markieren
        let markedCount = 0;
        if (Array.isArray(beitrag_ids) && beitrag_ids.length > 0) {
            const validIds = beitrag_ids.filter(id => Number.isInteger(Number(id)));
            if (validIds.length > 0) {
                const placeholders = validIds.map(() => '?').join(',');
                const updateSql = effectiveDojoId
                    ? `UPDATE beitraege b
                       JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                       SET b.bezahlt = 1, b.bezahlt_am = NOW(), b.zahllauf_id = ?, b.euer_ausblenden = 1
                       WHERE b.beitrag_id IN (${placeholders}) AND b.bezahlt = 0 AND m.dojo_id = ?`
                    : `UPDATE beitraege SET bezahlt = 1, bezahlt_am = NOW(), zahllauf_id = ?, euer_ausblenden = 1
                       WHERE beitrag_id IN (${placeholders}) AND bezahlt = 0`;
                const updateParams = effectiveDojoId
                    ? [zahllauf_id, ...validIds, effectiveDojoId]
                    : [zahllauf_id, ...validIds];
                const updateResult = await queryAsync(updateSql, updateParams);
                markedCount = updateResult.affectedRows;

                // Rechnungen und Verkaeufe auf bezahlt/eingezogen setzen
                // 🔒 Dojo-Isolation: nur eigene (JOIN mitglieder m ... AND m.dojo_id=?); Super-Admin ohne Filter
                if (markedCount > 0) {
                    await queryAsync(
                        effectiveDojoId
                        ? `UPDATE rechnungen r JOIN beitraege b ON b.rechnung_id = r.rechnung_id
                             JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                           SET r.status = 'bezahlt', r.bezahlt_am = CURDATE()
                           WHERE b.beitrag_id IN (${placeholders}) AND b.rechnung_id IS NOT NULL
                             AND r.status NOT IN ('bezahlt','storniert') AND m.dojo_id = ?`
                        : `UPDATE rechnungen r JOIN beitraege b ON b.rechnung_id = r.rechnung_id
                           SET r.status = 'bezahlt', r.bezahlt_am = CURDATE()
                           WHERE b.beitrag_id IN (${placeholders}) AND b.rechnung_id IS NOT NULL
                             AND r.status NOT IN ('bezahlt','storniert')`,
                        effectiveDojoId ? [...validIds, effectiveDojoId] : validIds
                    );
                    await queryAsync(
                        effectiveDojoId
                        ? `UPDATE verkaeufe v JOIN beitraege b ON b.magicline_description LIKE CONCAT('%Bon: ', v.bon_nummer, '%')
                             JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                           SET v.zahlungsstatus = 'eingezogen'
                           WHERE b.beitrag_id IN (${placeholders}) AND v.zahlungsart = 'lastschrift'
                             AND v.zahlungsstatus IN ('offen','in_einzug') AND m.dojo_id = ?`
                        : `UPDATE verkaeufe v JOIN beitraege b ON b.magicline_description LIKE CONCAT('%Bon: ', v.bon_nummer, '%')
                           SET v.zahlungsstatus = 'eingezogen'
                           WHERE b.beitrag_id IN (${placeholders}) AND v.zahlungsart = 'lastschrift'
                             AND v.zahlungsstatus IN ('offen','in_einzug')`,
                        effectiveDojoId ? [...validIds, effectiveDojoId] : validIds
                    );
                }
            }
        }

        // Starterpaket-Bestellungen 'in_einzug' → 'bezahlt' (Bank hat bestätigt)
        const spSql = effectiveDojoId
            ? `UPDATE starterpaket_bestellungen SET status = 'bezahlt', zahllauf_id = ? WHERE status = 'in_einzug' AND dojo_id = ?`
            : `UPDATE starterpaket_bestellungen SET status = 'bezahlt', zahllauf_id = ? WHERE status = 'in_einzug'`;
        const spParams = effectiveDojoId ? [zahllauf_id, effectiveDojoId] : [zahllauf_id];
        const spResult = await queryAsync(spSql, spParams);
        if (spResult.affectedRows > 0) {
            logger.info(`${spResult.affectedRows} Starterpaket-Bestellungen als bezahlt markiert (Zahllauf #${zahllauf_id})`);
        }

        // Marketing-Artikel-Bestellungen 'in_einzug' → 'bezahlt'
        try {
            const maSql = effectiveDojoId
                ? `UPDATE marketing_bestellungen SET status = 'bezahlt', zahllauf_id = ? WHERE status = 'in_einzug' AND dojo_id = ?`
                : `UPDATE marketing_bestellungen SET status = 'bezahlt', zahllauf_id = ? WHERE status = 'in_einzug'`;
            const maParams = effectiveDojoId ? [zahllauf_id, effectiveDojoId] : [zahllauf_id];
            const maResult = await queryAsync(maSql, maParams);
            if (maResult.affectedRows > 0) {
                logger.info(`${maResult.affectedRows} Marketing-Bestellungen als bezahlt markiert (Zahllauf #${zahllauf_id})`);
            }
        } catch (_) { /* Tabelle noch nicht migriert */ }

        logger.info(`Zahllauf #${zahllauf_id} erstellt, ${markedCount} Beiträge als bezahlt markiert`);

        res.json({
            success: true,
            zahllauf_id,
            marked_bezahlt: markedCount,
            sp_bezahlt: spResult.affectedRows,
            message: `Zahllauf erfolgreich erstellt${markedCount > 0 ? ` (${markedCount} Beiträge als bezahlt markiert)` : ''}${spResult.affectedRows > 0 ? ` + ${spResult.affectedRows} Starterpaket-Bestellungen bezahlt` : ''}`
        });

    } catch (err) {
        logger.error('Fehler beim Erstellen des Zahllaufs:', err);
        return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

/**
 * API: Bestehenden Zahllauf abschließen + Beiträge als bezahlt markieren
 * POST /api/zahllaeufe/:id/abschliessen
 * Body: { monat, jahr, dojo_id }  ODER  { beitrag_ids: [...] }
 */
router.post("/:id/abschliessen", async (req, res) => {
    const { id } = req.params;
    const { monat, jahr, dojo_id, beitrag_ids } = req.body;

    const queryAsync = (sql, params) => new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
    });

    // 🔒 DOJO-SCOPE: Normal-User immer eigenes Dojo (Body-dojo_id ignorieren);
    // Super-Admin (null) darf die Body-dojo_id verwenden.
    const secureDojoId = getSecureDojoId(req);
    const scopeDojoId = secureDojoId || dojo_id || null;

    try {
        // Zahllauf auf abgeschlossen setzen — 🔒 nur eigenes Dojo (Super-Admin scopeDojoId null → ohne Filter)
        await queryAsync(
            `UPDATE zahllaeufe SET status = 'abgeschlossen', abgeschlossen_am = NOW() WHERE zahllauf_id = ?${scopeDojoId ? ' AND dojo_id = ?' : ''}`,
            scopeDojoId ? [id, scopeDojoId] : [id]
        );

        let markedCount = 0;

        if (Array.isArray(beitrag_ids) && beitrag_ids.length > 0) {
            // Explizite Beitrag-IDs mitgegeben — 🔒 auf eigenes Dojo filtern (Cross-Tenant-Schutz)
            let validIds = beitrag_ids.filter(v => Number.isInteger(Number(v))).map(Number);
            if (scopeDojoId && validIds.length > 0) {
                const own = await queryAsync(`SELECT beitrag_id FROM beitraege WHERE beitrag_id IN (?) AND dojo_id = ?`, [validIds, scopeDojoId]);
                validIds = own.map(r => r.beitrag_id);
            }
            if (validIds.length > 0) {
                const placeholders = validIds.map(() => '?').join(',');
                const upd = await queryAsync(
                    `UPDATE beitraege SET bezahlt = 1, bezahlt_am = NOW(), zahllauf_id = ?, euer_ausblenden = 1 WHERE beitrag_id IN (${placeholders}) AND bezahlt = 0`,
                    [id, ...validIds]
                );
                markedCount = upd.affectedRows;
                // Sync: Prüfungsgebühr-Status in pruefungen aktualisieren
                await queryAsync(
                    `UPDATE pruefungen p
                     JOIN beitraege b ON b.rechnung_id = p.gebuehr_rechnung_id
                     SET p.gebuehr_bezahlt = 1, p.gebuehr_bezahlt_am = CURDATE()
                     WHERE b.beitrag_id IN (${placeholders}) AND p.gebuehr_bezahlt = 0`,
                    [...validIds]
                );
                // Rechnungen und Verkaeufe auf bezahlt/eingezogen setzen
                if (markedCount > 0) {
                    await queryAsync(
                        `UPDATE rechnungen r JOIN beitraege b ON b.rechnung_id = r.rechnung_id
                         SET r.status = 'bezahlt', r.bezahlt_am = CURDATE()
                         WHERE b.beitrag_id IN (${placeholders}) AND b.rechnung_id IS NOT NULL
                           AND r.status NOT IN ('bezahlt','storniert')`,
                        validIds
                    );
                    await queryAsync(
                        `UPDATE verkaeufe v JOIN beitraege b ON b.magicline_description LIKE CONCAT('%Bon: ', v.bon_nummer, '%')
                         SET v.zahlungsstatus = 'eingezogen'
                         WHERE b.beitrag_id IN (${placeholders}) AND v.zahlungsart = 'lastschrift'
                           AND v.zahlungsstatus IN ('offen','in_einzug')`,
                        validIds
                    );
                }
            }
        } else if (monat && jahr) {
            // Fallback: alle offenen SEPA-Beiträge des Monats markieren
            const monatStart = `${jahr}-${String(monat).padStart(2, '0')}-01`;
            const lastDay = new Date(jahr, monat, 0).getDate();
            const monatEnde = `${jahr}-${String(monat).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const dojoFilter = scopeDojoId ? 'AND m.dojo_id = ?' : '';
            const params = scopeDojoId
                ? [id, monatStart, monatEnde, scopeDojoId]
                : [id, monatStart, monatEnde];

            const upd = await queryAsync(`
                UPDATE beitraege b
                JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                SET b.bezahlt = 1, b.bezahlt_am = NOW(), b.zahllauf_id = ?, b.euer_ausblenden = 1
                WHERE b.bezahlt = 0
                  AND b.zahlungsdatum >= ? AND b.zahlungsdatum <= ?
                  AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
                  ${dojoFilter}
            `, params);
            markedCount = upd.affectedRows;
            // Sync: Prüfungsgebühr-Status in pruefungen aktualisieren
            await queryAsync(`
                UPDATE pruefungen p
                JOIN beitraege b ON b.rechnung_id = p.gebuehr_rechnung_id
                JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                SET p.gebuehr_bezahlt = 1, p.gebuehr_bezahlt_am = CURDATE()
                WHERE b.bezahlt = 1
                  AND b.zahlungsdatum >= ? AND b.zahlungsdatum <= ?
                  AND p.gebuehr_bezahlt = 0
                  ${dojoFilter}
            `, scopeDojoId ? [monatStart, monatEnde, scopeDojoId] : [monatStart, monatEnde]);
        }

        // Starterpaket-Bestellungen 'in_einzug' → 'bezahlt' (Bank hat bestätigt)
        const spDojoId = scopeDojoId || null;
        const spSql2 = spDojoId
            ? `UPDATE starterpaket_bestellungen SET status = 'bezahlt', zahllauf_id = ? WHERE status = 'in_einzug' AND dojo_id = ?`
            : `UPDATE starterpaket_bestellungen SET status = 'bezahlt', zahllauf_id = ? WHERE status = 'in_einzug'`;
        const spRes2 = await queryAsync(spSql2, spDojoId ? [id, spDojoId] : [id]);
        if (spRes2.affectedRows > 0) {
            logger.info(`${spRes2.affectedRows} Starterpaket-Bestellungen als bezahlt markiert (Zahllauf #${id})`);
        }

        res.json({
            success: true,
            marked_bezahlt: markedCount,
            sp_bezahlt: spRes2.affectedRows,
            message: `Zahllauf abgeschlossen, ${markedCount} Beiträge als bezahlt markiert${spRes2.affectedRows > 0 ? ` + ${spRes2.affectedRows} Starterpaket-Bestellungen` : ''}`
        });

    } catch (err) {
        logger.error('Fehler beim Abschließen des Zahllaufs:', err);
        return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

/**
 * API: Zahllauf aktualisieren
 * PUT /api/zahllaeufe/:id
 */
router.put("/:id", (req, res) => {
    // 🔒 SICHERHEIT
    const secureDojoId = getSecureDojoId(req);
    const { id } = req.params;
    const { status, ruecklastschrift_anzahl, ruecklastschrift_prozent, notizen } = req.body;

    const dojoFilter = secureDojoId ? ' AND dojo_id = ?' : '';
    const updateQuery = `
        UPDATE zahllaeufe
        SET status = ?, ruecklastschrift_anzahl = ?, ruecklastschrift_prozent = ?, notizen = ?,
            abgeschlossen_am = CASE WHEN ? = 'abgeschlossen' THEN NOW() ELSE abgeschlossen_am END
        WHERE zahllauf_id = ?${dojoFilter}
    `;

    const params = secureDojoId
        ? [status, ruecklastschrift_anzahl, ruecklastschrift_prozent, notizen, status, id, secureDojoId]
        : [status, ruecklastschrift_anzahl, ruecklastschrift_prozent, notizen, status, id];

    db.query(updateQuery, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Aktualisieren des Zahllaufs:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Zahllauf nicht gefunden'
            });
        }

        res.json({
            success: true,
            message: 'Zahllauf erfolgreich aktualisiert'
        });
    });
});

/**
 * API: Zahllauf löschen
 * DELETE /api/zahllaeufe/:id
 */
router.delete("/:id", (req, res) => {
    // 🔒 SICHERHEIT
    const secureDojoId = getSecureDojoId(req);
    const { id } = req.params;

    const dojoFilter = secureDojoId ? ' AND dojo_id = ?' : '';
    const deleteQuery = `DELETE FROM zahllaeufe WHERE zahllauf_id = ?${dojoFilter}`;
    const params = secureDojoId ? [id, secureDojoId] : [id];

    db.query(deleteQuery, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Löschen des Zahllaufs:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Zahllauf nicht gefunden'
            });
        }

        res.json({
            success: true,
            message: 'Zahllauf erfolgreich gelöscht'
        });
    });
});

/**
 * API: Statistiken für Zahlläufe
 * GET /api/zahllaeufe/statistiken
 */
router.get("/stats/overview", (req, res) => {
    // 🔒 DOJO-FILTER: nur eigene Zahlläufe (Super-Admin (null) → alle)
    const secureDojoId = getSecureDojoId(req);
    const query = `
        SELECT
            COUNT(*) as gesamt,
            SUM(CASE WHEN status = 'abgeschlossen' THEN 1 ELSE 0 END) as abgeschlossen,
            SUM(CASE WHEN status = 'offen' OR status = 'geplant' THEN 1 ELSE 0 END) as offen,
            SUM(betrag) as gesamtbetrag,
            SUM(anzahl_buchungen) as gesamt_buchungen
        FROM zahllaeufe
        ${secureDojoId ? 'WHERE dojo_id = ?' : ''}
    `;

    db.query(query, secureDojoId ? [secureDojoId] : [], (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Statistiken:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        res.json({
            success: true,
            data: results[0]
        });
    });
});

module.exports = router;
