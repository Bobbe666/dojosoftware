// ============================================================================
// E-Mail-Archiv — legt JEDE ausgehende Mail als vollständige, zeitgestempelte
// Kopie ab (rechtssicher/nachvollziehbar). Zentral aufgerufen aus dem globalen
// nodemailer-Interzeptor (utils/globalMailCopy.js) für ALLE Versand-Wege.
// Kunden-Zuordnung best effort über Empfänger-Mail (dojo/admin/mitglied/user);
// nicht zuordenbare System-Mails werden mit dojo_id NULL gespeichert.
// Wirft NIE — Archiv darf den Mailversand nie stören.
// ============================================================================
const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');

// Empfänger-Mail → dojo_id (Kontakt-Mail des Dojos, Admin-User, Mitglied, User)
async function resolveDojoIdByEmail(email) {
  if (!email) return null;
  const pool = db.promise();
  const first = (String(email).split(',')[0] || '').trim().toLowerCase();
  if (!first) return null;
  try {
    const [d] = await pool.query('SELECT id FROM dojo WHERE LOWER(email) = ? LIMIT 1', [first]);
    if (d.length) return d[0].id;
    const [a] = await pool.query('SELECT dojo_id FROM admin_users WHERE LOWER(email) = ? AND dojo_id IS NOT NULL LIMIT 1', [first]);
    if (a.length) return a[0].dojo_id;
    const [m] = await pool.query('SELECT dojo_id FROM mitglieder WHERE LOWER(email) = ? AND dojo_id IS NOT NULL LIMIT 1', [first]);
    if (m.length) return m[0].dojo_id;
    const [u] = await pool.query('SELECT dojo_id FROM users WHERE LOWER(email) = ? AND dojo_id IS NOT NULL LIMIT 1', [first]);
    if (u.length) return u[0].dojo_id;
    return null;
  } catch (e) {
    return null;
  }
}

// Archiviert eine gesendete Mail vollständig + mit Integritäts-Hash.
async function archiveEmail({ dojoId, to, name, subject, html, text, typ, messageId, status = 'gesendet', from, cc, bcc } = {}) {
  try {
    let did = dojoId || null;
    if (!did) did = await resolveDojoIdByEmail(to);
    // did darf NULL bleiben → auch System-Mails werden archiviert.

    // Integritäts-Hash über die Kerninhalte (Tamper-Evidence)
    const inhaltHash = crypto.createHash('sha256')
      .update([from || '', to || '', cc || '', bcc || '', subject || '', html || '', text || '', messageId || ''].join(''))
      .digest('hex');

    const pool = db.promise();
    await pool.query(
      `INSERT INTO dojo_email_archive
         (dojo_id, absender, empfaenger_email, empfaenger_name, kopie_cc, kopie_bcc,
          betreff, html_inhalt, text_inhalt, versand_typ, message_id, inhalt_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        did, from || null, to || null, name || null, cc || null, bcc || null,
        (subject || '').slice(0, 500), html || null, text || null, typ || null,
        messageId || null, inhaltHash, status,
      ]
    );
  } catch (e) {
    if (logger && logger.warn) logger.warn('E-Mail-Archiv: Insert fehlgeschlagen', { error: e.message });
  }
}

module.exports = { archiveEmail, resolveDojoIdByEmail };
