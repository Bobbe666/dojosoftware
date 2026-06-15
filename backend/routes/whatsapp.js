// =====================================================================================
// WHATSAPP ROUTES — WhatsApp Business Cloud API Integration (Enterprise Feature)
// =====================================================================================
// Analog zu messenger.js, aber für die WhatsApp Cloud API (Meta).
// GET  /api/whatsapp/webhook        → Meta Webhook-Verifizierung (Challenge-Response)
// POST /api/whatsapp/webhook        → Eingehende Nachrichten empfangen
// GET  /api/whatsapp/config         → Dojo-Konfiguration laden
// PUT  /api/whatsapp/config         → Dojo-Konfiguration speichern
// GET  /api/whatsapp/conversations  → Alle WhatsApp-Konversationen des Dojos
// POST /api/whatsapp/send           → Antwort senden via WhatsApp Cloud API
// GET  /api/whatsapp/test-token     → Zugang/Token testen

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');
const db = require('../db');
const pool = db.promise();
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h-Kundendienstfenster

// ─── WhatsApp Cloud API: Textnachricht senden ───────────────────────────────
function sendWhatsAppMessage(phoneNumberId, accessToken, toWaId, messageText) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toWaId,
      type: 'text',
      text: { preview_url: false, body: messageText },
    });

    const url = new URL(`${GRAPH_API_BASE}/${phoneNumberId}/messages`);
    const options = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
        } catch {
          reject(new Error('Ungültige API-Antwort'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── HMAC-Signatur prüfen (x-hub-signature-256) ─────────────────────────────
function verifySignature(appSecret, rawBody, signature) {
  if (!signature || !appSecret || !rawBody) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Feature-Gate (Enterprise / konfigurierte Subdomain) ────────────────────
async function checkWhatsAppFeature(dojoId) {
  const [rows] = await pool.query(
    `SELECT subdomain FROM dojo WHERE id = ? AND subdomain IS NOT NULL AND subdomain != ''`,
    [dojoId]
  );
  return rows.length > 0;
}

async function getDojoConfig(dojoId) {
  const [rows] = await pool.query(`SELECT * FROM dojo_whatsapp_config WHERE dojo_id = ?`, [dojoId]);
  return rows[0] || null;
}

// =====================================================================================
// 1. WEBHOOK VERIFIZIERUNG (GET) — Kein Auth, von Meta aufgerufen
// =====================================================================================
router.get('/webhook', async (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode !== 'subscribe') return res.status(400).json({ error: 'Ungültiger mode' });

  const [configs] = await pool.query(
    `SELECT dojo_id FROM dojo_whatsapp_config WHERE verify_token = ? AND is_active = 1`,
    [token]
  );
  if (configs.length === 0) {
    logger.warn('WhatsApp Webhook: Ungültiger verify_token');
    return res.status(403).send('Forbidden');
  }
  logger.info('WhatsApp Webhook verifiziert', { dojo_id: configs[0].dojo_id });
  res.send(challenge);
});

// =====================================================================================
// 2. EINGEHENDE NACHRICHTEN (POST) — Kein Auth, von Meta aufgerufen
// =====================================================================================
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Meta erwartet sofortige 200

  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return;
  const io = req.app.get('io');

  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      if (change.field !== 'messages') continue;
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // Dojo zu dieser Phone-Number-ID finden
      const [configs] = await pool.query(
        `SELECT * FROM dojo_whatsapp_config WHERE phone_number_id = ? AND is_active = 1`,
        [phoneNumberId]
      ).catch(() => [[]]);
      if (configs.length === 0) {
        logger.warn('WhatsApp Webhook: Unbekannte phone_number_id', { phoneNumberId });
        continue;
      }
      const config = configs[0];
      const dojoId = config.dojo_id;

      // Optionale HMAC-Validierung (req.rawBody wird global von express.json verify gesetzt)
      if (config.app_secret && req.rawBody) {
        if (!verifySignature(config.app_secret, req.rawBody, req.headers['x-hub-signature-256'])) {
          logger.warn('WhatsApp Webhook: HMAC-Signatur ungültig', { dojoId });
          continue;
        }
      }

      // Profilnamen aus contacts[] (wa_id → name)
      const nameByWaId = {};
      for (const c of (value.contacts || [])) {
        if (c.wa_id) nameByWaId[c.wa_id] = c.profile?.name || null;
      }

      for (const msg of (value.messages || [])) {
        if (msg.type !== 'text' || !msg.text?.body) continue; // vorerst nur Text
        const waId = msg.from;
        const text = msg.text.body;
        const waName = nameByWaId[waId] || 'WhatsApp-Nutzer';
        try {
          await handleIncomingMessage(dojoId, waId, waName, text, io);
        } catch (err) {
          logger.error('WhatsApp: Fehler bei Nachrichtenverarbeitung', { dojoId, waId, error: err.message });
        }
      }
    }
  }
});

