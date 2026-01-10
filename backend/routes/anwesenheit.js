const express = require("express");
const db = require("../db");

const router = express.Router();

// Alle Anwesenheiten abrufen (unverändert)
router.get("/", (req, res) => {
    // Tenant check
    if (!req.tenant?.dojo_id) {
        return res.status(403).json({ error: 'No tenant' });
    }

    const query = `
        SELECT a.*
        FROM anwesenheit a
        JOIN mitglieder m ON a.mitglied_id = m.mitglied_id
        WHERE m.dojo_id = ?
        ORDER BY a.datum DESC
    `;

    db.query(query, [req.tenant.dojo_id], (err, results) => {
        if (err) {
            console.error("Fehler beim Abrufen der Anwesenheitsdaten:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Anwesenheitsdaten", details: err.message });
        }

        if (!results || results.length === 0) {

            return res.status(404).json({ message: "Keine Anwesenheitsdaten vorhanden" });
        }

        res.json(results);
    });
});

// FIXED: UNION-basierte Query für Kurs-Mitglieder
router.get("/kurs/:stundenplan_id/:datum", (req, res) => {
    // Tenant check
    if (!req.tenant?.dojo_id) {
        return res.status(403).json({ error: 'No tenant' });
    }

    console.log("🔍 Anwesenheit Route aufgerufen:", {
        stundenplan_id: req.params.stundenplan_id,
        datum: req.params.datum,
        show_all: req.query.show_all,
        show_style_only: req.query.show_style_only
    });

    try {
        const stundenplan_id = parseInt(req.params.stundenplan_id, 10);
        const datum = req.params.datum;
        const show_all = req.query.show_all === 'true'; // Optional: alle Mitglieder anzeigen
        const show_style_only = req.query.show_style_only === 'true'; // NEU: Nur Stil-Filter (ohne Gruppe)

        if (isNaN(stundenplan_id)) {
            return res.status(400).json({ 
                success: false,
                error: "Ungültige Stundenplan-ID" 
            });
        }

        if (!datum || !datum.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return res.status(400).json({ 
                success: false,
                error: "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD" 
            });
        }

        let query;
        let params;

    if (show_all) {
        // ALLE aktiven Mitglieder anzeigen (für Suche)
        query = `
            SELECT DISTINCT
                m.mitglied_id,
                m.vorname,
                m.nachname,
                CONCAT(m.vorname, ' ', m.nachname) as full_name,
                m.gurtfarbe,
                m.aktiv,
                
                -- Check-in Status für heute (nur neuester Check-in)
                CASE 
                    WHEN latest_c.checkin_id IS NOT NULL THEN 'eingecheckt'
                    ELSE 'nicht_eingecheckt'
                END as checkin_status,
                
                latest_c.checkin_time,
                latest_c.checkout_time,
                latest_c.status as checkin_db_status,
                latest_c.checkin_id,
                
                -- Anwesenheitsstatus aus anwesenheit Tabelle
                COALESCE(a.anwesend, 0) as anwesend,
                a.erstellt_am as anwesenheit_eingetragen,
                
                -- Kurs-Info
                k.gruppenname as kurs_name,
                CONCAT(TIME_FORMAT(s.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(s.uhrzeit_ende, '%H:%i')) as kurs_zeit
                
            FROM mitglieder m
            LEFT JOIN (
                -- Subquery: Nur den neuesten Check-in pro Person/Kurs/Tag
                SELECT 
                    c1.mitglied_id,
                    c1.stundenplan_id,
                    c1.checkin_time,
                    c1.checkout_time,
                    c1.status,
                    c1.checkin_id
                FROM checkins c1
                INNER JOIN (
                    SELECT 
                        mitglied_id,
                        stundenplan_id,
                        MAX(checkin_time) as max_checkin_time
                    FROM checkins 
                    WHERE stundenplan_id = ? 
                        AND DATE(checkin_time) = DATE(?)
                        AND status = 'active'
                    GROUP BY mitglied_id, stundenplan_id
                ) c2 ON c1.mitglied_id = c2.mitglied_id 
                    AND c1.stundenplan_id = c2.stundenplan_id 
                    AND c1.checkin_time = c2.max_checkin_time
                    AND c1.status = 'active'
            ) latest_c ON (
                m.mitglied_id = latest_c.mitglied_id 
                AND latest_c.stundenplan_id = ?
            )
            LEFT JOIN anwesenheit a ON (
                m.mitglied_id = a.mitglied_id 
                AND a.stundenplan_id = ? 
                AND DATE(a.datum) = DATE(?)
            )
            LEFT JOIN stundenplan s ON s.stundenplan_id = ?
            LEFT JOIN kurse k ON s.kurs_id = k.kurs_id

            WHERE m.aktiv = 1 AND m.dojo_id = ?
            ORDER BY
                CASE WHEN latest_c.checkin_id IS NOT NULL THEN 0 ELSE 1 END,  -- Eingecheckte zuerst
                m.nachname, m.vorname
        `;
        params = [stundenplan_id, datum, stundenplan_id, stundenplan_id, datum, stundenplan_id, req.tenant.dojo_id];

    } else if (show_style_only) {
        // NEU: Alle Mitglieder des Stils anzeigen (vereinfacht ohne mitglied_stile)
        // Zeigt ALLE aktiven Mitglieder, unabhängig von Stil und Altersgruppe
        query = `
            SELECT DISTINCT
                m.mitglied_id,
                m.vorname,
                m.nachname,
                CONCAT(m.vorname, ' ', m.nachname) as full_name,
                m.gurtfarbe,
                m.aktiv,

                -- Check-in Status für heute (nur neuester Check-in)
                CASE
                    WHEN latest_c.checkin_id IS NOT NULL THEN 'eingecheckt'
                    ELSE 'nicht_eingecheckt'
                END as checkin_status,

                latest_c.checkin_time,
                latest_c.checkout_time,
                latest_c.status as checkin_db_status,
                latest_c.checkin_id,

                -- Anwesenheitsstatus aus anwesenheit Tabelle
                COALESCE(a.anwesend, 0) as anwesend,
                a.erstellt_am as anwesenheit_eingetragen,

                -- Kurs-Info
                k.gruppenname as kurs_name,
                CONCAT(TIME_FORMAT(s.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(s.uhrzeit_ende, '%H:%i')) as kurs_zeit,
                k.stil as kurs_stil

            FROM mitglieder m

            -- Join mit Kurs-Info um den Stil zu ermitteln
            INNER JOIN stundenplan s ON s.stundenplan_id = ?
            INNER JOIN kurse k ON s.kurs_id = k.kurs_id

            -- Check-in Status für heute
            LEFT JOIN (
                SELECT
                    c1.mitglied_id,
                    c1.stundenplan_id,
                    c1.checkin_time,
                    c1.checkout_time,
                    c1.status,
                    c1.checkin_id
                FROM checkins c1
                INNER JOIN (
                    SELECT
                        mitglied_id,
                        stundenplan_id,
                        MAX(checkin_time) as max_checkin_time
                    FROM checkins
                    WHERE stundenplan_id = ?
                        AND DATE(checkin_time) = DATE(?)
                        AND status = 'active'
                    GROUP BY mitglied_id, stundenplan_id
                ) c2 ON c1.mitglied_id = c2.mitglied_id
                    AND c1.stundenplan_id = c2.stundenplan_id
                    AND c1.checkin_time = c2.max_checkin_time
                    AND c1.status = 'active'
            ) latest_c ON (
                m.mitglied_id = latest_c.mitglied_id
                AND latest_c.stundenplan_id = ?
            )

            -- Anwesenheit für diesen Kurs und Datum
            LEFT JOIN anwesenheit a ON (
                m.mitglied_id = a.mitglied_id
                AND a.stundenplan_id = ?
                AND a.datum = ?
            )

            -- Alle aktiven Mitglieder
            WHERE m.aktiv = 1 AND m.dojo_id = ?

            ORDER BY
                CASE WHEN latest_c.checkin_id IS NOT NULL THEN 0 ELSE 1 END,  -- Eingecheckte zuerst
                CASE WHEN a.anwesend = 1 THEN 0 ELSE 1 END,  -- Dann anwesend markierte
                m.nachname, m.vorname
        `;
        params = [stundenplan_id, stundenplan_id, datum, stundenplan_id, stundenplan_id, datum, req.tenant.dojo_id];

    } else {
        // Standard: Kurs-Mitglieder (Stil + Altersgruppe)
        // Zeigt alle Mitglieder die zum Stil UND zur Altersgruppe des Kurses passen
        query = `
            SELECT DISTINCT
                m.mitglied_id,
                m.vorname,
                m.nachname,
                CONCAT(m.vorname, ' ', m.nachname) as full_name,
                m.gurtfarbe,
                m.geburtsdatum,
                m.aktiv,

                -- Check-in Status für heute
                CASE
                    WHEN latest_c.checkin_id IS NOT NULL THEN 'eingecheckt'
                    ELSE 'nicht_eingecheckt'
                END as checkin_status,

                latest_c.checkin_time,
                latest_c.checkout_time,
                latest_c.status as checkin_db_status,
                latest_c.checkin_id,

                -- Anwesenheitsstatus
                COALESCE(a.anwesend, 0) as anwesend,
                a.erstellt_am as anwesenheit_eingetragen,

                -- Kurs-Info
                k.gruppenname as kurs_name,
                CONCAT(TIME_FORMAT(s.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(s.uhrzeit_ende, '%H:%i')) as kurs_zeit,
                k.stil as kurs_stil,
                TIMESTAMPDIFF(YEAR, m.geburtsdatum, CURDATE()) as mitglied_alter

            FROM mitglieder m

            -- Join mit Kurs-Info
            INNER JOIN stundenplan s ON s.stundenplan_id = ?
            INNER JOIN kurse k ON s.kurs_id = k.kurs_id

            -- Check-in Status
            LEFT JOIN (
                SELECT
                    c1.mitglied_id,
                    c1.stundenplan_id,
                    c1.checkin_time,
                    c1.checkout_time,
                    c1.status,
                    c1.checkin_id
                FROM checkins c1
                INNER JOIN (
                    SELECT
                        mitglied_id,
                        stundenplan_id,
                        MAX(checkin_time) as max_checkin_time
                    FROM checkins
                    WHERE stundenplan_id = ?
                        AND DATE(checkin_time) = DATE(?)
                        AND status = 'active'
                    GROUP BY mitglied_id, stundenplan_id
                ) c2 ON c1.mitglied_id = c2.mitglied_id
                    AND c1.stundenplan_id = c2.stundenplan_id
                    AND c1.checkin_time = c2.max_checkin_time
                    AND c1.status = 'active'
            ) latest_c ON (
                m.mitglied_id = latest_c.mitglied_id
                AND latest_c.stundenplan_id = ?
            )

            -- Anwesenheit
            LEFT JOIN anwesenheit a ON (
                m.mitglied_id = a.mitglied_id
                AND a.stundenplan_id = ?
                AND a.datum = ?
            )

            WHERE m.aktiv = 1
                AND m.dojo_id = ?
                -- Altersgruppen-Match (vereinfacht)
                AND (
                    -- Erwachsene: 16+
                    (k.gruppenname LIKE '%Erwachsene%' AND TIMESTAMPDIFF(YEAR, m.geburtsdatum, CURDATE()) >= 16)
                    -- Jugendliche: 13-17
                    OR (k.gruppenname LIKE '%Jugendlich%' AND TIMESTAMPDIFF(YEAR, m.geburtsdatum, CURDATE()) BETWEEN 13 AND 25)
                    -- Kinder 7-12
                    OR (k.gruppenname LIKE '%7-12%' AND TIMESTAMPDIFF(YEAR, m.geburtsdatum, CURDATE()) BETWEEN 7 AND 12)
                    -- Kinder 4-6
                    OR (k.gruppenname LIKE '%4-6%' AND TIMESTAMPDIFF(YEAR, m.geburtsdatum, CURDATE()) BETWEEN 4 AND 6)
                    -- Family Training: alle Altersgruppen
                    OR (k.gruppenname LIKE '%Family%')
                )

            ORDER BY
                CASE WHEN latest_c.checkin_id IS NOT NULL THEN 0 ELSE 1 END,
                CASE WHEN a.anwesend = 1 THEN 0 ELSE 1 END,
                m.nachname, m.vorname
        `;
        params = [stundenplan_id, stundenplan_id, datum, stundenplan_id, stundenplan_id, datum, req.tenant.dojo_id];
        }

        // Sicherstellen, dass query und params definiert sind
        if (!query || !params) {
            console.error("Query oder Params nicht definiert für stundenplan_id:", stundenplan_id);
            return res.status(500).json({ 
                success: false,
                error: "Interner Fehler: Query konnte nicht erstellt werden" 
            });
        }

        db.query(query, params, (err, results) => {
            if (err) {
                console.error("Fehler beim Abrufen der Kursmitglieder:", err);
                console.error("SQL Fehler Details:", {
                    message: err.message,
                    sqlState: err.sqlState,
                    sqlMessage: err.sqlMessage,
                    code: err.code,
                    query: query.substring(0, 200) + '...',
                    params: params
                });
                return res.status(500).json({ 
                    success: false,
                    error: "Fehler beim Abrufen der Kursmitglieder", 
                    details: err.message 
                });
            }

            // FIXED: Statistiken aus den UNION-Ergebnissen berechnen
            const stats = {
                total_members: results ? results.length : 0,
                eingecheckt: results ? results.filter(r => r.checkin_status === 'eingecheckt').length : 0,
                anwesend_markiert: results ? results.filter(r => r.anwesend === 1).length : 0,
                noch_aktiv: results ? results.filter(r => r.checkin_db_status === 'active').length : 0,
                trainer_hinzugefuegt: results ? results.filter(r => r.checkin_status === 'nicht_eingecheckt' && r.anwesend === 1).length : 0
            };

            res.json({
                success: true,
                stundenplan_id: stundenplan_id,
                datum: datum,
                show_all: show_all,
                show_style_only: show_style_only,
                stats: stats,
                members: results || []
            });
        });
    } catch (error) {
        console.error("Unerwarteter Fehler in /kurs/:stundenplan_id/:datum:", error);
        return res.status(500).json({ 
            success: false,
            error: "Unerwarteter Fehler beim Abrufen der Kursmitglieder", 
            details: error.message 
        });
    }
});

