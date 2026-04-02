// Backend/routes/laufzeiten.js - Laufzeiten Verwaltung
const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

const DEFAULT_LAUFZEITEN = [
  { name: '1 Monat', monate: 1, beschreibung: 'Kurze Laufzeit - 1 Monat' },
  { name: '3 Monate', monate: 3, beschreibung: 'Mittlere Laufzeit - 3 Monate' },
  { name: '6 Monate', monate: 6, beschreibung: 'Längere Laufzeit - 6 Monate' },
  { name: '12 Monate', monate: 12, beschreibung: 'Jahresvertrag - 12 Monate' }
];

async function initForDojo(dojoId) {
  const [existing] = await pool.query(
    'SELECT COUNT(*) as count FROM laufzeiten WHERE dojo_id = ? OR dojo_id IS NULL',
    [dojoId]
  );
  if (existing[0].count === 0) {
    for (const l of DEFAULT_LAUFZEITEN) {
      await pool.query(
        'INSERT INTO laufzeiten (dojo_id, name, monate, beschreibung, aktiv) VALUES (?, ?, ?, ?, 1)',
        [dojoId, l.name, l.monate, l.beschreibung]
      );
    }
  }
}

// GET /api/laufzeiten - Laufzeiten des Dojos (+ globale NULL-Defaults)
router.get('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    let data;
    if (dojoId) {
      await initForDojo(dojoId);
      const [rows] = await pool.query(
        'SELECT * FROM laufzeiten WHERE (dojo_id = ? OR dojo_id IS NULL) ORDER BY monate ASC',
        [dojoId]
      );
      data = rows;
    } else {
      const [rows] = await pool.query('SELECT * FROM laufzeiten ORDER BY dojo_id, monate ASC');
      data = rows;
    }
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Fehler beim Abrufen der Laufzeiten:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// POST /api/laufzeiten - Neue Laufzeit erstellen
router.post('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
    const { name, monate, beschreibung, aktiv } = req.body;
    const [result] = await pool.query(
      'INSERT INTO laufzeiten (dojo_id, name, monate, beschreibung, aktiv) VALUES (?, ?, ?, ?, ?)',
      [dojoId, name, monate, beschreibung || '', aktiv !== undefined ? aktiv : true]
    );
    res.json({ success: true, data: { laufzeit_id: result.insertId, dojo_id: dojoId, name, monate, beschreibung: beschreibung || '', aktiv: aktiv !== undefined ? aktiv : true } });
  } catch (err) {
    logger.error('Fehler beim Erstellen der Laufzeit:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// PUT /api/laufzeiten/:id - Laufzeit aktualisieren (nur eigener Dojo)
router.put('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
    const { name, monate, beschreibung, aktiv } = req.body;
    const [result] = await pool.query(
      'UPDATE laufzeiten SET name = ?, monate = ?, beschreibung = ?, aktiv = ? WHERE laufzeit_id = ? AND dojo_id = ?',
      [name, monate, beschreibung || '', aktiv, req.params.id, dojoId]
    );
    if (!result.affectedRows) return res.status(403).json({ error: 'Nicht gefunden oder kein Zugriff' });
    res.json({ success: true, message: 'Laufzeit erfolgreich aktualisiert' });
  } catch (err) {
    logger.error('Fehler beim Aktualisieren der Laufzeit:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// DELETE /api/laufzeiten/:id - Laufzeit löschen (nur eigener Dojo)
router.delete('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
    const [tarife] = await pool.query('SELECT COUNT(*) as count FROM tarife WHERE laufzeit_id = ?', [req.params.id]);
    if (tarife[0].count > 0) return res.status(400).json({ error: 'Laufzeit wird noch von Tarifen verwendet.' });
    const [result] = await pool.query(
      'DELETE FROM laufzeiten WHERE laufzeit_id = ? AND dojo_id = ?',
      [req.params.id, dojoId]
    );
    if (!result.affectedRows) return res.status(403).json({ error: 'Nicht gefunden oder kein Zugriff' });
    res.json({ success: true, message: 'Laufzeit erfolgreich gelöscht' });
  } catch (err) {
    logger.error('Fehler beim Löschen der Laufzeit:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

module.exports = router;
