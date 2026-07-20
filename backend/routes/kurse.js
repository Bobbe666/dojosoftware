const express = require("express");
const { requireStaffPermission } = require('../middleware/auth');
const db = require("../db");
const logger = require("../utils/logger");

const router = express.Router();
const { cacheGet } = require('../utils/simpleCache');
const { getSecureDojoId, isSuperAdmin } = require('../middleware/tenantSecurity');

// Alle Kurse abrufen
router.get("/", cacheGet(120000), (req, res) => {
    // 🔒 dojo_id STRIKT aus JWT (getSecureDojoId): normaler Admin = eigenes Dojo,
    // Super-Admin = null (alle) bzw. optional ?dojo_id (nur Super-Admin darf das).
    // Vorher: req.tenant?.dojo_id || req.dojo_id → ohne Subdomain-Header undefined
    // → fälschlich als Super-Admin behandelt → CROSS-TENANT-LECK (fremde Kurse sichtbar).
    let dojoId = getSecureDojoId(req);

    if (!req.user) {
        return res.status(403).json({ error: 'No tenant' });
    }

    // Optional standort_id filter und include_schedule flag
    const { standort_id, include_schedule } = req.query;

    // Wenn include_schedule=true, lade Kurse mit Stundenplan und Trainer-Namen
    if (include_schedule === 'true') {
        let query = `
            SELECT DISTINCT
                k.kurs_id,
                k.gruppenname as name,
                k.stil as stil_name,
                sp.tag as wochentag,
                sp.uhrzeit_start as uhrzeit,
                TIMESTAMPDIFF(MINUTE, sp.uhrzeit_start, sp.uhrzeit_ende) as dauer,
                r.name as raum,
                k.trainer_ids,
                k.trainer_id,
                k.min_alter,
                k.max_alter
            FROM kurse k
            LEFT JOIN stundenplan sp ON k.kurs_id = sp.kurs_id
            LEFT JOIN raeume r ON sp.raum_id = r.id
        `;
        let queryParams = [];

        // Super-Admin "Alle Dojos": Demo-Dojos ausblenden
        if (dojoId === null || dojoId === undefined) {
            query += " JOIN dojo d ON k.dojo_id = d.id AND d.dojoname NOT LIKE '%demo%'";
        }

        // Dojo-Filter
        if (dojoId !== null && dojoId !== undefined) {
            query += ' WHERE k.dojo_id = ?';
            queryParams.push(dojoId);
        }
        // Super-Admin ohne dojo_id: alle Kurse außer Demo-Dojos

        // Add standort filter if provided
        if (standort_id && standort_id !== 'all') {
            query += (dojoId !== null && dojoId !== undefined) ? ' AND k.standort_id = ?' : ' WHERE k.standort_id = ?';
            queryParams.push(standort_id);
        }

        query += ` ORDER BY
            FIELD(sp.tag, 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'),
            sp.uhrzeit_start,
            k.gruppenname
        `;

        db.query(query, queryParams, (err, kurseResults) => {
            if (err) {
                logger.error('SQL-Fehler:', { error: err });
                return res.status(500).json({ error: err.message });
            }

            if (kurseResults.length === 0) {
                return res.json([]);
            }

            // Sammle alle Trainer-IDs
            const allTrainerIds = new Set();
            kurseResults.forEach(kurs => {
                let trainerIds = [];
                if (kurs.trainer_ids && typeof kurs.trainer_ids === 'string') {
                    try {
                        trainerIds = JSON.parse(kurs.trainer_ids);
                    } catch (e) {
                        // Ungültiges JSON in trainer_ids - verwende leeres Array
                    }
                } else if (Array.isArray(kurs.trainer_ids)) {
                    trainerIds = kurs.trainer_ids;
                } else if (kurs.trainer_id) {
                    trainerIds = [kurs.trainer_id];
                }
                trainerIds.forEach(id => allTrainerIds.add(id));
            });

            if (allTrainerIds.size === 0) {
                // Keine Trainer - gebe Kurse mit TBA zurück
                return res.json(kurseResults.map(k => ({
                    ...k,
                    trainer_vorname: null,
                    trainer_nachname: null,
                    trainer_name: 'TBA'
                })));
            }

            // Lade alle Trainer
            const trainerQuery = `SELECT trainer_id, vorname, nachname FROM trainer WHERE trainer_id IN (?)`;
            db.query(trainerQuery, [Array.from(allTrainerIds)], (err, trainerResults) => {
                if (err) {
                    logger.error('Fehler beim Laden der Trainer:', { error: err });
                    return res.status(500).json({ error: "Fehler beim Laden der Trainer" });
                }

                // Erstelle Trainer-Lookup-Map
                const trainerMap = {};
                trainerResults.forEach(trainer => {
                    trainerMap[trainer.trainer_id] = trainer;
                });

                // Füge Trainer-Namen zu jedem Kurs hinzu
                const enrichedKurse = kurseResults.map(kurs => {
                    let trainerIds = [];
                    if (kurs.trainer_ids && typeof kurs.trainer_ids === 'string') {
                        try {
                            trainerIds = JSON.parse(kurs.trainer_ids);
                        } catch (e) {
                            // Ungültiges JSON in trainer_ids - verwende leeres Array
                        }
                    } else if (Array.isArray(kurs.trainer_ids)) {
                        trainerIds = kurs.trainer_ids;
                    } else if (kurs.trainer_id) {
                        trainerIds = [kurs.trainer_id];
                    }

                    const firstTrainerId = trainerIds[0];
                    const firstTrainer = trainerMap[firstTrainerId];

                    return {
                        kurs_id: kurs.kurs_id,
                        name: kurs.name,
                        stil_name: kurs.stil_name,
                        wochentag: kurs.wochentag,
                        uhrzeit: kurs.uhrzeit,
                        dauer: kurs.dauer,
                        raum: kurs.raum,
                        trainer_vorname: firstTrainer?.vorname || null,
                        trainer_nachname: firstTrainer?.nachname || null,
                        trainer_name: firstTrainer ? `${firstTrainer.vorname} ${firstTrainer.nachname}` : 'TBA',
                        min_alter: kurs.min_alter,
                        max_alter: kurs.max_alter
                    };
                });

                res.json(enrichedKurse);
            });
        });

        return; // Exit early for include_schedule path
    }

    // Original logic for admin panel (without schedule)
    let query = `
        SELECT k.*, s.name as standort_name, s.farbe as standort_farbe
        FROM kurse k
        LEFT JOIN standorte s ON k.standort_id = s.standort_id
    `;
    let queryParams = [];

    // Super-Admin "Alle Dojos": Demo-Dojos ausblenden
    if (dojoId === null || dojoId === undefined) {
        query += " JOIN dojo d ON k.dojo_id = d.id AND d.dojoname NOT LIKE '%demo%'";
    }

    // Dojo-Filter: Normaler Admin sieht nur eigenes Dojo; Super-Admin ohne dojo_id sieht alle
    if (dojoId !== null && dojoId !== undefined) {
        query += ' WHERE k.dojo_id = ?';
        queryParams.push(dojoId);
    }
    // Super-Admin ohne dojo_id: alle Kurse außer Demo-Dojos

    // Add standort filter if provided
    if (standort_id && standort_id !== 'all') {
        query += (dojoId !== null && dojoId !== undefined) ? ' AND k.standort_id = ?' : ' WHERE k.standort_id = ?';
        queryParams.push(standort_id);
    }

    query += ' ORDER BY k.gruppenname ASC';

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('SQL-Fehler:', { error: err });
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
router.post("/", requireStaffPermission('stundenplan','erstellen'), (req, res) => {
    // 🔒 dojo_id aus JWT; Super-Admin darf Ziel-Dojo optional per Body/Query angeben.
    let dojoId = getSecureDojoId(req);
    if (dojoId === null && isSuperAdmin(req) && req.body.dojo_id) {
        dojoId = parseInt(req.body.dojo_id, 10);
    }
    if (!dojoId) {
        return res.status(403).json({ error: 'No tenant' });
    }

    const { gruppenname, stil, trainer_ids, trainer_id, raum_id, standort_id } = req.body;
    const min_alter = (req.body.min_alter !== '' && req.body.min_alter != null) ? parseInt(req.body.min_alter) : null;
    const max_alter = (req.body.max_alter !== '' && req.body.max_alter != null) ? parseInt(req.body.max_alter) : null;
    const min_graduierung_id = (req.body.min_graduierung_id !== '' && req.body.min_graduierung_id != null) ? parseInt(req.body.min_graduierung_id) : null;
    const max_graduierung_id = (req.body.max_graduierung_id !== '' && req.body.max_graduierung_id != null) ? parseInt(req.body.max_graduierung_id) : null;

    // Support both old single trainer_id and new multiple trainer_ids
    const trainers = trainer_ids || (trainer_id ? [trainer_id] : []);
    if (!gruppenname || !stil || trainers.length === 0) {
        return res.status(400).json({ error: "Gruppenname, Stil und mindestens ein Trainer sind erforderlich" });
    }

    // If standort_id provided, use it; otherwise get the main location
    const insertCourse = (finalStandortId) => {
        const query = "INSERT INTO kurse (gruppenname, stil, trainer_ids, raum_id, dojo_id, standort_id, min_alter, max_alter, min_graduierung_id, max_graduierung_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        db.query(query, [gruppenname, stil, JSON.stringify(trainers), raum_id || null, dojoId, finalStandortId, min_alter, max_alter, min_graduierung_id, max_graduierung_id], (err, result) => {
            if (err) {
                logger.error('Fehler beim Hinzufügen des Kurses:', { error: err });
                return res.status(500).json({ error: "Fehler beim Speichern des Kurses" });
            }
            res.status(201).json({
                kurs_id: result.insertId,
                gruppenname,
                stil,
                trainer_ids: trainers,
                dojo_id: dojoId,
                standort_id: finalStandortId
            });
        });
    };

    if (standort_id) {
        db.query('SELECT standort_id FROM standorte WHERE standort_id = ? AND dojo_id = ?', [standort_id, dojoId], (err, results) => {
            if (err || results.length === 0) {
                return res.status(400).json({ error: 'Ungültiger Standort' });
            }
            insertCourse(standort_id);
        });
    } else {
        db.query('SELECT standort_id FROM standorte WHERE dojo_id = ? AND ist_hauptstandort = TRUE LIMIT 1', [dojoId], (err, results) => {
            if (err || results.length === 0) {
                return res.status(500).json({ error: 'Kein Hauptstandort gefunden' });
            }
            insertCourse(results[0].standort_id);
        });
    }
});

