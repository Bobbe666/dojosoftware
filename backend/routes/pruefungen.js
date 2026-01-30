// ============================================================================
// PRÜFUNGSVERWALTUNG API - VOLLSTÄNDIGE BACKEND-ROUTE
// Backend/routes/pruefungen.js
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const UrkundePdfGenerator = require('../utils/urkundePdfGenerator');

const pdfGenerator = new UrkundePdfGenerator();
// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Validiert Prüfungsdaten
 */
function validatePruefungData(data) {
  const errors = [];

  if (!data.mitglied_id) errors.push('mitglied_id ist erforderlich');
  if (!data.stil_id) errors.push('stil_id ist erforderlich');
  if (!data.dojo_id) errors.push('dojo_id ist erforderlich');
  if (!data.graduierung_nachher_id) errors.push('graduierung_nachher_id ist erforderlich');
  if (!data.pruefungsdatum) errors.push('pruefungsdatum ist erforderlich');

  return errors;
}

// ============================================================================
// SPEZIELLE ENDPUNKTE (MÜSSEN VOR /:id KOMMEN!)
// ============================================================================

/**
 * POST /api/pruefungen/termine
 * Erstellt einen Prüfungstermin ohne Kandidaten (Vorlage)
 * Prüft auf Überschneidungen (erlaubt nur bei unterschiedlichem Raum und Prüfer)
 */
router.post('/termine', (req, res) => {
  const {
    datum,
    zeit,
    ort,
    pruefer_name,
    stil_id,
    pruefungsgebuehr,
    anmeldefrist,
    bemerkungen,
    teilnahmebedingungen,
    dojo_id
  } = req.body;

  if (!datum || !stil_id || !dojo_id) {
    return res.status(400).json({
      error: 'Fehlende erforderliche Felder',
      required: ['datum', 'stil_id', 'dojo_id']
    });
  }

  const zeitValue = zeit || '10:00';

  // Prüfe auf Überschneidungen
  const checkOverlapQuery = `
    SELECT
      termin_id,
      pruefungsort,
      pruefer_name,
      stil_id
    FROM pruefungstermin_vorlagen
    WHERE pruefungsdatum = ?
      AND pruefungszeit = ?
      AND dojo_id = ?
  `;

  db.query(checkOverlapQuery, [datum, zeitValue, dojo_id], (err, overlaps) => {
    if (err) {
      console.error('Fehler beim Prüfen auf Überschneidungen:', err);
      return res.status(500).json({
        error: 'Fehler beim Prüfen auf Überschneidungen',
        details: err.message
      });
    }

    // Wenn Überschneidungen existieren, prüfe Raum und Prüfer
    if (overlaps && overlaps.length > 0) {
      for (const overlap of overlaps) {
        const sameRoom = (overlap.pruefungsort || '') === (ort || '');
        const sameExaminer = (overlap.pruefer_name || '') === (pruefer_name || '');

        // Überschneidung ist nur erlaubt, wenn BEIDE unterschiedlich sind
        if (sameRoom || sameExaminer) {
          return res.status(409).json({
            error: 'Überschneidung nicht erlaubt',
            message: 'Zu diesem Zeitpunkt existiert bereits eine Prüfung. Überschneidungen sind nur möglich, wenn ein anderer Raum UND ein anderer Prüfer verwendet werden.',
            conflict: {
              datum,
              zeit: zeitValue,
              bestehendeRaeume: overlaps.map(o => o.pruefungsort).filter(Boolean),
              bestehendePruefer: overlaps.map(o => o.pruefer_name).filter(Boolean)
            }
          });
        }
      }
    }

    // Keine Konflikte oder beide Parameter unterschiedlich - erstelle Termin
    const insertQuery = `
      INSERT INTO pruefungstermin_vorlagen (
        pruefungsdatum, pruefungszeit, pruefungsort, pruefer_name,
        stil_id, pruefungsgebuehr, anmeldefrist,
        bemerkungen, teilnahmebedingungen, dojo_id,
        erstellt_am
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      datum,
      zeitValue,
      ort || null,
      pruefer_name || null,
      stil_id,
      pruefungsgebuehr || null,
      anmeldefrist || null,
      bemerkungen || null,
      teilnahmebedingungen || null,
      dojo_id
    ];

    db.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error('Fehler beim Erstellen des Prüfungstermins:', err);
        return res.status(500).json({
          error: 'Fehler beim Erstellen des Termins',
          details: err.message
        });
      }

      res.status(201).json({
        success: true,
        message: 'Prüfungstermin erfolgreich erstellt',
        termin_id: result.insertId
      });
    });
  });
});

/**
 * GET /api/pruefungen/termine
 * Lädt alle Prüfungstermine (Vorlagen)
 */
router.get('/termine', (req, res) => {
  const { dojo_id, stil_id } = req.query;

  let whereConditions = [];
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('pt.dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  if (stil_id && stil_id !== 'all') {
    whereConditions.push('pt.stil_id = ?');
    queryParams.push(parseInt(stil_id));
  }

  const whereClause = whereConditions.length > 0
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  const query = `
    SELECT
      pt.*,
      s.name as stil_name
    FROM pruefungstermin_vorlagen pt
    INNER JOIN stile s ON pt.stil_id = s.stil_id
    ${whereClause}
    ORDER BY pt.pruefungsdatum DESC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Prüfungstermine:', err);
      return res.status(500).json({
        error: 'Fehler beim Laden der Termine',
        details: err.message
      });
    }

    // Formatiere DATE-Felder um Zeitzonen-Probleme zu vermeiden
    const formattedResults = results.map(termin => {
      const formatDate = (dateValue) => {
        if (!dateValue) return null;

        // MySQL gibt DATE als Date-Objekt zurück
        if (dateValue instanceof Date) {
          const year = dateValue.getFullYear();
          const month = String(dateValue.getMonth() + 1).padStart(2, '0');
          const day = String(dateValue.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }

        // Falls es bereits ein String ist, extrahiere YYYY-MM-DD
        if (typeof dateValue === 'string') {
          return dateValue.split('T')[0];
        }

        return null;
      };

      return {
        ...termin,
        pruefungsdatum: formatDate(termin.pruefungsdatum),
        anmeldefrist: formatDate(termin.anmeldefrist)
      };
    });

    res.json({
      success: true,
      count: formattedResults.length,
      termine: formattedResults
    });
  });
});

/**
 * PUT /api/pruefungen/termine/:id
 * Aktualisiert einen Prüfungstermin
 */
