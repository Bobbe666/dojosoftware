const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db.js');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// Hilfsfunktion: mitglied_id aus req.user ermitteln
const getMitgliedId = async (req) => {
  if (!req.user) throw new Error('Nicht authentifiziert');
  // req.user.mitglied_id direkt (Member-JWT) oder über email lookup (Admin-JWT)
  if (req.user.mitglied_id) return req.user.mitglied_id;
  if (req.user.email) {
    const [rows] = await db.promise().query(
      'SELECT mitglied_id FROM mitglieder WHERE email = ?', [req.user.email]
    );
    if (rows.length > 0) return rows[0].mitglied_id;
  }
  throw new Error('Mitglied nicht gefunden');
};

// Lade bewertbare Kurse für ein Mitglied
router.get('/mitglieder/ratable-courses', async (req, res) => {
  try {
    const userId = await getMitgliedId(req);

    const query = `
      SELECT DISTINCT
        k.kurs_id,
        k.gruppenname as kurs_name,
        CONCAT(t.vorname, ' ', t.nachname) as trainer_name,
        CONCAT(TIME_FORMAT(sp.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(sp.uhrzeit_ende, '%H:%i')) as uhrzeit,
        sp.uhrzeit_start,
        sp.uhrzeit_ende,
        TIMESTAMPDIFF(MINUTE, sp.uhrzeit_start, sp.uhrzeit_ende) as duration,
        a.datum,
        CASE WHEN r.id IS NULL THEN false ELSE true END as rated
      FROM anwesenheit a
      JOIN stundenplan sp ON a.stundenplan_id = sp.stundenplan_id
      JOIN kurse k ON sp.kurs_id = k.kurs_id
      LEFT JOIN trainer t ON sp.trainer_id = t.trainer_id
      LEFT JOIN kurs_bewertungen r ON k.kurs_id = r.kurs_id AND r.mitglied_id = ?
      WHERE a.mitglied_id = ?
        AND a.datum <= CURDATE()
        AND a.anwesend = 1
        AND a.datum >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      ORDER BY a.datum DESC, uhrzeit DESC
    `;

    const [courses] = await db.promise().query(query, [userId, userId]);

    res.json({
      success: true,
      courses: courses.map(c => ({
        id: c.kurs_id,
        kurs_name: c.kurs_name,
        trainer_name: c.trainer_name || 'Trainer',
        datum: c.datum,
        uhrzeit: c.uhrzeit,
        duration: c.duration || 60,
        rated: c.rated
      }))
    });
  } catch (error) {
    logger.error('Fehler beim Laden der bewertbaren Kurse:', { error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Kurse' });
  }
});

// Bewertung absenden
router.post('/mitglieder/submit-rating', async (req, res) => {
  try {
    const userId = await getMitgliedId(req);
    const { courseId, rating, comment } = req.body;

    if (!courseId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Ungültige Bewertungsdaten' });
    }

    // Prüfe ob der Kurs besucht wurde
    const [attendance] = await db.promise().query(
      `SELECT a.id FROM anwesenheit a
       JOIN stundenplan sp ON a.stundenplan_id = sp.stundenplan_id
       WHERE a.mitglied_id = ? AND sp.kurs_id = ? AND a.anwesend = 1 LIMIT 1`,
      [userId, courseId]
    );

    if (attendance.length === 0) {
      return res.status(403).json({ success: false, message: 'Du kannst nur Kurse bewerten, die du besucht hast' });
    }

    // Prüfe ob bereits bewertet
    const [existing] = await db.promise().query(
      'SELECT id FROM kurs_bewertungen WHERE mitglied_id = ? AND kurs_id = ?',
      [userId, courseId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Dieser Kurs wurde bereits bewertet' });
    }

    await db.promise().query(
      'INSERT INTO kurs_bewertungen (mitglied_id, kurs_id, bewertung, kommentar, erstellt_am) VALUES (?, ?, ?, ?, NOW())',
      [userId, courseId, rating, comment || null]
    );

    res.json({ success: true, message: 'Bewertung erfolgreich gespeichert' });
  } catch (error) {
    logger.error('Fehler beim Speichern der Bewertung:', { error });
    res.status(500).json({ success: false, message: 'Fehler beim Speichern der Bewertung' });
  }
});

// Admin: Bewertungen (mit dojo_id Filter)
router.get('/admin/course-ratings', async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const dojoFilter = secureDojoId ? 'AND k.dojo_id = ?' : '';
    const params = secureDojoId ? [secureDojoId] : [];

    const [ratings] = await db.promise().query(`
      SELECT r.id, r.bewertung, r.kommentar, r.erstellt_am,
             k.gruppenname as kurs_name,
             m.vorname as mitglied_vorname, m.nachname as mitglied_nachname,
             t.vorname as trainer_vorname, t.nachname as trainer_nachname
      FROM kurs_bewertungen r
      JOIN kurse k ON r.kurs_id = k.kurs_id
      JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
      WHERE 1=1 ${dojoFilter}
      ORDER BY r.erstellt_am DESC LIMIT 100
    `, params);

    res.json({ success: true, ratings });
  } catch (error) {
    logger.error('Fehler beim Laden der Bewertungen:', { error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Bewertungen' });
  }
});

// Admin: Statistiken (mit dojo_id Filter)
router.get('/admin/rating-stats', async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const dojoFilter = secureDojoId ? 'JOIN kurse k ON r.kurs_id = k.kurs_id WHERE k.dojo_id = ?' : '';
    const params = secureDojoId ? [secureDojoId] : [];

    const [stats] = await db.promise().query(`
      SELECT COUNT(*) as total_ratings, AVG(r.bewertung) as average_rating,
             COUNT(CASE WHEN r.bewertung = 5 THEN 1 END) as five_star,
             COUNT(CASE WHEN r.bewertung = 4 THEN 1 END) as four_star,
             COUNT(CASE WHEN r.bewertung = 3 THEN 1 END) as three_star,
             COUNT(CASE WHEN r.bewertung = 2 THEN 1 END) as two_star,
             COUNT(CASE WHEN r.bewertung = 1 THEN 1 END) as one_star
      FROM kurs_bewertungen r ${dojoFilter}
    `, params);

    const courseFilter = secureDojoId ? 'WHERE k.dojo_id = ?' : '';
    const [courseStats] = await db.promise().query(`
      SELECT k.gruppenname as kurs_name, COUNT(r.id) as rating_count, AVG(r.bewertung) as average_rating
      FROM kurse k LEFT JOIN kurs_bewertungen r ON k.kurs_id = r.kurs_id
      ${courseFilter}
      GROUP BY k.kurs_id, k.gruppenname HAVING rating_count > 0
      ORDER BY average_rating DESC, rating_count DESC
    `, params);

    res.json({ success: true, overall: stats[0], byCourse: courseStats });
  } catch (error) {
    logger.error('Fehler beim Laden der Bewertungsstatistiken:', { error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Statistiken' });
  }
});

module.exports = router;
