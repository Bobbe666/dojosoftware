const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const logger = require('../utils/logger');
const { JWT_SECRET } = require('../middleware/auth');
const auditLog = require('../services/auditLogService');
const { sanitizeStrings } = require('../middleware/validation');
const {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LIMITS,
  HTTP_STATUS
} = require('../utils/constants');

// ===================================================================
// 🔐 PHASE 2: SECURITY IMPORTS
// ===================================================================
const {
  verifyPassword,
  hashPassword,
  migratePasswordHash,
  validatePasswordPolicy
} = require('../services/passwordService');

const {
  loginLimiter,
  passwordResetLimiter,
  logSecurityEvent,
  getClientInfo,
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  generateCsrfToken
} = require('../config/security');

const {
  regenerateSession,
  destroySession
} = require('../config/session');

const router = express.Router();

// ===================================================================
// 🧪 TEST-ROUTEN
// ===================================================================

router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Auth Service',
    timestamp: new Date().toISOString(),
    authMode: 'dual', // JWT + Session
    database: 'connected via existing db.js',
    routes: {
      'POST /api/auth/login': 'Login with username or email (JWT + Session)',
      'POST /api/auth/logout': 'Logout (destroys session)',
      'GET /api/auth/session': 'Check session status (Phase 3)',
      'GET /api/auth/me': 'Get current user',
      'POST /api/auth/refresh': 'Refresh JWT token',
      'GET /api/auth/csrf-token': 'Get CSRF token for state-changing requests',
      'GET /api/auth/health': 'Health check'
    }
  });
});

router.get('/test', (req, res) => {
  res.json({
    message: 'Auth route is working!',
    timestamp: new Date().toISOString(),
    sessionEnabled: !!req.session,
    dbSystem: 'Using existing db.js connection'
  });
});

// ===================================================================
// 🔐 CSRF-TOKEN ENDPOINT (Phase 3 Security)
// ===================================================================
// Frontend holt CSRF-Token beim App-Start
// Token wird bei state-changing Requests (POST/PUT/DELETE) mitgesendet

router.get('/csrf-token', (req, res) => {
  try {
    const token = generateCsrfToken(req, res);
    res.json({
      success: true,
      csrfToken: token
    });
  } catch (error) {
    logger.warn('CSRF-Token-Generierung fehlgeschlagen:', error.message);
    // Fallback: Generiere einfachen Token basierend auf Session
    const fallbackToken = req.session?.id
      ? Buffer.from(req.session.id).toString('base64').substring(0, 32)
      : 'csrf-fallback-' + Date.now();
    res.json({
      success: true,
      csrfToken: fallbackToken
    });
  }
});

// ===================================================================
// 🔐 SESSION-CHECK ENDPOINT (Phase 3 Security)
// ===================================================================
// Frontend kann Session-Status prüfen ohne JWT
// Gibt User-Info zurück wenn Session gültig ist

router.get('/session', (req, res) => {
  // Prüfe ob Session existiert und User eingeloggt ist
  if (req.session && req.session.userId) {
    return res.json({
      success: true,
      authenticated: true,
      user: {
        id: req.session.userId,
        email: req.session.email,
        username: req.session.username,
        role: req.session.role,
        dojo_id: req.session.dojoId,
        dojoName: req.session.dojoName
      },
      authMethod: 'session'
    });
  }

  // Keine gültige Session
  return res.json({
    success: true,
    authenticated: false,
    user: null
  });
});

// ===================================================================
// 🔐 LOGIN-ROUTE (Dual-Mode: JWT + Session)
// ===================================================================