router.put('/termine/:id', (req, res) => {
  const termin_id = parseInt(req.params.id);

  if (!termin_id || isNaN(termin_id)) {
    return res.status(400).json({ error: 'Ungültige Termin-ID' });
  }

  const {
    datum,
    zeit,
    ort,
    pruefer_name,
    stil_id,
    pruefungsgebuehr,
    anmeldefrist,
    bemerkungen,
    teilnahmebedingungen
  } = req.body;

  if (!datum || !stil_id) {
    return res.status(400).json({
      error: 'Fehlende erforderliche Felder',
      required: ['datum', 'stil_id']
    });
  }

  const updateQuery = `
    UPDATE pruefungstermin_vorlagen
    SET
      pruefungsdatum = ?,
      pruefungszeit = ?,
      pruefungsort = ?,
      pruefer_name = ?,
      stil_id = ?,
      pruefungsgebuehr = ?,
      anmeldefrist = ?,
      bemerkungen = ?,
      teilnahmebedingungen = ?
    WHERE termin_id = ?
  `;

  const values = [
    datum,
    zeit || '10:00',
    ort || null,
    pruefer_name || null,
    stil_id,
    pruefungsgebuehr || null,
    anmeldefrist || null,
    bemerkungen || null,
    teilnahmebedingungen || null,
    termin_id
  ];

  console.log('UPDATE Termin:', { termin_id, datum, zeit, ort, pruefer_name, stil_id, pruefungsgebuehr, anmeldefrist });

  db.query(updateQuery, values, (err, result) => {
    if (err) {
      console.error('Fehler beim Aktualisieren des Termins:', err);
      return res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        details: err.message
      });
    }

    console.log('UPDATE result:', { affectedRows: result.affectedRows, changedRows: result.changedRows, warningCount: result.warningCount });

    if (result.affectedRows === 0) {
      console.log('❌ Kein Termin mit ID gefunden:', termin_id);
      return res.status(404).json({ error: 'Termin nicht gefunden' });
    }

    console.log('✅ Termin erfolgreich aktualisiert:', termin_id);
    res.json({
      success: true,
      message: 'Termin erfolgreich aktualisiert'
    });
  });
});

/**
 * DELETE /api/pruefungen/termine/:id
 * Löscht einen Prüfungstermin
 */
