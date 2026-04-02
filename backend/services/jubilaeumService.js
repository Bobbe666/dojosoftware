/**
 * Jubiläums-Service
 * Prüft täglich Mitgliedschaftsjubiläen (1, 2, 3, 5, 10, 15, 20 Jahre)
 * und sendet Benachrichtigungen an Admin/Trainer
 */
const db = require('../db');
const logger = require('../utils/logger');

const JUBILAEUMS_JAHRE = [1, 2, 3, 5, 10, 15, 20];

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, r) => (err ? reject(err) : resolve(r)))
  );

const getJubilaeenHeute = async () => {
  const jahresListe = JUBILAEUMS_JAHRE.join(',');
  return queryAsync(`
    SELECT
      m.mitglied_id, m.vorname, m.nachname, m.eintrittsdatum, m.email, m.dojo_id,
      d.dojoname,
      TIMESTAMPDIFF(YEAR, m.eintrittsdatum, CURDATE()) AS jahre
    FROM mitglieder m
    LEFT JOIN dojo d ON m.dojo_id = d.id
    WHERE m.aktiv = 1
      AND MONTH(m.eintrittsdatum) = MONTH(CURDATE())
      AND DAY(m.eintrittsdatum) = DAY(CURDATE())
      AND TIMESTAMPDIFF(YEAR, m.eintrittsdatum, CURDATE()) IN (${jahresListe})
  `);
};

const getDojoAdminEmail = async (dojoId) => {
  const rows = await queryAsync(
    `SELECT m.email, m.vorname, m.nachname
     FROM mitglieder m
     JOIN users u ON u.mitglied_id = m.mitglied_id
     WHERE m.dojo_id = ? AND u.role IN ('admin','Admin','super_admin') AND m.email IS NOT NULL
     LIMIT 1`,
    [dojoId]
  );
  return rows[0] || null;
};

const bereits_benachrichtigt = async (recipientKey) => {
  const rows = await queryAsync(
    `SELECT COUNT(*) as c FROM notifications
     WHERE recipient = ?
       AND JSON_EXTRACT(metadata,'$.notif_type') = 'jubilaeum'
       AND DATE(created_at) = CURDATE()`,
    [recipientKey]
  );
  return rows[0].c > 0;
};

const sendNotification = async (recipient, subject, message, metadata) =>
  queryAsync(
    `INSERT INTO notifications (type,recipient,subject,message,status,metadata,created_at)
     VALUES ('admin_alert',?,?,?,'unread',?,NOW())`,
    [recipient, subject, message, JSON.stringify(metadata)]
  );

const checkJubilaeen = async () => {
  try {
    const members = await getJubilaeenHeute();
    let sent = 0;
    for (const m of members) {
      const jahre = m.jahre;
      const suffix = jahre === 1 ? '1 Jahr' : `${jahre} Jahre`;
      // Admin benachrichtigen
      const admin = await getDojoAdminEmail(m.dojo_id);
      if (admin) {
        const key = `jubilaeum_admin_${m.dojo_id}_${m.mitglied_id}`;
        if (!(await bereits_benachrichtigt(key))) {
          await sendNotification(
            key,
            `🏆 ${suffix} Mitglied: ${m.vorname} ${m.nachname}`,
            `${m.vorname} ${m.nachname} ist heute seit ${suffix} Mitglied bei ${m.dojoname || 'eurem Dojo'}! Vielleicht ein guter Moment für ein persönliches Dankeschön.`,
            { notif_type: 'jubilaeum', mitglied_id: m.mitglied_id, jahre, dojo_id: m.dojo_id, icon: '🏆' }
          );
          sent++;
        }
      }
      // Mitglied selbst benachrichtigen
      if (m.email) {
        const mKey = `jubilaeum_mitglied_${m.mitglied_id}`;
        if (!(await bereits_benachrichtigt(mKey))) {
          await queryAsync(
            `INSERT INTO notifications (type,recipient,subject,message,status,metadata,created_at)
             VALUES ('push',?,?,?,'unread',?,NOW())`,
            [
              m.mitglied_id.toString(),
              `🏆 ${jahre === 1 ? '1 Jahr' : jahre + ' Jahre'} bei uns!`,
              `Herzlichen Glückwunsch zum ${suffix}-Jubiläum, ${m.vorname}! Wir freuen uns, dass du ein Teil von ${m.dojoname || 'unserem Dojo'} bist.`,
              JSON.stringify({ notif_type: 'jubilaeum', jahre, icon: '🏆' })
            ]
          );
          sent++;
        }
      }
    }
    logger.info(`✅ Jubiläums-Check: ${members.length} Jubiläen gefunden, ${sent} Benachrichtigungen gesendet`);
    return { success: true, jubilaeen: members.length, sent };
  } catch (err) {
    logger.error('❌ Jubiläums-Check Fehler:', err);
    return { success: false, error: err.message };
  }
};

module.exports = { checkJubilaeen };
