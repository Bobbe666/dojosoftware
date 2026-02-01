/**
 * Archiv Routes für Mitglieder
 * Extrahiert aus mitglieder.js - enthält Archivierungs-Endpoints
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

// GET /archiv - Archivierte Mitglieder abrufen (MUSS VOR /:id!)
router.get('/archiv', (req, res) => {
  const { dojo_id, limit = 100, offset = 0 } = req.query;

  let whereClause = '';
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereClause = 'WHERE dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT * FROM v_archiv_mitglieder_uebersicht
    ${whereClause}
    LIMIT ? OFFSET ?
  `;

  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen archivierter Mitglieder:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen des Archivs' });
    }
    res.json({ success: true, count: results.length, archivierte_mitglieder: results });
  });
});

// GET /archiv/:archivId - Archiv-Details abrufen
router.get('/archiv/:archivId', (req, res) => {
  const archivId = parseInt(req.params.archivId);

  db.query('SELECT * FROM archiv_mitglieder WHERE archiv_id = ?', [archivId], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Archiv-Eintrags:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen des Archiv-Eintrags' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Archiv-Eintrag nicht gefunden' });
    }

    const archiv = results[0];
    // Parse JSON-Felder
    ['stil_daten', 'sepa_mandate', 'pruefungen'].forEach(field => {
      if (archiv[field] && typeof archiv[field] === 'string') {
        archiv[field] = JSON.parse(archiv[field]);
      }
    });

    res.json({ success: true, archiv });
  });
});

// POST /:id/archivieren - Mitglied archivieren
router.post('/:id/archivieren', async (req, res) => {
  const mitgliedId = parseInt(req.params.id);
  const { grund, archiviert_von } = req.body;

  logger.debug(`Archivierung von Mitglied ${mitgliedId} gestartet...`);

  try {
    await db.promise().query('START TRANSACTION');

    // 1. Hole Mitgliedsdaten
    const [mitgliedRows] = await db.promise().query('SELECT * FROM mitglieder WHERE mitglied_id = ?', [mitgliedId]);
    if (mitgliedRows.length === 0) {
      await db.promise().query('ROLLBACK');
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }
    const mitglied = mitgliedRows[0];

    // 2. Hole zugehörige Daten
    const [stilData] = await db.promise().query(
      `SELECT msd.*, s.name as stil_name FROM mitglied_stil_data msd
       LEFT JOIN stile s ON msd.stil_id = s.stil_id WHERE msd.mitglied_id = ?`, [mitgliedId]);
    const [sepaMandate] = await db.promise().query('SELECT * FROM sepa_mandate WHERE mitglied_id = ?', [mitgliedId]);
    const [pruefungen] = await db.promise().query('SELECT * FROM pruefungen WHERE mitglied_id = ?', [mitgliedId]);
    const [userData] = await db.promise().query('SELECT * FROM users WHERE mitglied_id = ?', [mitgliedId]);

    let userDataForArchive = null;
    if (userData.length > 0) {
      const user = { ...userData[0] };
      delete user.password;
      userDataForArchive = user;
    }

    // 3. Archiv-Eintrag erstellen
    const [archivResult] = await db.promise().query(`
      INSERT INTO archiv_mitglieder (
        mitglied_id, dojo_id, vorname, nachname, geburtsdatum, strasse, plz, ort, land,
        telefon, email, eintrittsdatum, status, notizen, foto_pfad,
        stil_daten, sepa_mandate, pruefungen, user_daten,
        archiviert_am, archiviert_von, archivierungsgrund
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [mitglied.mitglied_id, mitglied.dojo_id, mitglied.vorname, mitglied.nachname,
       mitglied.geburtsdatum, mitglied.strasse, mitglied.plz, mitglied.ort, mitglied.land || 'Deutschland',
       mitglied.telefon, mitglied.email, mitglied.eintrittsdatum, mitglied.status, mitglied.notizen, mitglied.foto_pfad,
       JSON.stringify(stilData), JSON.stringify(sepaMandate), JSON.stringify(pruefungen),
       userDataForArchive ? JSON.stringify(userDataForArchive) : null,
       archiviert_von || null, grund || 'Mitglied archiviert']);

    const archivId = archivResult.insertId;

    // 4. Login löschen
    if (userData.length > 0) {
      await db.promise().query('DELETE FROM users WHERE mitglied_id = ?', [mitgliedId]);
    }

    // 5. Abhängige Daten löschen
    const tablesToDelete = [
      'fortschritt_updates', 'mitglieder_meilensteine', 'trainings_notizen', 'pruefung_teilnehmer',
      'event_anmeldungen', 'gruppen_mitglieder', 'verkaeufe', 'gesetzlicher_vertreter', 'beitraege',
      'anwesenheit', 'anwesenheit_protokoll', 'checkins', 'pruefungen', 'mitglieder_fortschritt',
      'stripe_payment_intents', 'mitglied_stil_data', 'mitglied_stile', 'mitglieder_ziele',
      'kurs_bewertungen', 'payment_provider_logs', 'mitglieder_dokumente', 'sepa_mandate'
    ];
    for (const table of tablesToDelete) {
      try {
        await db.promise().query(`DELETE FROM ${table} WHERE mitglied_id = ?`, [mitgliedId]);
      } catch (e) { /* Table might not exist */ }
    }

    // 6. Mitglied deaktivieren (nicht löschen wegen Rechnungen)
    await db.promise().query('UPDATE mitglieder SET aktiv = 0, gekuendigt_am = NOW() WHERE mitglied_id = ?', [mitgliedId]);

    await db.promise().query('COMMIT');
    logger.info(`Mitglied ${mitgliedId} erfolgreich archiviert`);

    res.json({
      success: true,
      message: 'Mitglied erfolgreich archiviert',
      archivId,
      mitglied: { id: mitglied.mitglied_id, name: `${mitglied.vorname} ${mitglied.nachname}` }
    });

  } catch (error) {
    await db.promise().query('ROLLBACK');
    logger.error('Fehler beim Archivieren:', error);
    res.status(500).json({ error: 'Fehler beim Archivieren des Mitglieds', details: error.message });
  }
});