router.delete('/termine/:id', (req, res) => {
  const termin_id = parseInt(req.params.id);

  if (!termin_id || isNaN(termin_id)) {
    return res.status(400).json({ error: 'Ungültige Termin-ID' });
  }

  const deleteQuery = 'DELETE FROM pruefungstermin_vorlagen WHERE termin_id = ?';

  db.query(deleteQuery, [termin_id], (err, result) => {
    if (err) {
      console.error('Fehler beim Löschen des Termins:', err);
      return res.status(500).json({
        error: 'Fehler beim Löschen',
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden' });
    }

    res.json({
      success: true,
      message: 'Termin erfolgreich gelöscht'
    });
  });
});

/**
 * GET /api/pruefungen/kandidaten
 * Ermittelt alle Prüfungskandidaten basierend auf erfüllten Mindestanforderungen
 */
router.get('/kandidaten', (req, res) => {
  const { dojo_id, stil_id } = req.query;
  let whereClause = '';
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereClause = 'WHERE m.dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  if (stil_id) {
    whereClause += (whereClause ? ' AND' : 'WHERE') + ' msd.stil_id = ?';
    queryParams.push(parseInt(stil_id));
  }

  const query = `
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.geburtsdatum,
      m.email,
      m.dojo_id,

      -- Stilinformationen
      s.stil_id,
      s.name as stil_name,

      -- Aktuelle Graduierung
      msd.current_graduierung_id,
      g_current.name as aktuelle_graduierung,
      g_current.farbe_hex as aktuelle_farbe,
      g_current.reihenfolge as aktuelle_reihenfolge,

      -- Nächste Graduierung
      g_next.graduierung_id as naechste_graduierung_id,
      g_next.name as naechste_graduierung,
      g_next.farbe_hex as naechste_farbe,
      g_next.trainingsstunden_min as benoetigte_stunden,
      g_next.mindestzeit_monate as benoetigte_monate,

      -- Prüfungsstatus
      msd.letzte_pruefung,
      COALESCE(
        (SELECT COUNT(*)
         FROM anwesenheit a
         WHERE a.mitglied_id = m.mitglied_id
         AND a.anwesend = 1
         AND (msd.letzte_pruefung IS NULL OR a.datum > msd.letzte_pruefung)
        ), 0
      ) as absolvierte_stunden,

      -- Zeitberechnung
      CASE
        WHEN msd.letzte_pruefung IS NULL THEN TIMESTAMPDIFF(MONTH, m.eintrittsdatum, CURDATE())
        ELSE TIMESTAMPDIFF(MONTH, msd.letzte_pruefung, CURDATE())
      END as monate_seit_letzter_pruefung,

      -- Berechtigung
      CASE
        WHEN g_next.graduierung_id IS NULL THEN 0
        WHEN (
          COALESCE(
            (SELECT COUNT(*)
             FROM anwesenheit a
             WHERE a.mitglied_id = m.mitglied_id
             AND a.anwesend = 1
             AND (msd.letzte_pruefung IS NULL OR a.datum > msd.letzte_pruefung)
            ), 0
          ) >= g_next.trainingsstunden_min
          AND
          CASE
            WHEN msd.letzte_pruefung IS NULL THEN TIMESTAMPDIFF(MONTH, m.eintrittsdatum, CURDATE())
            ELSE TIMESTAMPDIFF(MONTH, msd.letzte_pruefung, CURDATE())
          END >= g_next.mindestzeit_monate
        ) THEN 1
        ELSE 0
      END as berechtigt,

      -- Zulassungsstatus (aus pruefungen Tabelle)
      (
        SELECT COUNT(*)
        FROM pruefungen p
        WHERE p.mitglied_id = m.mitglied_id
        AND p.stil_id = s.stil_id
        AND p.graduierung_nachher_id = g_next.graduierung_id
        AND p.status = 'geplant'
      ) as bereits_zugelassen,

      -- Prüfungs-ID für bereits zugelassene Kandidaten
      (
        SELECT p.pruefung_id
        FROM pruefungen p
        WHERE p.mitglied_id = m.mitglied_id
        AND p.stil_id = s.stil_id
        AND p.graduierung_nachher_id = g_next.graduierung_id
        AND p.status = 'geplant'
        LIMIT 1
      ) as pruefung_id

    FROM mitglieder m
    INNER JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
    INNER JOIN stile s ON msd.stil_id = s.stil_id
    LEFT JOIN graduierungen g_current ON msd.current_graduierung_id = g_current.graduierung_id
    LEFT JOIN graduierungen g_next ON (
      g_next.stil_id = s.stil_id
      AND g_next.aktiv = 1
      AND g_next.reihenfolge = (
        SELECT MIN(g2.reihenfolge)
        FROM graduierungen g2
        WHERE g2.stil_id = s.stil_id
        AND g2.aktiv = 1
        AND (g_current.reihenfolge IS NULL OR g2.reihenfolge > g_current.reihenfolge)
      )
    )
    ${whereClause}
    AND m.aktiv = 1
    AND g_next.graduierung_id IS NOT NULL
    ORDER BY berechtigt DESC, s.name ASC, m.nachname ASC, m.vorname ASC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Fehler beim Ermitteln der Prüfungskandidaten:', err);
      return res.status(500).json({
        error: 'Fehler beim Laden der Prüfungskandidaten',
        details: err.message
      });
    }

    const kandidaten = results.map(row => ({
      ...row,
      berechtigt: row.berechtigt === 1,
      bereits_zugelassen: row.bereits_zugelassen > 0,
      fortschritt_prozent: row.benoetigte_stunden > 0
        ? Math.min(100, Math.round((row.absolvierte_stunden / row.benoetigte_stunden) * 100))
        : 0
    }));

    const berechtigteCount = kandidaten.filter(k => k.berechtigt).length;
    res.json({
      success: true,
      count: kandidaten.length,
      berechtigt_count: berechtigteCount,
      kandidaten
    });
  });
});

/**
 * POST /api/pruefungen/kandidaten/:mitglied_id/zulassen
 * Mitglied für Prüfung zulassen
 */
router.post('/kandidaten/:mitglied_id/zulassen', (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id);
  const {
    stil_id,
    graduierung_nachher_id,
    pruefungsdatum,
    pruefungsort,
    pruefungsgebuehr,
    anmeldefrist,
    gurtlaenge,
    bemerkungen,
    teilnahmebedingungen,
    dojo_id
  } = req.body;
  if (!mitglied_id || !stil_id || !graduierung_nachher_id || !dojo_id) {
    return res.status(400).json({
      error: 'Fehlende erforderliche Felder',
      required: ['mitglied_id', 'stil_id', 'graduierung_nachher_id', 'dojo_id']
    });
  }

  // Prüfe ob dojo_id existiert
  const checkDojoQuery = 'SELECT id FROM dojo WHERE id = ?';
  db.query(checkDojoQuery, [dojo_id], (dojoErr, dojoResults) => {
    if (dojoErr) {
      console.error('Fehler beim Prüfen des Dojos:', dojoErr);
      return res.status(500).json({
        error: 'Fehler beim Prüfen des Dojos',
        details: dojoErr.message
      });
    }

    if (dojoResults.length === 0) {
      console.error(`Dojo mit ID ${dojo_id} existiert nicht`);
      return res.status(400).json({
        error: `Dojo mit ID ${dojo_id} existiert nicht`,
        details: 'Bitte wählen Sie ein gültiges Dojo aus'
      });
    }

    // Hole aktuelle Graduierung
    const getCurrentGradQuery = `
      SELECT current_graduierung_id
      FROM mitglied_stil_data
      WHERE mitglied_id = ? AND stil_id = ?
    `;

    db.query(getCurrentGradQuery, [mitglied_id, stil_id], (gradErr, gradResults) => {
    if (gradErr) {
      console.error('Fehler beim Abrufen der aktuellen Graduierung:', gradErr);
      return res.status(500).json({
        error: 'Fehler beim Abrufen der aktuellen Graduierung',
        details: gradErr.message
      });
    }

    const graduierung_vorher_id = gradResults.length > 0 ? gradResults[0].current_graduierung_id : null;

    // Erstelle Prüfungseintrag mit Status "geplant"
    const insertQuery = `
      INSERT INTO pruefungen (
        mitglied_id, stil_id, dojo_id,
        graduierung_vorher_id, graduierung_nachher_id,
        pruefungsdatum, pruefungszeit, pruefungsort, pruefungsgebuehr,
        anmeldefrist, gurtlaenge, bemerkungen, teilnahmebedingungen,
        status, bestanden,
        erstellt_am, aktualisiert_am
      ) VALUES (
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        'geplant', FALSE,
        NOW(), NOW()
      )
    `;

    // Setze Standard-Datum wenn keines angegeben: heute + 30 Tage
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    const finalPruefungsdatum = pruefungsdatum || defaultDate.toISOString().split('T')[0];

    // Parse pruefungszeit from request body or use default
    const { pruefungszeit = '10:00' } = req.body;

    const insertValues = [
      mitglied_id,
      stil_id,
      dojo_id,
      graduierung_vorher_id,
      graduierung_nachher_id,
      finalPruefungsdatum,
      pruefungszeit || '10:00',
      pruefungsort || null,
      pruefungsgebuehr || null,
      anmeldefrist || null,
      gurtlaenge || null,
      bemerkungen || null,
      teilnahmebedingungen || null
    ];

    db.query(insertQuery, insertValues, (insertErr, result) => {
      if (insertErr) {
        console.error('Fehler beim Zulassen zur Prüfung:', insertErr);
        return res.status(500).json({
          error: 'Fehler beim Zulassen zur Prüfung',
          details: insertErr.message
        });
      }

      const pruefung_id = result.insertId;
      // Optional: Benachrichtigung erstellen
      const notificationQuery = `
        INSERT INTO notifications (
          recipient_type, recipient_id, title, message,
          notification_type, priority, action_url,
          created_at
        ) VALUES (
          'mitglied', ?, 'Prüfungszulassung',
          'Sie wurden für eine Gürtelprüfung zugelassen!',
          'pruefung', 'high', '/member/pruefungen',
          NOW()
        )
      `;

      db.query(notificationQuery, [mitglied_id], (notifErr) => {
        if (notifErr) {
        }
      });

      res.status(201).json({
        success: true,
        message: 'Mitglied erfolgreich zur Prüfung zugelassen',
        pruefung_id,
        mitglied_id,
        benachrichtigung_gesendet: true
      });
    });
    });
  });
});

/**
 * DELETE /api/pruefungen/kandidaten/:mitglied_id/zulassung/:pruefung_id
 * Zulassung zur Prüfung widerrufen
 */
router.delete('/kandidaten/:mitglied_id/zulassung/:pruefung_id', (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id);
  const pruefung_id = parseInt(req.params.pruefung_id);
  const deleteQuery = `
    DELETE FROM pruefungen
    WHERE pruefung_id = ? AND mitglied_id = ? AND status = 'geplant'
  `;

  db.query(deleteQuery, [pruefung_id, mitglied_id], (err, result) => {
    if (err) {
      console.error('Fehler beim Widerrufen der Zulassung:', err);
      return res.status(500).json({
        error: 'Fehler beim Widerrufen der Zulassung',
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Prüfung nicht gefunden oder bereits durchgeführt' });
    }
    res.json({
      success: true,
      message: 'Zulassung erfolgreich widerrufen'
    });
  });
});

/**
 * POST /api/pruefungen/:pruefung_id/teilnahme-bestaetigen
 * Mitglied bestätigt Teilnahme an Prüfung
 */
router.post('/:pruefung_id/teilnahme-bestaetigen', (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  const { mitglied_id } = req.body;
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });
  }

  if (!mitglied_id) {
    return res.status(400).json({ error: 'Mitglied-ID erforderlich' });
  }

  // Prüfe ob Prüfung existiert und dem Mitglied gehört
  const checkQuery = `
    SELECT pruefung_id, mitglied_id, status, teilnahme_bestaetigt
    FROM pruefungen
    WHERE pruefung_id = ? AND mitglied_id = ?
  `;

  db.query(checkQuery, [pruefung_id, mitglied_id], (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Fehler beim Prüfen der Prüfung:', checkErr);
      return res.status(500).json({
        error: 'Fehler beim Prüfen der Prüfung',
        details: checkErr.message
      });
    }

    if (checkResults.length === 0) {
      return res.status(404).json({ error: 'Prüfung nicht gefunden' });
    }

    const pruefung = checkResults[0];

    if (pruefung.status !== 'geplant') {
      return res.status(400).json({ error: 'Prüfung ist nicht im Status "geplant"' });
    }

    if (pruefung.teilnahme_bestaetigt) {
      return res.status(400).json({ error: 'Teilnahme wurde bereits bestätigt' });
    }

    // Aktualisiere Teilnahmebestätigung
    const updateQuery = `
      UPDATE pruefungen
      SET teilnahme_bestaetigt = TRUE,
          teilnahme_bestaetigt_am = NOW(),
          aktualisiert_am = NOW()
      WHERE pruefung_id = ?
    `;

    db.query(updateQuery, [pruefung_id], (updateErr, updateResult) => {
      if (updateErr) {
        console.error('Fehler beim Bestätigen der Teilnahme:', updateErr);
        return res.status(500).json({
          error: 'Fehler beim Bestätigen der Teilnahme',
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
 * GET /api/pruefungen/heute
 * Holt alle Prüfungen für ein bestimmtes Datum (Live-Prüfungsansicht)
 */
router.get('/heute', (req, res) => {
  const { datum, dojo_id } = req.query;

  if (!datum) {
    return res.status(400).json({ error: 'Datum ist erforderlich' });
  }

  let whereClause = 'WHERE p.pruefungsdatum = ? AND p.status IN (\'geplant\', \'durchgefuehrt\', \'bestanden\', \'nicht_bestanden\')';
  let queryParams = [datum];

  if (dojo_id && dojo_id !== 'all') {
    whereClause += ' AND p.dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT
      p.pruefung_id,
      p.mitglied_id,
      p.stil_id,
      p.pruefungsdatum,
      p.pruefungszeit,
      p.pruefungsort,
      p.graduierung_vorher_id,
      p.graduierung_nachher_id,
      p.status,
      p.bestanden,
      p.punktzahl,
      p.max_punktzahl,
      p.prueferkommentar,
      p.dojo_id,

      m.vorname,
      m.nachname,
      m.email,
      m.geburtsdatum,

      s.name as stil_name,
      s.beschreibung as stil_beschreibung,

      g_vorher.name as graduierung_vorher_name,
      g_vorher.farbe_hex as graduierung_vorher_farbe,

      g_nachher.name as graduierung_nachher_name,
      g_nachher.farbe_hex as graduierung_nachher_farbe

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
      console.error('Fehler beim Abrufen der Prüfungen für heute:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    res.json(results);
  });
});

/**
 * GET /api/pruefungen/mitglied/:mitglied_id/historie
 * Prüfungshistorie eines Mitglieds
 */
router.get('/mitglied/:mitglied_id/historie', (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id);
  const { stil_id } = req.query;
  if (!mitglied_id || isNaN(mitglied_id)) {
    return res.status(400).json({ error: 'Ungültige Mitglieds-ID' });
  }

  let whereClause = 'WHERE p.mitglied_id = ?';
  let queryParams = [mitglied_id];

  if (stil_id) {
    whereClause += ' AND p.stil_id = ?';
    queryParams.push(parseInt(stil_id));
  }

  const query = `
    SELECT
      p.*,
      s.name as stil_name,
      g_vorher.name as graduierung_vorher,
      g_vorher.farbe_hex as farbe_vorher,
      g_nachher.name as graduierung_nachher,
      g_nachher.farbe_hex as farbe_nachher,
      g_nachher.dan_grad
    FROM pruefungen p
    INNER JOIN stile s ON p.stil_id = s.stil_id
    LEFT JOIN graduierungen g_vorher ON p.graduierung_vorher_id = g_vorher.graduierung_id
    INNER JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
    ${whereClause}
    ORDER BY p.pruefungsdatum DESC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error(`Fehler beim Abrufen der Historie für Mitglied ${mitglied_id}:`, err);
      return res.status(500).json({
        error: 'Fehler beim Laden der Prüfungshistorie',
        details: err.message
      });
    }
    res.json({
      success: true,
      mitglied_id,
      count: results.length,
      historie: results
    });
  });
});

