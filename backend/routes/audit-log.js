/**
 * Audit-Log API Routes
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const auditLog = require('../services/auditLogService');
const db = require('../db');

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
  if (req.user.rolle !== 'super_admin' && req.user.role !== 'super_admin' &&
      req.user.rolle !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Keine Berechtigung' });
  }
  next();
};

const isSA = (req) => req.user.rolle === 'super_admin' || req.user.role === 'super_admin';

/**
 * Baut WHERE-Klausel + params aus den Lösch-Filtern.
 * Unterstützt: ids, user_id, user_email, user_name, user_role,
 *              kategorie, aktion, ip_adresse,
 *              von_datum, bis_datum, alter_tage, alle
 */
function buildDeleteWhere(filters, dojoId, superAdmin) {
  const conditions = ['1=1'];
  const params = [];

  if (!superAdmin && dojoId) {
    conditions.push('dojo_id = ?');
    params.push(dojoId);
  }

  const { ids, user_id, user_email, user_name, user_role,
          kategorie, aktion, ip_adresse,
          entity_type, entity_id,
          von_datum, bis_datum, alter_tage, alle } = filters;

  if (ids && Array.isArray(ids) && ids.length > 0) {
    conditions.push(`id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
    return { conditions, params }; // IDs überschreiben andere Filter
  }

  if (!alle) {
    // Mindestens ein weiterer Filter muss gesetzt sein
    let hasFilter = false;

    if (user_id) { conditions.push('user_id = ?'); params.push(user_id); hasFilter = true; }
    if (user_email) { conditions.push('user_email = ?'); params.push(user_email); hasFilter = true; }
    if (user_name) { conditions.push('user_name LIKE ?'); params.push(`%${user_name}%`); hasFilter = true; }
    if (user_role) { conditions.push('user_role = ?'); params.push(user_role); hasFilter = true; }
    if (kategorie) { conditions.push('kategorie = ?'); params.push(kategorie); hasFilter = true; }
    if (aktion) { conditions.push('aktion LIKE ?'); params.push(`%${aktion}%`); hasFilter = true; }
    if (ip_adresse) { conditions.push('ip_adresse LIKE ?'); params.push(`%${ip_adresse}%`); hasFilter = true; }
    if (von_datum) { conditions.push('created_at >= ?'); params.push(von_datum); hasFilter = true; }
    if (bis_datum) { conditions.push('created_at <= ?'); params.push(bis_datum + ' 23:59:59'); hasFilter = true; }
    if (entity_type) { conditions.push('entity_type = ?'); params.push(entity_type); hasFilter = true; }
    if (entity_id) { conditions.push('entity_id = ?'); params.push(parseInt(entity_id)); hasFilter = true; }
    if (alter_tage) {
      conditions.push('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)');
      params.push(parseInt(alter_tage));
      hasFilter = true;
    }

    if (!hasFilter) return null; // Verhindert versehentliches "Alle löschen"
  }

  return { conditions, params };
}

// ============================================================================
// GET /api/audit-log
// ============================================================================
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { kategorie, aktion, entity_type, entity_id, von_datum, bis_datum, suchbegriff, limit = 100, offset = 0 } = req.query;
    const dojoId = isSA(req) ? req.query.dojo_id : req.user.dojo_id;

    const logs = await auditLog.getLogs({
      dojoId, kategorie, aktion,
      entityType: entity_type,
      entityId: entity_id ? parseInt(entity_id) : null,
      vonDatum: von_datum, bisDatum: bis_datum, suchbegriff,
      limit: parseInt(limit), offset: parseInt(offset)
    });

    res.json({ success: true, data: logs, pagination: { limit: parseInt(limit), offset: parseInt(offset), count: logs.length } });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Audit-Logs:', { error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// GET /api/audit-log/stats
// ============================================================================
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { tage = 30 } = req.query;
    const dojoId = isSA(req) ? req.query.dojo_id : req.user.dojo_id;
    const stats = await auditLog.getStats(dojoId, parseInt(tage));
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Statistiken:', { error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// GET /api/audit-log/kategorien
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
// ============================================================================
router.get('/aktionen', requireAdmin, (req, res) => {
  res.json({ success: true, data: auditLog.AKTION });
});

// ============================================================================
// GET /api/audit-log/entity-types
// Distinct entity_type Werte aus dem Audit-Log
// ============================================================================
router.get('/entity-types', requireAdmin, async (req, res) => {
  try {
    const dojoId = isSA(req) ? req.query.dojo_id : req.user.dojo_id;
    let query = `SELECT entity_type, COUNT(*) AS anzahl FROM audit_log
                 WHERE entity_type IS NOT NULL AND entity_type != ''`;
    const params = [];
    if (dojoId) { query += ' AND dojo_id = ?'; params.push(dojoId); }
    query += ' GROUP BY entity_type ORDER BY anzahl DESC';

    const [rows] = await db.promise().query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Fehler beim Laden der Entity-Types:', { error: error.message });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// GET /api/audit-log/users
// Distinct Benutzer aus dem Audit-Log (für Dropdown im Bereinigen-Dialog)
// Gibt alle eindeutigen user_email-Werte zurück (inkl. Einträge ohne user_id)
// ============================================================================
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const dojoId = isSA(req) ? req.query.dojo_id : req.user.dojo_id;
    let query = `SELECT user_email,
                        MAX(user_id)   AS user_id,
                        MAX(user_name) AS user_name,
                        MAX(user_role) AS user_role,
                        COUNT(*)       AS anzahl_logs
                 FROM audit_log
                 WHERE user_email IS NOT NULL AND user_email != ''`;
    const params = [];
    if (dojoId) { query += ' AND dojo_id = ?'; params.push(dojoId); }
    query += ' GROUP BY user_email ORDER BY user_email ASC LIMIT 200';

    const [rows] = await db.promise().query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Fehler beim Laden der Benutzer:', { error: error.message });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// POST /api/audit-log/bereinigen/vorschau
// Zählt Einträge die gelöscht werden würden (Dry-Run)
// ============================================================================
router.post('/bereinigen/vorschau', requireAdmin, async (req, res) => {
  try {
    const superAdmin = isSA(req);
    const dojoId = superAdmin ? null : req.user.dojo_id;
    const where = buildDeleteWhere(req.body, dojoId, superAdmin);

    if (!where) return res.status(400).json({ success: false, error: 'Keine gültigen Filter angegeben' });

    const query = `SELECT COUNT(*) as anzahl FROM audit_log WHERE ${where.conditions.join(' AND ')}`;
    const [rows] = await db.promise().query(query, where.params);
    res.json({ success: true, anzahl: rows[0].anzahl });
  } catch (error) {
    logger.error('Fehler bei Bereinigen-Vorschau:', { error: error.message });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// GET /api/audit-log/entity/:type/:id
// ============================================================================
router.get('/entity/:type/:id', requireAdmin, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { limit = 50 } = req.query;
    const dojoId = isSA(req) ? null : req.user.dojo_id;
    const logs = await auditLog.getLogs({ dojoId, entityType: type, entityId: parseInt(id), limit: parseInt(limit) });
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Entity-Logs:', { error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// DELETE /api/audit-log/:id  — einzelnen Eintrag löschen
// ============================================================================
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const superAdmin = isSA(req);
    let query = 'DELETE FROM audit_log WHERE id = ?';
    const params = [id];
    const dojoId = req.user.dojo_id;
    if (!superAdmin && dojoId) { query += ' AND dojo_id = ?'; params.push(dojoId); }

    const [result] = await db.promise().query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Eintrag nicht gefunden' });
    res.json({ success: true, deleted: result.affectedRows });
  } catch (error) {
    logger.error('Fehler beim Löschen des Audit-Log-Eintrags:', { error: error.message });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// POST /api/audit-log/bereinigen  — Massenbereinigung mit allen Filteroptionen
// (POST statt DELETE, damit Request-Body zuverlässig übertragen wird)
// Filters: ids, user_id, user_email, user_name, user_role,
//          kategorie, aktion, ip_adresse,
//          von_datum, bis_datum, alter_tage, alle
// ============================================================================
router.post('/bereinigen', requireAdmin, async (req, res) => {
  try {
    const superAdmin = isSA(req);
    const dojoId = superAdmin ? null : req.user.dojo_id;
    const where = buildDeleteWhere(req.body, dojoId, superAdmin);

    if (!where) return res.status(400).json({ success: false, error: 'Keine gültigen Filter angegeben. Bitte mindestens einen Filter setzen.' });

    const query = `DELETE FROM audit_log WHERE ${where.conditions.join(' AND ')}`;
    const [result] = await db.promise().query(query, where.params);
    res.json({ success: true, deleted: result.affectedRows });
  } catch (error) {
    logger.error('Fehler bei Audit-Log Massenbereinigung:', { error: error.message });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// DELETE /api/audit-log  — Legacy (leere Route zur Sicherheit)
// ============================================================================
router.delete('/', requireAdmin, (req, res) => {
  res.status(410).json({ success: false, error: 'Bitte POST /bereinigen verwenden' });
});

module.exports = router;
