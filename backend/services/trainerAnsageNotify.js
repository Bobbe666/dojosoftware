// ============================================================================
// TRAINER-ANSAGE → ADMIN-BENACHRICHTIGUNG
// Wird ausgelöst, wenn ein TRAINER über die Schnell-Ansage eine Stunde
// ändert/verlegt/absagt. Informiert die Dojo-Admins über DREI Kanäle:
//   1. E-Mail (Brevo, sendEmailForDojo)            — zuverlässig
//   2. In-App-Benachrichtigung (notifications) + Web-Push (best effort)
//   3. Interne Chat-Nachricht (privater "Trainer-Meldungen"-Raum je Dojo)
// Jeder Kanal ist einzeln gekapselt: fällt einer aus, laufen die anderen.
// ============================================================================
const db = require('../db');
const logger = require('../utils/logger');
const { sendEmailForDojo } = require('./emailService');
const { renderEmail, getDojoMailTheme } = require('./emailLayout');

const pool = db.promise();

let webpush = null;
try {
  webpush = require('web-push');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } else {
    webpush = null;
  }
} catch (_) { webpush = null; }

// Admins, die für ein Dojo zuständig sind (inkl. Super-Admin als Inhaber).
async function getDojoAdmins(dojoId) {
  const [rows] = await pool.query(
    `SELECT id, email, vorname, nachname, rolle
       FROM admin_users
      WHERE aktiv = 1
        AND rolle IN ('admin','inhaber','dojo_admin','super_admin')
        AND (dojo_id = ? OR rolle = 'super_admin')`,
    [dojoId]
  );
  return rows;
}

// Find-or-create: privater Gruppen-Raum "🔔 Trainer-Meldungen" je Dojo.
async function ensureMeldungsRaum(dojoId, adminIds, trainer) {
  const RAUM_NAME = '🔔 Trainer-Meldungen';
  const [exist] = await pool.query(
    `SELECT id FROM chat_rooms WHERE dojo_id = ? AND type = 'group' AND name = ? LIMIT 1`,
    [dojoId, RAUM_NAME]
  );
  let roomId = exist[0]?.id;
  if (!roomId) {
    const [r] = await pool.query(
      `INSERT INTO chat_rooms (dojo_id, type, name, description, created_by_id, created_by_type)
       VALUES (?, 'group', ?, 'Automatische Meldungen, wenn Trainer Stunden ändern oder absagen.', ?, 'admin')`,
      [dojoId, RAUM_NAME, adminIds[0] || trainer.trainer_admin_id || null]
    );
    roomId = r.insertId;
  }
  // Mitglieder sicherstellen: alle Admins + der meldende Trainer
  const members = [];
  for (const aid of adminIds) members.push([roomId, aid, 'admin', 'member']);
  if (trainer.trainer_admin_id) members.push([roomId, trainer.trainer_admin_id, 'trainer', 'member']);
  if (members.length) {
    await pool.query(
      `INSERT IGNORE INTO chat_room_members (room_id, member_id, member_type, role) VALUES ?`,
      [members]
    );
  }
  return roomId;
}

/**
 * @param {object} o
 * @param {number} o.dojoId
 * @param {object} o.trainer   { name, trainer_admin_id }  (admin_users.id des Trainers)
 * @param {string} o.art       'ausfall' | 'zeit'
 * @param {string} o.datumLabel z.B. "heute, Dienstag 30. Juni"
 * @param {string} o.stundenText kurze Auflistung der betroffenen Stunden
 * @param {string} o.titel
 * @param {string} o.nachricht  der veröffentlichte Popup-Text
 * @param {object} o.io         socket.io-Instanz (optional)
 */