/**
 * GET /api/pruefungen/status/anstehend
 * Anstehende Prüfungen (geplant, in naher Zukunft)
 */
router.get('/status/anstehend', (req, res) => {
  const { dojo_id, tage = 30 } = req.query;
  let whereClause = 'WHERE p.status = \'geplant\' AND p.pruefungsdatum >= CURDATE()';
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
      m.vorname,
      m.nachname,
      m.email,
      s.name as stil_name,
      g.name as angestrebte_graduierung,
      g.farbe_hex,
      g.dan_grad,
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
      console.error('Fehler beim Abrufen anstehender Prüfungen:', err);
      return res.status(500).json({
        error: 'Fehler beim Laden anstehender Prüfungen',
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

/**
 * GET /api/pruefungen/stats/statistiken
 * Prüfungsstatistiken
 */
router.get('/stats/statistiken', (req, res) => {
  const { dojo_id, jahr } = req.query;
  let whereClause = '';
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereClause = 'WHERE dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  if (jahr) {
    whereClause += (whereClause ? ' AND' : 'WHERE') + ' YEAR(pruefungsdatum) = ?';
    queryParams.push(parseInt(jahr));
  }

  // WHERE-Clause für Gurtverteilung (nur dojo_id, kein Jahr)
  let gurtWhereClause = '';
  let gurtQueryParams = [];
  if (dojo_id && dojo_id !== 'all') {
    gurtWhereClause = 'AND m.dojo_id = ?';
    gurtQueryParams.push(parseInt(dojo_id));
  }

  const queries = {
    gesamt: `
      SELECT
        COUNT(*) as gesamt,
        SUM(CASE WHEN bestanden = 1 THEN 1 ELSE 0 END) as bestanden,
        SUM(CASE WHEN bestanden = 0 AND status = 'nicht_bestanden' THEN 1 ELSE 0 END) as nicht_bestanden,
        SUM(CASE WHEN status = 'geplant' THEN 1 ELSE 0 END) as geplant
      FROM pruefungen
      ${whereClause}
    `,
    nach_stil: `
      SELECT
        s.name as stil_name,
        COUNT(*) as anzahl,
        SUM(CASE WHEN p.bestanden = 1 THEN 1 ELSE 0 END) as bestanden
      FROM pruefungen p
      INNER JOIN stile s ON p.stil_id = s.stil_id
      ${whereClause}
      GROUP BY s.stil_id, s.name
      ORDER BY anzahl DESC
    `,
    nach_monat: `
      SELECT
        YEAR(pruefungsdatum) as jahr,
        MONTH(pruefungsdatum) as monat,
        COUNT(*) as anzahl,
        SUM(CASE WHEN bestanden = 1 THEN 1 ELSE 0 END) as bestanden
      FROM pruefungen
      ${whereClause}
      GROUP BY YEAR(pruefungsdatum), MONTH(pruefungsdatum)
      ORDER BY jahr DESC, monat DESC
      LIMIT 12
    `,
    gurtverteilung: `
      SELECT
        g.name as graduierung_name,
        g.farbe_hex as farbe,
        g.reihenfolge,
        s.name as stil_name,
        COUNT(DISTINCT m.mitglied_id) as anzahl
      FROM mitglieder m
      INNER JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
      INNER JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
      INNER JOIN stile s ON g.stil_id = s.stil_id
      WHERE m.aktiv = 1
      ${gurtWhereClause}
      GROUP BY g.graduierung_id, g.name, g.farbe_hex, g.reihenfolge, s.name
      ORDER BY s.name ASC, g.reihenfolge ASC
    `
  };

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(queries.gesamt, queryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries.nach_stil, queryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries.nach_monat, queryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries.gurtverteilung, gurtQueryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([gesamt, nach_stil, nach_monat, gurtverteilung]) => {
    res.json({
      success: true,
      statistiken: {
        gesamt,
        nach_stil,
        nach_monat,
        gurtverteilung
      }
    });
  })
  .catch(err => {
    console.error('Fehler bei Prüfungsstatistiken:', err);
    res.status(500).json({
      error: 'Fehler beim Erstellen der Statistiken',
      details: err.message
    });
  });
});

/**
 * GET /api/pruefungen/:id/urkunde/download
 * Urkunde als PDF herunterladen
 */
router.get('/:id/urkunde/download', async (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });
  }

  try {
    // Hole Prüfungsdaten mit allen erforderlichen Details
    const query = `
      SELECT
        p.*,
        m.vorname,
        m.nachname,
        m.geburtsdatum,
        m.email,
        s.name as stil_name,
        d.dojoname,
        d.ort,
        g_nachher.name as graduierung_nachher,
        g_nachher.farbe_hex
      FROM pruefungen p
      INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
      INNER JOIN stile s ON p.stil_id = s.stil_id
      INNER JOIN dojo d ON p.dojo_id = d.id
      INNER JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
      WHERE p.pruefung_id = ? AND p.bestanden = 1
    `;

    db.query(query, [pruefung_id], async (err, results) => {
      if (err) {
        console.error(`Fehler beim Abrufen der Prüfungsdaten:`, err);
        return res.status(500).json({
          error: 'Fehler beim Abrufen der Prüfungsdaten',
          details: err.message
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          error: 'Prüfung nicht gefunden oder nicht bestanden'
        });
      }

      const pruefung = results[0];

      // Generiere Urkunden-Nummer falls noch nicht vorhanden
      let urkundeNr = pruefung.urkunde_nr;
      if (!urkundeNr) {
        urkundeNr = pdfGenerator.generateUrkundenNr(
          pruefung_id,
          pruefung.dojo_id,
          pruefung.pruefungsdatum
        );

        // Speichere Urkunden-Nummer in Datenbank
        db.query(
          'UPDATE pruefungen SET urkunde_nr = ?, urkunde_ausgestellt = 1 WHERE pruefung_id = ?',
          [urkundeNr, pruefung_id],
          (updateErr) => {
            if (updateErr) {
            }
          }
        );
      }

      // Bereite Daten für PDF-Generator vor
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
        // Generiere PDF
        const pdfBuffer = await pdfGenerator.generateUrkundePDF(
          pruefungData,
          memberData,
          dojoData
        );

        // Setze Response-Header für PDF-Download
        const filename = `Urkunde_${pruefung.nachname}_${pruefung.vorname}_${urkundeNr}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);

      } catch (pdfErr) {
        console.error('Fehler beim Generieren des PDFs:', pdfErr);
        res.status(500).json({
          error: 'Fehler beim Generieren der Urkunde',
          details: pdfErr.message
        });
      }
    });

  } catch (err) {
    console.error('Unerwarteter Fehler:', err);
    res.status(500).json({
      error: 'Interner Server-Fehler',
      details: err.message
    });
  }
});

/**
 * POST /api/pruefungen/:id/graduierung-aktualisieren
 * Aktualisiert die Graduierung eines Mitglieds nach bestandener Prüfung
 */
router.post('/:id/graduierung-aktualisieren', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });
  }

  // Hole Prüfungsdaten
  const selectQuery = `
    SELECT
      p.mitglied_id,
      p.stil_id,
      p.graduierung_nachher_id,
      p.pruefungsdatum,
      p.bestanden
    FROM pruefungen p
    WHERE p.pruefung_id = ?
  `;

  db.query(selectQuery, [pruefung_id], (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen der Prüfung:', err);
      return res.status(500).json({
        error: 'Fehler beim Abrufen der Prüfung',
        details: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Prüfung nicht gefunden' });
    }

    const pruefung = results[0];

    if (!pruefung.bestanden) {
      return res.status(400).json({
        error: 'Graduierung kann nur bei bestandener Prüfung aktualisiert werden'
      });
    }

    // Aktualisiere mitglied_stil_data
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
      [
        pruefung.mitglied_id,
        pruefung.stil_id,
        pruefung.graduierung_nachher_id,
        pruefung.pruefungsdatum
      ],
      (updateErr, updateResult) => {
        if (updateErr) {
          console.error('Fehler beim Aktualisieren der Graduierung:', updateErr);
          return res.status(500).json({
            error: 'Fehler beim Aktualisieren der Graduierung',
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
 * POST /api/pruefungen/:id/status-aendern
 * Ändert den Status einer Prüfung und setzt die Graduierung zurück/vor
 */
router.post('/:id/status-aendern', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  const {
    bestanden,
    mitglied_id,
    stil_id,
    graduierung_vorher_id,
    graduierung_nachher_id
  } = req.body;

  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });
  }

  if (bestanden === undefined) {
    return res.status(400).json({ error: 'Bestanden-Status erforderlich' });
  }

  // Starte Transaktion
  db.getConnection((err, connection) => {
    if (err) {
      console.error('Fehler beim Holen der Verbindung:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    connection.beginTransaction(transErr => {
      if (transErr) {
        connection.release();
        return res.status(500).json({ error: 'Fehler beim Starten der Transaktion' });
      }

      // 1. Aktualisiere Prüfungsstatus (Status bleibt "bestanden", nur bestanden-Feld ändert sich)
      const updatePruefungQuery = `
        UPDATE pruefungen
        SET bestanden = ?, aktualisiert_am = NOW()
        WHERE pruefung_id = ?
      `;

      connection.query(updatePruefungQuery, [bestanden, pruefung_id], (updateErr) => {
        if (updateErr) {
          return connection.rollback(() => {
            connection.release();
            console.error('Fehler beim Aktualisieren der Prüfung:', updateErr);
            res.status(500).json({ error: 'Fehler beim Aktualisieren der Prüfung' });
          });
        }

        // 2. Aktualisiere Graduierung in mitglied_stil_data
        const graduierung_id = bestanden ? graduierung_nachher_id : graduierung_vorher_id;

        // Hole Prüfungsdatum für letzte_pruefung Update
        const getPruefungQuery = 'SELECT pruefungsdatum FROM pruefungen WHERE pruefung_id = ?';
        connection.query(getPruefungQuery, [pruefung_id], (getPruefungErr, pruefungResults) => {
          if (getPruefungErr) {
            return connection.rollback(() => {
              connection.release();
              console.error('Fehler beim Abrufen der Prüfung:', getPruefungErr);
              res.status(500).json({ error: 'Fehler beim Abrufen der Prüfung' });
            });
          }

          const pruefungsdatum = pruefungResults[0]?.pruefungsdatum;

          // Bei bestanden=true: Setze current_graduierung_id UND letzte_pruefung
          // Bei bestanden=false: Setze nur current_graduierung_id zurück
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

          connection.query(
            updateGraduierungQuery,
            queryParams,
            (gradErr) => {
            if (gradErr) {
              return connection.rollback(() => {
                connection.release();
                console.error('Fehler beim Aktualisieren der Graduierung:', gradErr);
                res.status(500).json({ error: 'Fehler beim Aktualisieren der Graduierung' });
              });
            }

            // Commit Transaktion
            connection.commit(commitErr => {
              if (commitErr) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('Fehler beim Commit:', commitErr);
                  res.status(500).json({ error: 'Fehler beim Speichern' });
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
          }
        );
        });
      });
    });
  });
});

// ============================================================================
// PRÜFUNGEN - CRUD OPERATIONS
// ============================================================================

/**
 * GET /api/pruefungen
 * Alle Prüfungen abrufen mit optionalen Filtern
 */
router.get('/', (req, res) => {
  console.log('🔥 GET /api/pruefungen aufgerufen mit:', req.query);
  const {
    dojo_id,
    mitglied_id,
    stil_id,
    status,
    von_datum,
    bis_datum,
    bestanden,
    limit = 100,
    offset = 0
  } = req.query;

  // Dynamische WHERE-Bedingungen
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
    // Unterstütze mehrere Status mit Komma-Trennung (z.B. "bestanden,nicht_bestanden")
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
      p.*,
      m.vorname,
      m.nachname,
      m.email,
      s.name as stil_name,
      d.dojoname,
      g_vorher.name as graduierung_vorher,
      g_vorher.farbe_hex as farbe_vorher,
      g_nachher.name as graduierung_nachher,
      g_nachher.farbe_hex as farbe_nachher,
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
      console.error('Fehler beim Abrufen der Prüfungen:', err);
      console.error('SQL Query:', query);
      console.error('Query Params:', queryParams);
      return res.status(500).json({
        success: false,
        error: 'Fehler beim Laden der Prüfungen',
        details: err.message
      });
    }

    console.log('📋 Prüfungen geladen:', results.length, 'Einträge');
    if (results.length > 0) {
      console.log('📋 Beispiel:', JSON.stringify(results[0], null, 2));
    }

    // Formatiere DATE-Felder um Zeitzonen-Probleme zu vermeiden
    const formattedResults = results.map(pruefung => {
      const formatDate = (dateValue) => {
        if (!dateValue) return null;

        // MySQL gibt DATE als Date-Objekt zurück
        if (dateValue instanceof Date) {
          const year = dateValue.getFullYear();
          const month = String(dateValue.getMonth() + 1).padStart(2, '0');
          const day = String(dateValue.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }

        // Falls es bereits ein String ist, extrahiere YYYY-MM-DD
        if (typeof dateValue === 'string') {
          return dateValue.split('T')[0];
        }

        return null;
      };

      return {
        ...pruefung,
        pruefungsdatum: formatDate(pruefung.pruefungsdatum),
        anmeldefrist: formatDate(pruefung.anmeldefrist),
        bezahldatum: formatDate(pruefung.bezahldatum)
      };
    });

    res.json({
      success: true,
      count: formattedResults.length,
      pruefungen: formattedResults
    });
  });
});

/**
 * GET /api/pruefungen/:id
 * Einzelne Prüfung mit allen Details abrufen
 */
router.get('/:id', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });
  }

  const query = `
    SELECT
      p.*,
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.telefon_mobil,
      s.stil_id,
      s.name as stil_name,
      d.id as dojo_id,
      d.dojoname,
      g_vorher.graduierung_id as graduierung_vorher_id,
      g_vorher.name as graduierung_vorher,
      g_vorher.farbe_hex as farbe_vorher,
      g_vorher.farbe_sekundaer as farbe_vorher_sekundaer,
      g_nachher.graduierung_id as graduierung_nachher_id,
      g_nachher.name as graduierung_nachher,
      g_nachher.farbe_hex as farbe_nachher,
      g_nachher.farbe_sekundaer as farbe_nachher_sekundaer,
      g_nachher.dan_grad,
      g_nachher.kategorie
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
      console.error(`Fehler beim Abrufen von Prüfung ${pruefung_id}:`, err);
      return res.status(500).json({
        error: 'Fehler beim Laden der Prüfung',
        details: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Prüfung nicht gefunden' });
    }
    res.json({
      success: true,
      pruefung: results[0]
    });
  });
});

/**
 * POST /api/pruefungen
 * Neue Prüfung erstellen
 */
router.post('/', (req, res) => {
  const pruefungData = req.body;

  // Validierung
  const errors = validatePruefungData(pruefungData);
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validierungsfehler',
      errors
    });
  }

  // Felder für INSERT vorbereiten
  const {
    mitglied_id,
    stil_id,
    dojo_id,
    graduierung_vorher_id = null,
    graduierung_nachher_id,
    pruefungsdatum,
    pruefungsort = null,
    bestanden = false,
    punktzahl = null,
    max_punktzahl = null,
    pruefer_id = null,
    prueferkommentar = null,
    pruefungsgebuehr = null,
    gebuehr_bezahlt = false,
    bezahldatum = null,
    urkunde_ausgestellt = false,
    urkunde_nr = null,
    urkunde_pfad = null,
    dokumente_pfad = null,
    pruefungsinhalte = null,
    einzelbewertungen = null,
    status = 'geplant',
    anmerkungen = null,
    erstellt_von = null,
    ist_historisch = false,
    historisch_bemerkung = null
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
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      NOW()
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
      console.error('Fehler beim Erstellen der Prüfung:', err);
      return res.status(500).json({
        error: 'Fehler beim Erstellen der Prüfung',
        details: err.message
      });
    }

    const newPruefungId = result.insertId;
    // Erstellte Prüfung zurückholen
    const selectQuery = `
      SELECT p.*, m.vorname, m.nachname, s.name as stil_name
      FROM pruefungen p
      INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
      INNER JOIN stile s ON p.stil_id = s.stil_id
      WHERE p.pruefung_id = ?
    `;

    db.query(selectQuery, [newPruefungId], (selectErr, selectResults) => {
      if (selectErr) {
        console.error('Fehler beim Abrufen der neuen Prüfung:', selectErr);
        return res.status(201).json({
          success: true,
          pruefung_id: newPruefungId,
          message: 'Prüfung erstellt, aber Fehler beim Abrufen'
        });
      }

      res.status(201).json({
        success: true,
        pruefung_id: newPruefungId,
        message: 'Prüfung erfolgreich erstellt',
        pruefung: selectResults[0]
      });
    });
  });
});

