const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const pool = db.promise();

// GET /vertretung?datum=&kurs_id= — Vertretungsanfragen
router.get('/', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { kurs_id, status } = req.query;
  try {
    let conds = secureDojoId ? ['va.dojo_id = ?'] : [];
    let params = secureDojoId ? [secureDojoId] : [];
    if (kurs_id) { conds.push('va.kurs_id = ?'); params.push(parseInt(kurs_id)); }
    if (status) { conds.push('va.status = ?'); params.push(status); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const [rows] = await pool.query(
      `SELECT va.*,
        ot.vorname AS orig_vorname, ot.nachname AS orig_nachname,
        vt.vorname AS vert_vorname, vt.nachname AS vert_nachname,
        k.gruppenname AS kursname
       FROM vertretung_anfragen va
       LEFT JOIN trainer ot ON va.original_trainer_id = ot.trainer_id
       LEFT JOIN trainer vt ON va.vertretung_trainer_id = vt.trainer_id
       LEFT JOIN kurse k ON va.kurs_id = k.kurs_id
       ${where}
       ORDER BY va.datum DESC`, params
    );
    res.json({ success: true, anfragen: rows });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// POST /vertretung — Neue Vertretungsanfrage
router.post('/', async (req, res) => {
  const { kurs_id, original_trainer_id, vertretung_trainer_id, datum, grund } = req.body;
  if (!kurs_id || !original_trainer_id || !datum) return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoId = secureDojoId || (await pool.query('SELECT dojo_id FROM kurse WHERE kurs_id = ?', [kurs_id]))[0][0]?.dojo_id;
    const [r] = await pool.query(
      'INSERT INTO vertretung_anfragen (kurs_id, original_trainer_id, vertretung_trainer_id, dojo_id, datum, grund, status) VALUES (?, ?, ?, ?, ?, ?, \'offen\')',
      [kurs_id, original_trainer_id, vertretung_trainer_id || null, dojoId, datum, grund || null]
    );
    res.json({ success: true, id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// PUT /vertretung/:id — Status/Vertretung aktualisieren
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, vertretung_trainer_id } = req.body;
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    const params = [status, vertretung_trainer_id || null, new Date(), id, ...(secureDojoId ? [secureDojoId] : [])];
    await pool.query(`UPDATE vertretung_anfragen SET status=?, vertretung_trainer_id=?, beantwortet_am=? WHERE id=?${dojoClause}`, params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// DELETE /vertretung/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(`DELETE FROM vertretung_anfragen WHERE id=?${dojoClause}`, [id, ...(secureDojoId ? [secureDojoId] : [])]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

module.exports = router;
