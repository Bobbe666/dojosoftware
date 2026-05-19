const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId, isSuperAdmin } = require('../middleware/tenantSecurity');
const logger = require('../utils/logger');

const pool = db.promise();

// ── Hilfsfunktion: Paket mit Positionen laden ────────────────────────
async function loadPaketMitPositionen(paketId, dojoId) {
  const [[paket]] = await pool.query(
    `SELECT sp.*, s.name AS stil_name
     FROM starterpakete sp
     LEFT JOIN stile s ON sp.stil_id = s.stil_id
     WHERE sp.paket_id = ? AND sp.dojo_id = ?`,
    [paketId, dojoId]
  );
  if (!paket) return null;

  const [positionen] = await pool.query(
    `SELECT spp.*, a.name AS artikel_name, a.bild_url
     FROM starterpaket_positionen spp
     LEFT JOIN artikel a ON spp.artikel_id = a.artikel_id
     WHERE spp.paket_id = ?
     ORDER BY spp.position ASC, spp.id ASC`,
    [paketId]
  );

  const parseJ = v => { try { return v ? (typeof v === 'string' ? JSON.parse(v) : v) : null; } catch { return null; } };
  const positionenParsed = positionen.map(p => ({
    ...p,
    varianten_options: parseJ(p.varianten_options),
  }));

  const gesamtpreis = positionenParsed.reduce((s, p) => s + p.einzelpreis_cent * p.menge, 0);
  const rabatt = paket.rabatt_prozent > 0
    ? Math.round(gesamtpreis * paket.rabatt_prozent / 100)
    : 0;

  return { ...paket, positionen: positionenParsed, gesamtpreis_cent: gesamtpreis, rabatt_cent: rabatt, endpreis_cent: gesamtpreis - rabatt };
}

