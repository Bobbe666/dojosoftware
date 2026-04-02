/**
 * BEISPIEL: Logger Migration in server.js
 *
 * Dieser Code zeigt, wie console.log Statements
 * durch strukturierte Logger-Aufrufe ersetzt werden.
 */

// ========================================
// VORHER (mit console.log)
// ========================================

// Database connection test
db.getConnection((err, connection) => {
  if (err) {
    console.error("Fehler bei der MySQL-Verbindung:", err);
    return;
  }
  console.log("Verbunden mit der MySQL-Datenbank als ID", connection.threadId);
  connection.release();
});

console.log("\nMANUAL ROUTE LOADING:");

// 1. ÖFFENTLICHE REGISTRIERUNG
try {
  const publicRegistrationRoutes = require('./routes/public-registration');
  app.use('/api/public', publicRegistrationRoutes);
  console.log("Public registration routes loaded successfully");
} catch (error) {
  console.error("Failed to load public registration routes:", error.message);
}

// AUTH ROUTES
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log("API MOUNTED: /api/auth");
} catch (error) {
  console.error("Failed to load auth routes:", error.message);
}

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});

// ========================================
// NACHHER (mit Logger)
// ========================================

const logger = require('./utils/logger');

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

logger.info('Route-Loading gestartet');

// 1. ÖFFENTLICHE REGISTRIERUNG
try {
  const publicRegistrationRoutes = require('./routes/public-registration');
  app.use('/api/public', publicRegistrationRoutes);
  logger.success('Public registration routes geladen');
} catch (error) {
  logger.error('Fehler beim Laden der public registration routes', {
    error: error.message,
    stack: error.stack
  });
}

// AUTH ROUTES
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  logger.success('API gemountet', { path: '/api/auth' });
} catch (error) {
  logger.error('Fehler beim Laden der auth routes', {
    error: error.message,
    stack: error.stack
  });
}

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.success('Server gestartet', {
    port: PORT,
    url: `http://localhost:${PORT}`,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

// ========================================
// WEITERE BEISPIELE
// ========================================

// API-Request-Logging
// VORHER:
console.log("📢 POST /api/mitglieder - Neues Mitglied erstellen");

// NACHHER:
logger.api('POST /api/mitglieder - Neues Mitglied erstellen', {
  method: 'POST',
  path: '/api/mitglieder',
  operation: 'create'
});

// Datenbankoperationen
// VORHER:
console.log(`Neues Mitglied erstellt mit ID: ${newMemberId} für Dojo: ${memberData.dojo_id}`);

// NACHHER:
logger.database('Neues Mitglied erstellt', {
  mitgliedId: newMemberId,
  dojoId: memberData.dojo_id
});

// Auth-Operationen
// VORHER:
console.log("Login erfolgreich:", user.email);

// NACHHER:
logger.auth('Login erfolgreich', {
  userId: user.id,
  email: user.email,
  ip: req.ip
});

// Payment-Operationen
// VORHER:
console.log("💳 Zahlung erfolgreich verarbeitet:", amount);

// NACHHER:
logger.payment('Zahlung verarbeitet', {
  amount,
  currency: 'EUR',
  mitgliedId: req.params.id
});

// Fehler-Logging
// VORHER:
console.error("Fehler beim Erstellen des Mitglieds:", err);

// NACHHER:
logger.error('Fehler beim Erstellen des Mitglieds', {
  error: err.message,
  code: err.code,
  table: 'mitglieder',
  userId: req.user.id,
  stack: err.stack
});

// Warnings
// VORHER:
console.warn("⚠️ Duplikat gefunden:", duplicateCheck.message);

// NACHHER:
logger.warn('Duplikat gefunden', {
  message: duplicateCheck.message,
  matchCount: duplicateCheck.matches.length
});

// Debug-Informationen
// VORHER:
console.log("🔍 Duplikatsprüfung Ergebnis:", result);

// NACHHER:
logger.debug('Duplikatsprüfung Ergebnis', {
  isDuplicate: result.isDuplicate,
  matches: result.matches
});

// Success-Messages
// VORHER:
console.log("✅ Vertrag erfolgreich erstellt:", vertragResult.insertId);

// NACHHER:
logger.success('Vertrag erstellt', {
  vertragId: vertragResult.insertId,
  mitgliedId: newMemberId
});

// Email-Operationen
// VORHER:
console.log("📧 E-Mail gesendet an:", email);

// NACHHER:
logger.email('E-Mail versendet', {
  to: email,
  subject: 'Willkommen',
  type: 'welcome'
});

// ========================================
// MIGRATION BEST PRACTICES
// ========================================

/**
 * 1. STRUKTURIERTE DATEN
 *    - Immer Meta-Objekte verwenden
 *    - Keine String-Konkatenation
 */

// ❌ Schlecht
logger.info('Mitglied ' + mitgliedId + ' erstellt in Dojo ' + dojoId);

// ✅ Gut
logger.info('Mitglied erstellt', { mitgliedId, dojoId });

/**
 * 2. FEHLER-DETAILS
 *    - Immer error.message, error.code, error.stack loggen
 */

// ❌ Schlecht
logger.error('Fehler', { error: err });

// ✅ Gut
logger.error('Datenbankfehler', {
  error: err.message,
  code: err.code,
  stack: err.stack,
  query: sqlQuery
});

/**
 * 3. KONTEXT HINZUFÜGEN
 *    - User-ID, Request-ID, Session-ID wenn verfügbar
 */

// ❌ Schlecht
logger.info('Login erfolgreich');

// ✅ Gut
logger.auth('Login erfolgreich', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
  userAgent: req.headers['user-agent']
});

/**
 * 4. RICHTIGE LOG-LEVEL WÄHLEN
 */

// error:  Kritische Fehler (Datenbank, Server-Crash)
// warn:   Warnungen (Duplikate, veraltete APIs)
// info:   Wichtige Events (Login, Mitglied erstellt)
// http:   HTTP-Requests (alle API-Calls)
// debug:  Debug-Infos (nur in Development)

/**
 * 5. KATEGORIEN VERWENDEN
 */

logger.database('Query ausgeführt', { table: 'mitglieder' });
logger.api('GET /api/mitglieder', { method: 'GET' });
logger.auth('Token validiert', { userId: 123 });
logger.payment('Zahlung abgeschlossen', { amount: 50 });
logger.email('Willkommens-E-Mail gesendet', { to: 'user@example.com' });
logger.success('Operation erfolgreich', { operation: 'create' });
