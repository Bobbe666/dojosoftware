// =====================================================================================
// CHAT ROUTES - Dojosoftware Chat-Funktion
// =====================================================================================
// REST-API für Räume, Nachrichten, Reaktionen und Mitgliederverwaltung
// Echtzeit via Socket.io (chatSocket.js)

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db');
const pool = db.promise(); // Promise-basierte API von mysql2
const logger = require('../utils/logger');

// Alle Routen erfordern Authentifizierung
router.use(authenticateToken);

// ─── Hilfsfunktion: Absender-Identität aus JWT ermitteln ─────────────────────

function getSenderInfo(req) {
  const role = req.user.role;
  let sender_id, sender_type;

  if (role === 'member') {
    sender_id = req.user.mitglied_id;
    sender_type = 'mitglied';
  } else if (role === 'trainer') {
    sender_id = req.user.user_id || req.user.admin_id || req.user.id;
    sender_type = 'trainer';
  } else {
    sender_id = req.user.user_id || req.user.admin_id || req.user.id;
    sender_type = 'admin';
  }

  return { sender_id, sender_type };
}

// ─── Hilfsfunktion: Dojo-ID sicher ermitteln ─────────────────────────────────

function getDojoId(req) {
  return req.user.dojo_id || req.query.dojo_id || req.body?.dojo_id || null;
}

// ─── Hilfsfunktion: Sendernamen aus DB laden ──────────────────────────────────

async function getSenderName(sender_id, sender_type) {
  try {
    if (sender_type === 'mitglied') {
      const [rows] = await pool.query(
        'SELECT vorname, nachname FROM mitglieder WHERE mitglied_id = ?',
        [sender_id]
      );
      if (rows[0]) return `${rows[0].vorname} ${rows[0].nachname}`.trim();
    } else {
      const [rows] = await pool.query(
        'SELECT username FROM users WHERE id = ?',
        [sender_id]
      );
      if (rows[0]) return rows[0].username;
    }
  } catch (e) {
    logger.error('getSenderName Fehler', { error: e.message });
  }
  return 'Unbekannt';
}

// ─── Hilfsfunktion: Reaktionen für Nachrichten laden ────────────────────────

