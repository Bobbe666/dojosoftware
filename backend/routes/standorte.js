const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');

// Helper function to get dojo_id from multiple sources
const getDojoId = (req) => {
  return req.tenant?.dojo_id || req.user?.dojo_id || req.query.dojo_id;
};

// ===================================================================
// GET /api/standorte - Alle Standorte des aktiven Dojos
// ===================================================================
router.get('/', (req, res) => {
  // Get dojo_id from multiple sources (tenant, user, or query)
  const dojoId = req.tenant?.dojo_id || req.user?.dojo_id || req.query.dojo_id;

  if (!dojoId || dojoId === 'all') {
    // If no specific dojo or 'all' dojos, return empty array
    // (standorte are dojo-specific, so we can't show all)
    return res.json({
      success: true,
      data: []
    });
  }

  const query = `
    SELECT
      s.*,
      COUNT(DISTINCT k.kurs_id) as anzahl_kurse,
      COUNT(DISTINCT r.id) as anzahl_raeume,
      COUNT(DISTINCT ts.trainer_id) as anzahl_trainer
    FROM standorte s
    LEFT JOIN kurse k ON s.standort_id = k.standort_id
    LEFT JOIN raeume r ON s.standort_id = r.standort_id
    LEFT JOIN trainer_standorte ts ON s.standort_id = ts.standort_id AND ts.aktiv = TRUE
    WHERE s.dojo_id = ?
    GROUP BY s.standort_id
    ORDER BY s.sortierung ASC, s.name ASC
  `;

  db.query(query, [dojoId], (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Standorte:', { error: err });
      return res.status(500).json({
        success: false,
        error: 'Fehler beim Laden der Standorte'
      });
    }

    res.json({ success: true, data: results });
  });
});

// ===================================================================
// GET /api/standorte/:id - Einzelner Standort
// ===================================================================
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const dojoId = getDojoId(req);

  if (!dojoId || dojoId === 'all') {
    return res.status(403).json({
      success: false,
      error: 'Keine Dojo-ID verfügbar'
    });
  }

  const query = `
    SELECT
      s.*,
      COUNT(DISTINCT k.kurs_id) as anzahl_kurse,
      COUNT(DISTINCT r.id) as anzahl_raeume,
      COUNT(DISTINCT ts.trainer_id) as anzahl_trainer
    FROM standorte s
    LEFT JOIN kurse k ON s.standort_id = k.standort_id
    LEFT JOIN raeume r ON s.standort_id = r.standort_id
    LEFT JOIN trainer_standorte ts ON s.standort_id = ts.standort_id AND ts.aktiv = TRUE
    WHERE s.standort_id = ? AND s.dojo_id = ?
    GROUP BY s.standort_id
  `;

  db.query(query, [id, dojoId], (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden des Standorts:', { error: err });
      return res.status(500).json({
        success: false,
        error: 'Fehler beim Laden des Standorts'
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Standort nicht gefunden'
      });
    }

    res.json({ success: true, data: results[0] });
  });
});

