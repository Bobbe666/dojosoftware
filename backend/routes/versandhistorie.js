/**
 * versandhistorie.js
 * ==================
 * Archiv aller gesendeten Dokumente/E-Mails aus dem Vorlagen-System.
 * Lesezugriff pro Dojo — keine Write-Endpunkte (schreibt vorlagen.js).
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

// ── GET / — alle Einträge für Dojo (mit Filtern) ──────────────────────────────
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { mitglied_id, vorlage_id, von, bis, limit = 100, offset = 0 } = req.query;

  const conditions = ['vh.dojo_id = ?'];
  const params = [dojoId];

  if (mitglied_id) { conditions.push('vh.mitglied_id = ?'); params.push(mitglied_id); }
  if (vorlage_id)  { conditions.push('vh.vorlage_id = ?');  params.push(vorlage_id); }
  if (von)         { conditions.push('vh.gesendet_am >= ?'); params.push(von); }
  if (bis)         { conditions.push('vh.gesendet_am <= ?'); params.push(bis + ' 23:59:59'); }

  const where = conditions.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM versandhistorie vh WHERE ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT vh.*,
              CONCAT(COALESCE(m.vorname,''), ' ', COALESCE(m.nachname,'')) AS mitglied_name
       FROM versandhistorie vh
       LEFT JOIN mitglieder m ON vh.mitglied_id = m.mitglied_id
       WHERE ${where}
       ORDER BY vh.gesendet_am DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, eintraege: rows, total });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden: ' + err.message });
  }
});

// ── GET /mitglied/:id — Einträge für ein Mitglied ─────────────────────────────
router.get('/mitglied/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [rows] = await pool.query(
      `SELECT * FROM versandhistorie
       WHERE dojo_id = ? AND mitglied_id = ?
       ORDER BY gesendet_am DESC
       LIMIT 50`,
      [dojoId, req.params.id]
    );
    res.json({ success: true, eintraege: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden: ' + err.message });
  }
});

module.exports = router;
