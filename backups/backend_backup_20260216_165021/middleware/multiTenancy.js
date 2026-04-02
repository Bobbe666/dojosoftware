/**
 * Multi-Tenancy Security Middleware
 * Stellt sicher, dass Benutzer nur auf Daten ihres eigenen Dojos zugreifen können
 */

const logger = require('../utils/logger');

/**
 * Enforce Tenant Isolation
 * Stellt sicher, dass req.dojo_id gesetzt ist und valide ist
 */
const enforceTenantIsolation = (req, res, next) => {
  // Prüfe ob User authentifiziert ist
  if (!req.user) {
    logger.warn('Tenant isolation failed: No user in request', {
      path: req.path,
      method: req.method,
    });
    return res.status(401).json({ message: 'Nicht authentifiziert' });
  }

  // Prüfe ob dojo_id gesetzt ist
  if (!req.user.dojo_id && !req.dojo_id) {
    logger.error('Tenant isolation failed: No dojo_id', {
      userId: req.user.id || req.user.user_id,
      path: req.path,
    });
    return res.status(403).json({ message: 'Kein Dojo zugewiesen' });
  }

  // Setze dojo_id aus User-Object (falls nicht schon gesetzt)
  if (!req.dojo_id) {
    req.dojo_id = req.user.dojo_id;
  }

  // Validiere dass dojo_id eine Zahl ist
  req.dojo_id = parseInt(req.dojo_id, 10);
  if (isNaN(req.dojo_id)) {
    logger.error('Tenant isolation failed: Invalid dojo_id', {
      dojoId: req.dojo_id,
      userId: req.user.id,
    });
    return res.status(403).json({ message: 'Ungültige Dojo-ID' });
  }

  // Log tenant access (optional, für Audit)
  if (process.env.LOG_TENANT_ACCESS === 'true') {
    logger.debug('Tenant access', {
      dojoId: req.dojo_id,
      userId: req.user.id,
      path: req.path,
      method: req.method,
    });
  }

  next();
};

/**
 * Validate Resource Access
 * Prüft ob eine Resource zum Dojo des Users gehört
 * 
 * @param {string} resourceIdParam - Name des URL-Parameters (z.B. 'id')
 * @param {Function} fetchResourceFn - Funktion die die Resource lädt
 */
const validateResourceAccess = (resourceIdParam, fetchResourceFn) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const dojoId = req.dojo_id;

      if (!resourceId) {
        return res.status(400).json({ message: 'Resource-ID fehlt' });
      }

      // Lade Resource
      const resource = await fetchResourceFn(resourceId, dojoId);

      if (!resource) {
        logger.warn('Resource access denied: Not found', {
          resourceId,
          dojoId,
          userId: req.user.id,
          path: req.path,
        });
        return res.status(404).json({ message: 'Resource nicht gefunden' });
      }

      // Prüfe Tenant-Isolation
      if (resource.dojo_id && resource.dojo_id !== dojoId) {
        logger.error('SECURITY: Cross-tenant access attempt', {
          resourceId,
          resourceDojoId: resource.dojo_id,
          requestDojoId: dojoId,
          userId: req.user.id,
          path: req.path,
        });
        return res.status(403).json({ message: 'Zugriff verweigert' });
      }

      // Speichere Resource für weitereVerwendung
      req.resource = resource;

      next();
    } catch (error) {
      logger.error('Error in validateResourceAccess', {
        error: error.message,
        resourceId: req.params[resourceIdParam],
        dojoId: req.dojo_id,
      });
      res.status(500).json({ message: 'Interner Fehler' });
    }
  };
};

/**
 * Restrict Super Admin Routes
 * Nur für Super-Admins (dojo_id = null oder role = 'super_admin')
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    logger.warn('Super admin access denied', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
    });
    return res.status(403).json({ message: 'Super-Admin Berechtigung erforderlich' });
  }

  next();
};

/**
 * Audit Log for Sensitive Operations
 * Loggt kritische Operationen für Compliance
 */
const auditLog = (operation) => {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function (data) {
      // Log nach erfolgreicher Response
      logger.info('Audit Log', {
        operation,
        userId: req.user?.id,
        dojoId: req.dojo_id,
        resourceId: req.params.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
        timestamp: new Date().toISOString(),
        success: res.statusCode < 400,
      });

      originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  enforceTenantIsolation,
  validateResourceAccess,
  requireSuperAdmin,
  auditLog,
};