// ===================================================================
// POST /api/standorte - Neuen Standort erstellen
// ===================================================================
router.post('/', (req, res) => {
  const dojoId = getDojoId(req);

  if (!dojoId || dojoId === 'all') {
    return res.status(403).json({
      success: false,
      error: 'Keine Dojo-ID verfügbar'
    });
  }

  const {
    name,
    ist_hauptstandort = false,
    sortierung = 0,
    farbe = '#4F46E5',
    strasse,
    hausnummer,
    plz,
    ort,
    land = 'Deutschland',
    telefon,
    email,
    oeffnungszeiten,
    ist_aktiv = true,
    notizen
  } = req.body;

  // Validierung
  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Name ist erforderlich'
    });
  }

  // Wenn dies der erste Standort ist, muss es der Hauptstandort sein
  db.query(
    'SELECT COUNT(*) as count FROM standorte WHERE dojo_id = ?',
    [dojoId],
    (err, countResults) => {
      if (err) {
        logger.error('Fehler beim Prüfen der Standorte:', { error: err });
        return res.status(500).json({
          success: false,
          error: 'Fehler beim Erstellen des Standorts'
        });
      }

      const isFirstLocation = countResults[0].count === 0;
      const shouldBeHauptstandort = isFirstLocation || ist_hauptstandort;

      const query = `
        INSERT INTO standorte (
          dojo_id, name, ist_hauptstandort, sortierung, farbe,
          strasse, hausnummer, plz, ort, land, telefon, email,
          oeffnungszeiten, ist_aktiv, notizen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        dojoId, name, shouldBeHauptstandort, sortierung, farbe,
        strasse, hausnummer, plz, ort, land, telefon, email,
        oeffnungszeiten ? JSON.stringify(oeffnungszeiten) : null,
        ist_aktiv, notizen
      ];

      db.query(query, params, (err, result) => {
        if (err) {
          logger.error('Fehler beim Erstellen des Standorts:', { error: err });
          return res.status(500).json({
            success: false,
            error: 'Fehler beim Erstellen des Standorts'
          });
        }

        res.status(201).json({
          success: true,
          data: {
            standort_id: result.insertId,
            message: 'Standort erfolgreich erstellt'
          }
        });
      });
    }
  );
});

// ===================================================================
// PUT /api/standorte/:id - Standort bearbeiten
// ===================================================================
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const dojoId = getDojoId(req);

  if (!dojoId || dojoId === 'all') {
    return res.status(403).json({
      success: false,
      error: 'Keine Dojo-ID verfügbar'
    });
  }
  const {
    name,
    ist_hauptstandort,
    sortierung,
    farbe,
    strasse,
    hausnummer,
    plz,
    ort,
    land,
    telefon,
    email,
    oeffnungszeiten,
    ist_aktiv,
    notizen
  } = req.body;

  // Prüfen ob Standort dem Dojo gehört
  db.query(
    'SELECT standort_id FROM standorte WHERE standort_id = ? AND dojo_id = ?',
    [id, dojoId],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Standort nicht gefunden'
        });
      }

      const updateFields = [];
      const updateValues = [];

      if (name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(name);
      }
      if (ist_hauptstandort !== undefined) {
        updateFields.push('ist_hauptstandort = ?');
        updateValues.push(ist_hauptstandort);
      }
      if (sortierung !== undefined) {
        updateFields.push('sortierung = ?');
        updateValues.push(sortierung);
      }
      if (farbe !== undefined) {
        updateFields.push('farbe = ?');
        updateValues.push(farbe);
      }
      if (strasse !== undefined) {
        updateFields.push('strasse = ?');
        updateValues.push(strasse);
      }
      if (hausnummer !== undefined) {
        updateFields.push('hausnummer = ?');
        updateValues.push(hausnummer);
      }
      if (plz !== undefined) {
        updateFields.push('plz = ?');
        updateValues.push(plz);
      }
      if (ort !== undefined) {
        updateFields.push('ort = ?');
        updateValues.push(ort);
      }
      if (land !== undefined) {
        updateFields.push('land = ?');
        updateValues.push(land);
      }
      if (telefon !== undefined) {
        updateFields.push('telefon = ?');
        updateValues.push(telefon);
      }
      if (email !== undefined) {
        updateFields.push('email = ?');
        updateValues.push(email);
      }
      if (oeffnungszeiten !== undefined) {
        updateFields.push('oeffnungszeiten = ?');
        updateValues.push(oeffnungszeiten ? JSON.stringify(oeffnungszeiten) : null);
      }
      if (ist_aktiv !== undefined) {
        updateFields.push('ist_aktiv = ?');
        updateValues.push(ist_aktiv);
      }
      if (notizen !== undefined) {
        updateFields.push('notizen = ?');
        updateValues.push(notizen);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Keine Felder zum Aktualisieren angegeben'
        });
      }

      const query = `
        UPDATE standorte
        SET ${updateFields.join(', ')}
        WHERE standort_id = ? AND dojo_id = ?
      `;

      updateValues.push(id, dojoId);

      db.query(query, updateValues, (err, result) => {
        if (err) {
          logger.error('Fehler beim Aktualisieren des Standorts:', { error: err });
          return res.status(500).json({
            success: false,
            error: 'Fehler beim Aktualisieren des Standorts'
          });
        }

        res.json({
          success: true,
          data: { message: 'Standort erfolgreich aktualisiert' }
        });
      });
    }
  );
});

// ===================================================================
// DELETE /api/standorte/:id - Standort löschen (soft delete)
// ===================================================================
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const dojoId = getDojoId(req);

  if (!dojoId || dojoId === 'all') {
    return res.status(403).json({
      success: false,
      error: 'Keine Dojo-ID verfügbar'
    });
  }

  // Prüfen ob es der Hauptstandort ist
  db.query(
    'SELECT ist_hauptstandort FROM standorte WHERE standort_id = ? AND dojo_id = ?',
    [id, dojoId],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Standort nicht gefunden'
        });
      }

      if (results[0].ist_hauptstandort) {
        return res.status(400).json({
          success: false,
          error: 'Der Hauptstandort kann nicht gelöscht werden'
        });
      }

      // Soft delete: nur auf inaktiv setzen
      const query = `
        UPDATE standorte
        SET ist_aktiv = FALSE
        WHERE standort_id = ? AND dojo_id = ?
      `;

      db.query(query, [id, dojoId], (err, result) => {
        if (err) {
          logger.error('Fehler beim Löschen des Standorts:', { error: err });
          return res.status(500).json({
            success: false,
            error: 'Fehler beim Löschen des Standorts'
          });
        }

        res.json({
          success: true,
          data: { message: 'Standort erfolgreich deaktiviert' }
        });
      });
    }
  );
});

// ===================================================================
// PUT /api/standorte/reorder - Reihenfolge ändern
// ===================================================================
router.put('/reorder/batch', (req, res) => {
  const dojoId = getDojoId(req);

  if (!dojoId || dojoId === 'all') {
    return res.status(403).json({
      success: false,
      error: 'Keine Dojo-ID verfügbar'
    });
  }
  const { standorte } = req.body; // Array: [{ standort_id, sortierung }, ...]

  if (!Array.isArray(standorte) || standorte.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Ungültige Daten'
    });
  }

  // Batch-Update mit mehreren Queries
  const promises = standorte.map(item => {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE standorte
        SET sortierung = ?
        WHERE standort_id = ? AND dojo_id = ?
      `;
      db.query(query, [item.sortierung, item.standort_id, dojoId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  });

  Promise.all(promises)
    .then(() => {
      res.json({
        success: true,
        data: { message: 'Reihenfolge erfolgreich aktualisiert' }
      });
    })
    .catch(err => {
      logger.error('Fehler beim Aktualisieren der Reihenfolge:', { error: err });
      res.status(500).json({
        success: false,
        error: 'Fehler beim Aktualisieren der Reihenfolge'
      });
    });
});

