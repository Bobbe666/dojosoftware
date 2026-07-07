// ============================================================================
// E-Mail-Archiv — legt jede an einen Dojo-Kunden versendete Mail als Kopie ab
// Wird aus sendEmail() / sendEmailForDojo() (fire-and-forget) aufgerufen.
// Auflösung des Kunden: explizite dojoId ODER Empfänger-Mail → dojo/admin_users
// ============================================================================
const db = require('../db');
const logger = require('../utils/logger');

// Empfänger-Mail → dojo_id (Kontakt-Mail des Dojos oder Admin-User des Dojos)
async function resolveDojoIdByEmail(email) {
  if (!email) return null;
  const pool = db.promise();
  try {
    const [d] = await pool.query('SELECT id FROM dojo WHERE email = ? LIMIT 1', [email]);
    if (d.length) return d[0].id;
    const [a] = await pool.query(
      'SELECT dojo_id FROM admin_users WHERE email = ? AND dojo_id IS NOT NULL LIMIT 1',
      [email]
    );
    return a.length ? a[0].dojo_id : null;
  } catch (e) {
    return null;
  }
}

// Archiviert eine gesendete Mail. Wirft NIE — darf den Mailversand nie stören.
async function archiveEmail({ dojoId, to, name, subject, html, text, typ, messageId, status = 'gesendet' } = {}) {
  try {
    let did = dojoId || null;
    if (!did) did = await resolveDojoIdByEmail(to);
    if (!did) return; // Kein Kunden-Dojo zuordenbar → nicht archivieren
    const pool = db.promise();
    await pool.query(
      `INSERT INTO dojo_email_archive
         (dojo_id, empfaenger_email, empfaenger_name, betreff, html_inhalt, text_inhalt, versand_typ, message_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [did, to || null, name || null, (subject || '').slice(0, 500), html || null, text || null, typ || null, messageId || null, status]
    );
  } catch (e) {
    if (logger && logger.warn) logger.warn('E-Mail-Archiv: Insert fehlgeschlagen', { error: e.message });
  }
}

module.exports = { archiveEmail, resolveDojoIdByEmail };
