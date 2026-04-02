/**
 * Birthday Service
 * Prueft taeglich auf Geburtstage und sendet Push-Benachrichtigungen
 */

const db = require('../db');

// Promise-Wrapper fuer db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

/**
 * Findet alle Mitglieder die heute Geburtstag haben
 */
const getBirthdaysToday = async () => {
  const sql = `
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.geburtsdatum,
      m.email,
      m.dojo_id,
      d.dojoname,
      YEAR(CURDATE()) - YEAR(m.geburtsdatum) as alter_neu
    FROM mitglieder m
    LEFT JOIN dojo d ON m.dojo_id = d.id
    WHERE
      MONTH(m.geburtsdatum) = MONTH(CURDATE())
      AND DAY(m.geburtsdatum) = DAY(CURDATE())
      AND m.aktiv = 1
  `;
  return queryAsync(sql);
};

/**
 * Findet den Admin eines Dojos
 */
const getDojoAdmin = async (dojoId) => {
  const sql = `
    SELECT u.id, u.username, u.email
    FROM users u
    LEFT JOIN mitglieder m ON u.mitglied_id = m.mitglied_id
    WHERE m.dojo_id = ? AND u.role IN ('admin', 'Admin', 'super_admin')
    LIMIT 1
  `;
  const results = await queryAsync(sql, [dojoId]);
  return results[0] || null;
};

/**
 * Erstellt eine Push-Benachrichtigung
 */
const createNotification = async (type, recipient, subject, message, metadata = {}) => {
  const sql = `
    INSERT INTO notifications (type, recipient, subject, message, status, metadata, created_at)
    VALUES (?, ?, ?, ?, 'unread', ?, NOW())
  `;
  return queryAsync(sql, [type, recipient, subject, message, JSON.stringify(metadata)]);
};

/**
 * Prueft ob bereits eine Geburtstags-Benachrichtigung heute gesendet wurde
 */
const hasNotificationToday = async (recipientId, notificationType) => {
  const sql = `
    SELECT COUNT(*) as count FROM notifications
    WHERE recipient = ?
    AND JSON_EXTRACT(metadata, '$.type') = 'birthday'
    AND DATE(created_at) = CURDATE()
  `;
  const results = await queryAsync(sql, [recipientId.toString()]);
  return results[0].count > 0;
};

/**
 * Hauptfunktion: Prueft Geburtstage und sendet Benachrichtigungen
 */
const checkBirthdays = async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Birthday-Check gestartet...`);

  try {
    const birthdays = await getBirthdaysToday();
    console.log(`[${timestamp}] ${birthdays.length} Geburtstag(e) heute gefunden`);

    let notificationsSent = 0;

    for (const member of birthdays) {
      try {
        // 1. Benachrichtigung an das Geburtstagskind (falls Email vorhanden)
        if (member.email) {
          const alreadyNotifiedMember = await hasNotificationToday(member.mitglied_id, 'member');

          if (!alreadyNotifiedMember) {
            await createNotification(
              'push',
              member.mitglied_id.toString(),
              'Herzlichen Glueckwunsch zum Geburtstag!',
              `Liebe(r) ${member.vorname}, das gesamte Team von ${member.dojoname || 'deinem Dojo'} wuenscht dir alles Gute zum ${member.alter_neu}. Geburtstag!`,
              { type: 'birthday', mitglied_id: member.mitglied_id, role: 'member' }
            );
            notificationsSent++;
            console.log(`[${timestamp}] Geburtstagswunsch an ${member.vorname} ${member.nachname} gesendet`);
          }
        }

        // 2. Benachrichtigung an den Dojo-Admin
        if (member.dojo_id) {
          const admin = await getDojoAdmin(member.dojo_id);

          if (admin) {
            const recipientKey = `admin_${admin.id}_${member.mitglied_id}`;
            const alreadyNotifiedAdmin = await hasNotificationToday(recipientKey, 'admin');

            if (!alreadyNotifiedAdmin) {
              await createNotification(
                'admin_alert',
                `admin_${admin.id}`,
                `Geburtstag: ${member.vorname} ${member.nachname}`,
                `Heute hat ${member.vorname} ${member.nachname} Geburtstag und wird ${member.alter_neu} Jahre alt.`,
                { type: 'birthday', mitglied_id: member.mitglied_id, admin_id: admin.id, role: 'admin' }
              );
              notificationsSent++;
              console.log(`[${timestamp}] Admin-Benachrichtigung fuer ${member.vorname} ${member.nachname} gesendet`);
            }
          }
        }
      } catch (memberError) {
        console.error(`[${timestamp}] Fehler bei Mitglied ${member.mitglied_id}:`, memberError.message);
      }
    }

    console.log(`[${timestamp}] Geburtstags-Check abgeschlossen. ${notificationsSent} Benachrichtigung(en) erstellt.`);
    return { success: true, birthdays: birthdays.length, notifications: notificationsSent };

  } catch (error) {
    console.error(`[${timestamp}] Geburtstags-Check Fehler:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  checkBirthdays,
  getBirthdaysToday
};
