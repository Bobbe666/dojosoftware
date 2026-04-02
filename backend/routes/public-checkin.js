const express = require('express');
const router = express.Router();
const db = require('../db');
const QRCode = require('qrcode');

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => err ? reject(err) : resolve(results))
  );

// GET /api/public/checkin/kurs/:stundenplan_id
// Kursinfo für die Selbst-Checkin-Seite
router.get('/kurs/:stundenplan_id', async (req, res) => {
  try {
    const sid = parseInt(req.params.stundenplan_id);
    if (!sid) return res.status(400).json({ error: 'Ungültige ID' });

    const rows = await queryAsync(`
      SELECT s.stundenplan_id, s.tag, s.uhrzeit_start, s.uhrzeit_ende,
             k.gruppenname as kurs_name, k.stil, k.dojo_id,
             d.dojoname
      FROM stundenplan s
      JOIN kurse k ON s.kurs_id = k.kurs_id
      LEFT JOIN dojo d ON k.dojo_id = d.id
      WHERE s.stundenplan_id = ?
      LIMIT 1
    `, [sid]);

    if (!rows.length) return res.status(404).json({ error: 'Kurs nicht gefunden' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/checkin/mitglieder/:dojo_id
// Mitgliederliste (nur Name + ID) für die Suche
router.get('/mitglieder/:dojo_id', async (req, res) => {
  try {
    const dojoId = parseInt(req.params.dojo_id);
    if (!dojoId) return res.status(400).json({ error: 'Ungültige Dojo-ID' });

    const rows = await queryAsync(`
      SELECT mitglied_id, vorname, nachname, gurtfarbe, geburtsdatum
      FROM mitglieder
      WHERE dojo_id = ? AND aktiv = 1
      ORDER BY nachname, vorname
    `, [dojoId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/public/checkin/selbst
// Selbst-Einchecken ohne Auth
router.post('/selbst', async (req, res) => {
  try {
    const { mitglied_id, stundenplan_id } = req.body;
    if (!mitglied_id || !stundenplan_id) {
      return res.status(400).json({ error: 'mitglied_id und stundenplan_id erforderlich' });
    }

    // Mitglied und Kurs validieren
    const members = await queryAsync(
      'SELECT mitglied_id, vorname, nachname, dojo_id FROM mitglieder WHERE mitglied_id = ? AND aktiv = 1',
      [mitglied_id]
    );
    if (!members.length) return res.status(404).json({ error: 'Mitglied nicht gefunden' });

    const courses = await queryAsync(
      'SELECT s.stundenplan_id, k.dojo_id FROM stundenplan s JOIN kurse k ON s.kurs_id = k.kurs_id WHERE s.stundenplan_id = ?',
      [stundenplan_id]
    );
    if (!courses.length) return res.status(404).json({ error: 'Kurs nicht gefunden' });

    // Sicherstellen dass Mitglied zum Dojo des Kurses gehört
    if (members[0].dojo_id !== courses[0].dojo_id) {
      return res.status(403).json({ error: 'Mitglied gehört nicht zu diesem Dojo' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Bereits eingecheckt?
    const existing = await queryAsync(
      `SELECT checkin_id FROM checkins
       WHERE mitglied_id = ? AND stundenplan_id = ? AND DATE(checkin_time) = ? AND status = 'active'`,
      [mitglied_id, stundenplan_id, today]
    );
    if (existing.length) {
      return res.json({ success: true, already: true, message: 'Bereits eingecheckt' });
    }

    // Checkin erstellen
    await queryAsync(
      `INSERT INTO checkins (mitglied_id, stundenplan_id, checkin_type, checkin_time, status)
       VALUES (?, ?, 'self', NOW(), 'active')`,
      [mitglied_id, stundenplan_id]
    );

    res.json({ success: true, already: false, vorname: members[0].vorname, nachname: members[0].nachname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/checkin/qr/:stundenplan_id?format=png
// QR-Code Bild für einen Kurs generieren
router.get('/qr/:stundenplan_id', async (req, res) => {
  try {
    const sid = parseInt(req.params.stundenplan_id);
    const format = req.query.format || 'png';
    const baseUrl = process.env.CHECKIN_APP_URL || 'https://checkin.tda-intl.org';
    const url = `${baseUrl}/?self=1&sid=${sid}`;

    if (format === 'png') {
      const buf = await QRCode.toBuffer(url, { width: 400, margin: 2, color: { dark: '#111518', light: '#ffffff' } });
      res.setHeader('Content-Type', 'image/png');
      res.send(buf);
    } else {
      const svg = await QRCode.toString(url, { type: 'svg', width: 400, margin: 2 });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