async function handleIncomingMessage(dojoId, waId, waName, text, io) {
  // 1. Existierende Konversation suchen
  const [convRows] = await pool.query(
    `SELECT chat_room_id FROM whatsapp_conversations WHERE dojo_id = ? AND wa_id = ?`,
    [dojoId, waId]
  );

  let chatRoomId;
  if (convRows.length > 0) {
    chatRoomId = convRows[0].chat_room_id;
    await pool.query(
      `UPDATE whatsapp_conversations
         SET last_message_at = NOW(), window_expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR),
             wa_name = COALESCE(?, wa_name)
       WHERE dojo_id = ? AND wa_id = ?`,
      [waName, dojoId, waId]
    );
  } else {
    const [roomResult] = await pool.query(
      `INSERT INTO chat_rooms (name, type, source, external_id, dojo_id, created_by_id, created_by_type)
       VALUES (?, 'direct', 'whatsapp', ?, ?, NULL, NULL)`,
      [waName, waId, dojoId]
    );
    chatRoomId = roomResult.insertId;
    await pool.query(
      `INSERT INTO whatsapp_conversations (dojo_id, wa_id, wa_name, chat_room_id, last_message_at, window_expires_at)
       VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [dojoId, waId, waName, chatRoomId]
    );
  }

  // 2. Nachricht speichern
  const [msgResult] = await pool.query(
    `INSERT INTO chat_messages (room_id, sender_id, sender_type, content, sent_at)
     VALUES (?, ?, 'whatsapp_user', ?, NOW())`,
    [chatRoomId, waId, text]
  );

  // 3. Socket.io Event (Admin sieht Nachricht in Echtzeit)
  const ioInstance = io || global.messengerIo;
  if (ioInstance) {
    ioInstance.to(`chat_room_${chatRoomId}`).emit('chat:message', {
      id: msgResult.insertId,
      room_id: chatRoomId,
      sender_id: waId,
      sender_type: 'whatsapp_user',
      sender_name: waName,
      content: text,
      sent_at: new Date().toISOString(),
      source: 'whatsapp',
    });
  }
  logger.info('WhatsApp: Nachricht gespeichert', { dojoId, waId, chatRoomId });
}

// =====================================================================================
// 3. KONFIGURATION LADEN (GET) — Auth required
// =====================================================================================
router.get('/config', authenticateToken, async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo gefunden' });
  try {
    if (!(await checkWhatsAppFeature(dojoId))) {
      return res.status(403).json({ error: 'WhatsApp ist nicht im aktuellen Plan enthalten', required_plan: 'enterprise' });
    }
    const config = await getDojoConfig(dojoId);
    if (!config) {
      return res.json({ configured: false, phone_number_id: '', waba_id: '', access_token: '', app_secret: '', verify_token: '', display_number: '', is_active: false });
    }
    res.json({
      configured: true,
      phone_number_id: config.phone_number_id || '',
      waba_id: config.waba_id || '',
      access_token: config.access_token ? `${config.access_token.substring(0, 8)}…` : '',
      app_secret: config.app_secret ? '••••••••' : '',
      verify_token: config.verify_token || '',
      display_number: config.display_number || '',
      is_active: !!config.is_active,
    });
  } catch (error) {
    logger.error('WhatsApp config GET Fehler', { error: error.message });
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
    if (!(await checkWhatsAppFeature(dojoId))) {
      return res.status(403).json({ error: 'WhatsApp ist nicht im aktuellen Plan enthalten', required_plan: 'enterprise' });
    }
    const { phone_number_id, waba_id, access_token, app_secret, display_number, is_active } = req.body;
    const existing = await getDojoConfig(dojoId);

    if (existing) {
      const updates = { is_active: is_active ? 1 : 0 };
      if (phone_number_id !== undefined) updates.phone_number_id = phone_number_id || null;
      if (waba_id !== undefined) updates.waba_id = waba_id || null;
      if (display_number !== undefined) updates.display_number = display_number || null;
      // Secrets nur überschreiben, wenn echter (nicht maskierter) Wert kommt
      if (access_token && !access_token.includes('…')) updates.access_token = access_token || null;
      if (app_secret && app_secret !== '••••••••') updates.app_secret = app_secret || null;

      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await pool.query(
        `UPDATE dojo_whatsapp_config SET ${setClauses}, updated_at = NOW() WHERE dojo_id = ?`,
        [...Object.values(updates), dojoId]
      );
    } else {
      const verifyToken = crypto.randomBytes(20).toString('hex');
      await pool.query(
        `INSERT INTO dojo_whatsapp_config (dojo_id, phone_number_id, waba_id, access_token, app_secret, verify_token, display_number, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [dojoId, phone_number_id || null, waba_id || null, access_token || null, app_secret || null, verifyToken, display_number || null, is_active ? 1 : 0]
      );
    }
    const updated = await getDojoConfig(dojoId);
    logger.info('WhatsApp-Konfiguration gespeichert', { dojoId, is_active: updated?.is_active });
    res.json({ success: true, verify_token: updated?.verify_token || '' });
  } catch (error) {
    logger.error('WhatsApp config PUT Fehler', { error: error.message });
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
    if (!(await checkWhatsAppFeature(dojoId))) {
      return res.status(403).json({ error: 'WhatsApp ist nicht im aktuellen Plan enthalten', required_plan: 'enterprise' });
    }
    const [conversations] = await pool.query(
      `SELECT wc.id, wc.wa_id, wc.wa_name, wc.chat_room_id, wc.last_message_at, wc.window_expires_at,
              (SELECT content FROM chat_messages WHERE room_id = wc.chat_room_id ORDER BY sent_at DESC LIMIT 1) as last_message,
              (SELECT sender_type FROM chat_messages WHERE room_id = wc.chat_room_id ORDER BY sent_at DESC LIMIT 1) as last_sender_type,
              (SELECT COUNT(*) FROM chat_messages cm
                 WHERE cm.room_id = wc.chat_room_id AND cm.sender_type = 'whatsapp_user'
                 AND cm.sent_at > COALESCE(
                   (SELECT last_seen_at FROM chat_room_members WHERE room_id = wc.chat_room_id AND member_type = 'admin' LIMIT 1),
                   '2000-01-01')) as unread_count
       FROM whatsapp_conversations wc
       WHERE wc.dojo_id = ?
       ORDER BY wc.last_message_at DESC`,
      [dojoId]
    );
    const now = Date.now();
    const withWindow = conversations.map(conv => ({
      ...conv,
      window_open: conv.last_message_at ? (now - new Date(conv.last_message_at).getTime()) < WINDOW_MS : false,
    }));
    res.json({ success: true, conversations: withWindow });
  } catch (error) {
    logger.error('WhatsApp conversations GET Fehler', { error: error.message });
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
  if (!chat_room_id || !text?.trim()) return res.status(400).json({ error: 'chat_room_id und text erforderlich' });

  try {
    if (!(await checkWhatsAppFeature(dojoId))) {
      return res.status(403).json({ error: 'WhatsApp ist nicht im aktuellen Plan enthalten', required_plan: 'enterprise' });
    }
    const [convRows] = await pool.query(
      `SELECT wc.wa_id, wc.last_message_at, wcfg.phone_number_id, wcfg.access_token, wcfg.is_active
         FROM whatsapp_conversations wc
         JOIN dojo_whatsapp_config wcfg ON wcfg.dojo_id = wc.dojo_id
        WHERE wc.chat_room_id = ? AND wc.dojo_id = ?`,
      [chat_room_id, dojoId]
    );
    if (convRows.length === 0) return res.status(404).json({ error: 'Konversation nicht gefunden' });
    const conv = convRows[0];

    if (!conv.is_active || !conv.phone_number_id || !conv.access_token) {
      return res.status(400).json({ error: 'WhatsApp-Integration ist nicht aktiv oder konfiguriert' });
    }

    // 24h-Fenster (außerhalb erlaubt WhatsApp nur genehmigte Templates, kein Freitext)
    const windowOpen = conv.last_message_at && (Date.now() - new Date(conv.last_message_at).getTime()) < WINDOW_MS;
    if (!windowOpen) {
      return res.status(400).json({ error: '24-Stunden-Fenster abgelaufen. Außerhalb sind nur genehmigte Vorlagen erlaubt.', window_expired: true });
    }

    await sendWhatsAppMessage(conv.phone_number_id, conv.access_token, conv.wa_id, text.trim());

    const userId = req.user.user_id || req.user.admin_id || req.user.id;
    const senderType = req.user.role === 'member' ? 'mitglied' : req.user.role === 'trainer' ? 'trainer' : 'admin';
    const [msgResult] = await pool.query(
      `INSERT INTO chat_messages (room_id, sender_id, sender_type, content, sent_at) VALUES (?, ?, ?, ?, NOW())`,
      [chat_room_id, userId, senderType, text.trim()]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`chat_room_${chat_room_id}`).emit('chat:message', {
        id: msgResult.insertId, room_id: chat_room_id, sender_id: userId, sender_type: senderType,
        content: text.trim(), sent_at: new Date().toISOString(), source: 'whatsapp_outgoing',
      });
    }
    logger.info('WhatsApp: Antwort gesendet', { dojoId, chat_room_id, waId: conv.wa_id });
    res.json({ success: true, message_id: msgResult.insertId });
  } catch (error) {
    logger.error('WhatsApp send POST Fehler', { error: error.message });
    res.status(500).json({ error: error.message || 'Serverfehler' });
  }
});

