// Backend/routes/public-display.js — Öffentliche Daten für den Werbe-/Info-Bildschirm
// Kein Login, Dojo über URL: GET /api/public/display/:dojo_id  (analog public-stundenplan)
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');

function cors(res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
}

router.options('/:dojo_id', (req, res) => { cors(res); res.sendStatus(200); });

router.get('/:dojo_id', async (req, res) => {
  cors(res);
  const dojoId = parseInt(req.params.dojo_id, 10);
  if (!dojoId) return res.status(400).json({ success: false, error: 'Dojo-ID erforderlich' });

  const heute = new Date().toISOString().slice(0, 10);

  try {
    // --- Feature-Gate: nur wenn das Dojo das Feature hat ---
    const [subRows] = await db.promise().query(
      'SELECT feature_display, status FROM dojo_subscriptions WHERE dojo_id = ?', [dojoId]
    );
    const hatFeature = subRows.length &&
      (subRows[0].feature_display === 1 || subRows[0].feature_display === true) &&
      ['active', 'trial'].includes(subRows[0].status);

    // Dojo-Name fürs Branding (auch für den Enterprise-Hinweis)
    let dojoname = null;
    try {
      const [dRows] = await db.promise().query('SELECT dojoname FROM dojo WHERE id = ?', [dojoId]);
      if (dRows.length) dojoname = dRows[0].dojoname;
    } catch (e) { /* optional */ }

    // Nicht freigeschaltet → kein Fehler, sondern Info-Screen am Bildschirm
    if (!hatFeature) {
      return res.json({ success: true, enterprise_erforderlich: true, dojoname, config: null, slides: [] });
    }

    // --- Config ---
    let config;
    const [cfgRows] = await db.promise().query('SELECT * FROM display_config WHERE dojo_id = ?', [dojoId]);
    if (cfgRows.length) {
      config = cfgRows[0];
    } else {
      config = {
        aktiv: 1, titel: null, standard_dauer: 12, uhr_anzeigen: 1,
        auto_kursplan: 1, auto_events: 1, auto_pruefungen: 1, auto_geburtstage: 0, auto_schnellansage: 1
      };
    }
    if (!config.aktiv) {
      return res.json({ success: true, config, dojoname: null, slides: [] });
    }

    const slides = [];

    // --- 1) Manuelle Slides (Bild/Text/Video/QR) mit Zeitfenster-Filter ---
    try {
      const [rows] = await db.promise().query(
        `SELECT id, typ, titel, text_inhalt, medien_url, qr_daten, hintergrund_farbe, text_farbe, dauer
         FROM display_slides
         WHERE dojo_id = ? AND aktiv = 1
           AND (start_datum IS NULL OR start_datum <= ?)
           AND (end_datum IS NULL OR end_datum >= ?)
         ORDER BY sortierung ASC, id ASC`,
        [dojoId, heute, heute]
      );
      for (const r of rows) {
        slides.push({
          key: `slide_${r.id}`,
          typ: r.typ,
          titel: r.titel,
          text_inhalt: r.text_inhalt,
          medien_url: r.medien_url,
          qr_daten: r.qr_daten,
          hintergrund_farbe: r.hintergrund_farbe,
          text_farbe: r.text_farbe,
          dauer: r.dauer || null
        });
      }
    } catch (e) {
      logger.warn('Display public: manuelle Slides fehlgeschlagen', { error: e.message });
    }

    // --- 2) Auto: Kursplan (heutiger Wochenplan) ---
    if (config.auto_kursplan) {
      try {
        const [rows] = await db.promise().query(
          `SELECT s.tag, s.uhrzeit_start, s.uhrzeit_ende, k.stil, k.gruppenname,
                  CONCAT(t.vorname, ' ', t.nachname) AS trainer
           FROM stundenplan s
           LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
           LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
           WHERE k.dojo_id = ?
           ORDER BY FIELD(s.tag,'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'), s.uhrzeit_start`,
          [dojoId]
        );
        if (rows.length) {
          slides.push({ key: 'auto_kursplan', typ: 'auto_kursplan', titel: 'Kursplan', daten: { wochenplan: rows } });
        }
      } catch (e) {
        logger.warn('Display public: Kursplan fehlgeschlagen', { error: e.message });
      }
    }

    // --- 3) Auto: Events / Turniere ---
    if (config.auto_events) {
      try {
        const [rows] = await db.promise().query(
          `SELECT titel, event_typ, datum, uhrzeit_beginn, ort
           FROM events
           WHERE dojo_id = ? AND datum >= CURDATE()
             AND status IN ('geplant','anmeldung_offen','ausgebucht')
           ORDER BY datum ASC, uhrzeit_beginn ASC
           LIMIT 6`,
          [dojoId]
        );
        if (rows.length) {
          slides.push({ key: 'auto_events', typ: 'auto_events', titel: 'Kommende Events', daten: { events: rows } });
        }
      } catch (e) {
        logger.warn('Display public: Events fehlgeschlagen', { error: e.message });
      }
    }

    // --- 4) Auto: Prüfungstermine ---
    if (config.auto_pruefungen) {
      try {
        const [rows] = await db.promise().query(
          `SELECT pt.pruefungsdatum, pt.pruefungszeit, pt.pruefungsort, s.name AS stil_name
           FROM pruefungstermin_vorlagen pt
           LEFT JOIN stile s ON pt.stil_id = s.stil_id
           WHERE pt.dojo_id = ? AND pt.pruefungsdatum >= CURDATE()
           ORDER BY pt.pruefungsdatum ASC
           LIMIT 6`,
          [dojoId]
        );
        if (rows.length) {
          slides.push({ key: 'auto_pruefungen', typ: 'auto_pruefungen', titel: 'Nächste Prüfungen', daten: { pruefungen: rows } });
        }
      } catch (e) {
        logger.warn('Display public: Prüfungen fehlgeschlagen', { error: e.message });
      }
    }

    // --- 5) Auto: Geburtstage diese Woche (opt-in, datenschutzschonend: nur Vorname) ---
    if (config.auto_geburtstage) {
      try {
        const [rows] = await db.promise().query(
          `SELECT vorname,
                  MOD(DAYOFYEAR(DATE(CONCAT(YEAR(CURDATE()),'-',MONTH(geburtsdatum),'-',DAY(geburtsdatum))))
                      - DAYOFYEAR(CURDATE()) + 366, 366) AS tage_bis
           FROM mitglieder
           WHERE dojo_id = ? AND aktiv = 1 AND geburtsdatum IS NOT NULL
           HAVING tage_bis < 7
           ORDER BY tage_bis ASC
           LIMIT 12`,
          [dojoId]
        );
        if (rows.length) {
          slides.push({ key: 'auto_geburtstage', typ: 'auto_geburtstage', titel: 'Geburtstage', daten: { geburtstage: rows } });
        }
      } catch (e) {
        logger.warn('Display public: Geburtstage fehlgeschlagen', { error: e.message });
      }
    }

    // --- 6) Auto: Schnell-Ansagen (aktive Popup-News) ---
    if (config.auto_schnellansage) {
      try {
        const [rows] = await db.promise().query(
          `SELECT titel, kurzbeschreibung
           FROM news_articles
           WHERE als_popup = 1 AND status = 'veroeffentlicht' AND dojo_id = ?
             AND (veroeffentlicht_am IS NULL OR veroeffentlicht_am <= NOW())
             AND (ablauf_am IS NULL OR ablauf_am > NOW())
           ORDER BY veroeffentlicht_am DESC
           LIMIT 5`,
          [dojoId]
        );
        for (const r of rows) {
          slides.push({
            key: `ansage_${r.titel}`,
            typ: 'auto_schnellansage',
            titel: r.titel || 'Aktuelle Info',
            daten: { text: r.kurzbeschreibung }
          });
        }
      } catch (e) {
        logger.warn('Display public: Schnellansagen fehlgeschlagen', { error: e.message });
      }
    }

    res.json({ success: true, config, dojoname, slides });
  } catch (err) {
    logger.error('Display public: Fehler', { error: err.message, dojoId });
    res.status(500).json({ success: false, error: 'Fehler beim Laden des Displays' });
  }
});

module.exports = router;
