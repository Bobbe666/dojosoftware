/**
 * Prüfungsinhalte Routes
 * Verwaltung von Prüfungsinhalten für Graduierungen
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

// GET /:stilId/graduierungen/:graduierungId/pruefungsinhalte - Prüfungsinhalte abrufen
router.get('/:stilId/graduierungen/:graduierungId/pruefungsinhalte', (req, res) => {
  const { graduierungId } = req.params;

  if (!graduierungId || isNaN(graduierungId)) {
    return res.status(400).json({ error: 'Ungültige Graduierung-ID' });
  }

  const query = `
    SELECT inhalt_id, kategorie, titel, beschreibung, reihenfolge, pflicht, aktiv
    FROM pruefungsinhalte
    WHERE graduierung_id = ? AND aktiv = 1
    ORDER BY kategorie, reihenfolge
  `;

  db.query(query, [graduierungId], (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Prüfungsinhalte:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Prüfungsinhalte' });
    }

    // Gruppiere Prüfungsinhalte nach Kategorie
    const pruefungsinhalte = {};
    results.forEach(inhalt => {
      if (!pruefungsinhalte[inhalt.kategorie]) {
        pruefungsinhalte[inhalt.kategorie] = [];
      }
      pruefungsinhalte[inhalt.kategorie].push({
        id: inhalt.inhalt_id,
        titel: inhalt.titel,
        beschreibung: inhalt.beschreibung,
        pflicht: inhalt.pflicht === 1,
        reihenfolge: inhalt.reihenfolge
      });
    });

    res.json({ pruefungsinhalte });
  });
});

// PUT /:stilId/graduierungen/:graduierungId/pruefungsinhalte - Prüfungsinhalte aktualisieren
router.put('/:stilId/graduierungen/:graduierungId/pruefungsinhalte', (req, res) => {
  const { graduierungId } = req.params;
  const { pruefungsinhalte } = req.body;

  if (!graduierungId || isNaN(graduierungId)) {
    return res.status(400).json({ error: 'Ungültige Graduierung-ID' });
  }

  if (!pruefungsinhalte) {
    return res.status(400).json({ error: 'Prüfungsinhalte sind erforderlich' });
  }

  // Lösche erst alle bestehenden Einträge für diese Graduierung
  const deleteQuery = 'DELETE FROM pruefungsinhalte WHERE graduierung_id = ?';

  db.query(deleteQuery, [graduierungId], (deleteError) => {
    if (deleteError) {
      logger.error('Fehler beim Löschen alter Prüfungsinhalte:', deleteError);
      return res.status(500).json({ error: 'Fehler beim Löschen alter Prüfungsinhalte' });
    }

    // Konvertiere das JSON-Objekt in einzelne Datenbankeinträge
    const insertPromises = [];

    Object.entries(pruefungsinhalte).forEach(([kategorie, inhalte]) => {
      if (Array.isArray(inhalte)) {
        inhalte.forEach((inhalt, index) => {
          const insertQuery = `
            INSERT INTO pruefungsinhalte
            (graduierung_id, kategorie, titel, beschreibung, reihenfolge, pflicht, aktiv)
            VALUES (?, ?, ?, '', ?, 0, 1)
          `;

          const values = [
            graduierungId,
            kategorie,
            inhalt.inhalt || inhalt.titel || '',
            inhalt.reihenfolge !== undefined ? inhalt.reihenfolge : index
          ];

          insertPromises.push(
            new Promise((resolve, reject) => {
              db.query(insertQuery, values, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            })
          );
        });
      }
    });

    Promise.all(insertPromises)
      .then(() => {
        res.json({
          success: true,
          message: 'Prüfungsinhalte aktualisiert',
          count: insertPromises.length
        });
      })
      .catch(error => {
        logger.error('Fehler beim Speichern der Prüfungsinhalte:', error);
        res.status(500).json({ error: 'Fehler beim Speichern der Prüfungsinhalte' });
      });
  });
});

module.exports = router;
