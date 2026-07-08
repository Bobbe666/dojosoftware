// =============================================================================
// CHECK-IN-EINSTELLUNGEN pro Dojo
// GET  /api/checkin-einstellungen        → { stil_filter_aktiv }  (für Admin + Mitglieder)
// PUT  /api/checkin-einstellungen        → speichern (Admin)
// =============================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

router.use(authenticateToken);

const dojoIdOf = (req) => getSecureDojoId(req) || req.user?.dojo_id || (req.query.dojo_id ? parseInt(req.query.dojo_id) : null);

// GET — aktuelle Einstellung des Dojos (Default: aus)
router.get('/', async (req, res) => {
  try {
    const d = dojoIdOf(req);
    if (!d) return res.json({ success: true, stil_filter_aktiv: false });
    const [rows] = await pool.query('SELECT stil_filter_aktiv, alter_filter_aktiv FROM checkin_einstellungen WHERE dojo_id = ?', [d]);
    res.json({
      success: true,
      stil_filter_aktiv: rows.length ? !!rows[0].stil_filter_aktiv : false,
      alter_filter_aktiv: rows.length ? !!rows[0].alter_filter_aktiv : false,
    });
  } catch (e) { logger.error('checkin-einstellungen GET', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// PUT — speichern (nur Admin/Super-Admin)
router.put('/', async (req, res) => {
  try {
    const rolle = req.user?.rolle || req.user?.role;
    if (!['admin', 'super-admin', 'superadmin'].includes(rolle)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const d = dojoIdOf(req);
    if (!d) return res.status(400).json({ error: 'Dojo-ID fehlt' });
    const stil = req.body.stil_filter_aktiv ? 1 : 0;
    const alter = req.body.alter_filter_aktiv ? 1 : 0;
    await pool.query(
      `INSERT INTO checkin_einstellungen (dojo_id, stil_filter_aktiv, alter_filter_aktiv) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stil_filter_aktiv = VALUES(stil_filter_aktiv), alter_filter_aktiv = VALUES(alter_filter_aktiv)`,
      [d, stil, alter]
    );
    res.json({ success: true, stil_filter_aktiv: !!stil, alter_filter_aktiv: !!alter });
  } catch (e) { logger.error('checkin-einstellungen PUT', { error: e.message }); res.status(500).json({ error: e.message }); }
});

module.exports = router;
