/**
 * PUBLIC PROBETRAINING ROUTES
 * ===========================
 * Öffentliche API für Probetraining-Buchungen (kein Auth erforderlich)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { sendProbetrainingAnfrageEmail, sendProbetrainingBestaetigung } = require('../services/emailService');

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
 * GET /api/public/probetraining/dojo/:subdomain
 * Dojo-Infos und verfügbare Kurse für Probetraining laden
 */
router.get('/dojo/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;

    // Dojo anhand Subdomain finden
    const dojos = await queryAsync(`
      SELECT d.id, d.dojoname, d.untertitel, d.logo_url, d.email, d.telefon,
             d.strasse, d.hausnummer, d.plz, d.ort
      FROM dojo d
      WHERE d.subdomain = ? AND d.ist_aktiv = 1
    `, [subdomain]);

    if (dojos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dojo nicht gefunden'
      });
    }

    const dojo = dojos[0];

    // Verfügbare Stile des Dojos laden
    const stile = await queryAsync(`
      SELECT DISTINCT s.stil_id, s.name
      FROM stile s
      INNER JOIN kurse k ON k.stil = s.name
      WHERE k.dojo_id = ?
      ORDER BY s.name
    `, [dojo.id]);

    // Stundenplan mit Kursen laden (für Probetraining geeignete)
    const kurse = await queryAsync(`
      SELECT sp.stundenplan_id, sp.tag as wochentag, sp.uhrzeit_start as start_zeit, sp.uhrzeit_ende as end_zeit,
             k.kurs_id, k.gruppenname as name, k.stil as stil_name,
             r.name as raum_name,
             t.vorname as trainer_vorname, t.nachname as trainer_nachname
      FROM stundenplan sp
      INNER JOIN kurse k ON sp.kurs_id = k.kurs_id
      LEFT JOIN raeume r ON sp.raum_id = r.id
      LEFT JOIN trainer t ON sp.trainer_id = t.trainer_id
      WHERE k.dojo_id = ? AND (k.probetraining_erlaubt = 1 OR k.probetraining_erlaubt IS NULL)
      ORDER BY FIELD(sp.tag, 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'),
               sp.uhrzeit_start
    `, [dojo.id]);

    res.json({
      success: true,
      data: {
        dojo: {
          id: dojo.id,
          name: dojo.dojoname,
          beschreibung: dojo.untertitel || '',
          logo_url: dojo.logo_url,
          kontakt: {
            email: dojo.email,
            telefon: dojo.telefon,
            adresse: `${dojo.strasse || ''} ${dojo.hausnummer || ''}, ${dojo.plz || ''} ${dojo.ort || ''}`.trim()
          }
        },
        stile,
        kurse: kurse.map(k => ({
          ...k,
          verfuegbar: !k.max_teilnehmer || k.aktuelle_teilnehmer < k.max_teilnehmer
        }))
      }
    });

  } catch (error) {
    logger.error('Fehler beim Laden der Dojo-Daten für Probetraining', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Serverfehler beim Laden der Daten'
    });
  }
});

/**
 * POST /api/public/probetraining/buchen
 * Probetraining-Anfrage einreichen
 */
