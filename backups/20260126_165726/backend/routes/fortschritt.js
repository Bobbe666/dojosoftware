const express = require('express');
const db = require('../db');
const router = express.Router();

// =====================================================================================
// FORTSCHRITT - Skills & Techniken
// =====================================================================================

// GET: Alle Fortschritt-Skills eines Mitglieds
router.get('/mitglied/:mitglied_id', (req, res) => {
  const { mitglied_id } = req.params;

  const query = `
    SELECT
      mf.*,
      fk.name as kategorie_name,
      fk.icon as kategorie_icon,
      fk.farbe_hex as kategorie_farbe
    FROM mitglieder_fortschritt mf
    LEFT JOIN fortschritt_kategorien fk ON mf.kategorie_id = fk.kategorie_id
    WHERE mf.mitglied_id = ?
    ORDER BY fk.reihenfolge, mf.prioritaet DESC, mf.fortschritt_prozent DESC
  `;

  db.query(query, [mitglied_id], (err, results) => {
    if (err) {
      console.error('Fehler beim Laden des Fortschritts:', err);
      return res.status(500).json({ error: 'Fehler beim Laden des Fortschritts' });
    }
    res.json(results);
  });
});

// POST: Neuer Fortschritt-Eintrag
router.post('/mitglied/:mitglied_id', (req, res) => {
  const { mitglied_id } = req.params;
  const { kategorie_id, skill_name, beschreibung, fortschritt_prozent, status, prioritaet, schwierigkeit, ziel_datum } = req.body;

  const query = `
    INSERT INTO mitglieder_fortschritt
    (mitglied_id, kategorie_id, skill_name, beschreibung, fortschritt_prozent, status, prioritaet, schwierigkeit, ziel_datum)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    mitglied_id,
    kategorie_id,
    skill_name,
    beschreibung || null,
    fortschritt_prozent || 0,
    status || 'nicht_gestartet',
    prioritaet || 'mittel',
    schwierigkeit || 'anfaenger',
    ziel_datum || null
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Fehler beim Erstellen des Fortschritts:', err);
      return res.status(500).json({ error: 'Fehler beim Erstellen des Fortschritts' });
    }

    // Neu erstellten Eintrag zurückgeben
    db.query('SELECT * FROM mitglieder_fortschritt WHERE fortschritt_id = ?', [result.insertId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Fehler' });
      res.status(201).json(results[0]);
    });
  });
});

// PUT: Fortschritt aktualisieren
router.put('/:fortschritt_id', (req, res) => {
  const { fortschritt_id } = req.params;
  const { 
    skill_name, 
    beschreibung, 
    fortschritt_prozent, 
    status, 
    prioritaet, 
    schwierigkeit, 
    ziel_datum, 
    trainer_bewertung, 
    trainer_kommentar,
    updated_by,
    updated_by_name,
    update_reason
  } = req.body;

  const query = `
    UPDATE mitglieder_fortschritt
    SET skill_name = ?,
        beschreibung = ?,
        fortschritt_prozent = ?,
        status = ?,
        prioritaet = ?,
        schwierigkeit = ?,
        ziel_datum = ?,
        trainer_bewertung = ?,
        trainer_kommentar = ?
    WHERE fortschritt_id = ?
  `;

  const values = [
    skill_name,
    beschreibung,
    fortschritt_prozent,
    status,
    prioritaet,
    schwierigkeit,
    ziel_datum || null,
    trainer_bewertung || null,
    trainer_kommentar || null,
    fortschritt_id
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Fehler beim Aktualisieren des Fortschritts:', err);
      return res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }

    // Benutzer-Informationen in fortschritt_updates speichern
    if (updated_by && update_reason) {
      const historyQuery = `
        INSERT INTO fortschritt_updates 
        (fortschritt_id, mitglied_id, alter_fortschritt, neuer_fortschritt, alter_status, neuer_status, notiz, aktualisiert_von_name)
        SELECT ?, mitglied_id, 
               (SELECT fortschritt_prozent FROM mitglieder_fortschritt WHERE fortschritt_id = ?),
               ?, 
               (SELECT status FROM mitglieder_fortschritt WHERE fortschritt_id = ?),
               ?,
               ?,
               ?
        FROM mitglieder_fortschritt 
        WHERE fortschritt_id = ?
      `;
      
      const historyValues = [
        fortschritt_id,
        fortschritt_id,
        fortschritt_prozent,
        fortschritt_id,
        status,
        `Slider geändert von ${updated_by_name}`,
        updated_by_name,
        fortschritt_id
      ];

      db.query(historyQuery, historyValues, (historyErr) => {
        if (historyErr) {
          console.error('Fehler beim Speichern der Historie:', historyErr);
        }
      });
    }

    // Aktualisierten Eintrag zurückgeben
    db.query('SELECT * FROM mitglieder_fortschritt WHERE fortschritt_id = ?', [fortschritt_id], (err, results) => {
      if (err) return res.status(500).json({ error: 'Fehler' });
      res.json(results[0]);
    });
  });
});

// DELETE: Fortschritt löschen
router.delete('/:fortschritt_id', (req, res) => {
  const { fortschritt_id } = req.params;

  db.query('DELETE FROM mitglieder_fortschritt WHERE fortschritt_id = ?', [fortschritt_id], (err, result) => {
    if (err) {
      console.error('Fehler beim Löschen des Fortschritts:', err);
      return res.status(500).json({ error: 'Fehler beim Löschen' });
    }
    res.json({ success: true, message: 'Fortschritt gelöscht' });
  });
});

// GET: Fortschritt-Historie
router.get('/:fortschritt_id/history', (req, res) => {
  const { fortschritt_id } = req.params;

  const query = `
    SELECT 
      fu.*,
      mf.skill_name,
      CONCAT(m.vorname, ' ', m.nachname) as mitglied_name
    FROM fortschritt_updates fu
    LEFT JOIN mitglieder_fortschritt mf ON fu.fortschritt_id = mf.fortschritt_id
    LEFT JOIN mitglieder m ON fu.mitglied_id = m.mitglied_id
    WHERE fu.fortschritt_id = ?
    ORDER BY fu.update_timestamp DESC
    LIMIT 50
  `;

  db.query(query, [fortschritt_id], (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Historie:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Historie' });
    }
    res.json(results);
  });
});

// =====================================================================================
// ZIELE (GOALS)
// =====================================================================================

// GET: Alle Ziele eines Mitglieds
router.get('/mitglied/:mitglied_id/ziele', (req, res) => {
  const { mitglied_id } = req.params;
  const { status } = req.query; // Optional: Filter nach Status

  let query = 'SELECT * FROM mitglieder_ziele WHERE mitglied_id = ?';
  const params = [mitglied_id];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY prioritaet DESC, ziel_datum ASC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Ziele:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Ziele' });
    }
    res.json(results);
  });
});

// POST: Neues Ziel erstellen
router.post('/mitglied/:mitglied_id/ziele', (req, res) => {
  const { mitglied_id } = req.params;
  const { titel, beschreibung, start_datum, ziel_datum, prioritaet, messbar, einheit, ziel_wert } = req.body;

  const query = `
    INSERT INTO mitglieder_ziele
    (mitglied_id, titel, beschreibung, start_datum, ziel_datum, prioritaet, messbar, einheit, ziel_wert)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    mitglied_id,
    titel,
    beschreibung || null,
    start_datum,
    ziel_datum,
    prioritaet || 'mittel',
    messbar || false,
    messbar ? einheit : null,
    messbar ? ziel_wert : null
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Fehler beim Erstellen des Ziels:', err);
      return res.status(500).json({ error: 'Fehler beim Erstellen des Ziels' });
    }

    db.query('SELECT * FROM mitglieder_ziele WHERE ziel_id = ?', [result.insertId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Fehler' });
      res.status(201).json(results[0]);
    });
  });
});

