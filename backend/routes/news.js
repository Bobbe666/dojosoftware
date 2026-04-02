const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const pool = db.promise();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../utils/dojo-filter-helper');

// Multer-Konfiguration für News-Bilder
const newsUploadDir = path.join(__dirname, '../uploads/news');
if (!fs.existsSync(newsUploadDir)) fs.mkdirSync(newsUploadDir, { recursive: true });

const newsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, newsUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `news-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const newsUpload = multer({
  storage: newsStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Nur Bilder erlaubt (JPG, PNG, GIF, WebP)'));
  }
});

// Hilfsfunktion: auto-publish/expire WHERE-Klausel für öffentliche Endpunkte
const publicStatusClause = `(
  status = 'veroeffentlicht' OR
  (status = 'geplant' AND geplant_am IS NOT NULL AND geplant_am <= NOW())
) AND (ablauf_am IS NULL OR ablauf_am > NOW())`;

// POST /api/news/upload-bild - Bild hochladen
router.post('/upload-bild', authenticateToken, newsUpload.single('bild'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
  const bildUrl = `/uploads/news/${req.file.filename}`;
  res.json({ success: true, bild_url: bildUrl });
});

// GET /api/news - Alle News abrufen (gefiltert nach Dojo)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, zielgruppe, kategorie, featured, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const secureDojoId = getSecureDojoId(req);

    let whereClause = '1=1';
    const params = [];

    if (secureDojoId !== null) {
      whereClause += ' AND (dojo_id = ? OR dojo_id IS NULL)';
      params.push(secureDojoId);
    }
    if (status) { whereClause += ' AND status = ?'; params.push(status); }
    if (zielgruppe) { whereClause += ' AND zielgruppe = ?'; params.push(zielgruppe); }
    if (kategorie) { whereClause += ' AND kategorie = ?'; params.push(kategorie); }
    if (featured === '1') { whereClause += ' AND featured = 1'; }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM news_articles WHERE ${whereClause}`, params
    );
    const [news] = await pool.query(
      `SELECT id, titel, kurzbeschreibung, inhalt, zielgruppe, auf_intl, status, kategorie, tags,
              featured, geplant_am, ablauf_am, meta_titel, meta_beschreibung,
              bild_url, bilder_json, bild_captions, autor_id, dojo_id, veroeffentlicht_am, created_at
       FROM news_articles WHERE ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      news,
      pagination: {
        page: parseInt(page), limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Fehler beim Laden der News:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der News' });
  }
});

// GET /api/news/public - Veröffentlichte News für Member
router.get('/public', authenticateToken, async (req, res) => {
  try {
    const userDojoId = req.user.dojo_id;
    let whereClause;
    let params;

    if (userDojoId) {
      whereClause = `${publicStatusClause} AND (dojo_id = ? OR dojo_id = 2 OR dojo_id IS NULL)`;
      params = [userDojoId];
    } else {
      whereClause = publicStatusClause;
      params = [];
    }

    const [news] = await pool.query(
      `SELECT id, titel, kurzbeschreibung, inhalt, zielgruppe, kategorie, tags,
              featured, bild_url, bilder_json, bild_captions, veroeffentlicht_am, geplant_am, created_at
       FROM news_articles WHERE ${whereClause}
       ORDER BY COALESCE(veroeffentlicht_am, geplant_am, created_at) DESC LIMIT 50`,
      params
    );
    res.json({ news });
  } catch (error) {
    logger.error('Fehler beim Laden der öffentlichen News:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der News' });
  }
});

// GET /api/news/homepage - News für TDA-VIB Homepage (öffentlich)
router.get('/homepage', async (req, res) => {
  try {
    const [news] = await pool.query(
      `SELECT id, titel, kurzbeschreibung, inhalt, kategorie, tags, featured,
              bild_url, bilder_json, bild_captions, meta_titel, meta_beschreibung,
              veroeffentlicht_am, geplant_am, created_at
       FROM news_articles WHERE ${publicStatusClause}
       ORDER BY COALESCE(veroeffentlicht_am, geplant_am, created_at) DESC LIMIT 10`
    );
    res.json({ news });
  } catch (error) {
    logger.error('Fehler beim Laden der Homepage-News:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der News' });
  }
});

// GET /api/news/:id - Einzelne News abrufen
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const secureDojoId = getSecureDojoId(req);
    let whereClause = 'id = ?';
    const params = [id];
    if (secureDojoId !== null) {
      whereClause += ' AND (dojo_id = ? OR dojo_id IS NULL)';
      params.push(secureDojoId);
    }
    const [news] = await pool.query(
      `SELECT * FROM news_articles WHERE ${whereClause}`, params
    );
    if (news.length === 0) return res.status(404).json({ error: 'News nicht gefunden' });
    res.json(news[0]);
  } catch (error) {
    logger.error('Fehler beim Laden der News:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der News' });
  }
});

// POST /api/news - Neue News erstellen
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      titel, inhalt, kurzbeschreibung, zielgruppe, auf_intl, status,
      bild_url, bilder_json, bild_captions,
      kategorie, tags, featured, geplant_am, ablauf_am, meta_titel, meta_beschreibung
    } = req.body;
    const autorId = req.user.id || req.user.user_id;
    const secureDojoId = getSecureDojoId(req);

    if (!titel || !inhalt) return res.status(400).json({ error: 'Titel und Inhalt sind erforderlich' });

    const veroeffentlichtAm = status === 'veroeffentlicht' ? new Date() : null;

    const [result] = await pool.query(
      `INSERT INTO news_articles
        (titel, inhalt, kurzbeschreibung, zielgruppe, auf_intl, status,
         autor_id, veroeffentlicht_am, dojo_id, bild_url, bilder_json, bild_captions,
         kategorie, tags, featured, geplant_am, ablauf_am, meta_titel, meta_beschreibung)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        titel, inhalt, kurzbeschreibung || null,
        zielgruppe || 'alle_dojos', auf_intl ? 1 : 0, status || 'entwurf',
        autorId, veroeffentlichtAm, secureDojoId,
        bild_url || null, bilder_json || null, bild_captions || null,
        kategorie || 'allgemein', tags || null, featured ? 1 : 0,
        geplant_am || null, ablauf_am || null,
        meta_titel || null, meta_beschreibung || null
      ]
    );

    res.status(201).json({ message: 'News erfolgreich erstellt', id: result.insertId });
  } catch (error) {
    logger.error('Fehler beim Erstellen der News:', { error });
    res.status(500).json({ error: 'Fehler beim Erstellen der News' });
  }
});

