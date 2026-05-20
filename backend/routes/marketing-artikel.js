const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

// ── GET /api/marketing-artikel ── Admin: Alle Artikel des Dojos
router.get('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    logger.warn('[DEBUG marketing-artikel GET]', {
      user_keys: req.user ? Object.keys(req.user) : 'NO_USER',
      user_raw: req.user ? JSON.stringify(req.user).substring(0, 200) : 'null',
      query_dojo_id: req.query?.dojo_id,
      resolved_dojoId: dojoId
    });
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
    const [rows] = await pool.query(
      `SELECT * FROM marketing_artikel WHERE dojo_id = ? ORDER BY sort_order ASC, erstellt_am DESC`,
      [dojoId]
    );
    res.json({ success: true, artikel: rows });
  } catch (err) {
    logger.error('marketing-artikel GET Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/marketing-artikel ── Admin: Artikel anlegen
router.post('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
    const { name, beschreibung, preis_cent, bild_url, typ, vorverkauf_bis, lieferdatum, max_menge, sort_order } = req.body;
    if (!name || preis_cent == null) return res.status(400).json({ error: 'Name und Preis sind Pflichtfelder' });
    const [result] = await pool.query(
      `INSERT INTO marketing_artikel (dojo_id, name, beschreibung, preis_cent, bild_url, typ, vorverkauf_bis, lieferdatum, max_menge, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, name, beschreibung || null, parseInt(preis_cent), bild_url || null,
       typ || 'bestellung', vorverkauf_bis || null, lieferdatum || null,
       max_menge ? parseInt(max_menge) : null, sort_order || 0]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    logger.error('marketing-artikel POST Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/marketing-artikel/:id ── Admin: Artikel bearbeiten
router.put('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
    const { name, beschreibung, preis_cent, bild_url, typ, vorverkauf_bis, lieferdatum, max_menge, aktiv, sort_order } = req.body;
    await pool.query(
      `UPDATE marketing_artikel SET name=?, beschreibung=?, preis_cent=?, bild_url=?, typ=?,
       vorverkauf_bis=?, lieferdatum=?, max_menge=?, aktiv=?, sort_order=?
       WHERE id=? AND dojo_id=?`,
      [name, beschreibung || null, parseInt(preis_cent), bild_url || null,
       typ || 'bestellung', vorverkauf_bis || null, lieferdatum || null,
       max_menge ? parseInt(max_menge) : null, aktiv != null ? aktiv : 1, sort_order || 0,
       req.params.id, dojoId]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error('marketing-artikel PUT Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/marketing-artikel/:id ── Admin: Artikel löschen
router.delete('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
    await pool.query(`DELETE FROM marketing_artikel WHERE id=? AND dojo_id=?`, [req.params.id, dojoId]);
    res.json({ success: true });
  } catch (err) {
    logger.error('marketing-artikel DELETE Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/marketing-artikel/member ── Member: Aktive Artikel für Bestellung
router.get('/member', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query(
      `SELECT id, name, beschreibung, preis_cent, bild_url, typ, vorverkauf_bis, lieferdatum, max_menge
       FROM marketing_artikel
       WHERE dojo_id = ? AND aktiv = 1
         AND (
           typ = 'bestellung'
           OR (typ = 'vorverkauf' AND (vorverkauf_bis IS NULL OR vorverkauf_bis >= ?))
           OR (typ = 'beides' AND (vorverkauf_bis IS NULL OR vorverkauf_bis >= ?))
         )
       ORDER BY sort_order ASC, erstellt_am DESC`,
      [dojoId, today, today]
    );
    res.json({ success: true, artikel: rows });
  } catch (err) {
    logger.error('marketing-artikel member GET Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/marketing-artikel/:id/bestellen ── Member: Artikel bestellen
router.post('/:id/bestellen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
    const artikelId = parseInt(req.params.id, 10);
    const mitgliedId = parseInt(req.body.mitglied_id, 10);
    const menge = parseInt(req.body.menge || 1, 10);
    const anmerkung = req.body.anmerkung || null;
    if (isNaN(artikelId) || isNaN(mitgliedId)) return res.status(400).json({ error: 'Ungültige IDs' });

    const [[artikel]] = await pool.query(
      `SELECT * FROM marketing_artikel WHERE id=? AND dojo_id=? AND aktiv=1`, [artikelId, dojoId]
    );
    if (!artikel) return res.status(404).json({ error: 'Artikel nicht gefunden' });

    // Max-Menge prüfen
    if (artikel.max_menge) {
      const [[{ bestellt }]] = await pool.query(
        `SELECT COALESCE(SUM(menge),0) AS bestellt FROM marketing_bestellungen
         WHERE artikel_id=? AND status NOT IN ('storniert')`, [artikelId]
      );
      if ((bestellt + menge) > artikel.max_menge) {
        return res.status(400).json({ error: `Maximale Bestellmenge erreicht (${artikel.max_menge} Stück)` });
      }
    }

    // Doppelbestellung prüfen
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM marketing_bestellungen
       WHERE artikel_id=? AND mitglied_id=? AND status NOT IN ('storniert')`, [artikelId, mitgliedId]
    );
    if (cnt > 0) return res.status(400).json({ error: 'Du hast diesen Artikel bereits bestellt' });

    await pool.query(
      `INSERT INTO marketing_bestellungen (dojo_id, artikel_id, mitglied_id, menge, preis_cent, status, anmerkung)
       VALUES (?, ?, ?, ?, ?, 'offen', ?)`,
      [dojoId, artikelId, mitgliedId, menge, artikel.preis_cent * menge, anmerkung]
    );

    logger.info('Marketing-Artikel Bestellung', { dojoId, artikelId, mitgliedId, menge, preis: artikel.preis_cent });
    res.json({ success: true, message: 'Bestellung erfolgreich übermittelt' });
  } catch (err) {
    logger.error('marketing-artikel bestellen Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/marketing-artikel/bestellungen ── Admin: Alle Bestellungen
router.get('/bestellungen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
    const [rows] = await pool.query(
      `SELECT mb.id, mb.menge, mb.preis_cent, mb.status, mb.anmerkung, mb.erstellt_am,
              mb.admin_acknowledged_at,
              ma.name AS artikel_name, ma.typ AS artikel_typ,
              m.vorname, m.nachname, m.email, m.mitglied_id
       FROM marketing_bestellungen mb
       JOIN marketing_artikel ma ON mb.artikel_id = ma.id
       JOIN mitglieder m ON mb.mitglied_id = m.mitglied_id
       WHERE mb.dojo_id = ?
       ORDER BY mb.erstellt_am DESC`,
      [dojoId]
    );
    res.json({ success: true, bestellungen: rows });
  } catch (err) {
    logger.error('marketing-artikel bestellungen GET Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/marketing-artikel/bestellungen/acknowledge ── Admin: Als gelesen markieren
router.post('/bestellungen/acknowledge', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
    const [result] = await pool.query(
      `UPDATE marketing_bestellungen SET admin_acknowledged_at = NOW()
       WHERE dojo_id = ? AND admin_acknowledged_at IS NULL`,
      [dojoId]
    );
    res.json({ success: true, count: result.affectedRows });
  } catch (err) {
    logger.error('marketing-artikel acknowledge Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/marketing-artikel/bestellungen/ungelesen ── Admin: Anzahl ungelesener Bestellungen
router.get('/bestellungen/ungelesen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.json({ count: 0 });
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM marketing_bestellungen
       WHERE dojo_id = ? AND admin_acknowledged_at IS NULL`,
      [dojoId]
    );
    res.json({ count: parseInt(cnt) });
  } catch (err) {
    res.json({ count: 0 });
  }
});

// ── PUT /api/marketing-artikel/bestellungen/:id/stornieren ── Admin: Bestellung stornieren
router.put('/bestellungen/:id/stornieren', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
    await pool.query(
      `UPDATE marketing_bestellungen SET status='storniert' WHERE id=? AND dojo_id=?`,
      [req.params.id, dojoId]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error('marketing-artikel stornieren Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/marketing-artikel/member/meine-bestellungen ── Member: eigene Bestellungen
router.get('/member/meine-bestellungen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const mitgliedId = parseInt(req.query.mitglied_id, 10);
    if (!dojoId || isNaN(mitgliedId)) return res.json({ bestellungen: [] });
    const [rows] = await pool.query(
      `SELECT mb.id, mb.menge, mb.preis_cent, mb.status, mb.erstellt_am,
              ma.name AS artikel_name, ma.lieferdatum
       FROM marketing_bestellungen mb
       JOIN marketing_artikel ma ON mb.artikel_id = ma.id
       WHERE mb.dojo_id=? AND mb.mitglied_id=?
       ORDER BY mb.erstellt_am DESC`,
      [dojoId, mitgliedId]
    );
    res.json({ bestellungen: rows });
  } catch (err) {
    res.json({ bestellungen: [] });
  }
});

module.exports = router;