// ===================================================================
// GET /api/standorte/:id/stats - Statistiken für einen Standort
// ===================================================================
router.get('/:id/stats', (req, res) => {
  const { id } = req.params;
  const dojoId = getDojoId(req);

  if (!dojoId || dojoId === 'all') {
    return res.status(403).json({
      success: false,
      error: 'Keine Dojo-ID verfügbar'
    });
  }

  // Prüfen ob Standort existiert und dem Dojo gehört
  db.query(
    'SELECT standort_id FROM standorte WHERE standort_id = ? AND dojo_id = ?',
    [id, dojoId],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Standort nicht gefunden'
        });
      }

      // Parallele Queries für verschiedene Statistiken
      const statsQuery = `
        SELECT
          (SELECT COUNT(*) FROM kurse WHERE standort_id = ?) as anzahl_kurse,
          (SELECT COUNT(*) FROM raeume WHERE standort_id = ?) as anzahl_raeume,
          (SELECT COUNT(*) FROM trainer_standorte WHERE standort_id = ? AND aktiv = TRUE) as anzahl_trainer,
          (SELECT COUNT(DISTINCT sp.id) FROM stundenplan sp WHERE sp.standort_id = ?) as anzahl_stundenplan_eintraege
      `;

      db.query(statsQuery, [id, id, id, id], (err, statsResults) => {
        if (err) {
          logger.error('Fehler beim Laden der Statistiken:', { error: err });
          return res.status(500).json({
            success: false,
            error: 'Fehler beim Laden der Statistiken'
          });
        }

        // Trainer-Liste für diesen Standort
        const trainerQuery = `
          SELECT
            t.trainer_id,
            t.vorname,
            t.nachname,
            ts.ist_hauptstandort,
            ts.aktiv
          FROM trainer_standorte ts
          INNER JOIN trainer t ON ts.trainer_id = t.trainer_id
          WHERE ts.standort_id = ? AND t.dojo_id = ?
          ORDER BY ts.ist_hauptstandort DESC, t.nachname ASC
        `;

        db.query(trainerQuery, [id, dojoId], (err, trainerResults) => {
          if (err) {
            logger.error('Fehler beim Laden der Trainer:', { error: err });
            return res.status(500).json({
              success: false,
              error: 'Fehler beim Laden der Trainer'
            });
          }

          res.json({
            success: true,
            data: {
              ...statsResults[0],
              trainer: trainerResults
            }
          });
        });
      });
    }
  );
});

