const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

// GET /trainer-stunden -- Stundennachweise laden
router.get('/', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { trainer_id, monat, jahr } = req.query;
  try {
    let conds = [];
    let params = [];
    if (secureDojoId) { conds.push('ts.dojo_id = ?'); params.push(secureDojoId); }
    if (trainer_id) { conds.push('ts.trainer_id = ?'); params.push(parseInt(trainer_id, 10)); }
    if (monat && jahr) {
      conds.push('MONTH(ts.datum) = ? AND YEAR(ts.datum) = ?');
      params.push(parseInt(monat, 10), parseInt(jahr, 10));
    } else if (jahr) {
      conds.push('YEAR(ts.datum) = ?');
      params.push(parseInt(jahr, 10));
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const [rows] = await pool.query(
      ,
      params
    );
    res.json({ success: true, stunden: rows });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// GET /trainer-stunden/summary -- Monatsübersicht aller Trainer
router.get('/summary', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { monat, jahr } = req.query;
  const m = parseInt(monat, 10) || new Date().getMonth() + 1;
  const y = parseInt(jahr, 10) || new Date().getFullYear();
  if (!secureDojoId) return res.status(400).json({ error: 'Dojo-ID erforderlich' });
  try {
    const [rows] = await pool.query(
      ,
      [m, y, secureDojoId, secureDojoId]
    );
    res.json({ success: true, summary: rows, monat: m, jahr: y });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /trainer-stunden -- Neue Einheit erfassen
router.post('/', async (req, res) => {
  const { trainer_id, kurs_id, datum, stunden, status, notiz } = req.body;
  if (!trainer_id || !datum) return res.status(400).json({ error: 'trainer_id und datum erforderlich' });
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoId = secureDojoId || (await pool.query('SELECT dojo_id FROM trainer WHERE trainer_id = ?', [trainer_id]))[0][0]?.dojo_id;
    const [result] = await pool.query(
      'INSERT INTO trainer_stunden (trainer_id, kurs_id, dojo_id, datum, stunden, status, notiz) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [trainer_id, kurs_id || null, dojoId, datum, parseFloat(stunden) || 1.0, status || 'geplant', notiz || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /trainer-stunden/:id -- Status/Details aktualisieren
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { stunden, status, notiz } = req.body;
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    const params = [parseFloat(stunden) || 1.0, status || 'geplant', notiz || null, id, ...(secureDojoId ? [secureDojoId] : [])];
    const [r] = await pool.query(, params);
    if (!r.affectedRows) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /trainer-stunden/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(, [id, ...(secureDojoId ? [secureDojoId] : [])]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
