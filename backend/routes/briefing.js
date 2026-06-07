// ============================================================================
// TÄGLICHES BRIEFING — API für das "Dein Tag"-Popup (Super-Admin)
// GET /api/briefing — aggregierte Übersicht (To-Dos, Termine, Neues)
// ============================================================================
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { buildBriefing, syncEventChecklisten } = require('../services/briefingService');

const pool = db.promise();

// Super-Admin Guard (wie demo-termine.js)
function onlySuperAdmin(req, res, next) {
  const role = req.user?.rolle;
  const isSuperAdmin = role === 'super_admin' || (!req.user?.dojo_id && role === 'admin');
  if (!isSuperAdmin) return res.status(403).json({ success: false, error: 'Nur Super-Admin' });
  next();
}

// GET /api/briefing — Tagesübersicht für das Popup
router.get('/', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const briefing = await buildBriefing();
    res.json({ success: true, briefing });
  } catch (err) {
    console.error('[Briefing] Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Briefing konnte nicht geladen werden.' });
  }
});

// POST /api/briefing/todo/:id/status — To-Do aus der Heute-Ansicht abhaken/öffnen
// (gezieltes Status-Update; PUT /api/todos/:id überschreibt ALLE Felder)
router.post('/todo/:id(\\d+)/status', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['offen', 'in_bearbeitung', 'erledigt'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Ungültiger Status' });
    }
    const [result] = await pool.query('UPDATE todos SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'To-Do nicht gefunden' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/briefing/sync-checklisten — Event-Checklisten manuell anstoßen
router.post('/sync-checklisten', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const r = await syncEventChecklisten();
    res.json({ success: true, ...r });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
