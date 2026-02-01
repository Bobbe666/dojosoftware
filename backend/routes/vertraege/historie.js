/**
 * Vertraege Historie Routes
 * Vertragshistorie abrufen und erstellen
 */
const express = require('express');
const logger = require('../../utils/logger');
const router = express.Router();
const { queryAsync } = require('./shared');

// GET /:id/historie - Historie eines Vertrags abrufen
router.get('/:id/historie', async (req, res) => {
  try {
    const { id } = req.params;
    const { dojo_id } = req.query;

    if (dojo_id && dojo_id !== 'all') {
      const vertragCheck = await queryAsync(`SELECT id, dojo_id FROM vertraege WHERE id = ?`, [id]);
      if (vertragCheck.length === 0) return res.status(404).json({ error: 'Vertrag nicht gefunden' });
      if (vertragCheck[0].dojo_id !== parseInt(dojo_id)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }

    const historie = await queryAsync(`
      SELECT id, aenderung_typ, aenderung_beschreibung, aenderung_details, geaendert_von, geaendert_am, ip_adresse
      FROM vertragshistorie
      WHERE vertrag_id = ?
      ORDER BY geaendert_am DESC
    `, [id]);

    res.json({ success: true, data: historie });
  } catch (err) {
    logger.error('Fehler beim Abrufen der Historie:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// POST /:id/historie - Historie-Eintrag hinzufügen
router.post('/:id/historie', async (req, res) => {
  try {
    const { id } = req.params;
    const { aenderung_typ, aenderung_beschreibung, aenderung_details, geaendert_von, ip_adresse, dojo_id } = req.body;

    if (dojo_id && dojo_id !== 'all') {
      const vertragCheck = await queryAsync(`SELECT id, dojo_id FROM vertraege WHERE id = ?`, [id]);
      if (vertragCheck.length === 0) return res.status(404).json({ error: 'Vertrag nicht gefunden' });
      if (vertragCheck[0].dojo_id !== parseInt(dojo_id)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }

    const result = await queryAsync(`
      INSERT INTO vertragshistorie (vertrag_id, aenderung_typ, aenderung_beschreibung, aenderung_details, geaendert_von, ip_adresse)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, aenderung_typ, aenderung_beschreibung, aenderung_details ? JSON.stringify(aenderung_details) : null, geaendert_von || null, ip_adresse || null]);

    res.json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    logger.error('Fehler beim Erstellen des Historie-Eintrags:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

module.exports = router;
