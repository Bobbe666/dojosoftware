const express = require("express");
const db = require("../db");
const router = express.Router();

// API: ALLE SEPA-Mandate abrufen (für Verwaltung)
router.get("/", (req, res) => {
    // First check if table exists
    const checkTableQuery = `SHOW TABLES LIKE 'sepa_mandate'`;

    db.query(checkTableQuery, (err, tables) => {
        if (err) {
            console.error('❌ Fehler beim Prüfen der Tabelle:', err);
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
                console.error('❌ Fehler beim Abrufen aller SEPA-Mandate:', err);
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
            
            console.error('❌ Fehler beim Abrufen der SEPA-Mandate:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json(results);
    });
});

// API: Neues SEPA-Mandat erstellen
router.post("/:mitglied_id/sepa-mandate", (req, res) => {
    const { mitglied_id } = req.params;
    const { iban, bic, bank_name, kontoinhaber, mandatsreferenz } = req.body;
    
    if (!iban || !kontoinhaber) {
        return res.status(400).json({ error: "IBAN und Kontoinhaber sind erforderlich" });
    }

    // Prüfe ob sepa_mandate Tabelle existiert, wenn nicht erstelle sie
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS sepa_mandate (
            mandat_id INT AUTO_INCREMENT PRIMARY KEY,
            mitglied_id INT NOT NULL,
            iban VARCHAR(34) NOT NULL,
            bic VARCHAR(11),
            bank_name VARCHAR(255),
            kontoinhaber VARCHAR(255) NOT NULL,
            mandatsreferenz VARCHAR(35) UNIQUE,
            status ENUM('aktiv', 'pausiert', 'gekuendigt') DEFAULT 'aktiv',
            erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            letzte_abrechnung DATE NULL,
            FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
            INDEX idx_mitglied (mitglied_id),
            INDEX idx_status (status)
        )
    `;

    db.query(createTableQuery, (err) => {
        if (err) {
            console.error('❌ Fehler beim Erstellen der SEPA-Mandate Tabelle:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        // Mandat erstellen
        const insertQuery = `
            INSERT INTO sepa_mandate (mitglied_id, iban, bic, bank_name, kontoinhaber, mandatsreferenz)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const params = [
            mitglied_id,
            iban,
            bic,
            bank_name,
            kontoinhaber,
            mandatsreferenz || `MANDAT-${mitglied_id}-${Date.now()}`
        ];

        db.query(insertQuery, params, (err, result) => {
            if (err) {
                console.error('❌ Fehler beim Erstellen des SEPA-Mandats:', err);
                return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
            }

            res.json({ 
                success: true, 
                mandat_id: result.insertId,
                message: 'SEPA-Mandat erfolgreich erstellt'
            });
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
            console.error('❌ Fehler beim Aktualisieren des SEPA-Mandats:', err);
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
            console.error('❌ Fehler beim Löschen des SEPA-Mandats:', err);
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
            console.error('❌ Fehler beim Löschen des SEPA-Mandats:', err);
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
