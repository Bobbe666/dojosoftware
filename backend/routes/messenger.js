// =====================================================================================
// MESSENGER ROUTES — Facebook Messenger Integration (Enterprise Feature)
// =====================================================================================
// GET  /api/messenger/webhook        → Meta Webhook-Verifizierung (Challenge-Response)
// POST /api/messenger/webhook        → Eingehende Nachrichten empfangen
// GET  /api/messenger/config         → Dojo-Konfiguration laden
// PUT  /api/messenger/config         → Dojo-Konfiguration speichern
// GET  /api/messenger/conversations  → Alle Messenger-Konversationen des Dojos
// POST /api/messenger/send           → Antwort senden via Facebook Graph API

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');
const db = require('../db');
const pool = db.promise();
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// ─── Facebook Graph API ──────────────────────────────────────────────────────

const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

async function sendMessengerMessage(pageToken, psid, messageText) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      recipient: { id: psid },
      message: { text: messageText }
    });

    const url = new URL(`${GRAPH_API_BASE}/me/messages`);
    url.searchParams.set('access_token', pageToken);

    const options = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Ungültige API-Antwort'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getFacebookUserName(psid, pageToken) {
  return new Promise((resolve) => {
    const url = new URL(`${GRAPH_API_BASE}/${psid}`);
    url.searchParams.set('fields', 'name');
    url.searchParams.set('access_token', pageToken);

    https.get(url.toString(), (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.name || 'Facebook-Nutzer');
        } catch {
          resolve('Facebook-Nutzer');
        }
      });
    }).on('error', () => resolve('Facebook-Nutzer'));
  });
}

// ─── Hilfsfunktion: HMAC-Signatur prüfen ────────────────────────────────────

function verifySignature(appSecret, rawBody, signature) {
  if (!signature || !appSecret) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Feature-Gate: Prüft ob Dojo Messenger-Feature hat ──────────────────────

async function checkMessengerFeature(dojoId) {
  // Messenger verfügbar für jedes Dojo mit konfigurierter Subdomain
  const [rows] = await pool.query(
    `SELECT subdomain FROM dojo WHERE id = ? AND subdomain IS NOT NULL AND subdomain != ''`,
    [dojoId]
  );
  return rows.length > 0;
}

// ─── Hilfsfunktion: Messenger-Config für Dojo laden ─────────────────────────

async function getDojoConfig(dojoId) {
  const [rows] = await pool.query(
    `SELECT * FROM dojo_messenger_config WHERE dojo_id = ?`,
    [dojoId]
  );
  return rows[0] || null;
}

// =====================================================================================
// 1. WEBHOOK VERIFIZIERUNG (GET) — Kein Auth, von Meta aufgerufen
// =====================================================================================

router.get('/webhook', async (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

  if (mode !== 'subscribe') {
    return res.status(400).json({ error: 'Ungültiger mode' });
  }

  // Suche Dojo mit passendem verify_token
  const [configs] = await pool.query(
    `SELECT dojo_id FROM dojo_messenger_config WHERE verify_token = ? AND is_active = 1`,
    [token]
  );

  if (configs.length === 0) {
    logger.warn('Messenger Webhook: Ungültiger verify_token');
    return res.status(403).send('Forbidden');
  }

  logger.info('Messenger Webhook verifiziert', { dojo_id: configs[0].dojo_id });
  res.send(challenge);
});

// =====================================================================================
// 2. EINGEHENDE NACHRICHTEN (POST) — Kein Auth, von Meta aufgerufen
// =====================================================================================

router.post('/webhook', async (req, res) => {
  // Meta erwartet sofortige 200-Antwort
  res.sendStatus(200);

  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of (body.entry || [])) {
    const pageId = entry.id;

    // Welches Dojo gehört zu dieser Page?
    const [configs] = await pool.query(
      `SELECT * FROM dojo_messenger_config WHERE page_id = ? AND is_active = 1`,
      [pageId]
    ).catch(() => [[]]);

    if (configs.length === 0) {
      logger.warn('Messenger Webhook: Unbekannte page_id', { pageId });
      continue;
    }

    const config = configs[0];
    const dojoId = config.dojo_id;

    // Optionale HMAC-Validierung (wenn app_secret konfiguriert)
    if (config.app_secret) {
      const signature = req.headers['x-hub-signature-256'];
      const rawBody = JSON.stringify(body); // Approximation (express.json hat bereits geparsed)
      if (!verifySignature(config.app_secret, rawBody, signature)) {
        logger.warn('Messenger Webhook: HMAC-Signatur ungültig', { dojoId });
        continue;
      }
    }

    for (const messagingEvent of (entry.messaging || [])) {
      const psid = messagingEvent.sender?.id;
      const text = messagingEvent.message?.text;

      if (!psid || !text || messagingEvent.message?.is_echo) continue;

      try {
        await handleIncomingMessage(dojoId, psid, text, config.page_token);
      } catch (err) {
        logger.error('Messenger: Fehler bei Nachrichtenverarbeitung', {
          dojoId,
          psid,
          error: err.message
        });
      }
    }
  }
});

