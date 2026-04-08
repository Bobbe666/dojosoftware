// ============================================================================
// DEMO-TERMIN BUCHUNGSSYSTEM
// Öffentliche Routes: /api/demo-termine/...
// Admin Routes:       /api/admin/demo-termine/...
// ============================================================================
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db');
const { authenticateToken } = require('../middleware/auth');

const pool = db.promise();

// Super-Admin Guard
function onlySuperAdmin(req, res, next) {
  const role = req.user?.rolle;
  const isSuperAdmin = role === 'super_admin' || (!req.user?.dojo_id && role === 'admin');
  if (!isSuperAdmin) return res.status(403).json({ success: false, error: 'Nur Super-Admin' });
  next();
}

// iCloud Konflikt-Check (intern)
async function checkICalConflict(start, end) {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM saas_settings WHERE setting_key = 'super_admin_ical_url' LIMIT 1"
    );
    const url = rows[0]?.setting_value || '';
    if (!url) return [];

    // Direkt den Calendar-Router nutzen wäre circular — inline prüfen via HTTP intern
    // Stattdessen: DB-Slots als Konfliktquelle nutzen reicht vorerst
    return [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÖFFENTLICHE ROUTEN (kein Auth)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/demo-termine/slots — alle sichtbaren Slots (frei + belegt) für die Buchungsseite
router.get('/slots', async (req, res) => {
  try {
    const now = new Date();
    // Beide zurückgeben: freie (buchbar) UND belegte (für Social Proof sichtbar)
    const [slots] = await pool.query(`
      SELECT id, slot_start, slot_end, duration_minutes,
             is_booked,
             CASE WHEN is_booked = 1 THEN 'belegt' ELSE 'frei' END AS status
      FROM demo_termine_slots
      WHERE is_available = 1
        AND slot_start   > ?
      ORDER BY slot_start ASC
      LIMIT 300
    `, [now]);
    res.json({ success: true, slots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/demo-termine/buchung — Termin buchen
router.post('/buchung', async (req, res) => {
  const { slot_id, vorname, nachname, email, telefon, vereinsname, bundesland, mitglieder_anzahl, nachricht } = req.body;

  if (!slot_id || !vorname || !nachname || !email) {
    return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen (slot_id, vorname, nachname, email)' });
  }

  // E-Mail-Validierung
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Ungültige E-Mail-Adresse' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Slot prüfen (FOR UPDATE sperrt gleichzeitige Buchungen)
    const [slots] = await conn.query(
      'SELECT * FROM demo_termine_slots WHERE id = ? AND is_available = 1 AND is_booked = 0 FOR UPDATE',
      [slot_id]
    );
    if (slots.length === 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, error: 'Dieser Termin ist leider nicht mehr verfügbar.' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    await conn.query(`
      INSERT INTO demo_buchungen
        (slot_id, vorname, nachname, email, telefon, vereinsname, bundesland, mitglieder_anzahl, nachricht, buchungs_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [slot_id, vorname.trim(), nachname.trim(), email.toLowerCase().trim(),
        telefon || null, vereinsname || null, bundesland || null,
        mitglieder_anzahl || null, nachricht || null, token]);

    await conn.query('UPDATE demo_termine_slots SET is_booked = 1 WHERE id = ?', [slot_id]);

    await conn.commit();

    res.json({ success: true, buchungs_token: token, message: 'Buchung erfolgreich! Wir melden uns in Kürze bei dir.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// GET /api/demo-termine/bestaetigung/:token — Buchungsdetails für Bestätigungsseite
router.get('/bestaetigung/:token', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.vorname, b.nachname, b.email, b.vereinsname, b.status,
             s.slot_start, s.slot_end, s.duration_minutes
      FROM demo_buchungen b
      JOIN demo_termine_slots s ON b.slot_id = s.id
      WHERE b.buchungs_token = ?
    `, [req.params.token]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Buchung nicht gefunden' });
    res.json({ success: true, buchung: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTEN (Super-Admin only)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/demo-termine/slots — alle Slots (auch gesperrte/gebuchte)
router.get('/admin/slots', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [slots] = await pool.query(`
      SELECT s.*,
             b.id         AS buchung_id,
             b.vorname,
             b.nachname,
             b.email,
             b.telefon,
             b.vereinsname,
             b.bundesland,
             b.mitglieder_anzahl,
             b.nachricht,
             b.status     AS buchung_status,
             b.admin_notiz,
             b.created_at AS buchung_created_at
      FROM demo_termine_slots s
      LEFT JOIN demo_buchungen b ON b.slot_id = s.id
      WHERE s.slot_start > DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY s.slot_start ASC
    `);
    res.json({ success: true, slots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/demo-termine/slots — neuen Slot anlegen
router.post('/admin/slots', authenticateToken, onlySuperAdmin, async (req, res) => {
  const { slot_start, duration_minutes = 60, notes } = req.body;
  if (!slot_start) return res.status(400).json({ success: false, error: 'slot_start fehlt' });

  const start = new Date(slot_start);
  if (isNaN(start.getTime())) return res.status(400).json({ success: false, error: 'Ungültiges Datum' });

  const end = new Date(start.getTime() + duration_minutes * 60 * 1000);

  // Überschneidung mit bestehenden Slots prüfen
  const [existing] = await pool.query(`
    SELECT id, slot_start, slot_end FROM demo_termine_slots
    WHERE is_available = 1
      AND slot_start < ? AND slot_end > ?
  `, [end, start]);
  if (existing.length > 0) {
    return res.status(409).json({ success: false, error: 'Überschneidung mit einem bestehenden Slot', conflicts: existing });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO demo_termine_slots (slot_start, slot_end, duration_minutes, notes) VALUES (?, ?, ?, ?)',
      [start, end, duration_minutes, notes || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/demo-termine/slots/bulk — mehrere Slots auf einmal anlegen
router.post('/admin/slots/bulk', authenticateToken, onlySuperAdmin, async (req, res) => {
  const { slots } = req.body; // Array von { slot_start, duration_minutes }
  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ success: false, error: 'slots-Array fehlt' });
  }

  const created = [];
  const skipped = [];

  for (const s of slots) {
    const start = new Date(s.slot_start);
    if (isNaN(start.getTime())) { skipped.push({ slot: s, reason: 'Ungültiges Datum' }); continue; }
    const dur = s.duration_minutes || 60;
    const end = new Date(start.getTime() + dur * 60 * 1000);

    const [existing] = await pool.query(`
      SELECT id FROM demo_termine_slots WHERE is_available = 1 AND slot_start < ? AND slot_end > ?
    `, [end, start]);
    if (existing.length > 0) { skipped.push({ slot: s, reason: 'Überschneidung' }); continue; }

    const [result] = await pool.query(
      'INSERT INTO demo_termine_slots (slot_start, slot_end, duration_minutes) VALUES (?, ?, ?)',
      [start, end, dur]
    );
    created.push(result.insertId);
  }

  res.json({ success: true, created: created.length, skipped: skipped.length, details: skipped });
});

// PUT /api/admin/demo-termine/slots/:id — Slot bearbeiten (freigeben/sperren, Notiz)
router.put('/admin/slots/:id', authenticateToken, onlySuperAdmin, async (req, res) => {
  const { is_available, notes, slot_start, duration_minutes } = req.body;
  const id = parseInt(req.params.id);

  try {
    const [rows] = await pool.query('SELECT * FROM demo_termine_slots WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Slot nicht gefunden' });
    if (rows[0].is_booked) return res.status(400).json({ success: false, error: 'Gebuchte Slots können nicht mehr bearbeitet werden' });

    const updates = {};
    if (is_available !== undefined) updates.is_available = is_available ? 1 : 0;
    if (notes !== undefined) updates.notes = notes;
    if (slot_start) {
      const start = new Date(slot_start);
      const dur   = duration_minutes || rows[0].duration_minutes;
      updates.slot_start       = start;
      updates.slot_end         = new Date(start.getTime() + dur * 60 * 1000);
      updates.duration_minutes = dur;
    }

    if (Object.keys(updates).length === 0) return res.json({ success: true });

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await pool.query(`UPDATE demo_termine_slots SET ${setClauses} WHERE id = ?`, [...Object.values(updates), id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/admin/demo-termine/slots/:id — Slot löschen (nur ungebuchte)
router.delete('/admin/slots/:id', authenticateToken, onlySuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [rows] = await pool.query('SELECT is_booked FROM demo_termine_slots WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Slot nicht gefunden' });
    if (rows[0].is_booked) return res.status(400).json({ success: false, error: 'Gebuchte Slots können nicht gelöscht werden' });

    await pool.query('DELETE FROM demo_termine_slots WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/demo-termine/buchungen — alle Buchungen
router.get('/admin/buchungen', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT b.*, s.slot_start, s.slot_end, s.duration_minutes
      FROM demo_buchungen b
      JOIN demo_termine_slots s ON b.slot_id = s.id
    `;
    const params = [];
    if (status) { query += ' WHERE b.status = ?'; params.push(status); }
    query += ' ORDER BY s.slot_start ASC';

    const [buchungen] = await pool.query(query, params);
    res.json({ success: true, buchungen });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/demo-termine/buchungen/:id — Status/Notiz einer Buchung ändern
router.put('/admin/buchungen/:id', authenticateToken, onlySuperAdmin, async (req, res) => {
  const { status, admin_notiz } = req.body;
  const id = parseInt(req.params.id);

  const allowed = ['ausstehend', 'bestaetigt', 'abgesagt'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ success: false, error: 'Ungültiger Status' });
  }

  try {
    const [rows] = await pool.query('SELECT slot_id FROM demo_buchungen WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Buchung nicht gefunden' });

    const updates = {};
    if (status) updates.status = status;
    if (admin_notiz !== undefined) updates.admin_notiz = admin_notiz;

    if (Object.keys(updates).length === 0) return res.json({ success: true });

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await pool.query(`UPDATE demo_buchungen SET ${setClauses} WHERE id = ?`, [...Object.values(updates), id]);

    // Wenn abgesagt → Slot wieder freigeben
    if (status === 'abgesagt') {
      await pool.query('UPDATE demo_termine_slots SET is_booked = 0 WHERE id = ?', [rows[0].slot_id]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/demo-termine/ical — iCal-Feed (token-geschützt, für Kalender-Abonnement)
router.get('/ical', async (req, res) => {
  try {
    const { token } = req.query;
    const [rows] = await pool.query(
      "SELECT setting_value FROM saas_settings WHERE setting_key = 'demo_ical_token' LIMIT 1"
    );
    const validToken = rows[0]?.setting_value;
    if (!validToken || token !== validToken) {
      return res.status(401).type('text').send('Ungültiger Token');
    }

    const [slots] = await pool.query(`
      SELECT s.id, s.slot_start, s.slot_end, s.duration_minutes, s.notes,
             s.is_booked, s.is_available,
             b.vorname, b.nachname, b.vereinsname, b.email, b.status AS buchung_status
      FROM demo_termine_slots s
      LEFT JOIN demo_buchungen b ON b.slot_id = s.id
      WHERE s.slot_start > DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY s.slot_start ASC
      LIMIT 500
    `);

    const fmtDt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Dojosoftware//Demo-Termine//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Demo-Termine',
      'X-WR-CALDESC:Freie und gebuchte Demo-Termine',
    ];

    for (const s of slots) {
      const start = new Date(s.slot_start);
      const end   = s.slot_end
        ? new Date(s.slot_end)
        : new Date(start.getTime() + s.duration_minutes * 60000);

      const summary = s.is_booked
        ? `Demo: ${s.vorname} ${s.nachname}${s.vereinsname ? ' – ' + s.vereinsname : ''}`
        : 'Demo-Termin (frei)';

      let desc = s.is_booked
        ? `Status: ${s.buchung_status || 'ausstehend'}\nKontakt: ${s.email || ''}`
        : 'Freier Demo-Slot (buchbar)';
      if (s.notes) desc += `\nNotiz: ${s.notes}`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:demo-slot-${s.id}@dojosoftware`,
        `DTSTART:${fmtDt(start)}`,
        `DTEND:${fmtDt(end)}`,
        `SUMMARY:${summary.replace(/,/g, '\\,')}`,
        `DESCRIPTION:${desc.replace(/\n/g, '\\n')}`,
        `STATUS:${s.is_booked ? 'CONFIRMED' : 'TENTATIVE'}`,
        `CATEGORIES:${s.is_booked ? 'Demo gebucht' : 'Demo frei'}`,
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="demo-termine.ics"');
    res.send(lines.join('\r\n'));
  } catch (err) {
    res.status(500).type('text').send('Fehler: ' + err.message);
  }
});

// GET /api/admin/demo-termine/ical-token — iCal-Feed-URL generieren/abrufen
router.get('/admin/ical-token', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM saas_settings WHERE setting_key = 'demo_ical_token' LIMIT 1"
    );
    let token = rows[0]?.setting_value;
    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      await pool.query(
        "INSERT INTO saas_settings (setting_key, setting_value) VALUES ('demo_ical_token', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [token, token]
      );
    }
    const feedUrl = `https://dojo.tda-intl.org/api/demo-termine/ical?token=${token}`;
    res.json({ success: true, feedUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/demo-termine/stats — Kennzahlen für Dashboard
router.get('/admin/stats', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [[{ gesamt_slots }]]    = await pool.query("SELECT COUNT(*) AS gesamt_slots FROM demo_termine_slots WHERE slot_start > NOW()");
    const [[{ freie_slots }]]     = await pool.query("SELECT COUNT(*) AS freie_slots FROM demo_termine_slots WHERE slot_start > NOW() AND is_available=1 AND is_booked=0");
    const [[{ offene_buchungen }]]= await pool.query("SELECT COUNT(*) AS offene_buchungen FROM demo_buchungen WHERE status='ausstehend'");
    const [[{ gesamt_buchungen }]]= await pool.query("SELECT COUNT(*) AS gesamt_buchungen FROM demo_buchungen");

    res.json({ success: true, stats: { gesamt_slots, freie_slots, offene_buchungen, gesamt_buchungen } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
