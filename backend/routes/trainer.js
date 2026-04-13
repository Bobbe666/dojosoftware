const express = require("express");
const logger = require('../utils/logger');
const db = require("../db");
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const { generateVereinbarungPdf, generateInfoblattPdf } = require('../utils/trainerPdfGenerator');

const DOKUMENTE_DIR = path.join(__dirname, '../../generated_documents/trainer');
if (!fs.existsSync(DOKUMENTE_DIR)) fs.mkdirSync(DOKUMENTE_DIR, { recursive: true });

// Alle Trainer abrufen (inkl. Mehrfachzuordnung der Stile)
router.get("/", (req, res) => {
    const dojoId = req.user?.dojo_id || req.dojo_id;

    // Debug logging
    logger.info('Trainer GET Request:', {
        user: req.user,
        dojo_id: req.dojo_id,
        calculated_dojoId: dojoId
    });

    // Super-Admin (dojo_id = null): Kann Trainer aller zentral verwalteten Dojos sehen
    // Normaler Admin: Muss dojo_id haben
    if (dojoId === undefined && !req.user) {
        return res.status(403).json({ error: 'No tenant' });
    }

    let query = `
        SELECT t.trainer_id, t.vorname, t.nachname, t.email, t.telefon, t.dojo_id,
               COALESCE(GROUP_CONCAT(DISTINCT ts.stil ORDER BY ts.stil SEPARATOR ', '), '') AS stile
        FROM trainer t
        LEFT JOIN trainer_stile ts ON t.trainer_id = ts.trainer_id
    `;
    let queryParams = [];

    // Dojo-Filter: Super-Admin kann alle zentral verwalteten Dojos sehen
    if (dojoId === null || dojoId === undefined) {
        // Super-Admin: Nur zentral verwaltete Dojos (ohne separate Tenants)
        query += ` WHERE t.dojo_id NOT IN (
            SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt', 'trainer', 'checkin')
        )`;
    } else {
        // Normaler Admin: Nur eigenes Dojo
        query += ' WHERE t.dojo_id = ?';
        queryParams.push(dojoId);
    }

    query += ' GROUP BY t.trainer_id, t.vorname, t.nachname, t.email, t.telefon, t.dojo_id';

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Trainer:', { error: err });
            return res.status(500).json({ error: "Fehler beim Laden der Trainer", details: err.sqlMessage });
        }

        res.json(results.map((trainer) => ({
            trainer_id: trainer.trainer_id,
            vorname: trainer.vorname,
            nachname: trainer.nachname,
            email: trainer.email,
            telefon: trainer.telefon,
            stile: trainer.stile ? trainer.stile.split(", ") : [],
            dojo_id: trainer.dojo_id
        })));
    });
});