// =====================================================================================
// 7. ZUGANG TESTEN (GET) — Auth required: prüft Phone-Number-ID + Token via Graph API
// =====================================================================================
router.get('/test-token', authenticateToken, async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo gefunden' });
  try {
    const config = await getDojoConfig(dojoId);
    if (!config?.phone_number_id || !config?.access_token) {
      return res.json({ valid: false, error: 'Phone-Number-ID oder Token fehlt' });
    }
    const result = await new Promise((resolve) => {
      const url = new URL(`${GRAPH_API_BASE}/${config.phone_number_id}`);
      url.searchParams.set('fields', 'display_phone_number,verified_name,quality_rating');
      const opts = { method: 'GET', hostname: url.hostname, path: url.pathname + url.search, headers: { 'Authorization': `Bearer ${config.access_token}` } };
      const r = https.request(opts, (resp) => {
        let data = ''; resp.on('data', c => data += c);
        resp.on('end', () => { try { const p = JSON.parse(data); resolve(resp.statusCode < 300 ? { valid: true, info: p } : { valid: false, error: p.error?.message || `HTTP ${resp.statusCode}` }); } catch { resolve({ valid: false, error: 'Ungültige Antwort' }); } });
      });
      r.on('error', (e) => resolve({ valid: false, error: e.message }));
      r.end();
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

module.exports = router;