async function loadReactionsForMessages(messageIds) {
  if (!messageIds.length) return {};
  const [reactions] = await pool.query(
    `SELECT message_id, emoji, COUNT(*) as count,
            GROUP_CONCAT(CONCAT(member_id, ':', member_type)) as reactors
     FROM chat_message_reactions
     WHERE message_id IN (?)
     GROUP BY message_id, emoji`,
    [messageIds]
  );
  const map = {};
  for (const r of reactions) {
    if (!map[r.message_id]) map[r.message_id] = [];
    map[r.message_id].push({
      emoji: r.emoji,
      count: r.count,
      reactors: r.reactors ? r.reactors.split(',') : []
    });
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/rooms — Meine Räume
// ─────────────────────────────────────────────────────────────────────────────

router.get('/rooms', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const dojo_id = getDojoId(req);
    const isSuperAdmin = (req.user.dojo_id === null || req.user.dojo_id === undefined)
                      && (req.user.role === 'admin' || req.user.role === 'super_admin');

    // Super-Admin: alle Räume ohne Dojo-Filter (nur eigene Mitgliedschaft)
    const baseQuery = `SELECT
         r.id, r.type, r.name, r.description, r.created_at, r.updated_at,
         r.dojo_id,
         crm.role as my_role, crm.muted, crm.pinned, crm.archived,
         lm.content as last_message,
         lm.sent_at as last_message_at,
         lm.sender_type as last_sender_type,
         lm.sender_id as last_sender_id,
         (
           SELECT COUNT(*)
           FROM chat_messages cm2
           WHERE cm2.room_id = r.id
             AND cm2.deleted_at IS NULL
             AND cm2.id NOT IN (
               SELECT message_id FROM chat_message_reads
               WHERE member_id = ? AND member_type = ?
             )
         ) as unread_count,
         (SELECT COUNT(*) FROM chat_room_members WHERE room_id = r.id) as member_count
       FROM chat_rooms r
       JOIN chat_room_members crm ON crm.room_id = r.id
         AND crm.member_id = ? AND crm.member_type = ?
       LEFT JOIN chat_messages lm ON lm.id = (
         SELECT id FROM chat_messages
         WHERE room_id = r.id AND deleted_at IS NULL
         ORDER BY sent_at DESC LIMIT 1
       )`;

    let rooms;
    if (isSuperAdmin) {
      [rooms] = await pool.query(
        baseQuery + ` ORDER BY crm.pinned DESC, COALESCE(lm.sent_at, r.created_at) DESC`,
        [sender_id, sender_type, sender_id, sender_type]
      );
    } else {
      [rooms] = await pool.query(
        baseQuery + ` WHERE r.dojo_id = ? ORDER BY crm.pinned DESC, COALESCE(lm.sent_at, r.created_at) DESC`,
        [sender_id, sender_type, sender_id, sender_type, dojo_id]
      );
    }

    // Namen für Direktchats: Gegenseite ermitteln
    for (const room of rooms) {
      if (room.type === 'direct') {
        const [otherMember] = await pool.query(
          `SELECT crm.member_id, crm.member_type
           FROM chat_room_members crm
           WHERE crm.room_id = ? AND NOT (crm.member_id = ? AND crm.member_type = ?)
           LIMIT 1`,
          [room.id, sender_id, sender_type]
        );
        if (otherMember[0]) {
          room.name = await getSenderName(otherMember[0].member_id, otherMember[0].member_type);
          room.other_member_id = otherMember[0].member_id;
          room.other_member_type = otherMember[0].member_type;
        }
      }
    }

    res.json({ success: true, rooms });
  } catch (error) {
    logger.error('Chat rooms Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Räume' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/rooms — Neuen Raum erstellen
// ─────────────────────────────────────────────────────────────────────────────

router.post('/rooms', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const { type = 'group', name, description, members = [], dojo_id: bodyDojoId } = req.body;
    const isSuperAdmin = (req.user.dojo_id === null || req.user.dojo_id === undefined)
                      && (req.user.role === 'admin' || req.user.role === 'super_admin');
    // Super-Admin: dojo_id aus Body (vom gewählten Mitglied), sonst aus Token/Query
    const dojo_id = isSuperAdmin
      ? (bodyDojoId || null)
      : getDojoId(req);

    if (!dojo_id) return res.status(400).json({ message: 'Dojo-ID fehlt' });

    // Bei Direktchat: prüfen ob schon ein DM zwischen diesen zwei Personen existiert
    if (type === 'direct' && members.length === 1) {
      const other = members[0]; // { member_id, member_type }
      const [existing] = await pool.query(
        `SELECT r.id FROM chat_rooms r
         JOIN chat_room_members a ON a.room_id = r.id AND a.member_id = ? AND a.member_type = ?
         JOIN chat_room_members b ON b.room_id = r.id AND b.member_id = ? AND b.member_type = ?
         WHERE r.type = 'direct' AND r.dojo_id = ?
         LIMIT 1`,
        [sender_id, sender_type, other.member_id, other.member_type, dojo_id]
      );
      if (existing[0]) {
        return res.json({ success: true, room_id: existing[0].id, existing: true });
      }
    }

    // Ankündigungs-Raum: nur Admins dürfen erstellen
    if (type === 'announcement' && sender_type !== 'admin') {
      return res.status(403).json({ message: 'Nur Admins können Ankündigungs-Kanäle erstellen' });
    }

    const [result] = await pool.query(
      `INSERT INTO chat_rooms (dojo_id, type, name, description, created_by_id, created_by_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dojo_id, type, name || null, description || null, sender_id, sender_type]
    );
    const room_id = result.insertId;

    // Ersteller als Owner eintragen
    await pool.query(
      `INSERT INTO chat_room_members (room_id, member_id, member_type, role) VALUES (?, ?, ?, 'owner')`,
      [room_id, sender_id, sender_type]
    );

    // Weitere Mitglieder hinzufügen
    for (const m of members) {
      if (m.member_id === sender_id && m.member_type === sender_type) continue;
      await pool.query(
        `INSERT IGNORE INTO chat_room_members (room_id, member_id, member_type, role) VALUES (?, ?, ?, 'member')`,
        [room_id, m.member_id, m.member_type]
      );
    }

    logger.info('Chat-Raum erstellt', { room_id, type, dojo_id });
    res.json({ success: true, room_id });
  } catch (error) {
    logger.error('Chat room erstellen Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Erstellen des Raums' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/chat/rooms/:id — Raum-Einstellungen aktualisieren (Name, Avatar, Status)
// ─────────────────────────────────────────────────────────────────────────────

router.put('/rooms/:id', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);
    const { name, avatar_emoji, avatar_color, status } = req.body;
    const isAdminUser = req.user.role === 'admin' || req.user.role === 'super_admin';

    // Nur Owner, Admin im Raum oder globale Admins dürfen bearbeiten
    if (!isAdminUser) {
      const [myRole] = await pool.query(
        `SELECT role FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
        [room_id, sender_id, sender_type]
      );
      if (!myRole[0] || !['owner', 'admin'].includes(myRole[0].role)) {
        return res.status(403).json({ success: false, message: 'Keine Berechtigung' });
      }
    }

    const updates = [];
    const values = [];
    if (name !== undefined)         { updates.push('name = ?');         values.push(name || null); }
    if (avatar_emoji !== undefined)  { updates.push('avatar_emoji = ?');  values.push(avatar_emoji); }
    if (avatar_color !== undefined)  { updates.push('avatar_color = ?');  values.push(avatar_color); }
    if (status !== undefined)        { updates.push('status = ?');        values.push(status); }

    if (updates.length === 0) return res.json({ success: true });

    values.push(room_id);
    await pool.query(`UPDATE chat_rooms SET ${updates.join(', ')} WHERE id = ?`, values);

    logger.info('Chat-Raum aktualisiert', { room_id, updates: Object.keys(req.body) });
    res.json({ success: true });
  } catch (error) {
    logger.error('Chat room update Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Speichern' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/rooms/:id — Raum dauerhaft löschen (nur Owner/Admin)
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/rooms/:id', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);
    const isAdminUser = req.user.role === 'admin' || req.user.role === 'super_admin';

    if (!isAdminUser) {
      const [myRole] = await pool.query(
        `SELECT role FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
        [room_id, sender_id, sender_type]
      );
      if (!myRole[0] || myRole[0].role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Keine Berechtigung' });
      }
    }

    // Kaskadenweise löschen
    await pool.query(`DELETE FROM chat_message_reactions WHERE message_id IN (SELECT id FROM chat_messages WHERE room_id = ?)`, [room_id]);
    await pool.query(`DELETE FROM chat_message_reads WHERE room_id = ?`, [room_id]);
    await pool.query(`DELETE FROM chat_messages WHERE room_id = ?`, [room_id]);
    await pool.query(`DELETE FROM chat_room_members WHERE room_id = ?`, [room_id]);
    await pool.query(`DELETE FROM chat_rooms WHERE id = ?`, [room_id]);

    logger.info('Chat-Raum gelöscht', { room_id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Chat room löschen Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Löschen' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/chat/rooms/:id/pin — Anpinnen/Lösen (toggle)
// ─────────────────────────────────────────────────────────────────────────────

router.put('/rooms/:id/pin', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);
    await pool.query(
      `UPDATE chat_room_members SET pinned = NOT pinned
       WHERE room_id = ? AND member_id = ? AND member_type = ?`,
      [room_id, sender_id, sender_type]
    );
    const [[row]] = await pool.query(
      `SELECT pinned FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
      [room_id, sender_id, sender_type]
    );
    res.json({ success: true, pinned: !!row?.pinned });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/chat/rooms/:id/archive — Archivieren/Wiederherstellen (toggle)
// ─────────────────────────────────────────────────────────────────────────────

router.put('/rooms/:id/archive', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);
    await pool.query(
      `UPDATE chat_room_members SET archived = NOT archived
       WHERE room_id = ? AND member_id = ? AND member_type = ?`,
      [room_id, sender_id, sender_type]
    );
    const [[row]] = await pool.query(
      `SELECT archived FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
      [room_id, sender_id, sender_type]
    );
    res.json({ success: true, archived: !!row?.archived });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/rooms/:id/leave — Aus Raum austreten / Chat löschen
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/rooms/:id/leave', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);
    await pool.query(
      `DELETE FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
      [room_id, sender_id, sender_type]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/rooms/:id/messages — Nachrichten laden (paginiert)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/rooms/:id/messages', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const before_id = req.query.before_id ? parseInt(req.query.before_id) : null;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const isSuperAdmin = req.user.dojo_id === null || req.user.dojo_id === undefined;

    // Zugriff prüfen — Admins & Super-Admins dürfen alle Räume lesen
    if (!isAdmin) {
      const [access] = await pool.query(
        `SELECT id FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
        [room_id, sender_id, sender_type]
      );
      if (!access[0]) return res.status(403).json({ message: 'Kein Zugriff auf diesen Raum' });
    } else if (!isSuperAdmin) {
      // Regulärer Admin: prüfe ob Raum zum eigenen Dojo gehört
      const [roomCheck] = await pool.query(
        `SELECT id FROM chat_rooms WHERE id = ? AND dojo_id = ?`,
        [room_id, req.user.dojo_id]
      );
      if (!roomCheck[0]) return res.status(403).json({ message: 'Raum gehört nicht zu deinem Dojo' });
    }

    let query = `
      SELECT m.id, m.room_id, m.sender_id, m.sender_type, m.message_type,
             m.content, m.push_notification_id, m.sent_at, m.edited_at, m.deleted_at
      FROM chat_messages m
      WHERE m.room_id = ?`;
    const params = [room_id];

    if (before_id) {
      query += ' AND m.id < ?';
      params.push(before_id);
    }

    query += ' ORDER BY m.sent_at DESC LIMIT ?';
    params.push(limit);

    const [messages] = await pool.query(query, params);
    messages.reverse(); // Älteste zuerst

    // Sendernamen hinzufügen
    for (const m of messages) {
      if (m.deleted_at) {
        m.content = '[Nachricht gelöscht]';
        m.deleted = true;
      }
      m.sender_name = await getSenderName(m.sender_id, m.sender_type);
      m.is_own = (m.sender_id === sender_id && m.sender_type === sender_type);
    }

    // Reaktionen batch-laden
    const msgIds = messages.map(m => m.id);
    const reactionsMap = await loadReactionsForMessages(msgIds);
    for (const m of messages) {
      m.reactions = reactionsMap[m.id] || [];
    }

    // Eigene gelesene Nachrichten markieren
    if (msgIds.length) {
      const [readRows] = await pool.query(
        `SELECT message_id FROM chat_message_reads WHERE member_id = ? AND member_type = ? AND message_id IN (?)`,
        [sender_id, sender_type, msgIds]
      );
      const readSet = new Set(readRows.map(r => r.message_id));
      for (const m of messages) {
        m.read_by_me = readSet.has(m.id);
      }
    }

    res.json({ success: true, messages, has_more: messages.length === limit });
  } catch (error) {
    logger.error('Chat messages Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Nachrichten' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/rooms/:id/messages — Nachricht senden (REST-Fallback)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/rooms/:id/messages', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Nachrichteninhalt fehlt' });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const isSuperAdmin = req.user.dojo_id === null || req.user.dojo_id === undefined;
    let roomType = null;

    if (!isAdmin) {
      // Mitglieder/Trainer: Mitgliedschaft prüfen
      const [access] = await pool.query(
        `SELECT crm.id, r.type FROM chat_room_members crm
         JOIN chat_rooms r ON r.id = crm.room_id
         WHERE crm.room_id = ? AND crm.member_id = ? AND crm.member_type = ?`,
        [room_id, sender_id, sender_type]
      );
      if (!access[0]) return res.status(403).json({ message: 'Kein Zugriff auf diesen Raum' });
      roomType = access[0].type;
    } else {
      // Admin: nur Raum-Typ laden
      const [roomInfo] = await pool.query(
        `SELECT type, dojo_id FROM chat_rooms WHERE id = ?`, [room_id]
      );
      if (!roomInfo[0]) return res.status(404).json({ message: 'Raum nicht gefunden' });
      if (!isSuperAdmin && roomInfo[0].dojo_id !== req.user.dojo_id) {
        return res.status(403).json({ message: 'Raum gehört nicht zu deinem Dojo' });
      }
      roomType = roomInfo[0].type;
    }

    // Ankündigungs-Räume: nur Admins/Trainer dürfen schreiben
    if (roomType === 'announcement' && sender_type === 'mitglied') {
      return res.status(403).json({ message: 'Mitglieder können in Ankündigungen nicht schreiben' });
    }

    const [result] = await pool.query(
      `INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content)
       VALUES (?, ?, ?, 'text', ?)`,
      [room_id, sender_id, sender_type, content.trim()]
    );

    const message = {
      id: result.insertId,
      room_id,
      sender_id,
      sender_type,
      message_type: 'text',
      content: content.trim(),
      sent_at: new Date(),
      sender_name: await getSenderName(sender_id, sender_type),
      is_own: true,
      reactions: []
    };

    // Via Socket.io broadcasten (wenn verfügbar)
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${room_id}`).emit('chat:message', message);
      // Offline-Push über chatSocket auslagern
      try {
        const { triggerOfflinePush } = require('../socket/chatSocket');
        await triggerOfflinePush(io, room_id, message, sender_id, sender_type);
      } catch (e) {
        logger.warn('Offline-Push Fehler', { error: e.message });
      }
    }

    res.json({ success: true, message });
  } catch (error) {
    logger.error('Chat message senden Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Senden der Nachricht' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/chat/rooms/:id/read — Alle Nachrichten als gelesen markieren
// ─────────────────────────────────────────────────────────────────────────────

router.put('/rooms/:id/read', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);

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

    res.json({ success: true, marked: unread.length });
  } catch (error) {
    logger.error('Chat read Fehler', { error: error.message });
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/rooms/:id/members — Mitglied hinzufügen
// ─────────────────────────────────────────────────────────────────────────────

router.post('/rooms/:id/members', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);
    const { member_id, member_type } = req.body;

    // Prüfen ob Requester Rechte hat (owner oder admin im Raum)
    const [myRole] = await pool.query(
      `SELECT role FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
      [room_id, sender_id, sender_type]
    );
    if (!myRole[0] || !['owner', 'admin'].includes(myRole[0].role)) {
      return res.status(403).json({ message: 'Keine Berechtigung' });
    }

    await pool.query(
      `INSERT IGNORE INTO chat_room_members (room_id, member_id, member_type, role) VALUES (?, ?, ?, 'member')`,
      [room_id, member_id, member_type]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Chat member hinzufügen Fehler', { error: error.message });
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/rooms/:id/members/:mid — Mitglied entfernen
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/rooms/:id/members/:mid', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);
    const { member_type } = req.query;
    const target_id = parseInt(req.params.mid);

    // Selbst austreten ist immer erlaubt; sonst Owner/Admin-Recht prüfen
    const isSelf = (target_id === sender_id && member_type === sender_type);
    if (!isSelf) {
      const [myRole] = await pool.query(
        `SELECT role FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
        [room_id, sender_id, sender_type]
      );
      if (!myRole[0] || !['owner', 'admin'].includes(myRole[0].role)) {
        return res.status(403).json({ message: 'Keine Berechtigung' });
      }
    }

    await pool.query(
      `DELETE FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
      [room_id, target_id, member_type]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Chat member entfernen Fehler', { error: error.message });
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/messages/:id/react — Reaktion hinzufügen/entfernen (Toggle)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/messages/:id/react', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const message_id = parseInt(req.params.id);
    const { emoji } = req.body;

    const allowedEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
    if (!emoji || !allowedEmojis.includes(emoji)) {
      return res.status(400).json({ message: 'Ungültiges Emoji' });
    }

    // Nachricht und Raum-Zugehörigkeit prüfen
    const [msg] = await pool.query(
      `SELECT m.room_id FROM chat_messages m
       JOIN chat_room_members crm ON crm.room_id = m.room_id
         AND crm.member_id = ? AND crm.member_type = ?
       WHERE m.id = ?`,
      [sender_id, sender_type, message_id]
    );
    if (!msg[0]) return res.status(403).json({ message: 'Kein Zugriff' });

    const room_id = msg[0].room_id;

    // Toggle: wenn schon reagiert → entfernen, sonst hinzufügen
    const [existing] = await pool.query(
      `SELECT id FROM chat_message_reactions
       WHERE message_id = ? AND member_id = ? AND member_type = ? AND emoji = ?`,
      [message_id, sender_id, sender_type, emoji]
    );

    let action;
    if (existing[0]) {
      await pool.query(
        `DELETE FROM chat_message_reactions WHERE id = ?`,
        [existing[0].id]
      );
      action = 'removed';
    } else {
      await pool.query(
        `INSERT INTO chat_message_reactions (message_id, member_id, member_type, emoji) VALUES (?, ?, ?, ?)`,
        [message_id, sender_id, sender_type, emoji]
      );
      action = 'added';
    }

    // Aktuelle Reaktionen laden
    const [reactions] = await pool.query(
      `SELECT emoji, COUNT(*) as count FROM chat_message_reactions
       WHERE message_id = ? GROUP BY emoji`,
      [message_id]
    );

    // Via Socket.io broadcasten
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${room_id}`).emit('chat:reaction', {
        message_id,
        reactions,
        actor_id: sender_id,
        actor_type: sender_type,
        emoji,
        action
      });
    }

    res.json({ success: true, action, reactions });
  } catch (error) {
    logger.error('Chat react Fehler', { error: error.message });
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/unread-count — Gesamtzahl ungelesener Nachrichten
// ─────────────────────────────────────────────────────────────────────────────

router.get('/unread-count', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const dojo_id = getDojoId(req);

    const [result] = await pool.query(
      `SELECT COUNT(*) as total
       FROM chat_messages cm
       JOIN chat_room_members crm ON crm.room_id = cm.room_id
         AND crm.member_id = ? AND crm.member_type = ?
       JOIN chat_rooms r ON r.id = cm.room_id AND r.dojo_id = ?
       WHERE cm.deleted_at IS NULL
         AND cm.id NOT IN (
           SELECT message_id FROM chat_message_reads
           WHERE member_id = ? AND member_type = ?
         )`,
      [sender_id, sender_type, dojo_id, sender_id, sender_type]
    );

    res.json({ success: true, count: result[0].total });
  } catch (error) {
    logger.error('Chat unread-count Fehler', { error: error.message });
    res.status(500).json({ success: false, count: 0 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/members/search — Mitglieder und Trainer für neuen Chat suchen
// ─────────────────────────────────────────────────────────────────────────────

router.get('/members/search', async (req, res) => {
  try {
    const dojo_id = getDojoId(req);
    const rawQ = (req.query.q || '').trim();
    const q = `%${rawQ}%`;
    const isEmpty = rawQ.length === 0;
    const limit = isEmpty ? 500 : 20;
    const isSuperAdmin = req.user.dojo_id === null || req.user.dojo_id === undefined;

    // Super-Admin ohne dojo_id: alle Mitglieder, Trainer und Admins aller Dojos
    if (!dojo_id && isSuperAdmin) {
      const [mitglieder] = await pool.query(
        `SELECT m.mitglied_id as member_id, 'mitglied' as member_type,
                CONCAT(m.vorname, ' ', m.nachname) as name, m.email,
                m.dojo_id, d.dojoname as dojo_name
         FROM mitglieder m
         JOIN dojo d ON m.dojo_id = d.id
         WHERE (m.vorname LIKE ? OR m.nachname LIKE ? OR m.email LIKE ?)
         ORDER BY m.vorname, m.nachname
         LIMIT ?`,
        [q, q, q, isEmpty ? 300 : 20]
      );
      const [admins] = await pool.query(
        `SELECT u.id as member_id,
                CASE WHEN u.role = 'trainer' THEN 'trainer' ELSE 'admin' END as member_type,
                u.username as name, u.email,
                u.dojo_id, d.dojoname as dojo_name
         FROM users u
         JOIN dojo d ON u.dojo_id = d.id
         WHERE u.role IN ('admin', 'trainer')
           AND (u.username LIKE ? OR u.email LIKE ?)
         ORDER BY u.username
         LIMIT ?`,
        [q, q, isEmpty ? 100 : 10]
      );
      const results = [
        ...mitglieder.map(m => ({ ...m, name: `${m.name} (${m.dojo_name})` })),
        ...admins.map(a => ({ ...a, name: `${a.name} (${a.dojo_name})` }))
      ].sort((a, b) => a.name.localeCompare(b.name, 'de'));
      return res.json({ success: true, results });
    }

    if (!dojo_id) return res.status(400).json({ message: 'Dojo-ID fehlt' });

    // Mitglieder suchen
    const [mitglieder] = await pool.query(
      `SELECT mitglied_id as member_id, 'mitglied' as member_type,
              CONCAT(vorname, ' ', nachname) as name, email
       FROM mitglieder
       WHERE dojo_id = ? AND (vorname LIKE ? OR nachname LIKE ? OR email LIKE ?)
       ORDER BY vorname, nachname
       LIMIT ?`,
      [dojo_id, q, q, q, limit]
    );

    // Trainer suchen
    const [trainer] = await pool.query(
      `SELECT u.id as member_id, 'trainer' as member_type,
              u.username as name, u.email
       FROM users u
       WHERE u.dojo_id = ? AND u.role = 'trainer'
         AND (u.username LIKE ? OR u.email LIKE ?)
       ORDER BY u.username
       LIMIT ?`,
      [dojo_id, q, q, isEmpty ? 50 : 10]
    );

    // Admins suchen
    const [admins] = await pool.query(
      `SELECT u.id as member_id, 'admin' as member_type,
              u.username as name, u.email
       FROM users u
       WHERE u.dojo_id = ? AND u.role = 'admin'
         AND (u.username LIKE ? OR u.email LIKE ?)
       ORDER BY u.username
       LIMIT ?`,
      [dojo_id, q, q, isEmpty ? 20 : 5]
    );

    // Alphabetisch zusammenführen
    const results = [...mitglieder, ...trainer, ...admins]
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    res.json({ success: true, results });
  } catch (error) {
    logger.error('Chat members/search Fehler', { error: error.message });
    res.status(500).json({ success: false, results: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/rooms/:id/members — Mitgliederliste eines Raums
// ─────────────────────────────────────────────────────────────────────────────

router.get('/rooms/:id/members', async (req, res) => {
  try {
    const { sender_id, sender_type } = getSenderInfo(req);
    const room_id = parseInt(req.params.id);

    const [access] = await pool.query(
      `SELECT id FROM chat_room_members WHERE room_id = ? AND member_id = ? AND member_type = ?`,
      [room_id, sender_id, sender_type]
    );
    if (!access[0]) return res.status(403).json({ message: 'Kein Zugriff' });

    const [members] = await pool.query(
      `SELECT crm.member_id, crm.member_type, crm.role, crm.joined_at
       FROM chat_room_members crm
       WHERE crm.room_id = ?
       ORDER BY crm.role DESC, crm.joined_at ASC`,
      [room_id]
    );

    // Namen hinzufügen
    for (const m of members) {
      m.name = await getSenderName(m.member_id, m.member_type);
    }

    res.json({ success: true, members });
  } catch (error) {
    logger.error('Chat room members Fehler', { error: error.message });
    res.status(500).json({ success: false });
  }
});

// ─── SUPER-ADMIN: Alle Räume aller Dojos ─────────────────────────────────────
// Nur für Super-Admins (dojo_id = null im JWT)
router.get('/admin/all-rooms', async (req, res) => {
  try {
    // Super-Admin-Check: dojo_id muss null sein
    if (req.user.dojo_id !== null && req.user.dojo_id !== undefined) {
      return res.status(403).json({ success: false, message: 'Nur für Super-Admins' });
    }

    const [rooms] = await pool.query(`
      SELECT
        cr.id,
        cr.dojo_id,
        d.dojoname AS dojo_name,
        cr.type,
        cr.name,
        cr.created_at,
        cr.updated_at,
        (
          SELECT cm.content
          FROM chat_messages cm
          WHERE cm.room_id = cr.id AND cm.deleted_at IS NULL
          ORDER BY cm.sent_at DESC LIMIT 1
        ) AS last_message,
        (
          SELECT COUNT(*)
          FROM chat_messages cm
          WHERE cm.room_id = cr.id AND cm.deleted_at IS NULL
        ) AS message_count
      FROM chat_rooms cr
      JOIN dojo d ON cr.dojo_id = d.id
      ORDER BY cr.updated_at DESC
      LIMIT 500
    `);

    res.json({ success: true, rooms });
  } catch (error) {
    logger.error('Super-Admin all-rooms Fehler', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
