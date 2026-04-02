/**
 * Prüfungen - Historie Routes
 * Prüfungshistorie und historische Prüfungen
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { ERROR_MESSAGES, SUCCESS_MESSAGES, HTTP_STATUS } = require('../../utils/constants');
const { getSecureDojoId } = require('../../utils/dojo-filter-helper');

// GET /mitglied/:mitglied_id/historie - Prüfungshistorie eines Mitglieds
router.get('/mitglied/:mitglied_id/historie', (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id);
  const { stil_id } = req.query;
  const secureDojoId = getSecureDojoId(req);

  if (!mitglied_id || isNaN(mitglied_id)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: ERROR_MESSAGES.VALIDATION.INVALID_ID });
  }

  // 🔒 Member-Sicherheit: Member dürfen nur EIGENE Historie sehen
  if (req.user?.mitglied_id && req.user.mitglied_id !== mitglied_id) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Keine Berechtigung' });
  }

  let whereConditions = ['p.mitglied_id = ?'];
  let queryParams = [mitglied_id];

  // Dojo-Isolation: Zugriff nur wenn Mitglied zum eigenen Dojo gehört
  if (secureDojoId) {
    whereConditions.push('p.dojo_id = ?');
    queryParams.push(secureDojoId);
  }

  if (stil_id) {
    whereConditions.push('p.stil_id = ?');
    queryParams.push(parseInt(stil_id));
  }

  const whereClause = 'WHERE ' + whereConditions.join(' AND ');

  const query = `
    SELECT p.*, s.name as stil_name,
      g_vorher.name as graduierung_vorher, g_vorher.farbe_hex as farbe_vorher,
      g_nachher.name as graduierung_nachher, g_nachher.farbe_hex as farbe_nachher, g_nachher.dan_grad,
      g_zwischen.name as graduierung_zwischen, g_zwischen.farbe_hex as farbe_zwischen, g_zwischen.reihenfolge as zwischen_reihenfolge
    FROM pruefungen p
    INNER JOIN stile s ON p.stil_id = s.stil_id
    LEFT JOIN graduierungen g_vorher ON p.graduierung_vorher_id = g_vorher.graduierung_id
    INNER JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
    LEFT JOIN graduierungen g_zwischen ON p.graduierung_zwischen_id = g_zwischen.graduierung_id
    ${whereClause}
    ORDER BY p.pruefungsdatum DESC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Historie:', { error: err, mitglied_id });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: ERROR_MESSAGES.GENERAL.LOADING_ERROR, details: err.message });
    }
    res.json({ success: true, mitglied_id, count: results.length, historie: results });
  });
});

// POST /mitglied/:mitglied_id/historisch - Historische Prüfung hinzufügen
router.post('/mitglied/:mitglied_id/historisch', (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id);
  const secureDojoId = getSecureDojoId(req);
  const { stil_id, graduierung_vorher_id, graduierung_nachher_id, pruefungsdatum, pruefungsort, historisch_bemerkung, pruefer_name } = req.body;
  const dojo_id = secureDojoId || parseInt(req.body.dojo_id);

  logger.debug('Historische Prüfung hinzufügen:', { mitglied_id, stil_id, graduierung_nachher_id, pruefungsdatum });

  if (!stil_id || !graduierung_nachher_id || !pruefungsdatum || !dojo_id) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS_MISSING, required: ['stil_id', 'graduierung_nachher_id', 'pruefungsdatum', 'dojo_id'] });
  }

  const insertQuery = `
    INSERT INTO pruefungen (mitglied_id, stil_id, dojo_id, graduierung_vorher_id, graduierung_nachher_id, pruefungsdatum, pruefungsort, bestanden, status, ist_historisch, historisch_bemerkung, prueferkommentar, erstellt_am)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'bestanden', 1, ?, ?, NOW())
  `;

  db.query(insertQuery, [mitglied_id, stil_id, dojo_id, graduierung_vorher_id || null, graduierung_nachher_id, pruefungsdatum, pruefungsort || null, historisch_bemerkung || 'Historische Prüfung (nachträglich erfasst)', pruefer_name ? 'Prüfer: ' + pruefer_name : null], (err, result) => {
    if (err) {
      logger.error('Fehler beim Hinzufügen der historischen Prüfung:', { error: err });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.GENERAL.SAVE_ERROR, error: err.message });
    }

    db.query('UPDATE mitglied_stile SET current_graduierung_id = ?, letzte_pruefung = ? WHERE mitglied_id = ? AND stil_id = ?', [graduierung_nachher_id, pruefungsdatum, mitglied_id, stil_id], (updateErr) => {
      if (updateErr) logger.warn('Graduierung konnte nicht aktualisiert werden:', { error: updateErr.message });
      logger.info('Historische Prüfung erfolgreich hinzugefügt', { pruefung_id: result.insertId });
      res.json({ success: true, message: SUCCESS_MESSAGES.CRUD.CREATED, pruefung_id: result.insertId });
    });
  });
});

// DELETE /historisch/:pruefung_id - Historische Prüfung löschen
router.delete('/historisch/:pruefung_id', (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  const secureDojoId = getSecureDojoId(req);

  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: ERROR_MESSAGES.VALIDATION.INVALID_ID });
  }

  // Ownership-Check: Prüfung muss historisch UND zum eigenen Dojo gehören
  const checkQuery = secureDojoId
    ? 'SELECT * FROM pruefungen WHERE pruefung_id = ? AND ist_historisch = 1 AND dojo_id = ?'
    : 'SELECT * FROM pruefungen WHERE pruefung_id = ? AND ist_historisch = 1';
  const checkParams = secureDojoId ? [pruefung_id, secureDojoId] : [pruefung_id];

  db.query(checkQuery, checkParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Suchen der historischen Prüfung:', { error: err });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.DATABASE.QUERY_FAILED, error: err.message });
    }
    if (results.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Historische Prüfung nicht gefunden oder kein Zugriff' });
    }

    db.query('DELETE FROM pruefungen WHERE pruefung_id = ?', [pruefung_id], (deleteErr) => {
      if (deleteErr) {
        logger.error('Fehler beim Löschen der historischen Prüfung:', { error: deleteErr });
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.GENERAL.DELETE_ERROR, error: deleteErr.message });
      }
      res.json({ success: true, message: SUCCESS_MESSAGES.CRUD.DELETED });
    });
  });
});

module.exports = router;
