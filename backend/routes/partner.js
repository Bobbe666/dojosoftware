const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const pool = db.promise();

// ── Auth helpers ──────────────────────────────────────────────────────────────

function isSuperAdmin(user) {
  if (!user) return false;
  const role = user.rolle || user.role;
  return role === 'super_admin' || (role === 'admin' && user.dojo_id === null);
}

function requireSuperAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Kein Token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ success: false, error: 'Token ungültig' });
  }
  if (!isSuperAdmin(req.user)) return res.status(403).json({ success: false, error: 'Super-Admin erforderlich' });
  next();
}

// ── Multer for document uploads ───────────────────────────────────────────────

const uploadsDir = path.join(__dirname, '..', 'uploads', 'partner-docs');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `partner-doc-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Nur PDF, Word und Bilder erlaubt'));
  },
});

// ── PUBLIC: all representatives + public documents ────────────────────────────

router.get('/public', async (req, res) => {
  try {
    const [reps] = await pool.query(
      'SELECT id, type, code, name_de, name_en, status, rep_name, rep_email, rep_website, flag_emoji, notes, sort_order FROM partner_representatives ORDER BY sort_order ASC, name_de ASC'
    );
    const [docs] = await pool.query(
      'SELECT id, name_de, name_en, description_de, description_en, filename, file_size, mime_type, category, sort_order FROM partner_documents WHERE is_public = 1 ORDER BY sort_order ASC, name_de ASC'
    );
    res.json({ success: true, representatives: reps, documents: docs });
  } catch (err) {
    console.error('partner/public:', err);
    res.status(500).json({ success: false, error: 'DB-Fehler' });
  }
});

// ── PUBLIC: download a document ───────────────────────────────────────────────

router.get('/documents/:id/download', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT filename, file_path, mime_type, name_de FROM partner_documents WHERE id = ? AND is_public = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Dokument nicht gefunden' });
    const doc = rows[0];
    const fullPath = path.join(__dirname, '..', doc.file_path);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, error: 'Datei nicht gefunden' });
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    if (doc.mime_type) res.setHeader('Content-Type', doc.mime_type);
    res.sendFile(fullPath);
  } catch (err) {
    console.error('partner/download:', err);
    res.status(500).json({ success: false, error: 'Fehler beim Download' });
  }
});

// ── ADMIN: GET all representatives ───────────────────────────────────────────

router.get('/admin/representatives', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM partner_representatives ORDER BY sort_order ASC, name_de ASC'
    );
    res.json({ success: true, representatives: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'DB-Fehler' });
  }
});

// ── ADMIN: UPDATE a representative ───────────────────────────────────────────

router.put('/admin/representatives/:id', requireSuperAdmin, async (req, res) => {
  const { status, rep_name, rep_email, rep_website, notes, sort_order } = req.body;
  try {
    await pool.query(
      'UPDATE partner_representatives SET status=?, rep_name=?, rep_email=?, rep_website=?, notes=?, sort_order=? WHERE id=?',
      [status, rep_name || null, rep_email || null, rep_website || null, notes || null, sort_order ?? 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'DB-Fehler' });
  }
});

// ── ADMIN: CREATE a representative ───────────────────────────────────────────

router.post('/admin/representatives', requireSuperAdmin, async (req, res) => {
  const { type, code, name_de, name_en, status, rep_name, rep_email, rep_website, flag_emoji, notes, sort_order } = req.body;
  if (!type || !code || !name_de || !name_en) return res.status(400).json({ success: false, error: 'type, code, name_de, name_en erforderlich' });
  try {
    const [result] = await pool.query(
      'INSERT INTO partner_representatives (type, code, name_de, name_en, status, rep_name, rep_email, rep_website, flag_emoji, notes, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [type, code, name_de, name_en, status || 'free', rep_name || null, rep_email || null, rep_website || null, flag_emoji || null, notes || null, sort_order ?? 0]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'Code+Typ bereits vorhanden' });
    res.status(500).json({ success: false, error: 'DB-Fehler' });
  }
});

// ── ADMIN: DELETE a representative ───────────────────────────────────────────

router.delete('/admin/representatives/:id', requireSuperAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM partner_representatives WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'DB-Fehler' });
  }
});

// ── ADMIN: GET all documents ──────────────────────────────────────────────────

router.get('/admin/documents', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM partner_documents ORDER BY sort_order ASC, name_de ASC');
    res.json({ success: true, documents: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'DB-Fehler' });
  }
});

// ── ADMIN: UPLOAD a document ──────────────────────────────────────────────────

router.post('/admin/documents', requireSuperAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Keine Datei hochgeladen' });
  const { name_de, name_en, description_de, description_en, category, is_public, sort_order } = req.body;
  if (!name_de || !name_en) return res.status(400).json({ success: false, error: 'name_de und name_en erforderlich' });
  const relativePath = path.join('uploads', 'partner-docs', req.file.filename);
  try {
    const [result] = await pool.query(
      'INSERT INTO partner_documents (name_de, name_en, description_de, description_en, filename, file_path, file_size, mime_type, category, is_public, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [name_de, name_en, description_de || null, description_en || null, req.file.originalname, relativePath, req.file.size, req.file.mimetype, category || 'info', is_public === '0' ? 0 : 1, sort_order ?? 0]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, error: 'DB-Fehler' });
  }
});

// ── ADMIN: DELETE a document ──────────────────────────────────────────────────

router.delete('/admin/documents/:id', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT file_path FROM partner_documents WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    await pool.query('DELETE FROM partner_documents WHERE id = ?', [req.params.id]);
    const fullPath = path.join(__dirname, '..', rows[0].file_path);
    fs.unlink(fullPath, () => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'DB-Fehler' });
  }
});

module.exports = router;
