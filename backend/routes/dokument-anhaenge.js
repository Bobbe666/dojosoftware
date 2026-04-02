/**
 * dokument-anhaenge.js
 * =====================
 * Anhang-Bibliothek: wiederkehrende Dateien (PDFs, Bilder) pro Dojo hochladen
 * und an E-Mail-Vorlagen anhängen.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

// ── Multer-Konfiguration ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'anhaenge');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.random().toString(36).slice(2);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.docx', '.xlsx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Nur PDF, Bilder, Word und Excel erlaubt'));
  }
});

router.use(authenticateToken);

// ── GET / — alle Anhänge des Dojos ────────────────────────────────────────────
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM dokument_anhaenge WHERE dojo_id = ? ORDER BY erstellt_am DESC',
      [dojoId]
    );
    res.json({ success: true, anhaenge: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST / — Datei hochladen ───────────────────────────────────────────────────
router.post('/', upload.single('datei'), async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) { if (req.file) fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Keine Berechtigung' }); }
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });

  const name = req.body.name?.trim() || req.file.originalname;
  try {
    const [result] = await pool.query(
      'INSERT INTO dokument_anhaenge (dojo_id, name, dateiname, dateigroesse, mime_type) VALUES (?, ?, ?, ?, ?)',
      [dojoId, name, req.file.filename, req.file.size, req.file.mimetype]
    );
    const [[row]] = await pool.query('SELECT * FROM dokument_anhaenge WHERE id = ?', [result.insertId]);
    res.json({ success: true, anhang: row });
  } catch (err) {
    fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id — Datei löschen ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [[row]] = await pool.query(
      'SELECT * FROM dokument_anhaenge WHERE id = ? AND dojo_id = ?',
      [req.params.id, dojoId]
    );
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' });

    const filePath = path.join(__dirname, '..', 'uploads', 'anhaenge', row.dateiname);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query('DELETE FROM vorlage_anhaenge WHERE anhang_id = ?', [req.params.id]);
    await pool.query('DELETE FROM dokument_anhaenge WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /:id/download ──────────────────────────────────────────────────────────
router.get('/:id/download', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [[row]] = await pool.query(
      'SELECT * FROM dokument_anhaenge WHERE id = ? AND dojo_id = ?',
      [req.params.id, dojoId]
    );
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' });
    const filePath = path.join(__dirname, '..', 'uploads', 'anhaenge', row.dateiname);
    res.download(filePath, row.name + path.extname(row.dateiname));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /vorlage/:vorlagenId — zugewiesene Anhänge ────────────────────────────
router.get('/vorlage/:vorlagenId', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [rows] = await pool.query(
      `SELECT da.* FROM dokument_anhaenge da
       JOIN vorlage_anhaenge va ON da.id = va.anhang_id
       WHERE va.vorlage_id = ? AND da.dojo_id = ?`,
      [req.params.vorlagenId, dojoId]
    );
    res.json({ success: true, anhaenge: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /vorlage/:vorlagenId/:anhangId — zuweisen ────────────────────────────
router.post('/vorlage/:vorlagenId/:anhangId', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    await pool.query(
      'INSERT IGNORE INTO vorlage_anhaenge (vorlage_id, anhang_id) VALUES (?, ?)',
      [req.params.vorlagenId, req.params.anhangId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /vorlage/:vorlagenId/:anhangId — entfernen ─────────────────────────
router.delete('/vorlage/:vorlagenId/:anhangId', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    await pool.query(
      'DELETE FROM vorlage_anhaenge WHERE vorlage_id = ? AND anhang_id = ?',
      [req.params.vorlagenId, req.params.anhangId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
