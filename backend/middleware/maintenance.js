// ============================================================================
// WARTUNGSMODUS — Seite offline außer für unser Team (Super-Admin + Dojo 3)
// Zum Deaktivieren: MAINTENANCE_MODE = false setzen (eine Stelle) + deployen.
// ============================================================================
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');

const MAINTENANCE_MODE = true;
const MAINTENANCE_MESSAGE =
  'Wartungsarbeiten: Wir führen heute umfangreiche Updates durch und sind in Kürze wieder für Sie da. Vielen Dank für Ihre Geduld.';

// "Unser Team": Super-Admin ODER Dojo 3 (Kampfkunstschule Schreiner / TDA)
function isOurTeam(u) {
  if (!u) return false;
  const role = u.role || u.rolle;
  const dojoId = u.dojo_id;
  return (
    role === 'super_admin' ||
    (role === 'admin' && (dojoId === null || dojoId === undefined)) ||
    Number(dojoId) === 3
  );
}

// Globaler Gate für /api: nur unser Team + Login-/Webhook-Endpunkte durch; Rest → 503.
function maintenanceGate(req, res, next) {
  if (!MAINTENANCE_MODE) return next();
  const url = req.originalUrl || req.url || '';

  // Login/Auth durchlassen (Fremd-Logins werden im Login-Handler separat geblockt);
  // Zahlungs-Webhooks durchlassen (sonst brechen Stripe/GoCardless-Callbacks).
  if (url.startsWith('/api/auth') || url.includes('/webhook')) return next();

  // Token best-effort dekodieren → nur unser Team darf durch
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(h.slice(7), JWT_SECRET);
      if (isOurTeam(decoded)) return next();
    } catch (_) { /* ungültiges Token → blocken */ }
  }

  return res.status(503).json({ maintenance: true, success: false, message: MAINTENANCE_MESSAGE });
}

module.exports = { MAINTENANCE_MODE, MAINTENANCE_MESSAGE, isOurTeam, maintenanceGate };
