// ============================================================================
// MONATS-VORSCHAU für Steffi 💕
// Liebevolle Monatsübersicht: welche Events/Turniere/HOF-Veranstaltungen/
// Prüfungen im KOMMENDEN Monat anstehen — aggregiert über den Gesamtkalender
// (collectKalenderEintraege: TDA Events + HOF + Dojo). Mit wechselndem
// Liebesspruch + Herz. Versand 1 Woche vor Monatsende (Cron) an schreinersteffi94@web.de.
// ============================================================================
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { collectKalenderEintraege, toLocalDate } = require('./kalenderAggregation');

const STEFFI_EMAIL = 'schreinersteffi94@web.de';
const GEB_DOJO_ID = 3; // Kampfkunstschule Schreiner

// Aktive Mitglieder mit Geburtstag im angegebenen Monat (1-12).
async function geburtstageImMonat(monatNum) {
  try {
    const dbm = require('../db').promise();
    const [rows] = await dbm.query(
      `SELECT vorname, nachname, geburtsdatum, DAY(geburtsdatum) AS tag
       FROM mitglieder
       WHERE dojo_id = ? AND geburtsdatum IS NOT NULL AND MONTH(geburtsdatum) = ?
         AND aktiv = 1 AND gekuendigt = 0
       ORDER BY DAY(geburtsdatum), nachname`,
      [GEB_DOJO_ID, monatNum]
    );
    return rows;
  } catch (e) {
    logger.error?.('[monatsVorschau] Geburtstage:', e.message);
    return [];
  }
}

// Wechselnde Liebessprüche — einer pro Monat (rotiert).
const LIEBESSPRUECHE = [
  'Mit dir ist jeder Tag ein kleines Abenteuer – ich liebe dich. 💛',
  'Du bist mein Lieblingsmensch, heute und für immer. ❤️',
  'Egal wie voll der Kalender ist – für dich ist immer Platz in meinem Herzen. 💕',
  'Danke, dass du an meiner Seite kämpfst und träumst. Ich liebe dich. 🥋❤️',
  'Du machst aus jedem gewöhnlichen Moment etwas Besonderes. 😘',
  'Mit dir an meiner Seite schaffe ich alles. Ich liebe dich. 💪💛',
  'Du bist mein Ruhepunkt in jedem Trubel. Hab dich lieb. 🌹',
  'Jeder Tag mit dir fühlt sich an wie ein Geschenk. ❤️',
  'Du bist das Beste, was mir je passiert ist. 💋',
  'Gemeinsam stark – im Dojo und im Leben. Ich liebe dich. 🐉❤️',
  'Mein Herz schlägt für dich, heute und jeden Tag. 💗',
  'Mit dir möchte ich jeden Monat und jedes Jahr verbringen. 😘',
  'Du bist mein Zuhause, ganz egal wo wir sind. 🏡❤️',
  'Danke, dass du immer für uns alle da bist. Ich liebe dich so sehr. 💞',
  'Du bist meine Kraft, mein Lächeln, meine Liebe. 💛',
  'Für dich würde ich jeden Berg besteigen – auch den Fuji. 🗻❤️',
];

function spruchFuer(ref = new Date()) {
  const idx = (ref.getFullYear() * 12 + ref.getMonth()) % LIEBESSPRUECHE.length;
  return LIEBESSPRUECHE[idx];
}

// Zeitraum des KOMMENDEN Monats (relativ zu ref).
function naechsterMonatRange(ref = new Date()) {
  const y = ref.getFullYear(), m = ref.getMonth();
  const vonD = new Date(y, m + 1, 1);
  const bisD = new Date(y, m + 2, 0); // Tag 0 des übernächsten = letzter Tag nächster Monat
  return {
    von: toLocalDate(vonD),
    bis: toLocalDate(bisD),
    monatName: vonD.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
  };
}

const TYP_LABEL = { turnier: '🏆 Turnier', event: '📅 Event', hof: '⭐ Hall of Fame', pruefung: '🥋 Gürtelprüfung', demo: '👋 Probetraining' };

function fmtDatum(d) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }); }
  catch { return d; }
}

