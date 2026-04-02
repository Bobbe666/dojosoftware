/**
 * Rechnungen Zahlungen Routes
 * Zahlungserfassung und Status-Updates
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');

// POST /:id/zahlung - Zahlung erfassen
router.post('/:id/zahlung', (req, res) => {
  const { id } = req.params;
  const { betrag, zahlungsdatum, zahlungsart, referenz, notizen } = req.body;

  if (!betrag || !zahlungsdatum || !zahlungsart) {
    return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen' });
  }

  // Zahlung einfügen
  const insertQuery = `
    INSERT INTO zahlungen (rechnung_id, betrag, zahlungsdatum, zahlungsart, referenz, notizen)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(insertQuery, [id, betrag, zahlungsdatum, zahlungsart, referenz, notizen], (insertErr) => {
    if (insertErr) {
      logger.error('Fehler beim Erfassen der Zahlung:', { error: insertErr });
      return res.status(500).json({ success: false, error: insertErr.message });
    }

    // Prüfe Zahlungsstatus
    const checkQuery = `
      SELECT
        r.betrag as rechnung_betrag,
        COALESCE(SUM(z.betrag), 0) as gezahlt
      FROM rechnungen r
      LEFT JOIN zahlungen z ON r.rechnung_id = z.rechnung_id
      WHERE r.rechnung_id = ?
      GROUP BY r.rechnung_id, r.betrag
    `;

    db.query(checkQuery, [id], (checkErr, checkResults) => {
      if (checkErr) {
        logger.error('Fehler beim Prüfen des Status:', { error: checkErr });
        return res.status(500).json({ success: false, error: checkErr.message });
      }

      const { rechnung_betrag, gezahlt } = checkResults[0];
      let neuer_status = 'offen';
      let bezahlt_am = null;

      if (parseFloat(gezahlt) >= parseFloat(rechnung_betrag)) {
        neuer_status = 'bezahlt';
        bezahlt_am = zahlungsdatum;
      } else if (parseFloat(gezahlt) > 0) {
        neuer_status = 'teilweise_bezahlt';
      }

      // Update Status
      const updateQuery = `UPDATE rechnungen SET status = ?, bezahlt_am = ? WHERE rechnung_id = ?`;

      db.query(updateQuery, [neuer_status, bezahlt_am, id], (updateErr) => {
        if (updateErr) {
          logger.error('Fehler beim Aktualisieren des Status:', { error: updateErr });
          return res.status(500).json({ success: false, error: updateErr.message });
        }

        res.json({ success: true, message: 'Zahlung erfasst', status: neuer_status });
      });
    });
  });
});

module.exports = router;
