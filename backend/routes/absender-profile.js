/**
 * Absender-Profile Routes
 * ========================
 * Verwaltet Briefkopf-Profile für Dojo, Verband und Lizenzen.
 * Jedes Profil hat eigene Kontaktdaten, Bankdaten und Primärfarbe.
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

router.use(authenticateToken);

const pool = db.promise();

// ── GET / — Alle Profile des Dojos ───────────────────────────────────────────
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM absender_profile WHERE dojo_id = ? AND aktiv = 1 ORDER BY typ, name',
      [dojoId]
    );
    res.json({ success: true, profile: rows });
  } catch (err) {
    logger.error('Absender-Profile laden:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// ── POST / — Neues Profil anlegen ────────────────────────────────────────────
router.post('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const {
    typ = 'dojo', name, organisation, inhaber,
    strasse, hausnummer, plz, ort, land,
    telefon, email, internet,
    bank_name, bank_iban, bank_bic, bank_inhaber,
    logo_url, farbe_primaer
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Name ist Pflichtfeld' });

  try {
    const [result] = await pool.query(
      `INSERT INTO absender_profile
        (dojo_id, typ, name, organisation, inhaber, strasse, hausnummer, plz, ort, land,
         telefon, email, internet, bank_name, bank_iban, bank_bic, bank_inhaber, logo_url, farbe_primaer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, typ, name, organisation || null, inhaber || null,
       strasse || null, hausnummer || null, plz || null, ort || null, land || 'Deutschland',
       telefon || null, email || null, internet || null,
       bank_name || null, bank_iban || null, bank_bic || null, bank_inhaber || null,
       logo_url || null, farbe_primaer || (typ === 'dojo' ? '#8B0000' : '#c9a227')]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    logger.error('Absender-Profil anlegen:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Anlegen' });
  }
});

// ── PUT /:id — Profil bearbeiten ──────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { id } = req.params;
  const fields = ['typ', 'name', 'organisation', 'inhaber', 'strasse', 'hausnummer', 'plz', 'ort', 'land',
    'telefon', 'email', 'internet', 'bank_name', 'bank_iban', 'bank_bic', 'bank_inhaber', 'logo_url', 'farbe_primaer'];

  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] || null; });

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });

  try {
    const setClauses = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    const values = [...Object.values(updates), id, dojoId];
    await pool.query(`UPDATE absender_profile SET ${setClauses} WHERE id = ? AND dojo_id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    logger.error('Absender-Profil bearbeiten:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Bearbeiten' });
  }
});

// ── DELETE /:id — Profil löschen ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    await pool.query('UPDATE absender_profile SET aktiv = 0 WHERE id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ── POST /aus-dojo-einstellungen — Profil aus Dojo-Tabelle befüllen ───────────
router.post('/aus-dojo-einstellungen', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [[dojo]] = await pool.query('SELECT * FROM dojo WHERE id = ? LIMIT 1', [dojoId]);
    if (!dojo) return res.status(404).json({ error: 'Dojo nicht gefunden' });

    const typ = req.body.typ || 'dojo';
    const [result] = await pool.query(
      `INSERT INTO absender_profile
        (dojo_id, typ, name, organisation, inhaber, strasse, hausnummer, plz, ort,
         telefon, email, internet, bank_name, bank_iban, bank_bic, bank_inhaber, farbe_primaer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, typ,
       dojo.dojoname || 'Mein Dojo',
       dojo.dojoname || null,
       dojo.inhaber || null,
       dojo.strasse || null,
       dojo.hausnummer || null,
       dojo.plz || null,
       dojo.ort || null,
       dojo.telefon || null,
       dojo.email || null,
       dojo.internet || null,
       dojo.bank_name || null,
       dojo.bank_iban || null,
       dojo.bank_bic || null,
       dojo.bank_inhaber || null,
       typ === 'dojo' ? '#8B0000' : '#c9a227'
      ]
    );
    res.json({ success: true, id: result.insertId, message: 'Profil aus Dojo-Einstellungen erstellt' });
  } catch (err) {
    logger.error('Profil aus Dojo laden:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

module.exports = router;
