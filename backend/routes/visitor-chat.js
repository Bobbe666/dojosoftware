// =============================================
// VISITOR CHAT ROUTES
// Besucher-Chat Widget für TDA-Websites
// =============================================
// Öffentliche Endpunkte: Widget-JS, Session erstellen, Besucher-Nachrichten
// Auth-Endpunkte:        Staff-Antworten, Session-Verwaltung (JWT required)
// =============================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const webpush = require('web-push');
const { sendEmailForDojo } = require('../services/emailService');

const pool = db.promise();

// VAPID konfigurieren (nur wenn Keys vorhanden)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ─── E-Mail-Benachrichtigung an Besucher ──────────────────────────────────────
async function sendVisitorReplyEmail(session, staffName, replyText) {
  const visitorName = session.visitor_name || 'Besucher';
  const dojoId = session.dojo_id || null;

  // Dojo-Name laden für Absender
  let dojoName = 'TDA';
  if (dojoId) {
    try {
      const [[dojo]] = await pool.query('SELECT dojoname FROM dojo WHERE id = ?', [dojoId]);
      if (dojo?.dojoname) dojoName = dojo.dojoname;
    } catch (_) { /* ignore */ }
  }

  const subject = `Antwort auf deine Chat-Nachricht – ${dojoName}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1a1a2e;padding:24px 28px">
      <h2 style="color:#fff;margin:0;font-size:1.1rem">${dojoName}</h2>
      <p style="color:#aaa;margin:4px 0 0;font-size:0.85rem">Chat-Benachrichtigung</p>
    </div>
    <div style="padding:28px">
      <p style="color:#333;margin:0 0 16px">Hallo ${visitorName},</p>
      <p style="color:#333;margin:0 0 16px">${staffName} hat auf deine Chat-Nachricht geantwortet:</p>
      <div style="background:#f0f4ff;border-left:4px solid #3b6ff0;border-radius:4px;padding:14px 18px;margin:0 0 20px">
        <p style="color:#1a1a2e;margin:0;white-space:pre-wrap">${replyText.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
      </div>
      <p style="color:#666;font-size:0.85rem;margin:0">
        Du kannst direkt auf diese E-Mail antworten oder die Website erneut besuchen, um den Chat fortzuführen.
      </p>
    </div>
    <div style="background:#f9fafb;padding:14px 28px;border-top:1px solid #eee">
      <p style="color:#999;font-size:0.75rem;margin:0">${dojoName} · Diese E-Mail wurde automatisch versandt, bitte antworte nicht direkt darauf.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Hallo ${visitorName},\n\n${staffName} hat auf deine Chat-Nachricht geantwortet:\n\n${replyText}\n\n-- ${dojoName}`;

  await sendEmailForDojo({ to: session.visitor_email, subject, html, text }, dojoId);
  logger.info('✅ Visitor-Chat E-Mail gesendet', { to: session.visitor_email, sessionId: session.id });
}

// ─── CORS-Helper (für eingebettetes Widget auf externen Sites) ─────────────────
function setPublicCors(res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  // Erlaube Cross-Origin-Lesezugriff (nginx setzt global same-origin, das muss überschrieben werden)
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
}

router.options('*', (req, res) => {
  setPublicCors(res);
  res.sendStatus(200);
});

