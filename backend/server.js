
const Sentry = require("@sentry/node");
const express = require("express");
const db = require("./db");
const cors = require("cors");
const compression = require("compression");  // PERFORMANCE: Gzip Compression
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
require("dotenv").config();

// ── Sentry Fehler-Monitoring ──────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
  });
}

// JWT für Authentication
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');

// Session-basierte Authentifizierung (Phase 2 Security Upgrade)
const { createSessionMiddleware } = require('./config/session');

// Security Configuration (Helmet, Rate Limiting, CSRF)
const { loginLimiter, passwordResetLimiter } = require('./config/security');

// Strukturierter Logger
const logger = require("./utils/logger");

const app = express();

// Trust proxy - wichtig für Nginx/Apache Proxy-Setups
// 1 = trust first proxy only (Nginx), not any upstream proxies
app.set('trust proxy', 1);

// Security Headers mit Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Für Uploads
}));

// PERFORMANCE: Gzip Compression für alle Responses (außer Binärdateien)
app.use(compression({
  threshold: 1024,  // Nur Responses > 1KB komprimieren
  level: 6,         // Gzip Level (1-9, 6 ist guter Kompromiss)
  filter: (req, res) => {
    // Keine Kompression für bereits komprimierte Dateien
    if (req.path.match(/\.(zip|gz|pdf|jpg|jpeg|png|gif|webp)$/i)) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Rate Limiting - Schutz vor Brute Force
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Max 100 Requests pro IP
  message: 'Zu viele Anfragen von dieser IP, bitte später erneut versuchen.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Striktes Rate Limiting für Login/Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5, // Max 5 Login-Versuche
  message: 'Zu viele Login-Versuche, bitte später erneut versuchen.',
  skipSuccessfulRequests: true,
});

// Statische Dateien für Uploads servieren - MUSS VOR Content-Type Middleware kommen!
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// UTF-8 Encoding für JSON Responses (nicht für PDFs/Binärdaten)
app.use((req, res, next) => {
  // Überspringe PDF und andere Binär-Routen
  if (!req.path.includes('/pdf') && !req.path.includes('/export')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

// CORS mit Sicherheitskonfiguration
// WICHTIG: In Produktion MUSS ALLOWED_ORIGINS in .env gesetzt sein!
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5001'];

// Warnung wenn in Produktion keine ALLOWED_ORIGINS gesetzt sind
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
  logger.warn('⚠️ ALLOWED_ORIGINS nicht gesetzt! Bitte in .env konfigurieren für Produktion.');
}

app.use(cors({
  origin: (origin, callback) => {
    // SECURITY: In Produktion - Requests ohne Origin nur in Development erlauben
    // (Server-to-Server wie Webhooks werden über separate Routen mit eigener Auth gehandelt)
    if (!origin) {
      // CORS ist ein Browser-Mechanismus — Server-to-Server Requests (Webhooks etc.)
      // senden kein Origin-Header und umgehen CORS ohnehin.
      // false = kein ACAO-Header gesetzt → für nicht-Browser-Clients ohne Auswirkung.
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(null, false);
    }

    // Prüfe ob Origin in erlaubten Origins ist
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // Erlaube alle Subdomains von dojo.tda-intl.org (Multi-Tenant)
    // SECURITY: Nur exakte Subdomain-Pattern, keine Wildcards
    if (origin.match(/^https:\/\/[a-z0-9-]+\.dojo\.tda-intl\.org$/)) {
      return callback(null, true);
    }

    // Erlaube Haupt-Domain
    if (origin === 'https://dojo.tda-intl.org' || origin === 'https://www.dojo.tda-intl.org') {
      return callback(null, true);
    }

    // Erlaube tda-intl.org selbst
    if (origin === 'https://tda-intl.org' || origin === 'https://www.tda-intl.org') {
      return callback(null, true);
    }

    // Erlaube tda-intl.com (TDA Events Frontend)
    if (origin === 'https://tda-intl.com' || origin === 'https://www.tda-intl.com') {
      return callback(null, true);
    }

    // Erlaube events.tda-intl.org (TDA Events Platform)
    if (origin === 'https://events.tda-intl.org') {
      return callback(null, true);
    }

    // Erlaube hof.tda-intl.org (Hall of Fame Platform)
    if (origin === 'https://hof.tda-intl.org') {
      return callback(null, true);
    }

    // Erlaube bekannte tda-*.de Domains (explizite Whitelist — kein offener Regex)
    const tdaDeDomains = [
      'https://tda-vib.de',
      'https://www.tda-vib.de',
      'https://app.tda-vib.de',
    ];
    if (tdaDeDomains.includes(origin)) {
      return callback(null, true);
    }

    logger.warn('CORS abgelehnt', { origin });
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-XSRF-Token', 'X-Tenant-Subdomain'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'X-CSRF-Token'],
}));

// Body-Parser mit expliziter UTF-8 Konfiguration und 10MB Limit für PDF-HTML
app.use(express.json({ charset: 'utf-8', limit: '10mb' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8', limit: '10mb' }));

// =============================================
// SESSION MIDDLEWARE (Phase 2 Security Upgrade)
// =============================================
// Session-basierte Authentifizierung mit MySQL-Store
// HttpOnly Cookies für XSS-Schutz
try {
  const sessionMiddleware = createSessionMiddleware(db);
  app.use(sessionMiddleware);
  logger.success('Session-Middleware aktiviert', { store: 'MySQL', cookie: 'HttpOnly' });
} catch (error) {
  logger.error('Session-Middleware konnte nicht initialisiert werden', {
    error: error.message,
    hint: 'Stelle sicher, dass die sessions-Tabelle existiert (Migration 104)'
  });
}

// =============================================
// SECURITY MONITORING MIDDLEWARE
// =============================================
// Erkennt und blockiert Angriffe in Echtzeit (SQL-Injection, XSS, etc.)
const {
  securityMonitorMiddleware,
  trackFailedLoginMiddleware,
  fileUploadSecurityMiddleware,
  logUnauthorizedAccess
} = require('./middleware/securityMonitor');

// Security-Monitor für alle API-Requests
app.use('/api', securityMonitorMiddleware);

// Tracking für fehlgeschlagene Logins
app.use('/api/auth', trackFailedLoginMiddleware);

// Log für unbefugte Zugriffe
app.use(logUnauthorizedAccess);

logger.success('Security-Monitoring aktiviert', { features: ['SQL-Injection', 'XSS', 'Brute-Force', 'Path-Traversal'] });

// =============================================
// GLOBALES WRITE-AUDIT LOGGING
// =============================================
// Protokolliert automatisch ALLE POST/PUT/PATCH/DELETE-Requests mit User, IP, Body
// Läuft NACH Security-Monitor, NACH JSON-Parsing, NACH Auth-Middleware
// Eingebunden nach allen anderen globalen Middlewares, direkt vor den Routen
const writeAuditMiddleware = require('./middleware/writeAuditMiddleware');
app.use('/api', writeAuditMiddleware);
logger.success('Write-Audit-Logging aktiviert', { coverage: 'POST/PUT/PATCH/DELETE auf /api/*' });

// API Documentation mit Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'DojoSoftware API Documentation',
}));

// OpenAPI Spec als JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

logger.info('Swagger UI available at /api-docs');

// =============================================
// JWT AUTHENTICATION MIDDLEWARE
// =============================================
// MUSS VOR allen Routen definiert werden!
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Kein Token vorhanden" });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token ungültig oder abgelaufen" });
    }
    req.user = decoded;
    
    // ========== INLINE TENANT ISOLATION CHECK ==========
    const subdomain = req.headers["x-tenant-subdomain"];
    
    if (subdomain && subdomain !== "") {
      try {
        const [dojos] = await db.promise().query(
          "SELECT id, dojoname, subdomain FROM dojo WHERE subdomain = ? AND ist_aktiv = TRUE LIMIT 1",
          [subdomain]
        );
        
        if (dojos.length > 0) {
          const dojo = dojos[0];
          const userDojoId = decoded.dojo_id;
          const userRole = decoded.role || decoded.rolle;
          
          // Super-Admin (role=super_admin ODER admin mit dojo_id=null) darf alles
          const isSuperAdmin = (userRole === "super_admin") || 
                               (userRole === "admin" && userDojoId === null);
          
          // SICHERHEITSCHECK: User muss zum Dojo der Subdomain gehören!
          if (!isSuperAdmin && userDojoId !== null && userDojoId !== dojo.id) {
            logger.error("SICHERHEIT: User versucht fremde Subdomain!", {
              user_dojo_id: userDojoId,
              subdomain: subdomain,
              subdomain_dojo_id: dojo.id,
              user_email: decoded.email
            });
            return res.status(403).json({
              error: "Zugriff verweigert",
              message: "Sie haben keinen Zugriff auf dieses Dojo"
            });
          }
          
          // Tenant-Kontext setzen für nachfolgende Middleware/Routes
          req.tenant = {
            dojo_id: dojo.id,
            subdomain: dojo.subdomain,
            dojoname: dojo.dojoname
          };
          req.query.dojo_id = dojo.id.toString();
        }
      } catch (dbError) {
        logger.error("Tenant-Isolation DB-Fehler:", { error: dbError.message });
        // Bei DB-Fehler: Sicherer Abbruch
        return res.status(500).json({ error: "Interner Serverfehler" });
      }
    }
    // ========== ENDE TENANT ISOLATION CHECK ==========
    
    next();
  });
};

