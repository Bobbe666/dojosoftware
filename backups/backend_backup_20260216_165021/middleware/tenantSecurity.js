/**
 * 🔒 TENANT SECURITY MIDDLEWARE
 * ================================
 * Zentrale Multi-Tenancy Sicherheitsfunktionen
 *
 * WICHTIG: Diese Funktionen verhindern, dass User auf Daten
 * anderer Dojos zugreifen können, indem sie IMMER die dojo_id
 * aus dem JWT Token verwenden (nicht aus Query-Parametern).
 */

const logger = require('../utils/logger');
const auditLog = require('../services/auditLogService');

/**
 * 🔒 SICHERHEIT: Extrahiert die gültige dojo_id aus dem Request
 * - Für normale User: Erzwingt req.user.dojo_id (ignoriert Query-Parameter)
 * - Für Super-Admins: Erlaubt alle Dojos oder spezifisches Dojo aus Query
 *
 * @param {Object} req - Express Request Object
 * @returns {number|null} dojo_id oder null für Super-Admin (alle Dojos)
 */
function getSecureDojoId(req) {
    const userDojoId = req.user?.dojo_id;
    const userRole = req.user?.rolle || req.user?.role;

    // Super-Admin (role=super_admin ODER admin mit dojo_id=null) darf alles
    const isSuperAdmin = userRole === 'super_admin' || (userRole === 'admin' && !userDojoId);

    if (isSuperAdmin) {
        // Super-Admin darf optional ein Dojo aus Query wählen, oder alle sehen
        const queryDojoId = req.query.dojo_id;
        if (queryDojoId && queryDojoId !== 'all') {
            return parseInt(queryDojoId, 10);
        }
        return null; // null = alle Dojos
    }

    // Normale User: IMMER ihr eigenes Dojo
    return userDojoId ? parseInt(userDojoId, 10) : null;
}

/**
 * 🔒 SICHERHEIT: Prüft ob User auf ein bestimmtes Dojo zugreifen darf
 *
 * @param {Object} req - Express Request Object
 * @param {number} targetDojoId - Die Ziel-Dojo-ID
 * @returns {boolean} true wenn Zugriff erlaubt
 */
function canAccessDojo(req, targetDojoId) {
    const userDojoId = req.user?.dojo_id;
    const userRole = req.user?.rolle || req.user?.role;
    const isSuperAdmin = userRole === 'super_admin' || (userRole === 'admin' && !userDojoId);

    return isSuperAdmin || userDojoId === targetDojoId;
}

/**
 * 🔒 SICHERHEIT: Prüft ob User Super-Admin ist
 *
 * @param {Object} req - Express Request Object
 * @returns {boolean} true wenn Super-Admin
 */
function isSuperAdmin(req) {
    const userDojoId = req.user?.dojo_id;
    const userRole = req.user?.rolle || req.user?.role;
    return userRole === 'super_admin' || (userRole === 'admin' && !userDojoId);
}

/**
 * 🔒 Middleware: Erzwingt Dojo-Isolation für alle nachfolgenden Handler
 * Setzt req.secureDojoId für einfachen Zugriff
 */
function enforceDojoIsolation(req, res, next) {
    req.secureDojoId = getSecureDojoId(req);
    req.isSuperAdmin = isSuperAdmin(req);
    next();
}

/**
 * 🔒 Middleware: Blockiert Zugriff wenn kein gültiges Dojo
 * Für Routes die IMMER ein Dojo benötigen
 */
function requireDojoAccess(req, res, next) {
    const secureDojoId = getSecureDojoId(req);

    // Super-Admins dürfen immer durch
    if (isSuperAdmin(req)) {
        req.secureDojoId = secureDojoId;
        req.isSuperAdmin = true;
        return next();
    }

    // Normale User brauchen eine Dojo-ID
    if (!secureDojoId) {
        logger.warn('🔒 SICHERHEIT: Zugriff ohne gültige Dojo-ID blockiert', {
            userId: req.user?.userId,
            path: req.path,
            method: req.method
        });
        return res.status(403).json({
            error: 'Keine Berechtigung - keine gültige Dojo-Zuordnung'
        });
    }

    req.secureDojoId = secureDojoId;
    req.isSuperAdmin = false;
    next();
}

/**
 * 🔒 SICHERHEIT: Prüft und loggt Cross-Tenant-Access-Versuche
 * Gibt true zurück wenn der Request eine manipulierte dojo_id enthielt
 */
function detectCrossTenantAttempt(req) {
    const userDojoId = req.user?.dojo_id;
    const userRole = req.user?.rolle || req.user?.role;
    const isSuperAdminUser = userRole === 'super_admin' || (userRole === 'admin' && !userDojoId);

    // Super-Admins sind berechtigt, dojo_id zu wählen
    if (isSuperAdminUser) {
        return false;
    }

    // Prüfe ob versucht wurde, eine andere dojo_id zu übergeben
    const queryDojoId = req.query.dojo_id || req.body?.dojo_id;

    if (queryDojoId && parseInt(queryDojoId, 10) !== userDojoId) {
        // SICHERHEITSVORFALL: User versucht auf fremdes Dojo zuzugreifen!
        const details = {
            attemptedDojoId: queryDojoId,
            actualDojoId: userDojoId,
            userId: req.user?.id,
            userEmail: req.user?.email,
            path: req.originalUrl,
            method: req.method,
            ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0]
        };

        logger.error('🚨 SECURITY: Cross-Tenant Access Attempt detected!', details);

        // Audit-Log für Sicherheitsvorfall
        auditLog.log({
            req,
            aktion: auditLog.AKTION.CROSS_TENANT_ACCESS_ATTEMPT,
            kategorie: auditLog.KATEGORIE.SECURITY,
            entityType: 'dojo',
            entityId: parseInt(queryDojoId, 10),
            entityName: `Dojo ${queryDojoId}`,
            dojoId: userDojoId,
            beschreibung: `Cross-Tenant-Access-Versuch: User ${req.user?.email || 'unbekannt'} (Dojo ${userDojoId}) versuchte auf Dojo ${queryDojoId} zuzugreifen`,
            neueWerte: details
        }).catch(err => logger.error('Audit log error:', err));

        return true;
    }

    return false;
}

/**
 * 🔒 Middleware: Loggt Cross-Tenant-Versuche (zur Überwachung)
 * Blockiert NICHT, nur Logging für Monitoring
 */
function monitorCrossTenantAttempts(req, res, next) {
    detectCrossTenantAttempt(req);
    next();
}

/**
 * 🔒 Helper: Baut WHERE-Clause für Dojo-Filter
 *
 * @param {number|null} secureDojoId - Die sichere Dojo-ID
 * @param {string} columnName - Name der dojo_id Spalte (default: 'dojo_id')
 * @param {string} tableAlias - Optionaler Tabellen-Alias (z.B. 'm' für 'm.dojo_id')
 * @returns {Object} { condition: string, params: array }
 */
function buildDojoWhereClause(secureDojoId, columnName = 'dojo_id', tableAlias = null) {
    const fullColumn = tableAlias ? `${tableAlias}.${columnName}` : columnName;

    if (secureDojoId) {
        return {
            condition: `${fullColumn} = ?`,
            params: [secureDojoId]
        };
    }

    // Super-Admin: keine Einschränkung
    return {
        condition: null,
        params: []
    };
}

module.exports = {
    getSecureDojoId,
    canAccessDojo,
    isSuperAdmin,
    enforceDojoIsolation,
    requireDojoAccess,
    buildDojoWhereClause,
    detectCrossTenantAttempt,
    monitorCrossTenantAttempts
};
