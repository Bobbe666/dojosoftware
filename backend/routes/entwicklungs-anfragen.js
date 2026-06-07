// ============================================================================
// ENTWICKLUNGS-ANFRAGEN (Homepage-Erstellung & Individualsoftware)
// Öffentliche Route: POST /api/entwicklungs-anfragen (Formular tda-intl.org)
// Anfragen landen als Meldung in super_admin_notifications (SuperAdminDashboard
// → Kommunikation → Meldungen) + E-Mail an info@tda-intl.com
// ============================================================================
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { sendEmail } = require('../services/emailService');

const pool = db.promise();

// Einfaches In-Memory-Rate-Limit: max 3 Anfragen pro IP pro Stunde
const rateMap = new Map();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const recent = (rateMap.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateMap.set(ip, recent);
  if (rateMap.size > 1000) {
    for (const [k, v] of rateMap) {
      if (v.every(t => now - t > RATE_WINDOW_MS)) rateMap.delete(k);
    }
  }
  return true;
}

const esc = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PROJEKT_LABELS = {
  homepage: '🌐 Homepage',
  software: '⚙️ Individuelle Software',
  beides:   '🌐⚙️ Homepage + Software',
};

// POST /api/entwicklungs-anfragen — Anfrage einreichen (öffentlich)
router.post('/', async (req, res) => {
  const { name, email, telefon, schulname, projekt_typ, beschreibung, firmenname } = req.body;

  // Honeypot: Bots füllen das versteckte Feld → still "Erfolg" melden
  if (firmenname) {
    return res.json({ success: true, message: 'Anfrage erfolgreich gesendet!' });
  }

  if (!name || !email || !beschreibung) {
    return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen (Name, E-Mail, Beschreibung)' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Ungültige E-Mail-Adresse' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Zu viele Anfragen — bitte versuche es später erneut.' });
  }

  const anfrage = {
    name: String(name).trim().slice(0, 255),
    email: String(email).toLowerCase().trim().slice(0, 255),
    telefon: telefon ? String(telefon).trim().slice(0, 50) : null,
    schulname: schulname ? String(schulname).trim().slice(0, 255) : null,
    projekt_typ: ['homepage', 'software', 'beides'].includes(projekt_typ) ? projekt_typ : 'homepage',
    beschreibung: String(beschreibung).trim().slice(0, 5000),
  };
  const projektLabel = PROJEKT_LABELS[anfrage.projekt_typ];

  try {
    // Tabelle sicherstellen (gleiche Definition wie in admin.js /notifications)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS super_admin_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        typ VARCHAR(50) NOT NULL,
        titel VARCHAR(255) NOT NULL,
        nachricht TEXT,
        prioritaet ENUM('normal', 'wichtig', 'dringend') DEFAULT 'normal',
        empfaenger_typ VARCHAR(50) DEFAULT 'admin',
        gelesen BOOLEAN DEFAULT FALSE,
        archiviert BOOLEAN DEFAULT FALSE,
        erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        gelesen_am TIMESTAMP NULL,
        archiviert_am TIMESTAMP NULL,
        INDEX idx_gelesen (gelesen),
        INDEX idx_archiviert (archiviert),
        INDEX idx_erstellt (erstellt_am)
      )
    `);

    // Meldung im SuperAdminDashboard (Kommunikation → Meldungen)
    const nachricht =
      `${projektLabel}\n` +
      `Name: ${anfrage.name}\n` +
      `E-Mail: ${anfrage.email}\n` +
      `Telefon: ${anfrage.telefon || '–'}\n` +
      `Schule: ${anfrage.schulname || '–'}\n\n` +
      `Beschreibung:\n${anfrage.beschreibung}`;

    await pool.query(`
      INSERT INTO super_admin_notifications (typ, titel, nachricht, prioritaet)
      VALUES ('entwicklungs_anfrage', ?, ?, 'wichtig')
    `, [`🛠️ Entwicklungs-Anfrage: ${anfrage.schulname || anfrage.name}`, nachricht]);

    // E-Mail an Admin (asynchron — Fehler blockieren die Antwort nicht)
    const html =
      `<h2>🛠️ Neue Entwicklungs-Anfrage</h2>` +
      `<table style="border-collapse:collapse;margin:16px 0">` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Projekt</td><td><strong>${projektLabel}</strong></td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">👤 Name</td><td><strong>${esc(anfrage.name)}</strong></td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">📧 E-Mail</td><td><strong>${esc(anfrage.email)}</strong></td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">📞 Telefon</td><td><strong>${esc(anfrage.telefon || '–')}</strong></td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">🏫 Schule</td><td><strong>${esc(anfrage.schulname || '–')}</strong></td></tr>` +
      `</table>` +
      `<p style="color:#666;margin-bottom:4px">Beschreibung:</p>` +
      `<div style="padding:12px 16px;background:#f8fafc;border-left:3px solid #d9aa43;border-radius:4px;white-space:pre-wrap">${esc(anfrage.beschreibung)}</div>` +
      `<p style="margin-top:16px;color:#666">Die Anfrage liegt auch im SuperAdmin-Dashboard unter Meldungen.</p>`;

    sendEmail({
      to: 'info@tda-intl.com',
      subject: `🛠️ Entwicklungs-Anfrage (${projektLabel.replace(/[^\wäöüÄÖÜß+ ]/g, '').trim()}): ${anfrage.schulname || anfrage.name}`,
      text: `Neue Entwicklungs-Anfrage!\n\n${nachricht}\n\n(Auch im SuperAdmin-Dashboard unter Meldungen.)`,
      html,
      replyTo: anfrage.email
    }).catch(err => console.error('[Entwicklungs-Anfrage] Mail-Fehler:', err.message));

    res.json({ success: true, message: 'Anfrage erfolgreich gesendet! Wir melden uns in Kürze bei dir.' });
  } catch (err) {
    console.error('[Entwicklungs-Anfrage] Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Anfrage konnte nicht gesendet werden. Bitte versuche es später erneut.' });
  }
});

module.exports = router;