// Neuen Trainer hinzufügen (mit Transaktion)
router.post("/", (req, res) => {
    const { vorname, nachname, email, telefon, stile } = req.body;

    if (!vorname || !nachname) {
        return res.status(400).json({ error: "Vorname und Nachname erforderlich." });
    }

    db.getConnection((err, connection) => {
        if (err) {
            logger.error('Datenbankverbindungsfehler:', { error: err });
            return res.status(500).json({ error: "Fehler bei der Datenbankverbindung", details: err.sqlMessage });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                logger.error('Fehler beim Starten der Transaktion:', { error: err });
                return res.status(500).json({ error: "Fehler beim Hinzufügen des Trainers", details: err.sqlMessage });
            }

            // Trainer einfügen (ohne Stile)
            connection.query(
                "INSERT INTO trainer (vorname, nachname, email, telefon) VALUES (?, ?, ?, ?)",
                [vorname, nachname, email || '', telefon || ''],
                (err, result) => {
                    if (err) {
                        connection.rollback(() => connection.release());
                        logger.error('Fehler beim Speichern des Trainers:', { error: err });
                        return res.status(500).json({ error: "Fehler beim Speichern des Trainers", details: err.sqlMessage });
                    }

                    const trainerId = result.insertId;
                    
                    // Wenn Stile vorhanden sind, diese auch einfügen
                    if (stile && Array.isArray(stile) && stile.length > 0) {
                        const stilInsert = stile.map((stil) => [trainerId, stil]);
                        
                        connection.query(
                            "INSERT INTO trainer_stile (trainer_id, stil) VALUES ?",
                            [stilInsert],
                            (err) => {
                                if (err) {

                                    // Aber Trainer trotzdem erfolgreich erstellen
                                }
                                
                                // Transaktion abschließen
                                connection.commit((err) => {
                                    if (err) {
                                        connection.rollback(() => connection.release());
                                        logger.error('Fehler beim Abschließen der Transaktion:', { error: err });
                                        return res.status(500).json({ error: "Fehler beim Speichern des Trainers", details: err.sqlMessage });
                                    }

                                    connection.release();
                                    res.status(201).json({ trainer_id: trainerId, vorname, nachname, email, telefon, stile: stile || [] });
                                });
                            }
                        );
                    } else {
                        // Kein Stil - direkt abschließen
                        connection.commit((err) => {
                            if (err) {
                                connection.rollback(() => connection.release());
                                logger.error('Fehler beim Abschließen der Transaktion:', { error: err });
                                return res.status(500).json({ error: "Fehler beim Speichern des Trainers", details: err.sqlMessage });
                            }

                            connection.release();
                            res.status(201).json({ trainer_id: trainerId, vorname, nachname, email, telefon, stile: [] });
                        });
                    }
                }
            );
        });
    });
});

// Trainer aktualisieren (inkl. Stile)
router.put("/:id", (req, res) => {
    const trainerId = req.params.id;
    const { vorname, nachname, email, telefon, stile } = req.body;

    if (!vorname || !nachname) {
        return res.status(400).json({ error: "Vorname und Nachname erforderlich." });
    }

    // Dojo-Sicherheit: Trainer muss zum eigenen Dojo gehören (oder kein Dojo haben = Altdaten)
    const dojoId = req.user?.dojo_id || req.dojo_id;
    const dojoCheck = dojoId ? ' AND (dojo_id = ? OR dojo_id IS NULL)' : '';
    const checkParams = dojoId ? [trainerId, dojoId] : [trainerId];

    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "Datenbankverbindungsfehler" });

        connection.beginTransaction((err) => {
            if (err) { connection.release(); return res.status(500).json({ error: "Transaktionsfehler" }); }

            connection.query(`SELECT trainer_id FROM trainer WHERE trainer_id = ?${dojoCheck}`, checkParams, (err, rows) => {
                if (err || rows.length === 0) {
                    connection.rollback(() => connection.release());
                    logger.warn('Trainer PUT: nicht gefunden', { trainerId, dojoId });
                    return res.status(404).json({ error: "Trainer nicht gefunden" });
                }

                connection.query(
                    "UPDATE trainer SET vorname=?, nachname=?, email=?, telefon=? WHERE trainer_id=?",
                    [vorname, nachname, email || '', telefon || '', trainerId],
                    (err) => {
                        if (err) {
                            connection.rollback(() => connection.release());
                            logger.error('Trainer PUT: UPDATE fehlgeschlagen', { error: err });
                            return res.status(500).json({ error: "Fehler beim Aktualisieren" });
                        }

                        connection.query("DELETE FROM trainer_stile WHERE trainer_id = ?", [trainerId], (err) => {
                            if (err) {
                                connection.rollback(() => connection.release());
                                return res.status(500).json({ error: "Fehler beim Löschen der Stile" });
                            }

                            const doCommit = () => {
                                connection.commit((err) => {
                                    if (err) {
                                        connection.rollback(() => connection.release());
                                        return res.status(500).json({ error: "Commit fehlgeschlagen" });
                                    }
                                    connection.release();
                                    res.json({ trainer_id: parseInt(trainerId), vorname, nachname, email, telefon, stile: stile || [] });
                                });
                            };

                            if (stile && Array.isArray(stile) && stile.length > 0) {
                                const stilInsert = stile.map(s => [trainerId, s]);
                                connection.query("INSERT INTO trainer_stile (trainer_id, stil) VALUES ?", [stilInsert], (err) => {
                                    if (err) {
                                        logger.error('Trainer PUT: Stile INSERT fehlgeschlagen', { error: err, stilInsert });
                                        connection.rollback(() => connection.release());
                                        return res.status(500).json({ error: "Fehler beim Speichern der Stile: " + err.sqlMessage });
                                    }
                                    doCommit();
                                });
                            } else {
                                doCommit();
                            }
                        });
                    }
                );
            });
        });
    });
});

