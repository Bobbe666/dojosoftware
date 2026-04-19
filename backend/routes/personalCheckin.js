// Personal Check-in API Routes
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../utils/dojo-filter-helper');

// Alle Routen erfordern Auth
router.use(authenticateToken);

// GET /api/personalCheckin - Check-ins für ein Datum laden
router.get('/', (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { datum } = req.query;
  const targetDate = datum || new Date().toISOString().split('T')[0];

  const dojoCondition = secureDojoId ? 'AND p.dojo_id = ?' : '';
  const params = secureDojoId ? [targetDate, secureDojoId] : [targetDate];

  const query = `
    SELECT
      pc.*,
      p.vorname, p.nachname, p.position, p.stundenlohn,
      CASE
        WHEN pc.checkout_time IS NOT NULL THEN
          TIMESTAMPDIFF(MINUTE, pc.checkin_time, pc.checkout_time)
        ELSE
          TIMESTAMPDIFF(MINUTE, pc.checkin_time, NOW())
      END AS aktuelle_arbeitszeit_minuten,
      CASE
        WHEN pc.checkout_time IS NOT NULL THEN
          ROUND((TIMESTAMPDIFF(MINUTE, pc.checkin_time, pc.checkout_time) / 60.0) * p.stundenlohn, 2)
        ELSE
          ROUND((TIMESTAMPDIFF(MINUTE, pc.checkin_time, NOW()) / 60.0) * p.stundenlohn, 2)
      END AS aktuelle_kosten
    FROM personal_checkin pc
    JOIN personal p ON pc.personal_id = p.personal_id
    WHERE DATE(pc.checkin_time) = ?
      ${dojoCondition}
    ORDER BY pc.checkin_time DESC
  `;

  db.query(query, params, (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Personal Check-ins:', { error: error.message });
      return res.status(500).json({ success: false, error: 'Fehler beim Abrufen der Check-in Daten' });
    }

    const stats = {
      total_checkins: results.length,
      eingecheckt: results.filter(r => r.status === 'eingecheckt').length,
      ausgecheckt: results.filter(r => r.status === 'ausgecheckt').length,
      total_kosten: results.reduce((sum, r) => sum + (parseFloat(r.aktuelle_kosten) || 0), 0),
      total_arbeitszeit_stunden: Math.round(results.reduce((sum, r) => sum + (r.aktuelle_arbeitszeit_minuten || 0), 0) / 60 * 10) / 10
    };

    res.json({ success: true, checkins: results, stats, datum: targetDate });
  });
});

// GET /api/personalCheckin/personal - Aktive Mitarbeiter für Dropdown
router.get('/personal', (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const dojoCondition = secureDojoId ? 'AND dojo_id = ?' : '';
  const params = secureDojoId ? [secureDojoId] : [];

  const query = `
    SELECT personal_id, vorname, nachname, position, stundenlohn, status
    FROM personal
    WHERE status = 'aktiv'
      ${dojoCondition}
    ORDER BY nachname, vorname
  `;

  db.query(query, params, (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Personal-Liste:', { error: error.message });
      return res.status(500).json({ success: false, error: 'Fehler beim Abrufen der Personal-Daten' });
    }
    res.json({ success: true, personal: results });
  });
});

