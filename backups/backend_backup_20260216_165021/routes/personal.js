const express = require("express");
const db = require("../db");

const router = express.Router();

// Alle Personal-Einträge abrufen
router.get("/", (req, res) => {
    const query = `
        SELECT 
            p.personal_id, p.personalnummer, p.vorname, p.nachname, p.titel,
            p.position, p.abteilung, p.beschaeftigungsart, p.arbeitszeit_stunden,
            p.email, p.telefon, p.handy,
            p.grundgehalt, p.stundenlohn, p.waehrung,
            p.einstellungsdatum, p.kuendigungsdatum, p.status,
            p.kampfkunst_graduierung, p.notizen,
            p.erstellt_am, p.aktualisiert_am,
            GROUP_CONCAT(pb.berechtigung SEPARATOR ', ') as berechtigungen
        FROM personal p
        LEFT JOIN personal_berechtigungen pb ON p.personal_id = pb.personal_id
        WHERE p.status != 'gekuendigt'
        GROUP BY p.personal_id
        ORDER BY p.nachname, p.vorname
    `;

    db.query(query, (err, results) => {
        if (err) {
            logger.error('SQL-Fehler:', { error: err });
            return res.status(500).json({ error: err.message });
        }

        if (results.length === 0) {
        } else {
        }

        // Berechtigungen als Array zurückgeben
        const processedResults = results.map(person => ({
            ...person,
            berechtigungen: person.berechtigungen ? person.berechtigungen.split(', ') : []
        }));

        res.json(processedResults);
    });
});

// Einzelnen Personal-Eintrag abrufen
router.get("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Personal-ID" });
    }
    const query = `
        SELECT 
            p.*,
            GROUP_CONCAT(pb.berechtigung SEPARATOR ', ') as berechtigungen
        FROM personal p
        LEFT JOIN personal_berechtigungen pb ON p.personal_id = pb.personal_id
        WHERE p.personal_id = ?
        GROUP BY p.personal_id
    `;

    db.query(query, [id], (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen des Personal-Eintrags:', { error: err });
            return res.status(500).json({ error: "Fehler beim Laden des Personal-Eintrags" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Personal-Eintrag nicht gefunden" });
        }

        const person = {
            ...results[0],
            berechtigungen: results[0].berechtigungen ? results[0].berechtigungen.split(', ') : []
        };

        res.json(person);
    });
});

// Neuen Personal-Eintrag hinzufügen
router.post("/", (req, res) => {
    const {
        personalnummer, vorname, nachname, titel, geburtsdatum, geschlecht,
        email, telefon, handy, position, abteilung, beschaeftigungsart,
        arbeitszeit_stunden, grundgehalt, stundenlohn, einstellungsdatum,
        kampfkunst_graduierung, berechtigungen, notizen
    } = req.body;

    if (!personalnummer || !vorname || !nachname || !position || !beschaeftigungsart || !einstellungsdatum) {
        return res.status(400).json({ 
            error: "Personalnummer, Vor-/Nachname, Position, Beschäftigungsart und Einstellungsdatum sind erforderlich" 
        });
    }
    const query = `
        INSERT INTO personal (
            personalnummer, vorname, nachname, titel, geburtsdatum, geschlecht,
            email, telefon, handy, position, abteilung, beschaeftigungsart,
            arbeitszeit_stunden, grundgehalt, stundenlohn, einstellungsdatum,
            kampfkunst_graduierung, notizen, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktiv')
    `;

    db.query(query, [
        personalnummer, vorname, nachname, titel, geburtsdatum, geschlecht,
        email, telefon, handy, position, abteilung, beschaeftigungsart,
        arbeitszeit_stunden, grundgehalt, stundenlohn, einstellungsdatum,
        kampfkunst_graduierung, notizen
    ], (err, result) => {
        if (err) {
            logger.error('Fehler beim Hinzufügen des Personal-Eintrags:', { error: err });
            return res.status(500).json({ error: "Fehler beim Speichern des Personal-Eintrags" });
        }

        const personalId = result.insertId;

        // Berechtigungen hinzufügen (wenn vorhanden)
        if (berechtigungen && Array.isArray(berechtigungen) && berechtigungen.length > 0) {
            const berechtigungenInsert = berechtigungen.map(berechtigung => [personalId, berechtigung]);
            
            db.query(
                "INSERT INTO personal_berechtigungen (personal_id, berechtigung) VALUES ?",
                [berechtigungenInsert],
                (err) => {
                    if (err) {
                    }
                }
            );
        }
        res.status(201).json({
            personal_id: personalId,
            personalnummer,
            vorname,
            nachname,
            position,
            berechtigungen: berechtigungen || []
        });
    });
});

// Personal-Eintrag aktualisieren
router.put("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const {
        personalnummer, vorname, nachname, titel, geburtsdatum, geschlecht,
        email, telefon, handy, position, abteilung, beschaeftigungsart,
        arbeitszeit_stunden, grundgehalt, stundenlohn, status,
        kampfkunst_graduierung, berechtigungen, notizen
    } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Personal-ID" });
    }

    if (!vorname || !nachname || !position) {
        return res.status(400).json({ 
            error: "Vor-/Nachname und Position sind erforderlich" 
        });
    }
    // Erst prüfen, ob der Eintrag existiert
    db.query("SELECT personal_id FROM personal WHERE personal_id = ?", [id], (err, results) => {
        if (err) {
            logger.error('Fehler bei der ID-Überprüfung:', { error: err });
            return res.status(500).json({ error: "Fehler bei der ID-Überprüfung" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Personal-Eintrag nicht gefunden" });
        }

        const query = `
            UPDATE personal SET 
                personalnummer = ?, vorname = ?, nachname = ?, titel = ?, 
                geburtsdatum = ?, geschlecht = ?, email = ?, telefon = ?, handy = ?,
                position = ?, abteilung = ?, beschaeftigungsart = ?, arbeitszeit_stunden = ?,
                grundgehalt = ?, stundenlohn = ?, status = ?, kampfkunst_graduierung = ?, 
                notizen = ?, aktualisiert_am = CURRENT_TIMESTAMP
            WHERE personal_id = ?
        `;

        db.query(query, [
            personalnummer, vorname, nachname, titel, geburtsdatum, geschlecht,
            email, telefon, handy, position, abteilung, beschaeftigungsart,
            arbeitszeit_stunden, grundgehalt, stundenlohn, status,
            kampfkunst_graduierung, notizen, id
        ], (err, result) => {
            if (err) {
                logger.error('Fehler beim Aktualisieren des Personal-Eintrags:', { error: err });
                return res.status(500).json({ error: "Fehler beim Speichern des Personal-Eintrags" });
            }
            res.json({ 
                personal_id: id, 
                personalnummer, 
                vorname, 
                nachname, 
                position,
                status: status || 'aktiv' 
            });
        });
    });
});

// Personal-Eintrag löschen (Status auf "gekündigt" setzen)
router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Personal-ID" });
    }
    const query = `
        UPDATE personal 
        SET status = 'gekuendigt', kuendigungsdatum = CURDATE(), aktualisiert_am = CURRENT_TIMESTAMP
        WHERE personal_id = ?
    `;

    db.query(query, [id], (err, result) => {
        if (err) {
            logger.error('Fehler beim Kündigen des Personal-Eintrags:', { error: err });
            return res.status(500).json({ error: "Fehler beim Kündigen des Personal-Eintrags" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Kein Personal-Eintrag mit dieser ID gefunden" });
        }
        res.json({ success: true, message: "Personal-Eintrag erfolgreich gekündigt" });
    });
});

module.exports = router;