// Trainer löschen (inklusive verbundene Stile)
router.delete("/:id", (req, res) => {
    const trainerId = req.params.id;

    db.getConnection((err, connection) => {
        if (err) {
            logger.error('Fehler bei der Datenbankverbindung:', { error: err });
            return res.status(500).json({ error: "Fehler bei der Datenbankverbindung", details: err.sqlMessage });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                logger.error('Fehler beim Starten der Transaktion:', { error: err });
                return res.status(500).json({ error: "Fehler beim Löschen des Trainers", details: err.sqlMessage });
            }

            // Schritt 1: Trainer-Stile löschen
            connection.query("DELETE FROM trainer_stile WHERE trainer_id = ?", [trainerId], (err) => {
                if (err) {
                    connection.rollback(() => connection.release());
                    logger.error('Fehler beim Löschen der Stile:', { error: err });
                    return res.status(500).json({ error: "Fehler beim Löschen der Stile", details: err.sqlMessage });
                }

                // Schritt 2: Trainer löschen
                connection.query("DELETE FROM trainer WHERE trainer_id = ?", [trainerId], (err, result) => {
                    if (err) {
                        connection.rollback(() => connection.release());
                        logger.error('Fehler beim Löschen des Trainers:', { error: err });
                        return res.status(500).json({ error: "Fehler beim Löschen des Trainers", details: err.sqlMessage });
                    }

                    connection.commit((err) => {
                        if (err) {
                            connection.rollback(() => connection.release());
                            logger.error('Fehler beim Abschließen der Transaktion:', { error: err });
                            return res.status(500).json({ error: "Fehler beim Löschen des Trainers", details: err.sqlMessage });
                        }

                        connection.release();
                        res.json({ success: true, message: "Trainer erfolgreich gelöscht" });
                    });
                });
            });
        });
    });
});

// ===================================================================
// NOTIFICATION RECIPIENTS (TEMP)
// ===================================================================

