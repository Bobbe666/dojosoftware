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
                ORDER BY m.nachname, m.vorname
            `;

            const transaktionen = await new Promise((resolve, reject) => {
                db.query(query, [id], (err, results) => {
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
                       SET b.bezahlt = 1, b.zahllauf_id = ?
                       WHERE b.beitrag_id IN (${placeholders}) AND b.bezahlt = 0 AND m.dojo_id = ?`
                    : `UPDATE beitraege SET bezahlt = 1, zahllauf_id = ?
                       WHERE beitrag_id IN (${placeholders}) AND bezahlt = 0`;
                const updateParams = effectiveDojoId
                    ? [zahllauf_id, ...validIds, effectiveDojoId]
                    : [zahllauf_id, ...validIds];
                const updateResult = await queryAsync(updateSql, updateParams);
                markedCount = updateResult.affectedRows;
            }
        }

        logger.info(`Zahllauf #${zahllauf_id} erstellt, ${markedCount} Beiträge als bezahlt markiert`);

        res.json({
            success: true,
            zahllauf_id,
            marked_bezahlt: markedCount,
            message: `Zahllauf erfolgreich erstellt${markedCount > 0 ? ` (${markedCount} Beiträge als bezahlt markiert)` : ''}`
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

    try {
        // Zahllauf auf abgeschlossen setzen
        await queryAsync(
            `UPDATE zahllaeufe SET status = 'abgeschlossen', abgeschlossen_am = NOW() WHERE zahllauf_id = ?`,
            [id]
        );

        let markedCount = 0;

        if (Array.isArray(beitrag_ids) && beitrag_ids.length > 0) {
            // Explizite Beitrag-IDs mitgegeben
            const validIds = beitrag_ids.filter(v => Number.isInteger(Number(v)));
            if (validIds.length > 0) {
                const placeholders = validIds.map(() => '?').join(',');
                const upd = await queryAsync(
                    `UPDATE beitraege SET bezahlt = 1, zahllauf_id = ? WHERE beitrag_id IN (${placeholders}) AND bezahlt = 0`,
                    [id, ...validIds]
                );
                markedCount = upd.affectedRows;
            }
        } else if (monat && jahr) {
            // Fallback: alle offenen SEPA-Beiträge des Monats markieren
            const monatStart = `${jahr}-${String(monat).padStart(2, '0')}-01`;
            const lastDay = new Date(jahr, monat, 0).getDate();
            const monatEnde = `${jahr}-${String(monat).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const dojoFilter = dojo_id ? 'AND m.dojo_id = ?' : '';
            const params = dojo_id
                ? [id, monatStart, monatEnde, dojo_id]
                : [id, monatStart, monatEnde];

            const upd = await queryAsync(`
                UPDATE beitraege b
                JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                SET b.bezahlt = 1, b.zahllauf_id = ?
                WHERE b.bezahlt = 0
                  AND b.zahlungsdatum >= ? AND b.zahlungsdatum <= ?
                  AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
                  ${dojoFilter}
            `, params);
            markedCount = upd.affectedRows;
        }

        res.json({
            success: true,
            marked_bezahlt: markedCount,
            message: `Zahllauf abgeschlossen, ${markedCount} Beiträge als bezahlt markiert`
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
    const query = `
        SELECT
            COUNT(*) as gesamt,
            SUM(CASE WHEN status = 'abgeschlossen' THEN 1 ELSE 0 END) as abgeschlossen,
            SUM(CASE WHEN status = 'offen' OR status = 'geplant' THEN 1 ELSE 0 END) as offen,
            SUM(betrag) as gesamtbetrag,
            SUM(anzahl_buchungen) as gesamt_buchungen
        FROM zahllaeufe
    `;

    db.query(query, (err, results) => {
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
