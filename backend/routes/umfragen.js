// ============================================================
// UMFRAGEN — Plattformweites Umfragetool
// ============================================================
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireSuperAdmin } = require('./admin/shared');
const db = require('../db');
const pool = db.promise();

router.use(authenticateToken);

// ── Pending-Umfragen für Popup (alle authentifizierten User) ──────────────────
// Gibt Umfragen zurück, die der User noch nicht beantwortet hat
router.get('/pending', async (req, res) => {
  const userId = req.user.id || req.user.user_id;
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.titel, u.beschreibung, u.typ, u.ziel_platformen
       FROM umfragen u
       WHERE u.status = 'aktiv'
         AND (u.gueltig_bis IS NULL OR u.gueltig_bis >= CURDATE())
         AND u.id NOT IN (
           SELECT umfrage_id FROM umfrage_antworten WHERE user_id = ?
         )
       ORDER BY u.erstellt_am DESC`,
      [userId]
    );
    res.json({ success: true, umfragen: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Antwort einreichen ────────────────────────────────────────────────────────
router.post('/:id/antwort', async (req, res) => {
  const userId = req.user.id || req.user.user_id;
  const { antwort, kommentar } = req.body;
  try {
    await pool.query(
      `INSERT INTO umfrage_antworten (umfrage_id, user_id, antwort, kommentar)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE antwort = VALUES(antwort), kommentar = VALUES(kommentar), beantwortet_am = NOW()`,
      [req.params.id, userId, antwort || null, kommentar || null]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Super Admin: alle Umfragen abrufen ───────────────────────────────────────
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.*,
              COUNT(DISTINCT a.id) as antworten_gesamt,
              SUM(a.antwort = 'ja') as antworten_ja,
              SUM(a.antwort = 'nein') as antworten_nein
       FROM umfragen u
       LEFT JOIN umfrage_antworten a ON a.umfrage_id = u.id
       GROUP BY u.id
       ORDER BY u.erstellt_am DESC`
    );
    res.json({ success: true, umfragen: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Super Admin: Umfrage erstellen ────────────────────────────────────────────
router.post('/', requireSuperAdmin, async (req, res) => {
  const { titel, beschreibung, typ, status, ziel_platformen, gueltig_bis } = req.body;
  if (!titel) return res.status(400).json({ error: 'Titel erforderlich' });
  const autorId = req.user.id || req.user.user_id;
  try {
    const [r] = await pool.query(
      `INSERT INTO umfragen (titel, beschreibung, typ, status, ziel_platformen, erstellt_von, gueltig_bis)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        titel,
        beschreibung || null,
        typ || 'ja_nein',
        status || 'entwurf',
        JSON.stringify(Array.isArray(ziel_platformen) ? ziel_platformen : ['dojo']),
        autorId,
        gueltig_bis || null,
      ]
    );
    res.json({ success: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Super Admin: Umfrage bearbeiten ──────────────────────────────────────────
router.put('/:id', requireSuperAdmin, async (req, res) => {
  const { titel, beschreibung, typ, status, ziel_platformen, gueltig_bis } = req.body;
  try {
    await pool.query(
      `UPDATE umfragen SET titel=?, beschreibung=?, typ=?, status=?, ziel_platformen=?, gueltig_bis=?
       WHERE id=?`,
      [
        titel,
        beschreibung || null,
        typ || 'ja_nein',
        status || 'entwurf',
        JSON.stringify(Array.isArray(ziel_platformen) ? ziel_platformen : ['dojo']),
        gueltig_bis || null,
        req.params.id,
      ]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Super Admin: Umfrage löschen ─────────────────────────────────────────────
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM umfragen WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Super Admin: Einzelantworten einer Umfrage ───────────────────────────────
router.get('/:id/antworten', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.antwort, a.kommentar, a.beantwortet_am,
              u.vorname, u.nachname, d.dojoname
       FROM umfrage_antworten a
       LEFT JOIN users us ON us.id = a.user_id
       LEFT JOIN mitglieder u ON u.mitglied_id = us.mitglied_id
       LEFT JOIN dojo d ON d.id = u.dojo_id
       WHERE a.umfrage_id = ?
       ORDER BY a.beantwortet_am DESC`,
      [req.params.id]
    );
    res.json({ success: true, antworten: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Dojo-Admin: aktive Umfragen für das eigene Dojo ──────────────────────────
router.get('/dojo/aktiv', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.titel, u.beschreibung, u.typ, u.status, u.gueltig_bis,
              COUNT(DISTINCT a.id) as antworten_gesamt,
              SUM(a.antwort = 'ja') as antworten_ja,
              SUM(a.antwort = 'nein') as antworten_nein
       FROM umfragen u
       LEFT JOIN umfrage_antworten a ON a.umfrage_id = u.id
       WHERE u.status = 'aktiv'
         AND (u.gueltig_bis IS NULL OR u.gueltig_bis >= CURDATE())
       GROUP BY u.id
       ORDER BY u.erstellt_am DESC`
    );
    res.json({ success: true, umfragen: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
