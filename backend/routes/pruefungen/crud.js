/**
 * Prüfungen - CRUD Routes
 * Grundlegende Operationen für Prüfungen
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const UrkundePdfGenerator = require('../../utils/urkundePdfGenerator');
const { ERROR_MESSAGES, SUCCESS_MESSAGES, HTTP_STATUS } = require('../../utils/constants');

const pdfGenerator = new UrkundePdfGenerator();

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function validatePruefungData(data) {
  const errors = [];
  if (!data.mitglied_id) errors.push('mitglied_id ist erforderlich');
  if (!data.stil_id) errors.push('stil_id ist erforderlich');
  if (!data.dojo_id) errors.push('dojo_id ist erforderlich');
  if (!data.graduierung_nachher_id) errors.push('graduierung_nachher_id ist erforderlich');
  if (!data.pruefungsdatum) errors.push('pruefungsdatum ist erforderlich');
  return errors;
}

function formatDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof dateValue === 'string') {
    return dateValue.split('T')[0];
  }
  return null;
}

// ============================================================================
// SPEZIELLE ROUTES (müssen VOR /:id kommen)
// ============================================================================

/**
 * GET /heute
 * Prüfungen für ein bestimmtes Datum (Live-Prüfungsansicht)
 */
router.get('/heute', (req, res) => {
  const { datum, dojo_id } = req.query;

  if (!datum) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Datum ist erforderlich'
    });
  }

  let whereClause = "WHERE p.pruefungsdatum = ? AND p.status IN ('geplant', 'durchgefuehrt', 'bestanden', 'nicht_bestanden')";
  let queryParams = [datum];

  if (dojo_id && dojo_id !== 'all') {
    whereClause += ' AND p.dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT
      p.pruefung_id, p.mitglied_id, p.stil_id, p.pruefungsdatum, p.pruefungszeit,
      p.pruefungsort, p.graduierung_vorher_id, p.graduierung_nachher_id,
      p.status, p.bestanden, p.punktzahl, p.max_punktzahl, p.prueferkommentar, p.dojo_id,
      m.vorname, m.nachname, m.email, m.geburtsdatum,
      s.name as stil_name, s.beschreibung as stil_beschreibung,
      g_vorher.name as graduierung_vorher_name, g_vorher.farbe_hex as graduierung_vorher_farbe,
      g_nachher.name as graduierung_nachher_name, g_nachher.farbe_hex as graduierung_nachher_farbe
    FROM pruefungen p
    INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
    INNER JOIN stile s ON p.stil_id = s.stil_id
    LEFT JOIN graduierungen g_vorher ON p.graduierung_vorher_id = g_vorher.graduierung_id
    LEFT JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
    ${whereClause}
    ORDER BY p.pruefungszeit ASC, m.nachname ASC, m.vorname ASC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Prüfungen für heute:', { error: err });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.DATABASE.QUERY_FAILED
      });
    }
    res.json(results);
  });
});

/**
 * GET /status/anstehend
 * Anstehende Prüfungen (geplant, in naher Zukunft)
 */