// GET /kurse/:id/auslastung — Teilnehmeranzahl (letzte 30 Tage) vs. max. Kapazität
router.get('/:id/auslastung', async (req, res) => {
  const kursId = parseInt(req.params.id, 10);
  if (isNaN(kursId)) return res.status(400).json({ error: 'Ungültige ID' });

  const dojoId = getSecureDojoId(req); // 🔒 JWT-basiert (null nur für Super-Admin)

  try {
    const whereExtra = (dojoId !== null && dojoId !== undefined) ? ' AND k.dojo_id = ?' : '';
    const params = (dojoId !== null && dojoId !== undefined) ? [kursId, dojoId] : [kursId];
    const [rows] = await db.promise().query(
      `SELECT k.max_teilnehmer,
              COUNT(DISTINCT a.mitglied_id) AS teilnehmer
       FROM kurse k
       LEFT JOIN stundenplan sp ON k.kurs_id = sp.kurs_id
       LEFT JOIN anwesenheit a ON sp.stundenplan_id = a.stundenplan_id
         AND a.anwesend = 1
         AND a.datum >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       WHERE k.kurs_id = ?${whereExtra}
       GROUP BY k.kurs_id, k.max_teilnehmer`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Kurs nicht gefunden' });
    res.json({ teilnehmer: rows[0].teilnehmer, max_teilnehmer: rows[0].max_teilnehmer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kurs löschen
router.delete("/:id", requireStaffPermission('stundenplan','loeschen'), (req, res) => {
    const dojoId = getSecureDojoId(req); // 🔒 JWT-basiert
    const superAdmin = isSuperAdmin(req);

    if (!dojoId && !superAdmin) {
        return res.status(403).json({ error: 'No tenant' });
    }

    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige ID" });
    }

    // Nur den Kurs selbst löschen — Anwesenheit & Stundenplan bleiben erhalten
    const query = (superAdmin && !dojoId)
        ? `DELETE FROM kurse WHERE kurs_id = ?`
        : `DELETE FROM kurse WHERE kurs_id = ? AND dojo_id = ?`;
    const queryParams = (superAdmin && !dojoId) ? [id] : [id, dojoId];

    db.query(query, queryParams, (err, result) => {
        if (err) {
            // FK-Constraint: Stundenplan referenziert den Kurs → erst Stundenplan-Einträge entfernen
            if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
                // Stundenplan-Einträge des Kurses löschen, dann Kurs löschen
                db.query('DELETE FROM stundenplan WHERE kurs_id = ?', [id], (err2) => {
                    if (err2) {
                        logger.error('Fehler beim Löschen des Stundenplans:', { error: err2 });
                        return res.status(500).json({ error: "Fehler beim Löschen des Kurses" });
                    }
                    db.query(query, queryParams, (err3, result3) => {
                        if (err3) {
                            logger.error('Fehler beim Löschen des Kurses (2):', { error: err3 });
                            return res.status(500).json({ error: "Fehler beim Löschen des Kurses" });
                        }
                        res.json({ success: true, message: "Kurs erfolgreich gelöscht" });
                    });
                });
                return;
            }
            logger.error('Fehler beim Löschen des Kurses:', { error: err });
            return res.status(500).json({ error: "Fehler beim Löschen des Kurses" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Kein Kurs mit dieser ID gefunden oder keine Berechtigung" });
        }
        res.json({ success: true, message: "Kurs erfolgreich gelöscht" });
    });
});

// Kurs aktualisieren (PUT)
router.put("/:id", requireStaffPermission('stundenplan','bearbeiten'), (req, res) => {
    const dojoId = getSecureDojoId(req); // 🔒 JWT-basiert
    const superAdmin = isSuperAdmin(req);

    if (!dojoId && !superAdmin) {
        return res.status(403).json({ error: 'No tenant' });
    }

    const id = parseInt(req.params.id, 10);
    const { gruppenname, stil, trainer_ids, trainer_id, raum_id } = req.body;
    const min_alter = (req.body.min_alter !== '' && req.body.min_alter != null) ? parseInt(req.body.min_alter) : null;
    const max_alter = (req.body.max_alter !== '' && req.body.max_alter != null) ? parseInt(req.body.max_alter) : null;
    const min_graduierung_id = (req.body.min_graduierung_id !== '' && req.body.min_graduierung_id != null) ? parseInt(req.body.min_graduierung_id) : null;
    const max_graduierung_id = (req.body.max_graduierung_id !== '' && req.body.max_graduierung_id != null) ? parseInt(req.body.max_graduierung_id) : null;

    // Support both old single trainer_id and new multiple trainer_ids
    const trainers = trainer_ids || (trainer_id ? [trainer_id] : []);
    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige ID" });
    }

    if (!gruppenname || !stil || trainers.length === 0) {
        return res.status(400).json({ error: "Gruppenname, Stil und mindestens ein Trainer sind erforderlich" });
    }

    const checkQuery = (superAdmin && !dojoId)
        ? `SELECT kurs_id FROM kurse WHERE kurs_id = ?`
        : `SELECT kurs_id FROM kurse WHERE kurs_id = ? AND dojo_id = ?`;
    const checkParams = (superAdmin && !dojoId) ? [id] : [id, dojoId];

    db.query(checkQuery, checkParams, (err, results) => {
        if (err) {
            logger.error('Fehler bei der ID-Überprüfung:', { error: err });
            return res.status(500).json({ error: "Fehler bei der ID-Überprüfung" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Kurs nicht gefunden oder keine Berechtigung" });
        }

        const updateQuery = (superAdmin && !dojoId)
            ? `UPDATE kurse SET gruppenname = ?, stil = ?, trainer_ids = ?, raum_id = ?, min_alter = ?, max_alter = ?, min_graduierung_id = ?, max_graduierung_id = ? WHERE kurs_id = ?`
            : `UPDATE kurse SET gruppenname = ?, stil = ?, trainer_ids = ?, raum_id = ?, min_alter = ?, max_alter = ?, min_graduierung_id = ?, max_graduierung_id = ? WHERE kurs_id = ? AND dojo_id = ?`;
        const updateParams = (superAdmin && !dojoId)
            ? [gruppenname, stil, JSON.stringify(trainers), raum_id || null, min_alter, max_alter, min_graduierung_id, max_graduierung_id, id]
            : [gruppenname, stil, JSON.stringify(trainers), raum_id || null, min_alter, max_alter, min_graduierung_id, max_graduierung_id, id, dojoId];

        db.query(updateQuery, updateParams, (err, result) => {
            if (err) {
                logger.error('Fehler beim Aktualisieren des Kurses:', { error: err });
                return res.status(500).json({ error: "Fehler beim Speichern des Kurses" });
            }

            if (result.affectedRows === 0) {
                return res.status(403).json({ error: "Keine Berechtigung - Kurs gehört zu anderem Dojo" });
            }
            res.json({ kurs_id: id, gruppenname, stil, trainer_ids: trainers, dojo_id: req.tenant?.dojo_id ?? dojoId });
        });
    });
});

module.exports = router;