// ── GET /api/starterpakete/artikel-options ── Artikel für Dropdown ──
router.get('/artikel-options', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT artikel_id, name, verkaufspreis_cent,
              hat_varianten, hat_preiskategorien,
              preis_kids_cent, preis_erwachsene_cent,
              varianten_groessen, groessen_kids, groessen_erwachsene
       FROM artikel WHERE aktiv = 1 ORDER BY name ASC`
    );
    const parseJ = v => { try { return v ? (typeof v === 'string' ? JSON.parse(v) : v) : []; } catch { return []; } };
    const artikel = rows.map(a => ({
      ...a,
      hat_varianten: !!a.hat_varianten,
      hat_preiskategorien: !!a.hat_preiskategorien,
      varianten_groessen: parseJ(a.varianten_groessen),
      groessen_kids: parseJ(a.groessen_kids) || ['100','110','120','130','140','150'],
      groessen_erwachsene: parseJ(a.groessen_erwachsene) || ['XS','S','M','L','XL','XXL'],
    }));
    res.json({ success: true, artikel });
  } catch (err) {
    logger.error('Artikel-Options Fehler:', err);
    res.status(500).json({ error: 'Fehler' });
  }
});

// ── POST /api/starterpakete/artikel-quick ── Schnell-Artikel anlegen ─
router.post('/artikel-quick', async (req, res) => {
  try {
    const { name, verkaufspreis_cent } = req.body;
    if (!name || verkaufspreis_cent == null) {
      return res.status(400).json({ error: 'name und verkaufspreis_cent sind Pflichtfelder' });
    }

    const [[kat]] = await pool.query(
      'SELECT id FROM artikelgruppen WHERE aktiv = 1 ORDER BY id ASC LIMIT 1'
    );
    if (!kat) return res.status(400).json({ error: 'Keine Artikelkategorie verfügbar' });

    const artikel_nummer = `ART-SP-${Date.now()}`;
    const preis = Math.round(parseFloat(String(verkaufspreis_cent)));

    const [result] = await pool.query(
      `INSERT INTO artikel (kategorie_id, name, verkaufspreis_cent, mwst_prozent, lagerbestand, artikel_nummer, aktiv, sichtbar_kasse, farbe_hex, dojo_id)
       VALUES (?, ?, ?, 19, 0, ?, 1, 0, '#FFFFFF', ?)`,
      [kat.id, name, preis, artikel_nummer, req.user?.dojo_id || null]
    );

    logger.info('Artikel Quick-Create', { name, preis, artikel_id: result.insertId });
    res.json({ success: true, artikel: { artikel_id: result.insertId, name, verkaufspreis_cent: preis } });
  } catch (err) {
    logger.error('Artikel Quick-Create Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

// ── GET /api/starterpakete ── alle Pakete des Dojos ─────────────────
router.get('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });

    const [pakete] = await pool.query(
      `SELECT sp.*, s.name AS stil_name
       FROM starterpakete sp
       LEFT JOIN stile s ON sp.stil_id = s.stil_id
       WHERE sp.dojo_id = ?
       ORDER BY s.name ASC, sp.name ASC`,
      [dojoId]
    );

    const result = await Promise.all(
      pakete.map(p => loadPaketMitPositionen(p.paket_id, dojoId))
    );

    res.json({ success: true, pakete: result.filter(Boolean) });
  } catch (err) {
    logger.error('Starterpakete laden Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// ── GET /api/starterpakete/for-stil/:stilId ── Paket für Stil (Member) ─
router.get('/for-stil/:stilId', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });

    const stilId = parseInt(req.params.stilId, 10);
    if (isNaN(stilId)) return res.status(400).json({ error: 'Ungültige stil_id' });

    const [[paket]] = await pool.query(
      `SELECT paket_id FROM starterpakete
       WHERE dojo_id = ? AND stil_id = ? AND aktiv = 1
       LIMIT 1`,
      [dojoId, stilId]
    );

    if (!paket) return res.json({ success: true, paket: null });

    const full = await loadPaketMitPositionen(paket.paket_id, dojoId);
    res.json({ success: true, paket: full });
  } catch (err) {
    logger.error('Starterpaket für Stil Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// ── POST /api/starterpakete ── Paket anlegen ────────────────────────
router.post('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });

    const { stil_id, name, beschreibung, hinweis, rabatt_prozent = 0, aktiv = 1 } = req.body;
    if (!stil_id || !name) return res.status(400).json({ error: 'stil_id und name sind Pflichtfelder' });

    const [result] = await pool.query(
      `INSERT INTO starterpakete (dojo_id, stil_id, name, beschreibung, hinweis, rabatt_prozent, aktiv)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, stil_id, name, beschreibung || null, hinweis || null, rabatt_prozent, aktiv ? 1 : 0]
    );

    const paket = await loadPaketMitPositionen(result.insertId, dojoId);
    res.json({ success: true, paket });
  } catch (err) {
    logger.error('Starterpaket erstellen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

// ── PUT /api/starterpakete/:id ── Paket bearbeiten ──────────────────
router.put('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });

    const paketId = parseInt(req.params.id, 10);
    if (isNaN(paketId)) return res.status(400).json({ error: 'Ungültige paket_id' });

    const { stil_id, name, beschreibung, hinweis, rabatt_prozent, aktiv } = req.body;
    if (!stil_id || !name) return res.status(400).json({ error: 'stil_id und name sind Pflichtfelder' });

    await pool.query(
      `UPDATE starterpakete
       SET stil_id=?, name=?, beschreibung=?, hinweis=?, rabatt_prozent=?, aktiv=?
       WHERE paket_id=? AND dojo_id=?`,
      [stil_id, name, beschreibung || null, hinweis || null, rabatt_prozent ?? 0, aktiv ? 1 : 0, paketId, dojoId]
    );

    const paket = await loadPaketMitPositionen(paketId, dojoId);
    res.json({ success: true, paket });
  } catch (err) {
    logger.error('Starterpaket bearbeiten Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// ── DELETE /api/starterpakete/:id ── Paket löschen ──────────────────
router.delete('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });

    const paketId = parseInt(req.params.id, 10);
    if (isNaN(paketId)) return res.status(400).json({ error: 'Ungültige paket_id' });

    await pool.query(
      'DELETE FROM starterpaket_positionen WHERE paket_id = (SELECT paket_id FROM starterpakete WHERE paket_id = ? AND dojo_id = ? LIMIT 1)',
      [paketId, dojoId]
    );
    const [r] = await pool.query(
      'DELETE FROM starterpakete WHERE paket_id = ? AND dojo_id = ?',
      [paketId, dojoId]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Paket nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('Starterpaket löschen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ── POST /api/starterpakete/:id/positionen ── Position hinzufügen ───
router.post('/:id/positionen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });

    const paketId = parseInt(req.params.id, 10);
    if (isNaN(paketId)) return res.status(400).json({ error: 'Ungültige paket_id' });

    // Paket gehört zu diesem Dojo?
    const [[paket]] = await pool.query(
      'SELECT paket_id FROM starterpakete WHERE paket_id = ? AND dojo_id = ?',
      [paketId, dojoId]
    );
    if (!paket) return res.status(404).json({ error: 'Paket nicht gefunden' });

    const { artikel_id, bezeichnung, menge = 1, einzelpreis_cent, pflicht = 1, position = 0,
            rabatt_prozent = 0, originalPreis_cent = null, hat_varianten = 0, varianten_options = null } = req.body;
    if (!bezeichnung || einzelpreis_cent == null) {
      return res.status(400).json({ error: 'bezeichnung und einzelpreis_cent sind Pflichtfelder' });
    }

    const variantenJson = varianten_options ? (typeof varianten_options === 'string' ? varianten_options : JSON.stringify(varianten_options)) : null;

    const [result] = await pool.query(
      `INSERT INTO starterpaket_positionen
         (paket_id, artikel_id, bezeichnung, menge, einzelpreis_cent, pflicht, position,
          rabatt_prozent, originalpreis_cent, hat_varianten, varianten_options)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paketId, artikel_id || null, bezeichnung, menge, einzelpreis_cent, pflicht ? 1 : 0, position,
       parseFloat(rabatt_prozent) || 0, originalPreis_cent || null, hat_varianten ? 1 : 0, variantenJson]
    );

    const full = await loadPaketMitPositionen(paketId, dojoId);
    res.json({ success: true, paket: full });
  } catch (err) {
    logger.error('Starterpaket Position hinzufügen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Hinzufügen' });
  }
});

// ── PUT /api/starterpakete/:id/positionen/:posId ── Position bearbeiten
router.put('/:id/positionen/:posId', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });

    const paketId = parseInt(req.params.id,  10);
    const posId   = parseInt(req.params.posId, 10);
    if (isNaN(paketId) || isNaN(posId)) return res.status(400).json({ error: 'Ungültige IDs' });

    const [[check]] = await pool.query(
      `SELECT spp.id FROM starterpaket_positionen spp
       JOIN starterpakete sp ON spp.paket_id = sp.paket_id
       WHERE spp.id = ? AND sp.dojo_id = ?`,
      [posId, dojoId]
    );
    if (!check) return res.status(404).json({ error: 'Position nicht gefunden' });

    const { bezeichnung, menge = 1, einzelpreis_cent, pflicht = 1, position = 0,
            rabatt_prozent = 0, originalPreis_cent = null, hat_varianten = 0,
            varianten_options = null } = req.body;
    if (!bezeichnung || einzelpreis_cent == null) {
      return res.status(400).json({ error: 'bezeichnung und einzelpreis_cent sind Pflichtfelder' });
    }

    const variantenJson = varianten_options
      ? (typeof varianten_options === 'string' ? varianten_options : JSON.stringify(varianten_options))
      : null;

    await pool.query(
      `UPDATE starterpaket_positionen
       SET bezeichnung=?, menge=?, einzelpreis_cent=?, pflicht=?, position=?,
           rabatt_prozent=?, originalpreis_cent=?, hat_varianten=?, varianten_options=?
       WHERE id=?`,
      [bezeichnung, menge, einzelpreis_cent, pflicht ? 1 : 0, position,
       parseFloat(rabatt_prozent) || 0, originalPreis_cent || null,
       hat_varianten ? 1 : 0, variantenJson, posId]
    );

    const full = await loadPaketMitPositionen(paketId, dojoId);
    res.json({ success: true, paket: full });
  } catch (err) {
    logger.error('Starterpaket Position bearbeiten Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Bearbeiten' });
  }
});

// ── DELETE /api/starterpakete/:id/positionen/:posId ── Position entfernen
router.delete('/:id/positionen/:posId', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });

    const paketId = parseInt(req.params.id, 10);
    const posId   = parseInt(req.params.posId, 10);
    if (isNaN(paketId) || isNaN(posId)) return res.status(400).json({ error: 'Ungültige IDs' });

    // Tenant-Check via JOIN
    await pool.query(
      `DELETE spp FROM starterpaket_positionen spp
       JOIN starterpakete sp ON spp.paket_id = sp.paket_id
       WHERE spp.id = ? AND sp.dojo_id = ?`,
      [posId, dojoId]
    );

    const full = await loadPaketMitPositionen(paketId, dojoId);
    res.json({ success: true, paket: full });
  } catch (err) {
    logger.error('Starterpaket Position löschen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ── POST /api/starterpakete/:id/bestellen ── Mitglied bestellt Paket ─
router.post('/:id/bestellen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });

    const paketId = parseInt(req.params.id, 10);
    const mitgliedId = parseInt(req.body.mitglied_id, 10);
    if (isNaN(paketId) || isNaN(mitgliedId)) return res.status(400).json({ error: 'Ungültige IDs' });

    const paket = await loadPaketMitPositionen(paketId, dojoId);
    if (!paket) return res.status(404).json({ error: 'Paket nicht gefunden' });
    if (!paket.aktiv) return res.status(400).json({ error: 'Paket ist inaktiv' });

    const { varianten_json } = req.body;
    const variantenStr = varianten_json ? (typeof varianten_json === 'string' ? varianten_json : JSON.stringify(varianten_json)) : null;

    await pool.query(
      `INSERT INTO starterpaket_bestellungen
         (dojo_id, paket_id, mitglied_id, gesamtpreis_cent, status, varianten_json, erstellt_am)
       VALUES (?, ?, ?, ?, 'offen', ?, CURRENT_TIMESTAMP)`,
      [dojoId, paketId, mitgliedId, paket.endpreis_cent, variantenStr]
    );

    logger.info('Starterpaket Bestellung', { dojoId, paketId, mitgliedId, betrag: paket.endpreis_cent });
    res.json({ success: true, message: 'Bestellung erfolgreich übermittelt' });
  } catch (err) {
    logger.error('Starterpaket bestellen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Bestellen' });
  }
});

// ── GET /api/starterpakete/bestellungen ── Alle Bestellungen (Admin) ─
router.get('/bestellungen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId && !isSuperAdmin(req)) return res.status(400).json({ error: 'dojo_id fehlt' });

    const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let where = dojoId ? 'WHERE sb.dojo_id = ?' : '';
    const params = dojoId ? [dojoId] : [];
    if (status) { where += (where ? ' AND' : 'WHERE') + ' sb.status = ?'; params.push(status); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM starterpaket_bestellungen sb ${where}`,
      params
    );

    const [bestellungen] = await pool.query(
      `SELECT sb.id, sb.paket_id, sb.mitglied_id, sb.gesamtpreis_cent, sb.status,
              sb.erstellt_am, sb.varianten_json,
              sp.name AS paket_name, s.name AS stil_name,
              CONCAT(m.vorname, ' ', m.nachname) AS mitglied_name, m.email AS mitglied_email
       FROM starterpaket_bestellungen sb
       JOIN starterpakete sp ON sb.paket_id = sp.paket_id
       LEFT JOIN stile s ON sp.stil_id = s.stil_id
       LEFT JOIN mitglieder m ON sb.mitglied_id = m.mitglied_id
       ${where}
       ORDER BY sb.erstellt_am DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, bestellungen, total, page, limit });
  } catch (err) {
    logger.error('Starterpaket Bestellungen laden Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// ── PATCH /api/starterpakete/bestellungen/:id/status ── Status setzen ─
router.patch('/bestellungen/:id/status', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId && !isSuperAdmin(req)) return res.status(400).json({ error: 'dojo_id fehlt' });

    const bestellId = parseInt(req.params.id, 10);
    if (isNaN(bestellId)) return res.status(400).json({ error: 'Ungültige ID' });

    const { status } = req.body;
    const erlaubt = ['offen', 'bezahlt', 'storniert'];
    if (!erlaubt.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });

    const [r] = await pool.query(
      dojoId
        ? 'UPDATE starterpaket_bestellungen SET status = ? WHERE id = ? AND dojo_id = ?'
        : 'UPDATE starterpaket_bestellungen SET status = ? WHERE id = ?',
      dojoId ? [status, bestellId, dojoId] : [status, bestellId]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('Starterpaket Status Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

module.exports = router;