// =============================================
// TENANT ISOLATION MIDDLEWARE (GLOBAL)
// =============================================
// Wird später definiert, aber hier bereits als Platzhalter referenziert
// Die eigentliche Funktion wird weiter unten im Code definiert

// Database connection test
db.getConnection((err, connection) => {
  if (err) {
    logger.error('MySQL-Verbindungsfehler', {
      error: err.message,
      code: err.code,
      stack: err.stack
    });
    return;
  }
  logger.database('Mit MySQL-Datenbank verbunden', {
    threadId: connection.threadId
  });
  connection.release();
});

// =============================================
// MANUAL ROUTE LOADING - CHECKIN FIRST!
// =============================================

logger.info('Route-Loading gestartet', { mode: 'manual' });

// 1. ÖFFENTLICHE REGISTRIERUNG - HÖCHSTE PRIORITÄT (vor Authentifizierung)
try {
  const publicRegistrationRoutes = require('./routes/public-registration');
  app.use('/api/public', publicRegistrationRoutes);
  logger.success('Route geladen', { path: '/api/public' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'public registration',
    error: error.message,
    stack: error.stack
  });
}

// 1.0.1 ÖFFENTLICHE PROBETRAINING-BUCHUNG (vor Authentifizierung)
try {
  const publicProbetrainingRoutes = require('./routes/public-probetraining');
  app.use('/api/public/probetraining', publicProbetrainingRoutes);
  logger.success('Route geladen', { path: '/api/public/probetraining' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'public probetraining',
    error: error.message,
    stack: error.stack
  });
}

// 1.0.15 ÖFFENTLICHE PRÜFUNGSANMELDUNGEN (vor Authentifizierung)
try {
  const publicPruefungenRoutes = require('./routes/public-pruefungen');
  app.use('/api/public/pruefungen', publicPruefungenRoutes);
  logger.success('Route geladen', { path: '/api/public/pruefungen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'public pruefungen',
    error: error.message,
    stack: error.stack
  });
}

// 1.0.2 ÖFFENTLICHER STUNDENPLAN (vor Authentifizierung)
try {
  const publicStundenplanRoutes = require('./routes/public-stundenplan');
  app.use('/api/public/stundenplan', publicStundenplanRoutes);
  logger.success('Route geladen', { path: '/api/public/stundenplan' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'public stundenplan',
    error: error.message,
    stack: error.stack
  });
}

try {
  const publicEventsRoutes = require('./routes/public-events');
  app.use('/api/public/events', publicEventsRoutes);
  logger.success('Route geladen', { path: '/api/public/events' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'public events',
    error: error.message,
    stack: error.stack
  });
}

// 1.0.3b PUBLIC NEWS (JSON-API, Widget, RSS)
try {
  const publicNewsRoutes = require('./routes/public-news');
  app.use('/api/public/news', publicNewsRoutes);
  logger.success('Route geladen', { path: '/api/public/news' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'public-news',
    error: error.message,
    stack: error.stack
  });
}

// 1.0.4 VISITOR CHAT (Widget + öffentliche & Auth-Endpunkte für Besucher-Chat)
try {
  const visitorChatRoutes = require('./routes/visitor-chat');
  app.use('/api/visitor-chat', visitorChatRoutes);
  logger.success('Route geladen', { path: '/api/visitor-chat' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'visitor-chat',
    error: error.message,
    stack: error.stack
  });
}

// 1.0.3 PROMO / EARLY-BIRD AKTIONEN (PUBLIC)
try {
  const promoRoutes = require('./routes/promo');
  app.use('/api/promo', (req, res, next) => { req.db = db; next(); }, promoRoutes);
  logger.success('Route geladen', { path: '/api/promo' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'promo',
    error: error.message,
    stack: error.stack
  });
}

// 1.1 DOJO ONBOARDING (SaaS Multi-Tenant Registration)
try {
  const dojoOnboardingRoutes = require('./routes/dojo-onboarding');
  app.use('/api/onboarding', dojoOnboardingRoutes);
  logger.success('Route geladen', { path: '/api/onboarding' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'dojo-onboarding',
    error: error.message,
    stack: error.stack
  });
}

// 1.2 SUBSCRIPTION MANAGEMENT
try {
  const subscriptionRoutes = require('./routes/subscription');
  app.use('/api/subscription', subscriptionRoutes);
  logger.success('Route geladen', { path: '/api/subscription' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'subscription',
    error: error.message,
    stack: error.stack
  });
}

// 1.2b SAAS STRIPE (Plan-Upgrades via Stripe)
try {
  const saasStripeRoutes = require('./routes/saas-stripe');
  // Webhook braucht raw body, daher spezielles Handling
  app.use('/api/saas-stripe/webhook', express.raw({ type: 'application/json' }), saasStripeRoutes);
  app.use('/api/saas-stripe', saasStripeRoutes);
  logger.success('Route geladen', { path: '/api/saas-stripe' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'saas-stripe',
    error: error.message,
    stack: error.stack
  });
}

// 1.1 BUDDY-GRUPPEN & EINLADUNGEN
try {
  const buddyRoutes = require(path.join(__dirname, 'routes', 'buddy.js'));
  app.use('/api/buddy', (req, res, next) => { req.db = db; next(); }, buddyRoutes);
  logger.success('Route gemountet', { path: '/api/buddy' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'buddy',
      error: error.message,
      stack: error.stack
    });
}

