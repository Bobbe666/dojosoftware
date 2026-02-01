const express = require("express");
const db = require("../db");
const router = express.Router();

/**
 * API: Alle Zahlläufe abrufen
 * GET /api/zahllaeufe
 */
router.get("/", (req, res) => {
    const query = `
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
            abgeschlossen_am
        FROM zahllaeufe
        ORDER BY erstellt_am DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            // Falls Tabelle nicht existiert, leere Liste zurückgeben
            if (err.code === 'ER_NO_SUCH_TABLE') {
                return res.json({
                    success: true,
                    data: []
                });
            }

            logger.error('Fehler beim Abrufen der Zahlläufe:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        res.json({
            success: true,
            count: results.length,
            data: results
        });
    });
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