/**
 * PUT /api/pruefungen/:id
 * Prüfung aktualisieren
 */
router.put('/:id', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });
  }

  const updateData = req.body;

  // Erlaubte Felder für Update
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
      // JSON-Felder serialisieren
      if (field === 'pruefungsinhalte' || field === 'einzelbewertungen') {
        values.push(JSON.stringify(updateData[field]));
      } else {
        values.push(updateData[field]);
      }
    }
  });

  if (setClause.length === 0) {
    return res.status(400).json({ error: 'Keine gültigen Felder zum Update gefunden' });
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
      console.error(`Fehler beim Aktualisieren von Prüfung ${pruefung_id}:`, err);
      return res.status(500).json({
        error: 'Fehler beim Aktualisieren der Prüfung',
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Prüfung nicht gefunden' });
    }

    // Aktualisierte Prüfung zurückholen
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
          message: 'Prüfung aktualisiert'
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
          [
            pruefung.mitglied_id,
            pruefung.stil_id,
            pruefung.graduierung_nachher_id,
            pruefung.pruefungsdatum
          ],
          (stilDataErr) => {
            if (stilDataErr) {
              console.error('Fehler beim Aktualisieren von mitglied_stil_data:', stilDataErr);
              // Prüfung wurde trotzdem aktualisiert, nur Log-Warnung
            }
          }
        );
      }

      res.json({
        success: true,
        message: 'Prüfung erfolgreich aktualisiert',
        pruefung: pruefung
      });
    });
  });
});