// ===================================================================
// GET /api/standorte/:id/trainer - Trainer für einen Standort
// ===================================================================
router.get('/:id/trainer', (req, res) => {
  const { id } = req.params;
  const dojoId = getDojoId(req);

  if (!dojoId || dojoId === 'all') {
    return res.status(403).json({
      success: false,
      error: 'Keine Dojo-ID verfügbar'
    });
  }

  const query = `
    SELECT
      t.trainer_id,
      t.vorname,
      t.nachname,
      t.email,
      ts.ist_hauptstandort,
      ts.aktiv,
      ts.created_at
    FROM trainer_standorte ts
    INNER JOIN trainer t ON ts.trainer_id = t.trainer_id
    INNER JOIN standorte s ON ts.standort_id = s.standort_id
    WHERE ts.standort_id = ? AND s.dojo_id = ?
    ORDER BY ts.ist_hauptstandort DESC, t.nachname ASC
  `;

  db.query(query, [id, dojoId], (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Trainer:', { error: err });
      return res.status(500).json({
        success: false,
        error: 'Fehler beim Laden der Trainer'
      });
    }

    res.json({ success: true, data: results });
  });
});

// ===================================================================
// POST /api/standorte/:id/trainer - Trainer zu Standort zuordnen
// ===================================================================
router.post('/:id/trainer', (req, res) => {
  const { id } = req.params;
  const dojoId = getDojoId(req);

  if (!dojoId || dojoId === 'all') {
    return res.status(403).json({
      success: false,
      error: 'Keine Dojo-ID verfügbar'
    });
  }
  const { trainer_id, ist_hauptstandort = false } = req.body;

  if (!trainer_id) {
    return res.status(400).json({
      success: false,
      error: 'trainer_id ist erforderlich'
    });
  }

  // Prüfen ob Standort dem Dojo gehört
  db.query(
    'SELECT standort_id FROM standorte WHERE standort_id = ? AND dojo_id = ?',
    [id, dojoId],
    (err, standortResults) => {
      if (err || standortResults.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Standort nicht gefunden'
        });
      }

      // Prüfen ob Trainer dem Dojo gehört
      db.query(
        'SELECT trainer_id FROM trainer WHERE trainer_id = ? AND dojo_id = ?',
        [trainer_id, dojoId],
        (err, trainerResults) => {
          if (err || trainerResults.length === 0) {
            return res.status(404).json({
              success: false,
              error: 'Trainer nicht gefunden'
            });
          }

          // Zuordnung erstellen (INSERT IGNORE für Duplikate)
          const query = `
            INSERT INTO trainer_standorte (trainer_id, standort_id, ist_hauptstandort, aktiv)
            VALUES (?, ?, ?, TRUE)
            ON DUPLICATE KEY UPDATE
              ist_hauptstandort = VALUES(ist_hauptstandort),
              aktiv = TRUE
          `;

          db.query(query, [trainer_id, id, ist_hauptstandort], (err, result) => {
            if (err) {
              logger.error('Fehler beim Zuordnen des Trainers:', { error: err });
              return res.status(500).json({
                success: false,
                error: 'Fehler beim Zuordnen des Trainers'
              });
            }

            res.status(201).json({
              success: true,
              data: { message: 'Trainer erfolgreich zugeordnet' }
            });
          });
        }
      );
    }
  );
});

// ===================================================================
// DELETE /api/standorte/:id/trainer/:trainerId - Trainer-Zuordnung entfernen
// ===================================================================
router.delete('/:id/trainer/:trainerId', (req, res) => {
  const { id, trainerId } = req.params;
  const dojoId = getDojoId(req);

  if (!dojoId || dojoId === 'all') {
    return res.status(403).json({
      success: false,
      error: 'Keine Dojo-ID verfügbar'
    });
  }

  // Prüfen ob Standort dem Dojo gehört
  db.query(
    'SELECT standort_id FROM standorte WHERE standort_id = ? AND dojo_id = ?',
    [id, dojoId],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Standort nicht gefunden'
        });
      }

      // Zuordnung löschen
      const query = `
        DELETE FROM trainer_standorte
        WHERE standort_id = ? AND trainer_id = ?
      `;

      db.query(query, [id, trainerId], (err, result) => {
        if (err) {
          logger.error('Fehler beim Entfernen der Trainer-Zuordnung:', { error: err });
          return res.status(500).json({
            success: false,
            error: 'Fehler beim Entfernen der Trainer-Zuordnung'
          });
        }

        res.json({
          success: true,
          data: { message: 'Trainer-Zuordnung erfolgreich entfernt' }
        });
      });
    }
  );
});

module.exports = router;
