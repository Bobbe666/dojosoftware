const express = require("express");
const db = require("../db");
const router = express.Router();
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// API: Transaktionen für ein Mitglied abrufen
router.get("/", (req, res) => {
    const { mitglied_id } = req.query;
    // 🔒 SICHER: Verwende getSecureDojoId statt req.query.dojo_id
    const secureDojoId = getSecureDojoId(req);

    if (!mitglied_id) {
        return res.status(400).json({ error: "Mitglied-ID ist erforderlich" });
    }
    // 🔒 DOJO-FILTER: JOIN mit mitglieder für dojo_id Sicherheit
    let whereConditions = ['t.mitglied_id = ?'];
    let queryParams = [mitglied_id];

    if (secureDojoId) {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
        SELECT 
            t.id,
            t.mitglied_id,
            t.typ,
            t.betrag,
            t.status,
            t.faellig_am,
            t.bezahlt_am,
            t.zahlungsart,
            t.mahnstufe,
            t.letzte_mahnung,
            t.erstellt_am,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name
        FROM transaktionen t
        JOIN mitglieder m ON t.mitglied_id = m.mitglied_id
        ${whereClause}
        ORDER BY t.erstellt_am DESC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Transaktionen:', { error: err });
            return res.status(500).json({ error: "Fehler beim Laden der Transaktionen" });
        }
        res.json(results);
    });
});

// API: Neue Transaktion erstellen
router.post("/", (req, res) => {
    const { mitglied_id, typ, betrag, status, faellig_am, bezahlt_am, zahlungsart } = req.body;
    // 🔒 SICHER: Verwende getSecureDojoId statt req.body.dojo_id
    const secureDojoId = getSecureDojoId(req);

    if (!mitglied_id || !typ || !betrag) {
        return res.status(400).json({ error: "Mitglied-ID, Typ und Betrag sind erforderlich" });
    }
    // 🔒 SICHERHEIT: Prüfe ob Mitglied existiert und zu welchem Dojo es gehört
    const checkMemberQuery = "SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?";

    db.query(checkMemberQuery, [mitglied_id], (checkErr, checkResults) => {
        if (checkErr) {
            console.error('Fehler beim Prüfen des Mitglieds:', checkErr);
            return res.status(500).json({ error: "Fehler beim Prüfen des Mitglieds" });
        }

        if (checkResults.length === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden" });
        }

        const memberDojoId = checkResults[0].dojo_id;

        // 🔒 SICHERHEIT: Prüfe ob User Berechtigung für dieses Dojo hat
        if (secureDojoId && secureDojoId !== memberDojoId) {
            console.error('SICHERHEITSVERLETZUNG: Versuch Transaktion für falsches Dojo zu erstellen!');
            return res.status(403).json({
                error: "Keine Berechtigung - Mitglied gehört zu anderem Dojo",
                member_dojo: memberDojoId,
                user_dojo: secureDojoId
            });
        }

        const insertQuery = `
            INSERT INTO transaktionen (mitglied_id, typ, betrag, status, faellig_am, bezahlt_am, zahlungsart) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            mitglied_id,
            typ,
            betrag,
            status || 'offen',
            faellig_am || null,
            bezahlt_am || null,
            zahlungsart || null
        ];

        db.query(insertQuery, values, (err, result) => {
            if (err) {
                logger.error('Fehler beim Erstellen der Transaktion:', { error: err });
                return res.status(500).json({ error: "Fehler beim Erstellen der Transaktion" });
            }
            res.status(201).json({
                id: result.insertId,
                mitglied_id,
                typ,
                betrag,
                status: status || 'offen',
                faellig_am,
                bezahlt_am,
                zahlungsart
            });
        });
    });
});

// API: Transaktion aktualisieren
router.put("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status, bezahlt_am, zahlungsart, mahnstufe, letzte_mahnung } = req.body;
    // 🔒 SICHER: Verwende getSecureDojoId statt req.body.dojo_id
    const secureDojoId = getSecureDojoId(req);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Transaktions-ID" });
    }
    // 🔒 SICHERHEIT: Prüfe Berechtigung über JOIN mit mitglieder
    let whereConditions = ['t.id = ?'];
    let queryParams = [id];

    if (secureDojoId) {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Baue UPDATE-Query dynamisch
    const updateFields = [];
    const updateValues = [];

    if (status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(status);
    }
    if (bezahlt_am !== undefined) {
        updateFields.push('bezahlt_am = ?');
        updateValues.push(bezahlt_am);
    }
    if (zahlungsart !== undefined) {
        updateFields.push('zahlungsart = ?');
        updateValues.push(zahlungsart);
    }
    if (mahnstufe !== undefined) {
        updateFields.push('mahnstufe = ?');
        updateValues.push(mahnstufe);
    }
    if (letzte_mahnung !== undefined) {
        updateFields.push('letzte_mahnung = ?');
        updateValues.push(letzte_mahnung);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ error: "Keine Felder zum Aktualisieren angegeben" });
    }

    const updateQuery = `
        UPDATE transaktionen t
        JOIN mitglieder m ON t.mitglied_id = m.mitglied_id
        SET ${updateFields.join(', ')}
        ${whereClause}
    `;

    const allValues = [...updateValues, ...queryParams];

    db.query(updateQuery, allValues, (err, result) => {
        if (err) {
            logger.error('Fehler beim Aktualisieren der Transaktion:', { error: err });
            return res.status(500).json({ error: "Fehler beim Aktualisieren der Transaktion" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Transaktion nicht gefunden oder keine Berechtigung" });
        }
        res.json({ success: true, message: "Transaktion aktualisiert" });
    });
});

// API: Transaktion löschen
router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    // 🔒 SICHER: Verwende getSecureDojoId statt req.query.dojo_id
    const secureDojoId = getSecureDojoId(req);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Transaktions-ID" });
    }
    // 🔒 SICHERHEIT: Prüfe Berechtigung über JOIN mit mitglieder
    let whereConditions = ['t.id = ?'];
    let queryParams = [id];

    if (secureDojoId) {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const deleteQuery = `
        DELETE t FROM transaktionen t
        JOIN mitglieder m ON t.mitglied_id = m.mitglied_id
        ${whereClause}
    `;

    db.query(deleteQuery, queryParams, (err, result) => {
        if (err) {
            logger.error('Fehler beim Löschen der Transaktion:', { error: err });
            return res.status(500).json({ error: "Fehler beim Löschen der Transaktion" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Transaktion nicht gefunden oder keine Berechtigung" });
        }
        res.json({ success: true, message: "Transaktion gelöscht" });
    });
});

module.exports = router;
















