/**
 * Verbandsmitgliedschaften Einstellungen Routes
 * Settings und Konfiguration
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

// GET /einstellungen/alle - Alle Einstellungen abrufen
router.get('/einstellungen/alle', (req, res) => {
  const { kategorie } = req.query;
  let query = 'SELECT * FROM verband_einstellungen';
  const params = [];
  if (kategorie) { query += ' WHERE kategorie = ?'; params.push(kategorie); }
  query += ' ORDER BY kategorie, sortierung';

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    const einstellungen = results.map(e => {
      let value = e.einstellung_value;
      if (e.einstellung_typ === 'number') value = parseFloat(value) || 0;
      else if (e.einstellung_typ === 'boolean') value = value === 'true' || value === '1';
      else if (e.einstellung_typ === 'json') { try { value = JSON.parse(value); } catch (err) { value = []; } }
      return { ...e, einstellung_value: value };
    });
    res.json(einstellungen);
  });
});

// GET /einstellungen-config - Komplette Konfiguration als Key-Value Object
router.get('/einstellungen-config', (req, res) => {
  db.query('SELECT * FROM verband_einstellungen', (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    const config = {};
    results.forEach(e => {
      let value = e.einstellung_value;
      if (e.einstellung_typ === 'number') value = parseFloat(value) || 0;
      else if (e.einstellung_typ === 'boolean') value = value === 'true' || value === '1';
      else if (e.einstellung_typ === 'json') { try { value = JSON.parse(value); } catch (err) { value = []; } }
      config[e.einstellung_key] = value;
    });
    res.json(config);
  });
});

// GET /einstellungen/kategorien - Alle Kategorien abrufen
router.get('/einstellungen/kategorien', (req, res) => {
  db.query('SELECT DISTINCT kategorie FROM verband_einstellungen ORDER BY kategorie', (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    res.json(results.map(r => r.kategorie));
  });
});

// PUT /einstellungen - Mehrere Einstellungen aktualisieren
router.put('/einstellungen', async (req, res) => {
  const { einstellungen } = req.body;
  if (!einstellungen || !Array.isArray(einstellungen)) return res.status(400).json({ error: 'Einstellungen-Array erforderlich' });

  try {
    for (const { key, value } of einstellungen) {
      let valueStr = typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
      await new Promise((resolve, reject) => {
        db.query('UPDATE verband_einstellungen SET einstellung_value = ? WHERE einstellung_key = ?', [valueStr, key], (err) => err ? reject(err) : resolve());
      });
    }
    res.json({ success: true, message: 'Einstellungen aktualisiert' });
  } catch (err) {
    logger.error('Fehler beim Speichern der Einstellungen:', err);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// GET /einstellungen/:key - Einzelne Einstellung abrufen
router.get('/einstellungen/:key', (req, res) => {
  db.query('SELECT * FROM verband_einstellungen WHERE einstellung_key = ?', [req.params.key], (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    if (results.length === 0) return res.status(404).json({ error: 'Einstellung nicht gefunden' });
    const e = results[0];
    let value = e.einstellung_value;
    if (e.einstellung_typ === 'number') value = parseFloat(value) || 0;
    else if (e.einstellung_typ === 'boolean') value = value === 'true' || value === '1';
    else if (e.einstellung_typ === 'json') { try { value = JSON.parse(value); } catch (err) { value = []; } }
    res.json({ ...e, einstellung_value: value });
  });
});

// PUT /einstellungen/:key - Einzelne Einstellung aktualisieren
router.put('/einstellungen/:key', (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'Value erforderlich' });
  let valueStr = typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);

  db.query('UPDATE verband_einstellungen SET einstellung_value = ? WHERE einstellung_key = ?', [valueStr, req.params.key], (err, result) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Einstellung nicht gefunden' });
    res.json({ success: true });
  });
});

// ============================================================================
// MITGLIEDSCHAFTSTYPEN - Konfigurierbare Mitgliedschaftsarten
// ============================================================================

// GET /mitgliedschaftstypen - Alle Mitgliedschaftstypen abrufen
router.get('/mitgliedschaftstypen', (req, res) => {
  const { aktiv, kategorie } = req.query;
  let query = 'SELECT * FROM verband_mitgliedschaftstypen WHERE 1=1';
  const params = [];

  if (aktiv !== undefined) {
    query += ' AND aktiv = ?';
    params.push(aktiv === 'true' || aktiv === '1' ? 1 : 0);
  }
  if (kategorie) {
    query += ' AND kategorie = ?';
    params.push(kategorie);
  }
  query += ' ORDER BY sortierung, name';

  db.query(query, params, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitgliedschaftstypen:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    // Vorteile JSON parsen
    const typen = results.map(typ => ({
      ...typ,
      vorteile: typ.vorteile ? (typeof typ.vorteile === 'string' ? JSON.parse(typ.vorteile) : typ.vorteile) : [],
      preis_brutto: parseFloat((typ.preis_netto * (1 + typ.steuersatz / 100)).toFixed(2)),
      steuerbetrag: parseFloat((typ.preis_netto * typ.steuersatz / 100).toFixed(2))
    }));
    res.json(typen);
  });
});

// GET /mitgliedschaftstypen/:id - Einzelnen Typ abrufen
router.get('/mitgliedschaftstypen/:id(\\d+)', (req, res) => {
  db.query('SELECT * FROM verband_mitgliedschaftstypen WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    if (results.length === 0) return res.status(404).json({ error: 'Mitgliedschaftstyp nicht gefunden' });

    const typ = results[0];
    res.json({
      ...typ,
      vorteile: typ.vorteile ? (typeof typ.vorteile === 'string' ? JSON.parse(typ.vorteile) : typ.vorteile) : [],
      preis_brutto: parseFloat((typ.preis_netto * (1 + typ.steuersatz / 100)).toFixed(2)),
      steuerbetrag: parseFloat((typ.preis_netto * typ.steuersatz / 100).toFixed(2))
    });
  });
});

// POST /mitgliedschaftstypen - Neuen Typ erstellen
router.post('/mitgliedschaftstypen', (req, res) => {
  const {
    code, name, beschreibung, kategorie = 'person',
    preis_netto, steuersatz = 19.00,
    laufzeit_monate = 12, kuendigungsfrist_monate = 3,
    auto_verlaengerung = true, vorteile = [],
    ist_standard = false, aktiv = true, sortierung = 0
  } = req.body;

  if (!code || !name || preis_netto === undefined) {
    return res.status(400).json({ error: 'Code, Name und Preis sind erforderlich' });
  }

  const query = `
    INSERT INTO verband_mitgliedschaftstypen
    (code, name, beschreibung, kategorie, preis_netto, steuersatz,
     laufzeit_monate, kuendigungsfrist_monate, auto_verlaengerung,
     vorteile, ist_standard, aktiv, sortierung)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    code, name, beschreibung, kategorie, preis_netto, steuersatz,
    laufzeit_monate, kuendigungsfrist_monate, auto_verlaengerung ? 1 : 0,
    JSON.stringify(vorteile), ist_standard ? 1 : 0, aktiv ? 1 : 0, sortierung
  ];

  db.query(query, params, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Ein Typ mit diesem Code existiert bereits' });
      }
      logger.error('Fehler beim Erstellen des Mitgliedschaftstyps:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Mitgliedschaftstyp erstellt'
    });
  });
});

// PUT /mitgliedschaftstypen/:id - Typ aktualisieren
router.put('/mitgliedschaftstypen/:id(\\d+)', (req, res) => {
  const { id } = req.params;
  const {
    code, name, beschreibung, kategorie,
    preis_netto, steuersatz,
    laufzeit_monate, kuendigungsfrist_monate,
    auto_verlaengerung, vorteile,
    ist_standard, aktiv, sortierung
  } = req.body;

  // Dynamisch nur geänderte Felder updaten
  const updates = [];
  const params = [];

  if (code !== undefined) { updates.push('code = ?'); params.push(code); }
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (beschreibung !== undefined) { updates.push('beschreibung = ?'); params.push(beschreibung); }
  if (kategorie !== undefined) { updates.push('kategorie = ?'); params.push(kategorie); }
  if (preis_netto !== undefined) { updates.push('preis_netto = ?'); params.push(preis_netto); }
  if (steuersatz !== undefined) { updates.push('steuersatz = ?'); params.push(steuersatz); }
  if (laufzeit_monate !== undefined) { updates.push('laufzeit_monate = ?'); params.push(laufzeit_monate); }
  if (kuendigungsfrist_monate !== undefined) { updates.push('kuendigungsfrist_monate = ?'); params.push(kuendigungsfrist_monate); }
  if (auto_verlaengerung !== undefined) { updates.push('auto_verlaengerung = ?'); params.push(auto_verlaengerung ? 1 : 0); }
  if (vorteile !== undefined) { updates.push('vorteile = ?'); params.push(JSON.stringify(vorteile)); }
  if (ist_standard !== undefined) { updates.push('ist_standard = ?'); params.push(ist_standard ? 1 : 0); }
  if (aktiv !== undefined) { updates.push('aktiv = ?'); params.push(aktiv ? 1 : 0); }
  if (sortierung !== undefined) { updates.push('sortierung = ?'); params.push(sortierung); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Keine Änderungen angegeben' });
  }

  params.push(id);
  const query = `UPDATE verband_mitgliedschaftstypen SET ${updates.join(', ')} WHERE id = ?`;

  db.query(query, params, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Ein Typ mit diesem Code existiert bereits' });
      }
      logger.error('Fehler beim Aktualisieren des Mitgliedschaftstyps:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mitgliedschaftstyp nicht gefunden' });
    }
    res.json({ success: true, message: 'Mitgliedschaftstyp aktualisiert' });
  });
});

// DELETE /mitgliedschaftstypen/:id - Typ löschen
router.delete('/mitgliedschaftstypen/:id(\\d+)', async (req, res) => {
  const { id } = req.params;

  try {
    // Prüfen ob Mitgliedschaften diesen Typ verwenden
    const [usage] = await db.promise().query(
      `SELECT COUNT(*) as count FROM verbandsmitgliedschaften vm
       JOIN verband_mitgliedschaftstypen vt ON vm.typ = vt.code
       WHERE vt.id = ?`,
      [id]
    );

    if (usage[0].count > 0) {
      return res.status(400).json({
        error: 'Dieser Typ wird noch verwendet und kann nicht gelöscht werden',
        verwendungen: usage[0].count
      });
    }

    const [result] = await db.promise().query(
      'DELETE FROM verband_mitgliedschaftstypen WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mitgliedschaftstyp nicht gefunden' });
    }

    res.json({ success: true, message: 'Mitgliedschaftstyp gelöscht' });
  } catch (err) {
    logger.error('Fehler beim Löschen des Mitgliedschaftstyps:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /mitgliedschaftstypen/:id/toggle-aktiv - Aktiv-Status umschalten
router.post('/mitgliedschaftstypen/:id(\\d+)/toggle-aktiv', (req, res) => {
  const { id } = req.params;

  db.query(
    'UPDATE verband_mitgliedschaftstypen SET aktiv = NOT aktiv WHERE id = ?',
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Nicht gefunden' });
      res.json({ success: true });
    }
  );
});

// ============================================================================
// VORTEILE / RABATTE - Konfigurierbare Mitgliedschaftsvorteile
// ============================================================================

// GET /vorteile - Alle Vorteile abrufen
router.get('/vorteile', (req, res) => {
  const { aktiv, gilt_fuer, kategorie } = req.query;
  let query = 'SELECT * FROM verband_vorteile WHERE 1=1';
  const params = [];

  if (aktiv !== undefined) {
    query += ' AND aktiv = ?';
    params.push(aktiv === 'true' || aktiv === '1' ? 1 : 0);
  }
  if (gilt_fuer) {
    query += ' AND (gilt_fuer = ? OR gilt_fuer = "beide")';
    params.push(gilt_fuer);
  }
  if (kategorie) {
    query += ' AND kategorie = ?';
    params.push(kategorie);
  }
  query += ' ORDER BY kategorie, titel';

  db.query(query, params, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Vorteile:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json(results);
  });
});

// GET /vorteile/kategorien - Alle Vorteil-Kategorien
router.get('/vorteile/kategorien', (req, res) => {
  db.query('SELECT DISTINCT kategorie FROM verband_vorteile ORDER BY kategorie', (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    res.json(results.map(r => r.kategorie));
  });
});

// GET /vorteile/:id - Einzelnen Vorteil abrufen
router.get('/vorteile/:id(\\d+)', (req, res) => {
  db.query('SELECT * FROM verband_vorteile WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    if (results.length === 0) return res.status(404).json({ error: 'Vorteil nicht gefunden' });
    res.json(results[0]);
  });
});

// POST /vorteile - Neuen Vorteil erstellen
router.post('/vorteile', (req, res) => {
  const {
    titel, beschreibung, gilt_fuer = 'beide',
    rabatt_typ = 'prozent', rabatt_wert = 0,
    kategorie = 'sonstige', aktiv = true
  } = req.body;

  if (!titel) {
    return res.status(400).json({ error: 'Titel ist erforderlich' });
  }

  const query = `
    INSERT INTO verband_vorteile
    (titel, beschreibung, gilt_fuer, rabatt_typ, rabatt_wert, kategorie, aktiv)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [titel, beschreibung, gilt_fuer, rabatt_typ, rabatt_wert, kategorie, aktiv ? 1 : 0];

  db.query(query, params, (err, result) => {
    if (err) {
      logger.error('Fehler beim Erstellen des Vorteils:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Vorteil erstellt'
    });
  });
});

// PUT /vorteile/:id - Vorteil aktualisieren
router.put('/vorteile/:id(\\d+)', (req, res) => {
  const { id } = req.params;
  const { titel, beschreibung, gilt_fuer, rabatt_typ, rabatt_wert, kategorie, aktiv } = req.body;

  const updates = [];
  const params = [];

  if (titel !== undefined) { updates.push('titel = ?'); params.push(titel); }
  if (beschreibung !== undefined) { updates.push('beschreibung = ?'); params.push(beschreibung); }
  if (gilt_fuer !== undefined) { updates.push('gilt_fuer = ?'); params.push(gilt_fuer); }
  if (rabatt_typ !== undefined) { updates.push('rabatt_typ = ?'); params.push(rabatt_typ); }
  if (rabatt_wert !== undefined) { updates.push('rabatt_wert = ?'); params.push(rabatt_wert); }
  if (kategorie !== undefined) { updates.push('kategorie = ?'); params.push(kategorie); }
  if (aktiv !== undefined) { updates.push('aktiv = ?'); params.push(aktiv ? 1 : 0); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Keine Änderungen angegeben' });
  }

  params.push(id);
  const query = `UPDATE verband_vorteile SET ${updates.join(', ')} WHERE id = ?`;

  db.query(query, params, (err, result) => {
    if (err) {
      logger.error('Fehler beim Aktualisieren des Vorteils:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vorteil nicht gefunden' });
    }
    res.json({ success: true, message: 'Vorteil aktualisiert' });
  });
});

// DELETE /vorteile/:id - Vorteil löschen
router.delete('/vorteile/:id(\\d+)', (req, res) => {
  db.query('DELETE FROM verband_vorteile WHERE id = ?', [req.params.id], (err, result) => {
    if (err) {
      logger.error('Fehler beim Löschen des Vorteils:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vorteil nicht gefunden' });
    }
    res.json({ success: true, message: 'Vorteil gelöscht' });
  });
});

// POST /vorteile/:id/toggle-aktiv - Aktiv-Status umschalten
router.post('/vorteile/:id(\\d+)/toggle-aktiv', (req, res) => {
  db.query(
    'UPDATE verband_vorteile SET aktiv = NOT aktiv WHERE id = ?',
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Nicht gefunden' });
      res.json({ success: true });
    }
  );
});

module.exports = router;
