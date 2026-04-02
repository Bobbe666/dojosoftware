/**
 * vorlage-trigger.js
 * ===================
 * Automatische Trigger: senden Vorlagen automatisch bei bestimmten Ereignissen.
 * CRUD pro Dojo — Cron-Job in cron-jobs.js verarbeitet die aktiven Trigger täglich.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

router.use(authenticateToken);

const pool = db.promise();

const TRIGGER_LABELS = {
  geburtstag:             'Geburtstag (täglich)',
  mitglied_neu:           'Neues Mitglied (Eintrittsdatum)',
  zahlungsverzug_7:       'Zahlungsverzug 7 Tage',
  zahlungsverzug_14:      'Zahlungsverzug 14 Tage',
  zahlungsverzug_30:      'Zahlungsverzug 30 Tage',
  mitgliedschaft_ablauf_30: 'Mitgliedschaft läuft ab (30 Tage vorher)',
  lizenz_ablauf_30:       'Lizenz läuft ab (30 Tage vorher)',
};

// ── GET / — alle Trigger des Dojos ────────────────────────────────────────────
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [rows] = await pool.query(
      `SELECT vt.*, dv.name AS vorlage_name, dv.kategorie AS vorlage_kategorie
       FROM vorlage_trigger vt
       LEFT JOIN dokument_vorlagen dv ON vt.vorlage_id = dv.id
       WHERE vt.dojo_id = ?
       ORDER BY vt.erstellt_am DESC`,
      [dojoId]
    );
    res.json({ success: true, trigger: rows, labels: TRIGGER_LABELS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST / — Trigger anlegen ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { vorlage_id, trigger_typ, versand_art = 'email' } = req.body;
  if (!vorlage_id || !trigger_typ) return res.status(400).json({ error: 'vorlage_id und trigger_typ sind Pflicht' });
  if (!TRIGGER_LABELS[trigger_typ]) return res.status(400).json({ error: 'Ungültiger trigger_typ' });

  try {
    // Dopplung verhindern
    const [[existing]] = await pool.query(
      'SELECT id FROM vorlage_trigger WHERE dojo_id = ? AND trigger_typ = ?',
      [dojoId, trigger_typ]
    );
    if (existing) return res.status(409).json({ error: 'Für diesen Trigger existiert bereits ein Eintrag' });

    const [result] = await pool.query(
      'INSERT INTO vorlage_trigger (dojo_id, vorlage_id, trigger_typ, versand_art) VALUES (?, ?, ?, ?)',
      [dojoId, vorlage_id, trigger_typ, versand_art]
    );
    const [[row]] = await pool.query(
      `SELECT vt.*, dv.name AS vorlage_name FROM vorlage_trigger vt
       LEFT JOIN dokument_vorlagen dv ON vt.vorlage_id = dv.id WHERE vt.id = ?`,
      [result.insertId]
    );
    res.json({ success: true, trigger: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /:id — Trigger bearbeiten (Vorlage/Versandart ändern) ─────────────────
router.put('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { vorlage_id, versand_art, aktiv } = req.body;
  try {
    const updates = [];
    const params = [];
    if (vorlage_id !== undefined) { updates.push('vorlage_id = ?'); params.push(vorlage_id); }
    if (versand_art !== undefined) { updates.push('versand_art = ?'); params.push(versand_art); }
    if (aktiv !== undefined) { updates.push('aktiv = ?'); params.push(aktiv ? 1 : 0); }
    if (!updates.length) return res.status(400).json({ error: 'Keine Felder zum Ändern' });

    params.push(req.params.id, dojoId);
    const [result] = await pool.query(
      `UPDATE vorlage_trigger SET ${updates.join(', ')} WHERE id = ? AND dojo_id = ?`,
      params
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id ────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [result] = await pool.query(
      'DELETE FROM vorlage_trigger WHERE id = ? AND dojo_id = ?',
      [req.params.id, dojoId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.TRIGGER_LABELS = TRIGGER_LABELS;