router.post('/login',
  loginLimiter, // Rate limiting
  sanitizeStrings(['email', 'username']),
  async (req, res) => {

  const { email, password, username } = req.body;
  const loginField = email || username;
  const clientInfo = getClientInfo(req);

  // Validierung
  if (!loginField || !password) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        message: ERROR_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED,
        code: HTTP_STATUS.BAD_REQUEST
      }
    });
  }

  // Passwort-Länge prüfen (Brute-Force Schutz)
  if (password.length > 128) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        message: "Passwort zu lang",
        code: HTTP_STATUS.BAD_REQUEST
      }
    });
  }

  try {
    // Zuerst in users Tabelle suchen (Mitglieder)
    const userQuery = `
      SELECT id, username, email, password, role, dojo_id, mitglied_id, created_at
      FROM users
      WHERE email = ? OR username = ?
      LIMIT 1
    `;

    // Dann in admin_users Tabelle suchen (Admins/Trainer)
    const adminQuery = `
      SELECT id, username, email, password, password_algorithm, rolle as role, dojo_id,
             vorname, nachname, berechtigungen, aktiv, erstellt_am,
             failed_login_attempts, locked_until
      FROM admin_users
      WHERE email = ? OR username = ?
      LIMIT 1
    `;

    db.query(userQuery, [loginField, loginField], async (err, results) => {
      if (err) {
        logger.error('Database error', { error: err.message, stack: err.stack });
        return res.status(500).json({
          login: false,
          message: "Server-Fehler bei der Datenbankabfrage",
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      // Wenn nicht in users gefunden, in admin_users suchen
      if (results.length === 0) {
        db.query(adminQuery, [loginField, loginField], async (adminErr, adminResults) => {
          if (adminErr) {
            logger.error('Admin database error', { error: adminErr.message, stack: adminErr.stack });
            return res.status(500).json({
              login: false,
              message: "Server-Fehler bei der Datenbankabfrage",
              error: process.env.NODE_ENV === 'development' ? adminErr.message : undefined
            });
          }

          if (adminResults.length === 0) {
            // Log failed attempt (user not found) - aber generische Meldung zurückgeben
            logSecurityEvent(db, 'login_failed', {
              ...clientInfo,
              extra: { reason: 'user_not_found', loginField }
            });

            // Sicherheit: Gleiche Meldung wie bei falschem Passwort (verhindert User-Enumeration)
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
              login: false,
              message: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS
            });
          }

          // Admin/Trainer gefunden - verarbeite Login
          await processLogin(adminResults[0], password, res, req, true, clientInfo);
        });
        return;
      }

      // User gefunden - verarbeite Login
      await processLogin(results[0], password, res, req, false, clientInfo);
    });

    // ===================================================================
    // Hilfsfunktion für Login-Verarbeitung
    // ===================================================================
    async function processLogin(user, password, res, req, isAdmin, clientInfo) {
      try {
        // Check if account is locked
        if (isAdmin && user.locked_until && new Date(user.locked_until) > new Date()) {
          const lockRemaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);

          logSecurityEvent(db, 'login_failed', {
            userId: user.id,
            dojoId: user.dojo_id,
            ...clientInfo,
            extra: { reason: 'account_locked', lockRemaining }
          });

          return res.status(423).json({
            login: false,
            message: `Konto vorübergehend gesperrt. Bitte warten Sie ${lockRemaining} Minuten.`,
            code: 'ACCOUNT_LOCKED'
          });
        }

        // Password verification (supports both bcrypt and Argon2)
        const { valid, needsRehash, algorithm } = await verifyPassword(password, user.password);

        if (!valid) {
          // Record failed attempt
          if (isAdmin) {
            await recordFailedLogin(db, user.id);
          }

          // Audit-Log: Fehlgeschlagener Login
          auditLog.log({
            req,
            aktion: auditLog.AKTION.LOGIN_FEHLGESCHLAGEN,
            kategorie: auditLog.KATEGORIE.AUTH,
            entityType: isAdmin ? 'admin_users' : 'users',
            entityId: user.id,
            entityName: user.username,
            beschreibung: `Login fehlgeschlagen (falsches Passwort): ${user.username}`
          });

          logSecurityEvent(db, 'login_failed', {
            userId: user.id,
            dojoId: user.dojo_id,
            ...clientInfo,
            extra: { reason: 'invalid_password', algorithm }
          });

          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            login: false,
            message: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS
          });
        }

        // 🔄 Password migration: bcrypt -> Argon2
        if (needsRehash && isAdmin) {
          const newHash = await hashPassword(password);
          await migratePasswordHash(db, user.id, newHash);
          logger.info(`[Auth] Password migrated to Argon2 for user ${user.username}`);
        }

        // 🔒 TENANT ISOLATION: Strikte Subdomain-Zuordnung
        const subdomain = req.headers['x-tenant-subdomain'];

        if (subdomain && subdomain !== '') {
          if (!user.dojo_id) {
            return res.status(403).json({
              login: false,
              message: 'Bitte melden Sie sich bei der Hauptdomain (dojo.tda-intl.org) an'
            });
          }

          const [dojos] = await db.promise().query(
            'SELECT id FROM dojo WHERE subdomain = ? LIMIT 1',
            [subdomain]
          );

          if (dojos.length === 0) {
            return res.status(403).json({
              login: false,
              message: 'Ungültige Subdomain'
            });
          }

          if (user.dojo_id !== dojos[0].id) {
            return res.status(403).json({
              login: false,
              message: 'Sie haben keine Berechtigung, sich bei diesem Dojo anzumelden'
            });
          }
        } else {
          if (user.dojo_id && user.role !== 'super_admin') {
            return res.status(403).json({
              login: false,
              message: 'Sie müssen sich bei Ihrer Dojo-Subdomain anmelden'
            });
          }
        }

        // ===================================================================
        // 🔐 CREATE SESSION (Phase 2: Dual-Mode)
        // ===================================================================
        if (req.session) {
          // Regenerate session to prevent session fixation
          try {
            await regenerateSession(req);
          } catch (sessionErr) {
            logger.warn('[Auth] Session regeneration failed, continuing with new session', { error: sessionErr.message });
          }

          // Store user data in session
          req.session.userId = user.id;
          req.session.username = user.username;
          req.session.email = user.email;
          req.session.role = user.role;
          req.session.dojoId = user.dojo_id || null;
          req.session.isAdmin = isAdmin;
          req.session.loginTime = new Date().toISOString();
          req.session.authMethod = 'session';

          logger.info(`[Auth] Session created for user ${user.username} (ID: ${req.session.id?.substring(0, 8)}...)`);
        }

        // ===================================================================
        // 🎫 CREATE JWT TOKEN (for backward compatibility)
        // ===================================================================
        const tokenPayload = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          rolle: user.role,
          dojo_id: user.dojo_id || null,
          mitglied_id: user.mitglied_id || null,
          vorname: user.vorname || null,
          nachname: user.nachname || null,
          berechtigungen: isAdmin ? (typeof user.berechtigungen === 'string' ? JSON.parse(user.berechtigungen) : user.berechtigungen) : null,
          iat: Math.floor(Date.now() / 1000)
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "8h" });

        // Record successful login
        if (isAdmin) {
          await recordSuccessfulLogin(db, user.id, clientInfo.ipAddress);
        }

        // Prepare response
        const userResponse = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          rolle: user.role,
          dojo_id: user.dojo_id || null,
          mitglied_id: user.mitglied_id || null,
          vorname: user.vorname || null,
          nachname: user.nachname || null,
          berechtigungen: isAdmin ? (typeof user.berechtigungen === 'string' ? JSON.parse(user.berechtigungen) : user.berechtigungen) : null,
          loginTime: new Date().toISOString()
        };

        // Audit-Log: Erfolgreicher Login
        auditLog.log({
          req,
          aktion: auditLog.AKTION.LOGIN_ERFOLGREICH,
          kategorie: auditLog.KATEGORIE.AUTH,
          entityType: isAdmin ? 'admin_users' : 'users',
          entityId: user.id,
          entityName: user.username,
          dojoId: user.dojo_id,
          beschreibung: `Login erfolgreich: ${user.username} (${user.role})`
        });

        logSecurityEvent(db, 'login_success', {
          userId: user.id,
          dojoId: user.dojo_id,
          ...clientInfo,
          extra: {
            authMethod: 'dual',
            sessionCreated: !!req.session,
            passwordAlgorithm: algorithm
          }
        });

        // Send response
        res.status(200).json({
          login: true,
          token,
          user: userResponse,
          message: `Willkommen zurück, ${user.username}!`,
          authMethod: 'dual' // Indicates both JWT and session are active
        });

      } catch (error) {
        logger.error('Login processing error', { error: error.message, stack: error.stack });
        return res.status(500).json({
          login: false,
          message: "Fehler bei der Passwort-Überprüfung"
        });
      }
    }

  } catch (error) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    res.status(500).json({
      login: false,
      message: "Server-Fehler beim Login",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===================================================================
// 🛡️ HYBRID AUTH MIDDLEWARE (accepts both JWT and Session)
// ===================================================================

const authenticateHybrid = async (req, res, next) => {
  // Method 1: Check Session first (preferred)
  if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      username: req.session.username,
      email: req.session.email,
      role: req.session.role,
      dojo_id: req.session.dojoId,
      authMethod: 'session'
    };
    return next();
  }

  // Method 2: Fall back to JWT
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      message: "Nicht authentifiziert",
      code: 'AUTH_REQUIRED'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        message: "Token ungültig oder abgelaufen",
        code: 'INVALID_TOKEN'
      });
    }

    req.user = {
      ...decoded,
      authMethod: 'jwt'
    };
    next();
  });
};