router.get('/status/anstehend', (req, res) => {
  const { dojo_id, tage = 30 } = req.query;
  let whereClause = "WHERE p.status = 'geplant' AND p.pruefungsdatum >= CURDATE()";
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereClause += ' AND p.dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  whereClause += ' AND p.pruefungsdatum <= DATE_ADD(CURDATE(), INTERVAL ? DAY)';
  queryParams.push(parseInt(tage));

  const query = `
    SELECT
      p.*,
      m.vorname, m.nachname, m.email,
      s.name as stil_name,
      g.name as angestrebte_graduierung, g.farbe_hex, g.dan_grad,
      DATEDIFF(p.pruefungsdatum, CURDATE()) as tage_bis_pruefung
    FROM pruefungen p
    INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
    INNER JOIN stile s ON p.stil_id = s.stil_id
    INNER JOIN graduierungen g ON p.graduierung_nachher_id = g.graduierung_id
    ${whereClause}
    ORDER BY p.pruefungsdatum ASC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen anstehender Prüfungen:', { error: err });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERAL.LOADING_ERROR,
        details: err.message
      });
    }

    res.json({
      success: true,
      count: results.length,
      pruefungen: results
    });
  });
});

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * GET /
 * Alle Prüfungen abrufen mit optionalen Filtern
 */
router.get('/', (req, res) => {
  logger.debug('GET /api/pruefungen aufgerufen', { query: req.query });
  const {
    dojo_id, mitglied_id, stil_id, status,
    von_datum, bis_datum, bestanden,
    limit = 100, offset = 0
  } = req.query;

  let whereConditions = [];
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('p.dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  if (mitglied_id) {
    whereConditions.push('p.mitglied_id = ?');
    queryParams.push(parseInt(mitglied_id));
  }

  if (stil_id) {
    whereConditions.push('p.stil_id = ?');
    queryParams.push(parseInt(stil_id));
  }

  if (status) {
    const statusArray = status.split(',').map(s => s.trim());
    if (statusArray.length === 1) {
      whereConditions.push('p.status = ?');
      queryParams.push(statusArray[0]);
    } else {
      const placeholders = statusArray.map(() => '?').join(',');
      whereConditions.push(`p.status IN (${placeholders})`);
      queryParams.push(...statusArray);
    }
  }

  if (von_datum) {
    whereConditions.push('p.pruefungsdatum >= ?');
    queryParams.push(von_datum);
  }

  if (bis_datum) {
    whereConditions.push('p.pruefungsdatum <= ?');
    queryParams.push(bis_datum);
  }

  if (bestanden !== undefined) {
    whereConditions.push('p.bestanden = ?');
    queryParams.push(bestanden === 'true' || bestanden === '1');
  }

  const whereClause = whereConditions.length > 0
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  const query = `
    SELECT
      p.*, m.vorname, m.nachname, m.email,
      s.name as stil_name, d.dojoname,
      g_vorher.name as graduierung_vorher, g_vorher.farbe_hex as farbe_vorher,
      g_nachher.name as graduierung_nachher, g_nachher.farbe_hex as farbe_nachher,
      g_nachher.dan_grad
    FROM pruefungen p
    INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
    INNER JOIN stile s ON p.stil_id = s.stil_id
    INNER JOIN dojo d ON p.dojo_id = d.id
    LEFT JOIN graduierungen g_vorher ON p.graduierung_vorher_id = g_vorher.graduierung_id
    INNER JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
    ${whereClause}
    ORDER BY p.pruefungsdatum DESC
    LIMIT ? OFFSET ?
  `;

  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Prüfungen:', { error: err });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.GENERAL.LOADING_ERROR,
        details: err.message
      });
    }

    const formattedResults = results.map(pruefung => ({
      ...pruefung,
      pruefungsdatum: formatDate(pruefung.pruefungsdatum),
      anmeldefrist: formatDate(pruefung.anmeldefrist),
      bezahldatum: formatDate(pruefung.bezahldatum)
    }));

    res.json({
      success: true,
      count: formattedResults.length,
      pruefungen: formattedResults
    });
  });
});

/**
 * GET /:id
 * Einzelne Prüfung mit allen Details abrufen
 */
router.get('/:id', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: ERROR_MESSAGES.VALIDATION.INVALID_ID
    });
  }

  const query = `
    SELECT
      p.*,
      m.mitglied_id, m.vorname, m.nachname, m.email, m.telefon_mobil,
      s.stil_id, s.name as stil_name,
      d.id as dojo_id, d.dojoname,
      g_vorher.graduierung_id as graduierung_vorher_id,
      g_vorher.name as graduierung_vorher, g_vorher.farbe_hex as farbe_vorher,
      g_vorher.farbe_sekundaer as farbe_vorher_sekundaer,
      g_nachher.graduierung_id as graduierung_nachher_id,
      g_nachher.name as graduierung_nachher, g_nachher.farbe_hex as farbe_nachher,
      g_nachher.farbe_sekundaer as farbe_nachher_sekundaer,
      g_nachher.dan_grad, g_nachher.kategorie
    FROM pruefungen p
    INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
    INNER JOIN stile s ON p.stil_id = s.stil_id
    INNER JOIN dojo d ON p.dojo_id = d.id
    LEFT JOIN graduierungen g_vorher ON p.graduierung_vorher_id = g_vorher.graduierung_id
    INNER JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
    WHERE p.pruefung_id = ?
  `;

  db.query(query, [pruefung_id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Prüfung:', { error: err, pruefung_id });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERAL.LOADING_ERROR,
        details: err.message
      });
    }

    if (results.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.RESOURCE.PRUEFUNG_NOT_FOUND
      });
    }

    res.json({
      success: true,
      pruefung: results[0]
    });
  });
});

/**
 * POST /
 * Neue Prüfung erstellen
 */
router.post('/', (req, res) => {
  const pruefungData = req.body;

  const errors = validatePruefungData(pruefungData);
  if (errors.length > 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: ERROR_MESSAGES.VALIDATION.VALIDATION_FAILED,
      errors
    });
  }

  const {
    mitglied_id, stil_id, dojo_id,
    graduierung_vorher_id = null, graduierung_nachher_id,
    pruefungsdatum, pruefungsort = null,
    bestanden = false, punktzahl = null, max_punktzahl = null,
    pruefer_id = null, prueferkommentar = null,
    pruefungsgebuehr = null, gebuehr_bezahlt = false, bezahldatum = null,
    urkunde_ausgestellt = false, urkunde_nr = null, urkunde_pfad = null, dokumente_pfad = null,
    pruefungsinhalte = null, einzelbewertungen = null,
    status = 'geplant', anmerkungen = null, erstellt_von = null
  } = pruefungData;

  const insertQuery = `
    INSERT INTO pruefungen (
      mitglied_id, stil_id, dojo_id,
      graduierung_vorher_id, graduierung_nachher_id,
      pruefungsdatum, pruefungsort, bestanden,
      punktzahl, max_punktzahl,
      pruefer_id, prueferkommentar,
      pruefungsgebuehr, gebuehr_bezahlt, bezahldatum,
      urkunde_ausgestellt, urkunde_nr, urkunde_pfad, dokumente_pfad,
      pruefungsinhalte, einzelbewertungen,
      status, anmerkungen, erstellt_von,
      erstellt_am
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()
    )
  `;

  const insertValues = [
    mitglied_id, stil_id, dojo_id,
    graduierung_vorher_id, graduierung_nachher_id,
    pruefungsdatum, pruefungsort, bestanden,
    punktzahl, max_punktzahl,
    pruefer_id, prueferkommentar,
    pruefungsgebuehr, gebuehr_bezahlt, bezahldatum,
    urkunde_ausgestellt, urkunde_nr, urkunde_pfad, dokumente_pfad,
    JSON.stringify(pruefungsinhalte), JSON.stringify(einzelbewertungen),
    status, anmerkungen, erstellt_von
  ];

  db.query(insertQuery, insertValues, (err, result) => {
    if (err) {
      logger.error('Fehler beim Erstellen der Prüfung:', { error: err });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERAL.SAVE_ERROR,
        details: err.message
      });
    }

    const newPruefungId = result.insertId;

    const selectQuery = `
      SELECT p.*, m.vorname, m.nachname, s.name as stil_name
      FROM pruefungen p
      INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
      INNER JOIN stile s ON p.stil_id = s.stil_id
      WHERE p.pruefung_id = ?
    `;

    db.query(selectQuery, [newPruefungId], (selectErr, selectResults) => {
      if (selectErr) {
        logger.error('Fehler beim Abrufen der neuen Prüfung:', { error: selectErr });
        return res.status(HTTP_STATUS.CREATED).json({
          success: true,
          pruefung_id: newPruefungId,
          message: SUCCESS_MESSAGES.CRUD.CREATED
        });
      }

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        pruefung_id: newPruefungId,
        message: SUCCESS_MESSAGES.CRUD.CREATED,
        pruefung: selectResults[0]
      });
    });
  });
});

/**
 * PUT /:id
 * Prüfung aktualisieren
 */
router.put('/:id', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: ERROR_MESSAGES.VALIDATION.INVALID_ID
    });
  }

  const updateData = req.body;

  const allowedFields = [
    'pruefungsdatum', 'pruefungsort', 'bestanden',
    'punktzahl', 'max_punktzahl',
    'pruefer_id', 'prueferkommentar',
    'pruefungsgebuehr', 'gebuehr_bezahlt', 'bezahldatum',
    'urkunde_ausgestellt', 'urkunde_nr', 'urkunde_pfad', 'dokumente_pfad',
    'pruefungsinhalte', 'einzelbewertungen',
    'status', 'anmerkungen', 'graduierung_nachher_id'
  ];

  const setClause = [];
  const values = [];

  Object.keys(updateData).forEach(field => {
    if (allowedFields.includes(field)) {
      setClause.push(`${field} = ?`);
      if (field === 'pruefungsinhalte' || field === 'einzelbewertungen') {
        values.push(JSON.stringify(updateData[field]));
      } else {
        values.push(updateData[field]);
      }
    }
  });

  if (setClause.length === 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Keine gültigen Felder zum Update gefunden'
    });
  }

  setClause.push('aktualisiert_am = NOW()');

  const updateQuery = `
    UPDATE pruefungen
    SET ${setClause.join(', ')}
    WHERE pruefung_id = ?
  `;

  values.push(pruefung_id);

  db.query(updateQuery, values, (err, result) => {
    if (err) {
      logger.error('Fehler beim Aktualisieren der Prüfung:', { error: err, pruefung_id });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERAL.UPDATE_ERROR,
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.RESOURCE.PRUEFUNG_NOT_FOUND
      });
    }

    // Hole aktualisierte Prüfung
    const selectQuery = `
      SELECT p.*, m.vorname, m.nachname, s.name as stil_name,
        g_nachher.name as graduierung_nachher, g_nachher.farbe_hex
      FROM pruefungen p
      INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
      INNER JOIN stile s ON p.stil_id = s.stil_id
      INNER JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
      WHERE p.pruefung_id = ?
    `;

    db.query(selectQuery, [pruefung_id], (selectErr, selectResults) => {
      if (selectErr) {
        return res.json({
          success: true,
          message: SUCCESS_MESSAGES.CRUD.UPDATED
        });
      }

      const pruefung = selectResults[0];

      // Wenn Prüfung auf "bestanden" gesetzt wurde, aktualisiere letzte_pruefung
      if (updateData.bestanden === true || updateData.bestanden === 1) {
        const updateStilDataQuery = `
          INSERT INTO mitglied_stil_data (
            mitglied_id, stil_id, current_graduierung_id, letzte_pruefung, aktualisiert_am
          ) VALUES (?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            current_graduierung_id = VALUES(current_graduierung_id),
            letzte_pruefung = VALUES(letzte_pruefung),
            aktualisiert_am = NOW()
        `;

        db.query(
          updateStilDataQuery,
          [pruefung.mitglied_id, pruefung.stil_id, pruefung.graduierung_nachher_id, pruefung.pruefungsdatum],
          (stilDataErr) => {
            if (stilDataErr) {
              logger.error('Fehler beim Aktualisieren von mitglied_stil_data:', { error: stilDataErr });
            }
          }
        );
      }

      res.json({
        success: true,
        message: SUCCESS_MESSAGES.CRUD.UPDATED,
        pruefung: pruefung
      });
    });
  });
});

/**
 * DELETE /:id
 * Prüfung löschen
 */
router.delete('/:id', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: ERROR_MESSAGES.VALIDATION.INVALID_ID
    });
  }

  const deleteQuery = 'DELETE FROM pruefungen WHERE pruefung_id = ?';

  db.query(deleteQuery, [pruefung_id], (err, result) => {
    if (err) {
      logger.error('Fehler beim Löschen der Prüfung:', { error: err, pruefung_id });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERAL.DELETE_ERROR,
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.RESOURCE.PRUEFUNG_NOT_FOUND
      });
    }

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.CRUD.DELETED,
      pruefung_id
    });
  });
});

// ============================================================================
// AKTIONS-ROUTES
// ============================================================================

/**
 * POST /:pruefung_id/teilnahme-bestaetigen
 * Mitglied bestätigt Teilnahme an Prüfung
 */
router.post('/:pruefung_id/teilnahme-bestaetigen', (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  const { mitglied_id } = req.body;

  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: ERROR_MESSAGES.VALIDATION.INVALID_ID
    });
  }

  if (!mitglied_id) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Mitglied-ID erforderlich'
    });
  }

  const checkQuery = `
    SELECT pruefung_id, mitglied_id, status, teilnahme_bestaetigt
    FROM pruefungen
    WHERE pruefung_id = ? AND mitglied_id = ?
  `;

  db.query(checkQuery, [pruefung_id, mitglied_id], (checkErr, checkResults) => {
    if (checkErr) {
      logger.error('Fehler beim Prüfen der Prüfung:', { error: checkErr });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.DATABASE.QUERY_FAILED,
        details: checkErr.message
      });
    }

    if (checkResults.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.RESOURCE.PRUEFUNG_NOT_FOUND
      });
    }

    const pruefung = checkResults[0];

    if (pruefung.status !== 'geplant') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Prüfung ist nicht im Status "geplant"'
      });
    }

    if (pruefung.teilnahme_bestaetigt) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Teilnahme wurde bereits bestätigt'
      });
    }

    const updateQuery = `
      UPDATE pruefungen
      SET teilnahme_bestaetigt = TRUE,
          teilnahme_bestaetigt_am = NOW(),
          aktualisiert_am = NOW()
      WHERE pruefung_id = ?
    `;

    db.query(updateQuery, [pruefung_id], (updateErr) => {
      if (updateErr) {
        logger.error('Fehler beim Bestätigen der Teilnahme:', { error: updateErr });
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.GENERAL.UPDATE_ERROR,
          details: updateErr.message
        });
      }

      res.json({
        success: true,
        message: 'Teilnahme erfolgreich bestätigt',
        pruefung_id,
        teilnahme_bestaetigt_am: new Date()
      });
    });
  });
});

/**
 * POST /:id/graduierung-aktualisieren
 * Aktualisiert die Graduierung eines Mitglieds nach bestandener Prüfung
 */
router.post('/:id/graduierung-aktualisieren', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: ERROR_MESSAGES.VALIDATION.INVALID_ID
    });
  }

  const selectQuery = `
    SELECT mitglied_id, stil_id, graduierung_nachher_id, pruefungsdatum, bestanden
    FROM pruefungen
    WHERE pruefung_id = ?
  `;

  db.query(selectQuery, [pruefung_id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Prüfung:', { error: err });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.DATABASE.QUERY_FAILED,
        details: err.message
      });
    }

    if (results.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.RESOURCE.PRUEFUNG_NOT_FOUND
      });
    }

    const pruefung = results[0];

    if (!pruefung.bestanden) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Graduierung kann nur bei bestandener Prüfung aktualisiert werden'
      });
    }

    const updateQuery = `
      INSERT INTO mitglied_stil_data (
        mitglied_id, stil_id, current_graduierung_id, letzte_pruefung, aktualisiert_am
      ) VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        current_graduierung_id = VALUES(current_graduierung_id),
        letzte_pruefung = VALUES(letzte_pruefung),
        aktualisiert_am = NOW()
    `;

    db.query(
      updateQuery,
      [pruefung.mitglied_id, pruefung.stil_id, pruefung.graduierung_nachher_id, pruefung.pruefungsdatum],
      (updateErr) => {
        if (updateErr) {
          logger.error('Fehler beim Aktualisieren der Graduierung:', { error: updateErr });
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            error: ERROR_MESSAGES.GENERAL.UPDATE_ERROR,
            details: updateErr.message
          });
        }

        res.json({
          success: true,
          message: 'Graduierung erfolgreich aktualisiert',
          mitglied_id: pruefung.mitglied_id,
          stil_id: pruefung.stil_id,
          neue_graduierung_id: pruefung.graduierung_nachher_id
        });
      }
    );
  });
});

/**
 * POST /:id/status-aendern
 * Ändert den Status einer Prüfung und setzt die Graduierung zurück/vor
 */
router.post('/:id/status-aendern', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  const { bestanden, mitglied_id, stil_id, graduierung_vorher_id, graduierung_nachher_id } = req.body;

  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: ERROR_MESSAGES.VALIDATION.INVALID_ID
    });
  }

  if (bestanden === undefined) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Bestanden-Status erforderlich'
    });
  }

  db.getConnection((err, connection) => {
    if (err) {
      logger.error('Fehler beim Holen der Verbindung:', { error: err });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.DATABASE.CONNECTION_FAILED
      });
    }

    connection.beginTransaction(transErr => {
      if (transErr) {
        connection.release();
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Fehler beim Starten der Transaktion'
        });
      }

      const updatePruefungQuery = `
        UPDATE pruefungen
        SET bestanden = ?, aktualisiert_am = NOW()
        WHERE pruefung_id = ?
      `;

      connection.query(updatePruefungQuery, [bestanden, pruefung_id], (updateErr) => {
        if (updateErr) {
          return connection.rollback(() => {
            connection.release();
            logger.error('Fehler beim Aktualisieren der Prüfung:', { error: updateErr });
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
              error: ERROR_MESSAGES.GENERAL.UPDATE_ERROR
            });
          });
        }

        const graduierung_id = bestanden ? graduierung_nachher_id : graduierung_vorher_id;

        const getPruefungQuery = 'SELECT pruefungsdatum FROM pruefungen WHERE pruefung_id = ?';
        connection.query(getPruefungQuery, [pruefung_id], (getPruefungErr, pruefungResults) => {
          if (getPruefungErr) {
            return connection.rollback(() => {
              connection.release();
              logger.error('Fehler beim Abrufen der Prüfung:', { error: getPruefungErr });
              res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: ERROR_MESSAGES.DATABASE.QUERY_FAILED
              });
            });
          }

          const pruefungsdatum = pruefungResults[0]?.pruefungsdatum;

          const updateGraduierungQuery = bestanden
            ? `
              INSERT INTO mitglied_stil_data (
                mitglied_id, stil_id, current_graduierung_id, letzte_pruefung, aktualisiert_am
              ) VALUES (?, ?, ?, ?, NOW())
              ON DUPLICATE KEY UPDATE
                current_graduierung_id = VALUES(current_graduierung_id),
                letzte_pruefung = VALUES(letzte_pruefung),
                aktualisiert_am = NOW()
            `
            : `
              INSERT INTO mitglied_stil_data (
                mitglied_id, stil_id, current_graduierung_id, aktualisiert_am
              ) VALUES (?, ?, ?, NOW())
              ON DUPLICATE KEY UPDATE
                current_graduierung_id = VALUES(current_graduierung_id),
                aktualisiert_am = NOW()
            `;

          const queryParams = bestanden
            ? [mitglied_id, stil_id, graduierung_id, pruefungsdatum]
            : [mitglied_id, stil_id, graduierung_id];

          connection.query(updateGraduierungQuery, queryParams, (gradErr) => {
            if (gradErr) {
              return connection.rollback(() => {
                connection.release();
                logger.error('Fehler beim Aktualisieren der Graduierung:', { error: gradErr });
                res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                  error: ERROR_MESSAGES.GENERAL.UPDATE_ERROR
                });
              });
            }

            connection.commit(commitErr => {
              if (commitErr) {
                return connection.rollback(() => {
                  connection.release();
                  logger.error('Fehler beim Commit:', { error: commitErr });
                  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                    error: ERROR_MESSAGES.GENERAL.SAVE_ERROR
                  });
                });
              }

              connection.release();
              res.json({
                success: true,
                message: `Status erfolgreich auf "${bestanden ? 'bestanden' : 'nicht bestanden'}" geändert`,
                bestanden,
                graduierung_id
              });
            });
          });
        });
      });
    });
  });
});

/**
 * GET /:id/urkunde/download
 * Urkunde als PDF herunterladen
 */
router.get('/:id/urkunde/download', async (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: ERROR_MESSAGES.VALIDATION.INVALID_ID
    });
  }

  try {
    const query = `
      SELECT
        p.*, m.vorname, m.nachname, m.geburtsdatum, m.email,
        s.name as stil_name,
        d.dojoname, d.ort,
        g_nachher.name as graduierung_nachher, g_nachher.farbe_hex
      FROM pruefungen p
      INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
      INNER JOIN stile s ON p.stil_id = s.stil_id
      INNER JOIN dojo d ON p.dojo_id = d.id
      INNER JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
      WHERE p.pruefung_id = ? AND p.bestanden = 1
    `;

    db.query(query, [pruefung_id], async (err, results) => {
      if (err) {
        logger.error('Fehler beim Abrufen der Prüfungsdaten:', { error: err });
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: ERROR_MESSAGES.DATABASE.QUERY_FAILED,
          details: err.message
        });
      }

      if (results.length === 0) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Prüfung nicht gefunden oder nicht bestanden'
        });
      }

      const pruefung = results[0];

      let urkundeNr = pruefung.urkunde_nr;
      if (!urkundeNr) {
        urkundeNr = pdfGenerator.generateUrkundenNr(
          pruefung_id,
          pruefung.dojo_id,
          pruefung.pruefungsdatum
        );

        db.query(
          'UPDATE pruefungen SET urkunde_nr = ?, urkunde_ausgestellt = 1 WHERE pruefung_id = ?',
          [urkundeNr, pruefung_id],
          (updateErr) => {
            if (updateErr) {
              logger.warn('Urkunden-Nummer konnte nicht gespeichert werden:', { error: updateErr.message });
            }
          }
        );
      }

      const pruefungData = {
        pruefung_id,
        pruefungsdatum: pruefung.pruefungsdatum,
        graduierung_nachher: pruefung.graduierung_nachher,
        stil_name: pruefung.stil_name,
        punktzahl: pruefung.punktzahl,
        max_punktzahl: pruefung.max_punktzahl,
        urkunde_nr: urkundeNr
      };

      const memberData = {
        vorname: pruefung.vorname,
        nachname: pruefung.nachname,
        geburtsdatum: pruefung.geburtsdatum
      };

      const dojoData = {
        dojoname: pruefung.dojoname,
        ort: pruefung.ort
      };

      try {
        const pdfBuffer = await pdfGenerator.generateUrkundePDF(pruefungData, memberData, dojoData);

        const filename = `Urkunde_${pruefung.nachname}_${pruefung.vorname}_${urkundeNr}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
      } catch (pdfErr) {
        logger.error('Fehler beim Generieren des PDFs:', { error: pdfErr });
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Fehler beim Generieren der Urkunde',
          details: pdfErr.message
        });
      }
    });
  } catch (err) {
    logger.error('Unerwarteter Fehler:', { error: err });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR,
      details: err.message
    });
  }
});

module.exports = router;
