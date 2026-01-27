const express = require("express");
const db = require("../db"); // Verbindung zur DB importieren

const router = express.Router();

// API: Alle Anwesenheitseinträge abrufen
router.get("/", (req, res) => {
    const query = `
        SELECT a.id, a.datum, m.vorname, m.nachname 
        FROM anwesenheit a
        JOIN mitglieder m ON a.mitglied_id = m.mitglied_id
        ORDER BY a.datum DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Fehler beim Abrufen der Anwesenheit:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Anwesenheit" });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: "Keine Anwesenheitseinträge vorhanden" });
        }
        res.json(results);
    });
});

// API: Anwesenheit nach Datum abrufen
router.get("/:datum", (req, res) => {
    const { datum } = req.params;
    const query = `
        SELECT a.id, a.datum, m.vorname, m.nachname 
        FROM anwesenheit a
        JOIN mitglieder m ON a.mitglied_id = m.mitglied_id
        WHERE a.datum = ?
        ORDER BY m.nachname
    `;

    db.query(query, [datum], (err, results) => {
        if (err) {
            console.error("Fehler beim Abrufen der Anwesenheit für Datum", datum, ":", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Anwesenheit" });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: `Keine Anwesenheitseinträge für ${datum} vorhanden` });
        }
        res.json(results);
    });
});

// API: Neue Anwesenheit hinzufügen
router.post("/", (req, res) => {
    const { mitglied_id, datum } = req.body;
    if (!mitglied_id || !datum) {
        return res.status(400).json({ error: "Mitglied-ID und Datum sind erforderlich" });
    }

    const query = "INSERT INTO anwesenheit (mitglied_id, datum) VALUES (?, ?)";

    db.query(query, [mitglied_id, datum], (err, result) => {
        if (err) {
            console.error("Fehler beim Speichern der Anwesenheit:", err);
            return res.status(500).json({ error: "Fehler beim Speichern der Anwesenheit" });
        }
        res.status(201).json({ id: result.insertId, mitglied_id, datum });
    });
});

// API: Anwesenheitseintrag löschen
router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Anwesenheits-ID" });
    }

    const query = "DELETE FROM anwesenheit WHERE id = ?";

    db.query(query, [id], (err, result) => {
        if (err) {
            console.error("Fehler beim Löschen des Anwesenheitseintrags:", err);
            return res.status(500).json({ error: "Fehler beim Löschen des Anwesenheitseintrags" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: `Kein Eintrag mit ID ${id} gefunden.` });
        }
        res.json({ success: true, message: "Eintrag erfolgreich gelöscht" });
    });
});

// Router exportieren
module.exports = router;
