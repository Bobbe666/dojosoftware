// ============================================================================
// TÄGLICHES BRIEFING — API für das "Dein Tag"-Popup (Super-Admin)
// GET /api/briefing — aggregierte Übersicht (To-Dos, Termine, Neues)
// ============================================================================
const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { buildBriefing, syncEventChecklisten } = require('../services/briefingService');

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
