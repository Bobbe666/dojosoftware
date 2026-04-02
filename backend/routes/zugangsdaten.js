// routes/zugangsdaten.js — Plattform-Zugangsdaten Zentrale (Super-Admin only)
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

// Super-Admin Guard (dojo_id === null im JWT)
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || (req.user.dojo_id !== null && req.user.dojo_id !== undefined)) {
    return res.status(403).json({ success: false, message: 'Nur Super-Admin zugänglich' });
  }
  next();
};

const safeDecrypt = (val) => {
  if (!val) return '';
  try { return isEncrypted(val) ? decrypt(val) : val; } catch { return val; }
};

const safeEncrypt = (val) => {
  if (!val) return null;
  try { return isEncrypted(val) ? val : encrypt(val); } catch { return val; }
};

// GET /api/zugangsdaten — alle Einträge
router.get('/', authenticateToken, requireSuperAdmin, (req, res) => {
  db.query(
    'SELECT * FROM plattform_zugangsdaten ORDER BY kategorie, sort_order, name',
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      const result = rows.map(r => ({
        id:           r.id,
        kategorie:    r.kategorie,
        name:         r.name,
        url:          r.url,
        benutzername: safeDecrypt(r.benutzername_enc),
        passwort:     safeDecrypt(r.passwort_enc),
        notizen:      r.notizen,
        sort_order:   r.sort_order,
        erstellt_am:  r.erstellt_am,
        aktualisiert_am: r.aktualisiert_am,
      }));
      res.json({ success: true, data: result });
    }
  );
});

// POST /api/zugangsdaten — neuer Eintrag
router.post('/', authenticateToken, requireSuperAdmin, (req, res) => {
  const { kategorie, name, url, benutzername, passwort, notizen, sort_order } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name erforderlich' });
  db.query(
    `INSERT INTO plattform_zugangsdaten (kategorie, name, url, benutzername_enc, passwort_enc, notizen, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      kategorie || 'sonstiges',
      name.trim(),
      url || null,
      safeEncrypt(benutzername),
      safeEncrypt(passwort),
      notizen || null,
      sort_order || 0,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, id: result.insertId });
    }
  );
});

// PUT /api/zugangsdaten/:id — aktualisieren
router.put('/:id', authenticateToken, requireSuperAdmin, (req, res) => {
  const { kategorie, name, url, benutzername, passwort, notizen, sort_order } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name erforderlich' });
  db.query(
    `UPDATE plattform_zugangsdaten SET kategorie=?, name=?, url=?, benutzername_enc=?, passwort_enc=?, notizen=?, sort_order=? WHERE id=?`,
    [
      kategorie || 'sonstiges',
      name.trim(),
      url || null,
      safeEncrypt(benutzername),
      safeEncrypt(passwort),
      notizen || null,
      sort_order || 0,
      req.params.id,
    ],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true });
    }
  );
});

// DELETE /api/zugangsdaten/:id
router.delete('/:id', authenticateToken, requireSuperAdmin, (req, res) => {
  db.query('DELETE FROM plattform_zugangsdaten WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;