// POST /bulk-archivieren - Mehrere Mitglieder archivieren
router.post('/bulk-archivieren', async (req, res) => {
  const { mitglied_ids, grund, archiviert_von } = req.body;

  if (!mitglied_ids || !Array.isArray(mitglied_ids) || mitglied_ids.length === 0) {
    return res.status(400).json({ error: 'Keine Mitglieds-IDs angegeben' });
  }

  logger.debug(`Bulk-Archivierung von ${mitglied_ids.length} Mitgliedern gestartet...`);

  const results = { success: [], failed: [] };

  for (const mitgliedId of mitglied_ids) {
    try {
      await db.promise().query('START TRANSACTION');

      const [mitgliedRows] = await db.promise().query('SELECT * FROM mitglieder WHERE mitglied_id = ?', [mitgliedId]);
      if (mitgliedRows.length === 0) {
        await db.promise().query('ROLLBACK');
        results.failed.push({ mitglied_id: mitgliedId, error: 'Nicht gefunden' });
        continue;
      }

      const mitglied = mitgliedRows[0];
      const [stilData] = await db.promise().query('SELECT * FROM mitglied_stil_data WHERE mitglied_id = ?', [mitgliedId]);
      const [sepaMandate] = await db.promise().query('SELECT * FROM sepa_mandate WHERE mitglied_id = ?', [mitgliedId]);
      const [pruefungen] = await db.promise().query('SELECT * FROM pruefungen WHERE mitglied_id = ?', [mitgliedId]);

      const [archivResult] = await db.promise().query(`
        INSERT INTO archiv_mitglieder (mitglied_id, dojo_id, vorname, nachname, geburtsdatum,
          strasse, plz, ort, email, stil_daten, sepa_mandate, pruefungen,
          archiviert_am, archiviert_von, archivierungsgrund)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
        [mitglied.mitglied_id, mitglied.dojo_id, mitglied.vorname, mitglied.nachname,
         mitglied.geburtsdatum, mitglied.strasse, mitglied.plz, mitglied.ort, mitglied.email,
         JSON.stringify(stilData), JSON.stringify(sepaMandate), JSON.stringify(pruefungen),
         archiviert_von || null, grund || 'Bulk archiviert']);

      await db.promise().query('DELETE FROM users WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('UPDATE mitglieder SET aktiv = 0, gekuendigt_am = NOW() WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('COMMIT');

      results.success.push({ mitglied_id: mitgliedId, name: `${mitglied.vorname} ${mitglied.nachname}`, archiv_id: archivResult.insertId });

    } catch (error) {
      await db.promise().query('ROLLBACK');
      results.failed.push({ mitglied_id: mitgliedId, error: error.message });
    }
  }

  res.json({
    success: true,
    message: `${results.success.length} von ${mitglied_ids.length} Mitgliedern archiviert`,
    results
  });
});

module.exports = router;
