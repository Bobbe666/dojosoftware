/**
 * PUBLIC PROBETRAINING ROUTES
 * ===========================
 * Öffentliche API für Probetraining-Buchungen (kein Auth erforderlich)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const { sendProbetrainingAnfrageEmail, sendProbetrainingBestaetigung, sendProbetrainingTerminBestaetigung } = require('../services/emailService');

// Basis-URL der Dojo-App (dort liegt die öffentliche Buchungsseite /probetraining/termin/:token)
const APP_BASE = process.env.PUBLIC_APP_URL || 'https://dojo.tda-intl.org';
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Nächste N Vorkommen eines deutschen Wochentags ab „in abTagen Tagen", als YYYY-MM-DD
function naechsteTermine(tagName, anzahl = 3, abTagen = 2) {
  const idx = WOCHENTAGE.indexOf(tagName);
  if (idx < 0) return [];
  const res = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + abTagen);
  for (let i = 0; i < 70 && res.length < anzahl; i++) {
    if (d.getDay() === idx) res.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return res;
}

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
             d.strasse, d.hausnummer, d.plz, d.ort, d.theme_farbe, d.theme_scheme
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
          farbe: dojo.theme_farbe || null,
          theme_scheme: dojo.theme_scheme || 'default',
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
 * GET /api/public/probetraining/stundenplan/:dojo_id
 * Stundenplan-basierte Slots für Probetraining-Buchung (öffentlich)
 */
