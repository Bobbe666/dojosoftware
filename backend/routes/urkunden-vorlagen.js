// =============================================================================
// URKUNDEN-VORLAGEN (Enterprise) — eigene Urkunden-Designs pro Dojo
// CRUD + Hintergrund-Upload. Auto-gemountet unter /api/urkunden-vorlagen.
// Gate: eingeloggt + Enterprise-Feature 'urkunden_vorlagen'.
// =============================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const { requireFeature } = require('../middleware/featureAccess');

const pool = db.promise();

router.use(authenticateToken);
router.use((req, res, next) => requireFeature('urkunden_vorlagen')(req, res, next));

// Multer: Hintergrund-Design (Bild)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/urkunden');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `urkunde-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Nur JPG/PNG/WEBP erlaubt'), ok);
  },
});

const dojoIdOf = (req) => getSecureDojoId(req) || req.user?.dojo_id || (req.query.dojo_id ? parseInt(req.query.dojo_id) : null);
const parseJ = (v, def) => { if (v == null) return def; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return def; } };

// GET / — Vorlagen des Dojos
router.get('/', async (req, res) => {
  try {
    const d = dojoIdOf(req);
    if (!d) return res.status(400).json({ error: 'Dojo-ID fehlt' });
    const [rows] = await pool.query('SELECT * FROM urkunden_vorlagen WHERE dojo_id = ? ORDER BY name', [d]);
    res.json({ success: true, vorlagen: rows.map(r => ({ ...r, felder: parseJ(r.felder, []), optionen: parseJ(r.optionen, {}) })) });
  } catch (e) { logger.error('urkunden-vorlagen GET', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// POST / — neue Vorlage
router.post('/', async (req, res) => {
  try {
    const d = dojoIdOf(req);
    if (!d) return res.status(400).json({ error: 'Dojo-ID fehlt' });
    const { name, stil_id, seitenformat, felder, schriftart, extra_font_url, optionen, bg_image_path } = req.body;
    if (!name) return res.status(400).json({ error: 'Name fehlt' });
    const [r] = await pool.query(
      `INSERT INTO urkunden_vorlagen (dojo_id, name, stil_id, seitenformat, bg_image_path, felder, schriftart, extra_font_url, optionen, aktiv)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [d, name, stil_id || null, seitenformat || 'a4_quer', bg_image_path || null,
       JSON.stringify(felder || []), schriftart || 'Georgia, serif', extra_font_url || null, JSON.stringify(optionen || {})]
    );
    res.json({ success: true, id: r.insertId });
  } catch (e) { logger.error('urkunden-vorlagen POST', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// PUT /:id — aktualisieren (Teil-Update)
router.put('/:id', async (req, res) => {
  try {
    const d = dojoIdOf(req);
    const b = req.body;
    const sets = [], vals = [];
    const add = (c, v) => { sets.push(`${c} = ?`); vals.push(v); };
    if (b.name !== undefined) add('name', b.name);
    if (b.stil_id !== undefined) add('stil_id', b.stil_id || null);
    if (b.seitenformat !== undefined) add('seitenformat', b.seitenformat);
    if (b.bg_image_path !== undefined) add('bg_image_path', b.bg_image_path || null);
    if (b.felder !== undefined) add('felder', JSON.stringify(b.felder || []));
    if (b.schriftart !== undefined) add('schriftart', b.schriftart);
    if (b.extra_font_url !== undefined) add('extra_font_url', b.extra_font_url || null);
    if (b.optionen !== undefined) add('optionen', JSON.stringify(b.optionen || {}));
    if (b.aktiv !== undefined) add('aktiv', b.aktiv ? 1 : 0);
    if (!sets.length) return res.status(400).json({ error: 'Keine Änderungen' });
    vals.push(req.params.id, d);
    const [r] = await pool.query(`UPDATE urkunden_vorlagen SET ${sets.join(', ')} WHERE id = ? AND dojo_id = ?`, vals);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    res.json({ success: true });
  } catch (e) { logger.error('urkunden-vorlagen PUT', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const d = dojoIdOf(req);
    const [r] = await pool.query('DELETE FROM urkunden_vorlagen WHERE id = ? AND dojo_id = ?', [req.params.id, d]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    res.json({ success: true });
  } catch (e) { logger.error('urkunden-vorlagen DELETE', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// POST /bild — Hintergrund-Design hochladen → Pfad zurück
router.post('/bild', upload.single('bild'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  res.json({ success: true, path: `/uploads/urkunden/${req.file.filename}` });
});

module.exports = router;