// PUT /api/news/:id - News bearbeiten
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titel, inhalt, kurzbeschreibung, zielgruppe, auf_intl, status,
      bild_url, bilder_json, bild_captions,
      kategorie, tags, featured, geplant_am, ablauf_am, meta_titel, meta_beschreibung
    } = req.body;
    const secureDojoId = getSecureDojoId(req);

    if (!titel || !inhalt) return res.status(400).json({ error: 'Titel und Inhalt sind erforderlich' });

    let checkWhere = 'id = ?';
    const checkParams = [id];
    if (secureDojoId !== null) { checkWhere += ' AND dojo_id = ?'; checkParams.push(secureDojoId); }

    const [existing] = await pool.query(`SELECT * FROM news_articles WHERE ${checkWhere}`, checkParams);
    if (existing.length === 0) return res.status(404).json({ error: 'News nicht gefunden oder keine Berechtigung' });

    let veroeffentlichtAm = existing[0].veroeffentlicht_am;
    if (status === 'veroeffentlicht' && existing[0].status !== 'veroeffentlicht') {
      veroeffentlichtAm = new Date();
    }

    const newBildUrl = bild_url !== undefined ? (bild_url || null) : existing[0].bild_url;
    const newBilderJson = bilder_json !== undefined ? (bilder_json || null) : existing[0].bilder_json;
    const newBildCaptions = bild_captions !== undefined ? (bild_captions || null) : existing[0].bild_captions;
    const newAufIntl = auf_intl !== undefined ? (auf_intl ? 1 : 0) : existing[0].auf_intl;

    await pool.query(
      `UPDATE news_articles
       SET titel = ?, inhalt = ?, kurzbeschreibung = ?, zielgruppe = ?, auf_intl = ?, status = ?,
           veroeffentlicht_am = ?, bild_url = ?, bilder_json = ?, bild_captions = ?,
           kategorie = ?, tags = ?, featured = ?, geplant_am = ?, ablauf_am = ?,
           meta_titel = ?, meta_beschreibung = ?
       WHERE id = ?`,
      [
        titel, inhalt, kurzbeschreibung || null,
        zielgruppe || 'alle_dojos', newAufIntl, status || 'entwurf',
        veroeffentlichtAm, newBildUrl, newBilderJson, newBildCaptions,
        kategorie || 'allgemein', tags || null, featured ? 1 : 0,
        geplant_am || null, ablauf_am || null,
        meta_titel || null, meta_beschreibung || null,
        id
      ]
    );

    res.json({ message: 'News erfolgreich aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der News:', { error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren der News' });
  }
});

// DELETE /api/news/:id - News löschen
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const secureDojoId = getSecureDojoId(req);
    let whereClause = 'id = ?';
    const params = [id];
    if (secureDojoId !== null) { whereClause += ' AND dojo_id = ?'; params.push(secureDojoId); }

    const [result] = await pool.query(`DELETE FROM news_articles WHERE ${whereClause}`, params);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'News nicht gefunden oder keine Berechtigung' });

    res.json({ message: 'News erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Fehler beim Löschen der News:', { error });
    res.status(500).json({ error: 'Fehler beim Löschen der News' });
  }
});

module.exports = router;
