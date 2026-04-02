/**
 * PUBLIC PRUEFUNGEN ROUTES
 * ========================
 * Öffentliche API für Prüfungsanmeldungen (kein Auth erforderlich)
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const publicLimiter = rateLimit({ windowMs: 15*60*1000, max: 100, standardHeaders: true, legacyHeaders: false, message: { error: 'Zu viele Anfragen.' } });
const anmeldungLimiter = rateLimit({ windowMs: 60*60*1000, max: 15, standardHeaders: true, legacyHeaders: false, message: { error: 'Zu viele Anmeldeversuche.' } });
const db = require('../db');
const logger = require('../utils/logger');
const { sendPruefungsAnmeldungBestaetigung, sendPruefungsAnmeldungAdminNotification } = require('../services/emailService');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

/**
 * GET /api/public/pruefungen/termine
 * Alle öffentlichen Prüfungstermine laden
 */
router.get('/termine', publicLimiter, async (req, res) => {
  try {
    const { stil_id } = req.query;

    let query = `
      SELECT pt.termin_id, pt.pruefungsdatum, pt.pruefungszeit, pt.pruefungsort,
             pt.pruefer_name, pt.pruefungsgebuehr, pt.anmeldefrist,
             pt.bemerkungen, pt.teilnahmebedingungen, pt.stil_id,
             s.name AS stil_name,
             d.dojoname
      FROM pruefungstermin_vorlagen pt
      INNER JOIN stile s ON pt.stil_id = s.stil_id
      INNER JOIN dojo d ON pt.dojo_id = d.id
      WHERE pt.oeffentlich = 1
        AND (pt.anmeldefrist IS NULL OR pt.anmeldefrist >= CURDATE())
    `;
    const params = [];

    if (stil_id) {
      query += ' AND pt.stil_id = ?';
      params.push(parseInt(stil_id));
    }

    query += ' ORDER BY pt.pruefungsdatum ASC';

    const termine = await queryAsync(query, params);

    res.json({ success: true, count: termine.length, termine });
  } catch (error) {
    logger.error('Fehler beim Laden öffentlicher Prüfungstermine', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler beim Laden der Termine' });
  }
});

/**
 * POST /api/public/pruefungen/anmeldung
 * Externe Prüfungsanmeldung einreichen
 */
router.post('/anmeldung', anmeldungLimiter, async (req, res) => {
  try {
    const {
      termin_id,
      vorname,
      nachname,
      email,
      telefon,
      verein,
      stil_id,
      aktueller_gurt,
      angestrebter_gurt,
      mitglied_id,
      bemerkungen,
      datenschutz_akzeptiert
    } = req.body;

    // Pflichtfelder prüfen
    if (!termin_id || !vorname || !nachname || !email) {
      return res.status(400).json({
        success: false,
        error: 'Bitte füllen Sie alle Pflichtfelder aus (Termin, Vorname, Nachname, E-Mail)'
      });
    }

    if (!datenschutz_akzeptiert) {
      return res.status(400).json({
        success: false,
        error: 'Bitte akzeptieren Sie die Datenschutzerklärung'
      });
    }

    // E-Mail-Format prüfen
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein'
      });
    }

    // Termin existiert und ist öffentlich?
    const termine = await queryAsync(`
      SELECT pt.termin_id, pt.pruefungsdatum, pt.pruefungszeit, pt.pruefungsort,
             pt.pruefungsgebuehr, pt.anmeldefrist, pt.bemerkungen,
             s.name AS stil_name,
             d.dojoname, d.email AS dojo_email
      FROM pruefungstermin_vorlagen pt
      INNER JOIN stile s ON pt.stil_id = s.stil_id
      INNER JOIN dojo d ON pt.dojo_id = d.id
      WHERE pt.termin_id = ? AND pt.oeffentlich = 1
    `, [parseInt(termin_id)]);

    if (termine.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prüfungstermin nicht gefunden oder nicht öffentlich'
      });
    }

    const termin = termine[0];

    // Duplicate-Check: gleiche Email + termin_id
    const existing = await queryAsync(
      'SELECT id FROM pruefungs_anmeldungen WHERE termin_id = ? AND email = ?',
      [parseInt(termin_id), email.toLowerCase().trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Eine Anmeldung mit dieser E-Mail-Adresse für diesen Prüfungstermin existiert bereits.'
      });
    }

    // Anmeldung speichern
    const result = await queryAsync(`
      INSERT INTO pruefungs_anmeldungen
        (termin_id, vorname, nachname, email, telefon, verein, stil_id,
         aktueller_gurt, angestrebter_gurt, mitglied_id, bemerkungen, datenschutz_akzeptiert)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      parseInt(termin_id),
      vorname.trim(),
      nachname.trim(),
      email.toLowerCase().trim(),
      telefon || null,
      verein || null,
      stil_id ? parseInt(stil_id) : null,
      aktueller_gurt || null,
      angestrebter_gurt || null,
      mitglied_id ? parseInt(mitglied_id) : null,
      bemerkungen || null,
      datenschutz_akzeptiert ? 1 : 0
    ]);

    const anmeldung = {
      id: result.insertId,
      vorname: vorname.trim(),
      nachname: nachname.trim(),
      email: email.toLowerCase().trim(),
      telefon,
      verein,
      aktueller_gurt,
      angestrebter_gurt,
      bemerkungen
    };

    logger.info('Neue Prüfungsanmeldung eingegangen', {
      anmeldung_id: result.insertId,
      termin_id,
      email: anmeldung.email
    });

    // E-Mails versenden (async, Fehler nicht blockierend)
    try {
      await sendPruefungsAnmeldungBestaetigung(anmeldung, termin);
      if (termin.dojo_email) {
        await sendPruefungsAnmeldungAdminNotification(anmeldung, termin);
      }
    } catch (emailError) {
      logger.error('Fehler beim E-Mail-Versand für Prüfungsanmeldung', {
        error: emailError.message,
        anmeldung_id: result.insertId
      });
    }

    res.status(201).json({
      success: true,
      message: 'Ihre Anmeldung wurde erfolgreich registriert! Sie erhalten in Kürze eine Bestätigung per E-Mail.',
      data: { anmeldung_id: result.insertId }
    });

  } catch (error) {
    logger.error('Fehler bei Prüfungsanmeldung', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
    });
  }
});

/**
 * GET /api/public/pruefungen/termine/:id/anmeldungen-count
 * Anzahl bestehender Anmeldungen für einen Termin
 */
router.get('/termine/:id/anmeldungen-count', publicLimiter, async (req, res) => {
  try {
    const termin_id = parseInt(req.params.id);
    if (!termin_id || isNaN(termin_id)) {
      return res.status(400).json({ success: false, error: 'Ungültige Termin-ID' });
    }

    const result = await queryAsync(
      "SELECT COUNT(*) AS count FROM pruefungs_anmeldungen WHERE termin_id = ? AND status != 'abgesagt'",
      [termin_id]
    );

    res.json({ success: true, count: result[0].count });
  } catch (error) {
    logger.error('Fehler beim Laden der Anmeldungsanzahl', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

module.exports = router;
