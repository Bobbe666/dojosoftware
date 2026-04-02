const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Middleware: Nur Haupt-Admin (user.id === 1 oder username === 'admin')
const requireMainAdmin = (req, res, next) => {
  const isMainAdmin = req.user.id === 1 ||
                      req.user.user_id === 1 ||
                      req.user.username === 'admin';
  if (!isMainAdmin) {
    return res.status(403).json({
      error: 'Diese Funktion ist nur für den Haupt-Administrator verfügbar'
    });
  }
  next();
};

// GET /api/news - Alle News abrufen (für Admins)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, zielgruppe, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (zielgruppe) {
      whereClause += ' AND zielgruppe = ?';
      params.push(zielgruppe);
    }

    // Count total
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM news_articles WHERE ${whereClause}`,
      params
    );

    // Get news
    const [news] = await db.query(
      `SELECT * FROM news_articles
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      news,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Fehler beim Laden der News:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der News' });
  }
});

// GET /api/news/public - Veröffentlichte News für Member
router.get('/public', authenticateToken, async (req, res) => {
  try {
    const userDojoId = req.user.dojo_id;

    let whereClause = "status = 'veroeffentlicht'";

    // Wenn User NICHT zum TDA-Dojo (id=2) gehört, nur "alle_dojos" News zeigen
    if (userDojoId !== 2) {
      whereClause += " AND zielgruppe = 'alle_dojos'";
    }

    const [news] = await db.query(
      `SELECT id, titel, kurzbeschreibung, inhalt, zielgruppe, veroeffentlicht_am, created_at
       FROM news_articles
       WHERE ${whereClause}
       ORDER BY COALESCE(veroeffentlicht_am, created_at) DESC
       LIMIT 50`
    );

    res.json({ news });
  } catch (error) {
    logger.error('Fehler beim Laden der öffentlichen News:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der News' });
  }
});

// GET /api/news/homepage - News für TDA-VIB Homepage (öffentlich)
router.get('/homepage', async (req, res) => {
  try {
    const [news] = await db.query(
      `SELECT id, titel, kurzbeschreibung, inhalt, veroeffentlicht_am, created_at
       FROM news_articles
       WHERE status = 'veroeffentlicht'
       ORDER BY COALESCE(veroeffentlicht_am, created_at) DESC
       LIMIT 10`
    );

    res.json({ news });
  } catch (error) {
    logger.error('Fehler beim Laden der Homepage-News:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der News' });
  }
});

// GET /api/news/:id - Einzelne News abrufen
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [news] = await db.query(
      'SELECT * FROM news_articles WHERE id = ?',
      [id]
    );

    if (news.length === 0) {
      return res.status(404).json({ error: 'News nicht gefunden' });
    }

    res.json(news[0]);
  } catch (error) {
    logger.error('Fehler beim Laden der News:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der News' });
  }
});

// POST /api/news - Neue News erstellen (nur Haupt-Admin)
router.post('/', authenticateToken, requireMainAdmin, async (req, res) => {
  try {
    const { titel, inhalt, kurzbeschreibung, zielgruppe, status } = req.body;
    const autorId = req.user.id || req.user.user_id;

    if (!titel || !inhalt) {
      return res.status(400).json({ error: 'Titel und Inhalt sind erforderlich' });
    }

    const veroeffentlichtAm = status === 'veroeffentlicht' ? new Date() : null;

    const [result] = await db.query(
      `INSERT INTO news_articles (titel, inhalt, kurzbeschreibung, zielgruppe, status, autor_id, veroeffentlicht_am)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [titel, inhalt, kurzbeschreibung || null, zielgruppe || 'alle_dojos', status || 'entwurf', autorId, veroeffentlichtAm]
    );

    res.status(201).json({
      message: 'News erfolgreich erstellt',
      id: result.insertId
    });
  } catch (error) {
    logger.error('Fehler beim Erstellen der News:', { error: error });
    res.status(500).json({ error: 'Fehler beim Erstellen der News' });
  }
});

// PUT /api/news/:id - News bearbeiten (nur Haupt-Admin)
router.put('/:id', authenticateToken, requireMainAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { titel, inhalt, kurzbeschreibung, zielgruppe, status } = req.body;

    if (!titel || !inhalt) {
      return res.status(400).json({ error: 'Titel und Inhalt sind erforderlich' });
    }

    // Prüfen ob News existiert
    const [existing] = await db.query('SELECT * FROM news_articles WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'News nicht gefunden' });
    }

    // Wenn Status auf "veroeffentlicht" geändert wird und vorher nicht war
    let veroeffentlichtAm = existing[0].veroeffentlicht_am;
    if (status === 'veroeffentlicht' && existing[0].status !== 'veroeffentlicht') {
      veroeffentlichtAm = new Date();
    }

    await db.query(
      `UPDATE news_articles
       SET titel = ?, inhalt = ?, kurzbeschreibung = ?, zielgruppe = ?, status = ?, veroeffentlicht_am = ?
       WHERE id = ?`,
      [titel, inhalt, kurzbeschreibung || null, zielgruppe || 'alle_dojos', status || 'entwurf', veroeffentlichtAm, id]
    );

    res.json({ message: 'News erfolgreich aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der News:', { error: error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren der News' });
  }
});

// DELETE /api/news/:id - News löschen (nur Haupt-Admin)
router.delete('/:id', authenticateToken, requireMainAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query('DELETE FROM news_articles WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'News nicht gefunden' });
    }

    res.json({ message: 'News erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Fehler beim Löschen der News:', { error: error });
    res.status(500).json({ error: 'Fehler beim Löschen der News' });
  }
});

module.exports = router;
