/**
 * Graduierungen Routes
 * Graduierungs-CRUD und Drag & Drop Reordering
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

// POST /:stilId/graduierungen - Graduierung hinzufügen
router.post('/:stilId/graduierungen', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  const { name, trainingsstunden_min = 40, mindestzeit_monate = 3, farbe_hex = '#FFFFFF', farbe_sekundaer = null, kategorie = null, dan_grad = null } = req.body;

  if (!name || name.trim().length === 0) return res.status(400).json({ error: 'Graduierung-Name ist erforderlich' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'Graduierung-Name ist zu lang (max. 100 Zeichen)' });

  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (!hexRegex.test(farbe_hex)) return res.status(400).json({ error: 'Ungültiges Hex-Farbformat für Primärfarbe' });
  if (farbe_sekundaer && !hexRegex.test(farbe_sekundaer)) return res.status(400).json({ error: 'Ungültiges Hex-Farbformat für Sekundärfarbe' });
  if (kategorie === 'dan' && (!dan_grad || dan_grad < 1 || dan_grad > 10)) return res.status(400).json({ error: 'DAN-Grad muss zwischen 1 und 10 liegen' });

  const validKategorien = ['grundstufe', 'mittelstufe', 'oberstufe', 'dan', 'meister', 'custom'];
  if (kategorie && !validKategorien.includes(kategorie)) return res.status(400).json({ error: 'Ungültige Kategorie' });
  if (trainingsstunden_min < 0 || trainingsstunden_min > 1000) return res.status(400).json({ error: 'Trainingsstunden müssen zwischen 0 und 1000 liegen' });
  if (mindestzeit_monate < 0 || mindestzeit_monate > 120) return res.status(400).json({ error: 'Mindestzeit muss zwischen 0 und 120 Monaten liegen' });

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });

    connection.query('SELECT stil_id FROM stile WHERE stil_id = ? AND aktiv = 1', [stilId], (stilCheckError, stilRows) => {
      if (stilCheckError) { connection.release(); return res.status(500).json({ error: 'Fehler beim Prüfen des Stils', details: stilCheckError.message }); }
      if (stilRows.length === 0) { connection.release(); return res.status(404).json({ error: 'Stil nicht gefunden oder inaktiv' }); }

      const createGraduierung = () => {
        connection.query('SELECT COALESCE(MAX(reihenfolge), 0) + 1 as next_reihenfolge FROM graduierungen WHERE stil_id = ? AND aktiv = 1', [stilId], (reihenfolgeError, reihenfolgeRows) => {
          if (reihenfolgeError) { connection.release(); return res.status(500).json({ error: 'Fehler beim Ermitteln der Reihenfolge', details: reihenfolgeError.message }); }

          const nextReihenfolge = reihenfolgeRows[0].next_reihenfolge;
          const insertQuery = `
            INSERT INTO graduierungen (stil_id, name, reihenfolge, trainingsstunden_min, mindestzeit_monate, farbe_hex, farbe_sekundaer, kategorie, dan_grad, aktiv, erstellt_am, aktualisiert_am)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
          `;
          connection.query(insertQuery, [stilId, name.trim(), nextReihenfolge, trainingsstunden_min, mindestzeit_monate, farbe_hex.toUpperCase(), farbe_sekundaer?.toUpperCase() || null, kategorie, dan_grad], (insertError, result) => {
            if (insertError) { connection.release(); return res.status(500).json({ error: 'Fehler beim Erstellen der Graduierung', details: insertError.message }); }

            const selectQuery = `SELECT graduierung_id, name, reihenfolge, trainingsstunden_min, mindestzeit_monate, farbe_hex, farbe_sekundaer, kategorie, dan_grad, aktiv, erstellt_am, aktualisiert_am FROM graduierungen WHERE graduierung_id = ?`;
            connection.query(selectQuery, [result.insertId], (selectError, newGraduierungRows) => {
              connection.release();
              if (selectError) return res.status(500).json({ error: 'Graduierung erstellt, aber Fehler beim Abrufen', details: selectError.message });
              res.status(201).json(newGraduierungRows[0]);
            });
          });
        });
      };

      if (kategorie === 'dan' && dan_grad) {
        connection.query('SELECT graduierung_id FROM graduierungen WHERE stil_id = ? AND dan_grad = ? AND aktiv = 1', [stilId, dan_grad], (danCheckError, danRows) => {
          if (danCheckError) { connection.release(); return res.status(500).json({ error: 'Fehler beim Prüfen des DAN-Grads', details: danCheckError.message }); }
          if (danRows.length > 0) { connection.release(); return res.status(409).json({ error: `${dan_grad}. DAN existiert bereits für diesen Stil`, existing_graduierung_id: danRows[0].graduierung_id }); }
          createGraduierung();
        });
      } else {
        createGraduierung();
      }
    });
  });
});

// PUT /graduierungen/:graduierungId - Graduierung aktualisieren
router.put('/graduierungen/:graduierungId', (req, res) => {
  const graduierungId = parseInt(req.params.graduierungId);
  if (!graduierungId || isNaN(graduierungId)) return res.status(400).json({ error: 'Ungültige Graduierung-ID' });

  const { name, reihenfolge, trainingsstunden_min, mindestzeit_monate, farbe_hex, farbe_sekundaer, kategorie, dan_grad, aktiv } = req.body;

  if (!name || name.trim().length === 0) return res.status(400).json({ error: 'Graduierung-Name ist erforderlich' });
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (farbe_hex && !hexRegex.test(farbe_hex)) return res.status(400).json({ error: 'Ungültiges Hex-Farbformat für Primärfarbe' });
  if (farbe_sekundaer && !hexRegex.test(farbe_sekundaer)) return res.status(400).json({ error: 'Ungültiges Hex-Farbformat für Sekundärfarbe' });
  if (trainingsstunden_min < 0 || trainingsstunden_min > 1000) return res.status(400).json({ error: 'Trainingsstunden müssen zwischen 0 und 1000 liegen' });
  if (mindestzeit_monate < 0 || mindestzeit_monate > 120) return res.status(400).json({ error: 'Mindestzeit muss zwischen 0 und 120 Monaten liegen' });

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });

    connection.query('SELECT graduierung_id, stil_id FROM graduierungen WHERE graduierung_id = ?', [graduierungId], (checkError, existingRows) => {
      if (checkError) { connection.release(); return res.status(500).json({ error: 'Fehler beim Prüfen der Graduierung', details: checkError.message }); }
      if (existingRows.length === 0) { connection.release(); return res.status(404).json({ error: 'Graduierung nicht gefunden' }); }

      const updateQuery = `
        UPDATE graduierungen SET name = ?, reihenfolge = ?, trainingsstunden_min = ?, mindestzeit_monate = ?,
          farbe_hex = ?, farbe_sekundaer = ?, kategorie = ?, dan_grad = ?, aktiv = ?, aktualisiert_am = NOW()
        WHERE graduierung_id = ?
      `;
      connection.query(updateQuery, [name.trim(), reihenfolge, trainingsstunden_min, mindestzeit_monate, farbe_hex?.toUpperCase(), farbe_sekundaer?.toUpperCase(), kategorie, dan_grad, aktiv, graduierungId], (updateError) => {
        if (updateError) { connection.release(); return res.status(500).json({ error: 'Fehler beim Aktualisieren der Graduierung', details: updateError.message }); }

        const selectQuery = `SELECT graduierung_id, name, reihenfolge, trainingsstunden_min, mindestzeit_monate, farbe_hex, farbe_sekundaer, kategorie, dan_grad, aktiv, erstellt_am, aktualisiert_am FROM graduierungen WHERE graduierung_id = ?`;
        connection.query(selectQuery, [graduierungId], (selectError, updatedRows) => {
          connection.release();
          if (selectError) return res.status(500).json({ error: 'Graduierung aktualisiert, aber Fehler beim Abrufen', details: selectError.message });
          res.json(updatedRows[0]);
        });
      });
    });
  });
});

// DELETE /graduierungen/:graduierungId - Graduierung löschen
router.delete('/graduierungen/:graduierungId', (req, res) => {
  const graduierungId = parseInt(req.params.graduierungId);
  if (!graduierungId || isNaN(graduierungId)) return res.status(400).json({ error: 'Ungültige Graduierung-ID' });

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });

    connection.query('SELECT graduierung_id FROM graduierungen WHERE graduierung_id = ?', [graduierungId], (checkError, existingRows) => {
      if (checkError) { connection.release(); return res.status(500).json({ error: 'Fehler beim Prüfen der Graduierung', details: checkError.message }); }
      if (existingRows.length === 0) { connection.release(); return res.status(404).json({ error: 'Graduierung nicht gefunden' }); }

      const memberCheckQuery = `
        SELECT COUNT(DISTINCT msd.mitglied_id) as count FROM mitglied_stil_data msd
        JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
        WHERE msd.current_graduierung_id = ? AND m.aktiv = 1
      `;
      connection.query(memberCheckQuery, [graduierungId], (memberCheckError, memberRows) => {
        if (memberCheckError) { connection.release(); return res.status(500).json({ error: 'Fehler beim Prüfen der Mitglieder', details: memberCheckError.message }); }
        if (memberRows[0].count > 0) { connection.release(); return res.status(409).json({ error: 'Graduierung kann nicht gelöscht werden, da noch aktive Mitglieder diese Graduierung haben', mitglieder_anzahl: memberRows[0].count }); }

        connection.query('DELETE FROM graduierungen WHERE graduierung_id = ?', [graduierungId], (deleteError) => {
          connection.release();
          if (deleteError) return res.status(500).json({ error: 'Fehler beim Löschen der Graduierung', details: deleteError.message });
          res.json({ success: true, message: 'Graduierung erfolgreich gelöscht', graduierung_id: graduierungId });
        });
      });
    });
  });
});

// PUT /:stilId/graduierungen/reorder - Graduierungen neu ordnen (Drag & Drop)
router.put('/:stilId/graduierungen/reorder', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  const { graduierungen } = req.body;
  if (!graduierungen || !Array.isArray(graduierungen) || graduierungen.length === 0) {
    return res.status(400).json({ error: 'Graduierungen-Array ist erforderlich und darf nicht leer sein' });
  }

  for (const grad of graduierungen) {
    if (!grad.graduierung_id || !grad.reihenfolge) {
      return res.status(400).json({ error: 'Jede Graduierung muss graduierung_id und reihenfolge enthalten', invalid_object: grad });
    }
  }

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });

    connection.beginTransaction((transactionErr) => {
      if (transactionErr) { connection.release(); return res.status(500).json({ error: 'Fehler beim Starten der Transaktion', details: transactionErr.message }); }

      const graduierungIds = graduierungen.map(g => g.graduierung_id);
      const tempUpdateQuery = `UPDATE graduierungen SET reihenfolge = -graduierung_id, aktualisiert_am = NOW() WHERE stil_id = ? AND graduierung_id IN (${graduierungIds.map(() => '?').join(',')})`;

      connection.query(tempUpdateQuery, [stilId, ...graduierungIds], (tempError) => {
        if (tempError) {
          connection.rollback(() => { connection.release(); return res.status(500).json({ error: 'Fehler beim temporären Update der Reihenfolge', details: tempError.message }); });
          return;
        }

        let completedUpdates = 0;
        let hasError = false;

        graduierungen.forEach((grad) => {
          const finalUpdateQuery = `UPDATE graduierungen SET reihenfolge = ?, aktualisiert_am = NOW() WHERE graduierung_id = ? AND stil_id = ?`;
          connection.query(finalUpdateQuery, [grad.reihenfolge, grad.graduierung_id, stilId], (updateError, result) => {
            if (updateError && !hasError) {
              hasError = true;
              connection.rollback(() => { connection.release(); return res.status(500).json({ error: 'Fehler beim Aktualisieren der Reihenfolge', details: updateError.message }); });
              return;
            }
            if (result && result.affectedRows === 0 && !hasError) {
              hasError = true;
              connection.rollback(() => { connection.release(); return res.status(404).json({ error: `Graduierung ${grad.graduierung_id} nicht gefunden oder gehört nicht zu Stil ${stilId}` }); });
              return;
            }
            completedUpdates++;
            if (completedUpdates === graduierungen.length && !hasError) {
              connection.commit((commitError) => {
                if (commitError) {
                  connection.rollback(() => { connection.release(); return res.status(500).json({ error: 'Fehler beim Speichern der Änderungen', details: commitError.message }); });
                  return;
                }
                connection.release();
                res.json({ success: true, message: 'Reihenfolge erfolgreich aktualisiert', updated_count: graduierungen.length, stil_id: stilId });
              });
            }
          });
        });
      });
    });
  });
});

// GET /:stilId/graduierungen/:graduierungId/mitglieder - Mitglieder einer Graduierung
router.get('/:stilId/graduierungen/:graduierungId/mitglieder', (req, res) => {
  const { stilId, graduierungId } = req.params;

  const query = `
    SELECT m.mitglied_id, m.vorname, m.nachname, m.geburtsdatum, m.email, m.telefon
    FROM mitglied_stil_data msd
    JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
    WHERE msd.stil_id = ? AND msd.current_graduierung_id = ? AND m.aktiv = 1
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, [stilId, graduierungId], (error, results) => {
    if (error) return res.status(500).json({ error: 'Fehler beim Abrufen der Mitglieder', details: error.message });
    res.json({ mitglieder: results });
  });
});

module.exports = router;
