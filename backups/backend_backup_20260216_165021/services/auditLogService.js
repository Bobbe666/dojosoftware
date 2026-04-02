/**
 * Audit Log Service
 * Zentrale Logging-Funktion für alle wichtigen Aktionen
 */

const db = require('../db');

// Kategorien für Audit-Logs
const KATEGORIE = {
  MITGLIED: 'MITGLIED',
  FINANZEN: 'FINANZEN',
  VERTRAG: 'VERTRAG',
  PRUEFUNG: 'PRUEFUNG',
  ADMIN: 'ADMIN',
  SEPA: 'SEPA',
  DOKUMENT: 'DOKUMENT',
  SYSTEM: 'SYSTEM',
  AUTH: 'AUTH',
  SECURITY: 'SECURITY'  // Sicherheitskritische Events
};

// Vordefinierte Aktionen
const AKTION = {
  // Mitglied
  MITGLIED_ERSTELLT: 'MITGLIED_ERSTELLT',
  MITGLIED_AKTUALISIERT: 'MITGLIED_AKTUALISIERT',
  MITGLIED_GELOESCHT: 'MITGLIED_GELOESCHT',
  MITGLIED_STATUS_GEAENDERT: 'MITGLIED_STATUS_GEAENDERT',
  MITGLIED_ARCHIVIERT: 'MITGLIED_ARCHIVIERT',

  // Finanzen
  BEITRAG_ERSTELLT: 'BEITRAG_ERSTELLT',
  BEITRAG_AKTUALISIERT: 'BEITRAG_AKTUALISIERT',
  BEITRAG_GELOESCHT: 'BEITRAG_GELOESCHT',
  ZAHLUNG_ERFASST: 'ZAHLUNG_ERFASST',
  MAHNUNG_ERSTELLT: 'MAHNUNG_ERSTELLT',
  RECHNUNG_ERSTELLT: 'RECHNUNG_ERSTELLT',

  // Vertrag
  VERTRAG_ERSTELLT: 'VERTRAG_ERSTELLT',
  VERTRAG_AKTUALISIERT: 'VERTRAG_AKTUALISIERT',
  TARIF_GEAENDERT: 'TARIF_GEAENDERT',
  KUENDIGUNG_EINGEREICHT: 'KUENDIGUNG_EINGEREICHT',
  TARIFERHOEHUNG: 'TARIFERHOEHUNG',

  // Prüfung
  PRUEFUNG_EINGETRAGEN: 'PRUEFUNG_EINGETRAGEN',
  PRUEFUNG_AKTUALISIERT: 'PRUEFUNG_AKTUALISIERT',
  PRUEFUNG_GELOESCHT: 'PRUEFUNG_GELOESCHT',

  // Admin
  USER_ERSTELLT: 'USER_ERSTELLT',
  USER_AKTUALISIERT: 'USER_AKTUALISIERT',
  USER_GELOESCHT: 'USER_GELOESCHT',
  RECHTE_GEAENDERT: 'RECHTE_GEAENDERT',
  DOJO_ERSTELLT: 'DOJO_ERSTELLT',
  DOJO_AKTUALISIERT: 'DOJO_AKTUALISIERT',

  // SEPA
  SEPA_MANDAT_ERSTELLT: 'SEPA_MANDAT_ERSTELLT',
  SEPA_MANDAT_AKTUALISIERT: 'SEPA_MANDAT_AKTUALISIERT',
  SEPA_BATCH_ERSTELLT: 'SEPA_BATCH_ERSTELLT',
  SEPA_XML_EXPORTIERT: 'SEPA_XML_EXPORTIERT',

  // Dokument
  DOKUMENT_HOCHGELADEN: 'DOKUMENT_HOCHGELADEN',
  DOKUMENT_GELOESCHT: 'DOKUMENT_GELOESCHT',

  // Auth
  LOGIN_ERFOLGREICH: 'LOGIN_ERFOLGREICH',
  LOGIN_FEHLGESCHLAGEN: 'LOGIN_FEHLGESCHLAGEN',
  LOGOUT: 'LOGOUT',
  PASSWORT_GEAENDERT: 'PASSWORT_GEAENDERT',
  PASSWORT_RESET: 'PASSWORT_RESET',

  // Security Events
  CROSS_TENANT_ACCESS_ATTEMPT: 'CROSS_TENANT_ACCESS_ATTEMPT',  // Versuch auf fremde Dojo-Daten zuzugreifen
  BRUTEFORCE_DETECTED: 'BRUTEFORCE_DETECTED',  // Zu viele Login-Versuche
  INVALID_TOKEN: 'INVALID_TOKEN',  // Ungültiger/Abgelaufener Token
  SUSPICIOUS_REQUEST: 'SUSPICIOUS_REQUEST',  // Verdächtige Anfrage (SQL Injection Versuch etc.)
  PERMISSION_DENIED: 'PERMISSION_DENIED',  // Zugriffsversuch ohne Berechtigung
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',  // Rate Limit überschritten
  SESSION_HIJACK_ATTEMPT: 'SESSION_HIJACK_ATTEMPT'  // Versuch Session zu übernehmen
};

