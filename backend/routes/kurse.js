const express = require("express");
const db = require("../db");

const router = express.Router();

// Alle Kurse abrufen
router.get("/", (req, res) => {
    const { dojo_id } = req.query;
    // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause
    let whereConditions = [];
    let queryParams = [];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const query = `SELECT * FROM kurse ${whereClause} ORDER BY gruppenname ASC`;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error("SQL-Fehler:", err);
            return res.status(500).json({ error: err.message });
        }

        if (results.length === 0) {
        } else {
        }

        // Parse trainer_ids JSON strings back to arrays, support legacy trainer_id field
        const processedResults = results.map(kurs => {
            if (kurs.trainer_ids && typeof kurs.trainer_ids === 'string') {
                try {
                    kurs.trainer_ids = JSON.parse(kurs.trainer_ids);
                } catch (e) {
                    kurs.trainer_ids = [];
                }
            } else if (kurs.trainer_id && !kurs.trainer_ids) {
                // Legacy support: convert single trainer_id to array
                kurs.trainer_ids = [kurs.trainer_id];
            }
            return kurs;
        });

        res.json(processedResults);
    });
});

// Neuen Kurs hinzufügen
router.post("/", (req, res) => {
    const { gruppenname, stil, trainer_ids, trainer_id, raum_id, dojo_id } = req.body;

    // Support both old single trainer_id and new multiple trainer_ids
    const trainers = trainer_ids || (trainer_id ? [trainer_id] : []);
    if (!gruppenname || !stil || trainers.length === 0) {
        return res.status(400).json({ error: "Gruppenname, Stil und mindestens ein Trainer sind erforderlich" });
    }

    // 🔒 KRITISCH: dojo_id ist PFLICHTFELD für Tax Compliance!
    if (!dojo_id) {
        console.error("KRITISCHER FEHLER: Neuer Kurs ohne dojo_id!");
        return res.status(400).json({
            error: "dojo_id ist erforderlich - jeder Kurs MUSS einem Dojo zugeordnet sein (Tax Compliance!)",
            required: ['gruppenname', 'stil', 'trainer_ids', 'dojo_id']
        });
    }

    const query = "INSERT INTO kurse (gruppenname, stil, trainer_ids, raum_id, dojo_id) VALUES (?, ?, ?, ?, ?)";
    db.query(query, [gruppenname, stil, JSON.stringify(trainers), raum_id || null, parseInt(dojo_id)], (err, result) => {
        if (err) {
            console.error("Fehler beim Hinzufügen des Kurses:", err);
            return res.status(500).json({ error: "Fehler beim Speichern des Kurses" });
        }
        res.status(201).json({
            kurs_id: result.insertId,
            gruppenname,
            stil,
            trainer_ids: trainers,
            dojo_id: parseInt(dojo_id)
        });
    });
});

// Kurs löschen
router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige ID" });
    }
    // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause
    let whereConditions = ['kurs_id = ?'];
    let queryParams = [id];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `DELETE FROM kurse WHERE ${whereConditions.join(' AND ')}`;
    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("Fehler beim Löschen des Kurses:", err);
            return res.status(500).json({ error: "Fehler beim Löschen des Kurses" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Kein Kurs mit dieser ID gefunden oder keine Berechtigung" });
        }
        res.json({ success: true, message: "Kurs erfolgreich gelöscht" });
    });
});

// Kurs aktualisieren (PUT)
router.put("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { gruppenname, stil, trainer_ids, trainer_id, raum_id, dojo_id } = req.body;

    // Support both old single trainer_id and new multiple trainer_ids
    const trainers = trainer_ids || (trainer_id ? [trainer_id] : []);
    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige ID" });
    }

    if (!gruppenname || !stil || trainers.length === 0) {
        return res.status(400).json({ error: "Gruppenname, Stil und mindestens ein Trainer sind erforderlich" });
    }

    // 🔒 KRITISCHER DOJO-FILTER: Prüfe ob Kurs zum richtigen Dojo gehört
    let checkConditions = ['kurs_id = ?'];
    let checkParams = [id];

    if (dojo_id && dojo_id !== 'all') {
        checkConditions.push('dojo_id = ?');
        checkParams.push(parseInt(dojo_id));
    }

    const checkQuery = `SELECT kurs_id FROM kurse WHERE ${checkConditions.join(' AND ')}`;
    db.query(checkQuery, checkParams, (err, results) => {
        if (err) {
            console.error("Fehler bei der ID-Überprüfung:", err);
            return res.status(500).json({ error: "Fehler bei der ID-Überprüfung" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Kurs nicht gefunden oder keine Berechtigung" });
        }
        // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause für UPDATE
        let updateConditions = ['kurs_id = ?'];
        let updateParams = [gruppenname, stil, JSON.stringify(trainers), raum_id || null, id];

        if (dojo_id && dojo_id !== 'all') {
            updateConditions.push('dojo_id = ?');
            updateParams.push(parseInt(dojo_id));
        }

        const updateQuery = `UPDATE kurse SET gruppenname = ?, stil = ?, trainer_ids = ?, raum_id = ? WHERE ${updateConditions.join(' AND ')}`;
        db.query(updateQuery, updateParams, (err, result) => {
            if (err) {
                console.error("Fehler beim Aktualisieren des Kurses:", err);
                return res.status(500).json({ error: "Fehler beim Speichern des Kurses" });
            }

            if (result.affectedRows === 0) {
                return res.status(403).json({ error: "Keine Berechtigung - Kurs gehört zu anderem Dojo" });
            }
            res.json({ kurs_id: id, gruppenname, stil, trainer_ids: trainers, dojo_id: dojo_id ? parseInt(dojo_id) : undefined });
        });
    });
});

module.exports = router;
