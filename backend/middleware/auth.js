// =====================================================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================================================
// JWT Token-basierte Authentifizierung für DojoSoftware

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT Secret aus Umgebungsvariablen - MUSS gesetzt sein!
if (!process.env.JWT_SECRET) {
    logger.error('KRITISCHER FEHLER: JWT_SECRET ist nicht gesetzt!');
    logger.error('Bitte setze JWT_SECRET in der .env Datei.');
    logger.error('Tipp: Generiere einen sicheren Schlüssel mit: openssl rand -base64 32');
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
    logger.debug('Auth Debug für /kasse:', {
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
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
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

/**
 * Middleware: Feingranulare Berechtigungsprüfung (ERP-Rollensystem).
 * Liest das per-User berechtigungen-JSON aus dem Token (admin_users.berechtigungen)
 * und lässt nur durch, wenn berechtigungen[bereich][aktion] === true.
 *
 * WICHTIG (Phase-1-Semantik, bewusst): super_admin UND admin haben IMMER vollen
 * Zugriff (Bypass, wie bisher requireAdmin) — so kann das Scharfschalten einer Route
 * nie den Betreiber aussperren, sondern granulare Rollen (kassenwart, pruefer, …)
 * gezielt zulassen/sperren.
 *
 * @param {string} bereich  z.B. 'finanzen', 'mitglieder', 'pruefungen'
 * @param {string} aktion   'lesen' | 'erstellen' | 'bearbeiten' | 'loeschen' | 'exportieren'
 */
/**
 * Boolean-Variante der Rechteprüfung (für Inline-Checks in Routen).
 * super_admin/admin → immer true (Bypass); sonst berechtigungen[bereich][aktion].
 */
const hasPermission = (req, bereich, aktion = 'lesen') => {
  const role = req.user?.rolle || req.user?.role;
  if (role === 'super_admin' || role === 'admin') return true;
  let perms = req.user?.berechtigungen;
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms); } catch { perms = null; }
  }
  return !!(perms && perms[bereich] && perms[bereich][aktion] === true);
};

const requirePermission = (bereich, aktion = 'lesen') => (req, res, next) => {
  if (hasPermission(req, bereich, aktion)) return next();
  return res.status(403).json({
    message: `Keine Berechtigung für ${bereich}/${aktion}`,
    permission_required: `${bereich}.${aktion}`
  });
};

/**
 * Wie requirePermission, aber für MEMBER-SHARED Domänen (Prüfungen/Kurse/Events):
 * - Mitglieder (users-Tabelle → keine berechtigungen im Token) werden unverändert
 *   durchgelassen (die Handler scopen auf die eigenen Daten via mitglied_id) — sonst
 *   würde die Mitglieder-App brechen.
 * - super_admin/admin: voller Bypass.
 * - admin_users-Staff (haben berechtigungen): Recht nötig — geprüft gegen die gespeicherten
 *   berechtigungen ODER die AKTUELLEN Rollen-Defaults (deckt veraltete stored-Werte
 *   bestehender Mitarbeiter ab → keine Regression, kein Daten-Backfill nötig).
 */
const requireStaffPermission = (bereich, aktion = 'lesen') => (req, res, next) => {
  const role = req.user?.rolle || req.user?.role;
  if (role === 'super_admin' || role === 'admin') return next();
  if (!req.user?.berechtigungen) return next(); // Mitglied / Alt-users-Staff → wie bisher
  if (hasPermission(req, bereich, aktion)) return next();
  try {
    const { getRollenBerechtigungen } = require('../routes/admins');
    const def = getRollenBerechtigungen(role);
    if (def && def[bereich] && def[bereich][aktion] === true) return next();
  } catch (_) { /* Fallback unten */ }
  return res.status(403).json({
    message: `Keine Berechtigung für ${bereich}/${aktion}`,
    permission_required: `${bereich}.${aktion}`
  });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireTrainer,
  requirePermission,
  requireStaffPermission,
  hasPermission,
  JWT_SECRET
};