router.get('/notification-recipients', async (req, res) => {
  try {
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    let memberEmails = [];
    let trainerEmails = [];
    let personalEmails = [];

    const dojoCondition = secureDojoId ? ' AND dojo_id = ?' : '';
    const dojoParam = secureDojoId ? [secureDojoId] : [];

    // Hole Mitglieder mit Email (nur eigenes Dojo)
    try {
      memberEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT
            COALESCE(email, '') as email,
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name,
            'mitglied' as type
          FROM mitglieder
          WHERE email IS NOT NULL
            AND email != ''
            AND email != 'NULL'
            AND email LIKE '%@%'
            ${dojoCondition}
          ORDER BY name
        `, dojoParam, (err, results) => {
          if (err) {
            resolve([]);
          } else {
            resolve(results);
          }
        });
      });
    } catch (error) {
      memberEmails = [];
    }

    // Hole Trainer mit Email (nur eigenes Dojo)
    try {
      trainerEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT
            COALESCE(email, '') as email,
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name,
            'trainer' as type
          FROM trainer
          WHERE email IS NOT NULL
            AND email != ''
            AND email != 'NULL'
            AND email LIKE '%@%'
            ${dojoCondition}
          ORDER BY name
        `, dojoParam, (err, results) => {
          if (err) {
            resolve([]);
          } else {
            resolve(results);
          }
        });
      });
    } catch (error) {
      trainerEmails = [];
    }

    // Hole Personal mit Email (nur eigenes Dojo)
    try {
      personalEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT
            COALESCE(email, '') as email,
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name,
            'personal' as type
          FROM personal
          WHERE email IS NOT NULL
            AND email != ''
            AND email != 'NULL'
            AND email LIKE '%@%'
            ${dojoCondition}
          ORDER BY name
        `, dojoParam, (err, results) => {
          if (err) {
            resolve([]);
          } else {
            resolve(results);
          }
        });
      });
    } catch (error) {
      personalEmails = [];
    }

    res.json({
      success: true,
      recipients: {
        mitglieder: memberEmails,
        trainer: trainerEmails,
        personal: personalEmails,
        alle: [...memberEmails, ...trainerEmails, ...personalEmails]
      }
    });
  } catch (error) {
    logger.error('Notification recipients error:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Empfänger' });
  }
});

// ===================================================================
// TRAINER PERSONAL — EINZELABRUF, DETAILS, DOKUMENTE
// ===================================================================

// GET /:id — Trainer mit erweiterten Details, Kursen und Dokumenten
router.get("/:id", async (req, res) => {
  const trainerId = parseInt(req.params.id);
  if (!trainerId) return res.status(400).json({ error: 'Ungültige Trainer-ID' });

  const dojoId = getSecureDojoId(req) || req.user?.dojo_id;
  const pool = db.promise();

  try {
    const dojoWhere = dojoId ? 'AND t.dojo_id = ?' : '';
    const [rows] = await pool.query(`
      SELECT t.*,
        COALESCE(GROUP_CONCAT(DISTINCT ts.stil ORDER BY ts.stil SEPARATOR '||'), '') AS stile_raw
      FROM trainer t
      LEFT JOIN trainer_stile ts ON t.trainer_id = ts.trainer_id
      WHERE t.trainer_id = ? ${dojoWhere}
      GROUP BY t.trainer_id
    `, dojoId ? [trainerId, dojoId] : [trainerId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Trainer nicht gefunden' });

    const trainer = { ...rows[0] };
    trainer.stile = trainer.stile_raw ? trainer.stile_raw.split('||') : [];
    delete trainer.stile_raw;

    // Kurse dieses Trainers (trainer_ids ist JSON-Array in kurse-Tabelle)
    try {
      const kursWhere = dojoId ? 'WHERE k.dojo_id = ?' : '';
      const [kurse] = await pool.query(`
        SELECT k.kurs_id, k.gruppenname, k.stil, k.trainer_ids
        FROM kurse k
        ${kursWhere}
      `, dojoId ? [dojoId] : []);

      trainer.kurse = kurse.filter(k => {
        try {
          const ids = typeof k.trainer_ids === 'string'
            ? JSON.parse(k.trainer_ids)
            : (k.trainer_ids || []);
          return ids.map(Number).includes(trainerId);
        } catch { return false; }
      }).map(k => ({ kurs_id: k.kurs_id, gruppenname: k.gruppenname, stil: k.stil }));
    } catch {
      trainer.kurse = [];
    }

    // Dokumente
    const [dokumente] = await pool.query(`
      SELECT * FROM trainer_dokumente
      WHERE trainer_id = ? ${dojoId ? 'AND dojo_id = ?' : ''}
      ORDER BY erstellt_am DESC
    `, dojoId ? [trainerId, dojoId] : [trainerId]);
    trainer.dokumente = dokumente;

    res.json(trainer);
  } catch (err) {
    logger.error('Trainer GET /:id Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden des Trainers' });
  }
});

// PUT /:id/details — Erweiterte Felder aktualisieren
router.put("/:id/details", async (req, res) => {
  const trainerId = parseInt(req.params.id);
  const dojoId = getSecureDojoId(req) || req.user?.dojo_id;
  const {
    vorname, nachname, email, telefon,
    anschrift, geburtsdatum, graduierung, steuer_id,
    einstellungsdatum, status, notizen, stile
  } = req.body;

  const pool = db.promise();
  try {
    const dojoWhere = dojoId ? 'AND dojo_id = ?' : '';
    const [check] = await pool.query(
      `SELECT trainer_id FROM trainer WHERE trainer_id = ? ${dojoWhere}`,
      dojoId ? [trainerId, dojoId] : [trainerId]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Trainer nicht gefunden' });

    await pool.query(`
      UPDATE trainer SET
        vorname = COALESCE(?, vorname),
        nachname = COALESCE(?, nachname),
        email = COALESCE(?, email),
        telefon = COALESCE(?, telefon),
        anschrift = ?,
        geburtsdatum = ?,
        graduierung = ?,
        steuer_id = ?,
        einstellungsdatum = ?,
        status = COALESCE(?, status),
        notizen = ?
      WHERE trainer_id = ?
    `, [
      vorname || null, nachname || null, email !== undefined ? email : null, telefon !== undefined ? telefon : null,
      anschrift || null, geburtsdatum || null, graduierung || null, steuer_id || null,
      einstellungsdatum || null, status || null, notizen !== undefined ? notizen : null,
      trainerId
    ]);

    // Stile aktualisieren wenn angegeben
    if (Array.isArray(stile)) {
      await pool.query('DELETE FROM trainer_stile WHERE trainer_id = ?', [trainerId]);
      if (stile.length > 0) {
        await pool.query(
          'INSERT INTO trainer_stile (trainer_id, stil) VALUES ?',
          [stile.map(s => [trainerId, s])]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Trainer PUT /details Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// GET /:id/dokumente — Dokumente eines Trainers
router.get("/:id/dokumente", async (req, res) => {
  const trainerId = parseInt(req.params.id);
  const dojoId = getSecureDojoId(req) || req.user?.dojo_id;
  const pool = db.promise();
  try {
    const [rows] = await pool.query(`
      SELECT * FROM trainer_dokumente
      WHERE trainer_id = ? ${dojoId ? 'AND dojo_id = ?' : ''}
      ORDER BY erstellt_am DESC
    `, dojoId ? [trainerId, dojoId] : [trainerId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Dokumente' });
  }
});

// POST /:id/dokument — PDF generieren und speichern
router.post("/:id/dokument", async (req, res) => {
  const trainerId = parseInt(req.params.id);
  const dojoId = getSecureDojoId(req) || req.user?.dojo_id;
  const { typ, mitgliedsbeitrag_monatlich, sachleistungen_jahreswert, vertragsbeginn, wettbewerb_radius } = req.body;

  if (!['vereinbarung', 'infoblatt'].includes(typ)) {
    return res.status(400).json({ error: 'Ungültiger Dokumenttyp. Erlaubt: vereinbarung, infoblatt' });
  }

  const pool = db.promise();
  try {
    // Trainer laden
    const dojoWhere = dojoId ? 'AND t.dojo_id = ?' : '';
    const [rows] = await pool.query(`
      SELECT t.*,
        COALESCE(GROUP_CONCAT(DISTINCT ts.stil SEPARATOR '||'), '') AS stile_raw
      FROM trainer t
      LEFT JOIN trainer_stile ts ON t.trainer_id = ts.trainer_id
      WHERE t.trainer_id = ? ${dojoWhere}
      GROUP BY t.trainer_id
    `, dojoId ? [trainerId, dojoId] : [trainerId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Trainer nicht gefunden' });

    const trainer = { ...rows[0] };
    trainer.stile = trainer.stile_raw ? trainer.stile_raw.split('||') : [];
    delete trainer.stile_raw;

    // Kurse
    try {
      const [kurse] = await pool.query(
        `SELECT kurs_id, gruppenname, stil, trainer_ids FROM kurse ${dojoId ? 'WHERE dojo_id = ?' : ''}`,
        dojoId ? [dojoId] : []
      );
      trainer.kurse = kurse.filter(k => {
        try {
          const ids = typeof k.trainer_ids === 'string' ? JSON.parse(k.trainer_ids) : (k.trainer_ids || []);
          return ids.map(Number).includes(trainerId);
        } catch { return false; }
      });
    } catch { trainer.kurse = []; }

    // Dojo-Daten
    let dojo = null;
    if (dojoId) {
      try {
        const [dojos] = await pool.query('SELECT * FROM dojos WHERE dojo_id = ?', [dojoId]);
        dojo = dojos[0] || null;
      } catch {}
    }

    // PDF generieren
    const params = { mitgliedsbeitrag_monatlich, sachleistungen_jahreswert, vertragsbeginn, wettbewerb_radius };
    const pdfBuffer = typ === 'vereinbarung'
      ? await generateVereinbarungPdf(trainer, dojo, params)
      : await generateInfoblattPdf(trainer, dojo);

    // Datei speichern
    const timestamp = Date.now();
    const filename = `trainer_${trainerId}_${typ}_${timestamp}.pdf`;
    const filepath = path.join(DOKUMENTE_DIR, filename);
    fs.writeFileSync(filepath, pdfBuffer);

    // DB-Eintrag
    const [result] = await pool.query(`
      INSERT INTO trainer_dokumente
        (trainer_id, dojo_id, dokument_typ, pdf_dateiname,
         mitgliedsbeitrag_monatlich, sachleistungen_jahreswert, vertragsbeginn, wettbewerb_radius)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trainerId, dojoId || 0, typ, filename,
      mitgliedsbeitrag_monatlich || null, sachleistungen_jahreswert || null,
      vertragsbeginn || null, wettbewerb_radius || 10
    ]);

    res.json({ success: true, dokument_id: result.insertId, filename });
  } catch (err) {
    logger.error('Trainer PDF-Generierung Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler bei der PDF-Generierung: ' + err.message });
  }
});

