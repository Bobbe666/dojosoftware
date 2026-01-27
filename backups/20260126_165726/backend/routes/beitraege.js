const express = require("express");
const db = require("../db"); // MySQL-Datenbankanbindung importieren
const router = express.Router();

// API: Beiträge für ein Mitglied abrufen
router.get("/", (req, res) => {
    const { mitglied_id, dojo_id } = req.query;
    
    if (!mitglied_id) {
        return res.status(400).json({ error: "Mitglied-ID ist erforderlich" });
    }

    // 🔒 DOJO-FILTER: JOIN mit mitglieder für dojo_id Sicherheit
    let whereConditions = ['b.mitglied_id = ?'];
    let queryParams = [mitglied_id];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
        SELECT
            b.beitrag_id,
            b.mitglied_id,
            b.betrag,
            b.zahlungsart,
            b.zahlungsdatum,
            b.bezahlt,
            b.dojo_id,
            b.magicline_description,
            b.magicline_transaction_id,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name
        FROM beitraege b
        JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
        ${whereClause}
        ORDER BY b.zahlungsdatum DESC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('❌ Fehler beim Abrufen der Beiträge:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json(results);
    });
});

// API: Neuen Beitrag erstellen
router.post("/", (req, res) => {
    const { mitglied_id, betrag, zahlungsart, zahlungsdatum, bezahlt, dojo_id } = req.body;
    
    if (!mitglied_id || !betrag) {
        return res.status(400).json({ error: "Mitglied-ID und Betrag sind erforderlich" });
    }

    const query = `
        INSERT INTO beitraege (mitglied_id, betrag, zahlungsart, zahlungsdatum, bezahlt, dojo_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    const params = [
        mitglied_id,
        betrag,
        zahlungsart || 'ueberweisung',
        zahlungsdatum || new Date().toISOString().split('T')[0],
        bezahlt ? 1 : 0,
        dojo_id || 1
    ];

    db.query(query, params, (err, result) => {
        if (err) {
            console.error('❌ Fehler beim Erstellen des Beitrags:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json({ 
            success: true, 
            beitrag_id: result.insertId,
            message: 'Beitrag erfolgreich erstellt'
        });
    });
});

// API: Beitrag aktualisieren
router.put("/:beitrag_id", (req, res) => {
    const { beitrag_id } = req.params;
    const { betrag, zahlungsart, zahlungsdatum, bezahlt } = req.body;

    const query = `
        UPDATE beitraege 
        SET betrag = ?, zahlungsart = ?, zahlungsdatum = ?, bezahlt = ?
        WHERE beitrag_id = ?
    `;

    const params = [
        betrag,
        zahlungsart,
        zahlungsdatum,
        bezahlt ? 1 : 0,
        beitrag_id
    ];

    db.query(query, params, (err, result) => {
        if (err) {
            console.error('❌ Fehler beim Aktualisieren des Beitrags:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }

        res.json({ 
            success: true, 
            message: 'Beitrag erfolgreich aktualisiert'
        });
    });
});

// API: Beitrag löschen
router.delete("/:beitrag_id", (req, res) => {
    const { beitrag_id } = req.params;

    const query = `DELETE FROM beitraege WHERE beitrag_id = ?`;

    db.query(query, [beitrag_id], (err, result) => {
        if (err) {
            console.error('❌ Fehler beim Löschen des Beitrags:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }

        res.json({ 
            success: true, 
            message: 'Beitrag erfolgreich gelöscht'
        });
    });
});

module.exports = router;