router.post('/buchen', async (req, res) => {
  try {
    const {
      dojo_id,
      vorname,
      nachname,
      email,
      telefon,
      stil_id,
      kurs_id,
      wunsch_wochentag,
      wunsch_uhrzeit,
      wunschdatum,
      nachricht,
      datenschutz_akzeptiert,
      wie_gefunden
    } = req.body;

    // Validierung
    if (!dojo_id || !vorname || !nachname || !email) {
      return res.status(400).json({
        success: false,
        error: 'Bitte füllen Sie alle Pflichtfelder aus (Vorname, Nachname, E-Mail)'
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

    // Dojo existiert?
    const dojos = await queryAsync('SELECT id, dojoname, email as dojo_email FROM dojo WHERE id = ?', [dojo_id]);
    if (dojos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dojo nicht gefunden'
      });
    }
    const dojo = dojos[0];

    // Kurs-Details laden (falls ausgewählt)
    let kursDetails = null;
    if (kurs_id) {
      const kurse = await queryAsync(`
        SELECT sp.stundenplan_id, sp.tag as wochentag, sp.uhrzeit_start as start_zeit, sp.uhrzeit_ende as end_zeit,
               k.kurs_id, k.gruppenname as name, k.stil as stil_name,
               r.name as raum_name,
               t.vorname as trainer_vorname, t.nachname as trainer_nachname
        FROM stundenplan sp
        INNER JOIN kurse k ON sp.kurs_id = k.kurs_id
        LEFT JOIN raeume r ON sp.raum_id = r.id
        LEFT JOIN trainer t ON sp.trainer_id = t.trainer_id
        WHERE sp.stundenplan_id = ? OR k.kurs_id = ?
        LIMIT 1
      `, [kurs_id, kurs_id]);
      if (kurse.length > 0) {
        kursDetails = kurse[0];
      }
    }

    // Prüfen ob diese E-Mail bereits eine offene Anfrage hat
    const bestehendeAnfragen = await queryAsync(`
      SELECT id FROM interessenten
      WHERE dojo_id = ? AND email = ? AND status IN ('neu', 'probetraining_vereinbart')
      AND erstellt_am > DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [dojo_id, email]);

    if (bestehendeAnfragen.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Sie haben bereits eine offene Probetraining-Anfrage. Wir melden uns in Kürze bei Ihnen.'
      });
    }

    // Interessent anlegen
    const result = await queryAsync(`
      INSERT INTO interessenten (
        dojo_id, vorname, nachname, email, telefon,
        interessiert_an, gewuenschter_kurs_id, wunsch_wochentag, wunsch_uhrzeit,
        probetraining_datum, notizen,
        status, anfrage_quelle, erstkontakt_datum, erstkontakt_quelle,
        datenschutz_akzeptiert, datenschutz_akzeptiert_am,
        prioritaet, erstellt_am
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'neu', 'probetraining_formular', CURDATE(), ?, 1, NOW(), 'hoch', NOW())
    `, [
      dojo_id,
      vorname.trim(),
      nachname.trim(),
      email.toLowerCase().trim(),
      telefon || null,
      stil_id ? `Stil-ID: ${stil_id}` : null,
      kurs_id || null,
      wunsch_wochentag || (kursDetails ? kursDetails.wochentag : null),
      wunsch_uhrzeit || (kursDetails ? kursDetails.start_zeit : null),
      wunschdatum || null,
      nachricht || null,
      wie_gefunden || 'Probetraining-Formular'
    ]);

    const interessentId = result.insertId;

    logger.info('Neue Probetraining-Anfrage eingegangen', {
      interessent_id: interessentId,
      dojo_id,
      email,
      kurs_id
    });

    // E-Mails versenden (async, Fehler nicht blockierend)
    try {
      // E-Mail an Dojo-Admin
      if (dojo.dojo_email) {
        await sendProbetrainingAnfrageEmail({
          to: dojo.dojo_email,
          dojoName: dojo.dojoname,
          interessent: { vorname, nachname, email, telefon },
          kurs: kursDetails,
          wunschdatum,
          nachricht
        });
      }

      // Bestätigung an Interessent
      await sendProbetrainingBestaetigung({
        to: email,
        vorname,
        dojoName: dojo.dojoname,
        kurs: kursDetails,
        wunschdatum
      });

      // Bestätigung gesendet markieren
      await queryAsync(
        'UPDATE interessenten SET bestaetigung_gesendet_am = NOW() WHERE id = ?',
        [interessentId]
      );

    } catch (emailError) {
      logger.error('Fehler beim E-Mail-Versand für Probetraining', {
        error: emailError.message,
        interessent_id: interessentId
      });
      // Weiter machen - E-Mail-Fehler sollte nicht die Buchung abbrechen
    }

    res.status(201).json({
      success: true,
      message: 'Vielen Dank für Ihre Anfrage! Wir melden uns in Kürze bei Ihnen.',
      data: {
        anfrage_id: interessentId,
        dojo_name: dojo.dojoname
      }
    });

  } catch (error) {
    logger.error('Fehler bei Probetraining-Buchung', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
    });
  }
});

module.exports = router;
