// Backend/routes/display.js — Werbe-/Info-Display (Digital Signage), Admin-Verwaltung
// Enterprise-Feature. Mount: app.use('/api/display', authenticateToken, require('./routes/display'))
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const logger = require('../utils/logger');
const { requireFeature } = require('../middleware/featureAccess');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// Alle Display-Routen erfordern das Enterprise-Feature
router.use((req, res, next) => requireFeature('display')(req, res, next));

// ---------- Upload (Bilder/Videos) ----------
const displayStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dojoId = getSecureDojoId(req) || 'super';
    const dir = path.join(__dirname, '../uploads/display', String(dojoId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, uniqueSuffix + '-' + safe);
  }
});
const displayUpload = multer({
  storage: displayStorage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60 MB (Videos)
  fileFilter: (req, file, cb) => {
    const ok = /^(image\/(jpe?g|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg))$/.test(file.mimetype);
    if (ok) return cb(null, true);
    cb(new Error('Nur Bilder (JPG/PNG/GIF/WEBP/SVG) oder Videos (MP4/WEBM/OGG) erlaubt'));
  }
});

// ---------- Helper: Config laden/anlegen ----------
async function getOrCreateConfig(dojoId) {
  const [rows] = await db.promise().query('SELECT * FROM display_config WHERE dojo_id = ?', [dojoId]);
  if (rows.length) return rows[0];
  await db.promise().query('INSERT INTO display_config (dojo_id) VALUES (?)', [dojoId]);
  const [created] = await db.promise().query('SELECT * FROM display_config WHERE dojo_id = ?', [dojoId]);
  return created[0];
}

// ===================== CONFIG =====================
// GET /api/display/config
router.get('/config', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen' });
    const config = await getOrCreateConfig(dojoId);
    res.json({ success: true, config });
  } catch (err) {
    logger.error('Display: Config laden fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Laden der Konfiguration' });
  }
});

// PUT /api/display/config
router.put('/config', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen' });
    await getOrCreateConfig(dojoId);

    const allowed = ['aktiv', 'titel', 'standard_dauer', 'uhr_anzeigen',
      'auto_kursplan', 'auto_events', 'auto_pruefungen', 'auto_geburtstage', 'auto_schnellansage'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = ?`);
        let v = req.body[key];
        if (typeof v === 'boolean') v = v ? 1 : 0;
        vals.push(v);
      }
    }
    if (!sets.length) return res.json({ success: true });
    vals.push(dojoId);
    await db.promise().query(`UPDATE display_config SET ${sets.join(', ')} WHERE dojo_id = ?`, vals);
    const [rows] = await db.promise().query('SELECT * FROM display_config WHERE dojo_id = ?', [dojoId]);
    res.json({ success: true, config: rows[0] });
  } catch (err) {
    logger.error('Display: Config speichern fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Speichern der Konfiguration' });
  }
});

// ===================== SLIDES =====================
// GET /api/display/slides
router.get('/slides', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen' });
    const [rows] = await db.promise().query(
      'SELECT * FROM display_slides WHERE dojo_id = ? ORDER BY sortierung ASC, id ASC', [dojoId]
    );
    res.json({ success: true, slides: rows });
  } catch (err) {
    logger.error('Display: Slides laden fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Laden der Slides' });
  }
});

// POST /api/display/slides
router.post('/slides', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen' });
    const {
      typ = 'text', titel = null, text_inhalt = null, medien_url = null, qr_daten = null,
      hintergrund_farbe = null, text_farbe = null, dauer = null,
      aktiv = true, start_datum = null, end_datum = null
    } = req.body;

    const [maxRow] = await db.promise().query(
      'SELECT COALESCE(MAX(sortierung), 0) + 1 AS next FROM display_slides WHERE dojo_id = ?', [dojoId]
    );
    const sortierung = maxRow[0].next;

    const [result] = await db.promise().query(
      `INSERT INTO display_slides
        (dojo_id, typ, titel, text_inhalt, medien_url, qr_daten, hintergrund_farbe, text_farbe, dauer, sortierung, aktiv, start_datum, end_datum)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, typ, titel, text_inhalt, medien_url, qr_daten, hintergrund_farbe, text_farbe,
        dauer || null, sortierung, aktiv ? 1 : 0, start_datum || null, end_datum || null]
    );
    const [rows] = await db.promise().query('SELECT * FROM display_slides WHERE id = ?', [result.insertId]);
    res.json({ success: true, slide: rows[0] });
  } catch (err) {
    logger.error('Display: Slide anlegen fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Anlegen des Slides' });
  }
});

// PUT /api/display/slides/:id
router.put('/slides/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen' });
    const id = parseInt(req.params.id, 10);

    const allowed = ['typ', 'titel', 'text_inhalt', 'medien_url', 'qr_daten',
      'hintergrund_farbe', 'text_farbe', 'dauer', 'sortierung', 'aktiv', 'start_datum', 'end_datum'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = ?`);
        let v = req.body[key];
        if (typeof v === 'boolean') v = v ? 1 : 0;
        if (v === '') v = null;
        vals.push(v);
      }
    }
    if (!sets.length) return res.json({ success: true });
    vals.push(id, dojoId);
    const [result] = await db.promise().query(
      `UPDATE display_slides SET ${sets.join(', ')} WHERE id = ? AND dojo_id = ?`, vals
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Slide nicht gefunden' });
    const [rows] = await db.promise().query('SELECT * FROM display_slides WHERE id = ?', [id]);
    res.json({ success: true, slide: rows[0] });
  } catch (err) {
    logger.error('Display: Slide aktualisieren fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Slides' });
  }
});

// DELETE /api/display/slides/:id
router.delete('/slides/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen' });
    const id = parseInt(req.params.id, 10);
    const [result] = await db.promise().query(
      'DELETE FROM display_slides WHERE id = ? AND dojo_id = ?', [id, dojoId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Slide nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('Display: Slide löschen fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Löschen des Slides' });
  }
});

// POST /api/display/slides/reorder  { ids: [3,1,2] }
router.post('/slides/reorder', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen' });
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids-Array erforderlich' });
    for (let i = 0; i < ids.length; i++) {
      await db.promise().query(
        'UPDATE display_slides SET sortierung = ? WHERE id = ? AND dojo_id = ?',
        [i + 1, parseInt(ids[i], 10), dojoId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Display: Reorder fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Sortieren' });
  }
});

// POST /api/display/upload  (multipart: feld "datei")
router.post('/upload', displayUpload.single('datei'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen' });
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    const relativePath = `/uploads/display/${dojoId}/${req.file.filename}`;
    const istVideo = /^video\//.test(req.file.mimetype);
    res.json({ success: true, url: relativePath, typ: istVideo ? 'video' : 'bild' });
  } catch (err) {
    logger.error('Display: Upload fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Hochladen' });
  }
});

module.exports = router;
