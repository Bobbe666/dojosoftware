/**
 * 🛰️  COCKPIT-API  (Inhaber-Lagezentrum)
 * ============================================================
 * Read-only Zusammenfassung „Was ist heute los?" für das
 * iPhone-Homescreen-Widget (Scriptable) und die Cockpit-PWA.
 *
 * Auth: EIGENES statisches Owner-Token (COCKPIT_TOKEN in .env),
 *       KEIN JWT. Read-only, plattformweit (alle Dojos).
 *
 * Liefert das einheitliche Cockpit-Schema (siehe ~/cockpit/SCHEMA.md):
 *   { app, label, icon, generated_at, items:[ {key,label,value,severity} ] }
 *
 * Mounten in server.js OHNE authenticateToken:
 *   app.use('/api/cockpit', require('./routes/cockpit'));
 */

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../db');
const logger  = require('../utils/logger');

// ──────────────────────────────────────────────────────────────────
// Read-only Owner-Token-Auth (konstantzeit-Vergleich)
// ──────────────────────────────────────────────────────────────────
function cockpitAuth(req, res, next) {
  const expected = process.env.COCKPIT_TOKEN;
  if (!expected || expected.length < 16) {
    return res.status(503).json({ error: 'Cockpit nicht konfiguriert (COCKPIT_TOKEN fehlt/zu kurz)' });
  }
  const header   = req.headers['authorization'] || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || '');

  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Ungültiges Cockpit-Token' });
  }
  next();
}

// Severity-Helfer: Kachelfarbe steuert sich über den Wert
const sev = (value, { warnAbove = null, alertAbove = null } = {}) => {
  if (alertAbove !== null && value > alertAbove) return 'alert';
  if (warnAbove  !== null && value > warnAbove)  return 'warn';
  return 'info';
};

