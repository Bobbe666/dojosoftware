/**
 * Global Write-Audit Middleware
 * Protokolliert automatisch ALLE POST/PUT/DELETE-Requests.
 * Wird nach der Authentifizierung eingehängt, damit req.user verfügbar ist.
 *
 * Was geloggt wird:
 *  - Methode, Pfad, Status, IP, User-Agent
 *  - User (ID, Email, Rolle, Dojo)
 *  - Request-Body (ohne Passwörter/Tokens)
 *  - Zeitstempel + Response-Zeit in ms
 */

const db = require('../db');
const pool = db.promise();

// Felder die niemals geloggt werden
const SENSITIVE_KEYS = new Set([
  'passwort', 'password', 'token', 'secret', 'buchungs_token',
  'jwt', 'api_key', 'apiKey', 'auth', 'authorization',
  'iban', 'bic', 'konto', 'pin', 'cvv',
]);

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const result = {};
  for (const [k, v] of Object.entries(body)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      result[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      result[k] = sanitizeBody(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// Pfade die NICHT geloggt werden (zu häufig / kein Mehrwert)
const SKIP_PATHS = [
  '/api/auth/refresh',
  '/api/notifications/mark-read',
  '/api/chat/',
  '/api/visitor-chat/',
  '/api/socket',
];

function shouldSkip(path) {
  return SKIP_PATHS.some(p => path.startsWith(p));
}

function getDojoId(req) {
  return req.user?.dojo_id ?? null;
}

function getUserInfo(req) {
  const u = req.user || {};
  return {
    userId:    u.id || u.user_id || null,
    userEmail: u.email || null,
    userName:  u.name || (u.vorname ? `${u.vorname} ${u.nachname || ''}`.trim() : null),
    userRole:  u.rolle || u.role || null,
    dojoId:    u.dojo_id ?? null,
  };
}

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    null
  );
}

async function insertLog({ method, path, status, durationMs, userInfo, dojoId, body, ip, userAgent }) {
  try {
    const bodyJson = body && Object.keys(body).length > 0
      ? JSON.stringify(sanitizeBody(body)).slice(0, 4000)
      : null;

    await pool.query(
      `INSERT INTO audit_log
         (user_id, user_email, user_name, user_role,
          dojo_id,
          aktion, kategorie,
          entity_type, beschreibung,
          ip_adresse, user_agent, request_method, request_path)
       VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM', ?, ?, ?, ?, ?, ?)`,
      [
        userInfo.userId,
        userInfo.userEmail,
        userInfo.userName,
        userInfo.userRole,
        dojoId,
        `HTTP_${method}`,          // aktion
        method === 'DELETE' ? 'DELETE_OP' : method === 'POST' ? 'CREATE_OP' : 'UPDATE_OP', // entity_type
        `${method} ${path} → ${status} (${durationMs}ms)${bodyJson ? ' | Body: ' + bodyJson : ''}`,
        ip,
        userAgent?.slice(0, 500) || null,
        method,
        path?.slice(0, 500) || null,
      ]
    );
  } catch (err) {
    // Logging-Fehler niemals an den Client weitergeben
    console.error('[WriteAudit] DB-Fehler:', err.message);
  }
}

/**
 * Express-Middleware — in server.js einbinden:
 *   app.use('/api', writeAuditMiddleware);
 */
function writeAuditMiddleware(req, res, next) {
  const method = req.method;

  // Nur Schreiboperationen loggen
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return next();
  }

  const path = req.originalUrl || req.path;
  if (shouldSkip(path)) return next();

  const startTime = Date.now();
  const body = req.body;
  const ip = getIp(req);
  const userAgent = req.headers['user-agent'];

  // Nach dem Response loggen (non-blocking)
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const status = res.statusCode;

    // Nur erfolgreiche Requests loggen (2xx + bekannte Client-Fehler bei DELETE)
    // 4xx bei GET ignorieren, aber 4xx bei DELETE/POST interessieren uns für Security
    if (status >= 500) return; // Server-Fehler werden durch Sentry gecatcht

    const userInfo = getUserInfo(req);
    const dojoId = getDojoId(req);

    // Async — blockiert den Response nicht
    insertLog({ method, path, status, durationMs, userInfo, dojoId, body, ip, userAgent })
      .catch(() => {}); // Silent fail
  });

  next();
}

module.exports = writeAuditMiddleware;