/**
 * Hauptfunktion zum Erstellen eines Audit-Log Eintrags
 * @param {Object} options - Log-Optionen
 * @param {Object} options.req - Express Request-Objekt (für User-Info und IP)
 * @param {string} options.aktion - Die durchgeführte Aktion (z.B. 'MITGLIED_ERSTELLT')
 * @param {string} options.kategorie - Kategorie der Aktion (z.B. 'MITGLIED')
 * @param {string} options.entityType - Typ des betroffenen Datensatzes (z.B. 'mitglieder')
 * @param {number} options.entityId - ID des betroffenen Datensatzes
 * @param {string} options.entityName - Name/Bezeichnung für bessere Lesbarkeit
 * @param {Object} options.alteWerte - Vorherige Werte (bei Updates)
 * @param {Object} options.neueWerte - Neue Werte
 * @param {string} options.beschreibung - Optionale Beschreibung
 * @param {number} options.dojoId - Dojo-ID (falls nicht aus req verfügbar)
 * @param {string} options.dojoName - Dojo-Name (falls nicht aus req verfügbar)
 */
async function log(options) {
  const {
    req,
    aktion,
    kategorie,
    entityType = null,
    entityId = null,
    entityName = null,
    alteWerte = null,
    neueWerte = null,
    beschreibung = null,
    dojoId = null,
    dojoName = null
  } = options;

  try {
    // User-Infos aus Request extrahieren
    const user = req?.user || {};
    const userId = user.id || user.user_id || null;
    const userEmail = user.email || null;
    const userName = user.name || user.vorname ? `${user.vorname || ''} ${user.nachname || ''}`.trim() : null;
    const userRole = user.rolle || user.role || null;

    // Dojo-Infos
    const finalDojoId = dojoId || user.dojo_id || null;
    const finalDojoName = dojoName || user.dojo_name || null;

    // IP-Adresse ermitteln
    const ipAdresse = req?.ip ||
      req?.headers?.['x-forwarded-for']?.split(',')[0] ||
      req?.connection?.remoteAddress ||
      null;

    // User-Agent
    const userAgent = req?.headers?.['user-agent'] || null;

    // Request-Infos
    const requestMethod = req?.method || null;
    const requestPath = req?.originalUrl || req?.path || null;

    // In Datenbank speichern
    await db.promise().query(
      `INSERT INTO audit_log (
        user_id, user_email, user_name, user_role,
        dojo_id, dojo_name,
        aktion, kategorie,
        entity_type, entity_id, entity_name,
        alte_werte, neue_werte, beschreibung,
        ip_adresse, user_agent, request_method, request_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, userEmail, userName, userRole,
        finalDojoId, finalDojoName,
        aktion, kategorie,
        entityType, entityId, entityName,
        alteWerte ? JSON.stringify(alteWerte) : null,
        neueWerte ? JSON.stringify(neueWerte) : null,
        beschreibung,
        ipAdresse, userAgent, requestMethod, requestPath
      ]
    );

    // Debug-Logging in Entwicklung
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUDIT] ${kategorie}/${aktion}: ${entityType || ''}${entityId ? '#' + entityId : ''} ${entityName || ''} - User: ${userEmail || 'System'}`);
    }

  } catch (error) {
    // Fehler beim Logging sollten die Hauptaktion nicht blockieren
    console.error('[AUDIT ERROR] Fehler beim Schreiben des Audit-Logs:', error);
  }
}

