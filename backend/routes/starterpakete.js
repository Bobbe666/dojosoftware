const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
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

  const gesamtpreis = positionen.reduce((s, p) => s + p.einzelpreis_cent * p.menge, 0);
  const rabatt = paket.rabatt_prozent > 0
    ? Math.round(gesamtpreis * paket.rabatt_prozent / 100)
    : 0;

  return { ...paket, positionen, gesamtpreis_cent: gesamtpreis, rabatt_cent: rabatt, endpreis_cent: gesamtpreis - rabatt };
}

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

    const { artikel_id, bezeichnung, menge = 1, einzelpreis_cent, pflicht = 1, position = 0 } = req.body;
    if (!bezeichnung || einzelpreis_cent == null) {
      return res.status(400).json({ error: 'bezeichnung und einzelpreis_cent sind Pflichtfelder' });
    }

    const [result] = await pool.query(
      `INSERT INTO starterpaket_positionen (paket_id, artikel_id, bezeichnung, menge, einzelpreis_cent, pflicht, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [paketId, artikel_id || null, bezeichnung, menge, einzelpreis_cent, pflicht ? 1 : 0, position]
    );

    const full = await loadPaketMitPositionen(paketId, dojoId);
    res.json({ success: true, paket: full });
  } catch (err) {
    logger.error('Starterpaket Position hinzufügen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Hinzufügen' });
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

    // Bestellung in Tabelle schreiben (starterpaket_bestellungen)
    await pool.query(
      `INSERT INTO starterpaket_bestellungen
         (dojo_id, paket_id, mitglied_id, gesamtpreis_cent, status, erstellt_am)
       VALUES (?, ?, ?, ?, 'offen', CURRENT_TIMESTAMP)`,
      [dojoId, paketId, mitgliedId, paket.endpreis_cent]
    ).catch(async (err) => {
      // Tabelle existiert noch nicht → anlegen und nochmal versuchen
      if (err.code === 'ER_NO_SUCH_TABLE') {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS starterpaket_bestellungen (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            dojo_id          INT NOT NULL,
            paket_id         INT NOT NULL,
            mitglied_id      INT NOT NULL,
            gesamtpreis_cent INT NOT NULL DEFAULT 0,
            status           ENUM('offen','bezahlt','storniert') NOT NULL DEFAULT 'offen',
            erstellt_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_dojo    (dojo_id),
            INDEX idx_mitglied (mitglied_id),
            INDEX idx_status  (status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await pool.query(
          `INSERT INTO starterpaket_bestellungen (dojo_id, paket_id, mitglied_id, gesamtpreis_cent, status)
           VALUES (?, ?, ?, ?, 'offen')`,
          [dojoId, paketId, mitgliedId, paket.endpreis_cent]
        );
      } else {
        throw err;
      }
    });

    logger.info('Starterpaket Bestellung', { dojoId, paketId, mitgliedId, betrag: paket.endpreis_cent });
    res.json({ success: true, message: 'Bestellung erfolgreich übermittelt' });
  } catch (err) {
    logger.error('Starterpaket bestellen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Bestellen' });
  }
});

module.exports = router;
