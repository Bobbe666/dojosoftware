/**
 * Rechnungen Aktionen Routes
 * Protokolliert E-Mail-Versand, Drucken, Lastschrift-Einzug
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { getSecureDojoId } = require('../../middleware/tenantSecurity');

const ERLAUBTE_TYPEN = ['email_gesendet', 'gedruckt', 'lastschrift_eingezogen'];

// POST /:id/aktion - Aktion loggen (gedruckt etc.)
router.post('/:id/aktion', async (req, res) => {
  const { id } = req.params;
  const { typ, notiz } = req.body;
  const secureDojoId = getSecureDojoId(req);

  if (!ERLAUBTE_TYPEN.includes(typ)) {
    return res.status(400).json({ error: 'Ungültiger Aktionstyp' });
  }

  try {
    const pool = db.promise();

    const checkQuery = secureDojoId
      ? `SELECT r.rechnung_id FROM rechnungen r LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id WHERE r.rechnung_id = ? AND (m.dojo_id = ? OR (r.mitglied_id IS NULL AND r.dojo_id = ?))`
      : `SELECT rechnung_id FROM rechnungen WHERE rechnung_id = ?`;
    const checkParams = secureDojoId ? [id, secureDojoId, secureDojoId] : [id];

    const [rows] = await pool.execute(checkQuery, checkParams);
    if (rows.length === 0) return res.status(404).json({ error: 'Rechnung nicht gefunden' });

    await pool.execute(
      'INSERT INTO rechnung_aktionen (rechnung_id, aktion_typ, erstellt_von, notiz) VALUES (?, ?, ?, ?)',
      [id, typ, req.user?.id || null, notiz || null]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Loggen der Aktion:', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// GET /:id/aktionen - Aktionen einer Rechnung abrufen
router.get('/:id/aktionen', async (req, res) => {
  const { id } = req.params;
  const secureDojoId = getSecureDojoId(req);

  try {
    const pool = db.promise();

    const checkQuery = secureDojoId
      ? `SELECT r.rechnung_id FROM rechnungen r LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id WHERE r.rechnung_id = ? AND (m.dojo_id = ? OR (r.mitglied_id IS NULL AND r.dojo_id = ?))`
      : `SELECT rechnung_id FROM rechnungen WHERE rechnung_id = ?`;
    const checkParams = secureDojoId ? [id, secureDojoId, secureDojoId] : [id];

    const [rows] = await pool.execute(checkQuery, checkParams);
    if (rows.length === 0) return res.status(404).json({ error: 'Rechnung nicht gefunden' });

    const [aktionen] = await pool.execute(
      'SELECT * FROM rechnung_aktionen WHERE rechnung_id = ? ORDER BY erstellt_am DESC',
      [id]
    );

    res.json({ success: true, data: aktionen });
  } catch (error) {
    logger.error('Fehler beim Laden der Aktionen:', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
