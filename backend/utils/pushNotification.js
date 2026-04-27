/**
 * pushNotification.js
 * Wiederverwendbarer Helper zum Senden von Web-Push-Notifications.
 *
 * WICHTIG: push_subscriptions.user_id speichert die mitglied_id (nicht users.id),
 * weil beim Registrieren req.user.mitglied_id bevorzugt wird.
 */

const webpush = require('web-push');
const db = require('../db');
const logger = require('./logger');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const pool = db.promise();

async function _sendToSubs(subs, payload) {
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
        payload
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query('UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = ?', [sub.endpoint]);
      } else {
        logger.warn('Push-Fehler', { status: err.statusCode, msg: err.message });
      }
    }
  }
  return sent;
}

/**
 * Sendet eine Push-Notification an alle aktiven Subscriptions eines Mitglieds.
 * @param {number} mitgliedId  - mitglied_id aus der mitglieder-Tabelle
 */
async function sendPushToMitglied(mitgliedId, title, body, url = '/member/dashboard', extra = {}) {
  // ps.user_id = mitglied_id (direkt, kein users-Join nötig)
  const [subs] = await pool.query(
    `SELECT endpoint, p256dh_key, auth_key
     FROM push_subscriptions
     WHERE user_id = ? AND is_active = TRUE`,
    [mitgliedId]
  );

  if (subs.length === 0) return 0;

  const payload = JSON.stringify({
    title, body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: { url, ...extra },
  });

  return _sendToSubs(subs, payload);
}

/**
 * Sendet eine Push-Notification an alle Mitglieder eines Dojos.
 * @param {number|null} dojoId  - dojo_id; null = alle Dojos (plattformweit)
 */
async function sendPushToAllMitgliederOfDojo(dojoId, title, body, url = '/member/dashboard', extra = {}) {
  let subs;

  if (dojoId) {
    // ps.user_id = mitglied_id → direkt auf mitglieder joinen
    [subs] = await pool.query(
      `SELECT ps.endpoint, ps.p256dh_key, ps.auth_key
       FROM push_subscriptions ps
       INNER JOIN mitglieder m ON m.mitglied_id = ps.user_id
       WHERE m.dojo_id = ? AND ps.is_active = TRUE`,
      [dojoId]
    );
  } else {
    // Plattformweit: alle Mitglieder-Subscriptions (nicht Admin-Accounts)
    [subs] = await pool.query(
      `SELECT ps.endpoint, ps.p256dh_key, ps.auth_key
       FROM push_subscriptions ps
       INNER JOIN mitglieder m ON m.mitglied_id = ps.user_id
       WHERE ps.is_active = TRUE`
    );
  }

  logger.info('sendPushToAllMitgliederOfDojo', { dojoId, subsFound: subs?.length ?? 0, title });

  if (!subs || subs.length === 0) return 0;

  const payload = JSON.stringify({
    title, body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: { url, ...extra },
  });

  const sent = await _sendToSubs(subs, payload);
  logger.info('Push gesendet', { dojoId, sent, total: subs.length });
  return sent;
}

module.exports = { sendPushToMitglied, sendPushToAllMitgliederOfDojo };
