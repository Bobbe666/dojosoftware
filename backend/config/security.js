/**
 * Security Configuration Module
 *
 * Implements comprehensive security headers and middleware:
 * - Helmet for HTTP security headers
 * - Rate limiting
 * - CSRF protection
 * - Input sanitization helpers
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { doubleCsrf } = require('csrf-csrf');

// =============================================================================
// HELMET CONFIGURATION
// =============================================================================

/**
 * Helmet middleware with secure defaults
 * Customized for DojoSoftware requirements
 */
const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some React inline scripts
        "'unsafe-eval'",   // Required for some dependencies (remove if possible)
        "https://js.stripe.com",
        "https://checkout.stripe.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for styled-components/inline styles
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.stripe.com"
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://checkout.stripe.com",
        "wss://*.tda-intl.org" // WebSocket for real-time features
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://checkout.stripe.com"
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },

  // Cross-Origin settings
  crossOriginEmbedderPolicy: false, // Required for Stripe
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Allow Stripe popups
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow loading resources

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Frameguard (clickjacking protection)
  frameguard: { action: 'sameorigin' },

  // Hide X-Powered-By
  hidePoweredBy: true,

  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // IE No Open
  ieNoOpen: true,

  // No Sniff
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },

  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // XSS Filter (legacy, but still useful)
  xssFilter: true
});

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP
  message: {
    error: 'Zu viele Anfragen',
    message: 'Bitte warten Sie einige Minuten und versuchen Sie es erneut.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable IPv6 validation warning
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise remote IP
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  }
});

/**
 * Strict login rate limiter
 * 5 attempts per 15 minutes per IP + username combination
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    error: 'Zu viele Anmeldeversuche',
    message: 'Ihr Konto wurde vorübergehend gesperrt. Bitte warten Sie 15 Minuten.',
    code: 'LOGIN_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable IPv6 validation warning
  keyGenerator: (req) => {
    // Combine IP + username/email for more precise limiting
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const identifier = req.body?.email || req.body?.username || 'unknown';
    return `${ip}:${identifier}`;
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res, next, options) => {
    // Log rate limit hit for security monitoring
    console.warn(`🚨 [Security] Login rate limit exceeded for ${options.keyGenerator(req)}`);
    res.status(429).json(options.message);
  }
});

/**
 * Password reset rate limiter
 * 3 attempts per hour per email
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error: 'Zu viele Anfragen',
    message: 'Bitte warten Sie eine Stunde bevor Sie erneut ein Passwort-Reset anfordern.',
    code: 'PASSWORD_RESET_LIMIT'
  },
  validate: false, // Disable IPv6 validation warning
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    return req.body?.email || ip;
  }
});

/**
 * Registration rate limiter
 * 3 registrations per hour per IP
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error: 'Zu viele Registrierungen',
    message: 'Bitte warten Sie eine Stunde bevor Sie sich erneut registrieren.',
    code: 'REGISTRATION_LIMIT'
  },
  validate: false // Disable IPv6 validation warning
});

// =============================================================================
// CSRF PROTECTION
// =============================================================================

/**
 * CSRF Protection using Double Submit Cookie pattern
 * Works with both session and stateless modes
 */
const csrfConfig = {
  getSecret: () => process.env.CSRF_SECRET || process.env.SESSION_SECRET || 'csrf-fallback-secret',
  cookieName: 'dojo_csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  size: 64, // Token size in bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => {
    // Check multiple sources for CSRF token
    return (
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'] ||
      req.body?._csrf ||
      req.query?._csrf
    );
  }
};

// Create CSRF middleware
let csrfMiddleware = null;
let generateCsrfToken = null;

try {
  const { doubleCsrfProtection, generateToken } = doubleCsrf(csrfConfig);
  csrfMiddleware = doubleCsrfProtection;
  generateCsrfToken = generateToken;
} catch (error) {
  console.warn('⚠️ [Security] CSRF protection initialization failed:', error.message);
  // Fallback: No-op middleware
  csrfMiddleware = (req, res, next) => next();
  generateCsrfToken = () => 'csrf-disabled';
}

// =============================================================================
// SECURITY AUDIT LOGGING
// =============================================================================

/**
 * Log security-relevant events
 * @param {object} db - Database connection
 * @param {string} eventType - Type of event
 * @param {object} details - Event details
 */
const logSecurityEvent = async (db, eventType, details) => {
  try {
    await db.promise().execute(
      `INSERT INTO auth_audit_log (event_type, user_id, dojo_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        eventType,
        details.userId || null,
        details.dojoId || null,
        details.ipAddress || null,
        details.userAgent || null,
        JSON.stringify(details.extra || {})
      ]
    );
  } catch (error) {
    console.error('❌ [Security] Failed to log security event:', error.message);
  }
};

/**
 * Extract client info from request
 * @param {object} req - Express request
 * @returns {object} Client info
 */
const getClientInfo = (req) => {
  return {
    ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    userAgent: req.headers['user-agent'] || 'unknown'
  };
};

// =============================================================================
// ACCOUNT LOCKOUT
// =============================================================================

/**
 * Check if account is locked
 * @param {object} db - Database connection
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
const isAccountLocked = async (db, userId) => {
  const [rows] = await db.promise().execute(
    `SELECT locked_until FROM admin_users WHERE id = ? AND locked_until > NOW()`,
    [userId]
  );
  return rows.length > 0;
};

/**
 * Increment failed login attempts
 * Lock account after 5 failures
 * @param {object} db - Database connection
 * @param {number} userId - User ID
 */
const recordFailedLogin = async (db, userId) => {
  await db.promise().execute(
    `UPDATE admin_users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts >= 4 THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE)
           ELSE locked_until
         END
     WHERE id = ?`,
    [userId]
  );
};

/**
 * Reset failed login attempts on successful login
 * @param {object} db - Database connection
 * @param {number} userId - User ID
 * @param {string} ipAddress - Client IP
 */
const recordSuccessfulLogin = async (db, userId, ipAddress) => {
  await db.promise().execute(
    `UPDATE admin_users
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_login = NOW(),
         last_login_ip = ?
     WHERE id = ?`,
    [ipAddress, userId]
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Helmet
  helmetConfig,

  // Rate Limiters
  apiLimiter,
  loginLimiter,
  passwordResetLimiter,
  registrationLimiter,

  // CSRF
  csrfMiddleware,
  generateCsrfToken,

  // Security Logging
  logSecurityEvent,
  getClientInfo,

  // Account Lockout
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin
};
