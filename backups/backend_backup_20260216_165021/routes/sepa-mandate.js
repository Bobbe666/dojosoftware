const express = require("express");
const logger = require('../utils/logger');
const crypto = require("crypto");
const db = require("../db");
const router = express.Router();

// API: ALLE SEPA-Mandate abrufen (für Verwaltung)
router.get("/", (req, res) => {
    // First check if table exists
    const checkTableQuery = `SHOW TABLES LIKE 'sepa_mandate'`;

    db.query(checkTableQuery, (err, tables) => {
        if (err) {
            logger.error('Fehler beim Prüfen der Tabelle:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        if (tables.length === 0) {
            // Table doesn't exist yet, return empty result
            return res.json({
                success: true,
                data: []
            });
        }

        // Table exists, fetch data
        const query = `
            SELECT
                sm.mandat_id,
                sm.mitglied_id,
                sm.iban,
                sm.bic,
                sm.bankname as bank_name,
                sm.kontoinhaber,
                sm.mandatsreferenz,
                sm.glaeubiger_id,
                sm.status,
                sm.erstellungsdatum,
                sm.letzte_nutzung,
                sm.archiviert,
                sm.mandat_typ,
                sm.provider,
                CONCAT(m.vorname, ' ', m.nachname) as mitglied_name
            FROM sepa_mandate sm
            LEFT JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
            WHERE sm.archiviert = 0 OR sm.archiviert IS NULL
            ORDER BY sm.erstellungsdatum DESC
        `;

        db.query(query, (err, results) => {
            if (err) {
                logger.error('Fehler beim Abrufen aller SEPA-Mandate:', err);
                return res.status(500).json({
                    error: 'Datenbankfehler',
                    details: err.message
                });
            }

            res.json({
                success: true,
                data: results
            });
        });
    });
});

// API: SEPA-Mandate für ein Mitglied abrufen
router.get("/:mitglied_id/sepa-mandate", (req, res) => {
    const { mitglied_id } = req.params;

    // Prüfe ob sepa_mandate Tabelle existiert
    const query = `
        SELECT 
            sm.mandat_id,
            sm.mitglied_id,
            sm.iban,
            sm.bic,
            sm.bank_name,
            sm.kontoinhaber,
            sm.mandatsreferenz,
            sm.status,
            sm.erstellt_am,
            sm.letzte_abrechnung,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name
        FROM sepa_mandate sm
        JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
        WHERE sm.mitglied_id = ?
        ORDER BY sm.erstellt_am DESC
    `;

    db.query(query, [mitglied_id], (err, results) => {
        if (err) {
            // Wenn Tabelle nicht existiert, leere Liste zurückgeben
            if (err.code === 'ER_NO_SUCH_TABLE') {
                return res.json([]);
            }
            
            logger.error('Fehler beim Abrufen der SEPA-Mandate:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json(results);
    });
});

// API: Neues SEPA-Mandat erstellen
router.post("/:mitglied_id/sepa-mandate", (req, res) => {
    const { mitglied_id } = req.params;
    const {
        iban,
        bic,
        bank_name,
        kontoinhaber,
        mandatsreferenz,
        // Digitale Unterschrift Felder
        unterschrift_digital,
        unterschrift_datum,
        unterschrift_ip
    } = req.body;

    if (!iban || !kontoinhaber) {
        return res.status(400).json({ error: "IBAN und Kontoinhaber sind erforderlich" });
    }

    // Generiere Hash der Unterschrift fuer Integritaet
    let unterschriftHash = null;
    if (unterschrift_digital) {
        unterschriftHash = crypto.createHash('sha256')
            .update(unterschrift_digital)
            .digest('hex');
    }

    // Generiere Mandatsreferenz falls nicht angegeben
    const finalMandatsreferenz = mandatsreferenz || `DOJO-${mitglied_id}-${Date.now()}`;

    // Mandat erstellen mit Unterschrift
    const insertQuery = `
        INSERT INTO sepa_mandate (
            mitglied_id, iban, bic, bankname, kontoinhaber, mandatsreferenz,
            unterschrift_digital, unterschrift_datum, unterschrift_ip, unterschrift_hash,
            status, erstellungsdatum
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktiv', NOW())
    `;

    const params = [
        mitglied_id,
        iban,
        bic || null,
        bank_name || null,
        kontoinhaber,
        finalMandatsreferenz,
        unterschrift_digital || null,
        unterschrift_datum ? new Date(unterschrift_datum) : null,
        unterschrift_ip || null,
        unterschriftHash
    ];

    db.query(insertQuery, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Erstellen des SEPA-Mandats:', { error: err });
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        // Log fuer Audit-Trail
        logger.debug(`SEPA-Mandat erstellt: ID=${result.insertId}, Mitglied=${mitglied_id}, ` +
            `Ref=${finalMandatsreferenz}, Signiert=${!!unterschrift_digital}`);

        res.json({
            success: true,
            mandat_id: result.insertId,
            mandatsreferenz: finalMandatsreferenz,
            message: 'SEPA-Mandat erfolgreich erstellt' +
                (unterschrift_digital ? ' (mit digitaler Unterschrift)' : '')
        });
    });
});

// API: SEPA-Mandat aktualisieren
router.put("/:mitglied_id/sepa-mandate/:mandat_id", (req, res) => {
    const { mitglied_id, mandat_id } = req.params;
    const { iban, bic, bank_name, kontoinhaber, status } = req.body;

    const query = `
        UPDATE sepa_mandate 
        SET iban = ?, bic = ?, bank_name = ?, kontoinhaber = ?, status = ?
        WHERE mandat_id = ? AND mitglied_id = ?
    `;

    const params = [
        iban,
        bic,
        bank_name,
        kontoinhaber,
        status,
        mandat_id,
        mitglied_id
    ];

    db.query(query, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Aktualisieren des SEPA-Mandats:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'SEPA-Mandat nicht gefunden' });
        }

        res.json({ 
            success: true, 
            message: 'SEPA-Mandat erfolgreich aktualisiert'
        });
    });
});

// API: SEPA-Mandat löschen (mit mitglied_id)
router.delete("/:mitglied_id/sepa-mandate/:mandat_id", (req, res) => {
    const { mitglied_id, mandat_id } = req.params;

    const query = `DELETE FROM sepa_mandate WHERE mandat_id = ? AND mitglied_id = ?`;

    db.query(query, [mandat_id, mitglied_id], (err, result) => {
        if (err) {
            logger.error('Fehler beim Löschen des SEPA-Mandats:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'SEPA-Mandat nicht gefunden' });
        }

        res.json({
            success: true,
            message: 'SEPA-Mandat erfolgreich gelöscht'
        });
    });
});

// API: SEPA-Mandat löschen (direkter Zugriff über mandat_id für Verwaltung)
router.delete("/:mandat_id", (req, res) => {
    const { mandat_id } = req.params;

    const query = `DELETE FROM sepa_mandate WHERE mandat_id = ?`;

    db.query(query, [mandat_id], (err, result) => {
        if (err) {
            logger.error('Fehler beim Löschen des SEPA-Mandats:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'SEPA-Mandat nicht gefunden' });
        }

        res.json({
            success: true,
            message: 'SEPA-Mandat erfolgreich gelöscht'
        });
    });
});

module.exports = router;
