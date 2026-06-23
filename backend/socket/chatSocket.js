// =====================================================================================
// SOCKET.IO CHAT HANDLER - Dojosoftware
// =====================================================================================
// Echtzeit-Chat: Nachrichten, Reaktionen, Gelesen-Status
// Web-Push für offline Empfänger

const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const db = require('../db');
const pool = db.promise(); // Promise-basierte API von mysql2
const logger = require('../utils/logger');

// VAPID konfigurieren
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function getSenderInfoFromUser(user) {
  const role = user.role;
  let sender_id, sender_type;
  if (role === 'member') {
    sender_id = user.mitglied_id;
    sender_type = 'mitglied';
  } else if (role === 'trainer') {
    sender_id = user.user_id || user.admin_id || user.id;
    sender_type = 'trainer';
  } else {
    sender_id = user.user_id || user.admin_id || user.id;
    sender_type = 'admin';
  }
  return { sender_id, sender_type };
}

async function getSenderName(sender_id, sender_type) {
  try {
    if (sender_type === 'mitglied') {
      const [rows] = await pool.query(
        'SELECT vorname, nachname FROM mitglieder WHERE mitglied_id = ?',
        [sender_id]
      );
      if (rows[0]) return `${rows[0].vorname} ${rows[0].nachname}`.trim();
    } else {
      // 🔒 Admins/Trainer sind in admin_users, NICHT in users — daher zuerst dort suchen.
      // Sonst trifft sender_id zufällig eine andere User-ID → falscher Name in Notifications.
      const [adminRows] = await pool.query(
        'SELECT vorname, nachname, username FROM admin_users WHERE id = ?',
        [sender_id]
      );
      if (adminRows[0]) {
        const { vorname, nachname, username } = adminRows[0];
        return `${vorname || ''} ${nachname || ''}`.trim() || username;
      }
      const [userRows] = await pool.query(
        'SELECT username FROM users WHERE id = ?',
        [sender_id]
      );
      if (userRows[0]) return userRows[0].username;
    }
  } catch (e) {
    logger.error('getSenderName Socket Fehler', { error: e.message });
  }
  return 'Unbekannt';
}

// ─── Offline Web-Push senden ─────────────────────────────────────────────────

/**
 * Sendet Web-Push an alle Raum-Mitglieder, die NICHT via Socket.io verbunden sind.
 * Wird auch aus chat.js REST-Fallback aufgerufen.
 */
async function triggerOfflinePush(io, room_id, message, sender_id, sender_type) {
  try {
    const [members] = await pool.query(
      `SELECT crm.member_id, crm.member_type
       FROM chat_room_members crm
       WHERE crm.room_id = ?
         AND NOT (crm.member_id = ? AND crm.member_type = ?)
         AND crm.muted = FALSE
         AND (crm.archived = 0 OR crm.archived IS NULL)`,
      [room_id, sender_id, sender_type]
    );
    if (!members.length) return;

    // Online-Status aller Mitglieder parallel prüfen
    const onlineFlags = await Promise.all(
      members.map(m =>
        io.in(`user:${m.member_id}:${m.member_type}`).fetchSockets().then(s => s.length > 0)
      )
    );
    const offlineMembers = members.filter((_, i) => !onlineFlags[i]);
    if (!offlineMembers.length) return;

    const offlineIds = [...new Set(offlineMembers.map(m => m.member_id))];

    // Subscriptions + Unread-Counts in je einer Batch-Query parallel holen
    const [[allSubs], [unreadRows]] = await Promise.all([
      pool.query(
        `SELECT user_id, endpoint, p256dh_key, auth_key
         FROM push_subscriptions
         WHERE user_id IN (?) AND is_active = TRUE`,
        [offlineIds]
      ),
      pool.query(
        `SELECT crm2.member_id, crm2.member_type, COUNT(*) as cnt
         FROM chat_messages cm
         JOIN chat_room_members crm2 ON crm2.room_id = cm.room_id
           AND crm2.member_id IN (?)
         WHERE cm.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM chat_message_reads cmr
             WHERE cmr.message_id = cm.id
               AND cmr.member_id = crm2.member_id
               AND cmr.member_type = crm2.member_type
           )
         GROUP BY crm2.member_id, crm2.member_type`,
        [offlineIds]
      ).catch(() => [[]])
    ]);

    // In Maps umwandeln für O(1)-Zugriff
    const subsByUser = {};
    for (const sub of allSubs) {
      if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = [];
      subsByUser[sub.user_id].push(sub);
    }
    const unreadMap = {};
    for (const row of unreadRows) {
      unreadMap[`${row.member_id}:${row.member_type}`] = row.cnt || 1;
    }

    // Alle Push-Sends parallel ausführen
    const expiredEndpoints = [];
    await Promise.all(
      offlineMembers.flatMap(member => {
        const subs = subsByUser[member.member_id] || [];
        if (!subs.length) return [];
        const unreadCount = unreadMap[`${member.member_id}:${member.member_type}`] || 1;
        const bodyText = typeof message.content === 'string' ? message.content : '';
        // Empfänger Mitglied → Mitglieder-Chat, sonst (Trainer/Admin) → Dashboard-Chat
        const targetUrl = member.member_type === 'mitglied'
          ? `/member/chat?room=${room_id}`
          : `/dashboard/chat?room=${room_id}`;
        const payload = JSON.stringify({
          title: message.sender_name || 'Neue Nachricht',
          body: bodyText.length > 80 ? bodyText.substring(0, 80) + '…' : (bodyText || 'Neue Nachricht'),
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: `chat-room-${room_id}`,
          requireInteraction: false,
          unreadCount,
          data: { url: targetUrl, room_id }
        });
        return subs.map(sub =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
            payload
          ).catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) expiredEndpoints.push(sub.endpoint);
            else logger.warn('Push-Senden fehlgeschlagen', { error: err.message });
          })
        );
      })
    );

    // Abgelaufene Subscriptions in einer Batch-Query deaktivieren
    if (expiredEndpoints.length) {
      await pool.query(
        `UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint IN (?)`,
        [expiredEndpoints]
      );
      logger.info(`${expiredEndpoints.length} Push-Subscriptions deaktiviert`);
    }
  } catch (error) {
    logger.error('triggerOfflinePush Fehler', { error: error.message });
  }
}

