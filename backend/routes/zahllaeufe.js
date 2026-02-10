const express = require("express");
const db = require("../db");
const logger = require("../utils/logger");
const router = express.Router();

/**
 * API: Alle Zahlläufe abrufen (inkl. Stripe-Batches)
 * GET /api/zahllaeufe
 */
router.get("/", async (req, res) => {
    try {
        // 1. Klassische SEPA-Zahlläufe aus der zahllaeufe Tabelle
        const sepaQuery = `
            SELECT
                zahllauf_id,
                buchungsnummer,
                erstellt_am,
                forderungen_bis,
                geplanter_einzug,
                zahlungsanbieter,
                status,
                anzahl_buchungen,
                betrag,
                ruecklastschrift_anzahl,
                ruecklastschrift_prozent,
                csv_datei_pfad,
                xml_datei_pfad,
                notizen,
                ersteller_user_id,
                abgeschlossen_am,
                'sepa' as quelle
            FROM zahllaeufe
            ORDER BY erstellt_am DESC
        `;

        // 2. Stripe-Lastschrift-Batches
        const stripeQuery = `
            SELECT
                id as zahllauf_id,
                batch_id as buchungsnummer,
                created_at as erstellt_am,
                DATE(CONCAT(jahr, '-', LPAD(monat, 2, '0'), '-01')) as forderungen_bis,
                NULL as geplanter_einzug,
                'Stripe SEPA' as zahlungsanbieter,
                CASE status
                    WHEN 'completed' THEN 'abgeschlossen'
                    WHEN 'partial' THEN 'teilweise'
                    WHEN 'processing' THEN 'offen'
                    WHEN 'pending' THEN 'geplant'
                    WHEN 'failed' THEN 'fehler'
                    ELSE status
                END as status,
                anzahl_transaktionen as anzahl_buchungen,
                gesamtbetrag as betrag,
                fehlgeschlagene as ruecklastschrift_anzahl,
                CASE WHEN anzahl_transaktionen > 0
                    THEN ROUND((fehlgeschlagene / anzahl_transaktionen) * 100, 1)
                    ELSE 0
                END as ruecklastschrift_prozent,
                NULL as csv_datei_pfad,
                NULL as xml_datei_pfad,
                NULL as notizen,
                NULL as ersteller_user_id,
                completed_at as abgeschlossen_am,
                'stripe' as quelle
            FROM stripe_lastschrift_batch
            ORDER BY created_at DESC
        `;

        // Führe beide Queries aus
        const sepaPromise = new Promise((resolve, reject) => {
            db.query(sepaQuery, (err, results) => {
                if (err) {
                    // Falls Tabelle nicht existiert, leere Liste zurückgeben
                    if (err.code === 'ER_NO_SUCH_TABLE') {
                        return resolve([]);
                    }
                    return reject(err);
                }
                resolve(results || []);
            });
        });

        const stripePromise = new Promise((resolve, reject) => {
            db.query(stripeQuery, (err, results) => {
                if (err) {
                    // Falls Tabelle nicht existiert, leere Liste zurückgeben
                    if (err.code === 'ER_NO_SUCH_TABLE') {
                        return resolve([]);
                    }
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
    const { id } = req.params;

    const query = `
        SELECT
            z.*,
            u.username as ersteller_username
        FROM zahllaeufe z
        LEFT JOIN users u ON z.ersteller_user_id = u.user_id
        WHERE z.zahllauf_id = ?
    `;

    db.query(query, [id], (err, results) => {
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
 * API: Zahllauf erstellen
 * POST /api/zahllaeufe
 */
router.post("/", (req, res) => {
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
        notizen
    } = req.body;

    if (!buchungsnummer || !anzahl_buchungen || !betrag) {
        return res.status(400).json({
            error: 'Buchungsnummer, Anzahl Buchungen und Betrag sind erforderlich'
        });
    }

    const insertQuery = `
        INSERT INTO zahllaeufe (
            buchungsnummer,
            forderungen_bis,
            geplanter_einzug,
            zahlungsanbieter,
            status,
            anzahl_buchungen,
            betrag,
            csv_datei_pfad,
            xml_datei_pfad,
            ersteller_user_id,
            notizen
        ) VALUES (?, ?, ?, ?, 'geplant', ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        buchungsnummer,
        forderungen_bis,
        geplanter_einzug,
        zahlungsanbieter || 'SEPA (Finion AG)',
        anzahl_buchungen,
        betrag,
        csv_datei_pfad,
        xml_datei_pfad,
        ersteller_user_id,
        notizen
    ];

    db.query(insertQuery, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Erstellen des Zahllaufs:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        res.json({
            success: true,
            zahllauf_id: result.insertId,
            message: 'Zahllauf erfolgreich erstellt'
        });
    });
});

/**
 * API: Zahllauf aktualisieren
 * PUT /api/zahllaeufe/:id
 */
router.put("/:id", (req, res) => {
    const { id } = req.params;
    const {
        status,
        ruecklastschrift_anzahl,
        ruecklastschrift_prozent,
        notizen
    } = req.body;

    const updateQuery = `
        UPDATE zahllaeufe
        SET
            status = ?,
            ruecklastschrift_anzahl = ?,
            ruecklastschrift_prozent = ?,
            notizen = ?,
            abgeschlossen_am = CASE WHEN ? = 'abgeschlossen' THEN NOW() ELSE abgeschlossen_am END
        WHERE zahllauf_id = ?
    `;

    const params = [
        status,
        ruecklastschrift_anzahl,
        ruecklastschrift_prozent,
        notizen,
        status,
        id
    ];

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
    const { id } = req.params;

    const deleteQuery = `DELETE FROM zahllaeufe WHERE zahllauf_id = ?`;

    db.query(deleteQuery, [id], (err, result) => {
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
