/**
 * dojo-einstellungen.js
 * ======================
 * Self-Service-Endpunkt für Dojo-Stammdaten und Bankverbindungen.
 * Liest und schreibt Select-Felder aus der dojos-Tabelle für das eigene Dojo.
 * Bankverbindungen werden in dojo_bankverbindungen verwaltet.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

router.use(authenticateToken);

const pool = db.promise();

// Felder die ein Dojo-Admin lesen/schreiben darf
const ALLOWED_FIELDS = [
  'dojoname', 'inhaber',
  'strasse', 'hausnummer', 'plz', 'ort',
  'telefon', 'email', 'internet',
  'steuernummer', 'ust_id', 'sepa_glaeubiger_id',
  'steuer_status', 'kleinunternehmer', 'umsatzsteuerpflichtig',
  'finanzamt_name', 'umsatzsteuer_id',
];

// ── GET / — Stammdaten laden ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const fields = ALLOWED_FIELDS.join(', ');
    const [[dojo]] = await pool.query(
      `SELECT ${fields} FROM dojo WHERE id = ? LIMIT 1`,
      [dojoId]
    );
    if (!dojo) return res.status(404).json({ error: 'Dojo nicht gefunden' });
    res.json({ success: true, dojo });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden: ' + err.message });
  }
});

// ── PUT / — Stammdaten speichern ──────────────────────────────────────────────
router.put('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const updates = {};
  for (const field of ALLOWED_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field] || null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Keine Felder zum Speichern' });
  }

  try {
    const setClauses = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    const values = [...Object.values(updates), dojoId];
    await pool.query(`UPDATE dojo SET ${setClauses} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern: ' + err.message });
  }
});

// ── GET /banken — Bankverbindungen laden ──────────────────────────────────────
router.get('/banken', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM dojo_bankverbindungen WHERE dojo_id = ? ORDER BY sort_order, id',
      [dojoId]
    );
    res.json({ success: true, banken: rows });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden: ' + err.message });
  }
});

// ── POST /banken — Bankverbindung anlegen ─────────────────────────────────────
router.post('/banken', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { bezeichnung = 'Bankverbindung', bank_name, bank_iban, bank_bic, bank_inhaber } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO dojo_bankverbindungen (dojo_id, bezeichnung, bank_name, bank_iban, bank_bic, bank_inhaber) VALUES (?, ?, ?, ?, ?, ?)',
      [dojoId, bezeichnung, bank_name || null, bank_iban || null, bank_bic || null, bank_inhaber || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Anlegen: ' + err.message });
  }
});

// ── PUT /banken/:id — Bankverbindung bearbeiten ───────────────────────────────
router.put('/banken/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { bezeichnung = 'Bankverbindung', bank_name, bank_iban, bank_bic, bank_inhaber } = req.body;

  try {
    await pool.query(
      'UPDATE dojo_bankverbindungen SET bezeichnung=?, bank_name=?, bank_iban=?, bank_bic=?, bank_inhaber=? WHERE id=? AND dojo_id=?',
      [bezeichnung, bank_name || null, bank_iban || null, bank_bic || null, bank_inhaber || null, req.params.id, dojoId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Bearbeiten: ' + err.message });
  }
});

// ── DELETE /banken/:id — Bankverbindung löschen ───────────────────────────────
router.delete('/banken/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    await pool.query(
      'DELETE FROM dojo_bankverbindungen WHERE id=? AND dojo_id=?',
      [req.params.id, dojoId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen: ' + err.message });
  }
});

module.exports = router;
