// ============================================================================
// COACH-APP (Enterprise Trainer-App, coach.tda-intl.org)
// Bootstrap-Endpunkt: prüft Zugang (Rolle + Enterprise-Feature) und liefert das
// White-Label-Branding des Dojos (Name, Logo, Primärfarbe).
// Auto-gemountet unter /api/coach.
// ============================================================================
const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const pool = db.promise();
const COACH_ROLES = ['trainer', 'supervisor', 'admin', 'super_admin'];

// Primärfarbe aus dem (JSON-)theme_config eines Dojos herausziehen — tolerant
// gegen verschiedene Schlüssel/Strukturen, sonst null (App nimmt Default-Rot).
function pickPrimary(themeConfig) {
  if (!themeConfig) return null;
  let c = themeConfig;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return null; } }
  return c.primary || c.accent || c['--accent'] || c.primaryColor
      || c?.colors?.primary || c?.colors?.accent || c?.tokens?.['--accent'] || null;
}

// GET /api/coach/bootstrap — Gate + Branding für die Coach-App
router.get('/bootstrap', authenticateToken, async (req, res) => {
  try {
    const role = req.user?.role || req.user?.rolle;
    if (!COACH_ROLES.includes(role)) {
      return res.status(403).json({ error: 'Kein Coach-Zugang für diese Rolle.' });
    }

    const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
    const isSuper = userId == 1 || req.user?.username === 'admin';
    const isAdmin = ['admin', 'super_admin'].includes(role);
    let dojoId = req.user?.dojo_id || (req.query.dojo_id ? parseInt(req.query.dojo_id) : null);
    if (!dojoId) dojoId = 3; // Super-Admin ohne Dojo-Kontext → Default (Schreiner)

    // Enterprise-Gate: Admins/Super-Admin immer; Trainer nur wenn Dojo freigeschaltet
    if (!isAdmin && !isSuper) {
      let enabled = false;
      try {
        const [[sub]] = await pool.query(
          'SELECT feature_trainer_app FROM dojo_subscriptions WHERE dojo_id = ?', [dojoId]
        );
        enabled = !!sub && (sub.feature_trainer_app === 1 || sub.feature_trainer_app === true);
      } catch (_) { enabled = false; }
      if (!enabled) {
        return res.status(403).json({ error: 'Die Coach-App ist für dein Dojo nicht freigeschaltet.' });
      }
    }

    const [[d]] = await pool.query('SELECT id, dojoname FROM dojo WHERE id = ?', [dojoId]);
    const [logoRows] = await pool.query(
      "SELECT file_path FROM dojo_logos WHERE dojo_id = ? AND logo_type = 'haupt' LIMIT 1", [dojoId]
    );
    const [themeRows] = await pool.query(
      'SELECT theme_config FROM dojo_theme WHERE dojo_id = ? LIMIT 1', [dojoId]
    );

    const logoPath = logoRows[0]?.file_path;
    const dojo = {
      id: dojoId,
      name: d?.dojoname || 'Dojo',
      logo: logoPath ? `/uploads/logos/${path.basename(logoPath)}` : null,
      primary_color: pickPrimary(themeRows[0]?.theme_config),
    };

    res.json({
      success: true,
      dojo,
      user: { role, vorname: req.user?.vorname || null, nachname: req.user?.nachname || null },
    });
  } catch (e) {
    logger.error('coach/bootstrap Fehler', { error: e.message });
    res.status(500).json({ error: 'Bootstrap fehlgeschlagen.' });
  }
});

module.exports = router;