// Legacy middleware (for backward compatibility)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "Kein Token vorhanden" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token ungültig oder abgelaufen" });
    }
    req.user = decoded;
    next();
  });
};

// ===================================================================
// 🚪 LOGOUT (Phase 2: Destroys Session + invalidates on client)
// ===================================================================

router.post('/logout', authenticateHybrid, async (req, res) => {
  const clientInfo = getClientInfo(req);

  try {
    const userId = req.user?.id;
    const username = req.user?.username;

    // Destroy session if exists
    if (req.session) {
      await destroySession(req);
      logger.info(`[Auth] Session destroyed for user ${username}`);
    }

    // Clear session cookie
    res.clearCookie('dojo_sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Log logout event
    logSecurityEvent(db, 'logout', {
      userId,
      ...clientInfo
    });

    res.json({
      success: true,
      message: "Erfolgreich abgemeldet",
      user: username,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({
      success: false,
      message: "Fehler beim Abmelden"
    });
  }
});

// ===================================================================
// 👤 GET CURRENT USER
// ===================================================================

router.get('/me', authenticateHybrid, (req, res) => {
  res.json({
    tokenValid: true,
    authMethod: req.user.authMethod,
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      dojo_id: req.user.dojo_id,
      tokenIssued: req.user.iat ? new Date(req.user.iat * 1000).toISOString() : undefined,
      sessionActive: !!req.session?.userId
    },
    serverTime: new Date().toISOString()
  });
});

// ===================================================================
// 🔄 TOKEN REFRESH (Sliding Session)
// ===================================================================

router.post('/refresh', authenticateHybrid, async (req, res) => {
  try {
    const user = req.user;

    // Also extend session if exists
    if (req.session && req.session.userId) {
      req.session.touch(); // Reset session expiry
    }

    // Create new JWT
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      rolle: user.role,
      dojo_id: user.dojo_id || null,
      mitglied_id: user.mitglied_id || null,
      vorname: user.vorname || null,
      nachname: user.nachname || null,
      berechtigungen: user.berechtigungen || null,
      iat: Math.floor(Date.now() / 1000)
    };

    const newToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '2h' });

    logger.info(`[Auth] Token refreshed for user: ${user.username}`);

    res.json({
      success: true,
      token: newToken,
      message: 'Token um 2 Stunden verlängert',
      expiresIn: '2h',
      sessionExtended: !!req.session?.userId
    });

  } catch (error) {
    logger.error('Token-Refresh error:', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Fehler beim Token-Refresh'
    });
  }
});