// Baut Betreff + HTML der Monats-Vorschau.
async function buildMonatsVorschau(ref = new Date()) {
  const { von, bis, monatName } = naechsterMonatRange(ref);
  const [jahr, monatNum] = von.split('-').map(Number); // Jahr + Monat (1-12) des kommenden Monats
  let events = [];
  try { ({ events } = await collectKalenderEintraege(von, bis)); } catch (e) { logger.error?.('[monatsVorschau] Kalender:', e.message); }

  let geburtstage = [];
  try { geburtstage = await geburtstageImMonat(monatNum); } catch (e) { logger.error?.('[monatsVorschau] Geb:', e.message); }

  const spruch = spruchFuer(ref);
  const C = { rose: '#e11d48', soft: '#fb7185', bg: '#fff5f7', card: '#ffffff', text: '#3f3f46', muted: '#71717a', gold: '#d4a017' };

  const eventRows = events.length
    ? events.map(e => {
        const label = TYP_LABEL[e.typ] || '📌';
        const ort = e.ort ? ` · ${e.ort}` : '';
        const zeit = e.uhrzeit ? ` um ${e.uhrzeit}` : '';
        return `<tr>
          <td style="padding:12px 14px;border-bottom:1px solid #fde4ea;vertical-align:top;width:130px;">
            <div style="font-weight:bold;color:${C.rose};font-size:13px;">${fmtDatum(e.datum)}${zeit}</div>
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #fde4ea;">
            <div style="font-size:11px;letter-spacing:.04em;color:${C.muted};">${label}</div>
            <div style="font-weight:600;color:${C.text};font-size:15px;">${e.titel || '—'}${ort}</div>
          </td></tr>`;
      }).join('')
    : `<tr><td style="padding:18px;color:${C.muted};text-align:center;">Für ${monatName} steht aktuell noch nichts im Kalender — Zeit für uns zwei. 😘</td></tr>`;

  const gebRows = geburtstage.length
    ? geburtstage.map(g => {
        const datum = new Date(jahr, monatNum - 1, g.tag)
          .toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
        const gebJahr = g.geburtsdatum ? new Date(g.geburtsdatum).getFullYear() : null;
        const alter = gebJahr ? (jahr - gebJahr) : null;
        return `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #fde4ea;vertical-align:top;width:130px;">
            <div style="font-weight:bold;color:${C.rose};font-size:13px;">${datum}</div>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #fde4ea;">
            <div style="font-weight:600;color:${C.text};font-size:15px;">🎂 ${g.vorname || ''} ${g.nachname || ''}</div>
            ${alter ? `<div style="font-size:12px;color:${C.muted};">wird ${alter} Jahre</div>` : ''}
          </td></tr>`;
      }).join('')
    : `<tr><td style="padding:16px;color:${C.muted};text-align:center;">Im ${monatName} hat niemand Geburtstag.</td></tr>`;

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Monats-Vorschau ${monatName}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.bg}"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="${C.card}" style="width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(225,29,72,.12);">
    <tr><td align="center" style="background:linear-gradient(135deg,${C.rose},${C.soft});padding:30px 32px;font-family:Georgia,serif;">
      <div style="font-size:34px;line-height:1;">💕</div>
      <div style="font-size:24px;color:#fff;font-weight:bold;margin-top:8px;">Für dich, meine Liebste</div>
      <div style="font-size:14px;color:rgba(255,255,255,.9);margin-top:4px;">Was uns im ${monatName} erwartet</div>
    </td></tr>
    <tr><td style="padding:24px 32px 8px;font-family:Georgia,serif;">
      <table role="presentation" width="100%" style="background:${C.bg};border-radius:12px;"><tr><td style="padding:18px 22px;text-align:center;">
        <div style="font-size:16px;font-style:italic;color:${C.rose};line-height:1.6;">„${spruch}"</div>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:14px 32px 4px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:${C.gold};font-weight:bold;">Termine im ${monatName}</div>
    </td></tr>
    <tr><td style="padding:6px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${eventRows}</table>
    </td></tr>
    <tr><td style="padding:14px 32px 4px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:${C.gold};font-weight:bold;">🎂 Geburtstage im ${monatName}</div>
    </td></tr>
    <tr><td style="padding:6px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${gebRows}</table>
    </td></tr>
    <tr><td align="center" style="padding:20px 32px 30px;font-family:Georgia,serif;">
      <div style="font-size:15px;color:${C.text};">In Liebe,<br>dein Sascha 😘❤️</div>
      <div style="font-size:22px;margin-top:10px;">❤️ 💋 ❤️</div>
    </td></tr>
  </table>
  <div style="font-family:Arial,sans-serif;font-size:11px;color:#a1a1aa;margin-top:12px;">Automatische Monats-Vorschau · mit Liebe erstellt</div>
