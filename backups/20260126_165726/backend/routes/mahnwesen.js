const express = require("express");
const db = require("../db");
const router = express.Router();

// API: Alle offenen Beiträge abrufen (nicht bezahlt)
router.get("/offene-beitraege", (req, res) => {
    const { dojo_id } = req.query;

    let whereConditions = ['b.bezahlt = 0'];
    let queryParams = [];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('b.dojo_id = ?');
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
            b.dojo_id,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
            m.email,
            m.telefon,
            DATEDIFF(CURDATE(), b.zahlungsdatum) as tage_ueberfaellig,
            (SELECT COUNT(*) FROM mahnungen WHERE beitrag_id = b.beitrag_id) as mahnstufe
        FROM beitraege b
        JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
        ${whereClause}
        ORDER BY b.zahlungsdatum ASC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('❌ Fehler beim Abrufen offener Beiträge:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json({ success: true, data: results });
    });
});

// API: Mahnungen abrufen
router.get("/mahnungen", (req, res) => {
    const { mitglied_id, beitrag_id, dojo_id } = req.query;

    let whereConditions = [];
    let queryParams = [];

    if (mitglied_id) {
        whereConditions.push('b.mitglied_id = ?');
        queryParams.push(mitglied_id);
    }

    if (beitrag_id) {
        whereConditions.push('mah.beitrag_id = ?');
        queryParams.push(beitrag_id);
    }

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('b.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const query = `
        SELECT
            mah.mahnung_id,
            mah.beitrag_id,
            mah.mahnstufe,
            mah.mahndatum,
            mah.mahngebuehr,
            mah.versandt,
            mah.versand_art,
            b.betrag as beitrag_betrag,
            b.zahlungsdatum as beitrag_faellig_am,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
            m.email,
            b.mitglied_id
        FROM mahnungen mah
        JOIN beitraege b ON mah.beitrag_id = b.beitrag_id
        JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
        ${whereClause}
        ORDER BY mah.mahndatum DESC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('❌ Fehler beim Abrufen der Mahnungen:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json({ success: true, data: results });
    });
});

// API: Neue Mahnung erstellen
router.post("/mahnungen", (req, res) => {
    const { beitrag_id, mahnstufe, mahngebuehr, versand_art } = req.body;

    if (!beitrag_id || !mahnstufe) {
        return res.status(400).json({ error: "Beitrag-ID und Mahnstufe sind erforderlich" });
    }

    // Prüfe ob Beitrag existiert und nicht bezahlt ist
    const checkQuery = `SELECT bezahlt FROM beitraege WHERE beitrag_id = ?`;

    db.query(checkQuery, [beitrag_id], (checkErr, checkResults) => {
        if (checkErr) {
            console.error('❌ Fehler beim Prüfen des Beitrags:', checkErr);
            return res.status(500).json({ error: 'Datenbankfehler', details: checkErr.message });
        }

        if (checkResults.length === 0) {
            return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }

        if (checkResults[0].bezahlt === 1) {
            return res.status(400).json({ error: 'Beitrag ist bereits bezahlt' });
        }

        // Erstelle Mahnung
        const query = `
            INSERT INTO mahnungen (beitrag_id, mahnstufe, mahndatum, mahngebuehr, versandt, versand_art)
            VALUES (?, ?, CURDATE(), ?, 0, ?)
        `;

        const params = [
            beitrag_id,
            mahnstufe,
            mahngebuehr || 0,
            versand_art || 'email'
        ];

        db.query(query, params, (err, result) => {
            if (err) {
                console.error('❌ Fehler beim Erstellen der Mahnung:', err);
                return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
            }

            res.json({
                success: true,
                mahnung_id: result.insertId,
                message: 'Mahnung erfolgreich erstellt'
            });
        });
    });
});

// API: Mahnung als versendet markieren
router.put("/mahnungen/:mahnung_id/versandt", (req, res) => {
    const { mahnung_id } = req.params;

    const query = `
        UPDATE mahnungen
        SET versandt = 1
        WHERE mahnung_id = ?
    `;

    db.query(query, [mahnung_id], (err, result) => {
        if (err) {
            console.error('❌ Fehler beim Aktualisieren der Mahnung:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mahnung nicht gefunden' });
        }

        res.json({
            success: true,
            message: 'Mahnung als versendet markiert'
        });
    });
});

