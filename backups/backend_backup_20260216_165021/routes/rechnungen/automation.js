/**
 * Rechnungen Automation Routes
 * Automatische Rechnungserstellung und Synchronisation
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { createRechnungForBeitrag } = require('../../utils/rechnungAutomation');
const { createRechnungenFromBeitraege, syncRechnungStatus } = require('../../services/rechnungAutomationFromBeitraege');

// POST /generate-monthly - Monatliche Rechnungen für alle 'invoice' Verträge erstellen
router.post('/generate-monthly', async (req, res) => {
  const { monat, jahr } = req.body;

  if (!monat || !jahr) {
    return res.status(400).json({ success: false, error: 'Monat und Jahr erforderlich' });
  }

  try {
    // Alle aktiven Verträge mit payment_method='invoice' laden
    const vertraegeQuery = `
      SELECT v.id, v.mitglied_id, v.payment_method
      FROM vertraege v
      WHERE v.status = 'aktiv'
        AND v.payment_method = 'invoice'
    `;

    db.query(vertraegeQuery, async (err, vertraege) => {
      if (err) {
        logger.error('Fehler beim Laden der Verträge:', { error: err });
        return res.status(500).json({ success: false, error: err.message });
      }

      const results = {
        success: 0,
        skipped: 0,
        errors: 0,
        rechnungen: []
      };

      // Für jeden Vertrag Rechnung erstellen
      for (const vertrag of vertraege) {
        try {
          const rechnungInfo = await createRechnungForBeitrag(
            vertrag.id,
            vertrag.mitglied_id,
            monat,
            jahr
          );

          if (rechnungInfo) {
            results.success++;
            results.rechnungen.push(rechnungInfo);
          } else {
            results.skipped++;
          }
        } catch (error) {
          logger.error(`Fehler bei Vertrag #${vertrag.id}:`, { error: error });
          results.errors++;
        }
      }

      res.json({
        success: true,
        message: `Rechnungserstellung abgeschlossen: ${results.success} erstellt, ${results.skipped} übersprungen, ${results.errors} Fehler`,
        data: results
      });
    });

  } catch (error) {
    logger.error('Fehler bei monatlicher Rechnungserstellung:', { error: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /auto-create - Erstellt Rechnungen für offene Lastschrift-Beiträge
router.post('/auto-create', async (req, res) => {
  try {
    const { dojo_id } = req.body;
    const result = await createRechnungenFromBeitraege(dojo_id);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Fehler bei automatischer Rechnungserstellung:', { error: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /:id/sync-status - Synchronisiert Status mit Beiträgen
router.post('/:id/sync-status', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await syncRechnungStatus(id);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Fehler bei Status-Synchronisation:', { error: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
