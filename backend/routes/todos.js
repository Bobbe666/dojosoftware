const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId }   = require('../middleware/tenantSecurity');

router.use(authenticateToken);

const pool = db.promise();

// GET /api/todos — Liste mit optionalen Filtern
router.get('/', async (req, res) => {
  const dojoId  = getSecureDojoId(req);
  const { status, kontext, prioritaet } = req.query;
  try {
    let sql = `
      SELECT t.*,
             au.vorname, au.nachname,
             (SELECT COUNT(*) FROM todo_kommentare k WHERE k.todo_id = t.id) AS kommentar_count
      FROM todos t
      LEFT JOIN admin_users au ON au.id = t.erstellt_von
      WHERE 1=1
    `;
    const params = [];
    if (dojoId) { sql += ' AND t.dojo_id = ?'; params.push(dojoId); }
    else         { sql += ' AND (t.dojo_id IS NULL OR 1=1)'; }
    if (status   && status   !== 'alle') { sql += ' AND t.status = ?';    params.push(status); }
    if (kontext  && kontext  !== 'alle') { sql += ' AND t.kontext = ?';   params.push(kontext); }
    if (prioritaet && prioritaet !== 'alle') { sql += ' AND t.prioritaet = ?'; params.push(prioritaet); }
    sql += ' ORDER BY FIELD(t.status,\'offen\',\'in_bearbeitung\',\'erledigt\'), FIELD(t.prioritaet,\'dringend\',\'hoch\',\'normal\',\'niedrig\'), t.faellig_am ASC, t.erstellt_am DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ todos: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/todos/users — zuweisbare Mitarbeiter für dieses Dojo
router.get('/users', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  try {
    let sql = `SELECT id, vorname, nachname, rolle FROM admin_users WHERE aktiv = 1`;
    const params = [];
    if (dojoId) { sql += ' AND dojo_id = ?'; params.push(dojoId); }
    sql += ' ORDER BY vorname, nachname';
    const [rows] = await pool.query(sql, params);
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/todos/:id — Einzelnes Todo
router.get('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { id } = req.params;
  try {
    let sql = `
      SELECT t.*, au.vorname, au.nachname,
             (SELECT COUNT(*) FROM todo_kommentare k WHERE k.todo_id = t.id) AS kommentar_count
      FROM todos t
      LEFT JOIN admin_users au ON au.id = t.erstellt_von
      WHERE t.id = ?
    `;
    const params = [id];
    if (dojoId) { sql += ' AND t.dojo_id = ?'; params.push(dojoId); }
    const [rows] = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ todo: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos — Todo erstellen
router.post('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const userId = req.user?.user_id || req.user?.id;
  const { titel, beschreibung, prioritaet, kontext, faellig_am, zugewiesen_an } = req.body;
  if (!titel?.trim()) return res.status(400).json({ error: 'Titel erforderlich' });
  try {
    const [result] = await pool.query(
      `INSERT INTO todos (dojo_id, kontext, titel, beschreibung, prioritaet, faellig_am, erstellt_von, zugewiesen_an)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId || null, kontext || 'allgemein', titel.trim(), beschreibung || null,
       prioritaet || 'normal', faellig_am || null, userId || null, zugewiesen_an || null]
    );
    const [rows] = await pool.query(
      `SELECT t.*, au.vorname, au.nachname, 0 AS kommentar_count
       FROM todos t LEFT JOIN admin_users au ON au.id = t.erstellt_von WHERE t.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ todo: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/todos/:id — Todo bearbeiten
router.put('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { id }  = req.params;
  const { titel, beschreibung, sachstand, prioritaet, status, kontext, faellig_am, zugewiesen_an } = req.body;
  try {
    let where = 'WHERE id = ?';
    const params = [id];
    if (dojoId) { where += ' AND dojo_id = ?'; params.push(dojoId); }
    await pool.query(
      `UPDATE todos SET titel=?, beschreibung=?, sachstand=?, prioritaet=?, status=?, kontext=?, faellig_am=?, zugewiesen_an=? ${where}`,
      [titel, beschreibung || null, sachstand || null, prioritaet, status, kontext, faellig_am || null, zugewiesen_an || null, ...params]
    );
    const [rows] = await pool.query(
      `SELECT t.*, au.vorname, au.nachname,
              (SELECT COUNT(*) FROM todo_kommentare k WHERE k.todo_id = t.id) AS kommentar_count
       FROM todos t LEFT JOIN admin_users au ON au.id = t.erstellt_von WHERE t.id = ?`,
      [id]
    );
    res.json({ todo: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/todos/:id/status — Status schnell wechseln
router.patch('/:id/status', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { id }  = req.params;
  const { status } = req.body;
  const valid = ['offen', 'in_bearbeitung', 'erledigt'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });
  try {
    let where = 'WHERE id = ?';
    const params = [status, id];
    if (dojoId) { where += ' AND dojo_id = ?'; params.push(dojoId); }
    await pool.query(`UPDATE todos SET status = ? ${where}`, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { id } = req.params;
  try {
    let where = 'WHERE id = ?';
    const params = [id];
    if (dojoId) { where += ' AND dojo_id = ?'; params.push(dojoId); }
    await pool.query(`DELETE FROM todos ${where}`, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Kommentare ────────────────────────────────────────────────────────────────

// GET /api/todos/:id/kommentare
router.get('/:id/kommentare', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM todo_kommentare WHERE todo_id = ? ORDER BY erstellt_am ASC',
      [req.params.id]
    );
    res.json({ kommentare: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos/:id/kommentare
router.post('/:id/kommentare', async (req, res) => {
  const userId = req.user?.id || req.user?.user_id;
  const { kommentar } = req.body;
  if (!kommentar?.trim()) return res.status(400).json({ error: 'Kommentar darf nicht leer sein' });
  try {
    let autorName = req.user?.username || 'Unbekannt';
    if (userId) {
      const [[u]] = await pool.query(
        'SELECT vorname, nachname, username FROM admin_users WHERE id = ? LIMIT 1',
        [userId]
      );
      if (u) autorName = [u.vorname, u.nachname].filter(Boolean).join(' ') || u.username || autorName;
    }
    const [result] = await pool.query(
      'INSERT INTO todo_kommentare (todo_id, autor_id, autor_name, kommentar) VALUES (?, ?, ?, ?)',
      [req.params.id, userId || null, autorName, kommentar.trim()]
    );
    const [[neu]] = await pool.query('SELECT * FROM todo_kommentare WHERE id = ?', [result.insertId]);
    res.status(201).json({ kommentar: neu });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:id/kommentare/:kid
router.delete('/:id/kommentare/:kid', async (req, res) => {
  try {
    await pool.query('DELETE FROM todo_kommentare WHERE id = ? AND todo_id = ?', [req.params.kid, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
