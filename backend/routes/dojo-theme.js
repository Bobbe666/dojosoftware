/**
 * routes/dojo-theme.js
 * Design-/Theme-Einstellungen pro Dojo (White-Label).
 *   GET    /api/dojo-theme          → Theme des aktiven Dojos (auth)
 *   PUT    /api/dojo-theme          → Theme des aktiven Dojos speichern (auth, Upsert)
 *   DELETE /api/dojo-theme          → Theme zurücksetzen (auth)
 *   GET    /api/dojo-theme/public   → Theme per Subdomain (ohne Login, fürs Portal-Branding)
 */

const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const { cacheGet } = require('../utils/simpleCache');

const router = express.Router();
const pool = db.promise();

let logger; try { logger = require('../utils/logger'); } catch { logger = console; }

// theme_config kann je nach Treiber String oder Objekt sein → robust parsen
function parseConfig(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── ÖFFENTLICH: Theme per Subdomain (vor Login, fürs Branding) ──
// MUSS vor evtl. generischen Routen stehen; nutzt keinen Auth.
router.get('/public', async (req, res) => {
  try {
    const subdomain = req.headers['x-tenant-subdomain'] || req.query.subdomain;
    if (!subdomain) return res.json({ success: true, theme: null });

    const [[row]] = await pool.query(
      `SELECT t.theme_config
         FROM dojo_theme t
         JOIN dojo d ON d.id = t.dojo_id
        WHERE d.subdomain = ? AND d.ist_aktiv = 1
        LIMIT 1`,
      [subdomain]
    ).catch(async () => {
      // Fallback falls Spalte ist_aktiv nicht existiert
      return pool.query(
        `SELECT t.theme_config FROM dojo_theme t
           JOIN dojo d ON d.id = t.dojo_id
          WHERE d.subdomain = ? LIMIT 1`, [subdomain]);
    });

    res.json({ success: true, theme: row ? parseConfig(row.theme_config) : null });
  } catch (err) {
    logger.error?.('[dojo-theme] public Fehler:', err.message);
    res.json({ success: true, theme: null }); // niemals das Portal blockieren
  }
});

// ── Theme des aktiven Dojos laden ──
router.get('/', authenticateToken, cacheGet(120000), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.json({ success: true, theme: null }); // Super-Admin ohne Dojo-Wahl

    const [[row]] = await pool.query(
      'SELECT theme_config FROM dojo_theme WHERE dojo_id = ? LIMIT 1', [dojoId]
    );
    res.json({ success: true, theme: row ? parseConfig(row.theme_config) : null });
  } catch (err) {
    logger.error?.('[dojo-theme] GET Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Theme konnte nicht geladen werden' });
  }
});

// ── Theme speichern (Upsert) ──
router.put('/', authenticateToken, async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, error: 'Kein Dojo gewählt' });

    const theme = req.body?.theme ?? req.body;
    if (!theme || typeof theme !== 'object') {
      return res.status(400).json({ success: false, error: 'Ungültige Theme-Daten' });
    }

    await pool.query(
      `INSERT INTO dojo_theme (dojo_id, theme_config)
            VALUES (?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE theme_config = VALUES(theme_config)`,
      [dojoId, JSON.stringify(theme)]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error?.('[dojo-theme] PUT Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Theme konnte nicht gespeichert werden' });
  }
});

// ── Theme zurücksetzen ──
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, error: 'Kein Dojo gewählt' });
    await pool.query('DELETE FROM dojo_theme WHERE dojo_id = ?', [dojoId]);
    res.json({ success: true });
  } catch (err) {
    logger.error?.('[dojo-theme] DELETE Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Theme konnte nicht zurückgesetzt werden' });
  }
});

module.exports = router;
