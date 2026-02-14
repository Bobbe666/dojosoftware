/**
 * Session Configuration Module
 *
 * Implements secure session-based authentication with:
 * - HttpOnly cookies (XSS-resistant)
 * - MySQL session store (persistent)
 * - CSRF protection
 * - Session rotation on login
 */

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const crypto = require('crypto');

/**
 * Create MySQL session store
 * @param {object} dbPool - MySQL connection pool
 * @returns {MySQLStore} Session store instance
 */
const createSessionStore = (dbPool) => {
  const options = {
    // Use existing connection pool
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000, // 15 minutes
    expiration: 2 * 60 * 60 * 1000, // 2 hours (matches cookie maxAge)
    createDatabaseTable: false, // We create it via migration
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  };

  return new MySQLStore(options, dbPool);
};

/**
 * Session middleware configuration
 * @param {object} dbPool - MySQL connection pool
 * @returns {function} Express session middleware
 */
const createSessionMiddleware = (dbPool) => {
  const store = createSessionStore(dbPool);

  // Generate secure session secret if not provided
  const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

  if (!process.env.SESSION_SECRET) {
    console.warn('⚠️ [Security] SESSION_SECRET not set in .env - using random secret (sessions will not persist across restarts)');
  }

  return session({
    name: 'dojo_sid', // Cookie name (not 'connect.sid' for security)
    secret: sessionSecret,
    store: store,
    resave: false,
    saveUninitialized: false, // Don't create session until something stored
    rolling: true, // Reset expiration on each request (sliding session)

    cookie: {
      httpOnly: true,      // Not accessible via JavaScript (XSS protection)
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax',     // CSRF protection (allows top-level navigation)
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined // Allow subdomains if set
    }
  });
};

/**
 * Regenerate session (call after login for security)
 * Prevents session fixation attacks
 * @param {object} req - Express request
 * @returns {Promise}
 */
const regenerateSession = (req) => {
  return new Promise((resolve, reject) => {
    const oldSessionData = { ...req.session };
    delete oldSessionData.cookie; // Don't copy cookie config

    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }

      // Restore session data to new session
      Object.assign(req.session, oldSessionData);

      req.session.save((saveErr) => {
        if (saveErr) {
          return reject(saveErr);
        }
        resolve();
      });
    });
  });
};

/**
 * Destroy session (call on logout)
 * @param {object} req - Express request
 * @returns {Promise}
 */
const destroySession = (req) => {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
};

/**
 * Session-based authentication middleware
 * Checks if user is authenticated via session
 */
const requireSessionAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Nicht authentifiziert',
      code: 'SESSION_REQUIRED'
    });
  }

  // Attach user info to request for convenience
  req.user = {
    id: req.session.userId,
    email: req.session.email,
    username: req.session.username,
    role: req.session.role,
    dojo_id: req.session.dojoId
  };

  next();
};

/**
 * Role-based access control middleware
 * @param {...string} allowedRoles - Roles that can access
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.role) {
      return res.status(401).json({
        error: 'Nicht authentifiziert',
        code: 'SESSION_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({
        error: 'Keine Berechtigung',
        code: 'INSUFFICIENT_ROLE',
        required: allowedRoles
      });
    }

    next();
  };
};

/**
 * Dojo scope middleware
 * Ensures user can only access their own dojo's data
 * Super-admins bypass this check
 */
const requireDojoScope = (req, res, next) => {
  // Super-admin can access all dojos
  if (req.session.role === 'super_admin') {
    return next();
  }

  // Admin with null dojo_id is also super-admin (legacy)
  if (req.session.role === 'admin' && req.session.dojoId === null) {
    return next();
  }

  // Get target dojo from various sources
  const targetDojoId = parseInt(
    req.params.dojoId ||
    req.params.dojo_id ||
    req.query.dojo_id ||
    req.body?.dojo_id ||
    req.headers['x-tenant-subdomain-dojo-id']
  );

  if (targetDojoId && targetDojoId !== req.session.dojoId) {
    return res.status(403).json({
      error: 'Zugriff verweigert',
      message: 'Sie haben keinen Zugriff auf dieses Dojo',
      code: 'DOJO_SCOPE_VIOLATION'
    });
  }

  // Inject dojo_id for queries
  if (req.session.dojoId) {
    req.query.dojo_id = req.session.dojoId.toString();
  }

  next();
};

module.exports = {
  createSessionStore,
  createSessionMiddleware,
  regenerateSession,
  destroySession,
  requireSessionAuth,
  requireRole,
  requireDojoScope
};
