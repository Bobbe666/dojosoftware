const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const crypto = require('crypto');
const pool = db.promise();

// GET /eltern-zugang — Liste aller Eltern-Zugänge (Admin)
router.get('/', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  try {
    const where = secureDojoId ? 'WHERE ez.dojo_id = ?' : '';
    const params = secureDojoId ? [secureDojoId] : [];
    const [rows] = await pool.query(
      `SELECT ez.*, m.vorname, m.nachname
       FROM eltern_zugang ez
       JOIN mitglieder m ON ez.mitglied_id = m.mitglied_id
       ${where}
       ORDER BY ez.erstellt_am DESC`, params
    );
    res.json({ success: true, zugaenge: rows });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// POST /eltern-zugang — Neuen Eltern-Zugang erstellen (Admin)
router.post('/', async (req, res) => {
  const { eltern_email, eltern_name, mitglied_id } = req.body;
  if (!eltern_email || !mitglied_id) {
    return res.status(400).json({ error: 'eltern_email und mitglied_id erforderlich' });
  }
  const secureDojoId = getSecureDojoId(req);
  if (!secureDojoId) return res.status(400).json({ error: 'Dojo-ID erforderlich' });
  const token = crypto.randomBytes(32).toString('hex');
  try {
    const [r] = await pool.query(
      'INSERT INTO eltern_zugang (eltern_email, eltern_name, mitglied_id, dojo_id, token, aktiv) VALUES (?, ?, ?, ?, ?, 1)',
      [eltern_email, eltern_name || null, mitglied_id, secureDojoId, token]
    );
    res.json({ success: true, id: r.insertId, token });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'E-Mail bereits vorhanden' });
    }
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// PUT /eltern-zugang/:id — Zugangsdaten aktualisieren
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { eltern_email, eltern_name, aktiv } = req.body;
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(
      `UPDATE eltern_zugang SET eltern_email=?, eltern_name=?, aktiv=? WHERE id=?${dojoClause}`,
      [eltern_email, eltern_name || null, aktiv !== false ? 1 : 0, id, ...(secureDojoId ? [secureDojoId] : [])]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /eltern-zugang/:id — Zugang deaktivieren/löschen
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(`DELETE FROM eltern_zugang WHERE id=?${dojoClause}`, [id, ...(secureDojoId ? [secureDojoId] : [])]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /eltern-zugang/:id/reset-token — Token erneuern
router.post('/:id/reset-token', async (req, res) => {
  const id = parseInt(req.params.id);
  const secureDojoId = getSecureDojoId(req);
  const newToken = crypto.randomBytes(32).toString('hex');
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(`UPDATE eltern_zugang SET token=? WHERE id=?${dojoClause}`, [newToken, id, ...(secureDojoId ? [secureDojoId] : [])]);
    res.json({ success: true, token: newToken });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
