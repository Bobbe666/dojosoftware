/**
 * Einfache historische Prüfungen API
 * Freitext-Felder für Stil, Graduierung, Datum
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET alle historischen Prüfungen eines Mitglieds
router.get('/mitglied/:mitglied_id', (req, res) => {
  const { mitglied_id } = req.params;

  db.query(
    'SELECT * FROM pruefungen_historisch WHERE mitglied_id = ? ORDER BY pruefungsdatum DESC',
    [mitglied_id],
    (err, results) => {
      if (err) {
        console.error('Fehler beim Laden historischer Prüfungen:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, data: results });
    }
  );
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

  db.query(
    'INSERT INTO pruefungen_historisch (mitglied_id, stil_name, graduierung_name, pruefungsdatum, bemerkung) VALUES (?, ?, ?, ?, ?)',
    [mitglied_id, stil_name, graduierung_name, pruefungsdatum, bemerkung || null],
    (err, result) => {
      if (err) {
        console.error('Fehler beim Speichern:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, id: result.insertId, message: 'Historische Prüfung gespeichert' });
    }
  );
});

// DELETE historische Prüfung
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM pruefungen_historisch WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Fehler beim Löschen:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, message: 'Gelöscht' });
  });
});

module.exports = router;
