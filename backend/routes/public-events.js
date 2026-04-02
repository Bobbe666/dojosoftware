// Backend/routes/public-events.js - Öffentliche Events für externe Websites
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');

// CORS-Header Helper
function setCorsHeaders(res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
}

// OPTIONS - CORS Preflight
router.options('/', (req, res) => {
  setCorsHeaders(res);
  res.sendStatus(200);
});

/**
 * GET /api/public/events
 * Gibt kommende, öffentliche Events für bestimmte Dojos zurück.
 * Query-Params: dojo_ids (kommagetrennt, z.B. "2,3")
 */
router.get('/', async (req, res) => {
  setCorsHeaders(res);

  // Erlaubte Dojo-IDs (nur Kampfkunstschule Schreiner + TDA International)
  const ALLOWED_DOJO_IDS = [2, 3];

  let dojoIds = ALLOWED_DOJO_IDS;
  if (req.query.dojo_ids) {
    const requested = req.query.dojo_ids.split(',')
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id) && ALLOWED_DOJO_IDS.includes(id));
    if (requested.length > 0) dojoIds = requested;
  }

  const placeholders = dojoIds.map(() => '?').join(',');

  const query = `
    SELECT
      CAST(e.event_id AS CHAR) AS event_id,
      e.titel,
      e.beschreibung,
      e.event_typ,
      e.datum,
      e.uhrzeit_beginn,
      e.uhrzeit_ende,
      e.ort,
      e.max_teilnehmer,
      e.teilnahmegebuehr,
      e.anmeldefrist,
      e.status,
      e.bild_url,
      e.anforderungen,
      e.dojo_id,
      d.dojoname
    FROM events e
    JOIN dojo d ON e.dojo_id = d.id
    WHERE e.dojo_id IN (${placeholders})
      AND e.datum >= CURDATE()
      AND e.status IN ('geplant', 'anmeldung_offen', 'ausgebucht')

    UNION ALL

    SELECT
      CONCAT('pruef_', pt.termin_id) AS event_id,
      CONCAT(s.name, ' – Gürtelprüfung') AS titel,
      pt.bemerkungen AS beschreibung,
      'Prüfung' AS event_typ,
      pt.pruefungsdatum AS datum,
      pt.pruefungszeit AS uhrzeit_beginn,
      NULL AS uhrzeit_ende,
      pt.pruefungsort AS ort,
      NULL AS max_teilnehmer,
      pt.pruefungsgebuehr AS teilnahmegebuehr,
      pt.anmeldefrist,
      'geplant' AS status,
      NULL AS bild_url,
      NULL AS anforderungen,
      pt.dojo_id,
      d.dojoname
    FROM pruefungstermin_vorlagen pt
    JOIN stile s ON pt.stil_id = s.stil_id
    JOIN dojo d ON pt.dojo_id = d.id
    WHERE pt.oeffentlich_vib = 1
      AND pt.dojo_id IN (${placeholders})
      AND pt.pruefungsdatum >= CURDATE()

    ORDER BY datum ASC, uhrzeit_beginn ASC
    LIMIT 50
  `;

  try {
    const [rows] = await db.promise().query(query, [...dojoIds, ...dojoIds]);
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('Fehler beim Abrufen der öffentlichen Events:', { error: err });
    res.status(500).json({ success: false, error: 'Fehler beim Laden der Events' });
  }
});

module.exports = router;
