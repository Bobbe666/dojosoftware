/**
 * Stile Routes für Mitglieder
 * Extrahiert aus mitglieder.js - enthält alle Stil- und Graduierungs-Endpoints
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

// Stil-Mapping für ENUM-Konvertierung
const stilMappingById = {
  2: 'ShieldX',
  3: 'BJJ',
  4: 'Kickboxen',
  5: 'Karate',
  7: 'Taekwon-Do',
  8: 'BJJ'
};

const stilMappingByName = {
  'ShieldX': { stil_id: 2, stil_name: 'ShieldX', beschreibung: 'Moderne Selbstverteidigung mit realistischen Szenarien' },
  'BJJ': { stil_id: 3, stil_name: 'BJJ', beschreibung: 'Brazilian Jiu-Jitsu - Bodenkampf und Grappling-Techniken' },
  'Brazilian Jiu Jitsu': { stil_id: 3, stil_name: 'Brazilian Jiu Jitsu', beschreibung: 'Brazilian Jiu-Jitsu - Bodenkampf und Grappling-Techniken' },
  'Kickboxen': { stil_id: 4, stil_name: 'Kickboxen', beschreibung: 'Moderne Kampfsportart kombiniert Boxing mit Fußtechniken' },
  'Karate': { stil_id: 5, stil_name: 'Enso Karate', beschreibung: 'Traditionelle japanische Kampfkunst mit Fokus auf Schlag- und Tritttechniken' },
  'Enso Karate': { stil_id: 5, stil_name: 'Enso Karate', beschreibung: 'Traditionelle japanische Kampfkunst mit Fokus auf Schlag- und Tritttechniken' },
  'Taekwon-Do': { stil_id: 7, stil_name: 'Taekwon-Do', beschreibung: 'Koreanische Kampfkunst mit Betonung auf Fußtechniken und hohe Tritte' }
};

// Mitglied-Stile verwalten (POST)
router.post('/:id/stile', (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);
  const { stile } = req.body;

  if (isNaN(mitglied_id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  if (!Array.isArray(stile)) {
    return res.status(400).json({ error: 'Stile müssen als Array übergeben werden' });
  }

  const deleteMitgliedStileQuery = 'DELETE FROM mitglied_stile WHERE mitglied_id = ?';
  const deleteMitgliedStilDataQuery = 'DELETE FROM mitglied_stil_data WHERE mitglied_id = ?';

  db.query(deleteMitgliedStileQuery, [mitglied_id], (deleteErr) => {
    if (deleteErr) {
      logger.error('Fehler beim Löschen bestehender Stile:', deleteErr);
      return res.status(500).json({ error: 'Fehler beim Löschen bestehender Stile' });
    }

    db.query(deleteMitgliedStilDataQuery, [mitglied_id], (deleteDataErr) => {
      if (deleteDataErr) {
        logger.error('Fehler beim Löschen von mitglied_stil_data:', deleteDataErr);
      }

      if (stile.length === 0) {
        return res.json({ success: true, message: 'Stile erfolgreich aktualisiert', stile: [] });
      }

      const validValues = stile
        .filter(stil_id => stilMappingById[stil_id])
        .map(stil_id => [mitglied_id, stilMappingById[stil_id]]);

      if (validValues.length === 0) {
        return res.json({ success: true, message: 'Keine gültigen Stile zum Hinzufügen', stile: [] });
      }

      const insertQuery = 'INSERT INTO mitglied_stile (mitglied_id, stil) VALUES ?';

      db.query(insertQuery, [validValues], (insertErr) => {
        if (insertErr) {
          logger.error('Fehler beim Hinzufügen neuer Stile:', insertErr);
          return res.status(500).json({ error: 'Fehler beim Hinzufügen neuer Stile' });
        }

        const stilDataPromises = stile.map(stil_id => {
          return new Promise((resolve, reject) => {
            const checkQuery = 'SELECT id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?';
            db.query(checkQuery, [mitglied_id, stil_id], (checkErr, checkResults) => {
              if (checkErr) return reject(checkErr);
              if (checkResults.length > 0) return resolve();

              const getFirstGraduierungQuery = `
                SELECT graduierung_id FROM graduierungen
                WHERE stil_id = ? AND aktiv = 1
                ORDER BY reihenfolge ASC LIMIT 1
              `;
              db.query(getFirstGraduierungQuery, [stil_id], (gradErr, gradResults) => {
                if (gradErr) return reject(gradErr);
                const firstGraduierungId = gradResults.length > 0 ? gradResults[0].graduierung_id : null;
                const insertDataQuery = `
                  INSERT INTO mitglied_stil_data (mitglied_id, stil_id, current_graduierung_id, erstellt_am)
                  VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                `;
                db.query(insertDataQuery, [mitglied_id, stil_id, firstGraduierungId], (insertDataErr) => {
                  if (insertDataErr) return reject(insertDataErr);
                  resolve();
                });
              });
            });
          });
        });

        Promise.all(stilDataPromises)
          .then(() => {
            res.json({ success: true, message: 'Stile erfolgreich aktualisiert', mitglied_id, stile });
          })
          .catch(err => {
            logger.error('Fehler beim Aktualisieren mitglied_stil_data:', { error: err });
            res.json({ success: true, message: 'Stile aktualisiert, aber Warnung bei Stil-Daten', mitglied_id, stile });
          });
      });
    });
  });
});

// Mitglied-Stile abrufen (GET)
router.get('/:id/stile', (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);

  if (isNaN(mitglied_id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  const query = `SELECT ms.stil FROM mitglied_stile ms WHERE ms.mitglied_id = ? ORDER BY ms.stil`;

  db.query(query, [mitglied_id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Mitglied-Stile:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Stile' });
    }

    const transformedResults = results.map(row => {
      const stilInfo = stilMappingByName[row.stil];
      if (!stilInfo) return null;
      return {
        stil_id: stilInfo.stil_id,
        name: stilInfo.stil_name,
        stil_name: stilInfo.stil_name,
        beschreibung: stilInfo.beschreibung
      };
    }).filter(Boolean);

    if (transformedResults.length === 0) {
      return res.json({ success: true, mitglied_id, stile: [] });
    }

    const stilIds = transformedResults.map(s => s.stil_id);
    const graduierungenQuery = `
      SELECT graduierung_id, stil_id, name, reihenfolge, trainingsstunden_min, mindestzeit_monate, farbe_hex, kategorie, dan_grad
      FROM graduierungen WHERE stil_id IN (?) ORDER BY stil_id, reihenfolge
    `;

    db.query(graduierungenQuery, [stilIds], (gradErr, gradResults) => {
      if (gradErr) {
        return res.json({ success: true, mitglied_id, stile: transformedResults });
      }

      const graduierungenByStil = {};
      gradResults.forEach(grad => {
        if (!graduierungenByStil[grad.stil_id]) graduierungenByStil[grad.stil_id] = [];
        graduierungenByStil[grad.stil_id].push(grad);
      });

      const stileWithGraduierungen = transformedResults.map(stil => ({
        ...stil,
        graduierungen: graduierungenByStil[stil.stil_id] || []
      }));

      res.json({ success: true, mitglied_id, stile: stileWithGraduierungen });
    });
  });
});

// Stilspezifische Daten speichern (POST)
router.post('/:id/stil/:stil_id/data', (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);
  const stil_id = parseInt(req.params.stil_id, 10);
  const { current_graduierung_id, letzte_pruefung, naechste_pruefung, anmerkungen } = req.body;

  if (isNaN(mitglied_id) || isNaN(stil_id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds- oder Stil-ID' });
  }

  const checkQuery = `SELECT id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?`;

  db.query(checkQuery, [mitglied_id, stil_id], (checkErr, checkResult) => {
    if (checkErr) {
      logger.error('Fehler beim Prüfen vorhandener Daten:', checkErr);
      return res.status(500).json({ error: 'Datenbankfehler beim Prüfen' });
    }

    let query, params;
    if (checkResult.length > 0) {
      query = `
        UPDATE mitglied_stil_data
        SET current_graduierung_id = ?, letzte_pruefung = ?, naechste_pruefung = ?, anmerkungen = ?, aktualisiert_am = CURRENT_TIMESTAMP
        WHERE mitglied_id = ? AND stil_id = ?
      `;
      params = [current_graduierung_id || null, letzte_pruefung || null, naechste_pruefung || null, anmerkungen || null, mitglied_id, stil_id];
    } else {
      query = `
        INSERT INTO mitglied_stil_data (mitglied_id, stil_id, current_graduierung_id, letzte_pruefung, naechste_pruefung, anmerkungen, erstellt_am)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      params = [mitglied_id, stil_id, current_graduierung_id || null, letzte_pruefung || null, naechste_pruefung || null, anmerkungen || null];
    }

    db.query(query, params, (err) => {
      if (err) {
        logger.error('Fehler beim Speichern stilspezifischer Daten:', err);
        return res.status(500).json({ error: 'Fehler beim Speichern' });
      }
      res.json({ success: true, message: 'Stilspezifische Daten erfolgreich gespeichert', mitglied_id, stil_id });
    });
  });
});

// Stilspezifische Daten abrufen (GET)
router.get('/:id/stil/:stil_id/data', (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);
  const stil_id = parseInt(req.params.stil_id, 10);

  if (isNaN(mitglied_id) || isNaN(stil_id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds- oder Stil-ID' });
  }

  const query = `
    SELECT msd.*, g.name as graduierung_name, g.farbe_hex, g.farbe_sekundaer, g.trainingsstunden_min, g.mindestzeit_monate, g.reihenfolge
    FROM mitglied_stil_data msd
    LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
    WHERE msd.mitglied_id = ? AND msd.stil_id = ?
  `;

  db.query(query, [mitglied_id, stil_id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen stilspezifischer Daten:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Daten' });
    }

    const pruefungsterminQuery = `
      SELECT pruefungsdatum FROM pruefungstermin_vorlagen
      WHERE stil_id = ? AND pruefungsdatum >= CURDATE()
      ORDER BY pruefungsdatum ASC LIMIT 1
    `;

    db.query(pruefungsterminQuery, [stil_id], (pruefErr, pruefResults) => {
      let stilData = results.length > 0 ? results[0] : {
        mitglied_id, stil_id, current_graduierung_id: null, letzte_pruefung: null, naechste_pruefung: null, anmerkungen: null
      };

      if (pruefResults && pruefResults.length > 0) {
        const kommenderTermin = pruefResults[0].pruefungsdatum;
        if (!stilData.naechste_pruefung || new Date(kommenderTermin) > new Date(stilData.naechste_pruefung)) {
          stilData.naechste_pruefung = kommenderTermin;
          stilData.auto_gefuellt = true;
        }
      }

      res.json({ success: true, data: stilData });
    });
  });
});

// Trainingsstunden-Analyse (GET)
router.get('/:id/stil/:stil_id/training-analysis', (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);
  const stil_id = parseInt(req.params.stil_id, 10);

  if (isNaN(mitglied_id) || isNaN(stil_id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds- oder Stil-ID' });
  }

  const queries = {
    currentData: `
      SELECT msd.current_graduierung_id, msd.letzte_pruefung, g.name as graduierung_name, g.trainingsstunden_min, g.mindestzeit_monate, g.reihenfolge
      FROM mitglied_stil_data msd
      LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
      WHERE msd.mitglied_id = ? AND msd.stil_id = ?
    `,
    nextGraduation: `
      SELECT g.graduierung_id, g.name, g.trainingsstunden_min, g.mindestzeit_monate, g.reihenfolge
      FROM graduierungen g
      WHERE g.stil_id = ? AND g.reihenfolge = (
        SELECT MIN(g2.reihenfolge) FROM graduierungen g2
        JOIN mitglied_stil_data msd ON msd.current_graduierung_id IS NOT NULL
        WHERE g2.stil_id = ? AND g2.reihenfolge > (
          SELECT g3.reihenfolge FROM graduierungen g3
          WHERE g3.graduierung_id = msd.current_graduierung_id AND msd.mitglied_id = ?
        )
      )
    `,
    attendanceCount: `
      SELECT COUNT(*) as training_sessions FROM anwesenheit a
      WHERE a.mitglied_id = ? AND a.anwesend = 1
      AND a.datum >= COALESCE(
        (SELECT msd.letzte_pruefung FROM mitglied_stil_data msd WHERE msd.mitglied_id = ? AND msd.stil_id = ?),
        '2020-01-01'
      )
    `
  };

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(queries.currentData, [mitglied_id, stil_id], (err, results) => {
        if (err) reject(err); else resolve(results[0] || null);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries.nextGraduation, [stil_id, stil_id, mitglied_id], (err, results) => {
        if (err) reject(err); else resolve(results[0] || null);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries.attendanceCount, [mitglied_id, mitglied_id, stil_id], (err, results) => {
        if (err) reject(err); else resolve(results[0].training_sessions || 0);
      });
    })
  ])
  .then(([currentData, nextGraduation, trainingSessions]) => {
    const analysis = {
      current_graduation: currentData,
      next_graduation: nextGraduation,
      training_sessions_completed: trainingSessions,
      training_sessions_required: nextGraduation?.trainingsstunden_min || 0,
      training_sessions_remaining: Math.max(0, (nextGraduation?.trainingsstunden_min || 0) - trainingSessions),
      is_ready_for_exam: nextGraduation ? trainingSessions >= nextGraduation.trainingsstunden_min : false,
      last_exam_date: currentData?.letzte_pruefung || null
    };
    res.json({ success: true, analysis });
  })
  .catch(err => {
    logger.error('Fehler bei der Trainingsstunden-Analyse:', err);
    res.status(500).json({ error: 'Fehler bei der Analyse' });
  });
});

// Graduierung aktualisieren (PUT)
router.put('/:id/graduierung', (req, res) => {
  const mitglied_id = parseInt(req.params.id);
  let { stil_id, graduierung_id, pruefungsdatum } = req.body;

  if (!mitglied_id || !stil_id || !graduierung_id) {
    return res.status(400).json({ error: 'Fehlende Parameter: mitglied_id, stil_id und graduierung_id sind erforderlich' });
  }

  if (pruefungsdatum) {
    const date = new Date(pruefungsdatum);
    pruefungsdatum = date.toISOString().split('T')[0];
  }

  logger.debug('Aktualisiere Graduierung:', { mitglied_id, stil_id, graduierung_id, pruefungsdatum });

  const checkQuery = `SELECT * FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?`;

  db.query(checkQuery, [mitglied_id, stil_id], (checkErr, checkResults) => {
    if (checkErr) {
      logger.error('Fehler beim Prüfen der Stildaten:', checkErr);
      return res.status(500).json({ error: 'Fehler beim Prüfen der Stildaten' });
    }

    let query, params;

    if (checkResults.length > 0) {
      query = `
        UPDATE mitglied_stil_data
        SET current_graduierung_id = ?, letzte_pruefung = ?
        WHERE mitglied_id = ? AND stil_id = ?
      `;
      params = [graduierung_id, pruefungsdatum || null, mitglied_id, stil_id];
    } else {
      query = `
        INSERT INTO mitglied_stil_data (mitglied_id, stil_id, current_graduierung_id, letzte_pruefung)
        VALUES (?, ?, ?, ?)
      `;
      params = [mitglied_id, stil_id, graduierung_id, pruefungsdatum || null];
    }

    db.query(query, params, (err, result) => {
      if (err) {
        logger.error('Fehler beim Aktualisieren der Graduierung:', err);
        return res.status(500).json({ error: 'Fehler beim Aktualisieren der Graduierung', details: err.message });
      }

      logger.info('Graduierung erfolgreich aktualisiert:', { details: result });
      res.json({ success: true, message: 'Graduierung erfolgreich aktualisiert', mitglied_id, stil_id, graduierung_id });
    });
  });
});

module.exports = router;