/**
 * Hilfsfunktion: Ermittelt Änderungen zwischen zwei Objekten
 * @param {Object} altesObjekt - Ursprüngliche Werte
 * @param {Object} neuesObjekt - Neue Werte
 * @param {Array} felderZuIgnorieren - Felder die ignoriert werden sollen
 * @returns {Object} { alte_werte, neue_werte } nur mit geänderten Feldern
 */
function ermittleAenderungen(altesObjekt, neuesObjekt, felderZuIgnorieren = ['updated_at', 'geaendert_am', 'password', 'passwort']) {
  const alteWerte = {};
  const neueWerte = {};

  if (!altesObjekt || !neuesObjekt) {
    return { alteWerte: altesObjekt, neueWerte: neuesObjekt };
  }

  // Alle Keys aus beiden Objekten sammeln
  const alleKeys = new Set([...Object.keys(altesObjekt), ...Object.keys(neuesObjekt)]);

  for (const key of alleKeys) {
    // Ignorierte Felder überspringen
    if (felderZuIgnorieren.includes(key)) continue;

    const alterWert = altesObjekt[key];
    const neuerWert = neuesObjekt[key];

    // Nur speichern wenn unterschiedlich
    if (JSON.stringify(alterWert) !== JSON.stringify(neuerWert)) {
      alteWerte[key] = alterWert;
      neueWerte[key] = neuerWert;
    }
  }

  return { alteWerte, neueWerte };
}

/**
 * Middleware zum automatischen Logging von Requests
 * Kann auf spezifischen Routes eingesetzt werden
 */
function auditMiddleware(aktion, kategorie, getEntityInfo) {
  return async (req, res, next) => {
    // Original send-Funktion speichern
    const originalSend = res.send;

    res.send = function (body) {
      // Nach erfolgreichem Response loggen
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityInfo = typeof getEntityInfo === 'function' ? getEntityInfo(req, body) : {};

        log({
          req,
          aktion,
          kategorie,
          ...entityInfo
        }).catch(err => console.error('[AUDIT MIDDLEWARE ERROR]', err));
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Audit-Log Abfragen für Admin-Oberfläche
 */
async function getLogs(options = {}) {
  const {
    dojoId = null,
    userId = null,
    kategorie = null,
    aktion = null,
    entityType = null,
    entityId = null,
    vonDatum = null,
    bisDatum = null,
    suchbegriff = null,
    limit = 100,
    offset = 0
  } = options;

  let query = `
    SELECT * FROM audit_log
    WHERE 1=1
  `;
  const params = [];

  if (dojoId) {
    query += ' AND dojo_id = ?';
    params.push(dojoId);
  }

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  if (kategorie) {
    query += ' AND kategorie = ?';
    params.push(kategorie);
  }

  if (aktion) {
    query += ' AND aktion = ?';
    params.push(aktion);
  }

  if (entityType) {
    query += ' AND entity_type = ?';
    params.push(entityType);
  }

  if (entityId) {
    query += ' AND entity_id = ?';
    params.push(entityId);
  }

  if (vonDatum) {
    query += ' AND created_at >= ?';
    params.push(vonDatum);
  }

  if (bisDatum) {
    query += ' AND created_at <= ?';
    params.push(bisDatum);
  }

  if (suchbegriff) {
    query += ' AND (beschreibung LIKE ? OR entity_name LIKE ? OR user_name LIKE ? OR user_email LIKE ?)';
    const like = `%${suchbegriff}%`;
    params.push(like, like, like, like);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [logs] = await db.promise().query(query, params);
  return logs;
}

/**
 * Statistiken für Dashboard
 */
async function getStats(dojoId = null, tage = 30) {
  let whereClause = `WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
  const params = [tage];

  if (dojoId) {
    whereClause += ' AND dojo_id = ?';
    params.push(dojoId);
  }

  const [stats] = await db.promise().query(`
    SELECT
      kategorie,
      aktion,
      COUNT(*) as anzahl
    FROM audit_log
    ${whereClause}
    GROUP BY kategorie, aktion
    ORDER BY anzahl DESC
  `, params);

  const [timeline] = await db.promise().query(`
    SELECT
      DATE(created_at) as datum,
      COUNT(*) as anzahl
    FROM audit_log
    ${whereClause}
    GROUP BY DATE(created_at)
    ORDER BY datum DESC
    LIMIT 30
  `, params);

  return { stats, timeline };
}

module.exports = {
  log,
  ermittleAenderungen,
  auditMiddleware,
  getLogs,
  getStats,
  KATEGORIE,
  AKTION
};
