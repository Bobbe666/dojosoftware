const express = require('express');
const router = express.Router();
const db = require('../db');
const { promisify } = require('util');

const queryAsync = promisify(db.query).bind(db);

// GET /api/interessenten - Alle Interessenten abrufen
router.get('/', async (req, res) => {
  try {
    const { dojo_id, status } = req.query;

    let query = `
      SELECT i.*
      FROM interessenten i
      WHERE i.archiviert = FALSE
    `;

    const params = [];

    if (dojo_id && dojo_id !== 'all') {
      query += ` AND i.dojo_id = ?`;
      params.push(dojo_id);
    }

    if (status) {
      query += ` AND i.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY i.prioritaet DESC, i.naechster_kontakt_datum ASC, i.erstellt_am DESC`;

    const interessenten = await queryAsync(query, params);
    res.json(interessenten);
  } catch (error) {
    console.error('Fehler beim Abrufen der Interessenten:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Interessenten' });
  }
});

// GET /api/interessenten/count - Anzahl Interessenten
router.get('/count', async (req, res) => {
  try {
    const { dojo_id } = req.query;

    let query = `SELECT COUNT(*) as count FROM interessenten WHERE archiviert = FALSE`;
    const params = [];

    if (dojo_id && dojo_id !== 'all') {
      query += ` AND dojo_id = ?`;
      params.push(dojo_id);
    }

    const result = await queryAsync(query, params);
    res.json({ count: result[0].count });
  } catch (error) {
    console.error('Fehler beim Zählen der Interessenten:', error);
    res.status(500).json({ error: 'Fehler beim Zählen' });
  }
});

// GET /api/interessenten/:id - Einzelnen Interessenten abrufen
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT i.*
      FROM interessenten i
      WHERE i.id = ?
    `;

    const result = await queryAsync(query, [id]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Interessent nicht gefunden' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Interessenten:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen' });
  }
});

// POST /api/interessenten - Neuen Interessenten erstellen
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    const query = `
      INSERT INTO interessenten (
        dojo_id, vorname, nachname, geburtsdatum, \`alter\`,
        email, telefon, telefon_mobil, strasse, hausnummer, plz, ort,
        interessiert_an, erfahrung, gewuenschter_tarif,
        erstkontakt_datum, erstkontakt_quelle, letzter_kontakt_datum, naechster_kontakt_datum,
        status, probetraining_datum, prioritaet, notizen,
        newsletter_angemeldet, datenschutz_akzeptiert, zustaendig_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.dojo_id,
      data.vorname,
      data.nachname,
      data.geburtsdatum || null,
      data.alter || null,
      data.email || null,
      data.telefon || null,
      data.telefon_mobil || null,
      data.strasse || null,
      data.hausnummer || null,
      data.plz || null,
      data.ort || null,
      data.interessiert_an || null,
      data.erfahrung || null,
      data.gewuenschter_tarif || null,
      data.erstkontakt_datum || new Date(),
      data.erstkontakt_quelle || null,
      data.letzter_kontakt_datum || null,
      data.naechster_kontakt_datum || null,
      data.status || 'neu',
      data.probetraining_datum || null,
      data.prioritaet || 'mittel',
      data.notizen || null,
      data.newsletter_angemeldet || false,
      data.datenschutz_akzeptiert || false,
      data.zustaendig_user_id || null
    ];

    const result = await queryAsync(query, values);
    res.status(201).json({ id: result.insertId, message: 'Interessent erfolgreich erstellt' });
  } catch (error) {
    console.error('Fehler beim Erstellen des Interessenten:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

// PUT /api/interessenten/:id - Interessenten aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const query = `
      UPDATE interessenten SET
        vorname = ?, nachname = ?, geburtsdatum = ?, \`alter\` = ?,
        email = ?, telefon = ?, telefon_mobil = ?, strasse = ?, hausnummer = ?, plz = ?, ort = ?,
        interessiert_an = ?, erfahrung = ?, gewuenschter_tarif = ?,
        letzter_kontakt_datum = ?, naechster_kontakt_datum = ?,
        status = ?, probetraining_datum = ?, probetraining_absolviert = ?, probetraining_feedback = ?,
        prioritaet = ?, notizen = ?, newsletter_angemeldet = ?,
        zustaendig_user_id = ?
      WHERE id = ?
    `;

    const values = [
      data.vorname,
      data.nachname,
      data.geburtsdatum || null,
      data.alter || null,
      data.email || null,
      data.telefon || null,
      data.telefon_mobil || null,
      data.strasse || null,
      data.hausnummer || null,
      data.plz || null,
      data.ort || null,
      data.interessiert_an || null,
      data.erfahrung || null,
      data.gewuenschter_tarif || null,
      data.letzter_kontakt_datum || null,
      data.naechster_kontakt_datum || null,
      data.status,
      data.probetraining_datum || null,
      data.probetraining_absolviert || false,
      data.probetraining_feedback || null,
      data.prioritaet,
      data.notizen || null,
      data.newsletter_angemeldet || false,
      data.zustaendig_user_id || null,
      id
    ];

    await queryAsync(query, values);
    res.json({ message: 'Interessent erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Interessenten:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// PATCH /api/interessenten/:id/konvertieren - Interessenten zu Mitglied konvertieren
router.patch('/:id/konvertieren', async (req, res) => {
  try {
    const { id } = req.params;
    const { mitglied_id } = req.body;

    const query = `
      UPDATE interessenten SET
        status = 'konvertiert',
        konvertiert_zu_mitglied_id = ?,
        konvertiert_am = NOW()
      WHERE id = ?
    `;

    await queryAsync(query, [mitglied_id, id]);
    res.json({ message: 'Interessent erfolgreich zu Mitglied konvertiert' });
  } catch (error) {
    console.error('Fehler beim Konvertieren des Interessenten:', error);
    res.status(500).json({ error: 'Fehler beim Konvertieren' });
  }
});

// DELETE /api/interessenten/:id - Interessenten archivieren (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { grund } = req.body;

    const query = `UPDATE interessenten SET archiviert = TRUE, archiviert_grund = ? WHERE id = ?`;
    await queryAsync(query, [grund || null, id]);

    res.json({ message: 'Interessent erfolgreich archiviert' });
  } catch (error) {
    console.error('Fehler beim Archivieren des Interessenten:', error);
    res.status(500).json({ error: 'Fehler beim Archivieren' });
  }
});

module.exports = router;
