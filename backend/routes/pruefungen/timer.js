/**
 * Prüfungs-Timer Konfiguration
 * Speichert/lädt Timer-Blöcke + Modus pro Dojo
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getSecureDojoId } = require('../../utils/dojo-filter-helper');

const pool = db.promise();

// GET /api/pruefungen/timer-config
router.get('/timer-config', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.json(null); // Kein Dojo ausgewählt → keine Konfiguration

    const [rows] = await pool.query(
      'SELECT * FROM pruefungs_timer_config WHERE dojo_id = ?',
      [dojoId]
    );

    if (rows.length === 0) return res.json(null);

    const row = rows[0];
    res.json({
      modus: row.modus,
      einfach_runden: row.einfach_runden,
      einfach_rundenzeit: row.einfach_rundenzeit,
      einfach_pausezeit: row.einfach_pausezeit,
      bloecke: row.bloecke ? JSON.parse(row.bloecke) : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pruefungen/timer-config
router.put('/timer-config', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id erforderlich' });

    const { modus, einfach_runden, einfach_rundenzeit, einfach_pausezeit, bloecke } = req.body;

    await pool.query(
      `INSERT INTO pruefungs_timer_config
         (dojo_id, modus, einfach_runden, einfach_rundenzeit, einfach_pausezeit, bloecke)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         modus              = VALUES(modus),
         einfach_runden     = VALUES(einfach_runden),
         einfach_rundenzeit = VALUES(einfach_rundenzeit),
         einfach_pausezeit  = VALUES(einfach_pausezeit),
         bloecke            = VALUES(bloecke),
         aktualisiert_am    = CURRENT_TIMESTAMP`,
      [
        dojoId,
        modus || 'bloecke',
        einfach_runden || 3,
        einfach_rundenzeit || 120,
        einfach_pausezeit || 60,
        JSON.stringify(bloecke || [])
      ]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