// 1.2 MARKETING-AKTIONEN (Social Media Integration)
try {
  const marketingAktionenRoutes = require(path.join(__dirname, 'routes', 'marketing-aktionen.js'));
  app.use('/api/marketing-aktionen', authenticateToken, (req, res, next) => { req.db = db.promise(); next(); }, marketingAktionenRoutes);
  logger.success('Route gemountet', { path: '/api/marketing-aktionen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', { route: 'marketing-aktionen', error: error.message, stack: error.stack });
}

// 1.3 MARKETING-JAHRESPLAN
try {
  const marketingJahresplanRoutes = require(path.join(__dirname, 'routes', 'marketing-jahresplan.js'));
  app.use('/api/marketing-jahresplan', authenticateToken, (req, res, next) => { req.db = db.promise(); next(); }, marketingJahresplanRoutes);
  logger.success('Route gemountet', { path: '/api/marketing-jahresplan' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', { route: 'marketing-jahresplan', error: error.message, stack: error.stack });
}

// 1.4 REFERRAL (Freunde werben Freunde)
try {
  const referralRoutes = require(path.join(__dirname, 'routes', 'referral.js'));
  app.use('/api/referral', authenticateToken, (req, res, next) => { req.db = db.promise(); next(); }, referralRoutes);
  logger.success('Route gemountet', { path: '/api/referral' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', { route: 'referral', error: error.message, stack: error.stack });
}

// AUTH ROUTES (Login, Token, Passwortänderung/Reset) - mit strenger Rate Limiting
// Verwendet loginLimiter aus config/security.js (IP+Username Kombination)
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  logger.success('Route gemountet', { path: '/api/auth (mit Enhanced Rate Limiting)' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'auth routes',
      error: error.message,
      stack: error.stack
    });
}

// ADMIN ROUTES (Super-Admin Dashboard für TDA International)
try {
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', authenticateToken, adminRoutes);
  logger.success('Route gemountet', { path: '/api/admin (admin.js)' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'admin routes',
      error: error.message,
      stack: error.stack
    });
}

// ADMIN SUB-ROUTES (Modularisierte Admin-Funktionen: SaaS-Settings, Dojos, etc.)
try {
  const adminSubRoutes = require('./routes/admin/index');
  app.use('/api/admin', authenticateToken, adminSubRoutes);
  logger.success('Route gemountet', { path: '/api/admin (admin/index.js)' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'admin sub-routes',
      error: error.message,
      stack: error.stack
    });
}

// ADMINS ROUTES (Admin-Benutzerverwaltung & Passwort-Management)
try {
  const adminsRoutes = require('./routes/admins');
  app.use('/api/admins', authenticateToken, adminsRoutes);
  logger.success('Route gemountet', { path: '/api/admins' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'admins routes',
      error: error.message,
      stack: error.stack
    });
}

// AUDIT-LOG ROUTES (Protokollierung aller Änderungen)
try {
  const auditLogRoutes = require('./routes/audit-log');
  app.use('/api/audit-log', authenticateToken, auditLogRoutes);
  logger.success('Route gemountet', { path: '/api/audit-log' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'audit-log routes',
      error: error.message,
      stack: error.stack
    });
}

// SECURITY-ADMIN ROUTES (Sicherheitswarnungen & IP-Blockierung)
try {
  const securityAdminRoutes = require('./routes/security-admin');
  app.use('/api/security', securityAdminRoutes);
  logger.success('Route gemountet', { path: '/api/security' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'security-admin routes',
      error: error.message,
      stack: error.stack
    });
}

// BUCHHALTUNG ROUTES (EÜR - Einnahmen-Überschuss-Rechnung)
try {
  const buchhaltungRoutes = require('./routes/buchhaltung');
  app.use('/api/buchhaltung', authenticateToken, buchhaltungRoutes);
  logger.success('Route gemountet', { path: '/api/buchhaltung' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'buchhaltung routes',
      error: error.message,
      stack: error.stack
    });
}

// STEUER ROUTES (UStVA-Vorschau, ELSTER-XML, EÜR-Jahresübersicht)
try {
  const steuerRouter = require(path.join(__dirname, "routes", "steuer.js"));
  app.use("/api/steuer", authenticateToken, steuerRouter);
  logger.success('Route gemountet', { path: '/api/steuer' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'steuer',
      error: error.message,
      stack: error.stack
    });
}

// EMAIL-SETTINGS ROUTES (globale und Dojo-spezifische E-Mail-Konfiguration)
try {
  const emailSettingsRoutes = require('./routes/email-settings');
  app.use('/api/email-settings', authenticateToken, emailSettingsRoutes);
  logger.success('Route gemountet', { path: '/api/email-settings' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'email-settings routes',
      error: error.message,
      stack: error.stack
    });
}

// SUPPORT-TICKETS ROUTES
try {
  const supportTicketsRoutes = require('./routes/support-tickets');
  app.use('/api/support-tickets', authenticateToken, supportTicketsRoutes);
  logger.success('Route gemountet', { path: '/api/support-tickets' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'support-tickets routes',
      error: error.message,
      stack: error.stack
    });
}

// FEATURE-REQUESTS ROUTES (Wunschliste/Feedback)
try {
  const featureRequestsRoutes = require('./routes/feature-requests');
  app.use('/api/feature-requests', authenticateToken, featureRequestsRoutes);
  logger.success('Route gemountet', { path: '/api/feature-requests' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'feature-requests routes',
      error: error.message,
      stack: error.stack
    });
}

// TDA EXPORT API ROUTES (für TDA Software Integration)
try {
  const tdaExportRoutes = require('./routes/tda-export');
  app.use('/api/tda-export', tdaExportRoutes);
  logger.success('Route gemountet', { path: '/api/tda-export' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'tda-export routes',
      error: error.message,
      stack: error.stack
    });
}

// AGB & DATENSCHUTZ ROUTES mit Versionierung
try {
  const agbRoutes = require('./routes/agb');
  app.use('/api/agb', (req, res, next) => { req.db = db; next(); }, agbRoutes);
  logger.success('Route gemountet', { path: '/api/agb' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'agb',
      error: error.message,
      stack: error.stack
    });
}

// 2. ARTIKEL ROUTES - VERKAUFSSYSTEM
try {
  const artikelRoutes = require('./routes/artikel');
  app.use('/api/artikel', artikelRoutes);
  logger.success('Route geladen', { path: '/api/artikel' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'artikel routes',
      error: error.message,
      stack: error.stack
    });
}

// 2.1. ARTIKELGRUPPEN ROUTES - ARTIKEL-KATEGORIEN
try {
  const artikelgruppenRoutes = require('./routes/artikelgruppen');
  app.use('/api/artikelgruppen', authenticateToken, artikelgruppenRoutes);
  logger.success('Route geladen', { path: '/api/artikelgruppen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'artikelgruppen routes',
      error: error.message,
      stack: error.stack
    });
}

// 2.2. ARTIKEL BESTELLUNGEN ROUTES - BESTELLSYSTEM
try {
  const artikelBestellungenRoutes = require('./routes/artikelBestellungen');
  app.use('/api/artikel-bestellungen', artikelBestellungenRoutes);
  logger.success('Route geladen', { path: '/api/artikel-bestellungen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'artikel-bestellungen routes',
      error: error.message,
      stack: error.stack
    });
}

// 2.3. SHOP ROUTES — TDA + Dojo Shops (Public + Admin)
try {
  const shopRoutes = require('./routes/shop');
  app.use('/api/shop', shopRoutes);
  logger.success('Route geladen', { path: '/api/shop' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'shop routes',
    error: error.message,
    stack: error.stack
  });
}

// Mitglieder-Detail und Mitglieder-Routen
try {
  const mitgliedDetailRoutes = require('./routes/mitglieddetail');
  app.use('/api/mitglieddetail', mitgliedDetailRoutes);
  logger.success('Route gemountet', { path: '/api/mitglieddetail' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'mitglieddetail',
      error: error.message,
      stack: error.stack
    });
}

try {
  const mitgliederRoutes = require('./routes/mitglieder');
  app.use('/api/mitglieder', authenticateToken, mitgliederRoutes);
  logger.success('Route gemountet', { path: '/api/mitglieder' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'mitglieder',
      error: error.message,
      stack: error.stack
    });
}
try {
  const mitgliederDokumenteRoutes = require('./routes/mitgliederDokumente');
  app.use('/api/mitglieder', authenticateToken, mitgliederDokumenteRoutes);
  logger.success('Route gemountet', { path: '/api/mitglieder/dokumente' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'mitgliederDokumente',
      error: error.message,
      stack: error.stack
    });
}

// EHEMALIGE MITGLIEDER ROUTES
try {
  const ehemaligeRoutes = require('./routes/ehemalige');
  app.use('/api/ehemalige', ehemaligeRoutes);
  logger.success('Route gemountet', { path: '/api/ehemalige' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'ehemalige',
      error: error.message,
      stack: error.stack
    });
}

// INTERESSENTEN ROUTES
try {
  const interessentenRoutes = require('./routes/interessenten');
  app.use('/api/interessenten', interessentenRoutes);
  logger.success('Route gemountet', { path: '/api/interessenten' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'interessenten',
      error: error.message,
      stack: error.stack
    });
}

// 10ER-KARTEN ROUTES
try {
  const zehnerkartenRoutes = require('./routes/zehnerkarten');
  app.use('/api', zehnerkartenRoutes);
  logger.success('Route gemountet', { path: '/api/zehnerkarten & /api/mitglieder/:id/zehnerkarten' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'zehnerkarten',
      error: error.message,
      stack: error.stack
    });
}

// ENTFERNT: Alte hardcodierte stile.js Route - wird durch stileguertel.js ersetzt (weiter unten)
// Die neue Route hat vollständige CRUD-Funktionalität mit Datenbankanbindung

// 2. VERKÄUFE ROUTES - KASSENSYSTEM
try {
  const verkaeufeRoutes = require('./routes/verkaeufe');
  app.use('/api/verkaeufe', verkaeufeRoutes);
  logger.success('Route geladen', { path: '/api/verkaeufe' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'verkäufe routes',
      error: error.message,
      stack: error.stack
    });
}

// 2.1 STUNDENPLAN ROUTES
try {
  const stundenplanRoutes = require('./routes/stundenplan');
  app.use('/api/stundenplan', authenticateToken, stundenplanRoutes);
  logger.success('Route geladen', { path: '/api/stundenplan' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'stundenplan routes',
      error: error.message,
      stack: error.stack
    });
}

// 2.2 STANDORTE ROUTES (Multi-Location Management)
try {
  const standorteRoutes = require('./routes/standorte');
  app.use('/api/standorte', authenticateToken, standorteRoutes);
  logger.success('Route geladen', { path: '/api/standorte' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'standorte routes',
      error: error.message,
      stack: error.stack
    });
}

// 2.3 RAEUME ROUTES (Room Management)
try {
  const raeumeRoutes = require('./routes/raeume');
  app.use('/api/raeume', authenticateToken, raeumeRoutes);
  logger.success('Route geladen', { path: '/api/raeume' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'raeume routes',
      error: error.message,
      stack: error.stack
    });
}

// 2.4 KURSE ROUTES (Course Management)
try {
  const kurseRoutes = require('./routes/kurse');
  app.use('/api/kurse', authenticateToken, kurseRoutes);
  logger.success('Route geladen', { path: '/api/kurse' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'kurse routes',
      error: error.message,
      stack: error.stack
    });
}

// 2.5 TRAINER ROUTES (Trainer Management)
try {
  const trainerRoutes = require('./routes/trainer');
  app.use('/api/trainer', authenticateToken, trainerRoutes);
  logger.success('Route geladen', { path: '/api/trainer' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'trainer routes',
      error: error.message,
      stack: error.stack
    });
}

// LASTSCHRIFT-EINVERSTÄNDNIS — Öffentlicher Formular-Endpunkt MUSS vor authenticateToken stehen
try {
  const lastschriftRouter = require('./routes/lastschriftEinverstaendnis');
  // Öffentlich: /formular/:token (kein Login)
  app.use('/api/lastschrift-einverstaendnis/formular', lastschriftRouter);
  // Admin (auth): alle anderen Endpunkte
  app.use('/api/lastschrift-einverstaendnis', authenticateToken, lastschriftRouter);
  logger.success('Route geladen', { path: '/api/lastschrift-einverstaendnis' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', { route: 'lastschrift-einverstaendnis', error: error.message });
}

// 3. CHECKIN ROUTE - HIGHEST PRIORITY
try {
  const checkinPath = path.join(__dirname, "routes", "checkin.js");
  logger.debug('Lade Checkin-Route', { path: checkinPath });
  logger.debug('Checkin-Datei Existenz', { exists: fs.existsSync(checkinPath) });
  
  const checkinRoute = require(checkinPath);
  logger.debug('Checkin-Route geladen', { type: typeof checkinRoute });
  
  app.use("/api/checkin", authenticateToken, checkinRoute);
  logger.success('Route gemountet', { path: '/api/checkin' });
  
} catch (error) {
  logger.error('Checkin-Loading fehlgeschlagen', { error: error.message });
  logger.error('Checkin Stack-Trace', { stack: error.stack });
}

// 3.1. ANWESENHEIT ROUTE
try {
  const anwesenheitRoutes = require('./routes/anwesenheit');
  app.use('/api/anwesenheit', authenticateToken, anwesenheitRoutes);
  logger.success('Route geladen', { path: '/api/anwesenheit' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
    route: 'anwesenheit routes',
    error: error.message,
    stack: error.stack
  });
}

// 4. KURS-BEWERTUNG ROUTES
try {
  const courseRatingRoutes = require('./routes/courseRating');
  app.use('/api', courseRatingRoutes);
  logger.success('Route geladen', { path: '/api/course-rating' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'course rating routes',
      error: error.message,
      stack: error.stack
    });
}

// 2. DOJO EINSTELLUNGEN
try {
  const einstellungendojo = require(path.join(__dirname, "routes", "einstellungendojo.js"));
  app.use("/api/dojo", einstellungendojo);
  logger.success('Route gemountet', { path: '/api/dojo' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'einstellungendojo',
      error: error.message,
      stack: error.stack
    });
}

// 2.1 ADMIN-VERWALTUNG - bereits bei Zeile 276 geladen, hier übersprungen
// (war doppelt geladen - jetzt modularisiert in routes/admin/)

// 3. TARIFE
try {
  const tarifeRouter = require(path.join(__dirname, "routes", "tarife.js"));
  app.use("/api/tarife", authenticateToken, tarifeRouter);
  logger.success('Route gemountet', { path: '/api/tarife' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'tarife',
      error: error.message,
      stack: error.stack
    });
}

// Temporärer Migrations-Endpoint
try {
  const migrateRouter = require(path.join(__dirname, "routes", "migrate.js"));
  app.use("/api/migrate", migrateRouter);
  logger.success('Route gemountet', { path: '/api/migrate' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'migrate',
      error: error.message,
      stack: error.stack
    });
}

// 4. STIL-VERWALTUNG (Gürtel & Graduierungen) - MODULAR REFACTORED
try {
  const stileRouter = require(path.join(__dirname, "routes", "stile"));
  app.use("/api/stile", stileRouter);
  logger.success('Route gemountet', { path: '/api/stile', file: 'stile/index.js' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'stile',
      error: error.message,
      stack: error.stack
    });
}

// 5. VERTRÄGE (für Beitragsverwaltung) - MODULAR REFACTORED
try {
  const vertraegeRouter = require(path.join(__dirname, "routes", "vertraege"));
  app.use("/api/vertraege", vertraegeRouter);
  logger.success('Route gemountet', { path: '/api/vertraege', file: 'vertraege/index.js' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'vertraege',
      error: error.message,
      stack: error.stack
    });
}

// VERTRAGSVORLAGEN (GrapesJS Template Editor)
try {
  const vertragsvorlagenRouter = require(path.join(__dirname, "routes", "vertragsvorlagen.js"));
  app.use("/api/vertragsvorlagen", authenticateToken, vertragsvorlagenRouter);
  logger.success('Route gemountet', { path: '/api/vertragsvorlagen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'vertragsvorlagen',
      error: error.message,
      stack: error.stack
    });
// VERTRAG-ANPASSUNGEN (Mitglied-seitige Anpassungsanträge)try {  const vertragAnpassungenRouter = require(path.join(__dirname, "routes", "vertrag-anpassungen.js"));  app.use("/api/vertrag-anpassungen", authenticateToken, vertragAnpassungenRouter);  logger.success("Route gemountet", { path: "/api/vertrag-anpassungen" });} catch (error) {  logger.error("Fehler beim Laden der Route", {    route: "vertrag-anpassungen",    error: error.message  });}
}

// VORLAGEN (E-Mail/Brief-Vorlagen)
try {
  const vorlagenRouter = require(path.join(__dirname, "routes", "vorlagen.js"));
  app.use("/api/vorlagen", authenticateToken, vorlagenRouter);
  logger.success('Route gemountet', { path: '/api/vorlagen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'vorlagen',
      error: error.message,
      stack: error.stack
    });
}

// ABSENDER-PROFILE (Briefkopf-Verwaltung)
try {
  const absenderProfileRouter = require(path.join(__dirname, "routes", "absender-profile.js"));
  app.use("/api/absender-profile", authenticateToken, absenderProfileRouter);
  logger.success('Route gemountet', { path: '/api/absender-profile' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'absender-profile',
      error: error.message,
      stack: error.stack
    });
}

// BRIEF-EINSTELLUNGEN (DIN 5008, Schrift, Fußzeile, Standard-Profil)
try {
  const briefEinstellungenRouter = require(path.join(__dirname, "routes", "brief-einstellungen.js"));
  app.use("/api/brief-einstellungen", authenticateToken, briefEinstellungenRouter);
  logger.success('Route gemountet', { path: '/api/brief-einstellungen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'brief-einstellungen',
      error: error.message,
      stack: error.stack
    });
}

// DOJO-EINSTELLUNGEN (Stammdaten: Name, Adresse, Bank, Steuer)
try {
  const dojoEinstellungenRouter = require(path.join(__dirname, "routes", "dojo-einstellungen.js"));
  app.use("/api/dojo-einstellungen", authenticateToken, dojoEinstellungenRouter);
  logger.success('Route gemountet', { path: '/api/dojo-einstellungen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'dojo-einstellungen',
      error: error.message,
      stack: error.stack
    });
}

// TEXTBAUSTEINE (wiederverwendbare HTML-Textblöcke für Vorlagen)
try {
  const textbausteineRouter = require(path.join(__dirname, "routes", "textbausteine.js"));
  app.use("/api/textbausteine", authenticateToken, textbausteineRouter);
  logger.success('Route gemountet', { path: '/api/textbausteine' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'textbausteine',
      error: error.message,
      stack: error.stack
    });
}

// VERSANDHISTORIE (Archiv aller gesendeten Vorlagen/E-Mails)
try {
  const versandhistorieRouter = require(path.join(__dirname, "routes", "versandhistorie.js"));
  app.use("/api/versandhistorie", authenticateToken, versandhistorieRouter);
  logger.success('Route gemountet', { path: '/api/versandhistorie' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'versandhistorie',
      error: error.message,
      stack: error.stack
    });
}

// 6. ZAHLUNGSZYKLEN (für Tarife) - NEU
try {
  const zahlungszyklenRouter = require(path.join(__dirname, "routes", "zahlungszyklen.js"));
  app.use("/api/zahlungszyklen", zahlungszyklenRouter);
  logger.success('Route gemountet', { path: '/api/zahlungszyklen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'zahlungszyklen',
      error: error.message,
      stack: error.stack
    });
}

// 7. DASHBOARD (Statistiken & Recent Activities) - NEU
try {
  const dashboardRouter = require(path.join(__dirname, "routes", "dashboard.js"));
  app.use("/api/dashboard", authenticateToken, dashboardRouter);
  logger.success('Route gemountet', { path: '/api/dashboard' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'dashboard',
      error: error.message,
      stack: error.stack
    });
}

// 7. LAUFZEITEN (für Tarife) - NEU
try {
  const laufzeitenRouter = require(path.join(__dirname, "routes", "laufzeiten.js"));
  app.use("/api/laufzeiten", laufzeitenRouter);
  logger.success('Route gemountet', { path: '/api/laufzeiten' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'laufzeiten',
      error: error.message,
      stack: error.stack
    });
}

// 8. PAYMENT PROVIDER (Stripe + DATEV Integration) - NEU
try {
  const paymentProviderRouter = require(path.join(__dirname, "routes", "paymentProvider.js"));
  app.use("/api/payment-provider", paymentProviderRouter);
  logger.success('Route gemountet', { path: '/api/payment-provider' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'paymentProvider',
      error: error.message,
      stack: error.stack
    });
}

// 8.1 SUMUP (Kartenterminal-Zahlungen) - NEU
try {
  const sumupRouter = require(path.join(__dirname, "routes", "sumup.js"));
  app.use("/api/sumup", sumupRouter);
  logger.success('Route gemountet', { path: '/api/sumup' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'sumup',
      error: error.message,
      stack: error.stack
    });
}

// 9. AUSWERTUNGEN (Analytics & Reports) - NEU
try {
  const auswertungenRouter = require(path.join(__dirname, "routes", "auswertungen.js"));
  app.use("/api/auswertungen", auswertungenRouter);
  logger.success('Route gemountet', { path: '/api/auswertungen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'auswertungen',
      error: error.message,
      stack: error.stack
    });
}

// 10. EVENTS (Veranstaltungen & Anmeldungen) - NEU
try {
  const eventsRouter = require(path.join(__dirname, "routes", "events.js"));
  app.use("/api/events", eventsRouter);
  logger.success('Route gemountet', { path: '/api/events' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'events',
      error: error.message,
      stack: error.stack
    });
}

// 10.1. TDA TURNIERE (Webhook + Frontend API für TDA Turnier-Integration)
try {
  const tdaTurniereRouter = require(path.join(__dirname, "routes", "tda-turniere.js"));
  app.use("/api/tda-turniere", tdaTurniereRouter);
  logger.success('Route gemountet', { path: '/api/tda-turniere' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'tda-turniere',
      error: error.message,
      stack: error.stack
    });
}

// 9.5. MIGRATION ROUTES - NEU
try {
  const migrationRouter = require(path.join(__dirname, "routes", "migration.js"));
  app.use("/api/migration", migrationRouter);
  logger.success('Route gemountet', { path: '/api/migration' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'migration',
      error: error.message,
      stack: error.stack
    });
}

// 9.6. MAGICLINE IMPORT ROUTES - NEU
try {
  const magiclineImportRouter = require(path.join(__dirname, "routes", "magicline-import.js"));
  app.use("/api/magicline-import", magiclineImportRouter);
  logger.success('Route gemountet', { path: '/api/magicline-import' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'magicline-import',
      error: error.message,
      stack: error.stack
    });
}

// 9.7. CSV IMPORT ROUTES - Mitglieder aus CSV importieren
try {
  const csvImportRouter = require(path.join(__dirname, "routes", "csv-import.js"));
  app.use("/api/csv-import", csvImportRouter);
  logger.success('Route gemountet', { path: '/api/csv-import' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'csv-import',
      error: error.message,
      stack: error.stack
    });
}

// 10. FORTSCHRITT-TRACKING (Member Progress) - NEU
try {
  const fortschrittRouter = require(path.join(__dirname, "routes", "fortschritt.js"));
  app.use("/api/fortschritt", fortschrittRouter);
  logger.success('Route gemountet', { path: '/api/fortschritt' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'fortschritt',
      error: error.message,
      stack: error.stack
    });
}

// 10.1 BADGES & MANUELLE TRAININGSSTUNDEN - NEU
try {
  const badgesRouter = require(path.join(__dirname, "routes", "badges.js"));
  app.use("/api/badges", authenticateToken, badgesRouter);
  logger.success('Route gemountet', { path: '/api/badges' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'badges',
      error: error.message,
      stack: error.stack
    });
}

// 10.2 iCAL EXPORT - Kalender-Sync für Google, Outlook, Apple
try {
  const icalRouter = require(path.join(__dirname, "routes", "ical.js"));
  app.use("/api/ical", icalRouter);
  logger.success('Route gemountet', { path: '/api/ical' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'ical',
      error: error.message,
      stack: error.stack
    });
}

// 10.2b SUPER-ADMIN KALENDER — iCloud Sync
try {
  const saCalRouter = require(path.join(__dirname, "routes", "super-admin-calendar.js"));
  app.use("/api/admin/calendar", authenticateToken, saCalRouter);
  logger.success("Route gemountet", { path: "/api/admin/calendar" });
} catch (error) {
  logger.error("Fehler beim Laden der Route", { route: "super-admin-calendar", error: error.message });
}

// 10.2c DEMO-TERMIN BUCHUNGSSYSTEM
try {
  const demoTermineRouter = require(path.join(__dirname, "routes", "demo-termine.js"));
  // Öffentlich: /api/demo-termine/slots|buchung|bestaetigung/:token
  // Admin:      /api/demo-termine/admin/slots|buchungen|stats  (auth per Route)
  app.use("/api/demo-termine", demoTermineRouter);
  logger.success("Route gemountet", { path: "/api/demo-termine" });
} catch (error) {
  logger.error("Fehler beim Laden der Route", { route: "demo-termine", error: error.message });
}

// Gutschein-System (Premium Feature)
// Öffentlich: GET /api/gutscheine/public/:code  (kein Auth erforderlich — in Route definiert)
// Geschützt:  alle anderen /api/gutscheine/... Endpunkte (requireFeature('gutscheine'))
try {
  const gutscheineRouter = require(path.join(__dirname, "routes", "gutscheine.js"));
  app.use("/api/gutscheine", gutscheineRouter);
  logger.success("Route gemountet", { path: "/api/gutscheine" });
} catch (error) {
  logger.error("Fehler beim Laden der Route", { route: "gutscheine", error: error.message });
}

// 10.3 WEBHOOKS - Zapier & externe Integrationen
try {
  const webhooksRouter = require(path.join(__dirname, "routes", "webhooks.js"));
  app.use("/api/webhooks", webhooksRouter);
  logger.success('Route gemountet', { path: '/api/webhooks' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'webhooks',
      error: error.message,
      stack: error.stack
    });
}

// 10.4 INTEGRATIONS - PayPal, LexOffice, DATEV
try {
  const integrationsRouter = require(path.join(__dirname, "routes", "integrations.js"));
  app.use("/api/integrations", integrationsRouter);
  logger.success('Route gemountet', { path: '/api/integrations' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'integrations',
      error: error.message,
      stack: error.stack
    });
}

// 10.5 VERBANDSMITGLIEDSCHAFTEN - TDA International Dojo & Einzelmitgliedschaften - MODULAR REFACTORED
try {
  const verbandsmitgliedschaftenRouter = require(path.join(__dirname, "routes", "verbandsmitgliedschaften"));
  app.use("/api/verbandsmitgliedschaften", verbandsmitgliedschaftenRouter);
  logger.success('Route gemountet', { path: '/api/verbandsmitgliedschaften', file: 'verbandsmitgliedschaften/index.js' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'verbandsmitgliedschaften',
      error: error.message,
      stack: error.stack
    });
}

// 10.6 VERBAND-AUTH - Login/Register für Verbandsmitglieder-Portal
try {
  const verbandAuthRouter = require(path.join(__dirname, "routes", "verband-auth.js"));
  app.use("/api/verband-auth", verbandAuthRouter);
  logger.success('Route gemountet', { path: '/api/verband-auth' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'verband-auth',
      error: error.message,
      stack: error.stack
    });
}

// 10.7 VERBAND-RECHNUNGEN - Rechnungserstellung für TDA International
try {
  const verbandRechnungenRouter = require(path.join(__dirname, "routes", "verband-rechnungen.js"));
  app.use("/api/verband-rechnungen", verbandRechnungenRouter);
  logger.success('Route gemountet', { path: '/api/verband-rechnungen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'verband-rechnungen',
      error: error.message,
      stack: error.stack
    });
}

try {
  const verbandUrkundenRouter = require(path.join(__dirname, "routes", "verband-urkunden.js"));
  app.use("/api/verband-urkunden", verbandUrkundenRouter);
  logger.success('Route gemountet', { path: '/api/verband-urkunden' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'verband-urkunden',
      error: error.message,
      stack: error.stack
    });
}

// NATIONALKADER
try {
  const nationalkaderRouter = require(path.join(__dirname, "routes", "nationalkader.js"));
  app.use("/api/nationalkader", nationalkaderRouter);
  logger.success('Route gemountet', { path: '/api/nationalkader' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'nationalkader',
      error: error.message,
      stack: error.stack
    });
}

// 11. DOKUMENTE (PDF Management & Reports) - NEU
try {
  const dokumenteRouter = require(path.join(__dirname, "routes", "dokumente.js"));

  // Middleware um DB-Connection zu den Routes zu geben
  app.use("/api/dokumente", (req, res, next) => {
    req.db = db;
    next();
  }, dokumenteRouter);

  logger.success('Route gemountet', { path: '/api/dokumente' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'dokumente',
      error: error.message,
      stack: error.stack
    });
}

// =============================================
// TENANT ISOLATION MIDDLEWARE
// =============================================
// Subdomains → strikte Dojo-Zuordnung
// Hauptdomain → freie Dojo-Wahl via Switcher
// TENANT ISOLATION MIDDLEWARE - MIT SICHERHEITS-CHECK
// =============================================
// Subdomains → strikte Dojo-Zuordnung mit User-Validierung
// Hauptdomain → freie Dojo-Wahl via Switcher (nur für Super-Admin)
const tenantIsolationMiddleware = async (req, res, next) => {
  const subdomain = req.headers['x-tenant-subdomain'];

  // Hauptdomain (kein Subdomain-Header)
  if (!subdomain || subdomain === '') {
    const userDojoId = req.user?.dojo_id;
    const userRole = req.user?.role || req.user?.rolle;

    if (userDojoId && userRole !== 'super_admin') {
      req.query.dojo_id = userDojoId.toString();
      logger.debug('Hauptdomain-Request - User dojo_id erzwungen', {
        url: req.url,
        user_dojo_id: userDojoId,
        forced_dojo_id: req.query.dojo_id
      });
    }
    return next();
  }

  // Subdomain → Tenant-Isolation aktivieren
  // Nur für authentifizierte User prüfen - sonst kümmert sich die Route selbst um Auth (401)
  if (!req.user) {
    return next();
  }

  try {
    const [dojos] = await db.promise().query(
      'SELECT id, dojoname, subdomain FROM dojo WHERE subdomain = ? AND ist_aktiv = TRUE LIMIT 1',
      [subdomain]
    );

    if (dojos.length === 0) {
      logger.error('Ungültige Subdomain', { subdomain });
      return res.status(403).json({
        error: 'Ungültige Subdomain',
        message: 'Dieses Dojo existiert nicht oder ist nicht aktiv'
      });
    }

    const dojo = dojos[0];

    // ========== SICHERHEITS-CHECK ==========
    // Prüfe ob User zum Dojo der Subdomain gehört!
    const userDojoId = req.user?.dojo_id;
    const userRole = req.user?.role || req.user?.rolle;
    
    // Super-Admin (role=admin mit dojo_id=null) darf alles
    const isSuperAdmin = (userRole === 'super_admin') || 
                         (userRole === 'admin' && userDojoId === null);
    
    if (!isSuperAdmin && userDojoId !== null && userDojoId !== dojo.id) {
      logger.error('SICHERHEIT: User versucht fremde Subdomain!', {
        user_dojo_id: userDojoId,
        subdomain: subdomain,
        subdomain_dojo_id: dojo.id,
        user_email: req.user?.email
      });
      return res.status(403).json({
        error: 'Zugriff verweigert',
        message: 'Sie haben keinen Zugriff auf dieses Dojo'
      });
    }
    // ========== ENDE SICHERHEITS-CHECK ==========

    req.tenant = {
      dojo_id: dojo.id,
      subdomain: dojo.subdomain,
      dojoname: dojo.dojoname
    };

    req.query.dojo_id = dojo.id.toString();

    logger.debug('Tenant-Isolation aktiv', {
      subdomain,
      dojo_id: dojo.id,
      dojoname: dojo.dojoname
    });

    next();
  } catch (error) {
    logger.error('Fehler bei Tenant-Lookup', { error: error.message, subdomain });
    return res.status(500).json({ error: 'Interner Fehler' });
  }
};


// Tenant-Isolation global für alle /api/* Routes aktivieren (außer /api/auth)
app.use('/api', (req, res, next) => {
  // Auth-Routes überspringen (Login, Logout sollten nicht tenant-isoliert sein)
  if (req.path.startsWith('/auth')) {
    return next();
  }
  // Für alle anderen API-Routes: Tenant-Isolation anwenden
  tenantIsolationMiddleware(req, res, next);
});

// 12. DOJOS (Multi-Dojo-Verwaltung & Steuer-Tracking) - NEU
try {
  const dojosRouter = require(path.join(__dirname, "routes", "dojos.js"));

  // Middleware um DB-Connection zu den Routes zu geben + JWT Auth
  app.use("/api/dojos", authenticateToken, (req, res, next) => {
    req.db = db;
    next();
  }, dojosRouter);

  logger.success('Route gemountet', { path: '/api/dojos' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'dojos',
      error: error.message,
      stack: error.stack
    });
}

// 12.5. DOJO LOGOS (Logo-Verwaltung für Dojos) - NEU
try {
  const dojoLogosRouter = require(path.join(__dirname, "routes", "dojo-logos.js"));
  app.use("/api/dojos", authenticateToken, dojoLogosRouter);
  logger.success('Route gemountet', { path: '/api/dojos (logos)' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'dojo-logos',
      error: error.message,
      stack: error.stack
    });
}

// 12.6. FINANZÄMTER (Finanzamt-Datenbank für Dojo-Steuereinstellungen) - NEU
try {
  const finanzaemterRouter = require(path.join(__dirname, "routes", "finanzaemter.js"));
  app.use("/api/finanzaemter", finanzaemterRouter);
  logger.success('Route gemountet', { path: '/api/finanzaemter' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'finanzaemter',
      error: error.message,
      stack: error.stack
    });
}

// 13. DOJO BANKEN (Mehrere Bankverbindungen pro Dojo) - NEU
try {
  const dojoBankenRouter = require(path.join(__dirname, "routes", "dojo-banken.js"));
  app.use("/api/dojo-banken", authenticateToken, dojoBankenRouter);
  logger.success('Route gemountet', { path: '/api/dojo-banken' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'dojo-banken',
      error: error.message,
      stack: error.stack
    });
}

// 14. MEMBER PROFILE (Mitglieder-spezifische API) - NEU
try {
  const memberProfileRouter = require(path.join(__dirname, "routes", "member-profile.js"));
  app.use("/api/member", memberProfileRouter);
  logger.success('Route gemountet', { path: '/api/member' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'member-profile',
      error: error.message,
      stack: error.stack
    });
}

try {
  const memberPaymentsRouter = require(path.join(__dirname, "routes", "member-payments.js"));
  app.use("/api/member-payments", memberPaymentsRouter);
  logger.success('Route gemountet', { path: '/api/member-payments' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', { route: 'member-payments', error: error.message });
}

// 15. NOTIFICATIONS SYSTEM (Newsletter & Push) - NEU
try {
  const notificationsRouter = require(path.join(__dirname, "routes", "notifications.js"));
  app.use("/api/notifications", notificationsRouter);
  logger.success('Route gemountet', { path: '/api/notifications' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'notifications',
      error: error.message,
      stack: error.stack
    });
}


// 15.1 NEWS VERWALTUNG (Nur Haupt-Admin)
try {
  const newsRouter = require(path.join(__dirname, "routes", "news.js"));
  app.use("/api/news", newsRouter);
  logger.success('Route gemountet', { path: '/api/news' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'news',
      error: error.message,
      stack: error.stack
    });
}

// 15.2 EMAIL SERVICE - NEU
try {
  const emailServiceRouter = require(path.join(__dirname, "routes", "emailService.js"));
  app.use("/api/email-service", emailServiceRouter);
  logger.success('Route gemountet', { path: '/api/email-service' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'email-service',
      error: error.message,
      stack: error.stack
    });
}

// 16. PRÜFUNGSVERWALTUNG (Gurtprüfungen & Exam Management) - NEU (Modular)
try {
  const pruefungenRouter = require(path.join(__dirname, "routes", "pruefungen"));
  app.use("/api/pruefungen", pruefungenRouter);
  const pruefungenHistorischRouter = require(path.join(__dirname, "routes", "pruefungen-historisch.js"));
  app.use("/api/pruefungen-historisch", pruefungenHistorischRouter);
  logger.success("Route gemountet", { path: "/api/pruefungen-historisch" });
  const ehrungenLehrgaengeRouter = require(path.join(__dirname, "routes", "ehrungen-lehrgaenge.js"));
  app.use("/api/ehrungen-lehrgaenge", ehrungenLehrgaengeRouter);
  logger.success("Route gemountet", { path: "/api/ehrungen-lehrgaenge" });
  logger.success('Route gemountet', { path: '/api/pruefungen' });

  // Zusatzdaten Route (Lehrgänge, Ehrungen, Zertifikate)
  const zusatzdatenRouter = require(path.join(__dirname, "routes", "zusatzdaten.js"));
  app.use("/api/zusatzdaten", zusatzdatenRouter);
  logger.success("Route gemountet", { path: "/api/zusatzdaten" });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'pruefungen',
      error: error.message,
      stack: error.stack
    });
}

// 17. TRANSAKTIONEN (Zahlungshistorie & Finanzverwaltung) - NEU
try {
  const transaktionenRouter = require(path.join(__dirname, "routes", "transaktionen.js"));
  app.use("/api/transaktionen", transaktionenRouter);
  logger.success('Route gemountet', { path: '/api/transaktionen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'transaktionen',
      error: error.message,
      stack: error.stack
    });
}

// Beiträge Route
try {
  const beitraegeRouter = require(path.join(__dirname, "routes", "beitraege.js"));
  app.use("/api/beitraege", beitraegeRouter);
  logger.success('Route gemountet', { path: '/api/beitraege' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'beitraege',
      error: error.message,
      stack: error.stack
  });
}


// Mahnwesen Route
try {
  const mahnwesenRouter = require(path.join(__dirname, "routes", "mahnwesen.js"));
  app.use("/api/mahnwesen", mahnwesenRouter);
  logger.success('Route gemountet', { path: '/api/mahnwesen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'mahnwesen',
      error: error.message,
      stack: error.stack
    });
}

// Rechnungen Route (modular)
try {
  const rechnungenRouter = require(path.join(__dirname, "routes", "rechnungen"));
  app.use("/api/rechnungen", rechnungenRouter);
  logger.success('Route gemountet', { path: '/api/rechnungen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'rechnungen',
      error: error.message,
      stack: error.stack
    });
}

// FINANZCOCKPIT ROUTES
try {
  const finanzcockpitRouter = require(path.join(__dirname, "routes", "finanzcockpit.js"));
  app.use("/api/finanzcockpit", finanzcockpitRouter);
  logger.success('Route gemountet', { path: '/api/finanzcockpit' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'finanzcockpit',
      error: error.message,
      stack: error.stack
    });
}

// SEPA-Mandate Route (mounted at both paths for compatibility)
try {
  const sepaMandateRouter = require(path.join(__dirname, "routes", "sepa-mandate.js"));
  app.use("/api/sepa-mandate", sepaMandateRouter);
  app.use("/api/mitglieder", sepaMandateRouter);
  logger.success('Route gemountet', { path: '/api/sepa-mandate & /api/mitglieder/sepa-mandate' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'sepa-mandate',
      error: error.message,
      stack: error.stack
    });
}

// LASTSCHRIFTLAUF - SEPA Batch File Generation
try {
  const lastschriftlaufRouter = require(path.join(__dirname, "routes", "lastschriftlauf.js"));
  app.use("/api/lastschriftlauf", lastschriftlaufRouter);
  logger.success('Route gemountet', { path: '/api/lastschriftlauf' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'lastschriftlauf',
      error: error.message,
      stack: error.stack
    });
}

// ZAHLLÄUFE - SEPA Payment Runs Overview
try {
  const zahllaeufeRouter = require(path.join(__dirname, "routes", "zahllaeufe.js"));
  app.use("/api/zahllaeufe", authenticateToken, zahllaeufeRouter);
  logger.success('Route gemountet', { path: '/api/zahllaeufe' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'zahllaeufe',
      error: error.message,
      stack: error.stack
    });
}

// LASTSCHRIFT-ZEITPLÄNE - Automatische Lastschriftläufe
try {
  const lastschriftZeitplaeneRouter = require(path.join(__dirname, "routes", "lastschrift-zeitplaene.js"));
  app.use("/api/lastschrift-zeitplaene", authenticateToken, lastschriftZeitplaeneRouter);
  logger.success('Route gemountet', { path: '/api/lastschrift-zeitplaene' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'lastschrift-zeitplaene',
      error: error.message,
      stack: error.stack
    });
}

// STRIPE CONNECT - Multi-Dojo Payment Platform
try {
  const stripeConnectRouter = require(path.join(__dirname, "routes", "stripe-connect.js"));
  app.use("/api/stripe-connect", stripeConnectRouter);
  logger.success('Route gemountet', { path: '/api/stripe-connect' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'stripe-connect',
      error: error.message,
      stack: error.stack
    });
}

try {
  const walletRouter = require(path.join(__dirname, "routes", "wallet.js"));
  app.use("/api/wallet", authenticateToken, walletRouter);
  logger.success('Route gemountet', { path: '/api/wallet' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'wallet',
      error: error.message,
      stack: error.stack
    });
}

// =============================================
// AUTOMATIC LOADING OF REMAINING ROUTES
// =============================================

logger.info('Route-Loading gestartet', { mode: 'automatic' });
const routesPath = path.join(__dirname, "routes");
const skipFiles = [
  "einstellungendojo.js",
  "admins.js",
  "tarife.js",
  "checkin.js",
  "stileguertel.js",
  "vertraege.js",
  "zahlungszyklen.js",
  "laufzeiten.js",
  "paymentProvider.js",
  "auswertungen.js",
  "fortschritt.js",
  "artikel.js",
  "artikelgruppen.js",
  "verkaeufe.js",
  "public-registration.js",
  "dashboard.js",
  "dokumente.js",
  "dojos.js",
  "notifications.js",
  "pruefungen.js",
  "lastschriftlauf.js",
  "stripe-connect.js",
  "wallet.js",
  "kurse.js",
  "trainer.js",
  "raeume.js",
  "standorte.js",
  "stundenplan.js",
  "badges.js",
  // Keine Router-Module (exportieren nur Funktionen):
  "templatePdfGenerator.js",
  "vertragPdfGeneratorExtended.js",
  "ManualSepaProvider.js",
  "PaymentProviderFactory.js",
  "StripeDataevProvider.js",
  "steuer.js",
  "lastschriftEinverstaendnis.js"
];

fs.readdirSync(routesPath).forEach((file) => {
  if (skipFiles.includes(file)) {
    logger.debug('Route übersprungen (bereits manuell geladen)', { file });
    return;
  }
  
  if (file.endsWith(".js")) {
    try {
      const route = require(path.join(routesPath, file));
      if (typeof route === "function" || Object.keys(route).length > 0) {
        const routeName = file.replace(".js", "");
        app.use(`/api/${routeName}`, route);
        logger.success('Route automatisch gemountet', { path: `/api/${routeName}` });
      } else {
        logger.warn('Datei enthält keine gültige Express-Route', { file });
      }
    } catch (error) {
      logger.error('Fehler beim Laden der Route', { file, error: error.message });
    }
  }
});

// =============================================
// TEST ROUTES FOR DEBUGGING
// =============================================

// General test route
// ── Health-Check für UptimeRobot / Monitoring ─────────────────────────────────
app.get('/api/health', async (req, res) => {
  const start = Date.now();
  try {
    await db.promise().query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'ok',
      uptime: Math.floor(process.uptime()),
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'unreachable',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    available_routes: [
      '/api/test',
      '/api/routes',
      '/api/checkin/health',
      '/api/checkin/test', 
      '/api/checkin/courses-today',
      '/api/dojo',
      '/api/tarife',
      '/api/stile',
      '/api/stile/:id',
      '/api/stile/:stilId/graduierungen',
      '/api/artikel',
      '/api/artikelgruppen'
    ]
  });
});

// List all routes endpoint
app.get('/api/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const basePath = middleware.regexp.source
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace(/\?\(\?\=/g, '')
            .replace(/\$\)/g, '');
          
          routes.push({
            path: basePath + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  
  res.json({
    success: true,
    total_routes: routes.length,
    routes: routes
  });
});

// Stil-Verwaltung Test Route
app.get('/api/stile/test', (req, res) => {
  res.json({
    success: true,
    message: 'Stil-Verwaltung API ist aktiv',
    endpoints: [
      'GET /api/stile - Alle Stile abrufen',
      'GET /api/stile/:id - Einzelnen Stil abrufen', 
      'POST /api/stile - Neuen Stil erstellen',
      'PUT /api/stile/:id - Stil bearbeiten',
      'DELETE /api/stile/:id - Stil löschen',
      'POST /api/stile/:stilId/graduierungen - Graduierung hinzufügen',
      'PUT /api/graduierungen/:id - Graduierung bearbeiten',
      'DELETE /api/graduierungen/:id - Graduierung löschen'
    ],
    database_tables: ['stile', 'graduierungen', 'pruefungsinhalte'],
    frontend_url: '/dashboard/stile'
  });
});

// CHARSET DIAGNOSTIC ENDPOINT
app.get('/api/charset-test', (req, res) => {
  const testData = {
    message: 'Charset Test',
    umlauts: {
      ae: 'ä',
      oe: 'ö',
      ue: 'ü',
      sz: 'ß',
      Ae: 'Ä',
      Oe: 'Ö',
      Ue: 'Ü'
    },
    sample_address: 'Königstraße 123',
    sample_name: 'Müller',
    encoding_info: {
      charset: 'utf-8',
      nodejs_encoding: Buffer.from('ä').toString('hex'),
      response_headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    }
  };

  // Explizit UTF-8 setzen
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(testData);
});

// DATABASE CHARSET TEST - Testet Umlauts direkt aus der DB
app.get('/api/db-charset-test', (req, res) => {
  const query = `
    SELECT
      mitglied_id,
      vorname,
      nachname,
      strasse,
      ort,
      CHARSET(vorname) as vorname_charset,
      CHARSET(strasse) as strasse_charset,
      HEX(strasse) as strasse_hex,
      CHAR_LENGTH(strasse) as strasse_length,
      LENGTH(strasse) as strasse_bytes
    FROM mitglieder
    WHERE strasse LIKE '%ä%' OR strasse LIKE '%ö%' OR strasse LIKE '%ü%' OR strasse LIKE '%ß%'
    LIMIT 5
  `;

  db.query(query, (err, results) => {
    if (err) {
      logger.error('DB Charset Test fehlgeschlagen', { error: err.message });
      return res.status(500).json({ error: err.message });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      message: 'Database Charset Test',
      connection_charset: 'utf8mb4',
      results: results,
      interpretation: 'Wenn strasse_hex korrekt aussieht aber im Browser falsch, ist es ein Frontend-Problem'
    });
  });
});

// SPECIFIC MEMBER CHARSET TEST - Testet Tom Tester's Daten
app.get('/api/member-charset-test/:id', (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT
      mitglied_id,
      CONVERT(vorname USING utf8mb4) as vorname,
      CONVERT(nachname USING utf8mb4) as nachname,
      CONVERT(strasse USING utf8mb4) as strasse,
      CONVERT(ort USING utf8mb4) as ort,
      HEX(strasse) as strasse_hex_raw,
      CHARSET(strasse) as strasse_charset,
      COLLATION(strasse) as strasse_collation
    FROM mitglieder
    WHERE mitglied_id = ?
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      logger.error('Member Charset Test fehlgeschlagen', { error: err.message });
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      message: 'Member Charset Test',
      member_id: id,
      data: results[0],
      encoding_tips: {
        hex_c3a4: 'ä in UTF-8',
        hex_e4: 'ä in Latin1 (FALSCH)',
        note: 'Wenn hex mit C3 beginnt = UTF-8 OK, wenn E4/F6/FC = Latin1 Problem'
      }
    });
  });
});

// ── Frontend Error Reporting (kein Auth — ErrorBoundary sendet vor Login) ───
app.post('/api/errors/report', (req, res) => {
  const { message, stack, componentStack, url, timestamp } = req.body || {};
  logger.warn('Frontend-Fehler', { message, url, timestamp, stack: stack?.slice(0, 500), componentStack: componentStack?.slice(0, 500) });
  res.json({ received: true });
});

// =============================================
// ERROR HANDLING & 404
// =============================================

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// 404 Handler - einheitliches Format
app.use(notFoundHandler);

// Globaler Error Handler - einheitliches Format
app.use(errorHandler);

// =============================================
// CRON JOBS
// =============================================

const { initCronJobs } = require('./cron-jobs');
initCronJobs();

// ── Sentry Error-Handler (muss nach allen Routen, vor eigenem Error-Handler stehen) ─
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// =============================================
// SERVER STARTUP
// =============================================

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // Listen only on localhost (behind nginx)

const httpServer = 
app.listen(PORT, HOST, () => {
  logger.success('Server gestartet', {
    port: PORT,
    host: HOST,
    url: `http://localhost:${PORT}`,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
  logger.info('Verfügbare Test-URLs:');
  logger.info('API-Endpoints', {
    test: `http://localhost:${PORT}/api/test`,
    routes: `http://localhost:${PORT}/api/routes`,
    checkin: `http://localhost:${PORT}/api/checkin/health`,
    stile: `http://localhost:${PORT}/api/stile`,
    frontend: 'http://localhost:5173/dashboard/stile'
  });

  // SaaS Scheduled Jobs starten (Trial-Erinnerungen, etc.)
  try {
    const saasScheduler = require('./jobs/saasScheduler');
    if (process.env.ENABLE_SAAS_SCHEDULER !== 'false') {
      saasScheduler.startAllJobs();
      logger.info('SaaS Scheduler gestartet');
    } else {
      logger.info('SaaS Scheduler deaktiviert (ENABLE_SAAS_SCHEDULER=false)');
    }
  } catch (error) {
    logger.warn('SaaS Scheduler konnte nicht gestartet werden:', error.message);
  }
});

// =============================================
// SOCKET.IO - CHAT ECHTZEIT
// =============================================

const { Server } = require('socket.io');
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Gleiche CORS-Logik wie Express: alle dojo.tda-intl.org Subdomains + localhost
      const allowed = !origin ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^https?:\/\/([a-z0-9-]+\.)?dojo\.tda-intl\.org(:\d+)?$/.test(origin) ||
        /^https?:\/\/([a-z0-9-]+\.)?tda-intl\.(org|com)(:\d+)?$/.test(origin);
      callback(null, allowed ? origin : false);
    },
    credentials: true
  },
  path: '/socket.io'
});

