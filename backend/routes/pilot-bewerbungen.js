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
const { renderEmail, DEFAULT_THEME } = require('../services/emailLayout');

const pool = db.promise();

// Zentrales Mail-Layout (allgemeiner TDA-Header) für alle Pilot-Mails
const PILOT_THEME = { ...DEFAULT_THEME, dojoName: 'TDA International' };
const pilotHtml = (bodyHtml, titel = 'TDA Pilot-Partner-Programm') =>
  renderEmail({ theme: PILOT_THEME, anlass: 'allgemein', titel, bodyHtml });

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
    html: pilotHtml(html, 'Neue Pilot-Bewerbung'),
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
    html: pilotHtml(html),
    replyTo: 'info@tda-intl.com'
  });
}

// Pilot-Bewerbung als Akquise-Kontakt anlegen (heißer Lead).
// Existiert die E-Mail schon, wird nur eine Aktivität ergänzt statt ein Duplikat angelegt.
async function legeAkquiseKontaktAn(b) {
  const [vorhanden] = await pool.query(
    'SELECT id FROM akquise_kontakte WHERE email = ? LIMIT 1', [b.email]
  );

  let kontaktId;
  if (vorhanden.length > 0) {
    kontaktId = vorhanden[0].id;
    // Bestehenden Kontakt als Pilot-Bewerber markieren + hochpriorisieren
    await pool.query(
      `UPDATE akquise_kontakte
       SET prioritaet = 'hoch',
           tags = TRIM(BOTH ',' FROM CONCAT(COALESCE(NULLIF(tags,''),''), ',pilot-beworben'))
       WHERE id = ? AND (tags IS NULL OR tags NOT LIKE '%pilot-beworben%')`,
      [kontaktId]
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO akquise_kontakte
         (organisation, ansprechpartner, email, telefon, ort, webseite, sportart,
          mitglieder_anzahl, typ, status, prioritaet, quelle, tags, notiz)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'schule', 'interessiert', 'hoch', 'pilot', 'pilot-beworben', ?)`,
      [
        b.schulname, b.ansprechpartner, b.email, b.telefon || null, b.ort || null,
        b.website || null, b.stilrichtungen || null,
        parseInt(String(b.mitglieder_anzahl || '').replace(/\D/g, ''), 10) || null,
        `Pilot-Partner-Bewerbung. Aktuelle Software: ${b.aktuelle_software || '–'}. ` +
        `Herausforderung: ${b.herausforderung || '–'}`,
      ]
    );
    kontaktId = result.insertId;
  }

  // Aktivität protokollieren
  await pool.query(
    `INSERT INTO akquise_aktivitaeten (kontakt_id, art, betreff, inhalt)
     VALUES (?, 'sonstiges', 'Pilot-Partner-Bewerbung eingegangen', ?)`,
    [kontaktId, `Begründung: ${b.begruendung || '–'}`]
  ).catch(() => { /* Aktivitäten-Tabelle optional — Kontakt ist das Wichtige */ });

  return kontaktId;
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

    // Heißer Lead → automatisch in den Akquise-Trichter (Duplikat-Schutz via E-Mail)
    legeAkquiseKontaktAn(bewerbung).catch(err => console.error('[Pilot-Bewerbung] Akquise-Sync-Fehler:', err.message));

    res.json({ success: true, message: 'Bewerbung erfolgreich eingereicht! Wir melden uns in Kürze bei dir.' });
  } catch (err) {
    console.error('[Pilot-Bewerbung] Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Bewerbung konnte nicht gespeichert werden. Bitte versuche es später erneut.' });
  }
});

// GET /api/pilot-bewerbungen/public/partner — gewonnene Partner für die Website
// (anonymisiert: nur Schulname + Ort, kein Kontakt) — Social Proof auf tda-intl.org
router.get('/public/partner', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT schulname, ort, stilrichtungen, programm_start
      FROM pilot_bewerbungen
      WHERE status = 'gewonnen'
      ORDER BY programm_start DESC, id DESC
      LIMIT 24
    `);
    res.json({ success: true, partner: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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

    // Alten Status merken — Mails nur bei ECHTEM Statuswechsel, nicht bei jedem Speichern
    const [[vorher]] = await pool.query(
      'SELECT status, schulname, ansprechpartner, email FROM pilot_bewerbungen WHERE id = ?',
      [req.params.id]
    );
    if (!vorher) {
      return res.status(404).json({ success: false, error: 'Bewerbung nicht gefunden' });
    }

    params.push(req.params.id);
    const [result] = await pool.query(
      `UPDATE pilot_bewerbungen SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Bewerbung nicht gefunden' });
    }

    // Status-Mails — nur bei ECHTEM Wechsel
    if (status && status !== vorher.status) {
      const b = vorher;

      if (status === 'in_pruefung') {
        sendEmail({
          to: b.email,
          subject: 'Eure Pilot-Partner-Bewerbung wird geprüft 🔍',
          text:
            `Hallo ${b.ansprechpartner},\n\n` +
            `gute Nachrichten: Eure Bewerbung für "${b.schulname}" ist bei uns angekommen ` +
            `und befindet sich jetzt in der Prüfung.\n\n` +
            `Wir schauen uns jede Bewerbung persönlich an und melden uns, sobald die ` +
            `Entscheidung gefallen ist.\n\n` +
            `Viele Grüße\nTDA International`,
          html: pilotHtml(
            `<p>Hallo <strong>${esc(b.ansprechpartner)}</strong>,</p>` +
            `<p>gute Nachrichten: Eure Bewerbung für <strong>„${esc(b.schulname)}"</strong> ist bei uns angekommen und befindet sich jetzt <strong>in der Prüfung</strong>. 🔍</p>` +
            `<p>Wir schauen uns jede Bewerbung persönlich an und melden uns, sobald die Entscheidung gefallen ist.</p>` +
            `<p>Viele Grüße<br><strong>TDA International</strong></p>`
          ),
          replyTo: 'info@tda-intl.com'
        }).catch(err => console.error('[Pilot-Bewerbung] In-Prüfung-Mail-Fehler:', err.message));
      }

      if (status === 'gewonnen') {
        sendEmail({
          to: b.email,
          subject: '🏆 Herzlichen Glückwunsch — ihr seid TDA Pilot-Partner!',
          text:
            `Hallo ${b.ansprechpartner},\n\n` +
            `wir freuen uns riesig: "${b.schulname}" ist unser neuer Pilot-Partner! 🏆\n\n` +
            `Das erwartet euch jetzt:\n` +
            `• 12 Monate kostenlose Nutzung der kompletten DojoSoftware\n` +
            `• Persönliche Einrichtung gemeinsam mit uns\n` +
            `• Übernahme eurer bestehenden Daten\n\n` +
            `Wir melden uns in den nächsten Tagen persönlich bei euch, um den Start zu planen. ` +
            `Von Zeit zu Zeit schicken wir euch außerdem einen kurzen Fragebogen (2 Minuten), ` +
            `damit wir die Software gemeinsam mit euch noch besser machen.\n\n` +
            `Willkommen an Bord!\nTDA International`,
          html: pilotHtml(
            `<p>Hallo <strong>${esc(b.ansprechpartner)}</strong>,</p>` +
            `<p>wir freuen uns riesig: <strong>„${esc(b.schulname)}"</strong> ist unser neuer <strong>Pilot-Partner</strong>! 🏆</p>` +
            `<p><strong>Das erwartet euch jetzt:</strong></p>` +
            `<ul>` +
            `<li>12 Monate kostenlose Nutzung der kompletten DojoSoftware</li>` +
            `<li>Persönliche Einrichtung gemeinsam mit uns</li>` +
            `<li>Übernahme eurer bestehenden Daten</li>` +
            `</ul>` +
            `<p>Wir melden uns in den nächsten Tagen persönlich bei euch, um den Start zu planen. Von Zeit zu Zeit schicken wir euch außerdem einen kurzen Fragebogen (2 Minuten), damit wir die Software gemeinsam mit euch noch besser machen.</p>` +
            `<p>Willkommen an Bord!<br><strong>TDA International</strong></p>`
          ),
          replyTo: 'info@tda-intl.com'
        }).catch(err => console.error('[Pilot-Bewerbung] Gewonnen-Mail-Fehler:', err.message));
      }

      if (status === 'abgelehnt') {
        sendEmail({
          to: b.email,
          subject: 'Eure Pilot-Partner-Bewerbung',
          text:
            `Hallo ${b.ansprechpartner},\n\n` +
            `vielen Dank für euer Interesse am TDA Pilot-Partner-Programm und die Mühe, ` +
            `die ihr euch mit der Bewerbung für "${b.schulname}" gemacht habt.\n\n` +
            `Wir können pro Monat leider nur eine Schule als Pilot-Partner aufnehmen — ` +
            `dieses Mal ist die Wahl auf eine andere Schule gefallen. Das ist keine Wertung ` +
            `eurer Schule!\n\n` +
            `Ihr könnt die DojoSoftware natürlich trotzdem jederzeit 14 Tage kostenlos testen — ` +
            `meldet euch gern bei uns.\n\n` +
            `Sportliche Grüße\nTDA International`,
          html: pilotHtml(
            `<p>Hallo <strong>${esc(b.ansprechpartner)}</strong>,</p>` +
            `<p>vielen Dank für euer Interesse am TDA Pilot-Partner-Programm und die Mühe, die ihr euch mit der Bewerbung für <strong>„${esc(b.schulname)}"</strong> gemacht habt.</p>` +
            `<p>Wir können pro Monat leider nur eine Schule als Pilot-Partner aufnehmen — dieses Mal ist die Wahl auf eine andere Schule gefallen. Das ist keine Wertung eurer Schule!</p>` +
            `<p>Ihr könnt die DojoSoftware natürlich trotzdem jederzeit <strong>14 Tage kostenlos testen</strong> — meldet euch gern bei uns.</p>` +
            `<p>Sportliche Grüße<br><strong>TDA International</strong></p>`
          ),
          replyTo: 'info@tda-intl.com'
        }).catch(err => console.error('[Pilot-Bewerbung] Abgelehnt-Mail-Fehler:', err.message));
      }
    }

    // Status → "gewonnen": Programm-Start setzen (falls leer) + Feedback-Umfragen planen
    if (status === 'gewonnen') {
      try {
        await pool.query(
          `UPDATE pilot_bewerbungen SET programm_start = COALESCE(programm_start, CURDATE()) WHERE id = ?`,
          [req.params.id]
        );
        const { planeUmfragen } = require('../services/pilotFeedbackService');
        const [[partner]] = await pool.query(
          'SELECT id, schulname, ansprechpartner, email, programm_start FROM pilot_bewerbungen WHERE id = ?',
          [req.params.id]
        );
        if (partner) await planeUmfragen(partner);
      } catch (err) {
        console.error('[Pilot-Bewerbung] Feedback-Planung Fehler:', err.message);
      }
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