// PUT: Ziel aktualisieren
router.put('/ziele/:ziel_id', (req, res) => {
  const { ziel_id } = req.params;
  const { titel, beschreibung, ziel_datum, status, fortschritt_prozent, aktueller_wert, prioritaet } = req.body;

  const query = `
    UPDATE mitglieder_ziele
    SET titel = ?,
        beschreibung = ?,
        ziel_datum = ?,
        status = ?,
        fortschritt_prozent = ?,
        aktueller_wert = ?,
        prioritaet = ?
    WHERE ziel_id = ?
  `;

  const values = [titel, beschreibung, ziel_datum, status, fortschritt_prozent, aktueller_wert || 0, prioritaet, ziel_id];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Fehler beim Aktualisieren des Ziels:', err);
      return res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }

    db.query('SELECT * FROM mitglieder_ziele WHERE ziel_id = ?', [ziel_id], (err, results) => {
      if (err) return res.status(500).json({ error: 'Fehler' });
      res.json(results[0]);
    });
  });
});

// DELETE: Ziel löschen
router.delete('/ziele/:ziel_id', (req, res) => {
  const { ziel_id } = req.params;

  db.query('DELETE FROM mitglieder_ziele WHERE ziel_id = ?', [ziel_id], (err, result) => {
    if (err) {
      console.error('Fehler beim Löschen des Ziels:', err);
      return res.status(500).json({ error: 'Fehler beim Löschen' });
    }
    res.json({ success: true, message: 'Ziel gelöscht' });
  });
});

// =====================================================================================
// MEILENSTEINE
// =====================================================================================

// GET: Alle Meilensteine eines Mitglieds
router.get('/mitglied/:mitglied_id/meilensteine', (req, res) => {
  const { mitglied_id } = req.params;

  const query = `
    SELECT * FROM mitglieder_meilensteine
    WHERE mitglied_id = ?
    ORDER BY erreicht DESC, ziel_datum ASC
  `;

  db.query(query, [mitglied_id], (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Meilensteine:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Meilensteine' });
    }
    res.json(results);
  });
});

