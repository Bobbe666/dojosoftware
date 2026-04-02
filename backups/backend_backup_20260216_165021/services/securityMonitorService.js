/**
 * Security Monitoring Service
 * Erkennt und protokolliert Sicherheitsbedrohungen
 */

const db = require('../db');

// Patterns für Angriffserkennung
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|SET|TABLE|DATABASE)\b)/i,
  /(\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+)/i,
  /(--|\#|\/\*|\*\/)/,
  /(\bEXEC\b|\bEXECUTE\b)/i,
  /(\bxp_|\bsp_)/i,
  /(SLEEP\s*\(|BENCHMARK\s*\(|WAITFOR\s+DELAY)/i,
  /(\bLOAD_FILE\b|\bINTO\s+OUTFILE\b|\bINTO\s+DUMPFILE\b)/i
];

const XSS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=\s*["']?[^"']*["']?/gi,
  /<iframe\b/gi,
  /<object\b/gi,
  /<embed\b/gi,
  /expression\s*\(/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/,
  /%2e%2e%2f/gi,
  /%2e%2e\//gi,
  /\.\.%2f/gi,
  /%2e%2e%5c/gi,
  /etc\/passwd/gi,
  /etc\/shadow/gi,
  /proc\/self/gi
];

// Cache für Rate-Limiting Tracking
const loginAttempts = new Map();
const requestCounts = new Map();

// Cleanup alte Einträge alle 5 Minuten
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  for (const [key, data] of loginAttempts.entries()) {
    if (data.firstAttempt < fiveMinutesAgo) {
      loginAttempts.delete(key);
    }
  }

  for (const [key, data] of requestCounts.entries()) {
    if (data.windowStart < fiveMinutesAgo) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

const securityMonitorService = {
  /**
   * Protokolliert einen Security-Alert
   */
  async logAlert(alertData) {
    const {
      alert_type,
      severity = 'medium',
      ip_address,
      user_agent,
      request_path,
      request_method,
      request_body,
      user_id,
      dojo_id,
      description,
      blocked = false,
      metadata = {}
    } = alertData;

    try {
      // Alert in DB speichern
      const [result] = await db.promise().query(
        `INSERT INTO security_alerts
         (alert_type, severity, ip_address, user_agent, request_path, request_method,
          request_body, user_id, dojo_id, description, blocked, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alert_type,
          severity,
          ip_address,
          user_agent?.substring(0, 500),
          request_path?.substring(0, 500),
          request_method,
          request_body ? JSON.stringify(request_body).substring(0, 5000) : null,
          user_id,
          dojo_id,
          description,
          blocked,
          JSON.stringify(metadata)
        ]
      );

      // Bei kritischen Alerts: Admin benachrichtigen
      if (severity === 'critical' || severity === 'high') {
        await this.notifyAdmin(alertData, result.insertId);
      }

      // Bei wiederholten Angriffen: IP blockieren
      if (ip_address) {
        await this.checkAndBlockIP(ip_address, alert_type);
      }

      return result.insertId;
    } catch (error) {
      console.error('Fehler beim Speichern des Security-Alerts:', error);
      return null;
    }
  },

  /**
   * Admin über kritischen Alert benachrichtigen
   */
  async notifyAdmin(alertData, alertId) {
    try {
      const severityText = {
        critical: 'KRITISCH',
        high: 'HOCH',
        medium: 'MITTEL',
        low: 'NIEDRIG'
      };

      const alertTypeText = {
        brute_force: 'Brute-Force Angriff',
        sql_injection: 'SQL-Injection Versuch',
        xss_attempt: 'XSS Angriff',
        rate_limit_exceeded: 'Rate-Limit überschritten',
        invalid_token: 'Ungültiger Token',
        suspicious_request: 'Verdächtige Anfrage',
        unauthorized_access: 'Unbefugter Zugriff',
        file_upload_attack: 'Verdächtiger Datei-Upload',
        path_traversal: 'Path Traversal Versuch',
        csrf_violation: 'CSRF Verletzung',
        other: 'Sicherheitsereignis'
      };

      await db.promise().query(
        `INSERT INTO notifications
         (type, recipient, subject, message, status, metadata)
         VALUES ('push', 'admin', ?, ?, 'pending', ?)`,
        [
          `Sicherheitswarnung: ${alertTypeText[alertData.alert_type] || alertData.alert_type}`,
          `<strong>${severityText[alertData.severity]}</strong>: ${alertData.description || 'Sicherheitsereignis erkannt'}<br>
           IP: ${alertData.ip_address || 'unbekannt'}<br>
           Pfad: ${alertData.request_path || 'unbekannt'}`,
          JSON.stringify({
            alert_id: alertId,
            alert_type: alertData.alert_type,
            severity: alertData.severity,
            ip: alertData.ip_address
          })
        ]
      );
    } catch (error) {
      console.error('Fehler beim Benachrichtigen des Admins:', error);
    }
  },

  /**
   * Prüft ob IP blockiert werden soll
   */
  async checkAndBlockIP(ip_address, alert_type) {
    try {
      // Zähle Alerts für diese IP in den letzten 15 Minuten
      const [alerts] = await db.promise().query(
        `SELECT COUNT(*) as count FROM security_alerts
         WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
        [ip_address]
      );

      const alertCount = alerts[0].count;

      // Bei mehr als 50 Alerts in 15 Minuten: IP für 1 Stunde blockieren
      // (Erhöht von 10, um False-Positives bei normalem Traffic zu vermeiden)
      if (alertCount >= 50) {
        await db.promise().query(
          `INSERT INTO blocked_ips (ip_address, reason, blocked_until, alert_count)
           VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), ?)
           ON DUPLICATE KEY UPDATE
           alert_count = alert_count + 1,
           blocked_until = CASE
             WHEN alert_count >= 100 THEN DATE_ADD(NOW(), INTERVAL 24 HOUR)
             ELSE DATE_ADD(NOW(), INTERVAL 1 HOUR)
           END`,
          [ip_address, `Automatisch blockiert: ${alertCount} Alerts`, alertCount]
        );

        await this.logAlert({
          alert_type: 'other',
          severity: 'high',
          ip_address,
          description: `IP automatisch blockiert nach ${alertCount} Sicherheitsereignissen`,
          blocked: true
        });
      }
    } catch (error) {
      console.error('Fehler beim IP-Blocking:', error);
    }
  },

  /**
   * Prüft ob IP blockiert ist
   */
  async isIPBlocked(ip_address) {
    try {
      const [rows] = await db.promise().query(
        `SELECT * FROM blocked_ips
         WHERE ip_address = ?
         AND (permanent = TRUE OR blocked_until > NOW())`,
        [ip_address]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Fehler beim Prüfen der IP-Blockierung:', error);
      return false;
    }
  },

  /**
   * Erkennt SQL-Injection Versuche
   */
  detectSQLInjection(input) {
    if (!input) return false;
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(str));
  },

  /**
   * Erkennt XSS Versuche
   */
  detectXSS(input) {
    if (!input) return false;
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return XSS_PATTERNS.some(pattern => pattern.test(str));
  },

  /**
   * Erkennt Path Traversal Versuche
   */
  detectPathTraversal(input) {
    if (!input) return false;
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(str));
  },

  /**
   * Trackt fehlgeschlagene Login-Versuche
   */
  trackFailedLogin(ip_address) {
    const now = Date.now();
    const data = loginAttempts.get(ip_address) || { count: 0, firstAttempt: now };

    // Reset nach 15 Minuten
    if (now - data.firstAttempt > 15 * 60 * 1000) {
      data.count = 1;
      data.firstAttempt = now;
    } else {
      data.count++;
    }

    loginAttempts.set(ip_address, data);
    return data.count;
  },

  /**
   * Prüft ob Brute-Force Angriff vorliegt
   */
  isBruteForceAttack(ip_address) {
    const data = loginAttempts.get(ip_address);
    return data && data.count >= 5;
  },

  /**
   * Holt Security-Statistiken für Admin
   */
  async getSecurityStats(days = 7) {
    try {
      // Alerts der letzten X Tage
      const [recentAlerts] = await db.promise().query(
        `SELECT
           alert_type,
           severity,
           COUNT(*) as count
         FROM security_alerts
         WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY alert_type, severity
         ORDER BY count DESC`,
        [days]
      );

      // Top blockierte IPs
      const [blockedIPs] = await db.promise().query(
        `SELECT ip_address, reason, alert_count, blocked_until, permanent
         FROM blocked_ips
         ORDER BY alert_count DESC
         LIMIT 10`
      );

      // Ungelöste kritische Alerts
      const [unresolvedCritical] = await db.promise().query(
        `SELECT * FROM security_alerts
         WHERE resolved = FALSE AND severity IN ('critical', 'high')
         ORDER BY created_at DESC
         LIMIT 20`
      );

      // Tägliche Statistiken
      const [dailyStats] = await db.promise().query(
        `SELECT * FROM security_stats_daily
         WHERE date > DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ORDER BY date DESC`,
        [days]
      );

      // Gesamtzahlen
      const [totals] = await db.promise().query(
        `SELECT
           COUNT(*) as total_alerts,
           SUM(CASE WHEN resolved = FALSE THEN 1 ELSE 0 END) as unresolved,
           SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
           SUM(CASE WHEN blocked = TRUE THEN 1 ELSE 0 END) as blocked_count
         FROM security_alerts
         WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days]
      );

      return {
        summary: totals[0],
        alertsByType: recentAlerts,
        blockedIPs,
        unresolvedCritical,
        dailyStats
      };
    } catch (error) {
      console.error('Fehler beim Abrufen der Security-Stats:', error);
      throw error;
    }
  },

  /**
   * Holt alle Alerts für Admin-Dashboard
   */
  async getAlerts(options = {}) {
    const {
      page = 1,
      limit = 50,
      severity,
      alert_type,
      resolved,
      startDate,
      endDate
    } = options;

    try {
      let query = 'SELECT * FROM security_alerts WHERE 1=1';
      const params = [];

      if (severity) {
        query += ' AND severity = ?';
        params.push(severity);
      }
      if (alert_type) {
        query += ' AND alert_type = ?';
        params.push(alert_type);
      }
      if (resolved !== undefined) {
        query += ' AND resolved = ?';
        params.push(resolved);
      }
      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }

      // Count für Pagination
      const [countResult] = await db.promise().query(
        query.replace('SELECT *', 'SELECT COUNT(*) as total'),
        params
      );

      // Daten mit Pagination
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [alerts] = await db.promise().query(query, params);

      return {
        alerts,
        total: countResult[0].total,
        page,
        limit,
        totalPages: Math.ceil(countResult[0].total / limit)
      };
    } catch (error) {
      console.error('Fehler beim Abrufen der Alerts:', error);
      throw error;
    }
  },

  /**
   * Markiert Alert als gelöst
   */
  async resolveAlert(alertId, resolvedBy) {
    try {
      await db.promise().query(
        `UPDATE security_alerts
         SET resolved = TRUE, resolved_at = NOW(), resolved_by = ?
         WHERE id = ?`,
        [resolvedBy, alertId]
      );
      return true;
    } catch (error) {
      console.error('Fehler beim Lösen des Alerts:', error);
      return false;
    }
  },

  /**
   * IP manuell blockieren/entsperren
   */
  async toggleIPBlock(ip_address, block, permanent = false, reason = '') {
    try {
      if (block) {
        await db.promise().query(
          `INSERT INTO blocked_ips (ip_address, reason, permanent, blocked_until)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           permanent = VALUES(permanent),
           reason = VALUES(reason),
           blocked_until = VALUES(blocked_until)`,
          [ip_address, reason, permanent, permanent ? null : 'DATE_ADD(NOW(), INTERVAL 24 HOUR)']
        );
      } else {
        await db.promise().query(
          'DELETE FROM blocked_ips WHERE ip_address = ?',
          [ip_address]
        );
      }
      return true;
    } catch (error) {
      console.error('Fehler beim IP-Block Toggle:', error);
      return false;
    }
  }
};

module.exports = securityMonitorService;
