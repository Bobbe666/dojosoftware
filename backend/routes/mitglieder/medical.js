/**
 * Medical Routes für Mitglieder
 * Extrahiert aus mitglieder.js - enthält medizinische, Prüfungs- und Compliance-Endpoints
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

// GET /compliance/missing - Mitglieder mit fehlenden Dokumenten (MUSS VOR /:id!)
router.get('/compliance/missing', (req, res) => {
  const { dojo_id } = req.query;

  let whereConditions = [
    'aktiv = 1',
    '(hausordnung_akzeptiert = FALSE OR datenschutz_akzeptiert = FALSE OR foto_einverstaendnis = FALSE OR vereinsordnung_datum IS NULL)'
  ];
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT mitglied_id, vorname, nachname, email, dojo_id,
           hausordnung_akzeptiert, datenschutz_akzeptiert, foto_einverstaendnis,
           vereinsordnung_datum, eintrittsdatum
    FROM mitglieder
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY eintrittsdatum DESC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen fehlender Compliance-Daten:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen fehlender Compliance-Daten' });
    }
    res.json({ success: true, count: results.length, missing_compliance: results });
  });
});

// GET /pruefung/kandidaten - Prüfungskandidaten (nächste 30 Tage) (MUSS VOR /:id!)
router.get('/pruefung/kandidaten', (req, res) => {
  const { dojo_id } = req.query;

  let whereConditions = [
    'aktiv = 1',
    'naechste_pruefung_datum IS NOT NULL',
    'naechste_pruefung_datum <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)'
  ];
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT mitglied_id, vorname, nachname, dojo_id, gurtfarbe,
           naechste_pruefung_datum, pruefungsgebuehr_bezahlt, trainer_empfehlung,
           eintrittsdatum, DATEDIFF(naechste_pruefung_datum, CURDATE()) as tage_bis_pruefung
    FROM mitglieder
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY naechste_pruefung_datum ASC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Prüfungskandidaten:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Prüfungskandidaten' });
    }
    res.json({ success: true, count: results.length, pruefungskandidaten: results });
  });
});

// GET /:id/medizinisch - Medizinische Informationen abrufen
router.get('/:id/medizinisch', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { dojo_id } = req.query;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  let whereConditions = ['mitglied_id = ?'];
  let queryParams = [id];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT mitglied_id, vorname, nachname, dojo_id, allergien, medizinische_hinweise,
           notfallkontakt_name, notfallkontakt_telefon, notfallkontakt_verhaeltnis
    FROM mitglieder
    WHERE ${whereConditions.join(' AND ')}
  `;

  db.query(query, queryParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Abrufen medizinischer Daten:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen medizinischer Daten' });
    }
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
    }
    res.json(result[0]);
  });
});

// PUT /:id/medizinisch - Medizinische Daten aktualisieren
router.put('/:id/medizinisch', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { dojo_id } = req.query;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  const { allergien, medizinische_hinweise, notfallkontakt_name, notfallkontakt_telefon, notfallkontakt_verhaeltnis } = req.body;

  let whereConditions = ['mitglied_id = ?'];
  let queryParams = [
    allergien || null, medizinische_hinweise || null, notfallkontakt_name || null,
    notfallkontakt_telefon || null, notfallkontakt_verhaeltnis || null, id
  ];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    UPDATE mitglieder
    SET allergien = ?, medizinische_hinweise = ?, notfallkontakt_name = ?,
        notfallkontakt_telefon = ?, notfallkontakt_verhaeltnis = ?
    WHERE ${whereConditions.join(' AND ')}
  `;

  db.query(query, queryParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Update medizinischer Daten:', err);
      return res.status(500).json({ error: 'Fehler beim Aktualisieren medizinischer Daten' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
    }
    res.json({ success: true, message: 'Medizinische Daten erfolgreich aktualisiert',
      updated_fields: { allergien, medizinische_hinweise, notfallkontakt_name, notfallkontakt_telefon, notfallkontakt_verhaeltnis }
    });
  });
});

// GET /:id/pruefung - Prüfungsstatus abrufen
router.get('/:id/pruefung', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { dojo_id } = req.query;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  let whereConditions = ['mitglied_id = ?'];
  let queryParams = [id];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT mitglied_id, vorname, nachname, dojo_id, gurtfarbe,
           naechste_pruefung_datum, pruefungsgebuehr_bezahlt, trainer_empfehlung, eintrittsdatum
    FROM mitglieder
    WHERE ${whereConditions.join(' AND ')}
  `;

  db.query(query, queryParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Prüfungsdaten:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Prüfungsdaten' });
    }
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
    }
    res.json(result[0]);
  });
});

// PUT /:id/pruefung - Prüfungsdaten aktualisieren
router.put('/:id/pruefung', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { dojo_id } = req.query;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  const { naechste_pruefung_datum, pruefungsgebuehr_bezahlt, trainer_empfehlung } = req.body;

  let whereConditions = ['mitglied_id = ?'];
  let queryParams = [naechste_pruefung_datum || null, pruefungsgebuehr_bezahlt || false, trainer_empfehlung || null, id];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    UPDATE mitglieder
    SET naechste_pruefung_datum = ?, pruefungsgebuehr_bezahlt = ?, trainer_empfehlung = ?
    WHERE ${whereConditions.join(' AND ')}
  `;

  db.query(query, queryParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Update der Prüfungsdaten:', err);
      return res.status(500).json({ error: 'Fehler beim Aktualisieren der Prüfungsdaten' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
    }
    res.json({ success: true, message: 'Prüfungsdaten erfolgreich aktualisiert',
      updated_fields: { naechste_pruefung_datum, pruefungsgebuehr_bezahlt, trainer_empfehlung }
    });
  });
});

// GET /:id/compliance - Compliance-Status abrufen
router.get('/:id/compliance', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { dojo_id } = req.query;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  let whereConditions = ['mitglied_id = ?'];
  let queryParams = [id];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT mitglied_id, vorname, nachname, dojo_id,
           hausordnung_akzeptiert, datenschutz_akzeptiert, foto_einverstaendnis, vereinsordnung_datum
    FROM mitglieder
    WHERE ${whereConditions.join(' AND ')}
  `;

  db.query(query, queryParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Compliance-Daten:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Compliance-Daten' });
    }
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
    }
    res.json(result[0]);
  });
});

// PUT /:id/compliance - Compliance-Status aktualisieren
router.put('/:id/compliance', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { dojo_id } = req.query;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  const { hausordnung_akzeptiert, datenschutz_akzeptiert, foto_einverstaendnis, vereinsordnung_datum } = req.body;

  let whereConditions = ['mitglied_id = ?'];
  let queryParams = [hausordnung_akzeptiert || false, datenschutz_akzeptiert || false, foto_einverstaendnis || false, vereinsordnung_datum || null, id];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    UPDATE mitglieder
    SET hausordnung_akzeptiert = ?, datenschutz_akzeptiert = ?, foto_einverstaendnis = ?, vereinsordnung_datum = ?
    WHERE ${whereConditions.join(' AND ')}
  `;

  db.query(query, queryParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Update des Compliance-Status:', err);
      return res.status(500).json({ error: 'Fehler beim Aktualisieren des Compliance-Status' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
    }
    res.json({ success: true, message: 'Compliance-Status erfolgreich aktualisiert',
      updated_fields: { hausordnung_akzeptiert, datenschutz_akzeptiert, foto_einverstaendnis, vereinsordnung_datum }
    });
  });
});

module.exports = router;
