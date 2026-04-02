/**
 * textbausteine.js
 * =================
 * Wiederverwendbare HTML-Textblöcke für Briefvorlagen und E-Mails.
 * CRUD pro Dojo — vollständige Multi-Tenant-Isolation via getSecureDojoId.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

router.use(authenticateToken);

const pool = db.promise();

// ── GET / — alle Textbausteine des Dojos ──────────────────────────────────────
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { kategorie } = req.query;
  // System-Bausteine (dojo_id=0, system_vorlage=1) + eigene Bausteine des Dojos
  const params = [dojoId];
  let sql = 'SELECT * FROM textbausteine WHERE (dojo_id = ? OR system_vorlage = 1) ORDER BY system_vorlage ASC, kategorie, name';
  if (kategorie) {
    sql = 'SELECT * FROM textbausteine WHERE (dojo_id = ? OR system_vorlage = 1) AND kategorie = ? ORDER BY system_vorlage ASC, name';
    params.push(kategorie);
  }

  try {
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, textbausteine: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden: ' + err.message });
  }
});

// ── POST / — neuen Textbaustein anlegen ───────────────────────────────────────
router.post('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { name, kategorie = null, inhalt_html = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name ist Pflichtfeld' });

  try {
    const [result] = await pool.query(
      'INSERT INTO textbausteine (dojo_id, name, kategorie, inhalt_html) VALUES (?, ?, ?, ?)',
      [dojoId, name.trim(), kategorie || null, inhalt_html || '']
    );
    const [[row]] = await pool.query('SELECT * FROM textbausteine WHERE id = ?', [result.insertId]);
    res.json({ success: true, textbaustein: row });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Erstellen: ' + err.message });
  }
});

// ── PUT /:id — Textbaustein bearbeiten ────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { name, kategorie, inhalt_html } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name ist Pflichtfeld' });

  try {
    const [result] = await pool.query(
      'UPDATE textbausteine SET name = ?, kategorie = ?, inhalt_html = ? WHERE id = ? AND dojo_id = ?',
      [name.trim(), kategorie || null, inhalt_html || '', req.params.id, dojoId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Textbaustein nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren: ' + err.message });
  }
});

// ── DELETE /:id — Textbaustein löschen ───────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [result] = await pool.query(
      'DELETE FROM textbausteine WHERE id = ? AND dojo_id = ?',
      [req.params.id, dojoId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen: ' + err.message });
  }
});

module.exports = router;
