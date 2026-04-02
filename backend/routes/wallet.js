const express = require('express');
const router = express.Router();
const db = require('../db');
const QRCode = require('qrcode');
const pool = db.promise();
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// GET /wallet/qr/:mitglied_id — QR-Code als PNG oder SVG
router.get('/qr/:mitglied_id', async (req, res) => {
  const mitgliedId = parseInt(req.params.mitglied_id);
  const { format = 'png' } = req.query;
  const secureDojoId = getSecureDojoId(req);

  try {
    const dojoClause = secureDojoId ? ' AND m.dojo_id = ?' : '';
    const params = [mitgliedId, ...(secureDojoId ? [secureDojoId] : [])];
    const [rows] = await pool.query(
      `SELECT m.mitglied_id, m.vorname, m.nachname, m.mitglieds_nr, m.dojo_id,
              d.dojoname,
              GROUP_CONCAT(DISTINCT CONCAT(s.name, ': ', COALESCE(g.name, '?')) ORDER BY s.name SEPARATOR ' | ') AS graduierungen
       FROM mitglieder m
       LEFT JOIN dojo d ON m.dojo_id = d.id
       LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
       LEFT JOIN stile s ON ms.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON ms.graduierung_id = g.graduierung_id
       WHERE m.mitglied_id = ?${dojoClause}
       GROUP BY m.mitglied_id`,
      params
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const m = rows[0];
    const qrData = JSON.stringify({
      id: m.mitglied_id,
      nr: m.mitglieds_nr,
      name: `${m.vorname} ${m.nachname}`,
      dojo: m.dojoname,
      grad: m.graduierungen,
      ts: Date.now()
    });

    if (format === 'svg') {
      const svg = await QRCode.toString(qrData, { type: 'svg', margin: 1, width: 256 });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    // Default: PNG Buffer
    const png = await QRCode.toBuffer(qrData, { type: 'png', margin: 1, width: 256 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(png);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim QR-Code', detail: err.message });
  }
});

// GET /wallet/pass/:mitglied_id — Ausweis-Daten als JSON
router.get('/pass/:mitglied_id', async (req, res) => {
  const mitgliedId = parseInt(req.params.mitglied_id);
  const secureDojoId = getSecureDojoId(req);

  try {
    const dojoClause = secureDojoId ? ' AND m.dojo_id = ?' : '';
    const params = [mitgliedId, ...(secureDojoId ? [secureDojoId] : [])];
    const [rows] = await pool.query(
      `SELECT m.mitglied_id, m.vorname, m.nachname, m.mitglieds_nr,
              m.geburtsdatum, m.eintrittsdatum,
              d.dojoname,
              GROUP_CONCAT(DISTINCT CONCAT(s.name, ': ', COALESCE(g.name, 'Anfänger')) ORDER BY s.name SEPARATOR '\n') AS graduierungen,
              GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS stile
       FROM mitglieder m
       LEFT JOIN dojo d ON m.dojo_id = d.id
       LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
       LEFT JOIN stile s ON ms.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON ms.graduierung_id = g.graduierung_id
       WHERE m.mitglied_id = ?${dojoClause}
       GROUP BY m.mitglied_id`,
      params
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const m = rows[0];
    res.json({
      success: true,
      pass: {
        mitglied_id: m.mitglied_id,
        mitglieds_nr: m.mitglieds_nr,
        vorname: m.vorname,
        nachname: m.nachname,
        dojo: m.dojoname,
        stile: m.stile,
        graduierungen: m.graduierungen,
        eintrittsdatum: m.eintrittsdatum,
        generiert_am: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

module.exports = router;
