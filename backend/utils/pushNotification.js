/**
 * pushNotification.js
 * Wiederverwendbarer Helper zum Senden von Web-Push-Notifications.
 */

const webpush = require('web-push');
const db = require('../db');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const pool = db.promise();

/**
 * Sendet eine Push-Notification an alle aktiven Subscriptions eines Mitglieds.
 * @param {number} mitgliedId  - mitglied_id aus der mitglieder-Tabelle
 * @param {string} title       - Titel der Notification
 * @param {string} body        - Text der Notification
 * @param {string} url         - URL beim Klick (default: '/member/dashboard')
 * @param {object} extra       - zusätzliche data-Felder (optional)
 */
async function sendPushToMitglied(mitgliedId, title, body, url = '/member/dashboard', extra = {}) {
  const [subs] = await pool.query(
    `SELECT ps.endpoint, ps.p256dh_key, ps.auth_key
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.mitglied_id = ? AND ps.is_active = TRUE`,
    [mitgliedId]
  );

  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title,
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: { url, ...extra },
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
        payload
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query('UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = ?', [sub.endpoint]);
      }
    }
  }
}

module.exports = { sendPushToMitglied };