// API: Statistiken für Mahnwesen
router.get("/statistiken", (req, res) => {
    const { dojo_id } = req.query;

    let whereCondition = dojo_id && dojo_id !== 'all' ? 'WHERE b.dojo_id = ?' : '';
    let queryParams = dojo_id && dojo_id !== 'all' ? [parseInt(dojo_id)] : [];

    const query = `
        SELECT
            COUNT(DISTINCT b.beitrag_id) as offene_beitraege,
            SUM(b.betrag) as offene_summe,
            COUNT(DISTINCT CASE WHEN DATEDIFF(CURDATE(), b.zahlungsdatum) > 30 THEN b.beitrag_id END) as ueberfaellig_30_tage,
            COUNT(DISTINCT mah.mahnung_id) as anzahl_mahnungen,
            COUNT(DISTINCT CASE WHEN mah.mahnstufe = 1 THEN mah.mahnung_id END) as mahnstufe_1,
            COUNT(DISTINCT CASE WHEN mah.mahnstufe = 2 THEN mah.mahnung_id END) as mahnstufe_2,
            COUNT(DISTINCT CASE WHEN mah.mahnstufe = 3 THEN mah.mahnung_id END) as mahnstufe_3
        FROM beitraege b
        LEFT JOIN mahnungen mah ON b.beitrag_id = mah.beitrag_id
        ${whereCondition}
        AND b.bezahlt = 0
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('❌ Fehler beim Abrufen der Statistiken:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json({ success: true, data: results[0] || {} });
    });
});

// API: Beitrag als bezahlt markieren
router.put("/beitraege/:beitrag_id/bezahlt", (req, res) => {
    const { beitrag_id } = req.params;

    const query = `
        UPDATE beitraege
        SET bezahlt = 1
        WHERE beitrag_id = ?
    `;

    db.query(query, [beitrag_id], (err, result) => {
        if (err) {
            console.error('❌ Fehler beim Markieren als bezahlt:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }

        res.json({
            success: true,
            message: 'Beitrag als bezahlt markiert'
        });
    });
});

// API: Mahnstufen-Einstellungen abrufen
router.get("/mahnstufen-einstellungen", (req, res) => {
    const { dojo_id } = req.query;

    let whereCondition = dojo_id && dojo_id !== 'all' ? 'WHERE dojo_id = ?' : '';
    let queryParams = dojo_id && dojo_id !== 'all' ? [parseInt(dojo_id)] : [];

    const query = `
        SELECT *
        FROM mahnstufen_einstellungen
        ${whereCondition}
        ORDER BY stufe ASC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('❌ Fehler beim Abrufen der Mahnstufen-Einstellungen:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json({ success: true, data: results });
    });
});

// API: Mahnstufen-Einstellungen speichern
router.post("/mahnstufen-einstellungen", (req, res) => {
    const { mahnstufen } = req.body;

    if (!mahnstufen || !Array.isArray(mahnstufen)) {
        return res.status(400).json({ error: "Mahnstufen-Daten sind erforderlich" });
    }

    // Lösche alte Einstellungen und füge neue ein
    const deleteQuery = 'DELETE FROM mahnstufen_einstellungen';

    db.query(deleteQuery, (deleteErr) => {
        if (deleteErr) {
            console.error('❌ Fehler beim Löschen alter Einstellungen:', deleteErr);
            return res.status(500).json({ error: 'Datenbankfehler', details: deleteErr.message });
        }

        // Füge neue Einstellungen ein
        const insertValues = mahnstufen.map(m => [
            m.stufe,
            m.bezeichnung,
            m.tage_nach_faelligkeit,
            m.mahngebuehr,
            m.email_betreff,
            m.email_text,
            m.aktiv ? 1 : 0,
            1 // dojo_id - später anpassen für Multi-Dojo
        ]);

        const insertQuery = `
            INSERT INTO mahnstufen_einstellungen
            (stufe, bezeichnung, tage_nach_faelligkeit, mahngebuehr, email_betreff, email_text, aktiv, dojo_id)
            VALUES ?
        `;

        db.query(insertQuery, [insertValues], (insertErr, result) => {
            if (insertErr) {
                console.error('❌ Fehler beim Speichern der Einstellungen:', insertErr);
                return res.status(500).json({ error: 'Datenbankfehler', details: insertErr.message });
            }

            res.json({
                success: true,
                message: 'Mahnstufen-Einstellungen erfolgreich gespeichert'
            });
        });
    });
});

module.exports = router;
