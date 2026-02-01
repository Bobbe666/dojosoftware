/**
 * Stile Routes - CRUD Operations
 * Stil-Verwaltung (Erstellen, Lesen, Aktualisieren, Löschen)
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

// GET /test - Test-Endpunkt
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Erweiterte Stil-Verwaltung API funktioniert',
    timestamp: new Date().toISOString(),
    database: db ? 'Verbunden' : 'Nicht verfügbar'
  });
});

// GET / - Alle Stile mit Graduierungen
router.get('/', (req, res) => {
  db.getConnection((err, connection) => {
    if (err) {
      logger.error('DB-Verbindungsfehler:', { error: err });
      return res.status(500).json({ success: false, error: 'Datenbankverbindung fehlgeschlagen', details: err.message });
    }

    const { aktiv } = req.query;
    const aktivFilter = aktiv === 'true' ? 'WHERE s.aktiv = 1' : '';

    const stilQuery = `
      SELECT s.stil_id, s.name, s.beschreibung, s.aktiv, s.reihenfolge,
        s.wartezeit_grundstufe, s.wartezeit_mittelstufe, s.wartezeit_oberstufe,
        s.wartezeit_schwarzgurt_traditionell, s.erstellt_am, s.aktualisiert_am,
        COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder
      FROM stile s
      LEFT JOIN mitglied_stil_data msd ON s.stil_id = msd.stil_id
      LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
      ${aktivFilter}
      GROUP BY s.stil_id, s.name, s.beschreibung, s.aktiv, s.reihenfolge,
        s.wartezeit_grundstufe, s.wartezeit_mittelstufe, s.wartezeit_oberstufe,
        s.wartezeit_schwarzgurt_traditionell, s.erstellt_am, s.aktualisiert_am
      ORDER BY s.aktiv DESC, s.reihenfolge ASC, s.name ASC
    `;

    connection.query(stilQuery, (stilError, stilRows) => {
      if (stilError) {
        logger.error('Fehler beim Abrufen der Stile:', { error: stilError });
        connection.release();
        return res.status(500).json({ success: false, error: 'Fehler beim Abrufen der Stile', details: stilError.message });
      }

      if (stilRows.length === 0) {
        connection.release();
        return res.json([]);
      }

      const stilIds = stilRows.map(stil => stil.stil_id);
      if (stilIds.length === 0) {
        connection.release();
        return res.json(stilRows.map(stil => ({ ...stil, graduierungen: [] })));
      }

      const graduierungQuery = `
        SELECT graduierung_id, stil_id, name, reihenfolge, trainingsstunden_min, mindestzeit_monate,
          farbe_hex, farbe_sekundaer, kategorie, dan_grad, aktiv, erstellt_am, aktualisiert_am
        FROM graduierungen WHERE stil_id IN (${stilIds.map(() => '?').join(',')}) AND aktiv = 1
        ORDER BY stil_id ASC, reihenfolge ASC
      `;

      connection.query(graduierungQuery, stilIds, (graduierungError, graduierungRows) => {
        connection.release();
        if (graduierungError) {
          logger.error('Fehler beim Abrufen der Graduierungen:', { error: graduierungError });
          return res.status(500).json({ success: false, error: 'Fehler beim Abrufen der Graduierungen', details: graduierungError.message });
        }

        const stileWithGraduierungen = stilRows.map(stil => ({
          ...stil,
          graduierungen: graduierungRows.filter(grad => grad.stil_id === stil.stil_id)
        }));
        res.json(stileWithGraduierungen);
      });
    });
  });
});

// PUT /reorder - Stile neu ordnen (Drag & Drop)
router.put('/reorder', (req, res) => {
  const { stile } = req.body;
  if (!stile || !Array.isArray(stile) || stile.length === 0) {
    return res.status(400).json({ error: 'Stile-Array ist erforderlich und darf nicht leer sein' });
  }

  for (const stil of stile) {
    if (!stil.stil_id || stil.reihenfolge === undefined) {
      return res.status(400).json({ error: 'Jeder Stil muss stil_id und reihenfolge enthalten', invalid_object: stil });
    }
  }

  db.getConnection((err, connection) => {
    if (err) {
      logger.error('DB-Verbindungsfehler:', { error: err });
      return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });
    }

    connection.beginTransaction((transactionErr) => {
      if (transactionErr) {
        connection.release();
        return res.status(500).json({ error: 'Fehler beim Starten der Transaktion', details: transactionErr.message });
      }

      let completedUpdates = 0;
      let hasError = false;

      stile.forEach((stil) => {
        const updateQuery = `UPDATE stile SET reihenfolge = ?, aktualisiert_am = NOW() WHERE stil_id = ?`;
        connection.query(updateQuery, [stil.reihenfolge, stil.stil_id], (updateError) => {
          if (updateError && !hasError) {
            hasError = true;
            connection.rollback(() => {
              connection.release();
              return res.status(500).json({ error: 'Fehler beim Aktualisieren der Reihenfolge', details: updateError.message });
            });
            return;
          }
          completedUpdates++;
          if (completedUpdates === stile.length && !hasError) {
            connection.commit((commitError) => {
              if (commitError) {
                connection.rollback(() => {
                  connection.release();
                  return res.status(500).json({ error: 'Fehler beim Speichern der Änderungen', details: commitError.message });
                });
                return;
              }
              connection.release();
              res.json({ success: true, message: 'Reihenfolge erfolgreich aktualisiert', updated_count: completedUpdates });
            });
          }
        });
      });
    });
  });
});

// GET /:id - Einzelnen Stil mit Details abrufen
router.get('/:id', (req, res) => {
  const stilId = parseInt(req.params.id);
  if (!stilId || isNaN(stilId)) {
    return res.status(400).json({ error: 'Ungültige Stil-ID' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      logger.error('DB-Verbindungsfehler:', { error: err });
      return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });
    }

    const stilQuery = `
      SELECT s.*, COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder
      FROM stile s
      LEFT JOIN mitglied_stil_data msd ON s.stil_id = msd.stil_id
      LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
      WHERE s.stil_id = ? AND s.aktiv = 1
      GROUP BY s.stil_id
    `;

    connection.query(stilQuery, [stilId], (stilError, stilRows) => {
      if (stilError) {
        connection.release();
        return res.status(500).json({ error: 'Fehler beim Abrufen des Stils', details: stilError.message });
      }
      if (stilRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Stil nicht gefunden' });
      }

      const graduierungenQuery = `
        SELECT graduierung_id, name, reihenfolge, trainingsstunden_min, mindestzeit_monate,
          farbe_hex, farbe_sekundaer, kategorie, dan_grad, aktiv, erstellt_am, aktualisiert_am
        FROM graduierungen WHERE stil_id = ? AND aktiv = 1 ORDER BY reihenfolge ASC
      `;

      connection.query(graduierungenQuery, [stilId], (graduierungError, graduierungRows) => {
        if (graduierungError) {
          connection.release();
          return res.status(500).json({ error: 'Fehler beim Abrufen der Graduierungen', details: graduierungError.message });
        }

        const graduierungIds = graduierungRows.map(g => g.graduierung_id);
        if (graduierungIds.length === 0) {
          connection.release();
          return res.json({ ...stilRows[0], graduierungen: [] });
        }

        const pruefungsinhalteQuery = `
          SELECT graduierung_id, kategorie, titel, beschreibung, reihenfolge, pflicht, inhalt_id
          FROM pruefungsinhalte WHERE graduierung_id IN (?) AND aktiv = 1
          ORDER BY kategorie, reihenfolge
        `;

        connection.query(pruefungsinhalteQuery, [graduierungIds], (inhaltError, inhaltRows) => {
          connection.release();
          if (inhaltError) {
            return res.json({ ...stilRows[0], graduierungen: graduierungRows });
          }

          const graduierungenMitInhalten = graduierungRows.map(grad => {
            const inhalte = inhaltRows.filter(i => i.graduierung_id === grad.graduierung_id);
            const pruefungsinhalte = {};
            inhalte.forEach(inhalt => {
              if (!pruefungsinhalte[inhalt.kategorie]) pruefungsinhalte[inhalt.kategorie] = [];
              pruefungsinhalte[inhalt.kategorie].push({
                id: inhalt.inhalt_id, inhalt: inhalt.titel, reihenfolge: inhalt.reihenfolge, pflicht: inhalt.pflicht === 1
              });
            });
            return { ...grad, pruefungsinhalte };
          });

          res.json({ ...stilRows[0], graduierungen: graduierungenMitInhalten });
        });
      });
    });
  });
});

// GET /:stilId/graduierungen - Graduierungen für einen Stil
router.get('/:stilId/graduierungen', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  if (!stilId || isNaN(stilId)) {
    return res.status(400).json({ error: 'Ungültige Stil-ID' });
  }

  const query = `
    SELECT graduierung_id AS id, graduierung_id, name, reihenfolge, trainingsstunden_min, mindestzeit_monate,
      farbe_hex, farbe_sekundaer, kategorie, dan_grad, aktiv, erstellt_am, aktualisiert_am
    FROM graduierungen WHERE stil_id = ? AND aktiv = 1 ORDER BY reihenfolge ASC
  `;

  db.query(query, [stilId], (error, rows) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Graduierungen:', { error });
      return res.status(500).json({ error: 'Fehler beim Abrufen der Graduierungen', details: error.message });
    }
    res.json(rows);
  });
});

// POST / - Neuen Stil erstellen
router.post('/', (req, res) => {
  const { name, beschreibung, aktiv = true, wartezeit_grundstufe = 3, wartezeit_mittelstufe = 4, wartezeit_oberstufe = 6, wartezeit_schwarzgurt_traditionell = false } = req.body;

  if (!name || name.trim().length === 0) return res.status(400).json({ error: 'Stil-Name ist erforderlich' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'Stil-Name ist zu lang (max. 100 Zeichen)' });
  if (beschreibung && beschreibung.length > 500) return res.status(400).json({ error: 'Beschreibung ist zu lang (max. 500 Zeichen)' });

  db.getConnection((err, connection) => {
    if (err) {
      logger.error('DB-Verbindungsfehler:', { error: err });
      return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });
    }

    const checkQuery = 'SELECT stil_id, aktiv FROM stile WHERE name = ?';
    connection.query(checkQuery, [name.trim()], (checkError, existingRows) => {
      if (checkError) {
        connection.release();
        return res.status(500).json({ error: 'Fehler beim Prüfen des Stil-Namens', details: checkError.message });
      }

      if (existingRows.length > 0 && existingRows[0].aktiv) {
        connection.release();
        return res.status(409).json({ error: 'Ein aktiver Stil mit diesem Namen existiert bereits', existing_stil_id: existingRows[0].stil_id });
      }

      if (existingRows.length > 0 && !existingRows[0].aktiv) {
        const stilId = existingRows[0].stil_id;
        const reactivateQuery = `
          UPDATE stile SET aktiv = 1, beschreibung = ?, wartezeit_grundstufe = ?, wartezeit_mittelstufe = ?,
            wartezeit_oberstufe = ?, wartezeit_schwarzgurt_traditionell = ?, aktualisiert_am = NOW()
          WHERE stil_id = ?
        `;
        connection.query(reactivateQuery, [beschreibung?.trim() || '', wartezeit_grundstufe, wartezeit_mittelstufe, wartezeit_oberstufe, wartezeit_schwarzgurt_traditionell, stilId], (updateError) => {
          if (updateError) {
            connection.release();
            return res.status(500).json({ error: 'Fehler beim Reaktivieren des Stils', details: updateError.message });
          }
          connection.query('SELECT * FROM stile WHERE stil_id = ?', [stilId], (selectError, reactivatedRows) => {
            connection.release();
            if (selectError) return res.status(500).json({ error: 'Stil reaktiviert, aber Fehler beim Abrufen', details: selectError.message });
            res.status(200).json({ ...reactivatedRows[0], reactivated: true, message: 'Stil wurde reaktiviert' });
          });
        });
        return;
      }

      const insertQuery = `
        INSERT INTO stile (name, beschreibung, aktiv, wartezeit_grundstufe, wartezeit_mittelstufe, wartezeit_oberstufe, wartezeit_schwarzgurt_traditionell, erstellt_am, aktualisiert_am)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      connection.query(insertQuery, [name.trim(), beschreibung?.trim() || '', aktiv, wartezeit_grundstufe, wartezeit_mittelstufe, wartezeit_oberstufe, wartezeit_schwarzgurt_traditionell], (insertError, result) => {
        if (insertError) {
          connection.release();
          return res.status(500).json({ error: 'Fehler beim Erstellen des Stils', details: insertError.message });
        }
        connection.query('SELECT * FROM stile WHERE stil_id = ?', [result.insertId], (selectError, newStilRows) => {
          connection.release();
          if (selectError) return res.status(500).json({ error: 'Stil erstellt, aber Fehler beim Abrufen', details: selectError.message });
          res.status(201).json({ ...newStilRows[0], anzahl_mitglieder: 0, graduierungen: [] });
        });
      });
    });
  });
});

// PUT /:id - Stil aktualisieren
router.put('/:id', (req, res) => {
  const stilId = parseInt(req.params.id);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  const { name, beschreibung, aktiv, reihenfolge, wartezeit_grundstufe, wartezeit_mittelstufe, wartezeit_oberstufe, wartezeit_schwarzgurt_traditionell } = req.body;
  if (!name || name.trim().length === 0) return res.status(400).json({ error: 'Stil-Name ist erforderlich' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'Stil-Name ist zu lang (max. 100 Zeichen)' });

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });

    connection.query('SELECT stil_id FROM stile WHERE stil_id = ?', [stilId], (checkError, existingRows) => {
      if (checkError) {
        connection.release();
        return res.status(500).json({ error: 'Fehler beim Prüfen des Stils', details: checkError.message });
      }
      if (existingRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Stil nicht gefunden' });
      }

      const updateQuery = `
        UPDATE stile SET name = ?, beschreibung = ?, aktiv = ?, reihenfolge = ?,
          wartezeit_grundstufe = ?, wartezeit_mittelstufe = ?, wartezeit_oberstufe = ?,
          wartezeit_schwarzgurt_traditionell = ?, aktualisiert_am = NOW()
        WHERE stil_id = ?
      `;
      connection.query(updateQuery, [
        name.trim(), beschreibung?.trim() || '', aktiv, reihenfolge,
        wartezeit_grundstufe ?? 3, wartezeit_mittelstufe ?? 4, wartezeit_oberstufe ?? 6,
        wartezeit_schwarzgurt_traditionell ?? false, stilId
      ], (updateError) => {
        if (updateError) {
          connection.release();
          return res.status(500).json({ error: 'Fehler beim Aktualisieren des Stils', details: updateError.message });
        }

        const selectQuery = `
          SELECT s.*, COUNT(DISTINCT ms.mitglied_id) as anzahl_mitglieder FROM stile s
          LEFT JOIN mitglied_stile ms ON (s.name = ms.stil OR (s.name = 'Enso Karate' AND ms.stil = 'Karate') OR (s.name = 'Brazilian Jiu-Jitsu' AND ms.stil = 'BJJ'))
          LEFT JOIN mitglieder m ON ms.mitglied_id = m.mitglied_id AND m.aktiv = 1
          WHERE s.stil_id = ? GROUP BY s.stil_id
        `;
        connection.query(selectQuery, [stilId], (selectError, stilRows) => {
          if (selectError) {
            connection.release();
            return res.status(500).json({ error: 'Stil aktualisiert, aber Fehler beim Abrufen', details: selectError.message });
          }

          const graduierungenQuery = `
            SELECT graduierung_id, name, reihenfolge, trainingsstunden_min, mindestzeit_monate,
              farbe_hex, farbe_sekundaer, kategorie, dan_grad, aktiv
            FROM graduierungen WHERE stil_id = ? AND aktiv = 1 ORDER BY reihenfolge ASC
          `;
          connection.query(graduierungenQuery, [stilId], (graduierungError, graduierungRows) => {
            connection.release();
            if (graduierungError) return res.status(500).json({ error: 'Stil aktualisiert, aber Fehler beim Abrufen der Graduierungen', details: graduierungError.message });
            res.json({ ...stilRows[0], graduierungen: graduierungRows });
          });
        });
      });
    });
  });
});

// DELETE /:id - Stil löschen (soft delete)
router.delete('/:id', (req, res) => {
  const stilId = parseInt(req.params.id);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });

    connection.query('SELECT stil_id FROM stile WHERE stil_id = ?', [stilId], (checkError, existingRows) => {
      if (checkError) {
        connection.release();
        return res.status(500).json({ error: 'Fehler beim Prüfen des Stils', details: checkError.message });
      }
      if (existingRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Stil nicht gefunden' });
      }

      const memberCheckQuery = `
        SELECT COUNT(DISTINCT msd.mitglied_id) as count FROM mitglied_stil_data msd
        JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
        WHERE msd.stil_id = ? AND m.aktiv = 1
      `;
      connection.query(memberCheckQuery, [stilId], (memberCheckError, memberRows) => {
        if (memberCheckError) {
          connection.release();
          return res.status(500).json({ error: 'Fehler beim Prüfen der Mitglieder', details: memberCheckError.message });
        }
        if (memberRows[0].count > 0) {
          connection.release();
          return res.status(409).json({ error: 'Stil kann nicht gelöscht werden, da noch aktive Mitglieder zugeordnet sind', mitglieder_anzahl: memberRows[0].count });
        }

        connection.query('UPDATE stile SET aktiv = 0, aktualisiert_am = NOW() WHERE stil_id = ?', [stilId], (deleteError) => {
          connection.release();
          if (deleteError) return res.status(500).json({ error: 'Fehler beim Löschen des Stils', details: deleteError.message });
          res.json({ success: true, message: 'Stil erfolgreich gelöscht', stil_id: stilId });
        });
      });
    });
  });
});

module.exports = router;
