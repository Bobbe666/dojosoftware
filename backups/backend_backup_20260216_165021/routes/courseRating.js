const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db.js');

// Lade bewertbare Kurse für ein Mitglied
router.get('/mitglieder/ratable-courses', async (req, res) => {
  try {
    // Extrahiere Mitglied-ID aus JWT Token oder verwende Test-ID
    const token = req.headers.authorization?.replace('Bearer ', '');
    let userId = 3; // Fallback für Tom Tester
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && decoded.email) {
          // Finde Mitglied-ID über Email
          const memberQuery = 'SELECT mitglied_id FROM mitglieder WHERE email = ?';
          const memberResult = await new Promise((resolve, reject) => {
            db.query(memberQuery, [decoded.email], (err, results) => {
              if (err) reject(err);
              else resolve(results);
            });
          });
          if (memberResult.length > 0) {
            userId = memberResult[0].mitglied_id;
          }
        }
      } catch (e) {

      }
    }

    // Finde Kurse, die das Mitglied besucht hat und noch nicht bewertet wurden
    // WICHTIG: anwesenheit hat stundenplan_id, nicht kurs_id!
    const query = `
      SELECT DISTINCT
        k.kurs_id,
        k.gruppenname as kurs_name,
        CONCAT(t.vorname, ' ', t.nachname) as trainer_name,
        CONCAT(TIME_FORMAT(sp.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(sp.uhrzeit_ende, '%H:%i')) as uhrzeit,
        sp.uhrzeit_start,
        sp.uhrzeit_ende,
        'Hauptraum' as raum,
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
    
    const courses = await new Promise((resolve, reject) => {
      db.query(query, [userId, userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Formatiere die Daten
    const formattedCourses = courses.map(course => ({
      id: course.kurs_id,
      kurs_name: course.kurs_name,
      trainer_name: course.trainer_name || 'Trainer',
      datum: course.datum,
      uhrzeit: course.uhrzeit,
      raum: course.raum || 'Hauptraum',
      duration: course.duration || 60,
      rated: course.rated
    }));

    res.json({
      success: true,
      courses: formattedCourses
    });
    
  } catch (error) {
    logger.error('Fehler beim Laden der bewertbaren Kurse:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Kurse'
    });
  }
});

// Bewertung absenden
router.post('/mitglieder/submit-rating', async (req, res) => {
  try {
    // Extrahiere Mitglied-ID aus JWT Token oder verwende Test-ID
    const token = req.headers.authorization?.replace('Bearer ', '');
    let userId = 3; // Fallback für Tom Tester
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && decoded.email) {
          // Finde Mitglied-ID über Email
          const memberQuery = 'SELECT mitglied_id FROM mitglieder WHERE email = ?';
          const memberResult = await new Promise((resolve, reject) => {
            db.query(memberQuery, [decoded.email], (err, results) => {
              if (err) reject(err);
              else resolve(results);
            });
          });
          if (memberResult.length > 0) {
            userId = memberResult[0].mitglied_id;
          }
        }
      } catch (e) {

      }
    }
    
    const { courseId, rating, comment } = req.body;
    
    // Validierung
    if (!courseId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Ungültige Bewertungsdaten'
      });
    }
    
    // Prüfe ob der Kurs besucht wurde (über stundenplan_id)
    const attendanceCheck = `
      SELECT a.id FROM anwesenheit a
      JOIN stundenplan sp ON a.stundenplan_id = sp.stundenplan_id
      WHERE a.mitglied_id = ? AND sp.kurs_id = ? AND a.anwesend = 1
      LIMIT 1
    `;
    
    const attendance = await new Promise((resolve, reject) => {
      db.query(attendanceCheck, [userId, courseId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (attendance.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Du kannst nur Kurse bewerten, die du besucht hast'
      });
    }
    
    // Prüfe ob bereits bewertet wurde
    const existingRating = `
      SELECT id FROM kurs_bewertungen 
      WHERE mitglied_id = ? AND kurs_id = ?
    `;
    
    const existing = await new Promise((resolve, reject) => {
      db.query(existingRating, [userId, courseId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Dieser Kurs wurde bereits bewertet'
      });
    }
    
    // Speichere die Bewertung
    const insertRating = `
      INSERT INTO kurs_bewertungen (mitglied_id, kurs_id, bewertung, kommentar, erstellt_am)
      VALUES (?, ?, ?, ?, NOW())
    `;
    
    await new Promise((resolve, reject) => {
      db.query(insertRating, [userId, courseId, rating, comment || null], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json({
      success: true,
      message: 'Bewertung erfolgreich gespeichert'
    });
    
  } catch (error) {
    logger.error('Fehler beim Speichern der Bewertung:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Fehler beim Speichern der Bewertung'
    });
  }
});

// Lade Bewertungen für Admin (Auswertungen)
router.get('/admin/course-ratings', async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.bewertung,
        r.kommentar,
        r.erstellt_am,
        k.kurs_name,
        k.uhrzeit,
        k.raum,
        m.vorname as mitglied_vorname,
        m.nachname as mitglied_nachname,
        t.vorname as trainer_vorname,
        t.nachname as trainer_nachname
      FROM kurs_bewertungen r
      JOIN kurse k ON r.kurs_id = k.kurs_id
      JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      JOIN mitglieder t ON k.trainer_id = t.mitglied_id
      ORDER BY r.erstellt_am DESC
      LIMIT 100
    `;
    
    const ratings = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json({
      success: true,
      ratings: ratings
    });
    
  } catch (error) {
    logger.error('Fehler beim Laden der Bewertungen:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Bewertungen'
    });
  }
});

// Statistiken für Admin
router.get('/admin/rating-stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_ratings,
        AVG(bewertung) as average_rating,
        COUNT(CASE WHEN bewertung = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN bewertung = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN bewertung = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN bewertung = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN bewertung = 1 THEN 1 END) as one_star,
        COUNT(CASE WHEN kommentar IS NOT NULL AND kommentar != '' THEN 1 END) as with_comments
      FROM kurs_bewertungen
    `;
    
    const stats = await new Promise((resolve, reject) => {
      db.query(statsQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    const courseStatsQuery = `
      SELECT 
        k.kurs_name,
        COUNT(r.id) as rating_count,
        AVG(r.bewertung) as average_rating
      FROM kurse k
      LEFT JOIN kurs_bewertungen r ON k.kurs_id = r.kurs_id
      GROUP BY k.kurs_id, k.kurs_name
      HAVING rating_count > 0
      ORDER BY average_rating DESC, rating_count DESC
    `;
    
    const courseStats = await new Promise((resolve, reject) => {
      db.query(courseStatsQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json({
      success: true,
      overall: stats[0],
      byCourse: courseStats
    });
    
  } catch (error) {
    logger.error('Fehler beim Laden der Bewertungsstatistiken:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Statistiken'
    });
  }
});

module.exports = router;