// POST /api/personalCheckin - Einchecken
router.post('/', (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { personal_id, bemerkung } = req.body;

  if (!personal_id) {
    return res.status(400).json({ success: false, error: 'Personal ID ist erforderlich' });
  }

  // Mitarbeiter gehört zu diesem Dojo?
  const ownerCheck = secureDojoId
    ? 'SELECT personal_id FROM personal WHERE personal_id = ? AND dojo_id = ?'
    : 'SELECT personal_id FROM personal WHERE personal_id = ?';
  const ownerParams = secureDojoId ? [personal_id, secureDojoId] : [personal_id];

  db.query(ownerCheck, ownerParams, (ownerErr, ownerRows) => {
    if (ownerErr || ownerRows.length === 0) {
      return res.status(403).json({ success: false, error: 'Mitarbeiter nicht gefunden oder kein Zugriff' });
    }

    // Bereits heute eingecheckt?
    const checkQuery = `
      SELECT checkin_id FROM personal_checkin
      WHERE personal_id = ? AND DATE(checkin_time) = CURDATE() AND status = 'eingecheckt'
    `;

    db.query(checkQuery, [personal_id], (error, existing) => {
      if (error) {
        logger.error('Fehler beim Prüfen bestehender Check-ins:', { error: error.message });
        return res.status(500).json({ success: false, error: 'Fehler beim Prüfen des Check-in Status' });
      }

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Personal ist bereits heute eingecheckt',
          existing_checkin_id: existing[0].checkin_id
        });
      }

      const insertQuery = `
        INSERT INTO personal_checkin (personal_id, checkin_time, bemerkung, status)
        VALUES (?, NOW(), ?, 'eingecheckt')
      `;

      db.query(insertQuery, [personal_id, bemerkung || null], (insertErr, result) => {
        if (insertErr) {
          logger.error('Fehler beim Einchecken:', { error: insertErr.message });
          return res.status(500).json({ success: false, error: 'Fehler beim Einchecken' });
        }

        const selectQuery = `
          SELECT pc.*, p.vorname, p.nachname, p.position, p.stundenlohn
          FROM personal_checkin pc
          JOIN personal p ON pc.personal_id = p.personal_id
          WHERE pc.checkin_id = ?
        `;

        db.query(selectQuery, [result.insertId], (selErr, checkinData) => {
          if (selErr) {
            return res.status(201).json({ success: true, message: 'Personal eingecheckt' });
          }
          res.status(201).json({ success: true, message: 'Personal erfolgreich eingecheckt', checkin: checkinData[0] });
        });
      });
    });
  });
});

// PUT /api/personalCheckin/:checkin_id/checkout - Auschecken
router.put('/:checkin_id/checkout', (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { checkin_id } = req.params;
  const { bemerkung } = req.body;

  const checkQuery = secureDojoId
    ? `SELECT pc.*, p.stundenlohn FROM personal_checkin pc
       JOIN personal p ON pc.personal_id = p.personal_id
       WHERE pc.checkin_id = ? AND pc.status = 'eingecheckt' AND p.dojo_id = ?`
    : `SELECT pc.*, p.stundenlohn FROM personal_checkin pc
       JOIN personal p ON pc.personal_id = p.personal_id
       WHERE pc.checkin_id = ? AND pc.status = 'eingecheckt'`;
  const checkParams = secureDojoId ? [checkin_id, secureDojoId] : [checkin_id];

  db.query(checkQuery, checkParams, (error, existing) => {
    if (error) {
      logger.error('Fehler beim Prüfen des Check-ins:', { error: error.message });
      return res.status(500).json({ success: false, error: 'Fehler beim Prüfen des Check-in Status' });
    }

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Check-in nicht gefunden oder bereits ausgecheckt' });
    }

    const checkin = existing[0];

    const updateQuery = `
      UPDATE personal_checkin
      SET
        checkout_time = NOW(),
        arbeitszeit_minuten = TIMESTAMPDIFF(MINUTE, checkin_time, NOW()),
        kosten = ROUND((TIMESTAMPDIFF(MINUTE, checkin_time, NOW()) / 60.0) * ?, 2),
        bemerkung = COALESCE(?, bemerkung),
        status = 'ausgecheckt',
        aktualisiert_am = NOW()
      WHERE checkin_id = ?
    `;

    db.query(updateQuery, [checkin.stundenlohn, bemerkung || null, checkin_id], (updateErr) => {
      if (updateErr) {
        logger.error('Fehler beim Auschecken:', { error: updateErr.message });
        return res.status(500).json({ success: false, error: 'Fehler beim Auschecken' });
      }

      const selectQuery = `
        SELECT pc.*, p.vorname, p.nachname, p.position, p.stundenlohn
        FROM personal_checkin pc
        JOIN personal p ON pc.personal_id = p.personal_id
        WHERE pc.checkin_id = ?
      `;

      db.query(selectQuery, [checkin_id], (selErr, checkinData) => {
        if (selErr || !checkinData[0]) {
          return res.json({ success: true, message: 'Ausgecheckt' });
        }
        const updated = checkinData[0];
        res.json({
          success: true,
          message: `Ausgecheckt. Arbeitszeit: ${Math.round(updated.arbeitszeit_minuten / 60 * 10) / 10}h, Kosten: €${updated.kosten}`,
          checkin: updated
        });
      });
    });
  });
});

