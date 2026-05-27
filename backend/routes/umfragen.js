// ============================================================
// UMFRAGEN — Plattformweites + Dojo-spezifisches Umfragetool
// ============================================================
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const db = require('../db');
const pool = db.promise();

router.use(authenticateToken);

// ── Hilfsfunktion: ist der User Super-Admin? ──────────────────────────────────
function checkSuperAdmin(user) {
  return (user.rolle === 'admin' || user.role === 'admin') && !user.dojo_id;
}

// ── Hilfsfunktion: dojo_id des Users (aus JWT oder Query-Param für SuperAdmin) ─
function getDojoId(req) {
  return getSecureDojoId(req);
}

// ── GET /pending — Ausstehende Umfragen für eingeloggten User ─────────────────
router.get('/pending', async (req, res) => {
  const userId = req.user.id || req.user.user_id;
  const userDojoId = req.user.dojo_id;
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.titel, u.beschreibung, u.typ, u.ziel_platformen
       FROM umfragen u
       WHERE u.status = 'aktiv'
         AND (u.gueltig_bis IS NULL OR u.gueltig_bis >= CURDATE())
         AND (u.dojo_id IS NULL OR u.dojo_id = ?)
         AND u.id NOT IN (
           SELECT umfrage_id FROM umfrage_antworten WHERE user_id = ?
         )
       ORDER BY u.erstellt_am DESC`,
      [userDojoId || 0, userId]
    );
    res.json({ success: true, umfragen: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /:id/antwort — Antwort einreichen ────────────────────────────────────
router.post('/:id/antwort', async (req, res) => {
  const userId = req.user.id || req.user.user_id;
  const { antwort, kommentar } = req.body;
  try {
    await pool.query(
      `INSERT INTO umfrage_antworten (umfrage_id, user_id, antwort, kommentar)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE antwort = VALUES(antwort), kommentar = VALUES(kommentar), beantwortet_am = NOW()`,
      [req.params.id, userId, antwort || null, kommentar || null]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET / — Alle Umfragen auflisten (Admin: nur eigene + plattformweite) ──────
router.get('/', async (req, res) => {
  const isSuperAdmin = checkSuperAdmin(req.user);
  const dojoId = getDojoId(req);

  try {
    let query, params;
    if (isSuperAdmin && !dojoId) {
      // Super-Admin ohne Dojo-Filter: alle Umfragen
      query = `
        SELECT u.*,
               d.dojoname AS dojo_name,
               COUNT(DISTINCT a.id) AS antworten_gesamt,
               SUM(a.antwort = 'ja') AS antworten_ja,
               SUM(a.antwort = 'nein') AS antworten_nein
        FROM umfragen u
        LEFT JOIN dojo d ON d.id = u.dojo_id
        LEFT JOIN umfrage_antworten a ON a.umfrage_id = u.id
        GROUP BY u.id
        ORDER BY u.erstellt_am DESC`;
      params = [];
    } else if (dojoId) {
      // Dojo-Admin: eigene + plattformweite
      query = `
        SELECT u.*,
               d.dojoname AS dojo_name,
               COUNT(DISTINCT a.id) AS antworten_gesamt,
               SUM(a.antwort = 'ja') AS antworten_ja,
               SUM(a.antwort = 'nein') AS antworten_nein
        FROM umfragen u
        LEFT JOIN dojo d ON d.id = u.dojo_id
        LEFT JOIN umfrage_antworten a ON a.umfrage_id = u.id
        WHERE (u.dojo_id = ? OR u.dojo_id IS NULL)
        GROUP BY u.id
        ORDER BY u.erstellt_am DESC`;
      params = [dojoId];
    } else {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const [rows] = await pool.query(query, params);
    res.json({ success: true, umfragen: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST / — Neue Umfrage erstellen ──────────────────────────────────────────
router.post('/', async (req, res) => {
  const isSuperAdmin = checkSuperAdmin(req.user);
  const dojoId = getDojoId(req);

  if (!isSuperAdmin && !dojoId) {
    return res.status(403).json({ error: 'Nicht autorisiert' });
  }

  const { titel, beschreibung, typ, status, ziel_platformen, gueltig_bis } = req.body;
  if (!titel) return res.status(400).json({ error: 'Titel erforderlich' });

  const autorId = req.user.id || req.user.user_id || req.user.admin_id;
  // Super-Admin ohne spezifisches Dojo → plattformweit (dojo_id=NULL)
  const umfrageDojo = (isSuperAdmin && !dojoId) ? null : dojoId;

  try {
    const [r] = await pool.query(
      `INSERT INTO umfragen (dojo_id, titel, beschreibung, typ, status, ziel_platformen, erstellt_von, gueltig_bis)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        umfrageDojo,
        titel,
        beschreibung || null,
        typ || 'ja_nein',
        status || 'entwurf',
        JSON.stringify(Array.isArray(ziel_platformen) ? ziel_platformen : ['dojo']),
        autorId,
        gueltig_bis || null,
      ]
    );
    res.json({ success: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /:id — Umfrage bearbeiten ─────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const isSuperAdmin = checkSuperAdmin(req.user);
  const dojoId = getDojoId(req);

  if (!isSuperAdmin && !dojoId) {
    return res.status(403).json({ error: 'Nicht autorisiert' });
  }

  const { titel, beschreibung, typ, status, ziel_platformen, gueltig_bis } = req.body;
  try {
    // Ownership-Check: Dojo-Admin darf nur eigene Umfragen bearbeiten
    const whereExtra = isSuperAdmin && !dojoId ? '' : ' AND dojo_id = ?';
    const whereParams = isSuperAdmin && !dojoId ? [req.params.id] : [req.params.id, dojoId];

    const [check] = await pool.query(`SELECT id FROM umfragen WHERE id = ?${whereExtra}`, whereParams);
    if (check.length === 0) return res.status(403).json({ error: 'Nicht autorisiert oder nicht gefunden' });

    await pool.query(
      `UPDATE umfragen SET titel=?, beschreibung=?, typ=?, status=?, ziel_platformen=?, gueltig_bis=? WHERE id=?`,
      [
        titel,
        beschreibung || null,
        typ || 'ja_nein',
        status || 'entwurf',
        JSON.stringify(Array.isArray(ziel_platformen) ? ziel_platformen : ['dojo']),
        gueltig_bis || null,
        req.params.id,
      ]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /:id — Umfrage löschen ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const isSuperAdmin = checkSuperAdmin(req.user);
  const dojoId = getDojoId(req);

  if (!isSuperAdmin && !dojoId) {
    return res.status(403).json({ error: 'Nicht autorisiert' });
  }

  try {
    const whereExtra = isSuperAdmin && !dojoId ? '' : ' AND dojo_id = ?';
    const whereParams = isSuperAdmin && !dojoId ? [req.params.id] : [req.params.id, dojoId];

    const [check] = await pool.query(`SELECT id FROM umfragen WHERE id = ?${whereExtra}`, whereParams);
    if (check.length === 0) return res.status(403).json({ error: 'Nicht autorisiert oder nicht gefunden' });

    await pool.query('DELETE FROM umfrage_antworten WHERE umfrage_id = ?', [req.params.id]);
    await pool.query('DELETE FROM umfragen WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /:id/antworten — Einzelantworten ─────────────────────────────────────
router.get('/:id/antworten', async (req, res) => {
  const isSuperAdmin = checkSuperAdmin(req.user);
  const dojoId = getDojoId(req);

  if (!isSuperAdmin && !dojoId) {
    return res.status(403).json({ error: 'Nicht autorisiert' });
  }

  try {
    // Ownership-Check
    const whereExtra = isSuperAdmin && !dojoId ? '' : ' AND (u.dojo_id = ? OR u.dojo_id IS NULL)';
    const checkParams = isSuperAdmin && !dojoId ? [req.params.id] : [req.params.id, dojoId];

    const [umfrage] = await pool.query(`SELECT id FROM umfragen u WHERE u.id = ?${whereExtra}`, checkParams);
    if (umfrage.length === 0) return res.status(403).json({ error: 'Nicht autorisiert' });

    const [rows] = await pool.query(
      `SELECT a.antwort, a.kommentar, a.beantwortet_am,
              m.vorname, m.nachname, d.dojoname
       FROM umfrage_antworten a
       LEFT JOIN users us ON us.id = a.user_id
       LEFT JOIN mitglieder m ON m.mitglied_id = us.mitglied_id
       LEFT JOIN dojo d ON d.id = m.dojo_id
       WHERE a.umfrage_id = ?
       ORDER BY a.beantwortet_am DESC`,
      [req.params.id]
    );
    res.json({ success: true, antworten: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /dojo/aktiv — Aktive Umfragen für Dashboard-Anzeige ──────────────────
router.get('/dojo/aktiv', async (req, res) => {
  const dojoId = req.user?.dojo_id || req.query?.dojo_id || null;
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.titel, u.beschreibung, u.typ, u.status, u.gueltig_bis,
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
    res.json({ success: true, umfragen: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
