const express     = require('express');
const crypto      = require('crypto');
const router      = express.Router();
const db          = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireFeature }    = require('../middleware/featureAccess');
const { getSecureDojoId }   = require('../middleware/tenantSecurity');
const logger      = require('../utils/logger');

// ── PUBLIC: Trainer App holt Presets via Token ────────────────────────────────
router.get('/sync', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  const { token } = req.query;
  if (!token || token.length !== 64) {
    return res.status(400).json({ error: 'Token fehlt oder ungültig' });
  }

  try {
    const [tokenRows] = await db.promise().query(
      'SELECT dojo_id FROM training_sync_tokens WHERE sync_token = ? LIMIT 1',
      [token]
    );

    if (tokenRows.length === 0) {
      return res.status(401).json({ error: 'Ungültiger Sync-Token' });
    }

    const dojoId = tokenRows[0].dojo_id;

    await db.promise().query(
      'UPDATE training_sync_tokens SET last_synced_at = NOW() WHERE dojo_id = ?',
      [dojoId]
    );

    const [presetRows] = await db.promise().query(
      'SELECT presets_json FROM training_presets WHERE dojo_id = ? LIMIT 1',
      [dojoId]
    );

    const presets = presetRows.length > 0
      ? JSON.parse(presetRows[0].presets_json || '{}')
      : {};

    res.json({ presets });
  } catch (err) {
    logger.error('Training sync error:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Alle folgenden Routen erfordern Auth + Feature ───────────────────────────
router.use(authenticateToken);

// GET /api/training/presets
router.get('/presets', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });

    const [rows] = await db.promise().query(
      'SELECT presets_json FROM training_presets WHERE dojo_id = ? LIMIT 1',
      [dojoId]
    );

    const presets = rows.length > 0 ? JSON.parse(rows[0].presets_json || '{}') : {};
    res.json({ presets });
  } catch (err) {
    logger.error('Training presets load error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /api/training/presets
router.put('/presets', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });

    const { presets } = req.body;
    if (!presets || typeof presets !== 'object') {
      return res.status(400).json({ error: 'Ungültige Preset-Daten' });
    }

    const presetsJson = JSON.stringify(presets);

    await db.promise().query(
      `INSERT INTO training_presets (dojo_id, presets_json)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE presets_json = VALUES(presets_json), updated_at = NOW()`,
      [dojoId, presetsJson]
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('Training presets save error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /api/training/token
router.get('/token', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });

    const [rows] = await db.promise().query(
      'SELECT sync_token, last_synced_at FROM training_sync_tokens WHERE dojo_id = ? LIMIT 1',
      [dojoId]
    );

    if (rows.length === 0) {
      const syncToken = crypto.randomBytes(32).toString('hex');
      await db.promise().query(
        'INSERT INTO training_sync_tokens (dojo_id, sync_token) VALUES (?, ?)',
        [dojoId, syncToken]
      );
      return res.json({ token: syncToken, lastSynced: null });
    }

    res.json({ token: rows[0].sync_token, lastSynced: rows[0].last_synced_at });
  } catch (err) {
    logger.error('Training token error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/training/token/regenerate
router.post('/token/regenerate', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });

    const newToken = crypto.randomBytes(32).toString('hex');

    await db.promise().query(
      `INSERT INTO training_sync_tokens (dojo_id, sync_token)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE sync_token = VALUES(sync_token), last_synced_at = NULL`,
      [dojoId, newToken]
    );

    res.json({ token: newToken });
  } catch (err) {
    logger.error('Training token regenerate error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
