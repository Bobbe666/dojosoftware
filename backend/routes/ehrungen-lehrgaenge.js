/**
 * Ehrungen & Lehrgänge API
 * Einfache Verwaltung von Ehrungen, Seminaren, Lehrgängen, Lizenzen
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET alle Einträge eines Mitglieds
router.get('/mitglied/:mitglied_id', (req, res) => {
  const { mitglied_id } = req.params;

  db.query(
    'SELECT * FROM ehrungen_lehrgaenge WHERE mitglied_id = ? ORDER BY datum DESC',
    [mitglied_id],
    (err, results) => {
      if (err) {
        console.error('Fehler beim Laden:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, data: results });
    }
  );
});

// POST neuer Eintrag
router.post('/', (req, res) => {
  const { mitglied_id, datum, art, bezeichnung, lizenz, bemerkung } = req.body;

  if (!mitglied_id || !datum || !art || !bezeichnung) {
    return res.status(400).json({
      success: false,
      message: 'Mitglied, Datum, Art und Bezeichnung sind erforderlich'
    });
  }

  db.query(
    'INSERT INTO ehrungen_lehrgaenge (mitglied_id, datum, art, bezeichnung, lizenz, bemerkung) VALUES (?, ?, ?, ?, ?, ?)',
    [mitglied_id, datum, art, bezeichnung, lizenz || null, bemerkung || null],
    (err, result) => {
      if (err) {
        console.error('Fehler beim Speichern:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, id: result.insertId, message: 'Eintrag gespeichert' });
    }
  );
});

// DELETE Eintrag
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM ehrungen_lehrgaenge WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Fehler beim Löschen:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, message: 'Gelöscht' });
  });
});

module.exports = router;
