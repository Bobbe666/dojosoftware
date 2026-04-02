/**
 * Audit-Log API Routes
 * Endpunkte zum Abrufen und Filtern von Audit-Logs
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const auditLog = require('../services/auditLogService');

// Middleware für Admin-Check (wird vom Server injiziert)
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
  }
  // SuperAdmin oder Dojo-Admin erlaubt
  if (req.user.rolle !== 'super_admin' && req.user.role !== 'super_admin' && req.user.rolle !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Keine Berechtigung' });
  }
  next();
};

// ============================================================================
// GET /api/audit-log
// Audit-Logs abrufen (mit Filtern)
// ============================================================================
router.get('/', requireAdmin, async (req, res) => {
  try {
    const {
      kategorie,
      aktion,
      entity_type,
      entity_id,
      von_datum,
      bis_datum,
      suchbegriff,
      limit = 100,
      offset = 0
    } = req.query;

    // Dojo-Filter: Admins sehen nur ihr Dojo, SuperAdmins alles
    const dojoId = (req.user.rolle === 'super_admin' || req.user.role === 'super_admin') ? req.query.dojo_id : req.user.dojo_id;

    const logs = await auditLog.getLogs({
      dojoId,
      kategorie,
      aktion,
      entityType: entity_type,
      entityId: entity_id ? parseInt(entity_id) : null,
      vonDatum: von_datum,
      bisDatum: bis_datum,
      suchbegriff,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: logs.length
      }
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Audit-Logs:', { error: error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// GET /api/audit-log/stats
// Statistiken für Dashboard
// ============================================================================
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { tage = 30 } = req.query;
    const dojoId = (req.user.rolle === 'super_admin' || req.user.role === 'super_admin') ? req.query.dojo_id : req.user.dojo_id;

    const stats = await auditLog.getStats(dojoId, parseInt(tage));

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Statistiken:', { error: error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// GET /api/audit-log/kategorien
// Verfügbare Kategorien abrufen
// ============================================================================
router.get('/kategorien', requireAdmin, (req, res) => {
  res.json({
    success: true,
    data: [
      { value: 'MITGLIED', label: 'Mitglieder', icon: '👤' },
      { value: 'FINANZEN', label: 'Finanzen', icon: '💰' },
      { value: 'VERTRAG', label: 'Verträge', icon: '📄' },
      { value: 'PRUEFUNG', label: 'Prüfungen', icon: '🥋' },
      { value: 'ADMIN', label: 'Administration', icon: '⚙️' },
      { value: 'SEPA', label: 'SEPA', icon: '🏦' },
      { value: 'DOKUMENT', label: 'Dokumente', icon: '📁' },
      { value: 'SYSTEM', label: 'System', icon: '🖥️' },
      { value: 'AUTH', label: 'Authentifizierung', icon: '🔐' }
    ]
  });
});

// ============================================================================
// GET /api/audit-log/aktionen
// Verfügbare Aktionen abrufen
// ============================================================================
router.get('/aktionen', requireAdmin, (req, res) => {
  res.json({
    success: true,
    data: auditLog.AKTION
  });
});

// ============================================================================
// GET /api/audit-log/entity/:type/:id
// Logs für eine bestimmte Entity (z.B. Mitglied)
// ============================================================================
router.get('/entity/:type/:id', requireAdmin, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { limit = 50 } = req.query;

    const dojoId = (req.user.rolle === 'super_admin' || req.user.role === 'super_admin') ? null : req.user.dojo_id;

    const logs = await auditLog.getLogs({
      dojoId,
      entityType: type,
      entityId: parseInt(id),
      limit: parseInt(limit)
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Entity-Logs:', { error: error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

module.exports = router;