// ──────────────────────────────────────────────────────────────────
// GET /api/cockpit/summary
// Plattformweite Tageszusammenfassung der Dojosoftware
// ──────────────────────────────────────────────────────────────────
router.get('/summary', cockpitAuth, async (req, res) => {
  const pool = db.promise();
  const items = [];

  // Helfer: Query ausführen, Fehler (z.B. fehlende Tabelle) tolerieren
  const safeCount = async (sql, fallback = 0) => {
    try {
      const [[row]] = await pool.query(sql);
      const val = row ? Object.values(row)[0] : fallback;
      return Number(val) || 0;
    } catch (_) {
      return fallback;
    }
  };

  try {
    // ── Check-ins heute (aktiv) ────────────────────────────────────
    const checkins_heute = await safeCount(
      `SELECT COUNT(*) AS c FROM checkins c
       WHERE c.checkin_time >= CURDATE()
         AND c.checkin_time <  CURDATE() + INTERVAL 1 DAY
         AND c.status = 'active'`
    );
    items.push({ key: 'checkins_heute', label: 'Check-ins heute', value: checkins_heute, severity: 'info' });

    // ── Neue Mitglieder heute ──────────────────────────────────────
    const neue_mitglieder_heute = await safeCount(
      `SELECT COUNT(*) AS c FROM mitglieder
       WHERE aktiv = 1 AND eintrittsdatum = CURDATE()`
    );
    items.push({ key: 'neue_mitglieder_heute', label: 'Neue Mitglieder heute', value: neue_mitglieder_heute, severity: 'info' });

    // ── Geburtstage heute ──────────────────────────────────────────
    const geburtstage_heute = await safeCount(
      `SELECT COUNT(*) AS c FROM mitglieder
       WHERE aktiv = 1 AND geburtsdatum IS NOT NULL
         AND DAY(geburtsdatum)   = DAY(CURDATE())
         AND MONTH(geburtsdatum) = MONTH(CURDATE())`
    );
    items.push({ key: 'geburtstage_heute', label: 'Geburtstage heute', value: geburtstage_heute, severity: 'info' });

    // ── Geburtstage diese Woche (nächste 7 Tage) ───────────────────
    const geburtstage_woche = await safeCount(
      `SELECT COUNT(*) AS c FROM mitglieder
       WHERE aktiv = 1 AND geburtsdatum IS NOT NULL
         AND MOD(DAYOFYEAR(DATE(CONCAT(YEAR(CURDATE()), '-', MONTH(geburtsdatum), '-', DAY(geburtsdatum))))
                 - DAYOFYEAR(CURDATE()) + 366, 366) < 7`
    );
    items.push({ key: 'geburtstage_woche', label: 'Geburtstage (7 Tage)', value: geburtstage_woche, severity: 'info' });

    // ── Neue Verträge (nicht zur Kenntnis genommen) ────────────────
    const neue_vertraege = await safeCount(
      `SELECT COUNT(*) AS c FROM vertraege v
       JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
       WHERE v.admin_acknowledged_at IS NULL`
    );
    items.push({ key: 'neue_vertraege', label: 'Neue Verträge', value: neue_vertraege, severity: sev(neue_vertraege, { warnAbove: 0 }) });

    // ── Ablaufende Verträge (nächste 30 Tage) ──────────────────────
    const ablaufende_vertraege = await safeCount(
      `SELECT COUNT(*) AS c FROM vertraege v
       JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
       WHERE v.status = 'aktiv' AND v.vertragsende IS NOT NULL
         AND v.vertragsende BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
    );
    items.push({ key: 'ablaufende_vertraege', label: 'Verträge laufen aus (30T)', value: ablaufende_vertraege, severity: sev(ablaufende_vertraege, { warnAbove: 0 }) });

    // ── Offene Mahnungen / überfällige Rechnungen ──────────────────
    const offene_mahnungen = await safeCount(
      `SELECT COUNT(*) AS c FROM rechnungen r
       JOIN mitglieder m ON m.mitglied_id = r.mitglied_id
       WHERE r.status = 'ueberfaellig'
          OR (r.status = 'offen' AND r.faelligkeitsdatum < CURDATE())`
    );
    items.push({ key: 'offene_mahnungen', label: 'Offene Mahnungen', value: offene_mahnungen, severity: sev(offene_mahnungen, { warnAbove: 0, alertAbove: 9 }) });

    // ── Anstehende Lastschriften (nächste 7 Tage) ──────────────────
    const anstehende_lastschriften = await safeCount(
      `SELECT COUNT(*) AS c FROM lastschrift_zeitplaene
       WHERE aktiv = 1
         AND ausfuehrungstag BETWEEN DAY(CURDATE()) AND DAY(DATE_ADD(CURDATE(), INTERVAL 7 DAY))`
    );
    items.push({ key: 'anstehende_lastschriften', label: 'Lastschriften (7 Tage)', value: anstehende_lastschriften, severity: 'info' });

    // ── Fehlgeschlagene Lastschriften (zuletzt failed, nicht ersetzt) ──
    const fehlgeschlagene_lastschriften = await safeCount(
      `SELECT COUNT(DISTINCT slt.mitglied_id, slb.monat, slb.jahr) AS c
       FROM stripe_lastschrift_transaktion slt
       JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
       WHERE slt.status = 'failed'
         AND slt.id = (
           SELECT slt2.id FROM stripe_lastschrift_transaktion slt2
           JOIN stripe_lastschrift_batch slb2 ON slt2.batch_id = slb2.batch_id
           WHERE slt2.mitglied_id = slt.mitglied_id AND slt2.status = 'failed'
             AND slb2.monat = slb.monat AND slb2.jahr = slb.jahr
           ORDER BY slt2.created_at DESC LIMIT 1)
         AND NOT EXISTS (
           SELECT 1 FROM stripe_lastschrift_transaktion slt3
           JOIN stripe_lastschrift_batch slb3 ON slt3.batch_id = slb3.batch_id
           WHERE slt3.mitglied_id = slt.mitglied_id
             AND slt3.status IN ('succeeded','processing')
             AND slb3.monat = slb.monat AND slb3.jahr = slb.jahr)`
    );
    items.push({ key: 'fehlgeschlagene_lastschriften', label: 'Fehlgeschl. Lastschriften', value: fehlgeschlagene_lastschriften, severity: sev(fehlgeschlagene_lastschriften, { alertAbove: 0 }) });

    res.json({
      app:          'dojo',
      label:        'Dojosoftware',
      icon:         '🥋',
      generated_at: new Date().toISOString(),
      items,
    });
  } catch (error) {
    logger.error('Cockpit-Summary Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