async function handleIncomingMessage(dojoId, psid, text, pageToken) {
  const io = null; // wird unten aus req.app geholt — hier als Standalone-Funktion nicht verfügbar
  // → wir nutzen global gesetzten io (unten per Singleton)

  // 1. Existierende Konversation suchen
  let [convRows] = await pool.query(
    `SELECT mc.*, cr.id as room_id
     FROM messenger_conversations mc
     JOIN chat_rooms cr ON mc.chat_room_id = cr.id
     WHERE mc.dojo_id = ? AND mc.psid = ?`,
    [dojoId, psid]
  );

  let chatRoomId;
  let fbName;

  if (convRows.length > 0) {
    chatRoomId = convRows[0].chat_room_id;
    fbName = convRows[0].fb_name;

    // last_message_at aktualisieren
    await pool.query(
      `UPDATE messenger_conversations SET last_message_at = NOW() WHERE dojo_id = ? AND psid = ?`,
      [dojoId, psid]
    );
  } else {
    // Neuen Facebook-Namen laden
    fbName = pageToken ? await getFacebookUserName(psid, pageToken) : 'Facebook-Nutzer';

    // Neuen chat_rooms Eintrag anlegen
    const [roomResult] = await pool.query(
      `INSERT INTO chat_rooms (name, type, source, external_id, dojo_id, created_by_id, created_by_type)
       VALUES (?, 'direct', 'messenger', ?, ?, NULL, NULL)`,
      [fbName, psid, dojoId]
    );
    chatRoomId = roomResult.insertId;

    // Konversations-Mapping speichern
    await pool.query(
      `INSERT INTO messenger_conversations (dojo_id, psid, fb_name, chat_room_id, last_message_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [dojoId, psid, fbName, chatRoomId]
    );
  }

  // 2. Nachricht in chat_messages speichern
  const [msgResult] = await pool.query(
    `INSERT INTO chat_messages (room_id, sender_id, sender_type, content, sent_at)
     VALUES (?, ?, 'messenger_user', ?, NOW())`,
    [chatRoomId, psid, text]
  );

  // 3. Socket.io Event auslösen (Admin sieht Nachricht in Echtzeit)
  const ioInstance = global.messengerIo;
  if (ioInstance) {
    const roomSocketId = `chat_room_${chatRoomId}`;
    ioInstance.to(roomSocketId).emit('chat:message', {
      id: msgResult.insertId,
      room_id: chatRoomId,
      sender_id: psid,
      sender_type: 'messenger_user',
      sender_name: fbName,
      content: text,
      sent_at: new Date().toISOString(),
      source: 'messenger'
    });
  }

  logger.info('Messenger: Nachricht gespeichert', { dojoId, psid, chatRoomId });
}

// =====================================================================================
// 3. KONFIGURATION LADEN (GET) — Auth required
// =====================================================================================

router.get('/config', authenticateToken, async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo gefunden' });

  try {
    const hasFeature = await checkMessengerFeature(dojoId);
    if (!hasFeature) {
      return res.status(403).json({
        error: 'Messenger ist nicht im aktuellen Plan enthalten',
        required_plan: 'enterprise'
      });
    }

    const config = await getDojoConfig(dojoId);

    if (!config) {
      return res.json({
        configured: false,
        page_id: '',
        page_token: '',
        app_secret: '',
        verify_token: '',
        is_active: false
      });
    }

    // Secrets maskieren für Anzeige
    res.json({
      configured: true,
      page_id: config.page_id || '',
      page_token: config.page_token ? `${config.page_token.substring(0, 8)}...` : '',
      app_secret: config.app_secret ? '••••••••' : '',
      verify_token: config.verify_token || '',
      is_active: !!config.is_active
    });
  } catch (error) {
    logger.error('Messenger config GET Fehler', { error: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// =====================================================================================
// 4. KONFIGURATION SPEICHERN (PUT) — Auth required
// =====================================================================================

router.put('/config', authenticateToken, async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo gefunden' });

  try {
    const hasFeature = await checkMessengerFeature(dojoId);
    if (!hasFeature) {
      return res.status(403).json({
        error: 'Messenger ist nicht im aktuellen Plan enthalten',
        required_plan: 'enterprise'
      });
    }

    const { page_id, page_token, app_secret, is_active } = req.body;

    const existing = await getDojoConfig(dojoId);

    if (existing) {
      // Update — Felder nur überschreiben wenn übergeben (leere Strings = nicht ändern)
      const updates = { is_active: is_active ? 1 : 0 };
      if (page_id !== undefined) updates.page_id = page_id || null;
      if (page_token && !page_token.includes('...')) updates.page_token = page_token || null;
      if (app_secret && app_secret !== '••••••••') updates.app_secret = app_secret || null;

      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await pool.query(
        `UPDATE dojo_messenger_config SET ${setClauses}, updated_at = NOW() WHERE dojo_id = ?`,
        [...Object.values(updates), dojoId]
      );
    } else {
      // Neuer Eintrag: verify_token generieren
      const verifyToken = crypto.randomBytes(20).toString('hex');
      await pool.query(
        `INSERT INTO dojo_messenger_config (dojo_id, page_id, page_token, app_secret, verify_token, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [dojoId, page_id || null, page_token || null, app_secret || null, verifyToken, is_active ? 1 : 0]
      );
    }

    const updated = await getDojoConfig(dojoId);
    logger.info('Messenger-Konfiguration gespeichert', { dojoId, is_active: updated?.is_active });

    res.json({
      success: true,
      verify_token: updated?.verify_token || ''
    });
  } catch (error) {
    logger.error('Messenger config PUT Fehler', { error: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// =====================================================================================
// 5. KONVERSATIONEN LADEN (GET) — Auth required
// =====================================================================================

router.get('/conversations', authenticateToken, async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo gefunden' });

  try {
    const hasFeature = await checkMessengerFeature(dojoId);
    if (!hasFeature) {
      return res.status(403).json({
        error: 'Messenger ist nicht im aktuellen Plan enthalten',
        required_plan: 'enterprise'
      });
    }

    const [conversations] = await pool.query(
      `SELECT mc.id, mc.psid, mc.fb_name, mc.chat_room_id, mc.last_message_at,
              (SELECT content FROM chat_messages
               WHERE room_id = mc.chat_room_id
               ORDER BY sent_at DESC LIMIT 1) as last_message,
              (SELECT sender_type FROM chat_messages
               WHERE room_id = mc.chat_room_id
               ORDER BY sent_at DESC LIMIT 1) as last_sender_type,
              (SELECT COUNT(*) FROM chat_messages cm
               WHERE cm.room_id = mc.chat_room_id
               AND cm.sender_type = 'messenger_user'
               AND cm.sent_at > COALESCE(
                 (SELECT last_seen_at FROM chat_room_members
                  WHERE room_id = mc.chat_room_id AND member_type = 'admin'
                  LIMIT 1),
                 '2000-01-01'
               )) as unread_count
       FROM messenger_conversations mc
       WHERE mc.dojo_id = ?
       ORDER BY mc.last_message_at DESC`,
      [dojoId]
    );

    // 24h-Fenster-Flag hinzufügen
    const now = new Date();
    const withWindow = conversations.map(conv => ({
      ...conv,
      window_open: conv.last_message_at
        ? (now - new Date(conv.last_message_at)) < 24 * 60 * 60 * 1000
        : false
    }));

    res.json({ success: true, conversations: withWindow });
  } catch (error) {
    logger.error('Messenger conversations GET Fehler', { error: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// =====================================================================================
// 6. ANTWORT SENDEN (POST) — Auth required
// =====================================================================================

router.post('/send', authenticateToken, async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo gefunden' });

  const { chat_room_id, text } = req.body;
  if (!chat_room_id || !text?.trim()) {
    return res.status(400).json({ error: 'chat_room_id und text erforderlich' });
  }

  try {
    const hasFeature = await checkMessengerFeature(dojoId);
    if (!hasFeature) {
      return res.status(403).json({
        error: 'Messenger ist nicht im aktuellen Plan enthalten',
        required_plan: 'enterprise'
      });
    }

    // Konversation + Config laden (Sicherheitscheck: room gehört zum Dojo)
    const [convRows] = await pool.query(
      `SELECT mc.psid, mc.fb_name, mc.last_message_at,
              dmc.page_token, dmc.is_active
       FROM messenger_conversations mc
       JOIN dojo_messenger_config dmc ON dmc.dojo_id = mc.dojo_id
       WHERE mc.chat_room_id = ? AND mc.dojo_id = ?`,
      [chat_room_id, dojoId]
    );

    if (convRows.length === 0) {
      return res.status(404).json({ error: 'Konversation nicht gefunden' });
    }

    const conv = convRows[0];

    if (!conv.is_active || !conv.page_token) {
      return res.status(400).json({ error: 'Messenger-Integration ist nicht aktiv oder konfiguriert' });
    }

    // 24h-Fenster prüfen
    const windowOpen = conv.last_message_at &&
      (Date.now() - new Date(conv.last_message_at).getTime()) < 24 * 60 * 60 * 1000;

    if (!windowOpen) {
      return res.status(400).json({
        error: '24-Stunden-Fenster abgelaufen. Nutzer muss zuerst eine neue Nachricht senden.',
        window_expired: true
      });
    }

    // Nachricht über Graph API senden
    await sendMessengerMessage(conv.page_token, conv.psid, text.trim());

    // Absender-Info aus JWT
    const userId = req.user.user_id || req.user.admin_id || req.user.id;
    const senderType = req.user.role === 'member' ? 'mitglied' :
                       req.user.role === 'trainer' ? 'trainer' : 'admin';

    // Nachricht lokal speichern
    const [msgResult] = await pool.query(
      `INSERT INTO chat_messages (room_id, sender_id, sender_type, content, sent_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [chat_room_id, userId, senderType, text.trim()]
    );

    // Socket.io Event
    const io = req.app.get('io');
    if (io) {
      io.to(`chat_room_${chat_room_id}`).emit('chat:message', {
        id: msgResult.insertId,
        room_id: chat_room_id,
        sender_id: userId,
        sender_type: senderType,
        content: text.trim(),
        sent_at: new Date().toISOString(),
        source: 'messenger_outgoing'
      });
    }

    logger.info('Messenger: Antwort gesendet', { dojoId, chat_room_id, psid: conv.psid });
    res.json({ success: true, message_id: msgResult.insertId });

  } catch (error) {
    logger.error('Messenger send POST Fehler', { error: error.message });
    res.status(500).json({ error: error.message || 'Serverfehler' });
  }
});

// =====================================================================================
// 7. TOKEN TESTEN (GET) — Auth required
// =====================================================================================

router.get('/test-token', authenticateToken, async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo gefunden' });

  try {
    const config = await getDojoConfig(dojoId);
    if (!config?.page_token) {
      return res.json({ valid: false, error: 'Kein Token konfiguriert' });
    }

    // Graph API testen
    await new Promise((resolve, reject) => {
      const url = new URL(`${GRAPH_API_BASE}/me`);
      url.searchParams.set('fields', 'name,id');
      url.searchParams.set('access_token', config.page_token);

      https.get(url.toString(), (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(parsed.error.message));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new Error('Ungültige Antwort'));
          }
        });
      }).on('error', reject);
    }).then((data) => {
      res.json({ valid: true, page_name: data.name, page_id: data.id });
    }).catch((err) => {
      res.json({ valid: false, error: err.message });
    });

  } catch (error) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// io-Instanz für Webhook-Handler setzen (wird in server.js aufgerufen)
router.setIo = (io) => {
  global.messengerIo = io;
};

module.exports = router;