</td></tr></table>
</body></html>`;

  return { subject: `💕 Unsere Vorschau für ${monatName}`, html, anzahl: events.length, monatName };
}

// Versand (Brevo direkt aus .env — zuverlässig). to-Override für Test.
async function sendMonatsVorschau({ to = STEFFI_EMAIL } = {}) {
  const { subject, html, anzahl, monatName } = await buildMonatsVorschau();
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'info@tda-intl.com';
  const info = await t.sendMail({ from: `"Sascha ❤️" <${from}>`, to, subject, html });
  logger.info?.('[monatsVorschau] gesendet', { to, monatName, anzahl, messageId: info.messageId });
  return { success: true, to, monatName, anzahl, response: info.response };
}

// Versandtag = genau 1 Woche vor Monatsende (letzter Tag − 7).
function istVersandTagMonatsvorschau(ref = new Date()) {
  const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return ref.getDate() === (lastDay - 7);
}

// ── „Neu im Kalender" — täglicher Check auf neu hinzugekommene Termine ──────
const db = require('../db');

async function ensureSeenTable() {
  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS steffi_kalender_seen (
      event_key VARCHAR(120) PRIMARY KEY,
      gesehen_am DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});
}

function buildNeueEventsMail(neue, ref = new Date()) {
  const C = { rose: '#e11d48', soft: '#fb7185', bg: '#fff5f7', text: '#3f3f46', muted: '#71717a' };
  const rows = neue.map(e => {
    const label = (TYP_LABEL[e.typ] || '📌');
    const ort = e.ort ? ` · ${e.ort}` : '';
    return `<tr><td style="padding:10px 14px;border-bottom:1px solid #fde4ea;">
      <div style="font-size:11px;color:${C.muted};">${label} · ${fmtDatum(e.datum)}</div>
      <div style="font-weight:600;color:${C.text};font-size:15px;">${e.titel || '—'}${ort}</div></td></tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.bg}"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:600px;max-width:600px;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(225,29,72,.12);">
    <tr><td align="center" style="background:linear-gradient(135deg,${C.rose},${C.soft});padding:26px 32px;font-family:Georgia,serif;">
      <div style="font-size:30px;">💕</div>
      <div style="font-size:22px;color:#fff;font-weight:bold;margin-top:6px;">Neu in unserem Kalender</div>
    </td></tr>
    <tr><td style="padding:22px 28px 6px;font-family:Arial,Helvetica,sans-serif;">
      <p style="color:${C.text};margin:0 0 12px;">Hallo mein Schatz, es ist etwas Neues dazugekommen:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </td></tr>
    <tr><td align="center" style="padding:18px 32px 28px;font-family:Georgia,serif;">
      <div style="font-style:italic;color:${C.rose};margin-bottom:8px;">„${spruchFuer(ref)}"</div>
      <div style="font-size:15px;color:${C.text};">In Liebe, dein Sascha 😘</div>
      <div style="font-size:20px;margin-top:8px;">❤️ 💋</div>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  return { subject: `💕 Neu im Kalender (${neue.length})`, html };
}

// Vergleicht aktuelle Termine (heute … Ende kommender Monat) mit gesehenen IDs,
// schickt bei Neuzugängen eine kurze „Neu im Kalender"-Mail. Erster Lauf: nur merken.
async function pruefeUndSendeNeueEvents({ to = STEFFI_EMAIL } = {}) {
  await ensureSeenTable();
  const heute = new Date();
  const von = toLocalDate(heute);
  const bis = toLocalDate(new Date(heute.getFullYear(), heute.getMonth() + 2, 0));
  let events = [];
  try { ({ events } = await collectKalenderEintraege(von, bis)); } catch { return { neu: 0, fehler: true }; }

  const [seenRows] = await db.promise().query('SELECT event_key FROM steffi_kalender_seen');
  const seen = new Set(seenRows.map(r => r.event_key));
  const ersterLauf = seen.size === 0;
  const neue = events.filter(e => e.id && !seen.has(e.id));

  for (const e of neue) {
    await db.promise().query('INSERT IGNORE INTO steffi_kalender_seen (event_key) VALUES (?)', [e.id]).catch(() => {});
  }

  if (neue.length && !ersterLauf) {
    const { subject, html } = buildNeueEventsMail(neue, heute);
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, tls: { rejectUnauthorized: false },
    });
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'info@tda-intl.com';
    await t.sendMail({ from: `"Sascha ❤️" <${from}>`, to, subject, html });
    logger.info?.('[monatsVorschau] Neu-Mail gesendet', { to, neu: neue.length });
  }
  return { neu: ersterLauf ? 0 : neue.length, ersterLauf, geprueft: events.length };
}

module.exports = { buildMonatsVorschau, sendMonatsVorschau, naechsterMonatRange, spruchFuer, istVersandTagMonatsvorschau, pruefeUndSendeNeueEvents, STEFFI_EMAIL };