// 🆕 NEU: Kursliste für Datum abrufen (für Frontend Dropdown)
router.get("/kurse/:datum", (req, res) => {
    // Tenant check
    if (!req.tenant?.dojo_id) {
        return res.status(403).json({ error: 'No tenant' });
    }

    const datum = req.params.datum;
    const today = new Date(datum);
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const todayName = dayNames[today.getDay()];

    const query = `
        SELECT
            s.stundenplan_id,
            s.tag as wochentag,
            s.uhrzeit_start,
            s.uhrzeit_ende,
            CONCAT(TIME_FORMAT(s.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(s.uhrzeit_ende, '%H:%i')) as zeit,
            k.gruppenname as kurs_name,
            k.stil,
            CONCAT(t.vorname, ' ', t.nachname) as trainer_name,

            -- Check-in Statistiken für heute
            (SELECT COUNT(*) FROM checkins c
             WHERE c.stundenplan_id = s.stundenplan_id
             AND DATE(c.checkin_time) = ?) as checkins_heute,

            (SELECT COUNT(*) FROM checkins c
             WHERE c.stundenplan_id = s.stundenplan_id
             AND DATE(c.checkin_time) = ?
             AND c.status = 'active') as aktive_checkins

        FROM stundenplan s
        LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
        LEFT JOIN trainer t ON s.trainer_id = t.trainer_id
        WHERE LOWER(s.tag) = LOWER(?) AND k.dojo_id = ?
        ORDER BY s.uhrzeit_start
    `;

    db.query(query, [datum, datum, todayName, req.tenant.dojo_id], (err, results) => {
        if (err) {
            console.error("Fehler beim Abrufen der Kurse:", err);
            return res.status(500).json({ 
                error: "Fehler beim Abrufen der Kurse", 
                details: err.message 
            });
        }

        res.json({
            success: true,
            datum: datum,
            wochentag: todayName,
            kurse: results
        });
    });
});

