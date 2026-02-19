/**
 * Security Monitoring Middleware
 * Erkennt und blockiert Angriffe in Echtzeit
 */

const securityMonitorService = require('../services/securityMonitorService');

/**
 * Extrahiert die echte Client-IP (auch hinter Proxy/Load-Balancer)
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Pfade die von intensiver Prüfung ausgenommen sind (interne API-Routen)
 */
const SAFE_PATH_PREFIXES = [
  '/api/lastschriftlauf/',
  '/api/sepa/',
  '/api/beitraege/',
  '/api/notifications/',
  '/api/checkin/',
  '/api/dashboard/'
];

/**
 * Hauptmiddleware für Security-Monitoring
 */
const securityMonitorMiddleware = async (req, res, next) => {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const path = req.originalUrl || req.path;
  const method = req.method;

  try {
    // 1. Prüfe ob IP blockiert ist
    const isBlocked = await securityMonitorService.isIPBlocked(ip);
    if (isBlocked) {
      return res.status(403).json({
        error: 'Zugriff verweigert',
        message: 'Ihre IP-Adresse wurde temporär blockiert'
      });
    }

    // Sichere interne API-Pfade überspringen (bereits durch Auth geschützt)
    const isSafePath = SAFE_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
    if (isSafePath) {
      req.clientIP = ip;
      return next();
    }

    // 2. Prüfe auf SQL-Injection
    const allInput = {
      query: req.query,
      body: req.body,
      params: req.params,
      path: path
    };

    if (securityMonitorService.detectSQLInjection(allInput)) {
      await securityMonitorService.logAlert({
        alert_type: 'sql_injection',
        severity: 'critical',
        ip_address: ip,
        user_agent: userAgent,
        request_path: path,
        request_method: method,
        request_body: allInput,
        user_id: req.user?.id,
        dojo_id: req.user?.dojo_id,
        description: 'SQL-Injection Versuch erkannt',
        blocked: true
      });

      return res.status(400).json({
        error: 'Ungültige Anfrage'
      });
    }

    // 3. Prüfe auf XSS
    if (securityMonitorService.detectXSS(allInput)) {
      await securityMonitorService.logAlert({
        alert_type: 'xss_attempt',
        severity: 'high',
        ip_address: ip,
        user_agent: userAgent,
        request_path: path,
        request_method: method,
        request_body: allInput,
        user_id: req.user?.id,
        dojo_id: req.user?.dojo_id,
        description: 'XSS Angriff erkannt',
        blocked: true
      });

      return res.status(400).json({
        error: 'Ungültige Anfrage'
      });
    }

    // 4. Prüfe auf Path Traversal
    if (securityMonitorService.detectPathTraversal(path)) {
      await securityMonitorService.logAlert({
        alert_type: 'path_traversal',
        severity: 'high',
        ip_address: ip,
        user_agent: userAgent,
        request_path: path,
        request_method: method,
        user_id: req.user?.id,
        dojo_id: req.user?.dojo_id,
        description: 'Path Traversal Versuch erkannt',
        blocked: true
      });

      return res.status(400).json({
        error: 'Ungültige Anfrage'
      });
    }

    // 5. Speichere IP für spätere Referenz
    req.clientIP = ip;

    next();
  } catch (error) {
    console.error('Security Monitor Middleware Error:', error);
    // Bei Fehlern trotzdem durchlassen, aber loggen
    next();
  }
};

/**
 * Middleware für Login-Tracking (nach fehlgeschlagenem Login aufrufen)
 */
const trackFailedLoginMiddleware = async (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Nur bei Login-Endpoint und Fehler tracken
    if (req.originalUrl.includes('/login') && res.statusCode === 401) {
      const ip = getClientIP(req);
      const attemptCount = securityMonitorService.trackFailedLogin(ip);

      if (securityMonitorService.isBruteForceAttack(ip)) {
        securityMonitorService.logAlert({
          alert_type: 'brute_force',
          severity: 'high',
          ip_address: ip,
          user_agent: req.headers['user-agent'],
          request_path: req.originalUrl,
          request_method: 'POST',
          description: `Brute-Force Angriff: ${attemptCount} fehlgeschlagene Login-Versuche`,
          blocked: attemptCount >= 10,
          metadata: { attempt_count: attemptCount }
        });
      }
    }

    return originalJson(data);
  };

  next();
};

/**
 * Middleware für Rate-Limit Überschreitungen
 */
const rateLimitExceededHandler = (req, res) => {
  const ip = getClientIP(req);

  securityMonitorService.logAlert({
    alert_type: 'rate_limit_exceeded',
    severity: 'medium',
    ip_address: ip,
    user_agent: req.headers['user-agent'],
    request_path: req.originalUrl,
    request_method: req.method,
    description: 'Rate-Limit überschritten'
  });

  res.status(429).json({
    error: 'Zu viele Anfragen',
    message: 'Bitte versuchen Sie es später erneut'
  });
};

/**
 * Middleware für verdächtige File-Uploads
 */
const fileUploadSecurityMiddleware = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const files = req.files || [req.file];
  const ip = getClientIP(req);

  // Gefährliche Dateitypen
  const dangerousExtensions = [
    '.exe', '.dll', '.bat', '.cmd', '.sh', '.php', '.asp', '.aspx',
    '.jsp', '.cgi', '.pl', '.py', '.rb', '.htaccess', '.htpasswd'
  ];

  for (const file of files) {
    if (!file) continue;

    const filename = file.originalname?.toLowerCase() || '';
    const isDangerous = dangerousExtensions.some(ext => filename.endsWith(ext));

    if (isDangerous) {
      securityMonitorService.logAlert({
        alert_type: 'file_upload_attack',
        severity: 'critical',
        ip_address: ip,
        user_agent: req.headers['user-agent'],
        request_path: req.originalUrl,
        request_method: 'POST',
        description: `Gefährliche Datei hochgeladen: ${file.originalname}`,
        blocked: true,
        metadata: {
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        }
      });

      return res.status(400).json({
        error: 'Dateityp nicht erlaubt'
      });
    }
  }

  next();
};

/**
 * Middleware für CSRF-Verletzungen
 */
const csrfViolationHandler = (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  const ip = getClientIP(req);

  securityMonitorService.logAlert({
    alert_type: 'csrf_violation',
    severity: 'high',
    ip_address: ip,
    user_agent: req.headers['user-agent'],
    request_path: req.originalUrl,
    request_method: req.method,
    description: 'CSRF Token fehlt oder ungültig',
    user_id: req.user?.id,
    dojo_id: req.user?.dojo_id
  });

  res.status(403).json({
    error: 'CSRF Validierung fehlgeschlagen'
  });
};

/**
 * Middleware für unbefugte Zugriffe
 */
const logUnauthorizedAccess = async (req, res, next) => {
  const originalStatus = res.status.bind(res);

  res.status = function(code) {
    if (code === 401 || code === 403) {
      const ip = getClientIP(req);

      securityMonitorService.logAlert({
        alert_type: 'unauthorized_access',
        severity: 'low',
        ip_address: ip,
        user_agent: req.headers['user-agent'],
        request_path: req.originalUrl,
        request_method: req.method,
        description: `Unbefugter Zugriff (${code})`,
        user_id: req.user?.id,
        dojo_id: req.user?.dojo_id
      });
    }

    return originalStatus(code);
  };

  next();
};

module.exports = {
  securityMonitorMiddleware,
  trackFailedLoginMiddleware,
  rateLimitExceededHandler,
  fileUploadSecurityMiddleware,
  csrfViolationHandler,
  logUnauthorizedAccess,
  getClientIP
};
