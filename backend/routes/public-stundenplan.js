// Backend/routes/public-stundenplan.js - Öffentlicher Stundenplan-Zugriff
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');

// OPTIONS /api/public/stundenplan/:dojo_id - CORS Preflight
router.options('/:dojo_id', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// GET /api/public/stundenplan/:dojo_id - Öffentlicher Stundenplan für ein Dojo
router.get('/:dojo_id', async (req, res) => {
  // CORS-Header für öffentlichen Zugriff
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  const { dojo_id } = req.params;

  if (!dojo_id) {
    return res.status(400).json({
      success: false,
      error: 'Dojo-ID ist erforderlich'
    });
  }

  const query = `
    SELECT
      s.stundenplan_id,
      s.tag,
      s.uhrzeit_start,
      s.uhrzeit_ende,
      s.kurs_id,
      CONCAT_WS(' – ', k.stil, k.gruppenname) AS kursname,
      k.stil,
      k.gruppenname,
      CONCAT(t.vorname, ' ', t.nachname) AS trainer
    FROM stundenplan s
    LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
    LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
    WHERE k.dojo_id = ?
    ORDER BY FIELD(s.tag, 'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'),
             s.uhrzeit_start;
  `;

  try {
    const [rows] = await db.promise().query(query, [parseInt(dojo_id)]);

    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    logger.error('Fehler beim Abrufen des öffentlichen Stundenplans:', { error: err, dojo_id });
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen des Stundenplans',
      details: err.message
    });
  }
});

module.exports = router;