// Anwesenheit für ein bestimmtes Mitglied abrufen (STIL-SPEZIFISCH)
router.get("/:mitglied_id", (req, res) => {
    const dojoId = req.tenant?.dojo_id || req.dojo_id;

    // Super-Admin (dojo_id = null): Kann Anwesenheit aller zentral verwalteten Dojos sehen
    // Normaler Admin: Muss dojo_id haben
    if (dojoId === undefined && !req.user) {
        return res.status(403).json({ error: 'No tenant' });
    }

    const mitglied_id = parseInt(req.params.mitglied_id, 10);
    const { stil_id } = req.query; // Optional: Filter nach Stil

    if (isNaN(mitglied_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // Erweiterte Query mit Stil-Informationen
    let query = `
        SELECT
            a.*,
            s.stundenplan_id,
            s.tag,
            s.uhrzeit_start,
            s.uhrzeit_ende,
            k.kurs_id,
            k.gruppenname as kurs_name,
            k.stil,
            t.vorname as trainer_vorname,
            t.nachname as trainer_nachname
        FROM anwesenheit a
        JOIN mitglieder m ON a.mitglied_id = m.mitglied_id
        LEFT JOIN stundenplan s ON a.stundenplan_id = s.stundenplan_id
        LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
        LEFT JOIN trainer t ON s.trainer_id = t.trainer_id
        WHERE a.mitglied_id = ?
    `;

    let params = [mitglied_id];

    // Dojo-Filter: Super-Admin kann alle zentral verwalteten Dojos sehen
    if (dojoId === null || dojoId === undefined) {
        // Super-Admin: Nur zentral verwaltete Dojos (ohne separate Tenants)
        query += ` AND m.dojo_id NOT IN (
            SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL
        )`;
    } else {
        // Normaler Admin: Nur eigenes Dojo
        query += ' AND m.dojo_id = ?';
        params.push(dojoId);
    }

    // Optional: Filter nach Stil
    if (stil_id) {
      query += " AND k.stil = ?";
      params.push(stil_id);
    }

    query += " ORDER BY a.datum DESC";

    db.query(query, params, (err, results) => {
        if (err) {
            console.error("Fehler beim Abrufen der Anwesenheit für Mitglied:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Anwesenheit", details: err.message });
        }

        if (!results || results.length === 0) {

            return res.status(404).json({ message: `Keine Anwesenheitsdaten für Mitglied ${mitglied_id} vorhanden.` });
        }

        res.json(results);
    });
});

// Anwesenheit eintragen (erweitert für stundenplan_id)
router.post("/", (req, res) => {
    // Tenant check
    if (!req.tenant?.dojo_id) {
        return res.status(403).json({ error: 'No tenant' });
    }

    const { mitglied_id, stundenplan_id, datum, anwesend, bemerkung } = req.body;

    if (!mitglied_id || !datum) {
        return res.status(400).json({ error: "Mitglied-ID und Datum sind erforderlich." });
    }

    const mitglied_id_num = parseInt(mitglied_id, 10);
    const stundenplan_id_num = stundenplan_id ? parseInt(stundenplan_id, 10) : null;
    
    if (isNaN(mitglied_id_num)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID." });
    }

    // Mit stundenplan_id für bessere Kurs-Zuordnung
    const query = `
        INSERT INTO anwesenheit (mitglied_id, stundenplan_id, datum, anwesend, erstellt_am)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            anwesend = VALUES(anwesend),
            erstellt_am = NOW()
    `;

    const anwesend_value = anwesend === true || anwesend === 1 || anwesend === '1' ? 1 : 0;

    db.query(query, [mitglied_id_num, stundenplan_id_num, datum, anwesend_value], (err, result) => {
        if (err) {
            console.error("Fehler beim Eintragen der Anwesenheit:", err);
            return res.status(500).json({ error: "Fehler beim Eintragen der Anwesenheit", details: err.message });
        }

        // Auch in anwesenheit_protokoll eintragen falls vorhanden
        if (stundenplan_id_num) {
            const protokoll_query = `
                INSERT INTO anwesenheit_protokoll (mitglied_id, stundenplan_id, datum, status, bemerkung, erstellt_am)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    status = VALUES(status),
                    bemerkung = VALUES(bemerkung),
                    erstellt_am = NOW()
            `;
            
            const status = anwesend_value === 1 ? 'anwesend' : 'abwesend';
            
            db.query(protokoll_query, [mitglied_id_num, stundenplan_id_num, datum, status, bemerkung || null], (protokoll_err) => {
                if (protokoll_err) {

                } else {

                }
            });
        }

        res.status(201).json({ 
            success: true, 
            message: "Anwesenheit erfolgreich eingetragen", 
            id: result.insertId,
            anwesend: anwesend_value
        });
    });
});

// 🆕 NEU: Batch-Update für mehrere Anwesenheiten
router.post("/batch", (req, res) => {
    const { eintraege, stundenplan_id, datum } = req.body;

    if (!Array.isArray(eintraege) || eintraege.length === 0) {
        return res.status(400).json({ error: "Keine Einträge übermittelt." });
    }

    if (!stundenplan_id || !datum) {
        return res.status(400).json({ error: "stundenplan_id und datum sind erforderlich." });
    }

    // Transaction starten
    db.beginTransaction((err) => {
        if (err) {
            console.error("Fehler beim Starten der Transaction:", err);
            return res.status(500).json({ error: "Transaction-Fehler" });
        }

        let completed = 0;
        let errors = [];

        eintraege.forEach((eintrag, index) => {
            const { mitglied_id, anwesend, bemerkung } = eintrag;
            const anwesend_value = anwesend === true || anwesend === 1 || anwesend === '1' ? 1 : 0;

            const query = `
                INSERT INTO anwesenheit (mitglied_id, stundenplan_id, datum, anwesend, erstellt_am)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    anwesend = VALUES(anwesend),
                    erstellt_am = NOW()
            `;

            db.query(query, [mitglied_id, stundenplan_id, datum, anwesend_value], (update_err) => {
                completed++;

                if (update_err) {
                    errors.push({ mitglied_id, error: update_err.message });
                }

                // Wenn alle Einträge verarbeitet wurden
                if (completed === eintraege.length) {
                    if (errors.length > 0) {
                        db.rollback(() => {
                            console.error("Batch-Update fehlgeschlagen, Rollback durchgeführt");
                            res.status(500).json({ 
                                error: "Batch-Update fehlgeschlagen", 
                                errors: errors 
                            });
                        });
                    } else {
                        db.commit((commit_err) => {
                            if (commit_err) {
                                db.rollback(() => {
                                    console.error("Commit fehlgeschlagen, Rollback durchgeführt");
                                    res.status(500).json({ error: "Commit fehlgeschlagen" });
                                });
                            } else {

                                res.json({ 
                                    success: true, 
                                    message: `${eintraege.length} Anwesenheiten erfolgreich aktualisiert`,
                                    processed: eintraege.length
                                });
                            }
                        });
                    }
                }
            });
        });
    });
});

// Anwesenheit löschen (unverändert)
router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {

        return res.status(400).json({ error: "Ungültige Anwesenheits-ID" });
    }

    const query = "DELETE FROM anwesenheit WHERE id = ?";

    db.query(query, [id], (err, result) => {
        if (err) {
            console.error("Fehler beim Löschen der Anwesenheit:", err);
            return res.status(500).json({ error: "Fehler beim Löschen der Anwesenheit", details: err.message });
        }

        if (result.affectedRows === 0) {

            return res.status(404).json({ error: `Kein Anwesenheitsdatensatz mit ID ${id} gefunden.` });
        }

        res.json({ success: true, message: "Anwesenheitsdatensatz erfolgreich gelöscht" });
    });
});

// Router exportieren
module.exports = router;