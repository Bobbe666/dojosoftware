// ============================================================================
// PILOT-PARTNER-PROGRAMM — BEWERBUNGEN
// Öffentliche Route: POST /api/pilot-bewerbungen        (Formular tda-intl.com)
// Admin Routes:      /api/pilot-bewerbungen/admin/...   (Super-Admin)
// ============================================================================
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

const pool = db.promise();

// Super-Admin Guard (wie demo-termine.js)
function onlySuperAdmin(req, res, next) {
  const role = req.user?.rolle;
  const isSuperAdmin = role === 'super_admin' || (!req.user?.dojo_id && role === 'admin');
  if (!isSuperAdmin) return res.status(403).json({ success: false, error: 'Nur Super-Admin' });
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Einfaches In-Memory-Rate-Limit: max 3 Bewerbungen pro IP pro Stunde
// ─────────────────────────────────────────────────────────────────────────────
const rateMap = new Map();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || [];
  const recent = entry.filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateMap.set(ip, recent);
  // Map gelegentlich aufräumen
  if (rateMap.size > 1000) {
    for (const [k, v] of rateMap) {
      if (v.every(t => now - t > RATE_WINDOW_MS)) rateMap.delete(k);
    }
  }
  return true;
}

const esc = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ─────────────────────────────────────────────────────────────────────────────
// E-Mails
// ─────────────────────────────────────────────────────────────────────────────
async function sendAdminBenachrichtigung(b) {
  const rows = [
    ['🏫 Schule', b.schulname],
    ['👤 Ansprechpartner', b.ansprechpartner],
    ['📧 E-Mail', b.email],
    ['📞 Telefon', b.telefon || '–'],
    ['📍 Ort', b.ort || '–'],
    ['🌐 Website', b.website || '–'],
    ['🥋 Stilrichtungen', b.stilrichtungen || '–'],
    ['👥 Mitglieder', b.mitglieder_anzahl || '–'],
    ['💻 Aktuelle Software', b.aktuelle_software || '–'],
  ];

  const text =
    `Neue Pilot-Partner-Bewerbung!\n\n` +
    rows.map(([l, v]) => `${l.replace(/^[^\s]+\s/, '')}: ${v}`).join('\n') +
    `\n\nGrößte Herausforderung:\n${b.herausforderung || '–'}\n\n` +
    `Warum Pilot-Partner werden:\n${b.begruendung || '–'}\n\n` +
    `→ Verwaltung: https://dojo.tda-intl.org (PlattformZentrale → Pilot-Programm)`;

  const html =
    `<h2>🏆 Neue Pilot-Partner-Bewerbung</h2>` +
    `<table style="border-collapse:collapse;margin:16px 0">` +
    rows.map(([l, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">${l}</td><td><strong>${esc(v)}</strong></td></tr>`).join('') +
    `</table>` +
    `<p style="color:#666;margin-bottom:4px">Größte Herausforderung:</p>` +
    `<div style="padding:12px 16px;background:#f8fafc;border-left:3px solid #f59e0b;border-radius:4px;white-space:pre-wrap">${esc(b.herausforderung || '–')}</div>` +
    `<p style="color:#666;margin-bottom:4px">Warum Pilot-Partner werden:</p>` +
    `<div style="padding:12px 16px;background:#f8fafc;border-left:3px solid #f59e0b;border-radius:4px;white-space:pre-wrap">${esc(b.begruendung || '–')}</div>` +
    `<p style="margin-top:16px"><a href="https://dojo.tda-intl.org" style="color:#6366f1;font-weight:bold">→ Bewerbung in der PlattformZentrale ansehen</a></p>`;

  await sendEmail({
    to: 'info@tda-intl.com',
    subject: `🏆 Neue Pilot-Bewerbung: ${b.schulname}`,
    text,
    html,
    replyTo: b.email
  });
}

async function sendBewerberBestaetigung(b) {
  const text =
    `Hallo ${b.ansprechpartner},\n\n` +
    `vielen Dank für eure Bewerbung als TDA Pilot-Partner!\n\n` +
    `Wir haben eure Bewerbung für "${b.schulname}" erhalten und melden uns ` +
    `innerhalb weniger Tage persönlich bei euch.\n\n` +
    `Jeden Monat wählen wir eine Schule aus, die unsere Software 12 Monate ` +
    `kostenlos nutzt — inklusive persönlicher Einrichtung und Datenübernahme.\n\n` +
    `Viele Grüße\nTDA International`;

  const html =
    `<p>Hallo <strong>${esc(b.ansprechpartner)}</strong>,</p>` +
    `<p>vielen Dank für eure Bewerbung als <strong>TDA Pilot-Partner</strong>! 🏆</p>` +
    `<p>Wir haben eure Bewerbung für <strong>„${esc(b.schulname)}"</strong> erhalten und melden uns innerhalb weniger Tage persönlich bei euch.</p>` +
    `<p>Jeden Monat wählen wir eine Schule aus, die unsere Software <strong>12 Monate kostenlos</strong> nutzt — inklusive persönlicher Einrichtung und Datenübernahme.</p>` +
    `<p>Viele Grüße<br><strong>TDA International</strong></p>`;

  await sendEmail({
    to: b.email,
    subject: 'Deine Pilot-Partner-Bewerbung ist eingegangen 🏆',
    text,
    html,
    replyTo: 'info@tda-intl.com'
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ÖFFENTLICHE ROUTE (kein Auth)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/pilot-bewerbungen — Bewerbung einreichen
router.post('/', async (req, res) => {
  const {
    schulname, ansprechpartner, email, telefon, ort, website,
    stilrichtungen, mitglieder_anzahl, aktuelle_software,
    herausforderung, begruendung,
    firmenname // Honeypot — Menschen lassen das Feld leer
  } = req.body;

  // Honeypot: Bots füllen das versteckte Feld → still "Erfolg" melden
  if (firmenname) {
    return res.json({ success: true, message: 'Bewerbung erfolgreich eingereicht!' });
  }

  if (!schulname || !ansprechpartner || !email || !begruendung) {
    return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen (Schulname, Ansprechpartner, E-Mail, Begründung)' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Ungültige E-Mail-Adresse' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Zu viele Bewerbungen — bitte versuche es später erneut.' });
  }

  try {
    // Doppelte Bewerbung derselben E-Mail innerhalb von 30 Tagen abfangen
    const [dupes] = await pool.query(
      `SELECT id FROM pilot_bewerbungen WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    if (dupes.length > 0) {
      return res.status(409).json({ success: false, error: 'Mit dieser E-Mail-Adresse wurde bereits eine Bewerbung eingereicht. Wir melden uns bei dir!' });
    }

    const bewerbung = {
      schulname: schulname.trim().slice(0, 255),
      ansprechpartner: ansprechpartner.trim().slice(0, 255),
      email: email.toLowerCase().trim().slice(0, 255),
      telefon: telefon ? String(telefon).trim().slice(0, 50) : null,
      ort: ort ? String(ort).trim().slice(0, 255) : null,
      website: website ? String(website).trim().slice(0, 255) : null,
      stilrichtungen: stilrichtungen ? String(stilrichtungen).trim().slice(0, 500) : null,
      mitglieder_anzahl: mitglieder_anzahl ? String(mitglieder_anzahl).trim().slice(0, 50) : null,
      aktuelle_software: aktuelle_software ? String(aktuelle_software).trim().slice(0, 255) : null,
      herausforderung: herausforderung ? String(herausforderung).trim().slice(0, 5000) : null,
      begruendung: String(begruendung).trim().slice(0, 5000)
    };

    await pool.query(`
      INSERT INTO pilot_bewerbungen
        (schulname, ansprechpartner, email, telefon, ort, website,
         stilrichtungen, mitglieder_anzahl, aktuelle_software,
         herausforderung, begruendung, ip_adresse)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [bewerbung.schulname, bewerbung.ansprechpartner, bewerbung.email,
        bewerbung.telefon, bewerbung.ort, bewerbung.website,
        bewerbung.stilrichtungen, bewerbung.mitglieder_anzahl, bewerbung.aktuelle_software,
        bewerbung.herausforderung, bewerbung.begruendung, ip || null]);

    // E-Mails asynchron — Fehler blockieren die Antwort nicht
    sendAdminBenachrichtigung(bewerbung).catch(err => console.error('[Pilot-Bewerbung] Admin-Mail-Fehler:', err.message));
    sendBewerberBestaetigung(bewerbung).catch(err => console.error('[Pilot-Bewerbung] Bestätigungs-Mail-Fehler:', err.message));

    res.json({ success: true, message: 'Bewerbung erfolgreich eingereicht! Wir melden uns in Kürze bei dir.' });
  } catch (err) {
    console.error('[Pilot-Bewerbung] Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Bewerbung konnte nicht gespeichert werden. Bitte versuche es später erneut.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ROUTEN (Super-Admin)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/pilot-bewerbungen/admin — alle Bewerbungen (optional ?status=neu)
router.get('/admin', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM pilot_bewerbungen';
    const params = [];
    if (status && ['neu', 'in_pruefung', 'gewonnen', 'abgelehnt'].includes(status)) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, bewerbungen: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/pilot-bewerbungen/admin/stats — Zähler je Status
router.get('/admin/stats', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT status, COUNT(*) AS anzahl FROM pilot_bewerbungen GROUP BY status'
    );
    const stats = { neu: 0, in_pruefung: 0, gewonnen: 0, abgelehnt: 0 };
    rows.forEach(r => { stats[r.status] = r.anzahl; });
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/pilot-bewerbungen/admin/:id — Status / interne Notiz aktualisieren
router.put('/admin/:id', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const { status, notiz_intern } = req.body;
    const updates = [];
    const params = [];

    if (status !== undefined) {
      if (!['neu', 'in_pruefung', 'gewonnen', 'abgelehnt'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Ungültiger Status' });
      }
      updates.push('status = ?');
      params.push(status);
    }
    if (notiz_intern !== undefined) {
      updates.push('notiz_intern = ?');
      params.push(notiz_intern || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Keine Änderungen übergeben' });
    }

    params.push(req.params.id);
    const [result] = await pool.query(
      `UPDATE pilot_bewerbungen SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Bewerbung nicht gefunden' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/pilot-bewerbungen/admin/:id — Bewerbung löschen (z.B. Spam)
router.delete('/admin/:id', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM pilot_bewerbungen WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Bewerbung nicht gefunden' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