// GET /:id/dokument/:filename — PDF herunterladen
router.get("/:id/dokument/:filename", (req, res) => {
  const { filename } = req.params;
  // Sicherheit: nur alphanumerisch + underscore + punkt
  if (!/^[\w.-]+\.pdf$/.test(filename)) return res.status(400).json({ error: 'Ungültiger Dateiname' });
  const filepath = path.join(DOKUMENTE_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Datei nicht gefunden' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filepath);
});

// PUT /dokument/:dokId/status — Status ändern
router.put("/dokument/:dokId/status", async (req, res) => {
  const { dokId } = req.params;
  const { status } = req.body;
  const dojoId = getSecureDojoId(req) || req.user?.dojo_id;

  if (!['erstellt', 'versendet', 'unterschrieben'].includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }
  const pool = db.promise();
  try {
    const [result] = await pool.query(
      `UPDATE trainer_dokumente SET status = ? WHERE id = ? ${dojoId ? 'AND dojo_id = ?' : ''}`,
      dojoId ? [status, dokId, dojoId] : [status, dokId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Dokument nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// DELETE /dokument/:dokId — Dokument löschen
router.delete("/dokument/:dokId", async (req, res) => {
  const { dokId } = req.params;
  const dojoId = getSecureDojoId(req) || req.user?.dojo_id;
  const pool = db.promise();
  try {
    const [rows] = await pool.query(
      `SELECT pdf_dateiname FROM trainer_dokumente WHERE id = ? ${dojoId ? 'AND dojo_id = ?' : ''}`,
      dojoId ? [dokId, dojoId] : [dokId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Dokument nicht gefunden' });

    if (rows[0].pdf_dateiname) {
      const fp = path.join(DOKUMENTE_DIR, rows[0].pdf_dateiname);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await pool.query('DELETE FROM trainer_dokumente WHERE id = ?', [dokId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

module.exports = router;
