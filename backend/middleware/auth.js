// =====================================================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================================================
// JWT Token-basierte Authentifizierung für DojoSoftware

const jwt = require('jsonwebtoken');

// JWT Secret aus Umgebungsvariablen - MUSS gesetzt sein!
if (!process.env.JWT_SECRET) {
    console.error("❌ KRITISCHER FEHLER: JWT_SECRET ist nicht gesetzt!");
    console.error("Bitte setze JWT_SECRET in der .env Datei.");
    console.error("Tipp: Generiere einen sicheren Schlüssel mit: openssl rand -base64 32");
    process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware: Authentifiziert API-Requests via JWT Token
 *
 * Erwartet Authorization Header: "Bearer <token>"
 * Decoded Token wird in req.user gespeichert
 *
 * Token Payload sollte enthalten:
 * - user_id oder admin_id
 * - dojo_id
 * - role (admin, member, trainer)
 * - email
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Debug logging for /kasse endpoint
  if (req.path.includes('kasse')) {
    console.log('🔍 Auth Debug für /kasse:', {
      path: req.path,
      hasAuthHeader: !!authHeader,
      authHeaderStart: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
      hasToken: !!token
    });
  }

  if (!token) {
    return res.status(401).json({ message: "Kein Token vorhanden" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token ungültig oder abgelaufen" });
    }

    // Token-Daten in Request-Objekt speichern
    req.user = decoded;

    // Legacy: Setze user_id für Kompatibilität
    req.user_id = decoded.user_id || decoded.admin_id || decoded.mitglied_id;
    req.dojo_id = decoded.dojo_id;
    req.role = decoded.role;

    next();
  });
};

/**
 * Middleware: Nur für Admins
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: "Admin-Berechtigung erforderlich" });
  }
  next();
};

/**
 * Middleware: Nur für Trainer oder höher
 */
const requireTrainer = (req, res, next) => {
  if (!req.user || !['admin', 'trainer'].includes(req.user.role)) {
    return res.status(403).json({ message: "Trainer-Berechtigung erforderlich" });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireTrainer,
  JWT_SECRET
};