// GET /api/personalCheckin/stats - Statistiken (heute/woche/monat)
router.get('/stats', (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { zeitraum } = req.query;

  let dateCondition;
  switch (zeitraum) {
    case 'woche':  dateCondition = 'YEARWEEK(pc.checkin_time, 1) = YEARWEEK(CURDATE(), 1)'; break;
    case 'monat':  dateCondition = 'YEAR(pc.checkin_time) = YEAR(CURDATE()) AND MONTH(pc.checkin_time) = MONTH(CURDATE())'; break;
    default:       dateCondition = 'DATE(pc.checkin_time) = CURDATE()';
  }

  const dojoCondition = secureDojoId ? 'AND p.dojo_id = ?' : '';
  const params = secureDojoId ? [secureDojoId] : [];

  const statsQuery = `
    SELECT
      COUNT(*) AS total_checkins,
      SUM(CASE WHEN pc.status = 'eingecheckt' THEN 1 ELSE 0 END) AS aktiv_eingecheckt,
      SUM(CASE WHEN pc.status = 'ausgecheckt' THEN 1 ELSE 0 END) AS ausgecheckt,
      SUM(COALESCE(pc.kosten, 0)) AS gesamtkosten,
      SUM(COALESCE(pc.arbeitszeit_minuten, 0)) AS gesamtarbeitszeit_minuten,
      COUNT(DISTINCT pc.personal_id) AS unterschiedliche_personal
    FROM personal_checkin pc
    JOIN personal p ON pc.personal_id = p.personal_id
    WHERE ${dateCondition}
      ${dojoCondition}
  `;

  db.query(statsQuery, params, (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Statistiken:', { error: error.message });
      return res.status(500).json({ success: false, error: 'Fehler beim Abrufen der Statistiken' });
    }

    const stats = results[0];
    stats.gesamtarbeitszeit_stunden = Math.round((stats.gesamtarbeitszeit_minuten || 0) / 60 * 10) / 10;
    res.json({ success: true, stats, zeitraum: zeitraum || 'heute' });
  });
});

// GET /api/personalCheckin/lohnabrechnung - Monatliche Lohnabrechnung
router.get('/lohnabrechnung', (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { monat, jahr, personal_id } = req.query;
  const m = parseInt(monat) || new Date().getMonth() + 1;
  const y = parseInt(jahr) || new Date().getFullYear();

  const conds = ['YEAR(pc.checkin_time) = ?', 'MONTH(pc.checkin_time) = ?', "pc.status = 'ausgecheckt'"];
  const params = [y, m];

  if (secureDojoId) { conds.push('p.dojo_id = ?'); params.push(secureDojoId); }
  if (personal_id)  { conds.push('pc.personal_id = ?'); params.push(parseInt(personal_id, 10)); }

  const query = `
    SELECT
      p.personal_id, p.vorname, p.nachname, p.position, p.beschaeftigungsart,
      p.stundenlohn, p.grundgehalt,
      COUNT(pc.checkin_id)                                       AS anzahl_schichten,
      SUM(COALESCE(pc.arbeitszeit_minuten, 0))                   AS total_minuten,
      ROUND(SUM(COALESCE(pc.arbeitszeit_minuten, 0)) / 60.0, 2) AS total_stunden,
      ROUND(SUM(COALESCE(pc.kosten, 0)), 2)                      AS total_lohn,
      MIN(DATE(pc.checkin_time))                                 AS erster_tag,
      MAX(DATE(pc.checkin_time))                                 AS letzter_tag
    FROM personal_checkin pc
    JOIN personal p ON pc.personal_id = p.personal_id
    WHERE ${conds.join(' AND ')}
    GROUP BY p.personal_id, p.vorname, p.nachname, p.position,
             p.beschaeftigungsart, p.stundenlohn, p.grundgehalt
    ORDER BY p.nachname, p.vorname
  `;

  db.query(query, params, (error, results) => {
    if (error) {
      logger.error('Fehler Lohnabrechnung:', { error: error.message });
      return res.status(500).json({ success: false, error: 'Datenbankfehler' });
    }

    const gesamt = {
      total_stunden: results.reduce((s, r) => s + parseFloat(r.total_stunden || 0), 0).toFixed(2),
      total_lohn:    results.reduce((s, r) => s + parseFloat(r.total_lohn    || 0), 0).toFixed(2),
    };

    res.json({ success: true, data: results, gesamt, monat: m, jahr: y });
  });
});

