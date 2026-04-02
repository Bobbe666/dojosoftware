const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const logger = require('../utils/logger');

const pool = db.promise();

// GET /warteliste/kurs/:kurs_id — Warteliste für einen Kurs
router.get('/kurs/:kurs_id', async (req, res) => {
  const kursId = parseInt(req.params.kurs_id, 10);
  if (isNaN(kursId)) return res.status(400).json({ error: 'Ungültige Kurs-ID' });
  const secureDojoId = getSecureDojoId(req);
  try {
    const [rows] = await pool.query(
      `SELECT w.*, m.vorname, m.nachname, m.email, m.telefon, m.telefon_mobil
       FROM kurs_warteliste w
       JOIN mitglieder m ON w.mitglied_id = m.mitglied_id
       WHERE w.kurs_id = ?
         AND (${ secureDojoId ? 'w.dojo_id = ? AND' : ''} 1=1)
       ORDER BY w.position ASC`,
      secureDojoId ? [kursId, secureDojoId] : [kursId]
    );
    // Kursinformationen
    const [kursRows] = await pool.query(
      'SELECT gruppenname, max_teilnehmer FROM kurse WHERE kurs_id = ?', [kursId]
    );
    res.json({ success: true, warteliste: rows, kurs: kursRows[0] || null });
  } catch (err) {
    logger.error('Fehler beim Laden der Warteliste:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /warteliste/kurs/:kurs_id/anmelden — Mitglied auf Warteliste setzen
router.post('/kurs/:kurs_id/anmelden', async (req, res) => {
  const kursId = parseInt(req.params.kurs_id, 10);
  const { mitglied_id } = req.body;
  if (isNaN(kursId) || !mitglied_id) return res.status(400).json({ error: 'Kurs-ID und Mitglieds-ID erforderlich' });
  const secureDojoId = getSecureDojoId(req);
  try {
    if (secureDojoId) {
      const [check] = await pool.query('SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?', [mitglied_id, secureDojoId]);
      if (!check.length) return res.status(403).json({ error: 'Kein Zugriff' });
    }
    // Prüfen ob bereits auf Liste
    const [existing] = await pool.query('SELECT id FROM kurs_warteliste WHERE kurs_id = ? AND mitglied_id = ? AND status IN (\'wartend\', \'benachrichtigt\')', [kursId, mitglied_id]);
    if (existing.length) return res.status(409).json({ error: 'Mitglied bereits auf der Warteliste' });
    // Nächste Position
    const [posRow] = await pool.query('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM kurs_warteliste WHERE kurs_id = ?', [kursId]);
    const nextPos = posRow[0].next_pos;
    const dojoId = secureDojoId || (await pool.query('SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?', [mitglied_id]))[0][0]?.dojo_id;
    const [result] = await pool.query(
      'INSERT INTO kurs_warteliste (kurs_id, mitglied_id, dojo_id, position, status) VALUES (?, ?, ?, ?, \'wartend\')',
      [kursId, mitglied_id, dojoId, nextPos]
    );
    res.json({ success: true, id: result.insertId, position: nextPos });
  } catch (err) {
    logger.error('Fehler beim Anmelden auf Warteliste:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /warteliste/:id/status — Status aktualisieren (benachrichtigt/eingeschrieben/abgebrochen)
router.put('/:id/status', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  const validStatus = ['wartend', 'benachrichtigt', 'eingeschrieben', 'abgebrochen'];
  if (!validStatus.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });
  const secureDojoId = getSecureDojoId(req);
  try {
    const whereExtra = secureDojoId ? ' AND dojo_id = ?' : '';
    const params = secureDojoId ? [status, id, secureDojoId] : [status, id];
    const [result] = await pool.query(`UPDATE kurs_warteliste SET status = ? WHERE id = ?${whereExtra}`, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /warteliste/:id — Von Warteliste entfernen
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const secureDojoId = getSecureDojoId(req);
  try {
    const whereExtra = secureDojoId ? ' AND dojo_id = ?' : '';
    const params = secureDojoId ? [id, secureDojoId] : [id];
    await pool.query(`DELETE FROM kurs_warteliste WHERE id = ?${whereExtra}`, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
