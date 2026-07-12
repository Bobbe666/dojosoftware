/**
 * AG-Abrechnung – API
 * Konfiguration (Schule/AG), Vorschau der Unterrichtstage, Entwürfe bestätigen → Rechnung
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const pool = db.promise();
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const ag = require('../services/agAbrechnung');

// dojo-Filter: Super-Admin (null) sieht alles, sonst nur eigenes Dojo
function dojoFilter(req) {
  const id = getSecureDojoId(req);
  return id ? { sql: ' WHERE dojo_id = ?', params: [id] } : { sql: '', params: [] };
}

// ── Konfigurationen ──────────────────────────────────────────────────────────
router.get('/configs', authenticateToken, async (req, res) => {
  try {
    const f = dojoFilter(req);
    const [rows] = await pool.query(
      `SELECT c.*, CONCAT(COALESCE(m.vorname,''),' ',COALESCE(m.nachname,'')) AS empfaenger_name
       FROM ag_abrechnung_config c LEFT JOIN mitglieder m ON c.mitglied_id = m.mitglied_id${f.sql} ORDER BY c.id DESC`, f.params);
    res.json({ success: true, configs: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/configs', authenticateToken, async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req) || req.body.dojo_id;
    if (!dojoId) return res.status(400).json({ success: false, error: 'dojo_id fehlt' });
    const b = req.body;
    const [r] = await pool.query(
      `INSERT INTO ag_abrechnung_config
        (dojo_id, mitglied_id, bezeichnung, artikelnummer, wochentag, stunden_pro_tag, preis_pro_stunde, mwst_satz, bundesland, empfaenger_email, auto_versand, aktiv, gueltig_ab, gueltig_bis)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [dojoId, b.mitglied_id || null, b.bezeichnung || 'Karatestunden AG', b.artikelnummer || null,
       b.wochentag || 2, b.stunden_pro_tag || 3, b.preis_pro_stunde || 30.67, b.mwst_satz ?? 19,
       b.bundesland || 'BY', b.empfaenger_email || null, b.auto_versand ? 1 : 0, b.aktiv === false ? 0 : 1,
       b.gueltig_ab || null, b.gueltig_bis || null]);
    res.json({ success: true, id: r.insertId });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/configs/:id', authenticateToken, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const b = req.body;
    const felder = ['mitglied_id', 'bezeichnung', 'artikelnummer', 'wochentag', 'stunden_pro_tag', 'preis_pro_stunde', 'mwst_satz', 'bundesland', 'empfaenger_email', 'auto_versand', 'aktiv', 'gueltig_ab', 'gueltig_bis'];
    const sets = [], params = [];
    for (const f of felder) if (b[f] !== undefined) { sets.push(`${f} = ?`); params.push(typeof b[f] === 'boolean' ? (b[f] ? 1 : 0) : b[f]); }
    if (!sets.length) return res.json({ success: true });
    params.push(req.params.id);
    // 🔒 Tenant-Scope: nur eigene Config (Super-Admin = null → kein Filter)
    let dojoClause = '';
    if (secureDojoId) { dojoClause = ' AND dojo_id = ?'; params.push(secureDojoId); }
    const [r] = await pool.query(`UPDATE ag_abrechnung_config SET ${sets.join(', ')} WHERE id = ?${dojoClause}`, params);
    if (r.affectedRows === 0) return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/configs/:id', authenticateToken, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    // 🔒 Tenant-Scope: nur eigene Config löschen
    const [r] = await pool.query(
      `DELETE FROM ag_abrechnung_config WHERE id = ?${secureDojoId ? ' AND dojo_id = ?' : ''}`,
      secureDojoId ? [req.params.id, secureDojoId] : [req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    res.json({ success: true });
  }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Vorschau der Unterrichtstage (ohne Speichern) ────────────────────────────
router.get('/vorschau', authenticateToken, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { config_id, jahr, monat } = req.query;
    const [[config]] = await pool.query('SELECT * FROM ag_abrechnung_config WHERE id = ?', [config_id]);
    if (!config) return res.status(404).json({ success: false, error: 'Konfiguration nicht gefunden' });
    // 🔒 Tenant-Check: Config muss zum eigenen Dojo gehören
    if (secureDojoId && Number(config.dojo_id) !== Number(secureDojoId)) {
      return res.status(404).json({ success: false, error: 'Konfiguration nicht gefunden' });
    }
    const tage = await ag.berechneUnterrichtstage(pool, config, parseInt(jahr), parseInt(monat));
    res.json({ success: true, tage, anzahl: tage.length, betrag_netto: +(tage.length * config.stunden_pro_tag * config.preis_pro_stunde).toFixed(2) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Läufe / Entwürfe ─────────────────────────────────────────────────────────
router.get('/laeufe', authenticateToken, async (req, res) => {
  try {
    const status = req.query.status;
    const id = getSecureDojoId(req);
    let sql = `SELECT l.*, c.bezeichnung, c.dojo_id, CONCAT(COALESCE(m.vorname,''),' ',COALESCE(m.nachname,'')) AS empfaenger_name
               FROM ag_abrechnung_lauf l JOIN ag_abrechnung_config c ON l.config_id = c.id
               LEFT JOIN mitglieder m ON c.mitglied_id = m.mitglied_id WHERE 1=1`;
    const params = [];
    if (id) { sql += ' AND c.dojo_id = ?'; params.push(id); }
    if (status) { sql += ' AND l.status = ?'; params.push(status); }
    sql += ' ORDER BY l.jahr DESC, l.monat DESC, l.id DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, laeufe: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Entwurf für config+jahr+monat anlegen (manuell)
router.post('/entwurf', authenticateToken, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { config_id, jahr, monat } = req.body;
    const [[config]] = await pool.query('SELECT * FROM ag_abrechnung_config WHERE id = ?', [config_id]);
    if (!config) return res.status(404).json({ success: false, error: 'Konfiguration nicht gefunden' });
    // 🔒 Tenant-Check: Config muss zum eigenen Dojo gehören
    if (secureDojoId && Number(config.dojo_id) !== Number(secureDojoId)) {
      return res.status(404).json({ success: false, error: 'Konfiguration nicht gefunden' });
    }
    const lauf = await ag.erstelleEntwurf(pool, config, parseInt(jahr), parseInt(monat));
    res.json({ success: true, lauf });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Tage eines Entwurfs anpassen (Variante B: Häkchenliste)
router.put('/lauf/:id/tage', authenticateToken, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const tage = Array.isArray(req.body.tage) ? req.body.tage : [];
    // 🔒 Tenant-Scope: nur Läufe eigener Configs (Super-Admin = null → kein Filter)
    const dojoClause = secureDojoId
      ? ' AND config_id IN (SELECT id FROM ag_abrechnung_config WHERE dojo_id = ?)'
      : '';
    const params = secureDojoId
      ? [JSON.stringify(tage), tage.length, req.params.id, secureDojoId]
      : [JSON.stringify(tage), tage.length, req.params.id];
    const [r] = await pool.query(
      `UPDATE ag_abrechnung_lauf SET tage = ?, anzahl_tage = ? WHERE id = ? AND status = 'entwurf'${dojoClause}`,
      params);
    if (r.affectedRows === 0) return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    res.json({ success: true, anzahl: tage.length });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Entwurf bestätigen → Rechnung erzeugen
router.post('/lauf/:id/bestaetigen', authenticateToken, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    // 🔒 Tenant-Check: Lauf muss zu einer Config des eigenen Dojos gehören (verhindert Fremd-Rechnung)
    if (secureDojoId) {
      const [[lauf]] = await pool.query(
        `SELECT c.dojo_id FROM ag_abrechnung_lauf l JOIN ag_abrechnung_config c ON l.config_id = c.id WHERE l.id = ?`,
        [parseInt(req.params.id)]
      );
      if (!lauf || Number(lauf.dojo_id) !== Number(secureDojoId)) {
        return res.status(404).json({ success: false, error: 'Nicht gefunden' });
      }
    }
    const r = await ag.erzeugeRechnung(pool, parseInt(req.params.id));
    res.json({ success: true, ...r });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
