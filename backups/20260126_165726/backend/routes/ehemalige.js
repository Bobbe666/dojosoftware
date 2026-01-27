const express = require('express');
const router = express.Router();
const db = require('../db');
const { promisify } = require('util');

const queryAsync = promisify(db.query).bind(db);

// GET /api/ehemalige - Alle ehemaligen Mitglieder abrufen
router.get('/', async (req, res) => {
  try {
    const { dojo_id } = req.query;

    let query = `
      SELECT e.*
      FROM ehemalige e
      WHERE e.archiviert = FALSE
    `;

    const params = [];

    if (dojo_id && dojo_id !== 'all') {
      query += ` AND e.dojo_id = ?`;
      params.push(dojo_id);
    }

    query += ` ORDER BY e.austrittsdatum DESC, e.nachname ASC, e.vorname ASC`;

    const ehemalige = await queryAsync(query, params);
    res.json(ehemalige);
  } catch (error) {
    console.error('Fehler beim Abrufen der ehemaligen Mitglieder:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der ehemaligen Mitglieder' });
  }
});

// GET /api/ehemalige/count - Anzahl ehemalige Mitglieder
router.get('/count', async (req, res) => {
  try {
    const { dojo_id } = req.query;

    let query = `SELECT COUNT(*) as count FROM ehemalige WHERE archiviert = FALSE`;
    const params = [];

    if (dojo_id && dojo_id !== 'all') {
      query += ` AND dojo_id = ?`;
      params.push(dojo_id);
    }

    const result = await queryAsync(query, params);
    res.json({ count: result[0].count });
  } catch (error) {
    console.error('Fehler beim Zählen der ehemaligen Mitglieder:', error);
    res.status(500).json({ error: 'Fehler beim Zählen' });
  }
});

// GET /api/ehemalige/:id - Einzelnes ehemaliges Mitglied abrufen
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT e.*
      FROM ehemalige e
      WHERE e.id = ?
    `;

    const result = await queryAsync(query, [id]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Ehemaliges Mitglied nicht gefunden' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des ehemaligen Mitglieds:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen' });
  }
});

// POST /api/ehemalige - Neues ehemaliges Mitglied erstellen
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    const query = `
      INSERT INTO ehemalige (
        urspruengliches_mitglied_id, dojo_id, vorname, nachname, geburtsdatum, geschlecht,
        email, telefon, telefon_mobil, strasse, hausnummer, plz, ort,
        urspruengliches_eintrittsdatum, austrittsdatum, austrittsgrund, letzter_tarif,
        letzter_guertel, letzter_stil, notizen, wiederaufnahme_moeglich, wiederaufnahme_gesperrt_bis
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.urspruengliches_mitglied_id || null,
      data.dojo_id,
      data.vorname,
      data.nachname,
      data.geburtsdatum || null,
      data.geschlecht || null,
      data.email || null,
      data.telefon || null,
      data.telefon_mobil || null,
      data.strasse || null,
      data.hausnummer || null,
      data.plz || null,
      data.ort || null,
      data.urspruengliches_eintrittsdatum || null,
      data.austrittsdatum || null,
      data.austrittsgrund || null,
      data.letzter_tarif || null,
      data.letzter_guertel || null,
      data.letzter_stil || null,
      data.notizen || null,
      data.wiederaufnahme_moeglich !== undefined ? data.wiederaufnahme_moeglich : true,
      data.wiederaufnahme_gesperrt_bis || null
    ];

    const result = await queryAsync(query, values);
    res.status(201).json({ id: result.insertId, message: 'Ehemaliges Mitglied erfolgreich erstellt' });
  } catch (error) {
    console.error('Fehler beim Erstellen des ehemaligen Mitglieds:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

// PUT /api/ehemalige/:id - Ehemaliges Mitglied aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const query = `
      UPDATE ehemalige SET
        vorname = ?, nachname = ?, geburtsdatum = ?, geschlecht = ?,
        email = ?, telefon = ?, telefon_mobil = ?, strasse = ?, hausnummer = ?, plz = ?, ort = ?,
        austrittsdatum = ?, austrittsgrund = ?, letzter_tarif = ?,
        letzter_guertel = ?, letzter_stil = ?, notizen = ?,
        wiederaufnahme_moeglich = ?, wiederaufnahme_gesperrt_bis = ?
      WHERE id = ?
    `;

    const values = [
      data.vorname,
      data.nachname,
      data.geburtsdatum || null,
      data.geschlecht || null,
      data.email || null,
      data.telefon || null,
      data.telefon_mobil || null,
      data.strasse || null,
      data.hausnummer || null,
      data.plz || null,
      data.ort || null,
      data.austrittsdatum || null,
      data.austrittsgrund || null,
      data.letzter_tarif || null,
      data.letzter_guertel || null,
      data.letzter_stil || null,
      data.notizen || null,
      data.wiederaufnahme_moeglich,
      data.wiederaufnahme_gesperrt_bis || null,
      id
    ];

    await queryAsync(query, values);
    res.json({ message: 'Ehemaliges Mitglied erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des ehemaligen Mitglieds:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// DELETE /api/ehemalige/:id - Ehemaliges Mitglied archivieren (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `UPDATE ehemalige SET archiviert = TRUE WHERE id = ?`;
    await queryAsync(query, [id]);

    res.json({ message: 'Ehemaliges Mitglied erfolgreich archiviert' });
  } catch (error) {
    console.error('Fehler beim Archivieren des ehemaligen Mitglieds:', error);
    res.status(500).json({ error: 'Fehler beim Archivieren' });
  }
});

module.exports = router;
