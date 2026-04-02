/**
 * Prüfungen - Stats Routes
 * Prüfungsstatistiken und Auswertungen
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { ERROR_MESSAGES, HTTP_STATUS } = require('../../utils/constants');

// ============================================================================
// STATISTIK ROUTES
// ============================================================================

/**
 * GET /stats/statistiken
 * Prüfungsstatistiken
 */
router.get('/statistiken', (req, res) => {
  const { dojo_id, jahr } = req.query;
  let whereClause = '';
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereClause = 'WHERE dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  if (jahr) {
    whereClause += (whereClause ? ' AND' : 'WHERE') + ' YEAR(pruefungsdatum) = ?';
    queryParams.push(parseInt(jahr));
  }

  // WHERE-Clause für Gurtverteilung (nur dojo_id, kein Jahr)
  let gurtWhereClause = '';
  let gurtQueryParams = [];
  if (dojo_id && dojo_id !== 'all') {
    gurtWhereClause = 'AND m.dojo_id = ?';
    gurtQueryParams.push(parseInt(dojo_id));
  }

  const queries = {
    gesamt: `
      SELECT
        COUNT(*) as gesamt,
        SUM(CASE WHEN bestanden = 1 THEN 1 ELSE 0 END) as bestanden,
        SUM(CASE WHEN bestanden = 0 AND status = 'nicht_bestanden' THEN 1 ELSE 0 END) as nicht_bestanden,
        SUM(CASE WHEN status = 'geplant' THEN 1 ELSE 0 END) as geplant
      FROM pruefungen
      ${whereClause}
    `,
    nach_stil: `
      SELECT
        s.name as stil_name,
        COUNT(*) as anzahl,
        SUM(CASE WHEN p.bestanden = 1 THEN 1 ELSE 0 END) as bestanden
      FROM pruefungen p
      INNER JOIN stile s ON p.stil_id = s.stil_id
      ${whereClause}
      GROUP BY s.stil_id, s.name
      ORDER BY anzahl DESC
    `,
    nach_monat: `
      SELECT
        YEAR(pruefungsdatum) as jahr,
        MONTH(pruefungsdatum) as monat,
        COUNT(*) as anzahl,
        SUM(CASE WHEN bestanden = 1 THEN 1 ELSE 0 END) as bestanden
      FROM pruefungen
      ${whereClause}
      GROUP BY YEAR(pruefungsdatum), MONTH(pruefungsdatum)
      ORDER BY jahr DESC, monat DESC
      LIMIT 12
    `,
    gurtverteilung: `
      SELECT
        g.name as graduierung_name,
        g.farbe_hex as farbe,
        g.reihenfolge,
        s.name as stil_name,
        COUNT(DISTINCT m.mitglied_id) as anzahl
      FROM mitglieder m
      INNER JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
      INNER JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
      INNER JOIN stile s ON g.stil_id = s.stil_id
      WHERE m.aktiv = 1
      ${gurtWhereClause}
      GROUP BY g.graduierung_id, g.name, g.farbe_hex, g.reihenfolge, s.name
      ORDER BY s.name ASC, g.reihenfolge ASC
    `
  };

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(queries.gesamt, queryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries.nach_stil, queryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries.nach_monat, queryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries.gurtverteilung, gurtQueryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([gesamt, nach_stil, nach_monat, gurtverteilung]) => {
    res.json({
      success: true,
      statistiken: {
        gesamt,
        nach_stil,
        nach_monat,
        gurtverteilung
      }
    });
  })
  .catch(err => {
    logger.error('Fehler bei Prüfungsstatistiken:', { error: err });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_MESSAGES.GENERAL.LOADING_ERROR,
      details: err.message
    });
  });
});

module.exports = router;