async function notifyAdminsTrainerAnsage({ dojoId, trainer, art, datumLabel, stundenText, titel, nachricht, io }) {
  const artLabel = art === 'ausfall' ? 'Stundenausfall' : 'Zeitänderung';
  const trainerName = trainer?.name || 'Ein Trainer';
  const betreff = `📣 ${artLabel} von ${trainerName}`;
  const result = { email: 0, notification: 0, push: 0, chat: false };

  let admins = [];
  try { admins = await getDojoAdmins(dojoId); } catch (e) {
    logger.warn('[trainerAnsage] Admins laden fehlgeschlagen', { error: e.message });
  }
  const adminIds = admins.map(a => a.id);

  // ── Kanal 1: E-Mail ───────────────────────────────────────────────────────
  try {
    const theme = await getDojoMailTheme({ dojoId });
    const bodyHtml = `
      <p style="font-size:16px;margin:0 0 14px;color:#1e293b;"><strong>${trainerName}</strong> hat soeben eine Trainings­änderung veröffentlicht:</p>
      <div class="box">
        <p><strong style="color:#1e293b;">Art:</strong> ${artLabel}</p>
        <p><strong style="color:#1e293b;">Wann:</strong> ${datumLabel}</p>
        ${stundenText ? `<p><strong style="color:#1e293b;">Betroffene Stunden:</strong> ${stundenText}</p>` : ''}
        <p><strong style="color:#1e293b;">Titel:</strong> ${titel}</p>
      </div>
      <p style="margin:14px 0 6px;"><strong style="color:#1e293b;">Veröffentlichter Text:</strong></p>
      <p style="margin:0 0 14px;white-space:pre-line;color:#334155;">${nachricht}</p>
      <p style="margin:14px 0 0;color:#64748b;font-size:13px;">Die Ansage erscheint automatisch als Popup in der App und auf der Homepage und läuft selbst wieder ab.</p>`;
    const html = renderEmail({ theme, anlass: 'info', titel: betreff, bodyHtml });
    const text = `${trainerName} hat eine Trainingsänderung veröffentlicht.\n\nArt: ${artLabel}\nWann: ${datumLabel}\n${stundenText ? `Stunden: ${stundenText}\n` : ''}Titel: ${titel}\n\n${nachricht}`;
    for (const a of admins) {
      if (!a.email) continue;
      try { await sendEmailForDojo({ to: a.email, subject: betreff, html, text }, dojoId); result.email++; }
      catch (e) { logger.warn('[trainerAnsage] Mail fehlgeschlagen', { to: a.email, error: e.message }); }
    }
  } catch (e) {
    logger.warn('[trainerAnsage] E-Mail-Kanal fehlgeschlagen', { error: e.message });
  }

  // ── Kanal 2: In-App-Benachrichtigung + Web-Push ──────────────────────────
  const kurzMsg = `${trainerName}: ${artLabel} (${datumLabel})${stundenText ? ` – ${stundenText}` : ''}`;
  try {
    const groupId = `trainer_ansage_${dojoId}`;
    for (const a of admins) {
      try {
        await pool.query(
          `INSERT INTO notifications (type, recipient, subject, message, status, dojo_id, notification_group_id, created_at)
           VALUES ('push', ?, ?, ?, 'sent', ?, ?, NOW())`,
          [a.email || `admin_${a.id}`, betreff, kurzMsg, dojoId, groupId]
        );
        result.notification++;
      } catch (e) { logger.warn('[trainerAnsage] notification insert fehlgeschlagen', { error: e.message }); }
    }
  } catch (e) {
    logger.warn('[trainerAnsage] Notification-Kanal fehlgeschlagen', { error: e.message });
  }

  if (webpush && adminIds.length) {
    try {
      const [subs] = await pool.query(
        `SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions
          WHERE is_active = 1 AND user_id IN (?)`,
        [adminIds]
      );
      const payload = JSON.stringify({ title: betreff, body: kurzMsg, url: '/dashboard' });
      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
            payload
          );
          result.push++;
        } catch (e) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            await pool.query('UPDATE push_subscriptions SET is_active = 0 WHERE endpoint = ?', [s.endpoint]).catch(() => {});
          }
        }
      }
    } catch (e) {
      logger.warn('[trainerAnsage] Push-Kanal fehlgeschlagen', { error: e.message });
    }
  }

  // ── Kanal 3: Interne Chat-Nachricht ──────────────────────────────────────
  try {
    if (adminIds.length) {
      const roomId = await ensureMeldungsRaum(dojoId, adminIds, trainer || {});
      const chatText = `📣 ${artLabel} – ${datumLabel}\n${stundenText ? `Stunden: ${stundenText}\n` : ''}„${nachricht}"`;
      const senderId = trainer?.trainer_admin_id || adminIds[0];
      const senderType = trainer?.trainer_admin_id ? 'trainer' : 'admin';
      const [ins] = await pool.query(
        `INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content)
         VALUES (?, ?, ?, 'text', ?)`,
        [roomId, senderId, senderType, chatText]
      );
      result.chat = true;
      if (io) {
        io.to(`chat:${roomId}`).emit('chat:message', {
          id: ins.insertId, room_id: roomId, sender_id: senderId, sender_type: senderType,
          message_type: 'text', content: chatText, sent_at: new Date(),
          sender_name: trainerName, reactions: []
        });
      }
    }
  } catch (e) {
    logger.warn('[trainerAnsage] Chat-Kanal fehlgeschlagen', { error: e.message });
  }

  logger.info('[trainerAnsage] Admins benachrichtigt', { dojoId, trainer: trainerName, ...result });
  return result;
}

module.exports = { notifyAdminsTrainerAnsage };
