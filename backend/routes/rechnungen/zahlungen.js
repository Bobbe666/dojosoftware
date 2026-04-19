/**
 * Rechnungen Zahlungen Routes
 * Zahlungserfassung und Status-Updates
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { getSecureDojoId } = require('../../middleware/tenantSecurity');

// POST /:id/zahlung - Zahlung erfassen
router.post('/:id/zahlung', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);
  const { id } = req.params;
  const { betrag, zahlungsdatum, zahlungsart, referenz, notizen } = req.body;

  if (!betrag || !zahlungsdatum || !zahlungsart) {
    return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen' });
  }

  const betragNum = parseFloat(betrag);
  if (isNaN(betragNum) || betragNum <= 0) {
    return res.status(400).json({ success: false, error: 'Ungültiger Betrag' });
  }

  // 🔒 Dojo-Check + Restbetrag-Prüfung in einem Query
  const rechnungQuery = secureDojoId
    ? `SELECT r.betrag as rechnung_betrag,
              COALESCE((SELECT SUM(z.betrag) FROM zahlungen z WHERE z.rechnung_id = r.rechnung_id), 0) as bereits_gezahlt
       FROM rechnungen r
       JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
       WHERE r.rechnung_id = ? AND m.dojo_id = ?`
    : `SELECT r.betrag as rechnung_betrag,
              COALESCE((SELECT SUM(z.betrag) FROM zahlungen z WHERE z.rechnung_id = r.rechnung_id), 0) as bereits_gezahlt
       FROM rechnungen r
       WHERE r.rechnung_id = ?`;
  const rechnungParams = secureDojoId ? [id, secureDojoId] : [id];

  db.query(rechnungQuery, rechnungParams, (rErr, rResults) => {
    if (rErr) {
      logger.error('Fehler beim Laden der Rechnung:', { error: rErr });
      return res.status(500).json({ success: false, error: rErr.message });
    }
    if (rResults.length === 0) {
      return res.status(404).json({ success: false, error: 'Rechnung nicht gefunden oder kein Zugriff' });
    }

    const { rechnung_betrag, bereits_gezahlt } = rResults[0];
    const restbetrag = parseFloat(rechnung_betrag) - parseFloat(bereits_gezahlt);

    if (betragNum > restbetrag + 0.01) { // +0.01 Toleranz für Rundungsfehler
      return res.status(400).json({
        success: false,
        error: `Betrag (${betragNum.toFixed(2)} €) überschreitet den offenen Restbetrag (${restbetrag.toFixed(2)} €)`
      });
    }

    // Zahlung einfügen
    const insertQuery = `
      INSERT INTO zahlungen (rechnung_id, betrag, zahlungsdatum, zahlungsart, referenz, notizen)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(insertQuery, [id, betragNum, zahlungsdatum, zahlungsart, referenz, notizen], (insertErr) => {
      if (insertErr) {
        logger.error('Fehler beim Erfassen der Zahlung:', { error: insertErr });
        return res.status(500).json({ success: false, error: insertErr.message });
      }

      const neugezahlt = parseFloat(bereits_gezahlt) + betragNum;
      let neuer_status = 'offen';
      let bezahlt_am = null;

      if (neugezahlt >= parseFloat(rechnung_betrag) - 0.01) {
        neuer_status = 'bezahlt';
        bezahlt_am = zahlungsdatum;
      } else if (neugezahlt > 0) {
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
