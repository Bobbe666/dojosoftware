/**
 * Security Admin Routes
 * Verwaltung von Sicherheitswarnungen und IP-Blockierungen
 */

const express = require('express');
const router = express.Router();
const securityMonitorService = require('../services/securityMonitorService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Alle Routes erfordern Admin-Rolle
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/security/stats
 * Sicherheitsstatistiken abrufen
 */
router.get('/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await securityMonitorService.getSecurityStats(days);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Security-Stats:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der Statistiken'
    });
  }
});

/**
 * GET /api/security/alerts
 * Alle Security-Alerts abrufen (mit Pagination und Filtern)
 */
router.get('/alerts', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      severity,
      alert_type,
      resolved,
      startDate,
      endDate
    } = req.query;

    const alerts = await securityMonitorService.getAlerts({
      page: parseInt(page),
      limit: parseInt(limit),
      severity,
      alert_type,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      startDate,
      endDate
    });

    res.json({
      success: true,
      ...alerts
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der Alerts'
    });
  }
});

/**
 * PUT /api/security/alerts/:id/resolve
 * Alert als gelöst markieren
 */
router.put('/alerts/:id/resolve', async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);
    const userId = req.user.id;

    const success = await securityMonitorService.resolveAlert(alertId, userId);

    if (success) {
      res.json({
        success: true,
        message: 'Alert als gelöst markiert'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Fehler beim Lösen des Alerts'
      });
    }
  } catch (error) {
    console.error('Fehler beim Lösen des Alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Lösen des Alerts'
    });
  }
});

/**
 * GET /api/security/blocked-ips
 * Blockierte IPs abrufen
 */
router.get('/blocked-ips', async (req, res) => {
  try {
    const db = require('../db');
    const [blockedIPs] = await db.promise().query(
      `SELECT * FROM blocked_ips ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      blockedIPs
    });
  } catch (error) {
    console.error('Fehler beim Abrufen blockierter IPs:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen blockierter IPs'
    });
  }
});

/**
 * POST /api/security/block-ip
 * IP manuell blockieren
 */
router.post('/block-ip', async (req, res) => {
  try {
    const { ip_address, permanent = false, reason = 'Manuell blockiert' } = req.body;

    if (!ip_address) {
      return res.status(400).json({
        success: false,
        error: 'IP-Adresse erforderlich'
      });
    }

    const success = await securityMonitorService.toggleIPBlock(ip_address, true, permanent, reason);

    if (success) {
      // Log diese Aktion
      await securityMonitorService.logAlert({
        alert_type: 'other',
        severity: 'low',
        ip_address,
        description: `IP manuell blockiert von Admin (User-ID: ${req.user.id})`,
        user_id: req.user.id,
        metadata: { reason, permanent }
      });

      res.json({
        success: true,
        message: 'IP erfolgreich blockiert'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Fehler beim Blockieren der IP'
      });
    }
  } catch (error) {
    console.error('Fehler beim Blockieren der IP:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Blockieren der IP'
    });
  }
});

/**
 * DELETE /api/security/unblock-ip/:ip
 * IP entsperren
 */
router.delete('/unblock-ip/:ip', async (req, res) => {
  try {
    const ip_address = decodeURIComponent(req.params.ip);

    const success = await securityMonitorService.toggleIPBlock(ip_address, false);

    if (success) {
      res.json({
        success: true,
        message: 'IP erfolgreich entsperrt'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Fehler beim Entsperren der IP'
      });
    }
  } catch (error) {
    console.error('Fehler beim Entsperren der IP:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Entsperren der IP'
    });
  }
});

/**
 * GET /api/security/alert-types
 * Verfügbare Alert-Typen für Filter
 */
router.get('/alert-types', (req, res) => {
  res.json({
    success: true,
    alertTypes: [
      { value: 'brute_force', label: 'Brute-Force Angriff' },
      { value: 'sql_injection', label: 'SQL-Injection' },
      { value: 'xss_attempt', label: 'XSS Angriff' },
      { value: 'rate_limit_exceeded', label: 'Rate-Limit überschritten' },
      { value: 'invalid_token', label: 'Ungültiger Token' },
      { value: 'suspicious_request', label: 'Verdächtige Anfrage' },
      { value: 'unauthorized_access', label: 'Unbefugter Zugriff' },
      { value: 'file_upload_attack', label: 'Verdächtiger Datei-Upload' },
      { value: 'path_traversal', label: 'Path Traversal' },
      { value: 'csrf_violation', label: 'CSRF Verletzung' },
      { value: 'other', label: 'Sonstige' }
    ],
    severities: [
      { value: 'low', label: 'Niedrig', color: '#22c55e' },
      { value: 'medium', label: 'Mittel', color: '#f59e0b' },
      { value: 'high', label: 'Hoch', color: '#f97316' },
      { value: 'critical', label: 'Kritisch', color: '#ef4444' }
    ]
  });
});

module.exports = router;
