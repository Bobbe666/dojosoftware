const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise ? db.promise() : db;

// POST / — Mitglied meldet sich ab
router.post('/', authenticateToken, async (req, res) => {
  try {
    const mitglied_id = req.user.mitglied_id;
    const dojo_id = req.user.dojo_id;
    if (!mitglied_id) return res.status(403).json({ success: false, error: 'Nur für Mitglieder' });
    const { datum, datum_bis, art, notiz } = req.body;
    if (!datum || !art) return res.status(400).json({ success: false, error: 'datum und art sind Pflichtfelder' });
    const validArten = ['krank', 'abwesend', 'urlaub', 'sonstiges'];
    if (!validArten.includes(art)) return res.status(400).json({ success: false, error: 'Ungültige Art' });
    if (datum_bis && datum_bis < datum) return res.status(400).json({ success: false, error: 'datum_bis muss nach datum liegen' });
    const [result] = await pool.query(
      'INSERT INTO abwesenheiten (mitglied_id, dojo_id, datum, datum_bis, art, notiz) VALUES (?, ?, ?, ?, ?, ?)',
      [mitglied_id, dojo_id, datum, datum_bis || null, art, notiz || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /meine — eigene aktuelle + zukünftige Abwesenheiten
router.get('/meine', authenticateToken, async (req, res) => {
  try {
    const mitglied_id = req.user.mitglied_id;
    if (!mitglied_id) return res.status(403).json({ success: false, error: 'Nur für Mitglieder' });
    const [rows] = await pool.query(
      "SELECT * FROM abwesenheiten WHERE mitglied_id = ? AND COALESCE(datum_bis, datum) >= CURDATE() ORDER BY datum ASC",
      [mitglied_id]
    );
    res.json({ success: true, abwesenheiten: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:id — Abwesenheit stornieren
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const mitglied_id = req.user.mitglied_id;
    const dojo_id = req.user.dojo_id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Ungültige ID' });
    const [[row]] = await pool.query('SELECT * FROM abwesenheiten WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    if (mitglied_id && row.mitglied_id !== mitglied_id) return res.status(403).json({ success: false, error: 'Keine Berechtigung' });
    if (!mitglied_id && row.dojo_id !== dojo_id) return res.status(403).json({ success: false, error: 'Keine Berechtigung' });
    await pool.query('DELETE FROM abwesenheiten WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /heute — today's absent members (for checkin app + admin)
router.get('/heute', authenticateToken, async (req, res) => {
  try {
    const dojo_id = getSecureDojoId(req);
    if (!dojo_id) return res.status(403).json({ success: false, error: 'Kein Dojo' });
    const [rows] = await pool.query(
      `SELECT a.id, a.mitglied_id, a.art, a.notiz, a.datum, a.datum_bis, a.gemeldet_um,
              m.vorname, m.nachname
       FROM abwesenheiten a
       JOIN mitglieder m ON a.mitglied_id = m.mitglied_id
       WHERE a.dojo_id = ? AND CURDATE() BETWEEN a.datum AND COALESCE(a.datum_bis, a.datum)
       ORDER BY a.gemeldet_um DESC`,
      [dojo_id]
    );
    res.json({ success: true, abwesenheiten: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /admin — admin overview for date range
router.get('/admin', authenticateToken, async (req, res) => {
  try {
    const dojo_id = getSecureDojoId(req);
    if (!dojo_id) return res.status(403).json({ success: false, error: 'Kein Dojo' });
    const today = new Date().toISOString().slice(0, 10);
    const { von = today, bis } = req.query;
    const dateBis = bis || von;
    const [rows] = await pool.query(
      `SELECT a.*, m.vorname, m.nachname, m.email
       FROM abwesenheiten a
       JOIN mitglieder m ON a.mitglied_id = m.mitglied_id
       WHERE a.dojo_id = ? AND a.datum <= ? AND COALESCE(a.datum_bis, a.datum) >= ?
       ORDER BY a.datum ASC, a.gemeldet_um DESC`,
      [dojo_id, dateBis, von]
    );
    res.json({ success: true, abwesenheiten: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
