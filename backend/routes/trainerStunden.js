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
    if (trainer_id)   { conds.push('ts.trainer_id = ?'); params.push(parseInt(trainer_id, 10)); }
    if (monat && jahr) {
      conds.push('MONTH(ts.datum) = ? AND YEAR(ts.datum) = ?');
      params.push(parseInt(monat, 10), parseInt(jahr, 10));
    } else if (jahr) {
      conds.push('YEAR(ts.datum) = ?');
      params.push(parseInt(jahr, 10));
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const [rows] = await pool.query(
      `SELECT ts.*, t.vorname, t.nachname, k.gruppenname
       FROM trainer_stunden ts
       JOIN trainer t ON t.trainer_id = ts.trainer_id
       LEFT JOIN kurse k ON k.kurs_id = ts.kurs_id
       ${where}
       ORDER BY ts.datum DESC`,
      params
    );
    res.json({ success: true, stunden: rows });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// GET /trainer-stunden/summary -- Monatsübersicht aller Trainer mit Stundenlohn-Berechnung
router.get('/summary', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { monat, jahr } = req.query;
  const m = parseInt(monat, 10) || new Date().getMonth() + 1;
  const y = parseInt(jahr, 10)  || new Date().getFullYear();
  if (!secureDojoId) return res.status(400).json({ error: 'Dojo-ID erforderlich' });
  try {
    const [rows] = await pool.query(
      `SELECT
         t.trainer_id,
         t.vorname,
         t.nachname,
         t.email,
         COALESCE(t.stundenlohn, 0)        AS stundenlohn,
         COALESCE(t.grundverguetung, 0)    AS grundverguetung,
         COALESCE(t.beschaeftigungsart, 'Freelancer') AS beschaeftigungsart,
         COUNT(ts.id)                      AS anzahl_einheiten,
         COALESCE(SUM(ts.stunden), 0)      AS total_stunden,
         ROUND(COALESCE(SUM(ts.stunden), 0) * COALESCE(t.stundenlohn, 0), 2) AS berechnet_lohn,
         GROUP_CONCAT(DISTINCT k.gruppenname ORDER BY k.gruppenname SEPARATOR ', ') AS kurse
       FROM trainer t
       LEFT JOIN trainer_stunden ts ON ts.trainer_id = t.trainer_id
         AND MONTH(ts.datum) = ? AND YEAR(ts.datum) = ? AND ts.dojo_id = ?
       LEFT JOIN kurse k ON k.kurs_id = ts.kurs_id
       WHERE t.dojo_id = ?
       GROUP BY t.trainer_id, t.vorname, t.nachname, t.email,
                t.stundenlohn, t.grundverguetung, t.beschaeftigungsart
       ORDER BY t.nachname, t.vorname`,
      [m, y, secureDojoId, secureDojoId]
    );
    res.json({ success: true, summary: rows, monat: m, jahr: y });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// GET /trainer-stunden/verlauf/:trainer_id -- Jahresverlauf eines Trainers
router.get('/verlauf/:trainer_id', async (req, res) => {
  const trainer_id = parseInt(req.params.trainer_id, 10);
  const secureDojoId = getSecureDojoId(req);
  const { jahr } = req.query;
  const y = parseInt(jahr, 10) || new Date().getFullYear();
  try {
    const dojoClause = secureDojoId ? 'AND ts.dojo_id = ?' : '';
    const params = [trainer_id, y, ...(secureDojoId ? [secureDojoId] : [])];
    const [rows] = await pool.query(
      `SELECT
         MONTH(ts.datum)                   AS monat,
         COUNT(ts.id)                      AS anzahl_einheiten,
         SUM(ts.stunden)                   AS total_stunden,
         ROUND(SUM(ts.stunden) * COALESCE(t.stundenlohn, 0), 2) AS berechnet_lohn
       FROM trainer_stunden ts
       JOIN trainer t ON t.trainer_id = ts.trainer_id
       WHERE ts.trainer_id = ? AND YEAR(ts.datum) = ? ${dojoClause}
       GROUP BY MONTH(ts.datum)
       ORDER BY monat ASC`,
      params
    );
    res.json({ success: true, data: rows, trainer_id, jahr: y });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
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
      [trainer_id, kurs_id || null, dojoId, datum, parseFloat(stunden) || 1.0, status || 'bestaetigt', notiz || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// PUT /trainer-stunden/:id -- Status/Details aktualisieren
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { stunden, status, notiz } = req.body;
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    const params = [parseFloat(stunden) || 1.0, status || 'bestaetigt', notiz || null, id, ...(secureDojoId ? [secureDojoId] : [])];
    const [r] = await pool.query(
      `UPDATE trainer_stunden SET stunden = ?, status = ?, notiz = ? WHERE id = ?${dojoClause}`,
      params
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// DELETE /trainer-stunden/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(`DELETE FROM trainer_stunden WHERE id = ?${dojoClause}`, [id, ...(secureDojoId ? [secureDojoId] : [])]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

module.exports = router;
