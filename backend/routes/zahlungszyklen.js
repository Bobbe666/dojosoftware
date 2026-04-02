// Backend/routes/zahlungszyklen.js - Zahlungsintervalle Verwaltung
const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

// Standard-Zahlungszyklen (bei neuen Dojos initialisiert)
const DEFAULT_CYCLES = [
  { name: 'Täglich', intervall_tage: 1, beschreibung: 'Tägliche Zahlung' },
  { name: 'Wöchentlich', intervall_tage: 7, beschreibung: 'Wöchentliche Zahlung' },
  { name: '14-tägig', intervall_tage: 14, beschreibung: '14-tägige Zahlung' },
  { name: 'Monatlich', intervall_tage: 30, beschreibung: 'Monatliche Zahlung' },
  { name: 'Vierteljährlich', intervall_tage: 90, beschreibung: 'Vierteljährliche Zahlung (3 Monate)' },
  { name: 'Halbjährlich', intervall_tage: 180, beschreibung: 'Halbjährliche Zahlung (6 Monate)' },
  { name: 'Jährlich', intervall_tage: 365, beschreibung: 'Jährliche Zahlung' }
];

async function initForDojo(dojoId) {
  const [existing] = await pool.query(
    'SELECT COUNT(*) as count FROM zahlungszyklen WHERE dojo_id = ? OR dojo_id IS NULL',
    [dojoId]
  );
  if (existing[0].count === 0) {
    for (const c of DEFAULT_CYCLES) {
      await pool.query(
        'INSERT INTO zahlungszyklen (dojo_id, name, intervall_tage, beschreibung, aktiv) VALUES (?, ?, ?, ?, 1)',
        [dojoId, c.name, c.intervall_tage, c.beschreibung]
      );
    }
  }
}

// GET /api/zahlungszyklen - Zahlungszyklen des Dojos (+ globale NULL-Defaults)
router.get('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    let data;
    if (dojoId) {
      await initForDojo(dojoId);
      const [rows] = await pool.query(
        'SELECT * FROM zahlungszyklen WHERE (dojo_id = ? OR dojo_id IS NULL) ORDER BY intervall_tage ASC',
        [dojoId]
      );
      data = rows;
    } else {
      // Super-Admin: alle
      const [rows] = await pool.query('SELECT * FROM zahlungszyklen ORDER BY dojo_id, intervall_tage ASC');
      data = rows;
    }
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Fehler beim Abrufen der Zahlungszyklen:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// POST /api/zahlungszyklen - Neuen Zahlungszyklus erstellen
router.post('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
    const { name, intervall_tage, beschreibung, aktiv } = req.body;
    const [result] = await pool.query(
      'INSERT INTO zahlungszyklen (dojo_id, name, intervall_tage, beschreibung, aktiv) VALUES (?, ?, ?, ?, ?)',
      [dojoId, name, intervall_tage, beschreibung || '', aktiv !== undefined ? aktiv : true]
    );
    res.json({ success: true, data: { zyklus_id: result.insertId, dojo_id: dojoId, name, intervall_tage, beschreibung: beschreibung || '', aktiv: aktiv !== undefined ? aktiv : true } });
  } catch (err) {
    logger.error('Fehler beim Erstellen des Zahlungszyklus:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// PUT /api/zahlungszyklen/:id - Zahlungszyklus aktualisieren (nur eigener Dojo)
router.put('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
    const { name, intervall_tage, beschreibung, aktiv } = req.body;
    const [result] = await pool.query(
      'UPDATE zahlungszyklen SET name = ?, intervall_tage = ?, beschreibung = ?, aktiv = ? WHERE zyklus_id = ? AND dojo_id = ?',
      [name, intervall_tage, beschreibung || '', aktiv, req.params.id, dojoId]
    );
    if (!result.affectedRows) return res.status(403).json({ error: 'Nicht gefunden oder kein Zugriff' });
    res.json({ success: true, message: 'Zahlungszyklus erfolgreich aktualisiert' });
  } catch (err) {
    logger.error('Fehler beim Aktualisieren des Zahlungszyklus:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// DELETE /api/zahlungszyklen/:id - Zahlungszyklus löschen (nur eigener Dojo)
router.delete('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
    const [tarife] = await pool.query('SELECT COUNT(*) as count FROM tarife WHERE zahlungszyklus_id = ?', [req.params.id]);
    if (tarife[0].count > 0) return res.status(400).json({ error: 'Zahlungszyklus wird noch von Tarifen verwendet.' });
    const [result] = await pool.query(
      'DELETE FROM zahlungszyklen WHERE zyklus_id = ? AND dojo_id = ?',
      [req.params.id, dojoId]
    );
    if (!result.affectedRows) return res.status(403).json({ error: 'Nicht gefunden oder kein Zugriff' });
    res.json({ success: true, message: 'Zahlungszyklus erfolgreich gelöscht' });
  } catch (err) {
    logger.error('Fehler beim Löschen des Zahlungszyklus:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

module.exports = router;
