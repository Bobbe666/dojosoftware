// ============================================================
// UMFRAGEN — Plattformweites + Dojo-spezifisches Umfragetool
// ============================================================
const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId }   = require('../middleware/tenantSecurity');
const db   = require('../db');
const pool = db.promise();

// GET /api/umfragen/public?dojo_id=X — öffentlich: aktive Umfragen für Website-Anzeige
router.get('/public', async (req, res) => {
  try {
    const { dojo_id } = req.query;
    if (!dojo_id) return res.status(400).json({ success: false, error: 'dojo_id fehlt' });
    const [rows] = await pool.query(
      `SELECT id, titel, beschreibung, typ, daten, bild_url, als_popup, gueltig_bis, erstellt_am
       FROM umfragen
       WHERE status = 'aktiv' AND dojo_id = ?
         AND (gueltig_bis IS NULL OR gueltig_bis >= CURDATE())
       ORDER BY erstellt_am DESC
       LIMIT 5`,
      [parseInt(dojo_id)]
    );
    res.json({ success: true, umfragen: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.use(authenticateToken);

// ── Bild-Upload ───────────────────────────────────────────────────────────────
const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/umfragen');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `umfrage-${req.params.id}-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const imgFilter = (req, file, cb) => {
  const ok = ['image/png','image/jpeg','image/jpg','image/webp','image/gif'].includes(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Nur Bilder erlaubt'), false);
};
const upload = multer({ storage: imgStorage, fileFilter: imgFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ── Hilfen ────────────────────────────────────────────────────────────────────
function isSA(user) {
  return (user.rolle === 'admin' || user.role === 'admin') && !user.dojo_id;
}
function getDojoId(req) { return getSecureDojoId(req); }

function parseUmfrage(u) {
  return {
    ...u,
    daten: u.daten ? (typeof u.daten === 'string' ? JSON.parse(u.daten) : u.daten) : null,
  };
}

// ── SELECT-Snippet für Aggregation ────────────────────────────────────────────
const SELECT_AGG = `
  SELECT u.*,
         d.dojoname AS dojo_name,
         COUNT(DISTINCT a.id) AS antworten_gesamt,
         SUM(a.antwort = 'ja') AS antworten_ja,
         SUM(a.antwort = 'nein') AS antworten_nein
  FROM umfragen u
  LEFT JOIN dojo d ON d.id = u.dojo_id
  LEFT JOIN umfrage_antworten a ON a.umfrage_id = u.id`;

// ── GET /pending ──────────────────────────────────────────────────────────────
router.get('/pending', async (req, res) => {
  const userId     = req.user.id || req.user.user_id;
  const userDojoId = req.user.dojo_id;
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.titel, u.beschreibung, u.typ, u.bild_url, u.daten, u.ziel_platformen, u.als_popup
       FROM umfragen u
       WHERE u.status = 'aktiv'
         AND (u.gueltig_bis IS NULL OR u.gueltig_bis >= CURDATE())
         AND (u.dojo_id IS NULL OR u.dojo_id = ?)
         AND u.id NOT IN (
           SELECT DISTINCT umfrage_id FROM umfrage_antworten WHERE user_id = ?
           UNION
           SELECT DISTINCT umfrage_id FROM umfrage_datum_antworten WHERE user_id = ?
         )
       ORDER BY u.erstellt_am DESC`,
      [userDojoId || 0, userId, userId]
    );
    res.json({ success: true, umfragen: rows.map(parseUmfrage) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /:id/antwort — Ja/Nein/Kommentar ────────────────────────────────────
router.post('/:id/antwort', async (req, res) => {
  const userId = req.user.id || req.user.user_id;
  const { antwort, kommentar } = req.body;
  try {
    await pool.query(
      `INSERT INTO umfrage_antworten (umfrage_id, user_id, antwort, kommentar)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE antwort=VALUES(antwort), kommentar=VALUES(kommentar), beantwortet_am=NOW()`,
      [req.params.id, userId, antwort || null, kommentar || null]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /:id/datum-antwort — Datumsauswahl ───────────────────────────────────
router.post('/:id/datum-antwort', async (req, res) => {
  const userId = req.user.id || req.user.user_id;
  const { daten } = req.body; // Array von { datum: 'YYYY-MM-DD', kommt: true/false }
  if (!Array.isArray(daten) || daten.length === 0) {
    return res.status(400).json({ error: 'Keine Daten übergeben' });
  }
  try {
    // Bestehende Antworten löschen und neu setzen
    await pool.query('DELETE FROM umfrage_datum_antworten WHERE umfrage_id = ? AND user_id = ?', [req.params.id, userId]);
    for (const d of daten) {
      await pool.query(
        `INSERT INTO umfrage_datum_antworten (umfrage_id, user_id, datum, kommt) VALUES (?, ?, ?, ?)`,
        [req.params.id, userId, d.datum, d.kommt ? 1 : 0]
      );
    }
    // Markierung in umfrage_antworten damit User als "beantwortet" gilt
    await pool.query(
      `INSERT INTO umfrage_antworten (umfrage_id, user_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE beantwortet_am = NOW()`,
      [req.params.id, userId]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET / — Liste aller Umfragen ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  const superAdmin = isSA(req.user);
  const dojoId     = getDojoId(req);
  if (!superAdmin && !dojoId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const where  = (!superAdmin || dojoId) ? `WHERE (u.dojo_id = ? OR u.dojo_id IS NULL)` : '';
    const params = (!superAdmin || dojoId) ? [dojoId] : [];
    const [rows] = await pool.query(`${SELECT_AGG} ${where} GROUP BY u.id ORDER BY u.erstellt_am DESC`, params);
    res.json({ success: true, umfragen: rows.map(parseUmfrage) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST / — Neue Umfrage ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const superAdmin = isSA(req.user);
  const dojoId     = getDojoId(req);
  if (!superAdmin && !dojoId) return res.status(403).json({ error: 'Nicht autorisiert' });

  const { titel, beschreibung, typ, status, als_popup, ziel_platformen, gueltig_bis, daten } = req.body;
  if (!titel) return res.status(400).json({ error: 'Titel erforderlich' });

  const autorId    = req.user.id || req.user.user_id || req.user.admin_id;
  const umfrageDojo = (superAdmin && !dojoId) ? null : dojoId;

  try {
    const [r] = await pool.query(
      `INSERT INTO umfragen (dojo_id, titel, beschreibung, typ, status, als_popup, ziel_platformen, daten, erstellt_von, gueltig_bis)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        umfrageDojo, titel, beschreibung || null,
        typ || 'ja_nein', status || 'entwurf', als_popup ? 1 : 0,
        JSON.stringify(Array.isArray(ziel_platformen) ? ziel_platformen : ['dojo']),
        daten ? JSON.stringify(daten) : null,
        autorId, gueltig_bis || null,
      ]
    );
    res.json({ success: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /:id/bild — Bild hochladen ──────────────────────────────────────────
router.post('/:id/bild', upload.single('bild'), async (req, res) => {
  const superAdmin = isSA(req.user);
  const dojoId     = getDojoId(req);
  if (!superAdmin && !dojoId) return res.status(403).json({ error: 'Nicht autorisiert' });
  if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });

  const url = `/uploads/umfragen/${req.file.filename}`;
  try {
    // Altes Bild löschen
    const [cur] = await pool.query('SELECT bild_url FROM umfragen WHERE id = ?', [req.params.id]);
    if (cur[0]?.bild_url) {
      const old = path.join(__dirname, '..', cur[0].bild_url);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    await pool.query('UPDATE umfragen SET bild_url = ? WHERE id = ?', [url, req.params.id]);
    res.json({ success: true, bild_url: url });
  } catch (e) {
    fs.unlinkSync(req.file.path);
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /:id/bild — Bild entfernen ────────────────────────────────────────
router.delete('/:id/bild', async (req, res) => {
  const superAdmin = isSA(req.user);
  const dojoId     = getDojoId(req);
  if (!superAdmin && !dojoId) return res.status(403).json({ error: 'Nicht autorisiert' });

  try {
    const [cur] = await pool.query('SELECT bild_url FROM umfragen WHERE id = ?', [req.params.id]);
    if (cur[0]?.bild_url) {
      const file = path.join(__dirname, '..', cur[0].bild_url);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    await pool.query('UPDATE umfragen SET bild_url = NULL WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /:id — Bearbeiten ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const superAdmin = isSA(req.user);
  const dojoId     = getDojoId(req);
  if (!superAdmin && !dojoId) return res.status(403).json({ error: 'Nicht autorisiert' });

  const { titel, beschreibung, typ, status, als_popup, ziel_platformen, gueltig_bis, daten } = req.body;
  try {
    const whereExtra  = superAdmin && !dojoId ? '' : ' AND dojo_id = ?';
    const checkParams = superAdmin && !dojoId ? [req.params.id] : [req.params.id, dojoId];
    const [check] = await pool.query(`SELECT id FROM umfragen WHERE id = ?${whereExtra}`, checkParams);
    if (!check.length) return res.status(403).json({ error: 'Nicht autorisiert oder nicht gefunden' });

    await pool.query(
      `UPDATE umfragen SET titel=?, beschreibung=?, typ=?, status=?, als_popup=?, ziel_platformen=?, gueltig_bis=?, daten=? WHERE id=?`,
      [
        titel, beschreibung || null,
        typ || 'ja_nein', status || 'entwurf', als_popup ? 1 : 0,
        JSON.stringify(Array.isArray(ziel_platformen) ? ziel_platformen : ['dojo']),
        gueltig_bis || null,
        daten ? JSON.stringify(daten) : null,
        req.params.id,
      ]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /:id — Löschen ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const superAdmin = isSA(req.user);
  const dojoId     = getDojoId(req);
  if (!superAdmin && !dojoId) return res.status(403).json({ error: 'Nicht autorisiert' });

  try {
    const whereExtra  = superAdmin && !dojoId ? '' : ' AND dojo_id = ?';
    const checkParams = superAdmin && !dojoId ? [req.params.id] : [req.params.id, dojoId];
    const [check] = await pool.query(`SELECT id, bild_url FROM umfragen WHERE id = ?${whereExtra}`, checkParams);
    if (!check.length) return res.status(403).json({ error: 'Nicht autorisiert' });

    if (check[0].bild_url) {
      const file = path.join(__dirname, '..', check[0].bild_url);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    await pool.query('DELETE FROM umfrage_datum_antworten WHERE umfrage_id = ?', [req.params.id]);
    await pool.query('DELETE FROM umfrage_antworten WHERE umfrage_id = ?', [req.params.id]);
    await pool.query('DELETE FROM umfragen WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /:id/antworten — Einzelantworten (Ja/Nein/Kommentar) ─────────────────
router.get('/:id/antworten', async (req, res) => {
  const superAdmin = isSA(req.user);
  const dojoId     = getDojoId(req);
  if (!superAdmin && !dojoId) return res.status(403).json({ error: 'Nicht autorisiert' });

  try {
    const whereExtra  = superAdmin && !dojoId ? '' : ' AND (u.dojo_id = ? OR u.dojo_id IS NULL)';
    const checkParams = superAdmin && !dojoId ? [req.params.id] : [req.params.id, dojoId];
    const [umfrage] = await pool.query(`SELECT id FROM umfragen u WHERE u.id = ?${whereExtra}`, checkParams);
    if (!umfrage.length) return res.status(403).json({ error: 'Nicht autorisiert' });

    const [rows] = await pool.query(
      `SELECT a.antwort, a.kommentar, a.beantwortet_am, m.vorname, m.nachname, d.dojoname
       FROM umfrage_antworten a
       LEFT JOIN users us ON us.id = a.user_id
       LEFT JOIN mitglieder m ON m.mitglied_id = us.mitglied_id
       LEFT JOIN dojo d ON d.id = m.dojo_id
       WHERE a.umfrage_id = ?
       ORDER BY a.beantwortet_am DESC`,
      [req.params.id]
    );
    res.json({ success: true, antworten: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /:id/datum-ergebnis — Ergebnisse pro Datum ───────────────────────────
router.get('/:id/datum-ergebnis', async (req, res) => {
  const superAdmin = isSA(req.user);
  const dojoId     = getDojoId(req);
  if (!superAdmin && !dojoId) return res.status(403).json({ error: 'Nicht autorisiert' });

  try {
    // Pro Datum: wer kommt, wer kommt nicht
    const [rows] = await pool.query(
      `SELECT da.datum,
              da.kommt,
              m.vorname, m.nachname, d.dojoname
       FROM umfrage_datum_antworten da
       LEFT JOIN users us ON us.id = da.user_id
       LEFT JOIN mitglieder m ON m.mitglied_id = us.mitglied_id
       LEFT JOIN dojo d ON d.id = m.dojo_id
       WHERE da.umfrage_id = ?
       ORDER BY da.datum, da.kommt DESC, m.nachname`,
      [req.params.id]
    );

    // Aggregieren pro Datum
    const byDate = {};
    for (const r of rows) {
      const key = r.datum instanceof Date ? r.datum.toISOString().split('T')[0] : r.datum;
      if (!byDate[key]) byDate[key] = { datum: key, kommt: [], kommt_nicht: [] };
      const person = `${r.vorname} ${r.nachname}`.trim() || '—';
      if (r.kommt) byDate[key].kommt.push({ name: person, dojo: r.dojoname });
      else byDate[key].kommt_nicht.push({ name: person, dojo: r.dojoname });
    }
    res.json({ success: true, ergebnis: Object.values(byDate) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /dojo/aktiv ───────────────────────────────────────────────────────────
router.get('/dojo/aktiv', async (req, res) => {
  const dojoId = req.user?.dojo_id || req.query?.dojo_id || null;
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.titel, u.beschreibung, u.typ, u.bild_url, u.daten, u.status, u.gueltig_bis,
              COUNT(DISTINCT a.id) AS antworten_gesamt,
              SUM(a.antwort = 'ja') AS antworten_ja,
              SUM(a.antwort = 'nein') AS antworten_nein
       FROM umfragen u
       LEFT JOIN umfrage_antworten a ON a.umfrage_id = u.id
       WHERE u.status = 'aktiv'
         AND (u.gueltig_bis IS NULL OR u.gueltig_bis >= CURDATE())
         AND (u.dojo_id IS NULL OR u.dojo_id = ?)
       GROUP BY u.id
       ORDER BY u.erstellt_am DESC`,
      [dojoId || 0]
    );

    // Datum-Aggregate für datum_auswahl-Umfragen nachladen
    const datumIds = rows.filter(u => u.typ === 'datum_auswahl').map(u => u.id);
    let datumAggMap = {};
    if (datumIds.length > 0) {
      const [dRows] = await pool.query(
        `SELECT umfrage_id,
                DATE_FORMAT(datum, '%Y-%m-%d') AS datum,
                SUM(kommt = 1) AS kann_kommen,
                SUM(kommt = 0) AS kann_nicht,
                COUNT(*) AS total
         FROM umfrage_datum_antworten
         WHERE umfrage_id IN (?)
         GROUP BY umfrage_id, datum
         ORDER BY umfrage_id, datum`,
        [datumIds]
      );
      for (const r of dRows) {
        if (!datumAggMap[r.umfrage_id]) datumAggMap[r.umfrage_id] = [];
        datumAggMap[r.umfrage_id].push({
          datum: r.datum,
          kann_kommen: Number(r.kann_kommen),
          kann_nicht: Number(r.kann_nicht),
          total: Number(r.total),
        });
      }
    }

    const umfragen = rows.map(u => ({
      ...parseUmfrage(u),
      datum_ergebnis: datumAggMap[u.id] || null,
    }));
    res.json({ success: true, umfragen });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