// POST: Neuer Meilenstein
router.post('/mitglied/:mitglied_id/meilensteine', (req, res) => {
  const { mitglied_id } = req.params;
  const { titel, beschreibung, typ, ziel_datum, belohnung, oeffentlich } = req.body;

  const query = `
    INSERT INTO mitglieder_meilensteine
    (mitglied_id, titel, beschreibung, typ, ziel_datum, belohnung, oeffentlich)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    mitglied_id,
    titel,
    beschreibung || null,
    typ || 'achievement',
    ziel_datum || null,
    belohnung || null,
    oeffentlich || false
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Fehler beim Erstellen des Meilensteins:', err);
      return res.status(500).json({ error: 'Fehler beim Erstellen' });
    }

    db.query('SELECT * FROM mitglieder_meilensteine WHERE meilenstein_id = ?', [result.insertId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Fehler' });
      res.status(201).json(results[0]);
    });
  });
});

// PUT: Meilenstein als erreicht markieren
router.put('/meilensteine/:meilenstein_id/erreicht', (req, res) => {
  const { meilenstein_id } = req.params;
  const { erreicht } = req.body;

  const query = `
    UPDATE mitglieder_meilensteine
    SET erreicht = ?,
        erreicht_am = ${erreicht ? 'CURDATE()' : 'NULL'}
    WHERE meilenstein_id = ?
  `;

  db.query(query, [erreicht, meilenstein_id], (err, result) => {
    if (err) {
      console.error('Fehler beim Aktualisieren des Meilensteins:', err);
      return res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }

    db.query('SELECT * FROM mitglieder_meilensteine WHERE meilenstein_id = ?', [meilenstein_id], (err, results) => {
      if (err) return res.status(500).json({ error: 'Fehler' });
      res.json(results[0]);
    });
  });
});

// DELETE: Meilenstein löschen
router.delete('/meilensteine/:meilenstein_id', (req, res) => {
  const { meilenstein_id } = req.params;

  db.query('DELETE FROM mitglieder_meilensteine WHERE meilenstein_id = ?', [meilenstein_id], (err, result) => {
    if (err) {
      console.error('Fehler beim Löschen des Meilensteins:', err);
      return res.status(500).json({ error: 'Fehler beim Löschen' });
    }
    res.json({ success: true, message: 'Meilenstein gelöscht' });
  });
});

// =====================================================================================
// TRAININGS-NOTIZEN
// =====================================================================================

// GET: Alle Notizen eines Mitglieds
router.get('/mitglied/:mitglied_id/notizen', (req, res) => {
  const { mitglied_id } = req.params;

  const query = `
    SELECT * FROM trainings_notizen
    WHERE mitglied_id = ?
    ORDER BY datum DESC, erstellt_am DESC
    LIMIT 100
  `;

  db.query(query, [mitglied_id], (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Notizen:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Notizen' });
    }
    res.json(results);
  });
});

// POST: Neue Trainings-Notiz
router.post('/mitglied/:mitglied_id/notizen', (req, res) => {
  const { mitglied_id } = req.params;
  const { titel, notiz, typ, datum, privat, trainer_id } = req.body;

  const query = `
    INSERT INTO trainings_notizen
    (mitglied_id, trainer_id, titel, notiz, typ, datum, privat)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    mitglied_id,
    trainer_id || null,
    titel || null,
    notiz,
    typ || 'allgemein',
    datum || new Date().toISOString().split('T')[0],
    privat || false
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Fehler beim Erstellen der Notiz:', err);
      return res.status(500).json({ error: 'Fehler beim Erstellen' });
    }

    db.query('SELECT * FROM trainings_notizen WHERE notiz_id = ?', [result.insertId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Fehler' });
      res.status(201).json(results[0]);
    });
  });
});

// DELETE: Trainings-Notiz löschen
router.delete('/notizen/:notiz_id', (req, res) => {
  const { notiz_id } = req.params;

  db.query('DELETE FROM trainings_notizen WHERE notiz_id = ?', [notiz_id], (err, result) => {
    if (err) {
      console.error('Fehler beim Löschen der Notiz:', err);
      return res.status(500).json({ error: 'Fehler beim Löschen' });
    }
    res.json({ success: true, message: 'Notiz gelöscht' });
  });
});

// =====================================================================================
// KATEGORIEN
// =====================================================================================

// GET: Alle Fortschritt-Kategorien
router.get('/kategorien', (req, res) => {
  const query = `
    SELECT * FROM fortschritt_kategorien
    WHERE aktiv = TRUE
    ORDER BY reihenfolge
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Kategorien:', err);
      return res.status(500).json({ error: 'Fehler beim Laden' });
    }
    res.json(results);
  });
});

// =====================================================================================
// STATISTIKEN & ÜBERSICHTEN
// =====================================================================================

// GET: Fortschritts-Übersicht eines Mitglieds
router.get('/mitglied/:mitglied_id/overview', (req, res) => {
  const { mitglied_id } = req.params;

  const query = `
    SELECT * FROM mitglied_fortschritt_overview
    WHERE mitglied_id = ?
  `;

  db.query(query, [mitglied_id], (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Übersicht:', err);
      return res.status(500).json({ error: 'Fehler beim Laden' });
    }
    res.json(results[0] || {});
  });
});

module.exports = router;