// io-Instanz im Express-App-Objekt speichern (für Routes zugänglich via req.app.get('io'))
app.set('io', io);

// Chat Socket-Handler laden
try {
  require('./socket/chatSocket')(io);
  logger.success('Socket.io Chat-Handler geladen');
} catch (error) {
  logger.error('Socket.io Chat-Handler Fehler', { error: error.message });
}

// Messenger Route mit io-Instanz verknüpfen (für Echtzeit-Updates bei eingehenden Nachrichten)
try {
  const messengerRoutes = require('./routes/messenger');
  if (typeof messengerRoutes.setIo === 'function') {
    messengerRoutes.setIo(io);
    logger.success('Messenger io-Instanz gesetzt');
  }
} catch (error) {
  logger.warn('Messenger io-Setup nicht möglich', { error: error.message });
}

// PLATTFORM-ZENTRALE
try {
  const plattformZentraleRouter = require(path.join(__dirname, 'routes', 'plattform-zentrale.js'));
  app.use('/api/plattform-zentrale', plattformZentraleRouter);
  logger.success('Route gemountet', { path: '/api/plattform-zentrale' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', { route: 'plattform-zentrale', error: error.message });
}


// UMFRAGEN
try {
  const umfragenRouter = require(path.join(__dirname, 'routes', 'umfragen.js'));
  app.use('/api/umfragen', umfragenRouter);
} catch (error) {
  logger.error('Fehler beim Laden der Route', { route: 'umfragen', error: error.message });
}

// ABWESENHEITEN
try {
  const abwesenheitenRouter = require(path.join(__dirname, "routes", "abwesenheiten.js"));
  app.use("/api/abwesenheiten", abwesenheitenRouter);
  logger.success("Route gemountet", { path: "/api/abwesenheiten" });
} catch (error) {
  logger.error("Fehler beim Laden der Route", { route: "abwesenheiten", error: error.message });
}

// HALL OF FAME INTEGRATION
try {
  const hofRouter = require(path.join(__dirname, "routes", "hof.js"));
  app.use("/api/hof", hofRouter);
  logger.success("Route gemountet", { path: "/api/hof" });
} catch (error) {
  logger.error("Fehler beim Laden der Route", { route: "hof", error: error.message });
}

// ─── HOMEPAGE BUILDER ─────────────────────────────────────────────────────────
// Premium Feature: Dojo-Homepages unter *.dojo-pages.de
// Routen: /api/homepage/** (API) + /site/:slug (HTML-Render via Pfad)
//         Subdomain-Routing: Host-Header wird ausgewertet (*.dojo-pages.de)
try {
  const homepageRouter = require('./routes/homepage');
  app.use('/api/homepage', homepageRouter);
  logger.success('Route gemountet', { path: '/api/homepage' });

  // ── Subdomain-Routing für *.dojo-pages.de ────────────────────────────────
  // Nginx sendet alle *.dojo-pages.de Anfragen an diesen Backend-Port.
  // Aus dem Host-Header extrahieren wir den Slug (erster Teil vor dem ersten Punkt).
  // Beispiel: "kampfkunst-schreiner.dojo-pages.de" → slug = "kampfkunst-schreiner"
  app.use((req, res, next) => {
    const host = (req.headers.host || '').toLowerCase();
    const isDojoPagesSubdomain = host.includes('.dojo-pages.de') && !host.startsWith('www.');
    if (!isDojoPagesSubdomain) return next();

    const slug = host.split('.')[0];
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) return next();

    // Intern auf den Render-Endpunkt umleiten
    req.url = `/render/${slug}`;
    homepageRouter(req, res, next);
  });

  // ── Fallback: /site/:slug (direkte URL für Tests ohne eigene Domain) ─────
  app.get('/site/:slug', (req, res) => {
    const slug = req.params.slug || '';
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).send('Ungültiger Slug');
    }
    // Intern auf Render-Route delegieren
    req.url = `/render/${slug}`;
    homepageRouter(req, res, () => res.status(404).send('Nicht gefunden'));
  });

} catch (error) {
  logger.error('Fehler beim Laden der Route', { route: 'homepage', error: error.message });
}

// ─── Visitor Chat Socket Events ───────────────────────────────────────────────
// Besucher: treten einem Session-Room bei (token-basiert, kein JWT)
// Staff: treten einem Dojo-Room bei (JWT optional, dojo_id aus Query)
io.on('connection', (socket) => {
  // Besucher tritt Session-Room bei
  socket.on('visitor-chat:join', ({ token }) => {
    if (token && typeof token === 'string' && token.length === 64) {
      socket.join(`visitor-session:${token}`);
    }
  });

  // Staff tritt Dojo-Room bei (für Echtzeit-Benachrichtigungen)
  socket.on('visitor-chat:staff-join', ({ dojoId }) => {
    const room = dojoId ? `visitor-dojo:${dojoId}` : 'visitor-super-admin';
    socket.join(room);
    logger.info('Staff joined visitor chat room', { room, socketId: socket.id });
  });

  socket.on('visitor-chat:staff-leave', ({ dojoId }) => {
    const room = dojoId ? `visitor-dojo:${dojoId}` : 'visitor-super-admin';
    socket.leave(room);
  });
});
