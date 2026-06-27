// ============================================================================
// vertretungNotify.js — E-Mail-Benachrichtigungen für Vertretungs-Anfragen (Coach-App)
//   1. Neue Anfrage → E-Mail an alle (anderen) Trainer des Dojos
//   2. Übernahme    → E-Mail an den anfragenden Trainer + die Admins
// Versand über sendEmailForDojo (Brevo, White-Label pro Dojo).
// ============================================================================
const db = require('../db');
const logger = require('../utils/logger');
const { sendEmailForDojo } = require('./emailService');

const COACH_URL = process.env.COACH_APP_URL || 'https://coach.tda-intl.org';
const pool = db.promise();

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function stundeLabel(a) {
  const parts = [];
  if (a.kurs_name) parts.push(a.kurs_name);
  if (a.datum) parts.push(new Date(a.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }));
  if (a.zeit) parts.push(a.zeit);
  return parts.join(' · ') || 'Stunde';
}

async function getDojoTrainers(dojoId, exkludiereAdminId) {
  const [rows] = await pool.query(
    `SELECT id, email, vorname, nachname FROM admin_users
      WHERE dojo_id = ? AND rolle = 'trainer' AND aktiv = 1 AND email IS NOT NULL AND email <> ?
        AND id <> ?`,
    [dojoId, '', exkludiereAdminId || 0]
  );
  return rows;
}

async function getDojoAdmins(dojoId) {
  const [rows] = await pool.query(
    `SELECT id, email, vorname, nachname FROM admin_users
      WHERE dojo_id = ? AND rolle IN ('admin','super_admin') AND aktiv = 1 AND email IS NOT NULL AND email <> ''`,
    [dojoId]
  );
  return rows;
}

// Neue Anfrage → alle anderen Trainer
async function notifyTrainersNeueAnfrage({ dojoId, anfrage }) {
  const result = { email: 0 };
  let trainers = [];
  try { trainers = await getDojoTrainers(dojoId, anfrage.anfrage_admin_id); }
  catch (e) { logger.warn('[vertretung] Trainer laden fehlgeschlagen', { error: e.message }); return result; }

  const label = stundeLabel(anfrage);
  const betreff = `🆘 Vertretung gesucht: ${anfrage.anfrage_name}`;
  const html =
    `<p style="font-size:16px;margin:0 0 14px;color:#1e293b;"><strong>${esc(anfrage.anfrage_name)}</strong> sucht eine Vertretung:</p>` +
    `<div style="background:#f8fafc;border-left:4px solid #DAA520;border-radius:0 6px 6px 0;padding:12px 16px;margin:0 0 16px;">` +
    `<p style="margin:0;font-size:15px;color:#0f172a;"><strong>${esc(label)}</strong></p>` +
    (anfrage.notiz ? `<p style="margin:8px 0 0;font-size:14px;color:#475569;">${esc(anfrage.notiz)}</p>` : '') +
    `</div>` +
    `<p style="margin:0 0 16px;font-size:14px;color:#475569;">Kannst du übernehmen? Öffne die Coach-App und tippe auf „Ich übernehme" — wer zuerst zusagt, bekommt die Vertretung.</p>` +
    `<p style="margin:0;"><a href="${COACH_URL}" style="display:inline-block;padding:11px 22px;background:#DAA520;color:#0f172a;border-radius:8px;text-decoration:none;font-weight:bold;">Coach-App öffnen</a></p>`;
  const text =
    `${anfrage.anfrage_name} sucht eine Vertretung:\n${label}\n` +
    (anfrage.notiz ? `Notiz: ${anfrage.notiz}\n` : '') +
    `\nKannst du übernehmen? Öffne die Coach-App: ${COACH_URL}\n(Wer zuerst zusagt, bekommt die Vertretung.)`;

  for (const t of trainers) {
    try { await sendEmailForDojo({ to: t.email, subject: betreff, html, text }, dojoId); result.email++; }
    catch (e) { logger.warn('[vertretung] Trainer-Mail fehlgeschlagen', { to: t.email, error: e.message }); }
  }
  logger.info('[vertretung] Neue Anfrage benachrichtigt', { dojoId, trainer: result.email });
  return result;
}

// Übernahme → anfragender Trainer + Admins
async function notifyUebernahme({ dojoId, anfrage, uebernehmerName, anfrageEmail }) {
  const result = { email: 0 };
  const label = stundeLabel(anfrage);
  const betreff = `✅ Vertretung übernommen: ${label}`;
  const html =
    `<p style="font-size:16px;margin:0 0 14px;color:#1e293b;"><strong>${esc(uebernehmerName)}</strong> übernimmt die Vertretung:</p>` +
    `<div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 6px 6px 0;padding:12px 16px;margin:0 0 16px;">` +
    `<p style="margin:0;font-size:15px;color:#0f172a;"><strong>${esc(label)}</strong></p>` +
    `<p style="margin:8px 0 0;font-size:14px;color:#475569;">Ursprünglich von: ${esc(anfrage.anfrage_name)}</p>` +
    `</div>`;
  const text = `${uebernehmerName} übernimmt die Vertretung: ${label}\nUrsprünglich von: ${anfrage.anfrage_name}`;

  const empfaenger = [];
  if (anfrageEmail) empfaenger.push(anfrageEmail);
  try { (await getDojoAdmins(dojoId)).forEach(a => empfaenger.push(a.email)); }
  catch (e) { logger.warn('[vertretung] Admins laden fehlgeschlagen', { error: e.message }); }

  for (const to of [...new Set(empfaenger)]) {
    try { await sendEmailForDojo({ to, subject: betreff, html, text }, dojoId); result.email++; }
    catch (e) { logger.warn('[vertretung] Übernahme-Mail fehlgeschlagen', { to, error: e.message }); }
  }
  return result;
}

module.exports = { notifyTrainersNeueAnfrage, notifyUebernahme };