// ─── Socket.io Handler ────────────────────────────────────────────────────────

module.exports = function initChatSocket(io) {

  // JWT-Authentifizierung für alle Socket-Verbindungen
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers.authorization || '').replace('Bearer ', '');

      if (!token) return next(new Error('Kein Token'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      logger.warn('Socket.io Auth fehlgeschlagen', { error: err.message });
      next(new Error('Token ungültig'));
    }
  });

  io.on('connection', (socket) => {
    const { sender_id, sender_type } = getSenderInfoFromUser(socket.user);
    const dojo_id = socket.user.dojo_id;

    logger.info('Socket.io Chat verbunden', { sender_id, sender_type, dojo_id });

    // Dojo-weiter Room (für Ankündigungen und Broadcasts)
    socket.join(`dojo:${dojo_id}`);
    // Persönlicher Room (für DM-Benachrichtigungen)
    socket.join(`user:${sender_id}:${sender_type}`);

    // ── Raum beitreten ────────────────────────────────────────────────────────
    socket.on('chat:join', async (room_id) => {
      try {
        // 🔒 Mitgliedschafts-Check + Dojo-Isolation
        // Super-Admin (dojo_id=null) darf alle Räume betreten
        const [access] = await pool.query(
          `SELECT crm.id FROM chat_room_members crm
           JOIN chat_rooms r ON r.id = crm.room_id
           WHERE crm.room_id = ? AND crm.member_id = ? AND crm.member_type = ?
             AND (r.dojo_id = ? OR ? IS NULL)`,
          [room_id, sender_id, sender_type, dojo_id, dojo_id]
        );
        if (!access[0]) return;
        socket.join(`chat:${room_id}`);

        // last_seen_at aktualisieren
        await pool.query(
          `UPDATE chat_room_members SET last_seen_at = NOW()
           WHERE room_id = ? AND member_id = ? AND member_type = ?`,
          [room_id, sender_id, sender_type]
        );
      } catch (e) {
        logger.error('chat:join Fehler', { error: e.message });
      }
    });

    // ── Raum verlassen ────────────────────────────────────────────────────────
    socket.on('chat:leave', (room_id) => {
      socket.leave(`chat:${room_id}`);
    });

    // ── Nachricht senden ──────────────────────────────────────────────────────
    socket.on('chat:message', async ({ room_id, content }, callback) => {
      try {
        if (!content || !content.trim()) return;

        // 🔒 Zugriff, Raumtyp + Dojo-Isolation prüfen
        // Super-Admin (dojo_id=null) darf in alle Räume schreiben
        const [access] = await pool.query(
          `SELECT crm.id, r.type FROM chat_room_members crm
           JOIN chat_rooms r ON r.id = crm.room_id
           WHERE crm.room_id = ? AND crm.member_id = ? AND crm.member_type = ?
             AND (r.dojo_id = ? OR ? IS NULL)`,
          [room_id, sender_id, sender_type, dojo_id, dojo_id]
        );
        if (!access[0]) return;
        if (access[0].type === 'announcement' && sender_type === 'mitglied') return;

        // In DB speichern
        const [result] = await pool.query(
          `INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content)
           VALUES (?, ?, ?, 'text', ?)`,
          [room_id, sender_id, sender_type, content.trim()]
        );

        const sender_name = await getSenderName(sender_id, sender_type);

        const message = {
          id: result.insertId,
          room_id,
          sender_id,
          sender_type,
          message_type: 'text',
          content: content.trim(),
          sent_at: new Date(),
          sender_name,
          reactions: []
        };

        // An alle im Raum senden (inkl. Absender)
        io.to(`chat:${room_id}`).emit('chat:message', message);

        // Callback für Bestätigung (falls Frontend darauf wartet)
        if (typeof callback === 'function') callback({ success: true, id: result.insertId });

        // Offline-Push für nicht verbundene Mitglieder
        await triggerOfflinePush(io, room_id, message, sender_id, sender_type);

      } catch (error) {
        logger.error('chat:message Socket Fehler', { error: error.message });
        if (typeof callback === 'function') callback({ success: false });
      }
    });

    // ── Reaktion hinzufügen/entfernen ─────────────────────────────────────────
    socket.on('chat:react', async ({ message_id, emoji }) => {
      try {
        const allowedEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
        if (!emoji || !allowedEmojis.includes(emoji)) return;

        // Nachricht und Zugriff prüfen
        const [msg] = await pool.query(
          `SELECT m.room_id FROM chat_messages m
           JOIN chat_room_members crm ON crm.room_id = m.room_id
             AND crm.member_id = ? AND crm.member_type = ?
           WHERE m.id = ?`,
          [sender_id, sender_type, message_id]
        );
        if (!msg[0]) return;
        const room_id = msg[0].room_id;

        // Toggle
        const [existing] = await pool.query(
          `SELECT id FROM chat_message_reactions
           WHERE message_id = ? AND member_id = ? AND member_type = ? AND emoji = ?`,
          [message_id, sender_id, sender_type, emoji]
        );

        let action;
        if (existing[0]) {
          await pool.query(`DELETE FROM chat_message_reactions WHERE id = ?`, [existing[0].id]);
          action = 'removed';
        } else {
          await pool.query(
            `INSERT INTO chat_message_reactions (message_id, member_id, member_type, emoji)
             VALUES (?, ?, ?, ?)`,
            [message_id, sender_id, sender_type, emoji]
          );
          action = 'added';
        }

        // Aktuelle Reaktionen
        const [reactions] = await pool.query(
          `SELECT emoji, COUNT(*) as count FROM chat_message_reactions
           WHERE message_id = ? GROUP BY emoji`,
          [message_id]
        );

        io.to(`chat:${room_id}`).emit('chat:reaction', {
          message_id, reactions, emoji, action,
          actor_id: sender_id, actor_type: sender_type
        });

      } catch (error) {
        logger.error('chat:react Socket Fehler', { error: error.message });
      }
    });

    // ── Nachricht löschen ─────────────────────────────────────────────────────
    socket.on('chat:delete', async ({ message_id }) => {
      try {
        const isAdmin = sender_type === 'admin' || sender_type === 'trainer';

        // Nachricht + Dojo-Zugehörigkeit laden
        const [msgs] = await pool.query(
          `SELECT m.id, m.room_id, m.sender_id, m.sender_type, m.deleted_at
           FROM chat_messages m
           JOIN chat_rooms r ON r.id = m.room_id
           WHERE m.id = ? AND (r.dojo_id = ? OR ? IS NULL)`,
          [message_id, dojo_id, dojo_id]
        );
        if (!msgs[0] || msgs[0].deleted_at) return;

        const isOwn = String(msgs[0].sender_id) === String(sender_id) && msgs[0].sender_type === sender_type;
        if (!isOwn && !isAdmin) return;

        await pool.query(
          `UPDATE chat_messages SET deleted_at = NOW(), content = '[Nachricht gelöscht]' WHERE id = ?`,
          [message_id]
        );

        io.to(`chat:${msgs[0].room_id}`).emit('chat:deleted', {
          message_id,
          room_id: msgs[0].room_id
        });
      } catch (error) {
        logger.error('chat:delete Socket Fehler', { error: error.message });
      }
    });

    // ── Gelesen-Status senden ─────────────────────────────────────────────────
    socket.on('chat:read', async ({ room_id }) => {
      try {
        // 🔒 Mitgliedschafts-Check + Dojo-Isolation
        const [access] = await pool.query(
          `SELECT crm.id FROM chat_room_members crm
           JOIN chat_rooms r ON r.id = crm.room_id
           WHERE crm.room_id = ? AND crm.member_id = ? AND crm.member_type = ?
             AND (r.dojo_id = ? OR ? IS NULL)`,
          [room_id, sender_id, sender_type, dojo_id, dojo_id]
        );
        if (!access[0]) return;

        // Alle ungelesenen Nachrichten im Raum als gelesen markieren
        const [unread] = await pool.query(
          `SELECT id FROM chat_messages
           WHERE room_id = ? AND deleted_at IS NULL
             AND id NOT IN (
               SELECT message_id FROM chat_message_reads
               WHERE member_id = ? AND member_type = ?
             )`,
          [room_id, sender_id, sender_type]
        );

        if (unread.length) {
          const values = unread.map(m => [m.id, room_id, sender_id, sender_type]);
          await pool.query(
            `INSERT IGNORE INTO chat_message_reads (message_id, room_id, member_id, member_type) VALUES ?`,
            [values]
          );
        }
      } catch (error) {
        logger.error('chat:read Socket Fehler', { error: error.message });
      }
    });

    // ── Trennung ──────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.debug('Socket.io Chat getrennt', { sender_id, sender_type });
    });
  });
};

// Export für REST-Fallback in chat.js
module.exports.triggerOfflinePush = triggerOfflinePush;
