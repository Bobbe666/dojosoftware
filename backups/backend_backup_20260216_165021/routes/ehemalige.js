const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { promisify } = require('util');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const { authenticateToken } = require('../middleware/auth');

const queryAsync = promisify(db.query).bind(db);

// Alle Routes in dieser Datei erfordern Authentifizierung
router.use(authenticateToken);

// GET /api/ehemalige - Alle ehemaligen Mitglieder abrufen (mit Pagination)
router.get('/', async (req, res) => {
  try {
    // 🔒 SICHER: Verwende getSecureDojoId statt req.query.dojo_id
    const secureDojoId = getSecureDojoId(req);
    const { page = 1, limit = 50, search } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    let baseWhere = `WHERE e.archiviert = FALSE`;
    const params = [];

    if (secureDojoId) {
      baseWhere += ` AND e.dojo_id = ?`;
      params.push(secureDojoId);
    }

    // Suchfunktion
    if (search && search.trim()) {
      baseWhere += ` AND (e.vorname LIKE ? OR e.nachname LIKE ? OR e.email LIKE ? OR CONCAT(e.vorname, ' ', e.nachname) LIKE ?)`;
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Zähle Gesamtanzahl
    const countQuery = `SELECT COUNT(*) as total FROM ehemalige e ${baseWhere}`;
    const countResult = await queryAsync(countQuery, params);
    const total = countResult[0].total;

    // Hole paginierte Daten
    const dataQuery = `
      SELECT e.*
      FROM ehemalige e
      ${baseWhere}
      ORDER BY e.austrittsdatum DESC, e.nachname ASC, e.vorname ASC
      LIMIT ? OFFSET ?
    `;

    const ehemalige = await queryAsync(dataQuery, [...params, limitNum, offset]);

    res.json({
      data: ehemalige,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen der ehemaligen Mitglieder:', { error: error });
    res.status(500).json({ error: 'Fehler beim Abrufen der ehemaligen Mitglieder' });
  }
});

// GET /api/ehemalige/count - Anzahl ehemalige Mitglieder
router.get('/count', async (req, res) => {
  try {
    // 🔒 SICHER: Verwende getSecureDojoId statt req.query.dojo_id
    const secureDojoId = getSecureDojoId(req);

    let query = `SELECT COUNT(*) as count FROM ehemalige WHERE archiviert = FALSE`;
    const params = [];

    if (secureDojoId) {
      query += ` AND dojo_id = ?`;
      params.push(secureDojoId);
    }

    const result = await queryAsync(query, params);
    res.json({ count: result[0].count });
  } catch (error) {
    logger.error('Fehler beim Zählen der ehemaligen Mitglieder:', { error: error });
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
    logger.error('Fehler beim Abrufen des ehemaligen Mitglieds:', { error: error });
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
    logger.error('Fehler beim Erstellen des ehemaligen Mitglieds:', { error: error });
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
    logger.error('Fehler beim Aktualisieren des ehemaligen Mitglieds:', { error: error });
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
    logger.error('Fehler beim Archivieren des ehemaligen Mitglieds:', { error: error });
    res.status(500).json({ error: 'Fehler beim Archivieren' });
  }
});

module.exports = router;
