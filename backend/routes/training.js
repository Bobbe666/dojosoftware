const express     = require('express');
const crypto      = require('crypto');
const jwt         = require('jsonwebtoken');
const router      = express.Router();
const db          = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { requireFeature }    = require('../middleware/featureAccess');
const { getSecureDojoId }   = require('../middleware/tenantSecurity');
const { verifyPassword }    = require('../services/passwordService');
const logger      = require('../utils/logger');

// ── Trainer-App: Middleware für Trainer-JWT ──────────────────────────────────
function authenticateTrainerToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Kein Token vorhanden' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token ungültig oder abgelaufen' });
    if (!decoded.trainer_app) return res.status(403).json({ error: 'Kein Trainer-App-Token' });
    req.trainerUser = decoded;
    next();
  });
}

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

    const [exerciseRows] = await db.promise().query(
      `SELECT ec.name, ec.description, ec.category, es.name AS subcategory_name
       FROM exercise_catalog ec
       LEFT JOIN exercise_subcategories es ON es.id = ec.subcategory_id
       WHERE ec.dojo_id IS NULL OR ec.dojo_id = ?
       ORDER BY ec.category, COALESCE(es.sort_order, 999), ec.name`,
      [dojoId]
    );

    res.json({ presets, exercises: exerciseRows });
  } catch (err) {
    logger.error('Training sync error:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── PUBLIC: Trainer-App Login ─────────────────────────────────────────────────
router.post('/trainer-login', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  const { email, username, password } = req.body;
  const loginField = email || username;

  if (!loginField || !password) {
    return res.status(400).json({ error: 'E-Mail/Benutzername und Passwort sind erforderlich' });
  }
  if (password.length > 128) {
    return res.status(400).json({ error: 'Passwort zu lang' });
  }

  try {
    const [rows] = await db.promise().query(
      `SELECT id, username, email, password, rolle, dojo_id, vorname, nachname, aktiv
       FROM admin_users
       WHERE (email = ? OR username = ?) AND aktiv = 1
       LIMIT 1`,
      [loginField, loginField]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Ungültige Zugangsdaten' });
    }

    const user = rows[0];

    const { valid } = await verifyPassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Ungültige Zugangsdaten' });
    }

    // Trainer-ID via E-Mail-Match nachschlagen (NULL-sicher)
    let trainerId = null;
    if (user.email) {
      const trainerQuery = user.dojo_id != null
        ? 'SELECT trainer_id FROM trainer WHERE email = ? AND dojo_id = ? LIMIT 1'
        : 'SELECT trainer_id FROM trainer WHERE email = ? LIMIT 1';
      const trainerParams = user.dojo_id != null
        ? [user.email, user.dojo_id]
        : [user.email];
      const [trainerRows] = await db.promise().query(trainerQuery, trainerParams);
      if (trainerRows.length > 0) trainerId = trainerRows[0].trainer_id;
    }

    const tokenPayload = {
      id: user.id,
      admin_user_id: user.id,
      dojo_id: user.dojo_id,
      username: user.username,
      email: user.email,
      vorname: user.vorname,
      nachname: user.nachname,
      trainer_id: trainerId,
      trainer_app: true,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '90d' });

    logger.info(`Trainer-App Login: ${user.username} (Dojo ${user.dojo_id})`);

    res.json({
      token,
      trainer: {
        id: user.id,
        vorname: user.vorname,
        nachname: user.nachname,
        email: user.email,
        dojo_id: user.dojo_id,
        trainer_id: trainerId
      }
    });
  } catch (err) {
    logger.error('Trainer-Login error:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Trainer-App: Persönliche Presets laden ────────────────────────────────────
router.get('/trainer-presets', authenticateTrainerToken, async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { admin_user_id, dojo_id } = req.trainerUser;

  try {
    const [personal] = await db.promise().query(
      'SELECT presets_json FROM trainer_personal_presets WHERE admin_user_id = ? LIMIT 1',
      [admin_user_id]
    );

    if (personal.length > 0 && personal[0].presets_json) {
      return res.json({
        presets: JSON.parse(personal[0].presets_json || '{}'),
        source: 'personal'
      });
    }

    // Fallback: Dojo-Presets (Super-Admin dojo_id=null → Dojo 3 als Default)
    const fallbackDojoId = dojo_id ?? 3;
    const [dojoRows] = await db.promise().query(
      'SELECT presets_json FROM training_presets WHERE dojo_id = ? LIMIT 1',
      [fallbackDojoId]
    );

    const presets = dojoRows.length > 0
      ? JSON.parse(dojoRows[0].presets_json || '{}')
      : {};

    res.json({ presets, source: 'dojo' });
  } catch (err) {
    logger.error('Trainer-Presets load error:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Trainer-App: Persönliche Presets speichern ────────────────────────────────
router.put('/trainer-presets', authenticateTrainerToken, async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { admin_user_id, dojo_id } = req.trainerUser;

  const { presets } = req.body;
  if (!presets || typeof presets !== 'object') {
    return res.status(400).json({ error: 'Ungültige Preset-Daten' });
  }

  const presetsJson = JSON.stringify(presets);
  if (presetsJson.length > 500 * 1024) {
    return res.status(400).json({ error: 'Preset-Daten zu groß (max. 500 KB)' });
  }

  try {
    await db.promise().query(
      `INSERT INTO trainer_personal_presets (admin_user_id, dojo_id, presets_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE presets_json = VALUES(presets_json), updated_at = NOW()`,
      [admin_user_id, dojo_id, presetsJson]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error('Trainer-Presets save error:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Dojosoftware Frontend: Preset-Info für einen Trainer (per trainer_id) ──────
// GET /api/training/trainer-presets-info?trainer_id=X
// Prüft ob ein admin_user mit gleicher Email persönliche Presets hat
router.get('/trainer-presets-info', authenticateToken, async (req, res) => {
  const { trainer_id } = req.query;
  if (!trainer_id) return res.status(400).json({ error: 'trainer_id fehlt' });

  try {
    // Trainer-Email holen
    const [trainerRows] = await db.promise().query(
      'SELECT email FROM trainer WHERE trainer_id = ? LIMIT 1',
      [trainer_id]
    );
    if (trainerRows.length === 0) {
      return res.json({ hasAccount: false, hasPersonalPresets: false, adminUser: null });
    }

    const trainerEmail = trainerRows[0].email;
    if (!trainerEmail) {
      return res.json({ hasAccount: false, hasPersonalPresets: false, adminUser: null });
    }

    // Admin-User per E-Mail suchen
    const [adminRows] = await db.promise().query(
      'SELECT id, username, vorname, nachname FROM admin_users WHERE email = ? LIMIT 1',
      [trainerEmail]
    );

    if (adminRows.length === 0) {
      return res.json({ hasAccount: false, hasPersonalPresets: false, adminUser: null });
    }

    const adminUser = adminRows[0];

    // Persönliche Presets prüfen
    const [presetRows] = await db.promise().query(
      'SELECT id, updated_at FROM trainer_personal_presets WHERE admin_user_id = ? LIMIT 1',
      [adminUser.id]
    );

    res.json({
      hasAccount: true,
      hasPersonalPresets: presetRows.length > 0,
      lastSaved: presetRows.length > 0 ? presetRows[0].updated_at : null,
      adminUser: {
        id: adminUser.id,
        username: adminUser.username,
        vorname: adminUser.vorname,
        nachname: adminUser.nachname
      }
    });
  } catch (err) {
    logger.error('Trainer-Presets-Info error:', { error: err.message });
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

// ── GET /api/training/exercises ── Liste aller Übungen (global + dojo-eigene) ──
router.get('/exercises', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });

    const [rows] = await db.promise().query(
      `SELECT ec.id, ec.dojo_id, ec.name, ec.description, ec.category,
              ec.subcategory_id, es.name AS subcategory_name
       FROM exercise_catalog ec
       LEFT JOIN exercise_subcategories es ON es.id = ec.subcategory_id
       WHERE ec.dojo_id IS NULL OR ec.dojo_id = ?
       ORDER BY ec.category, COALESCE(es.sort_order, 999), ec.name`,
      [dojoId]
    );

    res.json({ exercises: rows });
  } catch (err) {
    logger.error('Exercise catalog load error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ── POST /api/training/exercises ── Eigene Übung hinzufügen ───────────────────
router.post('/exercises', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });

    const { name, category, description, subcategory_id } = req.body;
    const validCategories = ['kampfsport', 'fitness', 'core', 'ausdauer'];
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name zu kurz' });
    }
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Ungültige Kategorie' });
    }

    const trimmedName = name.trim().substring(0, 100);
    const trimmedDesc = description ? String(description).trim().substring(0, 500) : null;
    const subcatId = subcategory_id || null;

    const [existing] = await db.promise().query(
      'SELECT id FROM exercise_catalog WHERE name = ? AND (dojo_id IS NULL OR dojo_id = ?)',
      [trimmedName, dojoId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Übung existiert bereits' });
    }

    const [result] = await db.promise().query(
      'INSERT INTO exercise_catalog (dojo_id, name, description, category, subcategory_id) VALUES (?, ?, ?, ?, ?)',
      [dojoId, trimmedName, trimmedDesc, category, subcatId]
    );

    res.json({ id: result.insertId, dojo_id: dojoId, name: trimmedName, description: trimmedDesc, category, subcategory_id: subcatId });
  } catch (err) {
    logger.error('Exercise catalog add error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ── PUT /api/training/exercises/:id ── Eigene Übung vollständig bearbeiten ────
router.put('/exercises/:id', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });

    const { id } = req.params;
    const { name, description, category, subcategory_id } = req.body;

    // Check ownership
    const [check] = await db.promise().query(
      'SELECT id FROM exercise_catalog WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: 'Nicht gefunden oder keine Berechtigung' });
    }

    const validCategories = ['kampfsport', 'fitness', 'core', 'ausdauer'];
    const updates = {};
    if (description !== undefined) updates.description = description ? String(description).trim().substring(0, 500) : null;
    if (name !== undefined && typeof name === 'string' && name.trim().length >= 2) updates.name = name.trim().substring(0, 100);
    if (category !== undefined && validCategories.includes(category)) updates.category = category;
    if (subcategory_id !== undefined) updates.subcategory_id = subcategory_id || null;

    if (Object.keys(updates).length === 0) return res.json({ success: true });

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await db.promise().query(
      `UPDATE exercise_catalog SET ${setClause} WHERE id = ? AND dojo_id = ?`,
      [...Object.values(updates), id, dojoId]
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('Exercise update error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ── DELETE /api/training/exercises/:id ── Eigene Übung löschen ───────────────
router.delete('/exercises/:id', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });

    const { id } = req.params;

    const [result] = await db.promise().query(
      'DELETE FROM exercise_catalog WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Nicht gefunden oder keine Berechtigung' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Exercise catalog delete error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ── GET /api/training/subcategories ──────────────────────────────────────────
router.get('/subcategories', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });
    const [rows] = await db.promise().query(
      `SELECT id, dojo_id, name, category, sort_order
       FROM exercise_subcategories
       WHERE dojo_id IS NULL OR dojo_id = ?
       ORDER BY category, sort_order, name`,
      [dojoId]
    );
    res.json({ subcategories: rows });
  } catch (err) {
    logger.error('Subcategories load error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ── POST /api/training/subcategories ─────────────────────────────────────────
router.post('/subcategories', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });
    const { name, category } = req.body;
    const validCategories = ['kampfsport', 'fitness', 'core', 'ausdauer'];
    if (!name || typeof name !== 'string' || name.trim().length < 2) return res.status(400).json({ error: 'Name zu kurz' });
    if (!validCategories.includes(category)) return res.status(400).json({ error: 'Ungültige Kategorie' });
    const trimmed = name.trim().substring(0, 100);
    const [existing] = await db.promise().query(
      'SELECT id FROM exercise_subcategories WHERE name = ? AND category = ? AND (dojo_id IS NULL OR dojo_id = ?)',
      [trimmed, category, dojoId]
    );
    if (existing.length > 0) return res.status(409).json({ error: 'Kategorie existiert bereits' });
    const [result] = await db.promise().query(
      'INSERT INTO exercise_subcategories (dojo_id, name, category, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM exercise_subcategories es2 WHERE es2.category = ? AND (es2.dojo_id IS NULL OR es2.dojo_id = ?)))',
      [dojoId, trimmed, category, category, dojoId]
    );
    res.json({ id: result.insertId, dojo_id: dojoId, name: trimmed, category, sort_order: 99 });
  } catch (err) {
    logger.error('Subcategory add error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ── PUT /api/training/subcategories/:id ── umbenennen ─────────────────────────
router.put('/subcategories/:id', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) return res.status(400).json({ error: 'Name zu kurz' });
    const [result] = await db.promise().query(
      'UPDATE exercise_subcategories SET name = ? WHERE id = ? AND dojo_id = ?',
      [name.trim().substring(0, 100), id, dojoId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Nicht gefunden oder keine Berechtigung' });
    res.json({ success: true });
  } catch (err) {
    logger.error('Subcategory rename error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ── DELETE /api/training/subcategories/:id ────────────────────────────────────
router.delete('/subcategories/:id', requireFeature('training'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Dojo-ID fehlt' });
    const { id } = req.params;
    // Unassign exercises from this subcategory first
    await db.promise().query(
      'UPDATE exercise_catalog SET subcategory_id = NULL WHERE subcategory_id = ? AND dojo_id = ?',
      [id, dojoId]
    );
    const [result] = await db.promise().query(
      'DELETE FROM exercise_subcategories WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Nicht gefunden oder keine Berechtigung' });
    res.json({ success: true });
  } catch (err) {
    logger.error('Subcategory delete error:', { error: err.message });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