// GET /api/personalCheckin/verlauf/:personal_id - Jahresverlauf eines Mitarbeiters
router.get('/verlauf/:personal_id', (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const personal_id = parseInt(req.params.personal_id, 10);
  const y = parseInt(req.query.jahr) || new Date().getFullYear();

  // Zugriffsprüfung
  const ownerCheck = secureDojoId
    ? 'SELECT personal_id FROM personal WHERE personal_id = ? AND dojo_id = ?'
    : 'SELECT personal_id FROM personal WHERE personal_id = ?';
  const ownerParams = secureDojoId ? [personal_id, secureDojoId] : [personal_id];

  db.query(ownerCheck, ownerParams, (ownerErr, ownerRows) => {
    if (ownerErr || ownerRows.length === 0) {
      return res.status(403).json({ success: false, error: 'Kein Zugriff' });
    }

    const query = `
      SELECT
        MONTH(pc.checkin_time) AS monat,
        COUNT(pc.checkin_id)   AS anzahl_schichten,
        ROUND(SUM(COALESCE(pc.arbeitszeit_minuten, 0)) / 60.0, 2) AS total_stunden,
        ROUND(SUM(COALESCE(pc.kosten, 0)), 2) AS total_lohn
      FROM personal_checkin pc
      WHERE pc.personal_id = ? AND YEAR(pc.checkin_time) = ? AND pc.status = 'ausgecheckt'
      GROUP BY MONTH(pc.checkin_time)
      ORDER BY monat ASC
    `;

    db.query(query, [personal_id, y], (error, results) => {
      if (error) {
        logger.error('Fehler Verlauf:', { error: error.message });
        return res.status(500).json({ success: false, error: 'Datenbankfehler' });
      }
      res.json({ success: true, data: results, personal_id, jahr: y });
    });
  });
});

// DELETE /api/personalCheckin/:checkin_id - Check-in löschen
router.delete('/:checkin_id', (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { checkin_id } = req.params;

  const deleteQuery = secureDojoId
    ? `DELETE pc FROM personal_checkin pc
       JOIN personal p ON pc.personal_id = p.personal_id
       WHERE pc.checkin_id = ? AND p.dojo_id = ?`
    : 'DELETE FROM personal_checkin WHERE checkin_id = ?';
  const deleteParams = secureDojoId ? [checkin_id, secureDojoId] : [checkin_id];

  db.query(deleteQuery, deleteParams, (error, result) => {
    if (error) {
      logger.error('Fehler beim Löschen des Check-ins:', { error: error.message });
      return res.status(500).json({ success: false, error: 'Fehler beim Löschen des Check-ins' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Check-in nicht gefunden' });
    }

    res.json({ success: true, message: 'Check-in erfolgreich gelöscht' });
  });
});

module.exports = router;