/**
 * DELETE /api/pruefungen/:id
 * Prüfung löschen
 */
router.delete('/:id', (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id || isNaN(pruefung_id)) {
    return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });
  }

  const deleteQuery = 'DELETE FROM pruefungen WHERE pruefung_id = ?';

  db.query(deleteQuery, [pruefung_id], (err, result) => {
    if (err) {
      console.error(`Fehler beim Löschen von Prüfung ${pruefung_id}:`, err);
      return res.status(500).json({
        error: 'Fehler beim Löschen der Prüfung',
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Prüfung nicht gefunden' });
    }
    res.json({
      success: true,
      message: 'Prüfung erfolgreich gelöscht',
      pruefung_id
    });
  });
});

/**
 * GET /api/pruefungen/termine/:datum/pdf
 * Generiert eine PDF mit allen Prüfungsteilnehmern für einen bestimmten Termin
 */
router.get('/termine/:datum/pdf', (req, res) => {
  const { datum } = req.params;
  const { stil_id, dojo_id } = req.query;

  console.log('📄 PDF-Anfrage:', { datum, stil_id, dojo_id });

  const query = `
    SELECT
      p.pruefung_id,
      p.mitglied_id,
      m.vorname,
      m.nachname,
      m.geburtsdatum,
      g_vorher.name AS aktuelle_graduierung,
      g_nachher.name AS ziel_graduierung,
      p.pruefungsdatum,
      s.name AS stil_name,
      pt.pruefungszeit,
      pt.pruefungsort,
      pt.pruefungsgebuehr,
      d.dojoname AS dojo_name
    FROM pruefungen p
    INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
    LEFT JOIN graduierungen g_vorher ON p.graduierung_vorher_id = g_vorher.graduierung_id
    LEFT JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
    INNER JOIN stile s ON p.stil_id = s.stil_id
    LEFT JOIN pruefungstermin_vorlagen pt ON DATE(p.pruefungsdatum) = DATE(pt.pruefungsdatum) AND p.stil_id = pt.stil_id
    LEFT JOIN dojo d ON p.dojo_id = d.id
    WHERE DATE(p.pruefungsdatum) = ?
      AND p.stil_id = ?
      AND p.dojo_id = ?
      AND p.status IN ('geplant', 'durchgefuehrt', 'bestanden', 'nicht_bestanden')
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, [datum, stil_id, dojo_id], (err, results) => {
    if (err) {
      console.error('❌ Fehler beim Laden der Prüfungsteilnehmer:', err);
    } else {
      console.log(`✅ ${results.length} Teilnehmer gefunden`);
    }
    if (err) {
      console.error('Fehler beim Laden der Prüfungsteilnehmer:', err);
      return res.status(500).json({
        error: 'Fehler beim Laden der Teilnehmer',
        details: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        error: 'Keine Teilnehmer für diesen Termin gefunden'
      });
    }

    // Generiere PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Pruefungsliste_${datum}_${results[0].stil_name}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // PDF Inhalt
    const teilnehmer = results[0];

    // Header
    doc.fontSize(20).text('Prüfungsteilnehmerliste', { align: 'center' });
    doc.moveDown(0.5);

    // Termin-Infos
    doc.fontSize(12);
    doc.text(`Datum: ${new Date(datum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    doc.text(`Uhrzeit: ${teilnehmer.pruefungszeit || 'Nicht angegeben'}`);
    doc.text(`Ort: ${teilnehmer.pruefungsort || 'Nicht angegeben'}`);
    doc.text(`Stil: ${teilnehmer.stil_name}`);
    doc.text(`Dojo: ${teilnehmer.dojo_name}`);
    if (teilnehmer.pruefungsgebuehr) {
      doc.text(`Prüfungsgebühr: ${teilnehmer.pruefungsgebuehr}€`);
    }
    doc.text(`Anzahl Teilnehmer: ${results.length}`);
    doc.moveDown(1);

    // Tabellen-Header
    const tableTop = doc.y;
    const col1X = 50;  // Nr.
    const col2X = 80;  // Name
    const col3X = 250; // Geburtsdatum
    const col4X = 350; // Aktuell
    const col5X = 450; // Ziel

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Nr.', col1X, tableTop);
    doc.text('Name', col2X, tableTop);
    doc.text('Geb.', col3X, tableTop);
    doc.text('Aktuell', col4X, tableTop);
    doc.text('Ziel', col5X, tableTop);

    doc.moveTo(col1X, tableTop + 15).lineTo(560, tableTop + 15).stroke();
    doc.moveDown(0.5);

    // Teilnehmer-Liste
    doc.font('Helvetica');
    results.forEach((teilnehmer, index) => {
      const y = doc.y;

      // Neue Seite wenn nötig
      if (y > 700) {
        doc.addPage();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Nr.', col1X, 50);
        doc.text('Name', col2X, 50);
        doc.text('Geb.', col3X, 50);
        doc.text('Aktuell', col4X, 50);
        doc.text('Ziel', col5X, 50);
        doc.moveTo(col1X, 65).lineTo(560, 65).stroke();
        doc.font('Helvetica').moveDown(0.5);
      }

      const currentY = doc.y;
      doc.text(index + 1, col1X, currentY);
      doc.text(`${teilnehmer.nachname}, ${teilnehmer.vorname}`, col2X, currentY, { width: 160 });
      doc.text(teilnehmer.geburtsdatum ? new Date(teilnehmer.geburtsdatum).toLocaleDateString('de-DE') : '-', col3X, currentY);
      doc.text(teilnehmer.aktuelle_graduierung || '-', col4X, currentY, { width: 90 });
      doc.text(teilnehmer.ziel_graduierung || '-', col5X, currentY, { width: 70 });
      doc.text(teilnehmer.gebuehr_bezahlt ? '✓' : 'offen', col6X, currentY, { width: 60 });

      doc.moveDown(0.8);
    });

    // Unterschriften-Bereich
    doc.moveDown(3);
    doc.fontSize(10);
    doc.text('_'.repeat(40), 50, doc.y, { continued: true });
    doc.text('_'.repeat(40), 350, doc.y);
    doc.moveDown(0.3);
    doc.text('Prüfer', 50, doc.y, { continued: true });
    doc.text('Datum/Unterschrift', 350, doc.y);

    // Finalize PDF
    doc.end();
  });
});


