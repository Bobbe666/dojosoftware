/**
 * Pruefungen Termine Routes
 * Prüfungstermin-Verwaltung
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { formatDate } = require('./shared');

// POST /termine - Erstellt einen Prüfungstermin
router.post('/termine', (req, res) => {
  const { datum, zeit, ort, pruefer_name, stil_id, pruefungsgebuehr, anmeldefrist, bemerkungen, teilnahmebedingungen, dojo_id } = req.body;

  if (!datum || !stil_id || !dojo_id) {
    return res.status(400).json({ error: 'Fehlende erforderliche Felder', required: ['datum', 'stil_id', 'dojo_id'] });
  }

  const zeitValue = zeit || '10:00';

  // Prüfe auf Überschneidungen
  const checkOverlapQuery = `
    SELECT termin_id, pruefungsort, pruefer_name, stil_id
    FROM pruefungstermin_vorlagen
    WHERE pruefungsdatum = ? AND pruefungszeit = ? AND dojo_id = ?
  `;

  db.query(checkOverlapQuery, [datum, zeitValue, dojo_id], (err, overlaps) => {
    if (err) {
      logger.error('Fehler beim Prüfen auf Überschneidungen:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Prüfen auf Überschneidungen', details: err.message });
    }

    if (overlaps && overlaps.length > 0) {
      for (const overlap of overlaps) {
        const sameRoom = (overlap.pruefungsort || '') === (ort || '');
        const sameExaminer = (overlap.pruefer_name || '') === (pruefer_name || '');
        if (sameRoom || sameExaminer) {
          return res.status(409).json({
            error: 'Überschneidung nicht erlaubt',
            message: 'Zu diesem Zeitpunkt existiert bereits eine Prüfung.',
            conflict: { datum, zeit: zeitValue, bestehendeRaeume: overlaps.map(o => o.pruefungsort).filter(Boolean), bestehendePruefer: overlaps.map(o => o.pruefer_name).filter(Boolean) }
          });
        }
      }
    }

    const insertQuery = `
      INSERT INTO pruefungstermin_vorlagen (pruefungsdatum, pruefungszeit, pruefungsort, pruefer_name, stil_id, pruefungsgebuehr, anmeldefrist, bemerkungen, teilnahmebedingungen, dojo_id, erstellt_am)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    db.query(insertQuery, [datum, zeitValue, ort || null, pruefer_name || null, stil_id, pruefungsgebuehr || null, anmeldefrist || null, bemerkungen || null, teilnahmebedingungen || null, dojo_id], (err, result) => {
      if (err) {
        logger.error('Fehler beim Erstellen des Prüfungstermins:', { error: err });
        return res.status(500).json({ error: 'Fehler beim Erstellen des Termins', details: err.message });
      }
      res.status(201).json({ success: true, message: 'Prüfungstermin erfolgreich erstellt', termin_id: result.insertId });
    });
  });
});

// GET /termine - Lädt alle Prüfungstermine
router.get('/termine', (req, res) => {
  const { dojo_id, stil_id } = req.query;
  let whereConditions = [];
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('pt.dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }
  if (stil_id && stil_id !== 'all') {
    whereConditions.push('pt.stil_id = ?');
    queryParams.push(parseInt(stil_id));
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  const query = `
    SELECT pt.*, s.name as stil_name
    FROM pruefungstermin_vorlagen pt
    INNER JOIN stile s ON pt.stil_id = s.stil_id
    ${whereClause}
    ORDER BY pt.pruefungsdatum DESC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Prüfungstermine:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Laden der Termine', details: err.message });
    }

    const formattedResults = results.map(termin => ({
      ...termin,
      pruefungsdatum: formatDate(termin.pruefungsdatum),
      anmeldefrist: formatDate(termin.anmeldefrist)
    }));

    res.json({ success: true, count: formattedResults.length, termine: formattedResults });
  });
});

// PUT /termine/:id - Aktualisiert einen Prüfungstermin
router.put('/termine/:id', (req, res) => {
  const termin_id = parseInt(req.params.id);
  if (!termin_id || isNaN(termin_id)) return res.status(400).json({ error: 'Ungültige Termin-ID' });

  const { datum, zeit, ort, pruefer_name, stil_id, pruefungsgebuehr, anmeldefrist, bemerkungen, teilnahmebedingungen } = req.body;
  if (!datum || !stil_id) return res.status(400).json({ error: 'Fehlende erforderliche Felder', required: ['datum', 'stil_id'] });

  const updateQuery = `
    UPDATE pruefungstermin_vorlagen SET pruefungsdatum = ?, pruefungszeit = ?, pruefungsort = ?, pruefer_name = ?,
      stil_id = ?, pruefungsgebuehr = ?, anmeldefrist = ?, bemerkungen = ?, teilnahmebedingungen = ?
    WHERE termin_id = ?
  `;

  db.query(updateQuery, [datum, zeit || '10:00', ort || null, pruefer_name || null, stil_id, pruefungsgebuehr || null, anmeldefrist || null, bemerkungen || null, teilnahmebedingungen || null, termin_id], (err, result) => {
    if (err) {
      logger.error('Fehler beim Aktualisieren des Termins:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Aktualisieren', details: err.message });
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Termin nicht gefunden' });
    res.json({ success: true, message: 'Termin erfolgreich aktualisiert' });
  });
});

// DELETE /termine/:id - Löscht einen Prüfungstermin
router.delete('/termine/:id', (req, res) => {
  const termin_id = parseInt(req.params.id);
  if (!termin_id || isNaN(termin_id)) return res.status(400).json({ error: 'Ungültige Termin-ID' });

  db.query('DELETE FROM pruefungstermin_vorlagen WHERE termin_id = ?', [termin_id], (err, result) => {
    if (err) {
      logger.error('Fehler beim Löschen des Termins:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Löschen', details: err.message });
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Termin nicht gefunden' });
    res.json({ success: true, message: 'Termin erfolgreich gelöscht' });
  });
});

module.exports = router;
