const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const pool = db.promise();

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getUser(req) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); } catch { return null; }
}

function requireMember(req, res, next) {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: 'Nicht angemeldet' });
  req.user = u;
  next();
}

function requireAdmin(req, res, next) {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: 'Nicht angemeldet' });
  req.user = u;
  const role = u.rolle || u.role;
  if (role !== 'admin' && role !== 'super_admin') return res.status(403).json({ error: 'Kein Zugriff' });
  next();
}

// ── Multer ────────────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, '../uploads/community');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Nur Bilder')),
});

// ── POST /upload ──────────────────────────────────────────────────────────────

router.post('/upload', requireMember, upload.array('images', 5), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Keine Dateien' });
  const base = process.env.BASE_URL || 'https://dojo.tda-intl.org';
  const urls = req.files.map(f => `${base}/uploads/community/${f.filename}`);
  res.json({ success: true, urls });
});

// ── GET / — aktive Posts des Dojos ───────────────────────────────────────────

router.get('/', requireMember, async (req, res) => {
  const dojoId   = req.query.dojo_id;
  const category = req.query.category; // optional filter
  if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
  try {
    let sql = `
      SELECT cp.*, m.vorname, m.nachname, m.foto_pfad AS avatar_url,
             u.id AS user_id
      FROM community_posts cp
      LEFT JOIN mitglieder m ON m.mitglied_id = cp.mitglied_id
      LEFT JOIN users u ON u.mitglied_id = cp.mitglied_id
      WHERE cp.dojo_id = ? AND cp.status = 'active'
        AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
    `;
    const params = [dojoId];
    if (category) { sql += ' AND cp.category = ?'; params.push(category); }
    sql += ' ORDER BY cp.created_at DESC LIMIT 100';
    const [rows] = await pool.query(sql, params);
    // increment views happens client-side via separate call
    res.json({ success: true, posts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin — alle Posts inkl. pending (Admin) ─────────────────────────────

router.get('/admin', requireAdmin, async (req, res) => {
  const dojoId = req.query.dojo_id;
  if (!dojoId) return res.status(400).json({ error: 'dojo_id fehlt' });
  try {
    const [rows] = await pool.query(`
      SELECT cp.*, m.vorname, m.nachname
      FROM community_posts cp
      LEFT JOIN mitglieder m ON m.mitglied_id = cp.mitglied_id
      WHERE cp.dojo_id = ?
      ORDER BY cp.status = 'pending' DESC, cp.created_at DESC
      LIMIT 200
    `, [dojoId]);
    res.json({ success: true, posts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST / — Beitrag erstellen ────────────────────────────────────────────────

router.post('/', requireMember, async (req, res) => {
  const {
    dojo_id, category, title, description, images,
    price, price_type, item_condition,
    training_style, training_days, training_time, training_level,
    event_date, event_location,
    show_contact_info, contact_phone, contact_email,
    expires_at,
  } = req.body;

  if (!dojo_id || !category || !title || !description)
    return res.status(400).json({ error: 'dojo_id, category, title, description erforderlich' });

  const mitgliedId = req.user.mitglied_id || req.user.id;
  if (!mitgliedId) return res.status(400).json({ error: 'Mitglied-ID nicht ermittelbar' });

  try {
    const [r] = await pool.query(`
      INSERT INTO community_posts
        (dojo_id, mitglied_id, category, title, description, images,
         price, price_type, item_condition,
         training_style, training_days, training_time, training_level,
         event_date, event_location,
         show_contact_info, contact_phone, contact_email,
         status, expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)
    `, [
      dojo_id, mitgliedId, category, title, description,
      images ? JSON.stringify(images) : null,
      price || null, price_type || null, item_condition || null,
      training_style || null, training_days || null, training_time || null, training_level || null,
      event_date || null, event_location || null,
      show_contact_info ? 1 : 0, contact_phone || null, contact_email || null,
      expires_at || null,
    ]);
    res.json({ success: true, id: r.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /:id — eigenen Beitrag bearbeiten ─────────────────────────────────────

router.put('/:id', requireMember, async (req, res) => {
  const mitgliedId = req.user.mitglied_id || req.user.id;
  const [[post]] = await pool.query('SELECT * FROM community_posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Nicht gefunden' });
  if (post.mitglied_id !== mitgliedId) return res.status(403).json({ error: 'Kein Zugriff' });

  const {
    title, description, images, price, price_type, item_condition,
    training_style, training_days, training_time, training_level,
    event_date, event_location,
    show_contact_info, contact_phone, contact_email, expires_at,
  } = req.body;

  try {
    await pool.query(`
      UPDATE community_posts SET
        title=?, description=?, images=?,
        price=?, price_type=?, item_condition=?,
        training_style=?, training_days=?, training_time=?, training_level=?,
        event_date=?, event_location=?,
        show_contact_info=?, contact_phone=?, contact_email=?,
        status='pending', expires_at=?
      WHERE id=?
    `, [
      title, description, images ? JSON.stringify(images) : null,
      price || null, price_type || null, item_condition || null,
      training_style || null, training_days || null, training_time || null, training_level || null,
      event_date || null, event_location || null,
      show_contact_info ? 1 : 0, contact_phone || null, contact_email || null,
      expires_at || null, req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id — eigenen oder Admin löscht ───────────────────────────────────

router.delete('/:id', requireMember, async (req, res) => {
  const mitgliedId = req.user.mitglied_id || req.user.id;
  const role = req.user.rolle || req.user.role;
  const [[post]] = await pool.query('SELECT * FROM community_posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Nicht gefunden' });
  const isAdmin = role === 'admin' || role === 'super_admin';
  if (post.mitglied_id !== mitgliedId && !isAdmin) return res.status(403).json({ error: 'Kein Zugriff' });
  await pool.query('DELETE FROM community_posts WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ── PUT /:id/status — Admin moderiert ────────────────────────────────────────

router.put('/:id/status', requireAdmin, async (req, res) => {
  const { status, rejection_reason } = req.body;
  if (!['active', 'rejected', 'closed'].includes(status))
    return res.status(400).json({ error: 'Ungültiger Status' });
  try {
    await pool.query(
      'UPDATE community_posts SET status=?, rejection_reason=? WHERE id=?',
      [status, rejection_reason || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/view — View-Counter ─────────────────────────────────────────────

router.post('/:id/view', async (req, res) => {
  await pool.query('UPDATE community_posts SET views = views + 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