// ===================================================================
// 🔒 PASSWORT ÄNDERN (eingeloggt)
// ===================================================================

router.post('/change-password', authenticateHybrid, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const clientInfo = getClientInfo(req);

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Aktuelles und neues Passwort sind erforderlich' });
  }

  // Validate new password with policy
  const validation = validatePasswordPolicy(newPassword);
  if (!validation.valid) {
    return res.status(400).json({
      message: validation.errors[0],
      errors: validation.errors
    });
  }

  try {
    const tableName = req.user.authMethod === 'session' && req.session?.isAdmin ? 'admin_users' : 'users';
    const getQuery = `SELECT id, password FROM ${tableName} WHERE id = ? LIMIT 1`;

    const [results] = await db.promise().query(getQuery, [req.user.id]);

    if (!results.length) {
      return res.status(404).json({ message: 'User nicht gefunden' });
    }

    const user = results[0];
    const { valid } = await verifyPassword(currentPassword, user.password);

    if (!valid) {
      logSecurityEvent(db, 'login_failed', {
        userId: user.id,
        ...clientInfo,
        extra: { reason: 'password_change_wrong_current' }
      });
      return res.status(401).json({ message: 'Aktuelles Passwort falsch' });
    }

    // Hash with Argon2
    const newHash = await hashPassword(newPassword);

    const updateQuery = tableName === 'admin_users'
      ? `UPDATE admin_users SET password = ?, password_algorithm = 'argon2id', password_changed_at = NOW() WHERE id = ?`
      : `UPDATE users SET password = ? WHERE id = ?`;

    await db.promise().query(updateQuery, [newHash, req.user.id]);

    logSecurityEvent(db, 'password_change', {
      userId: req.user.id,
      ...clientInfo
    });

    res.json({ success: true, message: 'Passwort aktualisiert' });

  } catch (error) {
    logger.error('Password change error', { error: error.message });
    res.status(500).json({ message: 'Serverfehler', error: error.message });
  }
});

