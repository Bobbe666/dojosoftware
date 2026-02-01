/**
 * CRUD Routes für Mitglieder
 * Extrahiert aus mitglieder.js - enthält Haupt-CRUD-Endpoints
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const bcrypt = require('bcryptjs');
const auditLog = require('../../services/auditLogService');
const { requireFields, validateId, sanitizeStrings } = require('../../middleware/validation');
const router = express.Router();

// GET / - Mitglieder mit optionalem Stil-Filter
router.get('/', (req, res) => {
  let { stil, dojo_id } = req.query;

  if (req.user && req.user.dojo_id) {
    dojo_id = req.user.dojo_id.toString();
  }

  let whereConditions = ['m.aktiv = 1'];
  let queryParams = [];

  if (stil) {
    whereConditions.push('ms.stil = ?');
    queryParams.push(stil);
  }

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  if (stil) {
    const query = `
      SELECT DISTINCT m.mitglied_id, m.vorname, m.nachname, m.strasse as adresse, m.hausnummer, m.plz, m.ort, m.email, m.telefon_mobil, m.foto_pfad
      FROM mitglieder m
      JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
      ${whereClause}
      ORDER BY m.nachname, m.vorname
    `;

    db.query(query, queryParams, (err, results) => {
      if (err) {
        logger.error('Fehler beim Filtern der Mitglieder:', err);
        return res.status(500).json({ error: 'Fehler beim Filtern der Mitglieder' });
      }
      res.json(results);
    });
  } else {
    const query = `
      SELECT mitglied_id, vorname, nachname, strasse as adresse, hausnummer, plz, ort, email, telefon_mobil, foto_pfad
      FROM mitglieder m
      ${whereClause}
      ORDER BY nachname, vorname
    `;

    db.query(query, queryParams, (err, results) => {
      if (err) {
        logger.error('Fehler beim Laden der Mitglieder:', err);
        return res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
      }
      res.json(results);
    });
  }
});

// GET /all - Alle Mitglieder mit Details
router.get('/all', (req, res) => {
  let { dojo_id } = req.query;

  if (req.user && req.user.dojo_id) {
    dojo_id = req.user.dojo_id.toString();
  }

  let whereClause = '';
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereClause = 'WHERE m.dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT
      m.mitglied_id, m.vorname, m.nachname, m.geburtsdatum, m.gurtfarbe, m.graduierung_id,
      COALESCE(GROUP_CONCAT(DISTINCT g_stil.name ORDER BY g_stil.name SEPARATOR ', '), g.name) AS aktuelle_graduierung,
      m.email, m.telefon_mobil, m.aktiv, m.eintrittsdatum, m.dojo_id,
      m.allergien, m.notfallkontakt_name, m.notfallkontakt_telefon,
      m.naechste_pruefung_datum, m.pruefungsgebuehr_bezahlt,
      m.hausordnung_akzeptiert, m.datenschutz_akzeptiert, m.foto_einverstaendnis,
      m.familien_id, m.rabatt_prozent, m.trainingsstunden,
      COALESCE(GROUP_CONCAT(DISTINCT ms.stil ORDER BY ms.stil SEPARATOR ', '), '') AS stile,
      m.foto_pfad
    FROM mitglieder m
    LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
    LEFT JOIN graduierungen g ON m.graduierung_id = g.graduierung_id
    LEFT JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
    LEFT JOIN graduierungen g_stil ON msd.current_graduierung_id = g_stil.graduierung_id
    ${whereClause}
    GROUP BY m.mitglied_id
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Mitglieder:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
    }

    if (!results || results.length === 0) {
      return res.status(200).json([]);
    }

    res.json(results);
  });
});

// GET /by-email/:email - Mitglied über Email abrufen
router.get('/by-email/:email', (req, res) => {
  const { email } = req.params;

  const query = `
    SELECT
      m.mitglied_id, m.vorname, m.nachname, m.geburtsdatum, m.geschlecht, m.gewicht, m.gurtfarbe, m.dojo_id, m.trainingsstunden,
      m.email, m.telefon, m.telefon_mobil, m.strasse, m.hausnummer, m.plz, m.ort,
      m.iban, m.bic, m.bankname, m.zahlungsmethode, m.zahllaufgruppe,
      m.eintrittsdatum, m.gekuendigt_am, m.aktiv,
      m.allergien, m.medizinische_hinweise, m.notfallkontakt_name, m.notfallkontakt_telefon, m.notfallkontakt_verhaeltnis,
      m.naechste_pruefung_datum, m.pruefungsgebuehr_bezahlt, m.trainer_empfehlung,
      m.hausordnung_akzeptiert, m.datenschutz_akzeptiert, m.foto_einverstaendnis, m.vereinsordnung_datum,
      m.familien_id, m.rabatt_prozent, m.rabatt_grund,
      COALESCE(GROUP_CONCAT(DISTINCT ms.stil ORDER BY ms.stil SEPARATOR ', '), '') AS stile,
      m.foto_pfad
    FROM mitglieder m
    LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
    WHERE m.email = ?
    GROUP BY m.mitglied_id
  `;

  db.query(query, [email], (err, result) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Mitglieds über Email:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Mitgliedsdaten' });
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ error: `Mitglied mit Email ${email} nicht gefunden.` });
    }

    res.json(result[0]);
  });
});

// GET /:id - Einzelnes Mitglied Vollprofil
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { dojo_id } = req.query;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  let whereConditions = ['m.mitglied_id = ?'];
  let queryParams = [id];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT
      m.mitglied_id, m.vorname, m.nachname, m.geburtsdatum, m.geschlecht, m.gewicht, m.gurtfarbe, m.dojo_id,
      m.email, m.telefon, m.telefon_mobil, m.strasse, m.hausnummer, m.plz, m.ort,
      m.iban, m.bic, m.bankname, m.zahlungsmethode, m.zahllaufgruppe,
      m.eintrittsdatum, m.gekuendigt_am, m.aktiv,
      m.allergien, m.medizinische_hinweise, m.notfallkontakt_name, m.notfallkontakt_telefon, m.notfallkontakt_verhaeltnis,
      m.naechste_pruefung_datum, m.pruefungsgebuehr_bezahlt, m.trainer_empfehlung,
      m.hausordnung_akzeptiert, m.datenschutz_akzeptiert, m.foto_einverstaendnis, m.vereinsordnung_datum,
      m.familien_id, m.rabatt_prozent, m.rabatt_grund,
      COALESCE(GROUP_CONCAT(DISTINCT ms.stil ORDER BY ms.stil SEPARATOR ', '), '') AS stile
    FROM mitglieder m
    LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
    ${whereClause}
    GROUP BY m.mitglied_id
  `;

  db.query(query, queryParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Vollprofils:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Mitgliedsdaten' });
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ error: `Mitglied mit ID ${id} nicht gefunden oder keine Berechtigung.` });
    }

    res.json(result[0]);
  });
});

// PUT /:id - Mitglied aktualisieren
router.put('/:id',
  validateId('id'),
  sanitizeStrings(['vorname', 'nachname', 'email', 'strasse', 'ort', 'bemerkungen']),
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;
    const updateFields = req.body;

    const allowedFields = ['stil_id', 'gurtfarbe', 'letzte_pruefung', 'vorname', 'nachname', 'email', 'telefon', 'telefon_mobil', 'strasse', 'hausnummer', 'plz', 'ort', 'gewicht', 'vertreter1_typ', 'vertreter1_name', 'vertreter1_telefon', 'vertreter1_email', 'vertreter2_typ', 'vertreter2_name', 'vertreter2_telefon', 'vertreter2_email'];
    const setClause = [];
    const values = [];

    Object.keys(updateFields).forEach(field => {
      if (allowedFields.includes(field)) {
        setClause.push(`${field} = ?`);
        values.push(updateFields[field]);
      }
    });

    if (setClause.length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Felder zum Update gefunden' });
    }

    let whereConditions = ['mitglied_id = ?'];
    values.push(id);

    if (dojo_id && dojo_id !== 'all') {
      whereConditions.push('dojo_id = ?');
      values.push(parseInt(dojo_id));
    }

    const query = `
      UPDATE mitglieder
      SET ${setClause.join(', ')}
      WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, values, (error, results) => {
      if (error) {
        logger.error('Datenbankfehler beim Update:', error);
        return res.status(500).json({ error: 'Datenbankfehler beim Aktualisieren', details: error.message });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
      }

      auditLog.log({
        req,
        aktion: auditLog.AKTION.MITGLIED_AKTUALISIERT,
        kategorie: auditLog.KATEGORIE.MITGLIED,
        entityType: 'mitglieder',
        entityId: id,
        neueWerte: updateFields,
        beschreibung: `Mitglied #${id} aktualisiert: ${Object.keys(updateFields).join(', ')}`
      });

      res.json({ success: true, message: 'Mitglied erfolgreich aktualisiert', updated_fields: updateFields });
    });
  });

// POST /check-duplicate - Duplikatsprüfung
router.post('/check-duplicate', (req, res) => {
  const { vorname, nachname, geburtsdatum, geschlecht } = req.body;

  if (!vorname || !nachname || !geburtsdatum) {
    return res.status(400).json({ error: 'Vorname, Nachname und Geburtsdatum sind erforderlich' });
  }

  const query = `
    SELECT mitglied_id, vorname, nachname, geburtsdatum, geschlecht, email, aktiv, eintrittsdatum
    FROM mitglieder
    WHERE LOWER(vorname) = LOWER(?) AND LOWER(nachname) = LOWER(?) AND geburtsdatum = ?
    ${geschlecht ? 'AND geschlecht = ?' : ''}
    ORDER BY eintrittsdatum DESC
  `;

  const params = geschlecht ? [vorname, nachname, geburtsdatum, geschlecht] : [vorname, nachname, geburtsdatum];

  db.query(query, params, (err, results) => {
    if (err) {
      logger.error('Fehler bei der Duplikatsprüfung:', err);
      return res.status(500).json({ error: 'Fehler bei der Duplikatsprüfung' });
    }

    const isDuplicate = results.length > 0;
    res.json({
      isDuplicate,
      matches: results,
      count: results.length,
      message: isDuplicate ? `Gefunden: ${results[0].vorname} ${results[0].nachname} (${results[0].geburtsdatum})` : 'Kein Duplikat gefunden'
    });
  });
});

// GET /:id/birthday-check - Geburtstags-Prüfung
router.get('/:id/birthday-check', (req, res) => {
  const mitgliedId = req.params.id;

  const query = `
    SELECT
      mitglied_id, vorname, nachname, geburtsdatum,
      YEAR(CURDATE()) - YEAR(geburtsdatum) as alter_jahre,
      CASE WHEN DAYOFMONTH(geburtsdatum) = DAYOFMONTH(CURDATE()) AND MONTH(geburtsdatum) = MONTH(CURDATE()) THEN 1 ELSE 0 END as hat_heute_geburtstag
    FROM mitglieder
    WHERE mitglied_id = ?
  `;

  db.query(query, [mitgliedId], (err, results) => {
    if (err) {
      logger.error('Fehler beim Geburtstags-Check:', { error: err });
      return res.status(500).json({ error: 'Datenbankfehler', hasBirthday: false });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden', hasBirthday: false });
    }

    const mitglied = results[0];
    const hasBirthday = mitglied.hat_heute_geburtstag === 1;

    res.json({
      success: true,
      hasBirthday,
      mitglied: {
        id: mitglied.mitglied_id,
        vorname: mitglied.vorname,
        nachname: mitglied.nachname,
        geburtsdatum: mitglied.geburtsdatum,
        alter: hasBirthday ? mitglied.alter_jahre : null
      }
    });
  });
});

module.exports = router;
