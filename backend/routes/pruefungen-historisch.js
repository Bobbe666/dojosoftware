/**
 * Einfache historische Prüfungen API
 * Freitext-Felder für Stil, Graduierung, Datum
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// GET alle historischen Prüfungen eines Mitglieds
router.get('/mitglied/:mitglied_id', (req, res) => {
  const { mitglied_id } = req.params;

  // 🔒 Dojo-Scope über mitglieder.dojo_id
  const secureDojoId = getSecureDojoId(req);
  let sql = 'SELECT ph.* FROM pruefungen_historisch ph JOIN mitglieder m ON ph.mitglied_id = m.mitglied_id WHERE ph.mitglied_id = ?';
  const params = [mitglied_id];
  if (secureDojoId) { sql += ' AND m.dojo_id = ?'; params.push(secureDojoId); }
  sql += ' ORDER BY ph.pruefungsdatum DESC';

  db.query(sql, params, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden historischer Prüfungen:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// POST neue historische Prüfung
router.post('/', (req, res) => {
  const { mitglied_id, stil_name, graduierung_name, pruefungsdatum, bemerkung } = req.body;

  if (!mitglied_id || !stil_name || !graduierung_name || !pruefungsdatum) {
    return res.status(400).json({
      success: false,
      message: 'Mitglied, Stil, Graduierung und Datum sind erforderlich'
    });
  }

  // 🔒 Mitglied-Ownership prüfen
  const secureDojoId = getSecureDojoId(req);
  db.query('SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?', [mitglied_id], (mErr, mRows) => {
    if (mErr) return res.status(500).json({ success: false, error: mErr.message });
    if (mRows.length === 0) return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });
    if (secureDojoId && Number(mRows[0].dojo_id) !== Number(secureDojoId)) {
      return res.status(403).json({ success: false, error: 'Keine Berechtigung' });
    }

    db.query(
      'INSERT INTO pruefungen_historisch (mitglied_id, stil_name, graduierung_name, pruefungsdatum, bemerkung) VALUES (?, ?, ?, ?, ?)',
      [mitglied_id, stil_name, graduierung_name, pruefungsdatum, bemerkung || null],
      (err, result) => {
        if (err) {
          logger.error('Fehler beim Speichern:', { error: err });
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, id: result.insertId, message: 'Historische Prüfung gespeichert' });
      }
    );
  });
});

// DELETE historische Prüfung
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // 🔒 Dojo-Scope über mitglieder.dojo_id
  const secureDojoId = getSecureDojoId(req);
  let sql = 'DELETE ph FROM pruefungen_historisch ph JOIN mitglieder m ON ph.mitglied_id = m.mitglied_id WHERE ph.id = ?';
  const params = [id];
  if (secureDojoId) { sql += ' AND m.dojo_id = ?'; params.push(secureDojoId); }

  db.query(sql, params, (err, result) => {
    if (err) {
      logger.error('Fehler beim Löschen:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    res.json({ success: true, message: 'Gelöscht' });
  });
});

module.exports = router;