// ===================================================================
// 🛡️ SICHERHEITSFRAGE SPEICHERN
// ===================================================================

router.post('/security', authenticateHybrid, async (req, res) => {
  const { securityQuestion, securityAnswer } = req.body;

  if (!securityQuestion || !securityAnswer) {
    return res.status(400).json({ message: 'Frage und Antwort sind erforderlich' });
  }

  try {
    const answerHash = await hashPassword(securityAnswer.trim().toLowerCase());

    await db.promise().query(
      'UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?',
      [securityQuestion, answerHash, req.user.id]
    );

    res.json({ success: true, message: 'Sicherheitsfrage gespeichert' });

  } catch (error) {
    res.status(500).json({ message: 'Serverfehler', error: error.message });
  }
});

// ===================================================================
// PASSWORT ZURÜCKSETZEN (öffentlich, mit Sicherheitsfrage)
// ===================================================================

router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  const { loginField, securityQuestion, securityAnswer, newPassword } = req.body;
  const clientInfo = getClientInfo(req);

  if (!loginField || !securityQuestion || !securityAnswer || !newPassword) {
    return res.status(400).json({ message: 'Alle Felder sind erforderlich' });
  }

  // Validate new password
  const validation = validatePasswordPolicy(newPassword);
  if (!validation.valid) {
    return res.status(400).json({
      message: validation.errors[0],
      errors: validation.errors
    });
  }

  try {
    const [results] = await db.promise().query(
      'SELECT id, security_question, security_answer_hash FROM users WHERE email = ? OR username = ? LIMIT 1',
      [loginField, loginField]
    );

    if (!results.length) {
      // Sicherheit: Generische Meldung (verhindert User-Enumeration)
      return res.status(401).json({ message: 'Ungültige Angaben' });
    }

    const user = results[0];

    if (!user.security_question || !user.security_answer_hash) {
      // Sicherheit: Generische Meldung
      return res.status(401).json({ message: 'Ungültige Angaben' });
    }

    if (user.security_question !== securityQuestion) {
      return res.status(401).json({ message: 'Ungültige Angaben' });
    }

    const { valid } = await verifyPassword(securityAnswer.trim().toLowerCase(), user.security_answer_hash);
    if (!valid) {
      logSecurityEvent(db, 'login_failed', {
        userId: user.id,
        ...clientInfo,
        extra: { reason: 'password_reset_wrong_answer' }
      });
      return res.status(401).json({ message: 'Sicherheitsantwort falsch' });
    }

    // Hash with Argon2
    const newHash = await hashPassword(newPassword);

    await db.promise().query(
      'UPDATE users SET password = ? WHERE id = ?',
      [newHash, user.id]
    );

    logSecurityEvent(db, 'password_change', {
      userId: user.id,
      ...clientInfo,
      extra: { method: 'security_question' }
    });

    res.json({ success: true, message: 'Passwort wurde zurückgesetzt' });

  } catch (error) {
    res.status(500).json({ message: 'Serverfehler', error: error.message });
  }
});