// ─── Push-Notification an Dojo-Staff senden ────────────────────────────────────
async function pushToStaff(dojoId, payload) {
  try {
    let adminIds;
    if (dojoId) {
      // Alle aktiven Admins des Dojos + alle Super-Admins
      const [dojoRows] = await pool.query(
        `SELECT id FROM admin_users WHERE dojo_id = ? AND aktiv = 1`,
        [dojoId]
      );
      const [superRows] = await pool.query(
        `SELECT id FROM admin_users WHERE rolle = 'super_admin' AND aktiv = 1`
      );
      const dojoIds = dojoRows.map(r => r.id);
      const superIds = superRows.map(r => r.id);
      // Deduplizieren (falls Super-Admin auch dojo_id hat)
      adminIds = [...new Set([...dojoIds, ...superIds])];
    } else {
      // Alle aktiven Super-Admins
      const [rows] = await pool.query(
        `SELECT id FROM admin_users WHERE rolle = 'super_admin' AND aktiv = 1`
      );
      adminIds = rows.map(r => r.id);
    }

    if (!adminIds || adminIds.length === 0) return;

    const [subscriptions] = await pool.query(
      `SELECT endpoint, p256dh_key, auth_key
       FROM push_subscriptions
       WHERE user_id IN (?) AND is_active = TRUE`,
      [adminIds]
    );

    const pushPayloadStr = JSON.stringify(payload);

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          pushPayloadStr
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query(
            `UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = ?`,
            [sub.endpoint]
          );
        } else {
          logger.warn('VisitorChat Push fehlgeschlagen', { error: err.message });
        }
      }
    }
  } catch (err) {
    logger.error('pushToStaff Fehler', { error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WIDGET JS – Einbettbares Chat-Widget für externe Websites
// GET /api/visitor-chat/widget.js
// ─────────────────────────────────────────────────────────────────────────────
router.get('/widget.js', (req, res) => {
  setPublicCors(res);
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  // Erlaube Laden von externen Sites (widget.js ist bewusst cross-origin)
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // API-Basis-URL ableiten (vom eigenen Server, der das Widget ausliefert)
  const apiBase = `${req.protocol}://${req.get('host')}/api/visitor-chat`;

  const widgetCode = `
(function() {
  'use strict';

  // ── Konfiguration aus data-Attributen lesen ─────────────────────────────────
  var thisScript = null;
  var scripts = document.querySelectorAll('script[src*="visitor-chat/widget.js"]');
  if (scripts.length > 0) {
    thisScript = scripts[0];
  } else {
    // Fallback: letztes Script-Element
    var allScripts = document.querySelectorAll('script');
    thisScript = allScripts[allScripts.length - 1];
  }
  var dojoId   = thisScript ? (thisScript.getAttribute('data-dojo-id') || null) : null;
  var sourceSite = (thisScript ? thisScript.getAttribute('data-site') : null) || window.location.hostname;
  if (dojoId === 'null' || dojoId === '') dojoId = null;

  var API_BASE = '${apiBase}';
  var SESSION_KEY = 'vc_session_' + (dojoId || 'super');
  var POLL_INTERVAL = 4000; // ms

  // ── State ───────────────────────────────────────────────────────────────────
  var sessionToken = sessionStorage.getItem(SESSION_KEY);
  var pollTimer = null;
  var lastMsgId = 0;
  var isOpen = false;

  // ── CSS (vollständig inline, kein Konflikt mit Website-CSS) ─────────────────
  var css = \`
    #vc-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #b8860b, #8B6914);
      color: #fff;
      border: none;
      cursor: pointer;
      z-index: 99997;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      transition: transform .2s, box-shadow .2s;
    }
    #vc-btn:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.45); }
    #vc-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #e53e3e;
      color: #fff;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      font-size: 11px;
      font-weight: 700;
      display: none;
      align-items: center;
      justify-content: center;
    }
    #vc-panel {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 340px;
      max-width: calc(100vw - 48px);
      height: 480px;
      max-height: calc(100vh - 120px);
      background: #1a1a2e;
      border: 1px solid rgba(184,134,11,0.3);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      z-index: 99998;
      display: none;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
      color: #e2e8f0;
    }
    #vc-panel.vc-open { display: flex; }
    #vc-header {
      background: linear-gradient(135deg, #b8860b, #8B6914);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #vc-header-avatar {
      width: 36px; height: 36px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
    #vc-header-text { flex: 1; }
    #vc-header-title { font-weight: 700; font-size: 15px; color: #fff; margin: 0; }
    #vc-header-sub { font-size: 12px; color: rgba(255,255,255,0.8); margin: 0; }
    #vc-close {
      background: none; border: none; color: #fff; cursor: pointer;
      font-size: 18px; padding: 4px; opacity: 0.8;
    }
    #vc-close:hover { opacity: 1; }
    #vc-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
    #vc-form {
      padding: 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; justify-content: center;
    }
    #vc-form h4 { margin: 0 0 4px; font-size: 15px; color: #e2e8f0; }
    #vc-form p { margin: 0 0 8px; font-size: 13px; color: #94a3b8; }
    .vc-input {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(184,134,11,0.3);
      border-radius: 8px;
      padding: 10px 12px;
      color: #e2e8f0;
      font-size: 14px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .vc-input:focus { border-color: #b8860b; background: rgba(255,255,255,0.1); }
    .vc-input::placeholder { color: #64748b; }
    .vc-btn-primary {
      background: linear-gradient(135deg, #b8860b, #8B6914);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 11px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .2s;
    }
    .vc-btn-primary:hover { opacity: 0.9; }
    .vc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    #vc-messages {
      flex: 1; overflow-y: auto; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 8px;
    }
    #vc-messages::-webkit-scrollbar { width: 4px; }
    #vc-messages::-webkit-scrollbar-thumb { background: rgba(184,134,11,0.3); border-radius: 2px; }
    .vc-msg {
      max-width: 80%; padding: 8px 12px;
      border-radius: 12px; font-size: 13px; line-height: 1.4;
      word-break: break-word;
    }
    .vc-msg-visitor {
      align-self: flex-end;
      background: linear-gradient(135deg, #b8860b, #8B6914);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .vc-msg-staff {
      align-self: flex-start;
      background: rgba(255,255,255,0.08);
      color: #e2e8f0;
      border-bottom-left-radius: 4px;
    }
    .vc-msg-name { font-size: 11px; opacity: 0.7; margin-bottom: 2px; }
    .vc-msg-time { font-size: 10px; opacity: 0.5; margin-top: 3px; text-align: right; }
    #vc-empty { text-align: center; color: #64748b; font-size: 13px; margin: auto; padding: 20px; }
    #vc-input-row {
      display: flex; gap: 8px; padding: 10px 14px;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    #vc-text {
      flex: 1;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(184,134,11,0.25);
      border-radius: 8px;
      padding: 9px 12px;
      color: #e2e8f0;
      font-size: 13px;
      outline: none;
      resize: none;
    }
    #vc-text:focus { border-color: #b8860b; }
    #vc-send {
      background: #b8860b; color: #fff; border: none;
      border-radius: 8px; padding: 0 14px; cursor: pointer; font-size: 18px;
      flex-shrink: 0; transition: opacity .2s;
    }
    #vc-send:hover { opacity: 0.85; }
    #vc-send:disabled { opacity: 0.4; cursor: not-allowed; }
    #vc-error { color: #fc8181; font-size: 12px; text-align: center; padding: 4px; }
  \`;

  // ── Initialisierung (mit DOMContentLoaded-Fallback) ─────────────────────────
  function initWidget() {
    if (document.getElementById('vc-btn')) return; // Bereits initialisiert

    // ── Styles injizieren ─────────────────────────────────────────────────────
    var styleEl = document.createElement('style');
    styleEl.id = 'vc-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ── DOM aufbauen ──────────────────────────────────────────────────────────
    document.body.insertAdjacentHTML('beforeend', \`
    <button id="vc-btn" title="Chat mit uns" aria-label="Chat öffnen">
      💬
      <span id="vc-badge"></span>
    </button>
    <div id="vc-panel" role="dialog" aria-label="Live-Chat" aria-modal="true">
      <div id="vc-header">
        <div id="vc-header-avatar">🥋</div>
        <div id="vc-header-text">
          <div id="vc-header-title">Live-Chat</div>
          <div id="vc-header-sub">Wir antworten so schnell wie möglich</div>
        </div>
        <button id="vc-close" aria-label="Chat schließen">✕</button>
      </div>
      <div id="vc-body">
        <div id="vc-form">
          <h4>Schreib uns!</h4>
          <p>Bitte gib deinen Namen und deine E-Mail an, damit wir dir antworten können.</p>
          <input id="vc-name" class="vc-input" type="text" placeholder="Dein Name *" maxlength="100" />
          <input id="vc-email" class="vc-input" type="email" placeholder="Deine E-Mail *" maxlength="255" />
          <div id="vc-error" style="display:none"></div>
          <button id="vc-start" class="vc-btn-primary">Chat starten</button>
        </div>
      </div>
    </div>
  \`);

  // ── Elemente referenzieren ──────────────────────────────────────────────────
  var btn    = document.getElementById('vc-btn');
  var badge  = document.getElementById('vc-badge');
  var panel  = document.getElementById('vc-panel');
  var body   = document.getElementById('vc-body');
  var closeB = document.getElementById('vc-close');

  // ── Hilfsfunktionen ─────────────────────────────────────────────────────────
  function fmtTime(ts) {
    var d = new Date(ts);
    return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }

  function post(url, data) {
    return fetch(API_BASE + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r) { return r.json(); });
  }

  function get(url) {
    return fetch(API_BASE + url).then(function(r) { return r.json(); });
  }

  function showError(msg) {
    var el = document.getElementById('vc-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideError() {
    var el = document.getElementById('vc-error');
    if (el) el.style.display = 'none';
  }

  function appendMsg(msg) {
    var msgs = document.getElementById('vc-messages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'vc-msg vc-msg-' + msg.sender_type;
    var nameHtml = msg.sender_type === 'staff'
      ? '<div class="vc-msg-name">' + (msg.sender_name || 'Team') + '</div>'
      : '';
    div.innerHTML = nameHtml
      + '<div>' + msg.message.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>') + '</div>'
      + '<div class="vc-msg-time">' + fmtTime(msg.created_at) + '</div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    if (msg.id > lastMsgId) lastMsgId = msg.id;
  }

  // ── Chat-UI aufbauen (nach erfolgreichem Session-Start) ────────────────────
  function buildChatUI() {
    body.innerHTML = \`
      <div id="vc-messages"><div id="vc-empty">Noch keine Nachrichten. Schreib uns!</div></div>
      <div id="vc-input-row">
        <textarea id="vc-text" rows="1" placeholder="Deine Nachricht..." maxlength="2000"></textarea>
        <button id="vc-send">➤</button>
      </div>
    \`;

    document.getElementById('vc-send').addEventListener('click', sendMsg);
    document.getElementById('vc-text').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });

    if (isOpen) startPolling();
    loadMessages();
  }

  function sendMsg() {
    var txt = document.getElementById('vc-text');
    var msg = (txt.value || '').trim();
    if (!msg || !sessionToken) return;
    var send = document.getElementById('vc-send');
    send.disabled = true;
    txt.value = '';

    post('/sessions/' + sessionToken + '/messages', { message: msg })
      .then(function(data) {
        if (data.success && data.message) {
          appendMsg(data.message);
        }
      })
      .catch(function() {})
      .finally(function() { send.disabled = false; });
  }

  function loadMessages() {
    if (!sessionToken) return;
    get('/sessions/' + sessionToken + '/messages?after=' + lastMsgId)
      .then(function(data) {
        if (!data.success) return;
        var msgs = data.messages || [];
        if (msgs.length > 0) {
          var empty = document.getElementById('vc-empty');
          if (empty) empty.remove();
          msgs.forEach(appendMsg);
          // Badge zurücksetzen wenn Panel offen
          if (isOpen) {
            badge.style.display = 'none';
          }
        }
      })
      .catch(function() {});
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(function() {
      loadMessages();
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ── Session aus Storage laden (Seite neu geladen) ───────────────────────────
  function tryRestoreSession() {
    if (!sessionToken) return;
    buildChatUI();
  }

  // ── Event Listeners ─────────────────────────────────────────────────────────
  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    if (isOpen) {
      // sessionStorage nochmal prüfen (z.B. nach Probetraining-Formular-Submit)
      if (!sessionToken) {
        var stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) { sessionToken = stored; buildChatUI(); }
      }
      panel.classList.add('vc-open');
      badge.style.display = 'none';
      btn.innerHTML = '✕<span id="vc-badge"></span>';
      if (sessionToken) startPolling();
    } else {
      panel.classList.remove('vc-open');
      stopPolling();
      btn.innerHTML = '💬<span id="vc-badge"></span>';
    }
    badge = document.getElementById('vc-badge');
  });

  closeB.addEventListener('click', function() {
    isOpen = false;
    panel.classList.remove('vc-open');
    stopPolling();
    btn.innerHTML = '💬<span id="vc-badge"></span>';
    badge = document.getElementById('vc-badge');
  });

  // ── Session starten (Formular) ───────────────────────────────────────────────
  var startBtn = document.getElementById('vc-start');
  if (startBtn) {
    startBtn.addEventListener('click', function() {
      var name  = (document.getElementById('vc-name').value || '').trim();
      var email = (document.getElementById('vc-email').value || '').trim();
      hideError();

      if (!name) { showError('Bitte gib deinen Namen ein.'); return; }
      if (!email || !/^[^@]+@[^@]+\\.[^@]+$/.test(email)) {
        showError('Bitte gib eine gültige E-Mail-Adresse ein.');
        return;
      }

      startBtn.disabled = true;
      startBtn.textContent = 'Wird gestartet…';

      post('/sessions', {
        visitor_name: name,
        visitor_email: email,
        dojo_id: dojoId ? parseInt(dojoId) : null,
        source_site: sourceSite
      }).then(function(data) {
        if (!data.success) {
          showError(data.error || 'Fehler beim Starten des Chats.');
          startBtn.disabled = false;
          startBtn.textContent = 'Chat starten';
          return;
        }
        sessionToken = data.visitor_token;
        sessionStorage.setItem(SESSION_KEY, sessionToken);
        buildChatUI();
      }).catch(function() {
        showError('Verbindungsfehler. Bitte versuche es erneut.');
        startBtn.disabled = false;
        startBtn.textContent = 'Chat starten';
      });
    });
  }

  // ── Gespeicherte Session wiederherstellen ───────────────────────────────────
  tryRestoreSession();

  // ── Globale API für externe Seiten (z.B. Probetraining-Formular) ────────────
  window.VCWidget = {
    openWithSession: function(token) {
      if (!token) return;
      try {
        sessionToken = token;
        sessionStorage.setItem(SESSION_KEY, token);
        buildChatUI();
        if (!isOpen) {
          isOpen = true;
          panel.classList.add('vc-open');
          btn.innerHTML = '✕<span id="vc-badge"></span>';
          badge = document.getElementById('vc-badge');
        }
        startPolling();
        loadMessages();
      } catch(e) {}
    }
  };

  } // Ende initWidget()

  // ── Widget starten: sofort oder nach DOMContentLoaded ───────────────────────
  function safeInit() {
    try { initWidget(); } catch(e) { /* Widget-Fehler still ignorieren */ }
  }
  if (document.body) {
    safeInit();
  } else {
    document.addEventListener('DOMContentLoaded', safeInit);
  }

})();
`;

  res.send(widgetCode);
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Session erstellen
// POST /api/visitor-chat/sessions
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sessions', async (req, res) => {
  setPublicCors(res);
  const { visitor_name, visitor_email, dojo_id, source_site } = req.body;

  if (!visitor_name || !visitor_name.trim()) {
    return res.status(400).json({ success: false, error: 'Name ist erforderlich' });
  }
  if (!visitor_email || !/^[^@]+@[^@]+\.[^@]+$/.test(visitor_email.trim())) {
    return res.status(400).json({ success: false, error: 'Gültige E-Mail erforderlich' });
  }

  try {
    const visitor_token = crypto.randomBytes(32).toString('hex');
    const finalDojoId = dojo_id ? parseInt(dojo_id) : null;

    await pool.query(
      `INSERT INTO visitor_chat_sessions (dojo_id, source_site, visitor_name, visitor_email, visitor_token)
       VALUES (?, ?, ?, ?, ?)`,
      [finalDojoId, source_site || null, visitor_name.trim(), visitor_email.trim().toLowerCase(), visitor_token]
    );

    const [[session]] = await pool.query(
      `SELECT id FROM visitor_chat_sessions WHERE visitor_token = ?`,
      [visitor_token]
    );

    logger.info('Neue Besucher-Chat-Session', {
      dojo_id: finalDojoId, source_site, visitor_name: visitor_name.trim()
    });

    // Socket.io: Staff informieren
    const io = req.app.get('io');
    if (io) {
      const room = finalDojoId ? `visitor-dojo:${finalDojoId}` : 'visitor-super-admin';
      io.to(room).emit('visitor-chat:new-session', {
        sessionId: session.id,
        visitor_name: visitor_name.trim(),
        source_site,
        dojo_id: finalDojoId
      });
    }

    // Push-Notification an Staff
    await pushToStaff(finalDojoId, {
      title: '💬 Neue Besucher-Anfrage',
      body: `${visitor_name.trim()} möchte chatten (${source_site || 'Website'})`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/dashboard/besucher-chat' }
    });

    res.json({ success: true, visitor_token, session_id: session.id });
  } catch (err) {
    logger.error('Fehler beim Erstellen der Besucher-Session', { error: err.message });
    res.status(500).json({ success: false, error: 'Interner Fehler' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Nachrichten laden (Besucher pollt)
// GET /api/visitor-chat/sessions/:token/messages?after=ID
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sessions/:token/messages', async (req, res) => {
  setPublicCors(res);
  const { token } = req.params;
  const afterId = parseInt(req.query.after) || 0;

  try {
    const [[session]] = await pool.query(
      `SELECT id FROM visitor_chat_sessions WHERE visitor_token = ?`,
      [token]
    );
    if (!session) return res.status(404).json({ success: false, error: 'Session nicht gefunden' });

    const [messages] = await pool.query(
      `SELECT id, sender_type, sender_name, message, created_at
       FROM visitor_chat_messages
       WHERE session_id = ? AND id > ?
       ORDER BY id ASC
       LIMIT 50`,
      [session.id, afterId]
    );

    res.json({ success: true, messages });
  } catch (err) {
    logger.error('Fehler beim Laden der Besucher-Nachrichten', { error: err.message });
    res.status(500).json({ success: false, error: 'Interner Fehler' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Nachricht senden (Besucher)
// POST /api/visitor-chat/sessions/:token/messages
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sessions/:token/messages', async (req, res) => {
  setPublicCors(res);
  const { token } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Nachricht darf nicht leer sein' });
  }

  try {
    const [[session]] = await pool.query(
      `SELECT id, dojo_id, visitor_name, source_site, status FROM visitor_chat_sessions WHERE visitor_token = ?`,
      [token]
    );
    if (!session) return res.status(404).json({ success: false, error: 'Session nicht gefunden' });
    if (session.status === 'closed') {
      return res.status(400).json({ success: false, error: 'Diese Chat-Session wurde geschlossen' });
    }

    const [insertResult] = await pool.query(
      `INSERT INTO visitor_chat_messages (session_id, sender_type, sender_name, message)
       VALUES (?, 'visitor', ?, ?)`,
      [session.id, session.visitor_name, message.trim()]
    );

    // Session auf 'active' setzen wenn noch 'open'
    if (session.status === 'open') {
      await pool.query(
        `UPDATE visitor_chat_sessions SET status = 'active' WHERE id = ?`,
        [session.id]
      );
    }

    const [[newMsg]] = await pool.query(
      `SELECT id, sender_type, sender_name, message, created_at
       FROM visitor_chat_messages WHERE id = ?`,
      [insertResult.insertId]
    );

    // Socket.io: Staff in Echtzeit benachrichtigen
    const io = req.app.get('io');
    if (io) {
      const room = session.dojo_id ? `visitor-dojo:${session.dojo_id}` : 'visitor-super-admin';
      io.to(room).emit('visitor-chat:new-message', {
        sessionId: session.id,
        message: newMsg,
        visitor_name: session.visitor_name,
        source_site: session.source_site
      });
    }

    // Push nur bei erster Nachricht ODER wenn keine Socket-Verbindung zum Staff
    const pushPayload = {
      title: `💬 ${session.visitor_name}`,
      body: message.trim().length > 80 ? message.trim().substring(0, 80) + '…' : message.trim(),
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/dashboard/besucher-chat', session_id: session.id }
    };
    await pushToStaff(session.dojo_id, pushPayload);

    res.json({ success: true, message: newMsg });
  } catch (err) {
    logger.error('Fehler beim Senden der Besucher-Nachricht', { error: err.message });
    res.status(500).json({ success: false, error: 'Interner Fehler' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH: Sessions auflisten (Staff)
// GET /api/visitor-chat/sessions?status=open&site=...
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sessions', authenticateToken, async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { status, site } = req.query;

  let whereClauses = [];
  let params = [];

  // Dojo-Filter
  if (secureDojoId) {
    whereClauses.push('vcs.dojo_id = ?');
    params.push(secureDojoId);
  }
  // Super-Admin ohne dojo_id-Filter sieht ALLE Sessions (plattformweit)

  if (status) {
    // Mehrere Status kommagetrennt erlaubt, z.B. ?status=open,active,archived
    const allowedStatuses = ['open','active','closed','archived'];
    const requested = status.split(',').map(s => s.trim()).filter(s => allowedStatuses.includes(s));
    if (requested.length > 0) {
      whereClauses.push(`vcs.status IN (${requested.map(() => '?').join(',')})`);
      params.push(...requested);
    }
  } else {
    // Standard: keine archivierten anzeigen
    whereClauses.push("vcs.status != 'archived'");
  }
  if (site) {
    whereClauses.push('vcs.source_site = ?');
    params.push(site);
  }

  const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  try {
    const [sessions] = await pool.query(
      `SELECT
         vcs.id, vcs.dojo_id, vcs.source_site, vcs.visitor_name, vcs.visitor_email,
         vcs.status, vcs.pinned, vcs.created_at, vcs.updated_at,
         (SELECT COUNT(*) FROM visitor_chat_messages vcm WHERE vcm.session_id = vcs.id) AS message_count,
         (SELECT COUNT(*) FROM visitor_chat_messages vcm WHERE vcm.session_id = vcs.id AND vcm.sender_type = 'visitor' AND vcm.read_at IS NULL) AS unread_count,
         (SELECT vcm2.message FROM visitor_chat_messages vcm2 WHERE vcm2.session_id = vcs.id ORDER BY vcm2.id DESC LIMIT 1) AS last_message
       FROM visitor_chat_sessions vcs
       ${where}
       ORDER BY vcs.pinned DESC, vcs.updated_at DESC
       LIMIT 100`,
      params
    );

    res.json({ success: true, sessions });
  } catch (err) {
    logger.error('Fehler beim Laden der Visitor-Sessions', { error: err.message });
    res.status(500).json({ success: false, error: 'Interner Fehler' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH: Session-Details inkl. Nachrichten (Staff)
// GET /api/visitor-chat/sessions/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sessions/:id', authenticateToken, async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const sessionId = parseInt(req.params.id);

  try {
    const [[session]] = await pool.query(
      `SELECT id, dojo_id, source_site, visitor_name, visitor_email, status, created_at
       FROM visitor_chat_sessions WHERE id = ?`,
      [sessionId]
    );
    if (!session) return res.status(404).json({ success: false, error: 'Session nicht gefunden' });

    // Dojo-Isolierung: normaler Admin kann nur sein Dojo sehen
    if (secureDojoId && session.dojo_id !== secureDojoId) {
      return res.status(403).json({ success: false, error: 'Kein Zugriff' });
    }

    const [messages] = await pool.query(
      `SELECT id, sender_type, sender_name, message, read_at, created_at
       FROM visitor_chat_messages WHERE session_id = ? ORDER BY id ASC`,
      [sessionId]
    );

    // Besucher-Nachrichten als gelesen markieren
    await pool.query(
      `UPDATE visitor_chat_messages SET read_at = NOW()
       WHERE session_id = ? AND sender_type = 'visitor' AND read_at IS NULL`,
      [sessionId]
    );

    res.json({ success: true, session, messages });
  } catch (err) {
    logger.error('Fehler beim Laden der Session-Details', { error: err.message });
    res.status(500).json({ success: false, error: 'Interner Fehler' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH: Staff antwortet
// POST /api/visitor-chat/sessions/:id/reply
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sessions/:id/reply', authenticateToken, async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const sessionId = parseInt(req.params.id);
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Nachricht darf nicht leer sein' });
  }

  try {
    const [[session]] = await pool.query(
      `SELECT id, dojo_id, visitor_token, visitor_name, visitor_email FROM visitor_chat_sessions WHERE id = ?`,
      [sessionId]
    );
    if (!session) return res.status(404).json({ success: false, error: 'Session nicht gefunden' });

    if (secureDojoId && session.dojo_id !== secureDojoId) {
      return res.status(403).json({ success: false, error: 'Kein Zugriff' });
    }

    const staffId = req.user?.admin_id || req.user?.user_id || req.user_id;
    const staffName = req.user?.vorname
      ? `${req.user.vorname} ${req.user.nachname || ''}`.trim()
      : (req.user?.username || 'Team');

    const [insertResult] = await pool.query(
      `INSERT INTO visitor_chat_messages (session_id, sender_type, sender_id, sender_name, message)
       VALUES (?, 'staff', ?, ?, ?)`,
      [sessionId, staffId, staffName, message.trim()]
    );

    // Session auf 'active' setzen
    await pool.query(
      `UPDATE visitor_chat_sessions SET status = 'active' WHERE id = ?`,
      [sessionId]
    );

    const [[newMsg]] = await pool.query(
      `SELECT id, sender_type, sender_name, message, created_at
       FROM visitor_chat_messages WHERE id = ?`,
      [insertResult.insertId]
    );

    // Socket.io: Besucher in Echtzeit informieren (falls noch auf der Seite)
    const io = req.app.get('io');
    if (io) {
      io.to(`visitor-session:${session.visitor_token}`)
        .emit('visitor-chat:message', newMsg);
    }

    // E-Mail-Benachrichtigung an Besucher (asynchron, kein await — blockiert nicht)
    if (session.visitor_email) {
      sendVisitorReplyEmail(session, staffName, message.trim()).catch(err =>
        logger.warn('Visitor-Chat E-Mail konnte nicht gesendet werden', { error: err.message, sessionId })
      );
    }

    res.json({ success: true, message: newMsg });
  } catch (err) {
    logger.error('Fehler bei Staff-Antwort', { error: err.message });
    res.status(500).json({ success: false, error: 'Interner Fehler' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH: Session-Status ändern (open/active/closed)
// PUT /api/visitor-chat/sessions/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.put('/sessions/:id/status', authenticateToken, async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const sessionId = parseInt(req.params.id);
  const { status } = req.body;

  if (!['open','active','closed','archived'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Ungültiger Status' });
  }

  try {
    const [[session]] = await pool.query(
      `SELECT id, dojo_id FROM visitor_chat_sessions WHERE id = ?`,
      [sessionId]
    );
    if (!session) return res.status(404).json({ success: false, error: 'Session nicht gefunden' });

    if (secureDojoId && session.dojo_id !== secureDojoId) {
      return res.status(403).json({ success: false, error: 'Kein Zugriff' });
    }

    await pool.query(`UPDATE visitor_chat_sessions SET status = ? WHERE id = ?`, [status, sessionId]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Fehler beim Status-Update der Session', { error: err.message });
    res.status(500).json({ success: false, error: 'Interner Fehler' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH: Session anpinnen (toggle)
// PUT /api/visitor-chat/sessions/:id/pin
// ─────────────────────────────────────────────────────────────────────────────
router.put('/sessions/:id/pin', authenticateToken, async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const sessionId = parseInt(req.params.id);
  try {
    const [[session]] = await pool.query(
      `SELECT id, dojo_id, pinned FROM visitor_chat_sessions WHERE id = ?`, [sessionId]
    );
    if (!session) return res.status(404).json({ success: false });
    if (secureDojoId && session.dojo_id !== secureDojoId) return res.status(403).json({ success: false });
    const newPinned = session.pinned ? 0 : 1;
    await pool.query(`UPDATE visitor_chat_sessions SET pinned = ? WHERE id = ?`, [newPinned, sessionId]);
    res.json({ success: true, pinned: !!newPinned });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH: Session löschen
// DELETE /api/visitor-chat/sessions/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/sessions/:id', authenticateToken, async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const sessionId = parseInt(req.params.id);

  try {
    const [[session]] = await pool.query(
      `SELECT id, dojo_id FROM visitor_chat_sessions WHERE id = ?`,
      [sessionId]
    );
    if (!session) return res.status(404).json({ success: false, error: 'Session nicht gefunden' });

    if (secureDojoId && session.dojo_id !== secureDojoId) {
      return res.status(403).json({ success: false, error: 'Kein Zugriff' });
    }

    await pool.query(`DELETE FROM visitor_chat_sessions WHERE id = ?`, [sessionId]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Fehler beim Löschen der Session', { error: err.message });
    res.status(500).json({ success: false, error: 'Interner Fehler' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH: Ungelesene Sessions zählen (für Badge im Dashboard)
// GET /api/visitor-chat/unread-count
// ─────────────────────────────────────────────────────────────────────────────
router.get('/unread-count', authenticateToken, async (req, res) => {
  const secureDojoId = getSecureDojoId(req);

  try {
    let query, params;
    if (secureDojoId) {
      query = `SELECT COUNT(DISTINCT vcs.id) as count
               FROM visitor_chat_sessions vcs
               JOIN visitor_chat_messages vcm ON vcm.session_id = vcs.id
               WHERE vcs.dojo_id = ? AND vcs.status != 'closed'
               AND vcm.sender_type = 'visitor' AND vcm.read_at IS NULL`;
      params = [secureDojoId];
    } else {
      query = `SELECT COUNT(DISTINCT vcs.id) as count
               FROM visitor_chat_sessions vcs
               JOIN visitor_chat_messages vcm ON vcm.session_id = vcs.id
               WHERE vcs.status != 'closed'
               AND vcm.sender_type = 'visitor' AND vcm.read_at IS NULL`;
      params = [];
    }

    const [[result]] = await pool.query(query, params);
    res.json({ success: true, count: result.count });
  } catch (err) {
    logger.error('Fehler beim Zählen der ungelesenen Sessions', { error: err.message });
    res.status(500).json({ success: false, error: 'Interner Fehler', count: 0 });
  }
});

module.exports = router;
