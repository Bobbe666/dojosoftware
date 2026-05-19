const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

// GET /sonder-aktionen — Liste
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });

  const nurAktive = req.query.aktiv === '1';
  const conditions = ['dojo_id = ?'];
  const params = [dojoId];

  if (nurAktive) {
    conditions.push('aktiv = 1');
    conditions.push('(gueltig_von IS NULL OR gueltig_von <= CURDATE())');
    conditions.push('(gueltig_bis IS NULL OR gueltig_bis >= CURDATE())');
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM sonder_aktionen WHERE ${conditions.join(' AND ')} ORDER BY erstellt_am DESC`,
      params
    );
    res.json({ success: true, aktionen: rows });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /sonder-aktionen — Anlegen
router.post('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });

  const {
    name, beschreibung, typ, wert,
    gueltig_von, gueltig_bis,
    aktiv = 1, marketing_steuerbar = 1,
    tarif_ids, code, max_einloesungen
  } = req.body;

  if (!name || !typ || wert == null) return res.status(400).json({ error: 'Name, Typ und Wert sind Pflichtfelder' });

  try {
    const [result] = await pool.query(
      `INSERT INTO sonder_aktionen
        (dojo_id, name, beschreibung, typ, wert, gueltig_von, gueltig_bis,
         aktiv, marketing_steuerbar, tarif_ids, code, max_einloesungen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dojoId, name, beschreibung || null, typ, wert,
        gueltig_von || null, gueltig_bis || null,
        aktiv ? 1 : 0, marketing_steuerbar ? 1 : 0,
        tarif_ids ? JSON.stringify(tarif_ids) : null,
        code || null, max_einloesungen || null
      ]
    );
    const [rows] = await pool.query('SELECT * FROM sonder_aktionen WHERE id = ?', [result.insertId]);
    res.json({ success: true, aktion: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Anlegen' });
  }
});

// PUT /sonder-aktionen/:id — Bearbeiten
router.put('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });

  const id = parseInt(req.params.id, 10);
  const {
    name, beschreibung, typ, wert,
    gueltig_von, gueltig_bis,
    aktiv, marketing_steuerbar,
    tarif_ids, code, max_einloesungen
  } = req.body;

  try {
    await pool.query(
      `UPDATE sonder_aktionen
       SET name=?, beschreibung=?, typ=?, wert=?,
           gueltig_von=?, gueltig_bis=?,
           aktiv=?, marketing_steuerbar=?,
           tarif_ids=?, code=?, max_einloesungen=?
       WHERE id=? AND dojo_id=?`,
      [
        name, beschreibung || null, typ, wert,
        gueltig_von || null, gueltig_bis || null,
        aktiv ? 1 : 0, marketing_steuerbar ? 1 : 0,
        tarif_ids ? JSON.stringify(tarif_ids) : null,
        code || null, max_einloesungen || null,
        id, dojoId
      ]
    );
    const [rows] = await pool.query('SELECT * FROM sonder_aktionen WHERE id = ? AND dojo_id = ?', [id, dojoId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true, aktion: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// PATCH /sonder-aktionen/:id/toggle — aktiv an/abschalten
router.patch('/:id/toggle', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });

  const id = parseInt(req.params.id, 10);
  try {
    await pool.query(
      'UPDATE sonder_aktionen SET aktiv = NOT aktiv WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );
    const [rows] = await pool.query('SELECT * FROM sonder_aktionen WHERE id = ? AND dojo_id = ?', [id, dojoId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true, aktion: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Umschalten' });
  }
});

// DELETE /sonder-aktionen/:id
router.delete('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });

  const id = parseInt(req.params.id, 10);
  try {
    const [result] = await pool.query(
      'DELETE FROM sonder_aktionen WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// POST /sonder-aktionen/:id/einloesen — Zähler erhöhen
router.post('/:id/einloesen', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });

  const id = parseInt(req.params.id, 10);
  try {
    const [rows] = await pool.query(
      'SELECT * FROM sonder_aktionen WHERE id = ? AND dojo_id = ? AND aktiv = 1',
      [id, dojoId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Aktion nicht verfügbar' });
    const aktion = rows[0];
    if (aktion.max_einloesungen && aktion.einloesungen_count >= aktion.max_einloesungen) {
      return res.status(409).json({ error: 'Maximale Einlösungen erreicht' });
    }
    await pool.query(
      'UPDATE sonder_aktionen SET einloesungen_count = einloesungen_count + 1 WHERE id = ?',
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Einlösen' });
  }
});

module.exports = router;