// ==========================================
// HISTORISCHE PRÜFUNG FÜR MITGLIED HINZUFÜGEN
// ==========================================
router.post('/mitglied/:mitglied_id/historisch', (req, res) => {
  const { mitglied_id } = req.params;
  const {
    stil_id,
    dojo_id,
    graduierung_vorher_id,
    graduierung_nachher_id,
    pruefungsdatum,
    pruefungsort,
    historisch_bemerkung,
    pruefer_name
  } = req.body;

  console.log('📜 Historische Prüfung hinzufügen:', { mitglied_id, stil_id, graduierung_nachher_id, pruefungsdatum });

  if (!stil_id || !graduierung_nachher_id || !pruefungsdatum || !dojo_id) {
    return res.status(400).json({
      success: false,
      message: 'Stil, Ziel-Graduierung, Datum und Dojo sind erforderlich'
    });
  }

  const insertQuery = `
    INSERT INTO pruefungen (
      mitglied_id, stil_id, dojo_id,
      graduierung_vorher_id, graduierung_nachher_id,
      pruefungsdatum, pruefungsort,
      bestanden, status,
      ist_historisch, historisch_bemerkung,
      prueferkommentar,
      erstellt_am
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'bestanden', 1, ?, ?, NOW())
  `;

  const insertValues = [
    mitglied_id, stil_id, dojo_id,
    graduierung_vorher_id || null, graduierung_nachher_id,
    pruefungsdatum, pruefungsort || null,
    historisch_bemerkung || 'Historische Prüfung (nachträglich erfasst)',
    pruefer_name ? 'Prüfer: ' + pruefer_name : null
  ];

  db.query(insertQuery, insertValues, (err, result) => {
    if (err) {
      console.error('❌ Fehler beim Hinzufügen der historischen Prüfung:', err);
      return res.status(500).json({
        success: false,
        message: 'Fehler beim Speichern der historischen Prüfung',
        error: err.message
      });
    }

    // Graduierung des Mitglieds aktualisieren (für diesen Stil)
    const updateQuery = `
      UPDATE mitglied_stile
      SET current_graduierung_id = ?,
          letzte_pruefung = ?
      WHERE mitglied_id = ? AND stil_id = ?
    `;

    db.query(updateQuery, [graduierung_nachher_id, pruefungsdatum, mitglied_id, stil_id], (updateErr) => {
      if (updateErr) {
        console.warn('⚠️ Graduierung konnte nicht aktualisiert werden:', updateErr.message);
      }

      console.log('✅ Historische Prüfung erfolgreich hinzugefügt:', result.insertId);

      res.json({
        success: true,
        message: 'Historische Prüfung erfolgreich hinzugefügt',
        pruefung_id: result.insertId
      });
    });
  });
});

// Historische Prüfung löschen
router.delete('/historisch/:pruefung_id', (req, res) => {
  const { pruefung_id } = req.params;

  // Nur historische Prüfungen können gelöscht werden
  db.query(
    'SELECT * FROM pruefungen WHERE pruefung_id = ? AND ist_historisch = 1',
    [pruefung_id],
    (err, results) => {
      if (err) {
        console.error('❌ Fehler beim Suchen:', err);
        return res.status(500).json({
          success: false,
          message: 'Datenbankfehler',
          error: err.message
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Historische Prüfung nicht gefunden'
        });
      }

      db.query('DELETE FROM pruefungen WHERE pruefung_id = ?', [pruefung_id], (deleteErr) => {
        if (deleteErr) {
          console.error('❌ Fehler beim Löschen:', deleteErr);
          return res.status(500).json({
            success: false,
            message: 'Fehler beim Löschen',
            error: deleteErr.message
          });
        }

        res.json({
          success: true,
          message: 'Historische Prüfung gelöscht'
        });
      });
    }
  );
});

module.exports = router;
