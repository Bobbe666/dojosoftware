/**
 * Stile Routes für Mitglieder
 * Extrahiert aus mitglieder.js - enthält alle Stil- und Graduierungs-Endpoints
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const { getSecureDojoId } = require('../../middleware/tenantSecurity');
const router = express.Router();

// ─── MASSENWEISE GÜRTELZUWEISUNG (muss VOR /:id Routen stehen!) ──────────────

// GET /zuweisung/stil/:stil_id – Alle aktiven Mitglieder eines Stils mit aktuellem Gürtel
// Prüft BEIDE Tabellen: mitglied_stil_data (direkte ID-Zuordnung) + mitglied_stile (Text-Zuordnung)
router.get('/zuweisung/stil/:stil_id', (req, res) => {
  const stil_id = parseInt(req.params.stil_id, 10);
  if (isNaN(stil_id)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  const secureDojoId = getSecureDojoId(req);
  const dojoParams = secureDojoId ? [stil_id, stil_id, stil_id, secureDojoId] : [stil_id, stil_id, stil_id];
  const dojoCondition = secureDojoId ? ' AND m.dojo_id = ?' : '';

  // UNION: Mitglieder aus mitglied_stil_data (neu, mit Gürtel)
  //      + Mitglieder nur aus mitglied_stile (alt, ohne Gürtel) – zum Sync
  const query = `
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      msd.current_graduierung_id,
      msd.letzte_pruefung,
      msd.guertellaenge_cm,
      g.name as graduierung_name,
      g.farbe_hex,
      g.reihenfolge as graduierung_reihenfolge,
      g.kategorie,
      g.dan_grad
    FROM mitglieder m
    INNER JOIN (
      SELECT mitglied_id, current_graduierung_id, letzte_pruefung, guertellaenge_cm
      FROM mitglied_stil_data WHERE stil_id = ?
      UNION
      SELECT ms.mitglied_id, NULL, NULL, NULL
      FROM mitglied_stile ms
        JOIN stile s ON s.stil_id = ? AND ms.stil = s.name
      WHERE ms.mitglied_id NOT IN (
        SELECT mitglied_id FROM mitglied_stil_data WHERE stil_id = ?
      )
    ) AS combined ON m.mitglied_id = combined.mitglied_id
    LEFT JOIN graduierungen g ON combined.current_graduierung_id = g.graduierung_id
    WHERE m.aktiv = 1${dojoCondition}
    ORDER BY COALESCE(g.reihenfolge, 9999) ASC, m.nachname ASC, m.vorname ASC
  `;

  db.query(query, dojoParams, (err, results) => {
    if (err) {
      logger.error('Fehler bei Gürtel-Zuweisung:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json({ success: true, mitglieder: results });
  });
});

// POST /stil/:stil_id/assign – Mitglied einem Stil zuweisen (von Stilmitglieder-Tab)
router.post('/stil/:stil_id/assign', async (req, res) => {
  const stil_id = parseInt(req.params.stil_id, 10);
  const { mitglied_id } = req.body;
  if (isNaN(stil_id) || !mitglied_id) return res.status(400).json({ error: 'Ungültige Parameter' });

  const secureDojoId = getSecureDojoId(req);
  const pool = db.promise();

  try {
    // Sicherheitscheck: Mitglied gehört zum Dojo
    if (secureDojoId) {
      const [member] = await pool.query(
        'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ? AND aktiv = 1',
        [mitglied_id, secureDojoId]
      );
      if (member.length === 0) return res.status(403).json({ error: 'Mitglied nicht gefunden' });
    }

    // Bereits zugewiesen?
    const [existing] = await pool.query(
      'SELECT id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?',
      [mitglied_id, stil_id]
    );
    if (existing.length > 0) return res.json({ success: true, message: 'Bereits zugewiesen' });

    // Erste Graduierung des Stils holen
    const [grads] = await pool.query(
      'SELECT graduierung_id FROM graduierungen WHERE stil_id = ? AND aktiv = 1 ORDER BY reihenfolge ASC LIMIT 1',
      [stil_id]
    );
    const firstGradId = grads.length > 0 ? grads[0].graduierung_id : null;

    // In mitglied_stil_data eintragen
    await pool.query(
      'INSERT INTO mitglied_stil_data (mitglied_id, stil_id, current_graduierung_id, erstellt_am) VALUES (?, ?, ?, NOW())',
      [mitglied_id, stil_id, firstGradId]
    );

    // Auch in mitglied_stile (Text-Tabelle) eintragen – für Rückwärtskompatibilität
    const [stilRow] = await pool.query('SELECT name FROM stile WHERE stil_id = ?', [stil_id]);
    if (stilRow.length > 0) {
      await pool.query(
        'INSERT IGNORE INTO mitglied_stile (mitglied_id, stil) VALUES (?, ?)',
        [mitglied_id, stilRow[0].name]
      );
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Fehler beim Zuweisen des Stils:', err);
    res.status(500).json({ error: 'Fehler beim Zuweisen' });
  }
});

// DELETE /stil/:stil_id/remove/:mitglied_id – Mitglied aus Stil entfernen
router.delete('/stil/:stil_id/remove/:mitglied_id', async (req, res) => {
  const stil_id = parseInt(req.params.stil_id, 10);
  const mitglied_id = parseInt(req.params.mitglied_id, 10);
  if (isNaN(stil_id) || isNaN(mitglied_id)) return res.status(400).json({ error: 'Ungültige Parameter' });

  const secureDojoId = getSecureDojoId(req);
  const pool = db.promise();

  try {
    if (secureDojoId) {
      const [member] = await pool.query(
        'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
        [mitglied_id, secureDojoId]
      );
      if (member.length === 0) return res.status(403).json({ error: 'Nicht berechtigt' });
    }

    await pool.query(
      'DELETE FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?',
      [mitglied_id, stil_id]
    );

    // Auch aus Text-Tabelle entfernen
    const [stilRow] = await pool.query('SELECT name FROM stile WHERE stil_id = ?', [stil_id]);
    if (stilRow.length > 0) {
      await pool.query(
        'DELETE FROM mitglied_stile WHERE mitglied_id = ? AND stil = ?',
        [mitglied_id, stilRow[0].name]
      );
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Fehler beim Entfernen aus Stil:', err);
    res.status(500).json({ error: 'Fehler beim Entfernen' });
  }
});

// POST /bulk-graduierung – Massenweise Gürtel zuweisen
router.post('/bulk-graduierung', (req, res) => {
  const { stil_id, assignments } = req.body;
  if (!stil_id || !Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: 'stil_id und assignments Array erforderlich' });
  }

  const secureDojoId = getSecureDojoId(req);
  const pool = db.promise();

  const processAll = async () => {
    let updated = 0, inserted = 0;
    for (const { mitglied_id, graduierung_id } of assignments) {
      if (!mitglied_id || !graduierung_id) continue;
      if (secureDojoId) {
        const [check] = await pool.query(
          'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ? AND aktiv = 1',
          [mitglied_id, secureDojoId]
        );
        if (check.length === 0) continue;
      }
      const [existing] = await pool.query(
        'SELECT id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?',
        [mitglied_id, stil_id]
      );
      if (existing.length > 0) {
        await pool.query(
          'UPDATE mitglied_stil_data SET current_graduierung_id = ?, aktualisiert_am = CURRENT_TIMESTAMP WHERE mitglied_id = ? AND stil_id = ?',
          [graduierung_id, mitglied_id, stil_id]
        );
        updated++;
      } else {
        await pool.query(
          'INSERT INTO mitglied_stil_data (mitglied_id, stil_id, current_graduierung_id, erstellt_am) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
          [mitglied_id, stil_id, graduierung_id]
        );
        inserted++;
      }
    }
    return { updated, inserted };
  };

  processAll()
    .then(({ updated, inserted }) => {
      res.json({ success: true, updated, inserted, total: updated + inserted });
    })
    .catch(err => {
      logger.error('Fehler bei Bulk-Graduierung:', err);
      res.status(500).json({ error: 'Fehler beim Speichern der Gürtelzuweisungen' });
    });
});

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

// Mitglied-Stile verwalten (POST) – schreibt in BEIDE Tabellen
router.post('/:id/stile', (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);
  const { stile } = req.body;

  if (isNaN(mitglied_id)) return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  if (!Array.isArray(stile)) return res.status(400).json({ error: 'Stile müssen als Array übergeben werden' });

  const pool = db.promise();

  const run = async () => {
    // Alte Einträge löschen
    await pool.query('DELETE FROM mitglied_stile WHERE mitglied_id = ?', [mitglied_id]);
    await pool.query('DELETE FROM mitglied_stil_data WHERE mitglied_id = ?', [mitglied_id]);

    if (stile.length === 0) return;

    // mitglied_stile (Text-Tabelle) für gemappte Stile
    const textInserts = stile
      .filter(sid => stilMappingById[sid])
      .map(sid => [mitglied_id, stilMappingById[sid]]);
    if (textInserts.length > 0) {
      await pool.query('INSERT INTO mitglied_stile (mitglied_id, stil) VALUES ?', [textInserts]);
    }

    // Für nicht-gemappte Stile: Namen direkt aus stile-Tabelle holen
    const unmappedIds = stile.filter(sid => !stilMappingById[sid]);
    for (const sid of unmappedIds) {
      const [rows] = await pool.query('SELECT name FROM stile WHERE stil_id = ?', [sid]);
      if (rows.length > 0) {
        await pool.query(
          'INSERT IGNORE INTO mitglied_stile (mitglied_id, stil) VALUES (?, ?)',
          [mitglied_id, rows[0].name]
        );
      }
    }

    // mitglied_stil_data für ALLE Stile (alt + neu)
    for (const sid of stile) {
      const [grads] = await pool.query(
        'SELECT graduierung_id FROM graduierungen WHERE stil_id = ? AND aktiv = 1 ORDER BY reihenfolge ASC LIMIT 1',
        [sid]
      );
      const firstGradId = grads.length > 0 ? grads[0].graduierung_id : null;
      await pool.query(
        'INSERT IGNORE INTO mitglied_stil_data (mitglied_id, stil_id, current_graduierung_id, erstellt_am) VALUES (?, ?, ?, NOW())',
        [mitglied_id, sid, firstGradId]
      );
    }
  };

  run()
    .then(() => res.json({ success: true, message: 'Stile erfolgreich aktualisiert', mitglied_id, stile }))
    .catch(err => {
      logger.error('Fehler beim Aktualisieren der Mitglieds-Stile:', err);
      res.status(500).json({ error: 'Fehler beim Speichern der Stile' });
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

  const pool = db.promise();

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
    }),
    // Letzte abgeschlossene Prüfung aus pruefungen-Tabelle (authoritative)
    pool.query(
      `SELECT p.pruefung_id, p.pruefungsdatum, p.bestanden, p.punktzahl, p.max_punktzahl,
              p.prueferkommentar, p.status,
              gv.name AS graduierung_vorher, gv.farbe_hex AS farbe_vorher,
              gn.name AS graduierung_nachher, gn.farbe_hex AS farbe_nachher,
              pp.gesamtkommentar, pp.staerken, pp.verbesserungen, pp.empfehlungen,
              pp.gesendet_am AS protokoll_gesendet
       FROM pruefungen p
       LEFT JOIN graduierungen gv ON p.graduierung_vorher_id = gv.graduierung_id
       LEFT JOIN graduierungen gn ON p.graduierung_nachher_id = gn.graduierung_id
       LEFT JOIN pruefungs_protokolle pp ON pp.pruefung_id = p.pruefung_id
       WHERE p.mitglied_id = ? AND p.stil_id = ?
         AND p.status IN ('bestanden','nicht_bestanden','durchgefuehrt')
       ORDER BY p.pruefungsdatum DESC
       LIMIT 5`,
      [mitglied_id, stil_id]
    ).then(([rows]) => rows).catch(() => [])
  ])
  .then(([currentData, nextGraduation, trainingSessions, pruefungsHistorie]) => {
    // last_exam_date: pruefungen-Tabelle hat Vorrang vor mitglied_stil_data
    const letzteAusPruefungen = pruefungsHistorie.length > 0 ? pruefungsHistorie[0].pruefungsdatum : null;
    const letzteAusMSD = currentData?.letzte_pruefung || null;
    const lastExamDate = letzteAusPruefungen || letzteAusMSD;

    const analysis = {
      current_graduation: currentData,
      next_graduation: nextGraduation,
      training_sessions_completed: trainingSessions,
      training_sessions_required: nextGraduation?.trainingsstunden_min || 0,
      training_sessions_remaining: Math.max(0, (nextGraduation?.trainingsstunden_min || 0) - trainingSessions),
      is_ready_for_exam: nextGraduation ? trainingSessions >= nextGraduation.trainingsstunden_min : false,
      last_exam_date: lastExamDate,
      pruefungs_historie: pruefungsHistorie
    };
    res.json({ success: true, analysis });
  })
  .catch(err => {
    logger.error('Fehler bei der Trainingsstunden-Analyse:', err);
    res.status(500).json({ error: 'Fehler bei der Analyse' });
  });
});

// Gürtellänge aktualisieren (PUT)
router.put('/:id/stil/:stil_id/guertellaenge', async (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);
  const stil_id = parseInt(req.params.stil_id, 10);
  const { guertellaenge_cm } = req.body;

  if (isNaN(mitglied_id) || isNaN(stil_id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds- oder Stil-ID' });
  }

  const laenge = guertellaenge_cm ? parseInt(guertellaenge_cm, 10) : null;
  if (laenge !== null && (laenge < 100 || laenge > 500)) {
    return res.status(400).json({ error: 'Ungültige Gürtellänge (erlaubt: 100–500 cm)' });
  }

  const secureDojoId = getSecureDojoId(req);
  const pool = db.promise();

  try {
    if (secureDojoId) {
      const [member] = await pool.query(
        'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
        [mitglied_id, secureDojoId]
      );
      if (member.length === 0) return res.status(403).json({ error: 'Nicht berechtigt' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?',
      [mitglied_id, stil_id]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE mitglied_stil_data SET guertellaenge_cm = ?, aktualisiert_am = CURRENT_TIMESTAMP WHERE mitglied_id = ? AND stil_id = ?',
        [laenge, mitglied_id, stil_id]
      );
    } else {
      await pool.query(
        'INSERT INTO mitglied_stil_data (mitglied_id, stil_id, guertellaenge_cm, erstellt_am) VALUES (?, ?, ?, NOW())',
        [mitglied_id, stil_id, laenge]
      );
    }

    res.json({ success: true, guertellaenge_cm: laenge });
  } catch (err) {
    logger.error('Fehler beim Speichern der Gürtellänge:', err);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
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
