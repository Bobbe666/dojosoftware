/**
 * FEATURE REQUESTS ROUTES
 * =======================
 * API fuer Feature-Wuensche und Voting
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');

// Promise-Wrapper fuer db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Hilfsfunktion: Ist Admin?
const isAdmin = (user) => {
  if (!user) return false;
  return user.rolle === 'admin' || user.role === 'admin' ||
         user.rolle === 'super_admin' || user.role === 'super_admin' ||
         user.username === 'admin';
};

// Hilfsfunktion: Ist SuperAdmin?
const isSuperAdmin = (user) => {
  if (!user) return false;
  return user.rolle === 'super_admin' || user.role === 'super_admin' || user.username === 'admin';
};

/**
 * GET /api/feature-requests
 * Alle Feature-Requests abrufen (mit Filtern)
 */
router.get('/', async (req, res) => {
  try {
    const { status, kategorie, sortBy = 'votes', limit = 50, offset = 0 } = req.query;
    const user = req.user;

    let query = `
      SELECT fr.*,
        (SELECT COUNT(*) FROM feature_votes WHERE feature_id = fr.id) as votes_count,
        EXISTS(
          SELECT 1 FROM feature_votes fv
          WHERE fv.feature_id = fr.id
          AND fv.user_typ = ?
          AND fv.user_id = ?
        ) as user_voted
      FROM feature_requests fr
      WHERE 1=1
    `;

    const userTyp = user.mitglied_id ? 'mitglied' : 'user';
    const userId = user.mitglied_id || user.user_id || user.id;
    const params = [userTyp, userId];

    // Filter
    if (status && status !== 'alle') {
      query += ' AND fr.status = ?';
      params.push(status);
    }
    if (kategorie && kategorie !== 'alle') {
      query += ' AND fr.kategorie = ?';
      params.push(kategorie);
    }

    // Sortierung
    if (sortBy === 'votes') {
      query += ' ORDER BY votes_count DESC, fr.created_at DESC';
    } else if (sortBy === 'newest') {
      query += ' ORDER BY fr.created_at DESC';
    } else if (sortBy === 'status') {
      query += ' ORDER BY FIELD(fr.status, "in_arbeit", "geplant", "geprueft", "neu", "umgesetzt", "abgelehnt"), fr.created_at DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const requests = await queryAsync(query, params);

    // Statistiken
    const stats = await queryAsync(`
      SELECT
        COUNT(*) as gesamt,
        SUM(CASE WHEN status = 'neu' THEN 1 ELSE 0 END) as neu,
        SUM(CASE WHEN status = 'geplant' THEN 1 ELSE 0 END) as geplant,
        SUM(CASE WHEN status = 'in_arbeit' THEN 1 ELSE 0 END) as in_arbeit,
        SUM(CASE WHEN status = 'umgesetzt' THEN 1 ELSE 0 END) as umgesetzt
      FROM feature_requests
    `);

    res.json({
      success: true,
      data: requests,
      stats: stats[0],
      pagination: { limit: parseInt(limit), offset: parseInt(offset), count: requests.length }
    });

  } catch (error) {
    logger.error('Fehler beim Laden der Feature-Requests', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

/**
 * GET /api/feature-requests/:id
 * Einzelnen Feature-Request abrufen
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const userTyp = user.mitglied_id ? 'mitglied' : 'user';
    const userId = user.mitglied_id || user.user_id || user.id;

    const requests = await queryAsync(`
      SELECT fr.*,
        (SELECT COUNT(*) FROM feature_votes WHERE feature_id = fr.id) as votes_count,
        EXISTS(
          SELECT 1 FROM feature_votes fv
          WHERE fv.feature_id = fr.id
          AND fv.user_typ = ?
          AND fv.user_id = ?
        ) as user_voted
      FROM feature_requests fr
      WHERE fr.id = ?
    `, [userTyp, userId, id]);

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Feature-Request nicht gefunden' });
    }

    res.json({ success: true, data: requests[0] });

  } catch (error) {
    logger.error('Fehler beim Laden des Feature-Requests', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

/**
 * POST /api/feature-requests
 * Neuen Feature-Request erstellen
 */
router.post('/', async (req, res) => {
  try {
    const user = req.user;
    const { titel, beschreibung, kategorie = 'funktion' } = req.body;

    if (!titel || titel.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'Titel muss mindestens 5 Zeichen haben' });
    }

    const erstellerTyp = user.mitglied_id ? 'mitglied' : (isAdmin(user) ? 'admin' : 'user');
    const erstellerId = user.mitglied_id || user.user_id || user.id;
    const erstellerName = user.vorname ? `${user.vorname} ${user.nachname}` : user.username;
    const erstellerEmail = user.email;
    const dojoId = user.dojo_id || null;

    const result = await queryAsync(`
      INSERT INTO feature_requests
      (titel, beschreibung, kategorie, ersteller_typ, ersteller_id, ersteller_name, ersteller_email, dojo_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [titel.trim(), beschreibung?.trim() || '', kategorie, erstellerTyp, erstellerId, erstellerName, erstellerEmail, dojoId]);

    // Automatisch selbst upvoten
    await queryAsync(`
      INSERT INTO feature_votes (feature_id, user_typ, user_id) VALUES (?, ?, ?)
    `, [result.insertId, erstellerTyp, erstellerId]);

    // votes_count aktualisieren
    await queryAsync('UPDATE feature_requests SET votes_count = 1 WHERE id = ?', [result.insertId]);

    logger.info('Feature-Request erstellt', { id: result.insertId, titel, user: erstellerName });

    res.status(201).json({
      success: true,
      message: 'Feature-Wunsch erfolgreich eingereicht',
      data: { id: result.insertId }
    });

  } catch (error) {
    logger.error('Fehler beim Erstellen des Feature-Requests', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

/**
 * POST /api/feature-requests/:id/vote
 * Fuer einen Feature-Request abstimmen (toggle)
 */
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const userTyp = user.mitglied_id ? 'mitglied' : 'user';
    const userId = user.mitglied_id || user.user_id || user.id;

    // Pruefen ob bereits abgestimmt
    const existingVote = await queryAsync(
      'SELECT id FROM feature_votes WHERE feature_id = ? AND user_typ = ? AND user_id = ?',
      [id, userTyp, userId]
    );

    if (existingVote.length > 0) {
      // Vote entfernen
      await queryAsync('DELETE FROM feature_votes WHERE id = ?', [existingVote[0].id]);
      await queryAsync('UPDATE feature_requests SET votes_count = votes_count - 1 WHERE id = ? AND votes_count > 0', [id]);

      res.json({ success: true, message: 'Stimme entfernt', voted: false });
    } else {
      // Vote hinzufuegen
      await queryAsync(
        'INSERT INTO feature_votes (feature_id, user_typ, user_id) VALUES (?, ?, ?)',
        [id, userTyp, userId]
      );
      await queryAsync('UPDATE feature_requests SET votes_count = votes_count + 1 WHERE id = ?', [id]);

      res.json({ success: true, message: 'Stimme abgegeben', voted: true });
    }

  } catch (error) {
    logger.error('Fehler beim Abstimmen', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

/**
 * PUT /api/feature-requests/:id/status
 * Status eines Feature-Requests aendern (nur Admin)
 */
router.put('/:id/status', async (req, res) => {
  try {
    const user = req.user;

    if (!isSuperAdmin(user)) {
      return res.status(403).json({ success: false, error: 'Keine Berechtigung' });
    }

    const { id } = req.params;
    const { status, admin_kommentar } = req.body;

    const validStatus = ['neu', 'geprueft', 'geplant', 'in_arbeit', 'umgesetzt', 'abgelehnt'];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ success: false, error: 'Ungueltiger Status' });
    }

    await queryAsync(`
      UPDATE feature_requests
      SET status = ?, admin_kommentar = ?, bearbeitet_von = ?, updated_at = NOW()
      WHERE id = ?
    `, [status, admin_kommentar || null, user.user_id || user.id, id]);

    logger.info('Feature-Request Status geaendert', { id, status, user: user.username });

    res.json({ success: true, message: 'Status aktualisiert' });

  } catch (error) {
    logger.error('Fehler beim Status-Update', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

/**
 * DELETE /api/feature-requests/:id
 * Feature-Request loeschen (nur Admin oder Ersteller)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const userTyp = user.mitglied_id ? 'mitglied' : 'user';
    const userId = user.mitglied_id || user.user_id || user.id;

    // Pruefen ob Ersteller oder Admin
    const request = await queryAsync('SELECT ersteller_typ, ersteller_id FROM feature_requests WHERE id = ?', [id]);

    if (request.length === 0) {
      return res.status(404).json({ success: false, error: 'Feature-Request nicht gefunden' });
    }

    const isOwner = request[0].ersteller_typ === userTyp && request[0].ersteller_id === userId;

    if (!isOwner && !isSuperAdmin(user)) {
      return res.status(403).json({ success: false, error: 'Keine Berechtigung' });
    }

    await queryAsync('DELETE FROM feature_requests WHERE id = ?', [id]);

    logger.info('Feature-Request geloescht', { id, user: user.username });

    res.json({ success: true, message: 'Feature-Wunsch geloescht' });

  } catch (error) {
    logger.error('Fehler beim Loeschen', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

module.exports = router;
