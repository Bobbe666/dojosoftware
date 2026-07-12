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
const { getSecureDojoId } = require('../../middleware/tenantSecurity');

// POST /generate-monthly - Monatliche Rechnungen für alle 'invoice' Verträge erstellen
router.post('/generate-monthly', async (req, res) => {
  const { monat, jahr } = req.body;
  const secureDojoId = getSecureDojoId(req);

  if (!monat || !jahr) {
    return res.status(400).json({ success: false, error: 'Monat und Jahr erforderlich' });
  }

  try {
    // Alle aktiven Verträge mit payment_method='invoice' laden
    // 🔒 Tenant-Scope: nur eigenes Dojo (Super-Admin = null → alle Dojos)
    const vertraegeQuery = `
      SELECT v.id, v.mitglied_id, v.payment_method
      FROM vertraege v
      JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
      WHERE v.status = 'aktiv'
        AND v.payment_method = 'invoice'
        ${secureDojoId ? 'AND m.dojo_id = ?' : ''}
    `;
    const vertraegeParams = secureDojoId ? [secureDojoId] : [];

    db.query(vertraegeQuery, vertraegeParams, async (err, vertraege) => {
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
    // 🔒 dojo_id NIE aus dem Body – immer aus dem JWT (Super-Admin = null → alle Dojos)
    const secureDojoId = getSecureDojoId(req);
    const result = await createRechnungenFromBeitraege(secureDojoId);
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
    const secureDojoId = getSecureDojoId(req);
    // 🔒 Ownership prüfen: Rechnung muss zum eigenen Dojo gehören
    const [own] = await db.promise().query(
      `SELECT COALESCE(m.dojo_id, r.dojo_id) AS resolved_dojo_id
       FROM rechnungen r
       LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
       WHERE r.rechnung_id = ?`,
      [id]
    );
    if (own.length === 0) return res.status(404).json({ success: false, error: 'Rechnung nicht gefunden' });
    if (secureDojoId && Number(own[0].resolved_dojo_id) !== Number(secureDojoId)) {
      return res.status(404).json({ success: false, error: 'Rechnung nicht gefunden' });
    }
    const result = await syncRechnungStatus(id);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Fehler bei Status-Synchronisation:', { error: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
