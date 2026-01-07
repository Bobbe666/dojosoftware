
const express = require("express");
const db = require("./db");  
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// JWT für Authentication
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'DojoSoftware2024SecretKeyChangeThis!';

// Strukturierter Logger
const logger = require("./utils/logger");

const app = express();

// Statische Dateien für Uploads servieren - MUSS VOR Content-Type Middleware kommen!
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// UTF-8 Encoding für alle Responses - ERWEITERT
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// CORS mit expliziter UTF-8 Unterstützung
app.use(cors({
  exposedHeaders: ['Content-Type', 'Content-Length', 'X-Content-Type-Options']
}));

// Body-Parser mit expliziter UTF-8 Konfiguration und 10MB Limit für PDF-HTML
app.use(express.json({ charset: 'utf-8', limit: '10mb' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8', limit: '10mb' }));

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

// AUTH ROUTES (Login, Token, Passwortänderung/Reset)
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  logger.success('Route gemountet', { path: '/api/auth' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'auth routes',
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
  app.use('/api/artikelgruppen', artikelgruppenRoutes);
  logger.success('Route geladen', { path: '/api/artikelgruppen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'artikelgruppen routes',
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
  app.use('/api/mitglieder', mitgliederRoutes);
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
  app.use('/api/mitglieder', mitgliederDokumenteRoutes);
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
  app.use('/api/stundenplan', stundenplanRoutes);
  logger.success('Route geladen', { path: '/api/stundenplan' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'stundenplan routes',
      error: error.message,
      stack: error.stack
    });
}

// 3. CHECKIN ROUTE - HIGHEST PRIORITY
try {
  const checkinPath = path.join(__dirname, "routes", "checkin.js");
  logger.debug('Lade Checkin-Route', { path: checkinPath });
  logger.debug('Checkin-Datei Existenz', { exists: fs.existsSync(checkinPath) });
  
  const checkinRoute = require(checkinPath);
  logger.debug('Checkin-Route geladen', { type: typeof checkinRoute });
  
  app.use("/api/checkin", checkinRoute);
  logger.success('Route gemountet', { path: '/api/checkin' });
  
} catch (error) {
  logger.error('Checkin-Loading fehlgeschlagen', { error: error.message });
  logger.error('Checkin Stack-Trace', { stack: error.stack });
}

// 3.1. ANWESENHEIT ROUTE
try {
  const anwesenheitRoutes = require('./routes/anwesenheit');
  app.use('/api/anwesenheit', anwesenheitRoutes);
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

// 2.1 ADMIN-VERWALTUNG
try {
  const adminsRoutes = require(path.join(__dirname, "routes", "admins.js"));
  app.use("/api/admins", adminsRoutes);
  logger.success('Route gemountet', { path: '/api/admins' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'admins',
      error: error.message,
      stack: error.stack
    });
}

// 3. TARIFE
try {
  const tarifeRouter = require(path.join(__dirname, "routes", "tarife.js"));
  app.use("/api/tarife", tarifeRouter);
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

// 4. STIL-VERWALTUNG (Gürtel & Graduierungen) - NEU
try {
  const stileguertelRouter = require(path.join(__dirname, "routes", "stileguertel.js"));
  app.use("/api/stile", stileguertelRouter);
  logger.success('Route gemountet', { path: '/api/stile', file: 'stileguertel.js' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'stileguertel',
      error: error.message,
      stack: error.stack
    });
}

// 5. VERTRÄGE (für Beitragsverwaltung) - NEU
try {
  const vertraegeRouter = require(path.join(__dirname, "routes", "vertraege.js"));
  app.use("/api/vertraege", vertraegeRouter);
  logger.success('Route gemountet', { path: '/api/vertraege' });
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
  app.use("/api/vertragsvorlagen", vertragsvorlagenRouter);
  logger.success('Route gemountet', { path: '/api/vertragsvorlagen' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'vertragsvorlagen',
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
  app.use("/api/dashboard", dashboardRouter);
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
// JWT AUTHENTICATION MIDDLEWARE
// =============================================
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

// =============================================
// TENANT ISOLATION MIDDLEWARE
// =============================================
// Subdomains → strikte Dojo-Zuordnung
// Hauptdomain → freie Dojo-Wahl via Switcher
const tenantIsolationMiddleware = async (req, res, next) => {
  const subdomain = req.headers['x-tenant-subdomain'];

  // Hauptdomain (kein Subdomain-Header)
  if (!subdomain || subdomain === '') {
    // Prüfe ob User eine dojo_id hat (aus JWT Token)
    const userDojoId = req.user?.dojo_id;
    const userRole = req.user?.role || req.user?.rolle;

    if (userDojoId && userRole !== 'super_admin') {
      // User mit dojo_id → erzwinge seine dojo_id auch bei Hauptdomain
      req.query.dojo_id = userDojoId.toString();
      logger.debug('Hauptdomain-Request - User dojo_id erzwungen', {
        url: req.url,
        user_dojo_id: userDojoId,
        forced_dojo_id: req.query.dojo_id
      });
    } else {
      logger.debug('Hauptdomain-Request - Multi-Dojo erlaubt', {
        url: req.url,
        dojo_id: req.query.dojo_id,
        user_role: userRole
      });
    }
    return next();
  }

  // Subdomain → Tenant-Isolation aktivieren
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
    req.tenant = {
      dojo_id: dojo.id,
      subdomain: dojo.subdomain,
      dojoname: dojo.dojoname
    };

    // Query-Parameter überschreiben für Tenant-Isolation
    req.query.dojo_id = dojo.id.toString();

    logger.debug('Tenant-Isolation aktiv', {
      subdomain,
      dojo_id: dojo.id,
      dojoname: dojo.dojoname
    });

    next();
  } catch (error) {
    logger.error('Fehler bei Tenant-Lookup', { error: error.message, subdomain });
    return res.status(500).json({ error: 'Interner Fehler bei Tenant-Validierung' });
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
  app.use("/api/dojos", dojoLogosRouter);
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
  app.use("/api/dojo-banken", dojoBankenRouter);
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

// 15.1 EMAIL SERVICE - NEU
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

// 16. PRÜFUNGSVERWALTUNG (Gurtprüfungen & Exam Management) - NEU
try {
  const pruefungenRouter = require(path.join(__dirname, "routes", "pruefungen.js"));
  app.use("/api/pruefungen", pruefungenRouter);
  logger.success('Route gemountet', { path: '/api/pruefungen' });
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

// Monatsreport Route
try {
  const monatsreportRouter = require(path.join(__dirname, "routes", "monatsreport.js"));
  app.use("/api/monatsreport", monatsreportRouter);
  logger.success('Route gemountet', { path: '/api/monatsreport' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'monatsreport',
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

// Rechnungen Route
try {
  const rechnungenRouter = require(path.join(__dirname, "routes", "rechnungen.js"));
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
  app.use("/api/zahllaeufe", zahllaeufeRouter);
  logger.success('Route gemountet', { path: '/api/zahllaeufe' });
} catch (error) {
  logger.error('Fehler beim Laden der Route', {
      route: 'zahllaeufe',
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
  "lastschriftlauf.js"
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

// =============================================
// ERROR HANDLING & 404
// =============================================

// Enhanced 404 handler with debugging
app.use((req, res) => {
  logger.http('404 Request', { method: req.method, url: req.url });
  logger.debug('404 Request Headers', { headers: req.headers });
  
  res.status(404).json({ 
    error: "API-Endpunkt nicht gefunden",
    path: req.url,
    method: req.method,
    suggestion: "Try /api/test, /api/routes or /api/stile/test to see available endpoints"
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Server Error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url
  });
  res.status(500).json({
    error: 'Interner Server-Fehler',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// =============================================
// CRON JOBS
// =============================================

const { initCronJobs } = require('./cron-jobs');
initCronJobs();

// =============================================
// SERVER STARTUP
// =============================================

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all IPv4 interfaces

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
});