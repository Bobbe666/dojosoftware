/**
 * Verband-Urkunden Routes
 * Urkundenregister für TDA International
 * - Prüfungsurkunden, DAN-Urkunden, Trainer-Lizenzen, Kampfrichter-Lizenzen, etc.
 *
 * SICHERHEIT: Nur für TDA-Admins (dojo_id=2) oder SuperAdmins zugänglich!
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

// Promise-basierte Queries
const pool = db.promise ? db.promise() : null;
const queryAsync = pool
  ? (q, p = []) => pool.query(q, p).then(([rows]) => rows)
  : (q, p = []) => new Promise((res, rej) => db.query(q, p, (e, r) => e ? rej(e) : res(r)));

// ============================================================================
// SICHERHEITS-MIDDLEWARE: Nur TDA-Admins (dojo_id=2) oder SuperAdmins
// ============================================================================
const requireTDAAdmin = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: 'Nicht authentifiziert' });
  const isSuperAdmin = user.rolle === 'super_admin' || user.role === 'super_admin' ||
                       user.rolle === 'admin'       || user.role === 'admin';
  const isTDAAdmin   = user.dojo_id === 2 || user.dojo_id === '2';
  if (!isSuperAdmin && !isTDAAdmin) {
    return res.status(403).json({ success: false, message: 'Kein Zugriff' });
  }
  next();
};

// Format: YYYYMMDD-XXXXX (globale fortlaufende 5-stellige Nummer)

// ============================================================================
// GET /verband-urkunden/stats
// ============================================================================
router.get('/stats', authenticateToken, requireTDAAdmin, async (req, res) => {
  try {
    const rows = await queryAsync(`
      SELECT
        COUNT(*) AS gesamt,
        SUM(art IN ('pruefungsurkunde','kickboxen_schuelergrad','aikido_schuelergrad')) AS pruefungsurkunden,
        SUM(art = 'dan_urkunde')           AS dan_urkunden,
        SUM(art = 'ehren_dan')             AS ehren_dan,
        SUM(art = 'board_of_black_belts')  AS board_of_black_belts,
        SUM(art = 'hof_nominierung')       AS hof_nominierungen,
        SUM(art = 'trainer_lizenz')        AS trainer_lizenzen,
        SUM(art = 'kampfrichter_lizenz')   AS kampfrichter_lizenzen,
        SUM(art = 'meister_urkunde')       AS meister_urkunden,
        SUM(YEAR(ausstellungsdatum) = YEAR(CURDATE())) AS dieses_jahr
      FROM verband_urkunden
    `);
    res.json({ success: true, stats: rows[0] || {} });
  } catch (err) {
    logger.error('GET /verband-urkunden/stats:', err);
    res.status(500).json({ success: false, message: 'Serverfehler' });
  }
});

// ============================================================================
// GET /verband-urkunden/naechste-nummer
// Format: YYYYMMDD-XXXXX (globale 5-stellige Sequenz)
// Offen für alle authentifizierten User (wird beim Druck aus PruefungsVerwaltung aufgerufen)
// ============================================================================
router.get('/naechste-nummer', authenticateToken, async (req, res) => {
  try {
    const art = req.query.art || '';

    // ── HoF-Nominierung: eigenes Format HoFTDA{YYYY}-{NNN} ──────────────────
    if (art === 'hof_nominierung') {
      const jahr = new Date().getFullYear();
      const seqRows = await queryAsync(
        `SELECT aktuelle_nummer FROM verband_nummern_sequenz WHERE typ = 'hof_nominierung'`
      );
      const seqNr = seqRows[0]?.aktuelle_nummer || 405;
      const dbRows = await queryAsync(
        `SELECT MAX(CAST(SUBSTRING_INDEX(urkundennummer, '-', -1) AS UNSIGNED)) AS maxNr
         FROM verband_urkunden
         WHERE art = 'hof_nominierung' AND urkundennummer IS NOT NULL AND urkundennummer != ''`
      );
      const dbNr = dbRows[0]?.maxNr || 0;
      const nextNr = Math.max(seqNr, dbNr) + 1;
      const nummer = `HoFTDA${jahr}-${nextNr}`;
      return res.json({ success: true, nummer });
    }

    // ── Standard: YYYYMMDD-XXXXX ─────────────────────────────────────────────
    const seqRows = await queryAsync(
      `SELECT aktuelle_nummer FROM verband_nummern_sequenz WHERE typ = 'urkunden'`
    );
    const seqNr = seqRows[0]?.aktuelle_nummer || 0;

    const dbRows = await queryAsync(
      `SELECT MAX(CAST(SUBSTRING_INDEX(urkundennummer, '-', -1) AS UNSIGNED)) AS maxNr
       FROM verband_urkunden
       WHERE art != 'hof_nominierung' AND urkundennummer IS NOT NULL AND urkundennummer != ''`
    );
    const dbNr = dbRows[0]?.maxNr || 0;

    const nextNr = Math.max(seqNr, dbNr) + 1;
    const heute = new Date();
    const datePart = `${heute.getFullYear()}${String(heute.getMonth() + 1).padStart(2, '0')}${String(heute.getDate()).padStart(2, '0')}`;
    const nummer = `${datePart}-${String(nextNr).padStart(5, '0')}`;
    res.json({ success: true, nummer });
  } catch (err) {
    logger.error('GET /verband-urkunden/naechste-nummer:', err);
    res.status(500).json({ success: false, message: 'Serverfehler' });
  }
});

// ============================================================================
// GET /verband-urkunden — Liste mit Suche & Filter
// ============================================================================
router.get('/', authenticateToken, requireTDAAdmin, async (req, res) => {
  try {
    const { search, art, jahr, limit = 100, offset = 0 } = req.query;
    const where = [];
    const params = [];

    if (search) {
      where.push('(nachname LIKE ? OR vorname LIKE ? OR urkundennummer LIKE ? OR ort LIKE ? OR grad LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (art)  { where.push('art = ?');                        params.push(art); }
    if (jahr) { where.push('YEAR(ausstellungsdatum) = ?');    params.push(parseInt(jahr)); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const urkunden = await queryAsync(
      `SELECT * FROM verband_urkunden ${whereClause}
       ORDER BY ausstellungsdatum DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const countRows = await queryAsync(
      `SELECT COUNT(*) AS total FROM verband_urkunden ${whereClause}`,
      params
    );

    res.json({ success: true, urkunden, total: countRows[0]?.total || 0 });
  } catch (err) {
    logger.error('GET /verband-urkunden:', err);
    res.status(500).json({ success: false, message: 'Serverfehler' });
  }
});

// ============================================================================
// GET /verband-urkunden/:id
// ============================================================================
router.get('/:id', authenticateToken, requireTDAAdmin, async (req, res) => {
  try {
    const rows = await queryAsync('SELECT * FROM verband_urkunden WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Nicht gefunden' });
    res.json({ success: true, urkunde: rows[0] });
  } catch (err) {
    logger.error('GET /verband-urkunden/:id:', err);
    res.status(500).json({ success: false, message: 'Serverfehler' });
  }
});

// ============================================================================
// POST /verband-urkunden — Neue Urkunde anlegen
// Offen für alle authentifizierten User (Auto-Save aus PruefungsVerwaltung)
// ============================================================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      urkundennummer, art, vorname, nachname, geburtsdatum,
      strasse, plz, ort, land, email, telefon,
      grad, disziplin, ausstellungsdatum, ausgestellt_von, pruefer,
      dojo_schule, notizen, mitglied_id, dojo_id
    } = req.body;

    if (!vorname || !nachname) {
      return res.status(400).json({ success: false, message: 'Vorname und Nachname sind Pflichtfelder' });
    }
    if (!art) {
      return res.status(400).json({ success: false, message: 'Art der Urkunde ist ein Pflichtfeld' });
    }
    if (!ausstellungsdatum) {
      return res.status(400).json({ success: false, message: 'Ausstellungsdatum ist ein Pflichtfeld' });
    }

    // pruefer: Array von bis zu 5 Namen, leere Strings rausfiltern
    const prueферClean = Array.isArray(pruefer)
      ? pruefer.map(p => (p || '').trim()).filter(Boolean).slice(0, 5)
      : [];
    const prueферJson = prueферClean.length ? JSON.stringify(prueферClean) : null;

    const result = await queryAsync(
      `INSERT INTO verband_urkunden
         (urkundennummer, art, vorname, nachname, geburtsdatum,
          strasse, plz, ort, land, email, telefon,
          grad, disziplin, ausstellungsdatum, ausgestellt_von, pruefer,
          dojo_schule, notizen, erstellt_von_user_id, mitglied_id, dojo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        urkundennummer || null,
        art,
        vorname.trim(), nachname.trim(),
        geburtsdatum || null,
        strasse || null, plz || null, ort || null, land || 'Deutschland',
        email || null, telefon || null,
        grad || null, disziplin || null,
        ausstellungsdatum,
        ausgestellt_von || null,
        prueферJson,
        dojo_schule || null,
        notizen || null,
        req.user?.id || req.user?.admin_id || null,
        mitglied_id || null,
        dojo_id || null
      ]
    );

    // Sequenz-Tabelle aktualisieren
    if (urkundennummer) {
      const seqNr = parseInt(urkundennummer.split('-').pop(), 10);
      if (!isNaN(seqNr)) {
        const seqTyp = art === 'hof_nominierung' ? 'hof_nominierung' : 'urkunden';
        await queryAsync(
          `INSERT INTO verband_nummern_sequenz (typ, aktuelle_nummer) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE aktuelle_nummer = GREATEST(aktuelle_nummer, ?)`,
          [seqTyp, seqNr, seqNr]
        );
      }
    }

    // Rückschreibung: urkunde_nr in pruefungen-Tabelle setzen (wenn Mitglied verknüpft)
    if (mitglied_id && urkundennummer) {
      try {
        // Passende Prüfung suchen: selbes Mitglied, bestanden, passender Grad, neuestes Datum
        const pruefRows = await queryAsync(
          `SELECT p.pruefung_id
           FROM pruefungen p
           LEFT JOIN graduierungen g ON g.graduierung_id = p.graduierung_nachher_id
           WHERE p.mitglied_id = ? AND p.bestanden = 1
             AND (g.name = ? OR ? IS NULL)
             AND (p.urkunde_nr IS NULL OR p.urkunde_nr = '')
           ORDER BY p.pruefungsdatum DESC LIMIT 1`,
          [mitglied_id, grad || null, grad || null]
        );
        if (pruefRows.length) {
          await queryAsync(
            'UPDATE pruefungen SET urkunde_nr = ?, urkunde_ausgestellt = 1 WHERE pruefung_id = ?',
            [urkundennummer, pruefRows[0].pruefung_id]
          );
        }
      } catch (backwriteErr) {
        logger.warn('Rückschreibung urkunde_nr fehlgeschlagen', { error: backwriteErr.message });
      }
    }

    logger.success('Neue Urkunde angelegt', { id: result.insertId, art, nachname });
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Urkundennummer bereits vergeben' });
    }
    logger.error('POST /verband-urkunden:', err);
    res.status(500).json({ success: false, message: 'Serverfehler' });
  }
});

// ============================================================================
// PUT /verband-urkunden/:id — Urkunde bearbeiten
// ============================================================================
router.put('/:id', authenticateToken, requireTDAAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      urkundennummer, art, vorname, nachname, geburtsdatum,
      strasse, plz, ort, land, email, telefon,
      grad, disziplin, ausstellungsdatum, ausgestellt_von, pruefer,
      dojo_schule, notizen, mitglied_id, dojo_id
    } = req.body;

    const prueферClean = Array.isArray(pruefer)
      ? pruefer.map(p => (p || '').trim()).filter(Boolean).slice(0, 5)
      : [];
    const prueферJson = prueферClean.length ? JSON.stringify(prueферClean) : null;

    await queryAsync(
      `UPDATE verband_urkunden SET
         urkundennummer = ?, art = ?, vorname = ?, nachname = ?, geburtsdatum = ?,
         strasse = ?, plz = ?, ort = ?, land = ?, email = ?, telefon = ?,
         grad = ?, disziplin = ?, ausstellungsdatum = ?, ausgestellt_von = ?, pruefer = ?,
         dojo_schule = ?, notizen = ?, mitglied_id = ?, dojo_id = ?
       WHERE id = ?`,
      [
        urkundennummer || null,
        art,
        vorname?.trim(), nachname?.trim(),
        geburtsdatum || null,
        strasse || null, plz || null, ort || null, land || 'Deutschland',
        email || null, telefon || null,
        grad || null, disziplin || null,
        ausstellungsdatum,
        ausgestellt_von || null,
        prueферJson,
        dojo_schule || null,
        notizen || null,
        mitglied_id || null,
        dojo_id || null,
        id
      ]
    );

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Urkundennummer bereits vergeben' });
    }
    logger.error('PUT /verband-urkunden/:id:', err);
    res.status(500).json({ success: false, message: 'Serverfehler' });
  }
});

// ============================================================================
// DELETE /verband-urkunden/:id
// ============================================================================
router.delete('/:id', authenticateToken, requireTDAAdmin, async (req, res) => {
  try {
    await queryAsync('DELETE FROM verband_urkunden WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('DELETE /verband-urkunden/:id:', err);
    res.status(500).json({ success: false, message: 'Serverfehler' });
  }
});

module.exports = router;