router.get('/stundenplan/:dojo_id', async (req, res) => {
  try {
    const { dojo_id } = req.params;
    const kurse = await queryAsync(`
      SELECT sp.stundenplan_id, sp.tag AS wochentag,
             TIME_FORMAT(sp.uhrzeit_start, '%H:%i') AS uhrzeit_start,
             TIME_FORMAT(sp.uhrzeit_ende, '%H:%i') AS uhrzeit_ende,
             k.kurs_id, k.gruppenname AS kursname, k.stil AS stil_name,
             CONCAT(t.vorname, ' ', t.nachname) AS trainer
      FROM stundenplan sp
      INNER JOIN kurse k ON sp.kurs_id = k.kurs_id
      LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
      WHERE k.dojo_id = ? AND (k.probetraining_erlaubt = 1 OR k.probetraining_erlaubt IS NULL)
      ORDER BY FIELD(sp.tag, 'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'),
               sp.uhrzeit_start
    `, [dojo_id]);
    res.json({ success: true, data: kurse });
  } catch (error) {
    logger.error('Fehler beim Laden der Probetraining-Slots', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler' });
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
      interessiert_an,
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

    // Direkt-Buchung (Variante B): hat der Kunde einen konkreten Slot + gültiges
    // Datum gewählt, wird sofort verbindlich gebucht — sonst nur Anfrage ("wir melden uns").
    const kandidatDatum = req.body.probetraining_datum || wunschdatum || null;
    let gebuchtesDatum = null;
    let direkt = false;
    if (kursDetails && kandidatDatum) {
      const d = new Date(kandidatDatum + 'T00:00:00');
      const heute = new Date(); heute.setHours(0, 0, 0, 0);
      if (!isNaN(d.getTime()) && d >= heute && WOCHENTAGE[d.getDay()] === kursDetails.wochentag) {
        gebuchtesDatum = kandidatDatum;
        direkt = true;
      }
    }
    const slotZeit = kursDetails && kursDetails.start_zeit ? String(kursDetails.start_zeit).substring(0, 5) : null;
    const status = direkt ? 'probetraining_vereinbart' : 'neu';

    // Interessent anlegen (gewuenschter_kurs_id = echte kurs_id)
    const result = await queryAsync(`
      INSERT INTO interessenten (
        dojo_id, vorname, nachname, email, telefon,
        interessiert_an, gewuenschter_kurs_id, wunsch_wochentag, wunsch_uhrzeit,
        probetraining_datum, probetraining_uhrzeit, probetraining_stundenplan_id, notizen,
        status, anfrage_quelle, erstkontakt_datum, erstkontakt_quelle,
        datenschutz_akzeptiert, datenschutz_akzeptiert_am, prioritaet, erstellt_am
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'probetraining_formular', CURDATE(), ?, 1, NOW(), 'hoch', NOW())
    `, [
      dojo_id,
      vorname.trim(),
      nachname.trim(),
      email.toLowerCase().trim(),
      telefon || null,
      interessiert_an || (stil_id ? `Stil-ID: ${stil_id}` : null),
      kursDetails ? kursDetails.kurs_id : null,
      kursDetails ? kursDetails.wochentag : (wunsch_wochentag || null),
      slotZeit || wunsch_uhrzeit || null,
      gebuchtesDatum || wunschdatum || null,
      direkt ? slotZeit : null,
      direkt ? kursDetails.stundenplan_id : null,
      nachricht || null,
      status,
      wie_gefunden || 'Probetraining-Formular'
    ]);

    const interessentId = result.insertId;
    const trainerName = kursDetails ? `${kursDetails.trainer_vorname || ''} ${kursDetails.trainer_nachname || ''}`.trim() : '';

    logger.info(direkt ? 'Probetraining direkt gebucht (Formular)' : 'Neue Probetraining-Anfrage eingegangen', {
      interessent_id: interessentId, dojo_id, email, kurs_id, direkt, gebuchtesDatum
    });

    // E-Mails versenden (async, Fehler nicht blockierend)
    try {
      if (direkt) {
        // Finale Terminbestätigung an Kunde
        await sendProbetrainingTerminBestaetigung({
          to: email, vorname, dojoName: dojo.dojoname, dojoId: dojo_id,
          datum: gebuchtesDatum, uhrzeit: slotZeit, kurs: kursDetails.name, stil: kursDetails.stil_name, trainer: trainerName
        });
        if (dojo.dojo_email) {
          await sendProbetrainingAnfrageEmail({
            to: dojo.dojo_email, dojoName: dojo.dojoname,
            interessent: { vorname, nachname, email, telefon }, kurs: kursDetails, wunschdatum: gebuchtesDatum,
            nachricht: `✅ DIREKT GEBUCHT übers Formular: ${kursDetails.wochentag}, ${new Date(gebuchtesDatum).toLocaleDateString('de-DE')} um ${slotZeit} — ${kursDetails.name}`
          });
        }
      } else {
        // Nur Anfrage → Eingangsbestätigung ("wir melden uns"), Dojo-Info
        if (dojo.dojo_email) {
          await sendProbetrainingAnfrageEmail({
            to: dojo.dojo_email, dojoName: dojo.dojoname,
            interessent: { vorname, nachname, email, telefon }, kurs: kursDetails, wunschdatum, nachricht
          });
        }
        await sendProbetrainingBestaetigung({
          to: email, vorname, dojoName: dojo.dojoname, dojoId: dojo_id, kurs: kursDetails, wunschdatum
        });
      }
      await queryAsync('UPDATE interessenten SET bestaetigung_gesendet_am = NOW() WHERE id = ?', [interessentId]);
    } catch (emailError) {
      logger.error('Fehler beim E-Mail-Versand für Probetraining', { error: emailError.message, interessent_id: interessentId });
    }

    res.status(201).json({
      success: true,
      gebucht: direkt,
      message: direkt
        ? 'Dein Probetraining ist gebucht! Du bekommst gleich eine Bestätigung per E-Mail.'
        : 'Vielen Dank für Ihre Anfrage! Wir melden uns in Kürze bei Ihnen.',
      data: {
        anfrage_id: interessentId,
        dojo_name: dojo.dojoname,
        ...(direkt ? { datum: gebuchtesDatum, uhrzeit: slotZeit, kurs: kursDetails.name, wochentag: kursDetails.wochentag, trainer: trainerName } : {})
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

/**
 * GET /api/public/probetraining/termin/:token
 * Lädt die Buchungsseite: Interessent-Basics, Dojo, verfügbare Slots + nächste Termine.
 */
router.get('/termin/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const rows = await queryAsync(`
      SELECT i.id, i.vorname, i.nachname, i.dojo_id, i.gewuenschter_kurs_id,
             i.probetraining_datum, i.probetraining_uhrzeit, i.probetraining_stundenplan_id,
             i.status, i.bestaetigung_token_ablauf,
             d.dojoname
      FROM interessenten i JOIN dojo d ON d.id = i.dojo_id
      WHERE i.bestaetigung_token = ? LIMIT 1
    `, [token]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ungültiger oder abgelaufener Link.' });
    }
    const i = rows[0];
    if (i.bestaetigung_token_ablauf && new Date(i.bestaetigung_token_ablauf) < new Date()) {
      return res.status(410).json({ success: false, error: 'Dieser Link ist leider abgelaufen. Bitte melde dich direkt beim Dojo.' });
    }

    // Probetraining-geeignete Slots des Dojos
    const slots = await queryAsync(`
      SELECT sp.stundenplan_id, sp.tag AS wochentag,
             TIME_FORMAT(sp.uhrzeit_start, '%H:%i') AS uhrzeit_start,
             TIME_FORMAT(sp.uhrzeit_ende, '%H:%i') AS uhrzeit_ende,
             k.kurs_id, k.gruppenname AS kursname, k.stil AS stil_name,
             CONCAT(t.vorname, ' ', t.nachname) AS trainer
      FROM stundenplan sp
      INNER JOIN kurse k ON sp.kurs_id = k.kurs_id
      LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
      WHERE k.dojo_id = ? AND (k.probetraining_erlaubt = 1 OR k.probetraining_erlaubt IS NULL)
      ORDER BY FIELD(sp.tag,'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'), sp.uhrzeit_start
    `, [i.dojo_id]);

    const slotsMitTerminen = slots.map(s => ({
      ...s,
      naechste_termine: naechsteTermine(s.wochentag, 3)
    }));

    res.json({
      success: true,
      data: {
        interessent: { vorname: i.vorname, nachname: i.nachname },
        dojo: { id: i.dojo_id, name: i.dojoname },
        gebucht: i.probetraining_datum ? {
          datum: i.probetraining_datum,
          uhrzeit: i.probetraining_uhrzeit,
          stundenplan_id: i.probetraining_stundenplan_id,
          status: i.status
        } : null,
        slots: slotsMitTerminen
      }
    });
  } catch (error) {
    logger.error('Fehler beim Laden der Probetraining-Buchungsseite', { error: error.message });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

/**
 * POST /api/public/probetraining/termin/:token
 * Kunde bucht einen konkreten Termin (Self-Service) → status 'probetraining_vereinbart'.
 * Body: { stundenplan_id, datum: 'YYYY-MM-DD' }
 */
router.post('/termin/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { stundenplan_id, datum } = req.body;

    if (!stundenplan_id || !datum) {
      return res.status(400).json({ success: false, error: 'Bitte einen Termin auswählen.' });
    }

    const rows = await queryAsync(
      `SELECT id, dojo_id, vorname, nachname, email, bestaetigung_token_ablauf
       FROM interessenten WHERE bestaetigung_token = ? LIMIT 1`, [token]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ungültiger oder abgelaufener Link.' });
    }
    const i = rows[0];
    if (i.bestaetigung_token_ablauf && new Date(i.bestaetigung_token_ablauf) < new Date()) {
      return res.status(410).json({ success: false, error: 'Dieser Link ist leider abgelaufen.' });
    }

    // Slot laden + validieren (gehört zum Dojo, Datum passt zum Wochentag, liegt in der Zukunft)
    const slots = await queryAsync(`
      SELECT sp.stundenplan_id, sp.tag AS wochentag,
             TIME_FORMAT(sp.uhrzeit_start,'%H:%i') AS uhrzeit_start,
             TIME_FORMAT(sp.uhrzeit_ende,'%H:%i') AS uhrzeit_ende,
             k.kurs_id, k.gruppenname AS kursname, k.stil AS stil_name,
             CONCAT(t.vorname,' ',t.nachname) AS trainer, d.dojoname, d.email AS dojo_email
      FROM stundenplan sp
      INNER JOIN kurse k ON sp.kurs_id = k.kurs_id
      JOIN dojo d ON d.id = k.dojo_id
      LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
      WHERE sp.stundenplan_id = ? AND k.dojo_id = ? LIMIT 1
    `, [stundenplan_id, i.dojo_id]);

    if (slots.length === 0) {
      return res.status(400).json({ success: false, error: 'Der gewählte Kurs ist nicht verfügbar.' });
    }
    const slot = slots[0];

    const d = new Date(datum + 'T00:00:00');
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    if (isNaN(d.getTime()) || d < heute) {
      return res.status(400).json({ success: false, error: 'Bitte einen Termin in der Zukunft wählen.' });
    }
    if (WOCHENTAGE[d.getDay()] !== slot.wochentag) {
      return res.status(400).json({ success: false, error: 'Das Datum passt nicht zum gewählten Kurstag.' });
    }

    // Verbuchen: Termin + Status setzen
    await queryAsync(`
      UPDATE interessenten
      SET probetraining_datum = ?, probetraining_stundenplan_id = ?, probetraining_uhrzeit = ?,
          gewuenschter_kurs_id = ?, wunsch_wochentag = ?, status = 'probetraining_vereinbart',
          aktualisiert_am = NOW()
      WHERE id = ?
    `, [datum, slot.stundenplan_id, slot.uhrzeit_start, slot.kurs_id, slot.wochentag, i.id]);

    logger.info('Probetraining-Termin selbst gebucht', {
      interessent_id: i.id, dojo_id: i.dojo_id, datum, stundenplan_id: slot.stundenplan_id
    });

    // Mails: finale Bestätigung an Kunde + Info an Dojo
    try {
      await sendProbetrainingTerminBestaetigung({
        to: i.email, vorname: i.vorname, dojoName: slot.dojoname, dojoId: i.dojo_id,
        datum, uhrzeit: slot.uhrzeit_start, kurs: slot.kursname, stil: slot.stil_name, trainer: slot.trainer
      });
      if (slot.dojo_email) {
        await sendProbetrainingAnfrageEmail({
          to: slot.dojo_email, dojoName: slot.dojoname,
          interessent: { vorname: i.vorname, nachname: i.nachname, email: i.email, telefon: null },
          kurs: slot, wunschdatum: datum,
          nachricht: `✅ TERMIN SELBST GEBUCHT: ${slot.wochentag}, ${new Date(datum).toLocaleDateString('de-DE')} um ${slot.uhrzeit_start} — ${slot.kursname}`
        });
      }
    } catch (mailErr) {
      logger.error('Fehler beim E-Mail-Versand nach Terminbuchung', { error: mailErr.message, interessent_id: i.id });
    }

    res.json({
      success: true,
      message: 'Dein Probetraining ist gebucht! Du bekommst gleich eine Bestätigung per E-Mail.',
      data: {
        datum, uhrzeit: slot.uhrzeit_start, kurs: slot.kursname,
        wochentag: slot.wochentag, trainer: slot.trainer, dojo_name: slot.dojoname
      }
    });
  } catch (error) {
    logger.error('Fehler bei Probetraining-Terminbuchung', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' });
  }
});

module.exports = router;