// ===================================================================
// 📊 AUTH STATS (Admin only)
// ===================================================================

router.get('/stats', authenticateHybrid, async (req, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  try {
    // Get recent auth events
    const [events] = await db.promise().query(`
      SELECT event_type, COUNT(*) as count
      FROM auth_audit_log
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY event_type
    `);

    // Get active sessions count
    const [sessions] = await db.promise().query(`
      SELECT COUNT(*) as count FROM sessions WHERE expires > UNIX_TIMESTAMP()
    `);

    // Get locked accounts
    const [locked] = await db.promise().query(`
      SELECT COUNT(*) as count FROM admin_users WHERE locked_until > NOW()
    `);

    res.json({
      last24Hours: events.reduce((acc, e) => ({ ...acc, [e.event_type]: e.count }), {}),
      activeSessions: sessions[0]?.count || 0,
      lockedAccounts: locked[0]?.count || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

// ===================================================================
// DEBUG-ROUTEN (nur in Development)
// ===================================================================

if (process.env.NODE_ENV === 'development') {
  router.get('/users', (req, res) => {
    const query = 'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC';

    db.query(query, (err, results) => {
      if (err) {
        logger.error('Error fetching users', { error: err.message, stack: err.stack });
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        users: results,
        count: results.length,
        timestamp: new Date().toISOString()
      });
    });
  });

  router.get('/db-test', (req, res) => {
    db.query('SELECT COUNT(*) as user_count FROM users', (err, results) => {
      if (err) {
        logger.error('Database test failed', { error: err.message, stack: err.stack });
        return res.status(500).json({
          error: 'Database connection failed',
          details: err.message
        });
      }

      res.json({
        message: 'Database connection working',
        userCount: results[0].user_count,
        timestamp: new Date().toISOString()
      });
    });
  });
}

// ===================================================================
// USER MANAGEMENT (Production)
// ===================================================================

router.get('/users', (req, res) => {
  const query = 'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC';

  db.query(query, (err, results) => {
    if (err) {
      logger.error('Error fetching users', { error: err.message, stack: err.stack });
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email, role } = req.body;

  if (!username || !email || !role) {
    return res.status(400).json({ error: 'Username, Email und Rolle sind erforderlich' });
  }

  if (!['admin', 'supervisor', 'trainer', 'verkauf', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle' });
  }

  try {
    const updateQuery = 'UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?';
    db.query(updateQuery, [username, email, role, id], (err, result) => {
      if (err) {
        logger.error('Error updating user', { error: err.message, stack: err.stack, userId: id });
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
        }
        return res.status(500).json({ error: 'Fehler beim Aktualisieren' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json({ success: true, message: 'Benutzer erfolgreich aktualisiert' });
    });
  } catch (error) {
    logger.error('Error updating user', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/users/:id/password', async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  // Validate password
  const validation = validatePasswordPolicy(newPassword);
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.errors[0],
      errors: validation.errors
    });
  }

  try {
    const hashedPassword = await hashPassword(newPassword);
    const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';

    db.query(updateQuery, [hashedPassword, id], (err, result) => {
      if (err) {
        logger.error('Error resetting password', { error: err.message, stack: err.stack, userId: id });
        return res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json({ success: true, message: 'Passwort erfolgreich zurückgesetzt' });
    });
  } catch (error) {
    logger.error('Error resetting password', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/:id', (req, res) => {
  const { id } = req.params;

  if (id === '1') {
    return res.status(403).json({ error: 'Super-Admin kann nicht gelöscht werden' });
  }

  const deleteQuery = 'DELETE FROM users WHERE id = ?';

  db.query(deleteQuery, [id], (err, result) => {
    if (err) {
      logger.error('Error deleting user', { error: err.message, stack: err.stack, userId: id });
      return res.status(500).json({ error: 'Fehler beim Löschen' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({ success: true, message: 'Benutzer erfolgreich gelöscht' });
  });
});

// ===================================================================
// TOKEN-BASED AUTHENTICATION (for TDA Integration)
// ===================================================================

router.post('/token-login', async (req, res) => {
  const { api_token } = req.body;

  if (!api_token) {
    return res.status(400).json({
      success: false,
      login: false,
      message: "API-Token ist erforderlich"
    });
  }

  try {
    const dojoQuery = `
      SELECT id, dojoname, email, api_token, api_token_created_at, ist_aktiv
      FROM dojo
      WHERE api_token = ? AND ist_aktiv = TRUE
      LIMIT 1
    `;

    db.query(dojoQuery, [api_token], async (err, results) => {
      if (err) {
        logger.error('Database error during token authentication', { error: err.message, stack: err.stack });
        return res.status(500).json({
          success: false,
          login: false,
          message: "Server-Fehler bei der Token-Validierung"
        });
      }

      if (results.length === 0) {
        return res.status(401).json({
          success: false,
          login: false,
          message: "Ungültiger API-Token oder Dojo nicht aktiv"
        });
      }

      const dojo = results[0];

      db.query('UPDATE dojo SET api_token_last_used = NOW() WHERE id = ?', [dojo.id]);

      const jwtToken = jwt.sign(
        {
          id: dojo.id,
          dojoname: dojo.dojoname,
          email: dojo.email,
          role: 'dojo',
          auth_type: 'api_token'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        login: true,
        message: "Token-Authentifizierung erfolgreich",
        token: jwtToken,
        dojo: {
          id: dojo.id,
          dojoname: dojo.dojoname,
          email: dojo.email,
          role: 'dojo'
        }
      });
    });

  } catch (error) {
    logger.error('Error in token-login', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      login: false,
      message: "Server-Fehler beim Token-Login"
    });
  }
});

// ===================================================================
// SSO LOGIN (für Verband-Portal Integration)
// ===================================================================

router.post('/sso-login', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'SSO-Token fehlt' });
    }

    const [users] = await db.promise().query(
      `SELECT au.*, d.dojoname, d.subdomain
       FROM admin_users au
       LEFT JOIN dojo d ON au.dojo_id = d.id
       WHERE au.session_token = ? AND au.session_ablauf > NOW() AND au.aktiv = 1`,
      [token]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Ungültiger oder abgelaufener SSO-Token' });
    }

    const user = users[0];

    await db.promise().query(
      `UPDATE admin_users SET session_token = NULL, session_ablauf = NULL WHERE id = ?`,
      [user.id]
    );

    const crypto = require('crypto');
    const newSessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpiry = new Date();
    sessionExpiry.setHours(sessionExpiry.getHours() + 24);

    await db.promise().query(
      `UPDATE admin_users SET session_token = ?, session_ablauf = ?, letzter_login = NOW() WHERE id = ?`,
      [newSessionToken, sessionExpiry, user.id]
    );

    const jwtToken = jwt.sign(
      {
        id: user.id,
        dojo_id: user.dojo_id,
        username: user.username,
        email: user.email,
        rolle: user.rolle
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`SSO-Login erfolgreich: ${user.email} (Dojo: ${user.dojoname})`);

    res.json({
      success: true,
      token: jwtToken,
      sessionToken: newSessionToken,
      user: {
        id: user.id,
        dojo_id: user.dojo_id,
        username: user.username,
        email: user.email,
        vorname: user.vorname,
        nachname: user.nachname,
        rolle: user.rolle,
        dojoname: user.dojoname,
        subdomain: user.subdomain
      }
    });

  } catch (error) {
    logger.error('SSO-Login-Fehler:', error);
    res.status(500).json({ success: false, error: 'SSO-Login fehlgeschlagen' });
  }
});

// ===================================================================
// ERROR HANDLING
// ===================================================================

router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Nicht gefunden'
  });
});

// Export both router and middleware
module.exports = router;
module.exports.authenticateHybrid = authenticateHybrid;
module.exports.authenticateToken = authenticateToken;
