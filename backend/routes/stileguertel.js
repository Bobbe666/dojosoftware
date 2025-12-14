// Backend/routes/stileguertel.js - VOLLSTÄNDIGE ERWEITERTE VERSION MIT ALLEN ENDPUNKTEN
const express = require('express');
const router = express.Router();
// Datenbankverbindung
const db = require("../db");
// ============================================================================
// TEST & DEBUG ENDPUNKT
// ============================================================================

// Test-Endpunkt für API-Verfügbarkeit
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Erweiterte Stil-Verwaltung API funktioniert perfekt',
    timestamp: new Date().toISOString(),
    database: db ? 'Verbunden und bereit' : 'Nicht verfügbar',
    features: [
      'Primär- und Sekundärfarben für Gürtel',
      'Gürtel-Kategorien (Grundstufe bis Meister)', 
      'DAN-Graduierungen mit automatischer Validierung',
      'Drag & Drop Reordering mit @dnd-kit Support',
      'Vollständiges CRUD für Stile und Graduierungen',
      'Erweiterte Statistiken und Analytics',
      'Transaktionale Sicherheit für Batch-Updates',
      'Touch-optimierte Mobile-Unterstützung'
    ],
    endpoints: {
      stile: [
        'GET / - Alle Stile mit Graduierungen',
        'GET /:id - Einzelner Stil mit Details', 
        'POST / - Neuen Stil erstellen',
        'PUT /:id - Stil aktualisieren',
        'DELETE /:id - Stil löschen (soft delete)'
      ],
      graduierungen: [
        'POST /:stilId/graduierungen - Graduierung hinzufügen',
        'PUT /graduierungen/:id - Graduierung aktualisieren', 
        'DELETE /graduierungen/:id - Graduierung löschen',
        'PUT /:stilId/graduierungen/reorder - Drag & Drop Reorder'
      ],
      statistiken: [
        'GET /:id/statistiken - Erweiterte Stil-Statistiken',
        'GET /kategorien/uebersicht - Kategorie-Übersicht'
      ]
    }
  });
});

// ============================================================================
// STIL-MANAGEMENT ENDPUNKTE
// ============================================================================

// GET - Alle Stile mit erweiterten Graduierungsfeldern abrufen
router.get('/', (req, res) => {
  // Datenbank verwenden
  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message
      });
    }

    // Optional: Filter nur aktive Stile
    const { aktiv } = req.query;
    const aktivFilter = aktiv === 'true' ? 'WHERE s.aktiv = 1' : '';

    // Query mit korrekter Mitglieder-Zählung über mitglied_stil_data
    const stilQuery = `
      SELECT
        s.stil_id,
        s.name,
        s.beschreibung,
        s.aktiv,
        s.reihenfolge,
        s.wartezeit_grundstufe,
        s.wartezeit_mittelstufe,
        s.wartezeit_oberstufe,
        s.wartezeit_schwarzgurt_traditionell,
        s.erstellt_am,
        s.aktualisiert_am,
        COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder
      FROM stile s
      LEFT JOIN mitglied_stil_data msd ON s.stil_id = msd.stil_id
      LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
      ${aktivFilter}
      GROUP BY s.stil_id, s.name, s.beschreibung, s.aktiv, s.reihenfolge, s.wartezeit_grundstufe, s.wartezeit_mittelstufe, s.wartezeit_oberstufe, s.wartezeit_schwarzgurt_traditionell, s.erstellt_am, s.aktualisiert_am
      ORDER BY s.aktiv DESC, s.reihenfolge ASC, s.name ASC
    `;

    connection.query(stilQuery, (stilError, stilRows) => {
      if (stilError) {
        console.error('Fehler beim Abrufen der Stile:', stilError);
        connection.release();
        return res.status(500).json({ 
          error: 'Fehler beim Abrufen der Stile',
          details: stilError.message 
        });
      }

      if (stilRows.length === 0) {
        connection.release();
        return res.json([]);
      }

      // Graduierungen für alle Stile abrufen - ERWEITERTE FELDER
      const stilIds = stilRows.map(stil => stil.stil_id);
      const graduierungQuery = `
        SELECT 
          graduierung_id,
          stil_id,
          name,
          reihenfolge,
          trainingsstunden_min,
          mindestzeit_monate,
          farbe_hex,
          farbe_sekundaer,
          kategorie,
          dan_grad,
          aktiv,
          erstellt_am,
          aktualisiert_am
        FROM graduierungen 
        WHERE stil_id IN (${stilIds.map(() => '?').join(',')}) AND aktiv = 1
        ORDER BY stil_id ASC, reihenfolge ASC
      `;

      connection.query(graduierungQuery, stilIds, (graduierungError, graduierungRows) => {
        connection.release(); // Connection immer freigeben

        if (graduierungError) {
          console.error('Fehler beim Abrufen der Graduierungen:', graduierungError);
          return res.status(500).json({ 
            error: 'Fehler beim Abrufen der Graduierungen',
            details: graduierungError.message 
          });
        }

        // Graduierungen zu Stilen zuordnen
        const stileWithGraduierungen = stilRows.map(stil => ({
          ...stil,
          graduierungen: graduierungRows.filter(grad => grad.stil_id === stil.stil_id)
        }));
        res.json(stileWithGraduierungen);
      });
    });
  });
});

// ============================================================================
// DRAG & DROP REORDERING FÜR STILE - MUSS VOR /:id ROUTEN STEHEN!
// ============================================================================

// PUT - Stile neu ordnen (Drag & Drop)
router.put('/reorder', (req, res) => {
  const { stile } = req.body;

  console.log('📥 Reorder Request received:', JSON.stringify(req.body, null, 2));

  if (!stile || !Array.isArray(stile)) {
    return res.status(400).json({ error: 'Stile-Array ist erforderlich' });
  }

  if (stile.length === 0) {
    return res.status(400).json({ error: 'Stile-Array darf nicht leer sein' });
  }

  // Validierung der Stil-Objekte
  for (const stil of stile) {
    console.log('🔍 Validiere Stil:', stil);
    if (!stil.stil_id || stil.reihenfolge === undefined) {
      console.error('❌ Ungültiges Stil-Objekt:', stil);
      return res.status(400).json({
        error: 'Jeder Stil muss stil_id und reihenfolge enthalten',
        invalid_object: stil
      });
    }
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message
      });
    }

    // Beginne Transaktion für atomare Updates
    connection.beginTransaction((transactionErr) => {
      if (transactionErr) {
        console.error('Fehler beim Starten der Transaktion:', transactionErr);
        connection.release();
        return res.status(500).json({
          error: 'Fehler beim Starten der Transaktion',
          details: transactionErr.message
        });
      }

      // Update alle Reihenfolgen
      let completedUpdates = 0;
      let hasError = false;

      stile.forEach((stil) => {
        const updateQuery = `
          UPDATE stile
          SET reihenfolge = ?, aktualisiert_am = NOW()
          WHERE stil_id = ?
        `;

        connection.query(updateQuery, [stil.reihenfolge, stil.stil_id], (updateError, result) => {
          if (updateError && !hasError) {
            hasError = true;
            console.error('Fehler beim Update der Stil-Reihenfolge:', updateError);

            connection.rollback(() => {
              connection.release();
              return res.status(500).json({
                error: 'Fehler beim Aktualisieren der Reihenfolge',
                details: updateError.message
              });
            });
            return;
          }

          completedUpdates++;

          // Wenn alle Updates abgeschlossen sind
          if (completedUpdates === stile.length && !hasError) {
            connection.commit((commitError) => {
              if (commitError) {
                console.error('Fehler beim Commit:', commitError);
                connection.rollback(() => {
                  connection.release();
                  return res.status(500).json({
                    error: 'Fehler beim Speichern der Änderungen',
                    details: commitError.message
                  });
                });
                return;
              }

              connection.release();
              console.log('✅ Reihenfolge erfolgreich aktualisiert:', completedUpdates, 'Stile');
              res.json({
                success: true,
                message: 'Reihenfolge erfolgreich aktualisiert',
                updated_count: completedUpdates
              });
            });
          }
        });
      });
    });
  });
});

// GET - Einzelnen Stil mit Details abrufen
router.get('/:id', (req, res) => {
  const stilId = parseInt(req.params.id);
  if (!stilId || isNaN(stilId)) {
    return res.status(400).json({ error: 'Ungültige Stil-ID' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    // Stil mit korrekter Mitglieder-Anzahl abrufen
    // Zählt Mitglieder über mitglied_stil_data
    const stilQuery = `
      SELECT
        s.*,
        COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder
      FROM stile s
      LEFT JOIN mitglied_stil_data msd ON s.stil_id = msd.stil_id
      LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
      WHERE s.stil_id = ? AND s.aktiv = 1
      GROUP BY s.stil_id
    `;

    connection.query(stilQuery, [stilId], (stilError, stilRows) => {
      if (stilError) {
        console.error(`Fehler beim Abrufen von Stil ${stilId}:`, stilError);
        connection.release();
        return res.status(500).json({ 
          error: 'Fehler beim Abrufen des Stils',
          details: stilError.message 
        });
      }

      if (stilRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Stil nicht gefunden' });
      }

      // Erweiterte Graduierungen mit allen Feldern abrufen
      const graduierungenQuery = `
        SELECT
          graduierung_id,
          name,
          reihenfolge,
          trainingsstunden_min,
          mindestzeit_monate,
          farbe_hex,
          farbe_sekundaer,
          kategorie,
          dan_grad,
          aktiv,
          erstellt_am,
          aktualisiert_am
        FROM graduierungen
        WHERE stil_id = ? AND aktiv = 1
        ORDER BY reihenfolge ASC
      `;

      connection.query(graduierungenQuery, [stilId], (graduierungError, graduierungRows) => {
        connection.release(); // Connection immer freigeben

        if (graduierungError) {
          console.error(`Fehler beim Abrufen der Graduierungen für Stil ${stilId}:`, graduierungError);
          return res.status(500).json({
            error: 'Fehler beim Abrufen der Graduierungen',
            details: graduierungError.message
          });
        }

        // Graduierungen ohne JSON-Parsing (pruefungsinhalte Spalte existiert nicht)
        const parsedGraduierungen = graduierungRows;

        const stilDetails = {
          ...stilRows[0],
          graduierungen: parsedGraduierungen
        };
        res.json(stilDetails);
      });
    });
  });
});

// GET - Graduierungen für einen Stil abrufen
router.get('/:stilId/graduierungen', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  if (!stilId || isNaN(stilId)) {
    return res.status(400).json({ error: 'Ungültige Stil-ID' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message
      });
    }

    const query = `
      SELECT
        graduierung_id AS id,
        graduierung_id,
        name,
        reihenfolge,
        trainingsstunden_min,
        mindestzeit_monate,
        farbe_hex,
        farbe_sekundaer,
        kategorie,
        dan_grad,
        aktiv,
        erstellt_am,
        aktualisiert_am
      FROM graduierungen
      WHERE stil_id = ? AND aktiv = 1
      ORDER BY reihenfolge ASC
    `;

    connection.query(query, [stilId], (error, rows) => {
      connection.release();

      if (error) {
        console.error(`Fehler beim Abrufen der Graduierungen für Stil ${stilId}:`, error);
        return res.status(500).json({
          error: 'Fehler beim Abrufen der Graduierungen',
          details: error.message
        });
      }

      res.json(rows);
    });
  });
});

// POST - Neuen Stil erstellen
router.post('/', (req, res) => {
  const {
    name,
    beschreibung,
    aktiv = true,
    wartezeit_grundstufe = 3,
    wartezeit_mittelstufe = 4,
    wartezeit_oberstufe = 6,
    wartezeit_schwarzgurt_traditionell = false
  } = req.body;

  // Erweiterte Validierung
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Stil-Name ist erforderlich' });
  }

  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'Stil-Name ist zu lang (max. 100 Zeichen)' });
  }

  if (beschreibung && beschreibung.length > 500) {
    return res.status(400).json({ error: 'Beschreibung ist zu lang (max. 500 Zeichen)' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    // Prüfen, ob Stil bereits existiert (aktiv oder inaktiv)
    const checkQuery = 'SELECT stil_id, aktiv FROM stile WHERE name = ?';
    connection.query(checkQuery, [name.trim()], (checkError, existingRows) => {
      if (checkError) {
        console.error('Fehler beim Prüfen des Stil-Namens:', checkError);
        connection.release();
        return res.status(500).json({
          error: 'Fehler beim Prüfen des Stil-Namens',
          details: checkError.message
        });
      }

      // Wenn aktiver Stil existiert, Fehler zurückgeben
      if (existingRows.length > 0 && (existingRows[0].aktiv === 1 || existingRows[0].aktiv === true)) {
        connection.release();
        return res.status(409).json({
          error: 'Ein aktiver Stil mit diesem Namen existiert bereits',
          existing_stil_id: existingRows[0].stil_id
        });
      }

      // Wenn inaktiver Stil existiert, reaktivieren
      if (existingRows.length > 0 && (existingRows[0].aktiv === 0 || existingRows[0].aktiv === false)) {
        const stilId = existingRows[0].stil_id;
        const reactivateQuery = `
          UPDATE stile
          SET aktiv = 1,
              beschreibung = ?,
              wartezeit_grundstufe = ?,
              wartezeit_mittelstufe = ?,
              wartezeit_oberstufe = ?,
              wartezeit_schwarzgurt_traditionell = ?,
              aktualisiert_am = NOW()
          WHERE stil_id = ?
        `;

        connection.query(reactivateQuery, [
          beschreibung ? beschreibung.trim() : '',
          wartezeit_grundstufe,
          wartezeit_mittelstufe,
          wartezeit_oberstufe,
          wartezeit_schwarzgurt_traditionell,
          stilId
        ], (updateError) => {
          if (updateError) {
            console.error('Fehler beim Reaktivieren des Stils:', updateError);
            connection.release();
            return res.status(500).json({
              error: 'Fehler beim Reaktivieren des Stils',
              details: updateError.message
            });
          }

          // Reaktivierten Stil zurückholen
          const selectQuery = 'SELECT * FROM stile WHERE stil_id = ?';
          connection.query(selectQuery, [stilId], (selectError, reactivatedStilRows) => {
            connection.release();

            if (selectError) {
              console.error('Fehler beim Abrufen des reaktivierten Stils:', selectError);
              return res.status(500).json({
                error: 'Stil reaktiviert, aber Fehler beim Abrufen',
                details: selectError.message
              });
            }

            res.status(200).json({
              ...reactivatedStilRows[0],
              reactivated: true,
              message: 'Stil wurde reaktiviert'
            });
          });
        });
        return; // Beende die Funktion hier
      }

      // Neuen Stil erstellen
      const insertQuery = `
        INSERT INTO stile (name, beschreibung, aktiv, wartezeit_grundstufe, wartezeit_mittelstufe, wartezeit_oberstufe, wartezeit_schwarzgurt_traditionell, erstellt_am, aktualisiert_am)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const insertValues = [
        name.trim(),
        beschreibung ? beschreibung.trim() : '',
        aktiv,
        wartezeit_grundstufe,
        wartezeit_mittelstufe,
        wartezeit_oberstufe,
        wartezeit_schwarzgurt_traditionell
      ];

      connection.query(insertQuery, insertValues, (insertError, result) => {
        if (insertError) {
          console.error('Fehler beim Erstellen des Stils:', insertError);
          connection.release();
          return res.status(500).json({ 
            error: 'Fehler beim Erstellen des Stils',
            details: insertError.message 
          });
        }

        const stilId = result.insertId;

        // Erstellten Stil zurückholen
        const selectQuery = 'SELECT * FROM stile WHERE stil_id = ?';
        connection.query(selectQuery, [stilId], (selectError, newStilRows) => {
          connection.release(); // Connection immer freigeben

          if (selectError) {
            console.error('Fehler beim Abrufen des neuen Stils:', selectError);
            return res.status(500).json({ 
              error: 'Stil erstellt, aber Fehler beim Abrufen',
              details: selectError.message 
            });
          }
          
          const newStil = {
            ...newStilRows[0],
            anzahl_mitglieder: 0,
            graduierungen: []
          };
          res.status(201).json(newStil);
        });
      });
    });
  });
});

// PUT - Stil aktualisieren
router.put('/:id', (req, res) => {
  const stilId = parseInt(req.params.id);
  if (!stilId || isNaN(stilId)) {
    return res.status(400).json({ error: 'Ungültige Stil-ID' });
  }

  const {
    name,
    beschreibung,
    aktiv,
    reihenfolge,
    wartezeit_grundstufe,
    wartezeit_mittelstufe,
    wartezeit_oberstufe,
    wartezeit_schwarzgurt_traditionell
  } = req.body;

  // Validierung
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Stil-Name ist erforderlich' });
  }

  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'Stil-Name ist zu lang (max. 100 Zeichen)' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    // Prüfen ob Stil existiert
    const checkQuery = 'SELECT stil_id FROM stile WHERE stil_id = ?';
    connection.query(checkQuery, [stilId], (checkError, existingRows) => {
      if (checkError) {
        console.error('Fehler beim Prüfen des Stils:', checkError);
        connection.release();
        return res.status(500).json({ 
          error: 'Fehler beim Prüfen des Stils',
          details: checkError.message 
        });
      }

      if (existingRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Stil nicht gefunden' });
      }

      // Stil aktualisieren
      const updateQuery = `
        UPDATE stile
        SET name = ?, beschreibung = ?, aktiv = ?, reihenfolge = ?,
            wartezeit_grundstufe = ?, wartezeit_mittelstufe = ?, wartezeit_oberstufe = ?,
            wartezeit_schwarzgurt_traditionell = ?, aktualisiert_am = NOW()
        WHERE stil_id = ?
      `;

      connection.query(updateQuery, [
        name.trim(),
        beschreibung ? beschreibung.trim() : '',
        aktiv,
        reihenfolge,
        wartezeit_grundstufe !== undefined ? wartezeit_grundstufe : 3,
        wartezeit_mittelstufe !== undefined ? wartezeit_mittelstufe : 4,
        wartezeit_oberstufe !== undefined ? wartezeit_oberstufe : 6,
        wartezeit_schwarzgurt_traditionell !== undefined ? wartezeit_schwarzgurt_traditionell : false,
        stilId
      ], (updateError) => {
        if (updateError) {
          console.error(`Fehler beim Aktualisieren von Stil ${stilId}:`, updateError);
          connection.release();
          return res.status(500).json({ 
            error: 'Fehler beim Aktualisieren des Stils',
            details: updateError.message 
          });
        }

        // Aktualisierten Stil mit korrekter Mitglieder-Anzahl zurückholen
        // Mit Mapping zwischen Stil-Namen und ENUM-Werten
        const selectQuery = `
          SELECT 
            s.*,
            COUNT(DISTINCT ms.mitglied_id) as anzahl_mitglieder
          FROM stile s
          LEFT JOIN mitglied_stile ms ON (
            s.name = ms.stil OR
            (s.name = 'Enso Karate' AND ms.stil = 'Karate') OR
            (s.name = 'Brazilian Jiu-Jitsu' AND ms.stil = 'BJJ')
          )
          LEFT JOIN mitglieder m ON ms.mitglied_id = m.mitglied_id AND m.aktiv = 1
          WHERE s.stil_id = ?
          GROUP BY s.stil_id
        `;
        connection.query(selectQuery, [stilId], (selectError, stilRows) => {
          if (selectError) {
            console.error(`Fehler beim Abrufen des aktualisierten Stils:`, selectError);
            connection.release();
            return res.status(500).json({ 
              error: 'Stil aktualisiert, aber Fehler beim Abrufen',
              details: selectError.message 
            });
          }

          const graduierungenQuery = `
            SELECT 
              graduierung_id,
              name,
              reihenfolge,
              trainingsstunden_min,
              mindestzeit_monate,
              farbe_hex,
              farbe_sekundaer,
              kategorie,
              dan_grad,
              aktiv
            FROM graduierungen 
            WHERE stil_id = ? AND aktiv = 1 
            ORDER BY reihenfolge ASC
          `;
          connection.query(graduierungenQuery, [stilId], (graduierungError, graduierungRows) => {
            connection.release(); // Connection immer freigeben

            if (graduierungError) {
              console.error(`Fehler beim Abrufen der Graduierungen:`, graduierungError);
              return res.status(500).json({ 
                error: 'Stil aktualisiert, aber Fehler beim Abrufen der Graduierungen',
                details: graduierungError.message 
              });
            }

            const updatedStil = {
              ...stilRows[0],
              graduierungen: graduierungRows
            };
            res.json(updatedStil);
          });
        });
      });
    });
  });
});

// DELETE - Stil löschen (soft delete)
router.delete('/:id', (req, res) => {
  const stilId = parseInt(req.params.id);
  if (!stilId || isNaN(stilId)) {
    return res.status(400).json({ error: 'Ungültige Stil-ID' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    // Prüfen ob Stil existiert
    const checkQuery = 'SELECT stil_id FROM stile WHERE stil_id = ?';
    connection.query(checkQuery, [stilId], (checkError, existingRows) => {
      if (checkError) {
        console.error('Fehler beim Prüfen des Stils:', checkError);
        connection.release();
        return res.status(500).json({ 
          error: 'Fehler beim Prüfen des Stils',
          details: checkError.message 
        });
      }

      if (existingRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Stil nicht gefunden' });
      }

      // Prüfen ob Mitglieder zugeordnet sind
      const memberCheckQuery = `
        SELECT COUNT(DISTINCT msd.mitglied_id) as count
        FROM mitglied_stil_data msd
        JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
        WHERE msd.stil_id = ? AND m.aktiv = 1
      `;
      connection.query(memberCheckQuery, [stilId], (memberCheckError, memberRows) => {
        if (memberCheckError) {
          console.error('Fehler beim Prüfen der Mitglieder:', memberCheckError);
          connection.release();
          return res.status(500).json({ 
            error: 'Fehler beim Prüfen der Mitglieder',
            details: memberCheckError.message 
          });
        }

        if (memberRows[0].count > 0) {
          connection.release();
          return res.status(409).json({ 
            error: 'Stil kann nicht gelöscht werden, da noch aktive Mitglieder zugeordnet sind',
            mitglieder_anzahl: memberRows[0].count 
          });
        }

        // Soft Delete - Stil deaktivieren
        const deleteQuery = 'UPDATE stile SET aktiv = 0, aktualisiert_am = NOW() WHERE stil_id = ?';
        connection.query(deleteQuery, [stilId], (deleteError) => {
          connection.release(); // Connection immer freigeben

          if (deleteError) {
            console.error(`Fehler beim Löschen von Stil ${stilId}:`, deleteError);
            return res.status(500).json({ 
              error: 'Fehler beim Löschen des Stils',
              details: deleteError.message 
            });
          }
          res.json({ 
            success: true, 
            message: 'Stil erfolgreich gelöscht',
            stil_id: stilId
          });
        });
      });
    });
  });
});

// ============================================================================
// GRADUIERUNGS-MANAGEMENT ENDPUNKTE
// ============================================================================

// POST - Graduierung hinzufügen - VOLLSTÄNDIGE ERWEITERTE VERSION
router.post('/:stilId/graduierungen', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  if (!stilId || isNaN(stilId)) {
    return res.status(400).json({ error: 'Ungültige Stil-ID' });
  }

  const { 
    name, 
    trainingsstunden_min = 40, 
    mindestzeit_monate = 3, 
    farbe_hex = '#FFFFFF',
    farbe_sekundaer = null,
    kategorie = null,
    dan_grad = null
  } = req.body;
  // Erweiterte Validierung
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Graduierung-Name ist erforderlich' });
  }

  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'Graduierung-Name ist zu lang (max. 100 Zeichen)' });
  }

  // Hex-Farb-Validierung
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (!hexRegex.test(farbe_hex)) {
    return res.status(400).json({ error: 'Ungültiges Hex-Farbformat für Primärfarbe' });
  }

  if (farbe_sekundaer && !hexRegex.test(farbe_sekundaer)) {
    return res.status(400).json({ error: 'Ungültiges Hex-Farbformat für Sekundärfarbe' });
  }

  // DAN-Grad Validierung
  if (kategorie === 'dan' && (!dan_grad || dan_grad < 1 || dan_grad > 10)) {
    return res.status(400).json({ error: 'DAN-Grad muss zwischen 1 und 10 liegen für DAN-Kategorie' });
  }

  // Kategorie Validierung
  const validKategorien = ['grundstufe', 'mittelstufe', 'oberstufe', 'dan', 'meister', 'custom'];
  if (kategorie && !validKategorien.includes(kategorie)) {
    return res.status(400).json({ error: 'Ungültige Kategorie' });
  }

  // Trainings-Validierung
  if (trainingsstunden_min < 0 || trainingsstunden_min > 1000) {
    return res.status(400).json({ error: 'Trainingsstunden müssen zwischen 0 und 1000 liegen' });
  }

  if (mindestzeit_monate < 0 || mindestzeit_monate > 120) {
    return res.status(400).json({ error: 'Mindestzeit muss zwischen 0 und 120 Monaten liegen' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    // Prüfen ob Stil existiert
    const stilCheckQuery = 'SELECT stil_id FROM stile WHERE stil_id = ? AND aktiv = 1';
    connection.query(stilCheckQuery, [stilId], (stilCheckError, stilRows) => {
      if (stilCheckError) {
        console.error('Fehler beim Prüfen des Stils:', stilCheckError);
        connection.release();
        return res.status(500).json({ 
          error: 'Fehler beim Prüfen des Stils',
          details: stilCheckError.message 
        });
      }

      if (stilRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Stil nicht gefunden oder inaktiv' });
      }

      // Prüfen ob DAN-Grad bereits existiert (falls DAN-Kategorie)
      if (kategorie === 'dan' && dan_grad) {
        const danCheckQuery = 'SELECT graduierung_id FROM graduierungen WHERE stil_id = ? AND dan_grad = ? AND aktiv = 1';
        connection.query(danCheckQuery, [stilId, dan_grad], (danCheckError, danRows) => {
          if (danCheckError) {
            console.error('Fehler beim Prüfen des DAN-Grads:', danCheckError);
            connection.release();
            return res.status(500).json({ 
              error: 'Fehler beim Prüfen des DAN-Grads',
              details: danCheckError.message 
            });
          }

          if (danRows.length > 0) {
            connection.release();
            return res.status(409).json({ 
              error: `${dan_grad}. DAN existiert bereits für diesen Stil`,
              existing_graduierung_id: danRows[0].graduierung_id
            });
          }

          // Graduierung erstellen (nach DAN-Prüfung)
          createGraduierung();
        });
      } else {
        // Graduierung erstellen (ohne DAN-Prüfung)
        createGraduierung();
      }

      function createGraduierung() {
        // Nächste Reihenfolge ermitteln
        const reihenfolgeQuery = `
          SELECT COALESCE(MAX(reihenfolge), 0) + 1 as next_reihenfolge 
          FROM graduierungen 
          WHERE stil_id = ? AND aktiv = 1
        `;
        
        connection.query(reihenfolgeQuery, [stilId], (reihenfolgeError, reihenfolgeRows) => {
          if (reihenfolgeError) {
            console.error('Fehler beim Ermitteln der Reihenfolge:', reihenfolgeError);
            connection.release();
            return res.status(500).json({ 
              error: 'Fehler beim Ermitteln der Reihenfolge',
              details: reihenfolgeError.message 
            });
          }
          
          const nextReihenfolge = reihenfolgeRows[0].next_reihenfolge;

          // Erweiterte Graduierung erstellen
          const insertQuery = `
            INSERT INTO graduierungen (
              stil_id, name, reihenfolge, trainingsstunden_min, mindestzeit_monate,
              farbe_hex, farbe_sekundaer, kategorie, dan_grad, aktiv, erstellt_am, aktualisiert_am
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
          `;

          const insertValues = [
            stilId,
            name.trim(),
            nextReihenfolge,
            trainingsstunden_min,
            mindestzeit_monate,
            farbe_hex.toUpperCase(),
            farbe_sekundaer ? farbe_sekundaer.toUpperCase() : null,
            kategorie,
            dan_grad
          ];

          connection.query(insertQuery, insertValues, (insertError, result) => {
            if (insertError) {
              console.error(`Fehler beim Erstellen der Graduierung für Stil ${stilId}:`, insertError);
              connection.release();
              return res.status(500).json({ 
                error: 'Fehler beim Erstellen der Graduierung',
                details: insertError.message 
              });
            }

            // Erstellte Graduierung mit allen Feldern zurückholen
            const selectQuery = `
              SELECT 
                graduierung_id,
                name,
                reihenfolge,
                trainingsstunden_min,
                mindestzeit_monate,
                farbe_hex,
                farbe_sekundaer,
                kategorie,
                dan_grad,
                aktiv,
                erstellt_am,
                aktualisiert_am
              FROM graduierungen 
              WHERE graduierung_id = ?
            `;
            
            connection.query(selectQuery, [result.insertId], (selectError, newGraduierungRows) => {
              connection.release(); // Connection immer freigeben

              if (selectError) {
                console.error('Fehler beim Abrufen der neuen Graduierung:', selectError);
                return res.status(500).json({ 
                  error: 'Graduierung erstellt, aber Fehler beim Abrufen',
                  details: selectError.message 
                });
              }

              const createdGraduierung = newGraduierungRows[0];
              res.status(201).json(createdGraduierung);
            });
          });
        });
      }
    });
  });
});

// PUT - Graduierung aktualisieren - VOLLSTÄNDIGE ERWEITERTE VERSION
router.put('/graduierungen/:graduierungId', (req, res) => {
  const graduierungId = parseInt(req.params.graduierungId);
  if (!graduierungId || isNaN(graduierungId)) {
    return res.status(400).json({ error: 'Ungültige Graduierung-ID' });
  }

  const { 
    name, 
    reihenfolge, 
    trainingsstunden_min, 
    mindestzeit_monate, 
    farbe_hex, 
    farbe_sekundaer,
    kategorie,
    dan_grad,
    aktiv 
  } = req.body;

  // Erweiterte Validierung
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Graduierung-Name ist erforderlich' });
  }

  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (farbe_hex && !hexRegex.test(farbe_hex)) {
    return res.status(400).json({ error: 'Ungültiges Hex-Farbformat für Primärfarbe' });
  }

  if (farbe_sekundaer && !hexRegex.test(farbe_sekundaer)) {
    return res.status(400).json({ error: 'Ungültiges Hex-Farbformat für Sekundärfarbe' });
  }

  if (trainingsstunden_min < 0 || trainingsstunden_min > 1000) {
    return res.status(400).json({ error: 'Trainingsstunden müssen zwischen 0 und 1000 liegen' });
  }

  if (mindestzeit_monate < 0 || mindestzeit_monate > 120) {
    return res.status(400).json({ error: 'Mindestzeit muss zwischen 0 und 120 Monaten liegen' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    // Prüfen ob Graduierung existiert
    const checkQuery = 'SELECT graduierung_id, stil_id FROM graduierungen WHERE graduierung_id = ?';
    connection.query(checkQuery, [graduierungId], (checkError, existingRows) => {
      if (checkError) {
        console.error('Fehler beim Prüfen der Graduierung:', checkError);
        connection.release();
        return res.status(500).json({ 
          error: 'Fehler beim Prüfen der Graduierung',
          details: checkError.message 
        });
      }

      if (existingRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Graduierung nicht gefunden' });
      }

      // Erweiterte Graduierung aktualisieren
      const updateQuery = `
        UPDATE graduierungen 
        SET name = ?, reihenfolge = ?, trainingsstunden_min = ?, 
            mindestzeit_monate = ?, farbe_hex = ?, farbe_sekundaer = ?,
            kategorie = ?, dan_grad = ?, aktiv = ?, aktualisiert_am = NOW()
        WHERE graduierung_id = ?
      `;

      const updateValues = [
        name.trim(),
        reihenfolge,
        trainingsstunden_min,
        mindestzeit_monate,
        farbe_hex ? farbe_hex.toUpperCase() : farbe_hex,
        farbe_sekundaer ? farbe_sekundaer.toUpperCase() : farbe_sekundaer,
        kategorie,
        dan_grad,
        aktiv,
        graduierungId
      ];

      connection.query(updateQuery, updateValues, (updateError) => {
        if (updateError) {
          console.error(`Fehler beim Aktualisieren der Graduierung ${graduierungId}:`, updateError);
          connection.release();
          return res.status(500).json({ 
            error: 'Fehler beim Aktualisieren der Graduierung',
            details: updateError.message 
          });
        }

        // Aktualisierte Graduierung mit allen Feldern zurückholen
        const selectQuery = `
          SELECT 
            graduierung_id,
            name,
            reihenfolge,
            trainingsstunden_min,
            mindestzeit_monate,
            farbe_hex,
            farbe_sekundaer,
            kategorie,
            dan_grad,
            aktiv,
            erstellt_am,
            aktualisiert_am
          FROM graduierungen 
          WHERE graduierung_id = ?
        `;
        
        connection.query(selectQuery, [graduierungId], (selectError, updatedRows) => {
          connection.release(); // Connection immer freigeben

          if (selectError) {
            console.error('Fehler beim Abrufen der aktualisierten Graduierung:', selectError);
            return res.status(500).json({ 
              error: 'Graduierung aktualisiert, aber Fehler beim Abrufen',
              details: selectError.message 
            });
          }
          res.json(updatedRows[0]);
        });
      });
    });
  });
});

// DELETE - Graduierung löschen
router.delete('/graduierungen/:graduierungId', (req, res) => {
  const graduierungId = parseInt(req.params.graduierungId);
  if (!graduierungId || isNaN(graduierungId)) {
    return res.status(400).json({ error: 'Ungültige Graduierung-ID' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    // Prüfen ob Graduierung existiert
    const checkQuery = 'SELECT graduierung_id FROM graduierungen WHERE graduierung_id = ?';
    connection.query(checkQuery, [graduierungId], (checkError, existingRows) => {
      if (checkError) {
        console.error('Fehler beim Prüfen der Graduierung:', checkError);
        connection.release();
        return res.status(500).json({ 
          error: 'Fehler beim Prüfen der Graduierung',
          details: checkError.message 
        });
      }

      if (existingRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: 'Graduierung nicht gefunden' });
      }

      // Prüfen ob Mitglieder diese Graduierung haben
      const memberCheckQuery = `
        SELECT COUNT(DISTINCT msd.mitglied_id) as count
        FROM mitglied_stil_data msd
        JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
        WHERE msd.current_graduierung_id = ? AND m.aktiv = 1
      `;
      connection.query(memberCheckQuery, [graduierungId], (memberCheckError, memberRows) => {
        if (memberCheckError) {
          console.error('Fehler beim Prüfen der Mitglieder:', memberCheckError);
          connection.release();
          return res.status(500).json({ 
            error: 'Fehler beim Prüfen der Mitglieder',
            details: memberCheckError.message 
          });
        }

        if (memberRows[0].count > 0) {
          connection.release();
          return res.status(409).json({ 
            error: 'Graduierung kann nicht gelöscht werden, da noch aktive Mitglieder diese Graduierung haben',
            mitglieder_anzahl: memberRows[0].count 
          });
        }

        // Graduierung löschen (hard delete, da keine Abhängigkeiten)
        const deleteQuery = 'DELETE FROM graduierungen WHERE graduierung_id = ?';
        connection.query(deleteQuery, [graduierungId], (deleteError) => {
          connection.release(); // Connection immer freigeben

          if (deleteError) {
            console.error(`Fehler beim Löschen der Graduierung ${graduierungId}:`, deleteError);
            return res.status(500).json({ 
              error: 'Fehler beim Löschen der Graduierung',
              details: deleteError.message 
            });
          }
          res.json({ 
            success: true, 
            message: 'Graduierung erfolgreich gelöscht',
            graduierung_id: graduierungId
          });
        });
      });
    });
  });
});

// ============================================================================
// DRAG & DROP REORDERING ENDPUNKT - KRITISCH FÜR FRONTEND
// ============================================================================

// PUT - Graduierungen neu ordnen (Drag & Drop) - DER FEHLENDE ENDPUNKT!
router.put('/:stilId/graduierungen/reorder', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  if (!stilId || isNaN(stilId)) {
    return res.status(400).json({ error: 'Ungültige Stil-ID' });
  }

  const { graduierungen } = req.body;

  if (!graduierungen || !Array.isArray(graduierungen)) {
    return res.status(400).json({ error: 'Graduierungen-Array ist erforderlich' });
  }

  if (graduierungen.length === 0) {
    return res.status(400).json({ error: 'Graduierungen-Array darf nicht leer sein' });
  }
  // Validierung der Graduierungs-Objekte
  for (const grad of graduierungen) {
    if (!grad.graduierung_id || !grad.reihenfolge) {
      return res.status(400).json({ 
        error: 'Jede Graduierung muss graduierung_id und reihenfolge enthalten',
        invalid_object: grad
      });
    }
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    // Beginne Transaktion für atomare Updates
    connection.beginTransaction((transactionErr) => {
      if (transactionErr) {
        console.error('Fehler beim Starten der Transaktion:', transactionErr);
        connection.release();
        return res.status(500).json({ 
          error: 'Fehler beim Starten der Transaktion',
          details: transactionErr.message 
        });
      }

      // Schritt 1: Setze alle Reihenfolgen auf negative Werte um Unique-Constraint-Konflikte zu vermeiden
      const tempUpdateQuery = `
        UPDATE graduierungen 
        SET reihenfolge = -graduierung_id, aktualisiert_am = NOW() 
        WHERE stil_id = ? AND graduierung_id IN (${graduierungen.map(() => '?').join(',')})
      `;
      
      const graduierungIds = graduierungen.map(g => g.graduierung_id);
      const tempParams = [stilId, ...graduierungIds];
      
      connection.query(tempUpdateQuery, tempParams, (tempError) => {
        if (tempError) {
          console.error('Fehler beim temporären Update:', tempError);
          connection.rollback(() => {
            connection.release();
            return res.status(500).json({ 
              error: 'Fehler beim temporären Update der Reihenfolge',
              details: tempError.message 
            });
          });
          return;
        }

        // Schritt 2: Setze die finalen Reihenfolge-Werte
        let completedUpdates = 0;
        let hasError = false;

        graduierungen.forEach((grad) => {
          const finalUpdateQuery = `
            UPDATE graduierungen 
            SET reihenfolge = ?, aktualisiert_am = NOW() 
            WHERE graduierung_id = ? AND stil_id = ?
          `;
          
          connection.query(finalUpdateQuery, [grad.reihenfolge, grad.graduierung_id, stilId], (updateError, result) => {
            if (updateError && !hasError) {
              hasError = true;
              console.error('Fehler beim finalen Update der Graduierung:', updateError);
              
              connection.rollback(() => {
                connection.release();
                return res.status(500).json({ 
                  error: 'Fehler beim Aktualisieren der Reihenfolge',
                  details: updateError.message 
                });
              });
              return;
            }

            if (result && result.affectedRows === 0 && !hasError) {
              hasError = true;
              console.error(`Graduierung ${grad.graduierung_id} nicht gefunden oder gehört nicht zu Stil ${stilId}`);
              
              connection.rollback(() => {
                connection.release();
                return res.status(404).json({ 
                  error: `Graduierung ${grad.graduierung_id} nicht gefunden oder gehört nicht zu Stil ${stilId}`
                });
              });
              return;
            }

            completedUpdates++;
            
            // Alle Updates erfolgreich
            if (completedUpdates === graduierungen.length && !hasError) {
              connection.commit((commitError) => {
                if (commitError) {
                  console.error('Fehler beim Commit der Transaktion:', commitError);
                  connection.rollback(() => {
                    connection.release();
                    return res.status(500).json({ 
                      error: 'Fehler beim Speichern der Änderungen',
                      details: commitError.message 
                    });
                  });
                  return;
                }

                connection.release();
                res.json({ 
                  success: true, 
                  message: 'Reihenfolge erfolgreich aktualisiert',
                  updated_count: graduierungen.length,
                  stil_id: stilId
                });
              });
            }
          });
        });
      });
    });
  });
});

// ============================================================================
// STATISTIK & ANALYTICS ENDPUNKTE
// ============================================================================

// GET - Erweiterte Stil-Statistiken mit Kategorien
router.get('/:id/statistiken', (req, res) => {
  const stilId = parseInt(req.params.id);
  if (!stilId || isNaN(stilId)) {
    return res.status(400).json({ error: 'Ungültige Stil-ID' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    // Erweiterte Graduierungs-Statistiken mit Kategorien
    const graduierungStatsQuery = `
      SELECT
        g.graduierung_id,
        g.name as graduierung,
        g.farbe_hex,
        g.farbe_sekundaer,
        g.kategorie,
        g.dan_grad,
        g.reihenfolge,
        COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder
      FROM graduierungen g
      LEFT JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id AND msd.stil_id = g.stil_id
      LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
      WHERE g.stil_id = ? AND g.aktiv = 1
      GROUP BY g.graduierung_id, g.name, g.farbe_hex, g.farbe_sekundaer, g.kategorie, g.dan_grad, g.reihenfolge
      ORDER BY g.reihenfolge ASC
    `;

    connection.query(graduierungStatsQuery, [stilId], (graduierungError, graduierungStats) => {
      if (graduierungError) {
        console.error(`Fehler beim Abrufen der Graduierung-Statistiken für Stil ${stilId}:`, graduierungError);
        connection.release();
        return res.status(500).json({ 
          error: 'Fehler beim Abrufen der Graduierung-Statistiken',
          details: graduierungError.message 
        });
      }

      // Kategorie-Statistiken
      const kategorieStatsQuery = `
        SELECT
          g.kategorie,
          COUNT(DISTINCT g.graduierung_id) as anzahl_graduierungen,
          COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder,
          AVG(g.trainingsstunden_min) as avg_trainingsstunden,
          AVG(g.mindestzeit_monate) as avg_mindestzeit
        FROM graduierungen g
        LEFT JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id AND msd.stil_id = g.stil_id
        LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
        WHERE g.stil_id = ? AND g.aktiv = 1
        GROUP BY g.kategorie
        ORDER BY
          CASE g.kategorie
            WHEN 'grundstufe' THEN 1
            WHEN 'mittelstufe' THEN 2
            WHEN 'oberstufe' THEN 3
            WHEN 'dan' THEN 4
            WHEN 'meister' THEN 5
            ELSE 6
          END
      `;

      connection.query(kategorieStatsQuery, [stilId], (kategorieError, kategorieStats) => {
        if (kategorieError) {
          console.error(`Fehler beim Abrufen der Kategorie-Statistiken für Stil ${stilId}:`, kategorieError);
          connection.release();
          return res.status(500).json({ 
            error: 'Fehler beim Abrufen der Kategorie-Statistiken',
            details: kategorieError.message 
          });
        }

        // Alters-Statistiken
        const altersStatsQuery = `
          SELECT
            CASE
              WHEN YEAR(CURDATE()) - YEAR(m.geburtsdatum) < 18 THEN 'Unter 18'
              WHEN YEAR(CURDATE()) - YEAR(m.geburtsdatum) BETWEEN 18 AND 30 THEN '18-30'
              WHEN YEAR(CURDATE()) - YEAR(m.geburtsdatum) BETWEEN 31 AND 50 THEN '31-50'
              ELSE 'Über 50'
            END as altersgruppe,
            COUNT(DISTINCT m.mitglied_id) as anzahl
          FROM mitglied_stil_data msd
          JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
          WHERE msd.stil_id = ? AND m.aktiv = 1 AND m.geburtsdatum IS NOT NULL
          GROUP BY altersgruppe
          ORDER BY
            CASE altersgruppe
              WHEN 'Unter 18' THEN 1
              WHEN '18-30' THEN 2
              WHEN '31-50' THEN 3
              ELSE 4
            END
        `;

        connection.query(altersStatsQuery, [stilId], (altersError, altersStats) => {
          if (altersError) {
            console.error(`Fehler beim Abrufen der Alters-Statistiken für Stil ${stilId}:`, altersError);
            connection.release();
            return res.status(500).json({ 
              error: 'Fehler beim Abrufen der Alters-Statistiken',
              details: altersError.message 
            });
          }

          // Geschlechts-Statistiken
          const geschlechtStatsQuery = `
            SELECT
              m.geschlecht,
              COUNT(DISTINCT m.mitglied_id) as anzahl
            FROM mitglied_stil_data msd
            JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
            WHERE msd.stil_id = ? AND m.aktiv = 1 AND m.geschlecht IS NOT NULL
            GROUP BY m.geschlecht
            ORDER BY m.geschlecht
          `;

          connection.query(geschlechtStatsQuery, [stilId], (geschlechtError, geschlechtStats) => {
            connection.release(); // Connection immer freigeben

            if (geschlechtError) {
              console.error(`Fehler beim Abrufen der Geschlechts-Statistiken für Stil ${stilId}:`, geschlechtError);
              return res.status(500).json({ 
                error: 'Fehler beim Abrufen der Geschlechts-Statistiken',
                details: geschlechtError.message 
              });
            }

            const erweitertStatistiken = {
              graduierungen: graduierungStats,
              kategorien: kategorieStats,
              altersgruppen: altersStats,
              geschlecht: geschlechtStats,
              summary: {
                total_graduierungen: graduierungStats.length,
                total_mitglieder: graduierungStats.reduce((sum, g) => sum + g.anzahl_mitglieder, 0),
                kategorien_count: kategorieStats.length
              }
            };
            res.json(erweitertStatistiken);
          });
        });
      });
    });
  });
});

// GET - Kategorie-Übersicht für alle Stile
router.get('/kategorien/uebersicht', (req, res) => {
  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({ 
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message 
      });
    }

    const kategorieUebersichtQuery = `
      SELECT
        s.stil_id,
        s.name as stil_name,
        g.kategorie,
        COUNT(DISTINCT g.graduierung_id) as anzahl_graduierungen,
        COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder
      FROM stile s
      LEFT JOIN graduierungen g ON s.stil_id = g.stil_id AND g.aktiv = 1
      LEFT JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id AND msd.stil_id = g.stil_id
      LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
      WHERE s.aktiv = 1
      GROUP BY s.stil_id, s.name, g.kategorie
      ORDER BY s.name ASC, 
        CASE g.kategorie
          WHEN 'grundstufe' THEN 1
          WHEN 'mittelstufe' THEN 2
          WHEN 'oberstufe' THEN 3
          WHEN 'dan' THEN 4
          WHEN 'meister' THEN 5
          ELSE 6
        END
    `;

    connection.query(kategorieUebersichtQuery, (error, results) => {
      connection.release();

      if (error) {
        console.error('Fehler beim Abrufen der Kategorie-Übersicht:', error);
        return res.status(500).json({ 
          error: 'Fehler beim Abrufen der Kategorie-Übersicht',
          details: error.message 
        });
      }
      res.json(results);
    });
  });
});

// GET - Mitglieder einer bestimmten Graduierung
router.get('/:stilId/graduierungen/:graduierungId/mitglieder', (req, res) => {
  const { stilId, graduierungId } = req.params;

  const query = `
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.geburtsdatum,
      m.email,
      m.telefon
    FROM mitglied_stil_data msd
    JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
    WHERE msd.stil_id = ?
      AND msd.current_graduierung_id = ?
      AND m.aktiv = 1
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, [stilId, graduierungId], (error, results) => {
    if (error) {
      console.error('Fehler beim Abrufen der Mitglieder für Graduierung:', error);
      return res.status(500).json({
        error: 'Fehler beim Abrufen der Mitglieder',
        details: error.message
      });
    }

    res.json({ mitglieder: results });
  });
});

// ============================================================================
// PRÜFUNGSINHALTE ROUTEN
// ============================================================================

/**
 * GET /api/stile/:stilId/graduierungen/:graduierungId/pruefungsinhalte
 * Ruft die Prüfungsinhalte für eine Graduierung ab
 */
router.get('/:stilId/graduierungen/:graduierungId/pruefungsinhalte', (req, res) => {
  const { graduierungId } = req.params;

  console.log('📖 GET Prüfungsinhalte für Graduierung:', graduierungId);

  if (!graduierungId || isNaN(graduierungId)) {
    return res.status(400).json({ error: 'Ungültige Graduierung-ID' });
  }

  const query = `
    SELECT
      inhalt_id,
      kategorie,
      titel,
      beschreibung,
      reihenfolge,
      pflicht,
      aktiv
    FROM pruefungsinhalte
    WHERE graduierung_id = ? AND aktiv = 1
    ORDER BY kategorie, reihenfolge
  `;

  db.query(query, [graduierungId], (error, results) => {
    if (error) {
      console.error('❌ Fehler beim Abrufen der Prüfungsinhalte:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Prüfungsinhalte' });
    }

    // Gruppiere Prüfungsinhalte nach Kategorie
    const pruefungsinhalte = {};
    results.forEach(inhalt => {
      if (!pruefungsinhalte[inhalt.kategorie]) {
        pruefungsinhalte[inhalt.kategorie] = [];
      }
      pruefungsinhalte[inhalt.kategorie].push({
        id: inhalt.inhalt_id,
        titel: inhalt.titel,
        beschreibung: inhalt.beschreibung,
        pflicht: inhalt.pflicht === 1,
        reihenfolge: inhalt.reihenfolge
      });
    });

    console.log('✅ Prüfungsinhalte gefunden:', Object.keys(pruefungsinhalte).length, 'Kategorien');
    res.json({ pruefungsinhalte });
  });
});

/**
 * PUT /api/stile/:stilId/graduierungen/:graduierungId/pruefungsinhalte
 * Aktualisiert die Prüfungsinhalte für eine Graduierung
 */
router.put('/:stilId/graduierungen/:graduierungId/pruefungsinhalte', (req, res) => {
  const { stilId, graduierungId } = req.params;
  const { pruefungsinhalte } = req.body;

  console.log('📝 PUT Prüfungsinhalte für Graduierung:', graduierungId);
  console.log('Daten:', pruefungsinhalte);

  if (!graduierungId || isNaN(graduierungId)) {
    return res.status(400).json({ error: 'Ungültige Graduierung-ID' });
  }

  if (!pruefungsinhalte) {
    return res.status(400).json({ error: 'Prüfungsinhalte sind erforderlich' });
  }

  // Konvertiere das Objekt zu JSON
  const pruefungsinhalteJson = JSON.stringify(pruefungsinhalte);

  // Prüfe, ob die Spalte existiert, falls nicht, erstelle sie
  const addColumnQuery = `
    ALTER TABLE graduierungen
    ADD COLUMN IF NOT EXISTS pruefungsinhalte JSON DEFAULT NULL
  `;

  db.query(addColumnQuery, (alterError) => {
    if (alterError && !alterError.message.includes('Duplicate column')) {
      console.error('Fehler beim Hinzufügen der Spalte:', alterError);
      // Fahre trotzdem fort, vielleicht existiert die Spalte bereits
    }

    // Aktualisiere die Prüfungsinhalte
    const updateQuery = `
      UPDATE graduierungen
      SET pruefungsinhalte = ?, aktualisiert_am = NOW()
      WHERE graduierung_id = ? AND stil_id = ?
    `;

    db.query(updateQuery, [pruefungsinhalteJson, graduierungId, stilId], (updateError, results) => {
      if (updateError) {
        console.error('❌ Fehler beim Aktualisieren der Prüfungsinhalte:', updateError);
        return res.status(500).json({
          error: 'Fehler beim Aktualisieren der Prüfungsinhalte',
          details: updateError.message
        });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Graduierung nicht gefunden' });
      }

      console.log('✅ Prüfungsinhalte erfolgreich aktualisiert');
      res.json({
        success: true,
        message: 'Prüfungsinhalte aktualisiert',
        pruefungsinhalte: pruefungsinhalte
      });
    });
  });
});

// GET - Komplette Gürtel-Übersicht für Auswertungen
// Liefert alle Stile mit Gürteln und Mitgliedern-Namen
router.get('/auswertungen/guertel-uebersicht', (req, res) => {
  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB-Verbindungsfehler:', err);
      return res.status(500).json({
        error: 'Datenbankverbindung fehlgeschlagen',
        details: err.message
      });
    }

    // Alle Stile mit ihren Graduierungen und Mitgliedern
    const query = `
      SELECT
        s.stil_id,
        s.name as stil_name,
        g.graduierung_id,
        g.name as gurt_name,
        g.farbe_hex,
        g.farbe_sekundaer,
        g.kategorie,
        g.dan_grad,
        g.reihenfolge,
        m.mitglied_id,
        m.vorname,
        m.nachname,
        m.email,
        (SELECT COUNT(*) FROM anwesenheit_protokoll ap
         WHERE ap.mitglied_id = m.mitglied_id
         AND ap.status = 'anwesend'
         AND YEAR(ap.datum) = YEAR(CURDATE())
        ) as anwesenheit_jahr,
        (SELECT COUNT(*) FROM anwesenheit_protokoll ap
         WHERE ap.mitglied_id = m.mitglied_id
         AND ap.status = 'anwesend'
         AND YEAR(ap.datum) = YEAR(CURDATE())
         AND MONTH(ap.datum) = MONTH(CURDATE())
        ) as anwesenheit_monat
      FROM stile s
      LEFT JOIN graduierungen g ON s.stil_id = g.stil_id AND g.aktiv = 1
      LEFT JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id AND msd.stil_id = g.stil_id
      LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
      WHERE s.aktiv = 1
      ORDER BY s.reihenfolge ASC, s.name ASC, g.reihenfolge ASC, m.nachname ASC, m.vorname ASC
    `;

    connection.query(query, (error, results) => {
      connection.release();

      if (error) {
        console.error('Fehler beim Abrufen der Gürtel-Übersicht:', error);
        return res.status(500).json({
          error: 'Fehler beim Abrufen der Gürtel-Übersicht',
          details: error.message
        });
      }

      // Gruppiere die Ergebnisse nach Stil und Gürtel
      const stileMap = new Map();

      results.forEach(row => {
        if (!stileMap.has(row.stil_id)) {
          stileMap.set(row.stil_id, {
            stil_id: row.stil_id,
            stil_name: row.stil_name,
            guertel: new Map()
          });
        }

        const stil = stileMap.get(row.stil_id);

        if (row.graduierung_id && !stil.guertel.has(row.graduierung_id)) {
          stil.guertel.set(row.graduierung_id, {
            graduierung_id: row.graduierung_id,
            gurt_name: row.gurt_name,
            farbe_hex: row.farbe_hex,
            farbe_sekundaer: row.farbe_sekundaer,
            kategorie: row.kategorie,
            dan_grad: row.dan_grad,
            reihenfolge: row.reihenfolge,
            mitglieder: []
          });
        }

        if (row.mitglied_id && row.graduierung_id) {
          const guertel = stil.guertel.get(row.graduierung_id);
          guertel.mitglieder.push({
            mitglied_id: row.mitglied_id,
            vorname: row.vorname,
            nachname: row.nachname,
            email: row.email,
            anwesenheit_jahr: row.anwesenheit_jahr || 0,
            anwesenheit_monat: row.anwesenheit_monat || 0
          });
        }
      });

      // Konvertiere Maps zu Arrays
      const stile = Array.from(stileMap.values()).map(stil => ({
        ...stil,
        guertel: Array.from(stil.guertel.values())
      }));

      res.json({
        success: true,
        stile: stile,
        summary: {
          total_stile: stile.length,
          total_guertel: stile.reduce((sum, s) => sum + s.guertel.length, 0),
          total_mitglieder: results.filter(r => r.mitglied_id).length
        }
      });
    });
  });
});

module.exports = router;

/*
================================================================================
BACKEND ROUTE DOKUMENTATION - VOLLSTÄNDIGE ERWEITERTE VERSION
================================================================================

KRITISCHE ENDPUNKTE FÜR FRONTEND:
GET /api/stile                              -> Alle Stile mit Graduierungen
GET /api/stile/:id                          -> Einzelner Stil mit Details
POST /api/stile                             -> Neuen Stil erstellen  
PUT /api/stile/:id                          -> Stil aktualisieren
DELETE /api/stile/:id                       -> Stil löschen
POST /api/stile/:stilId/graduierungen       -> Graduierung hinzufügen
PUT /api/stile/graduierungen/:id            -> Graduierung aktualisieren
DELETE /api/stile/graduierungen/:id         -> Graduierung löschen
PUT /api/stile/:stilId/graduierungen/reorder -> Drag & Drop Reordering (WICHTIG!)
GET /api/stile/:id/statistiken              -> Erweiterte Statistiken
GET /api/stile/kategorien/uebersicht        -> Kategorie-Übersicht

DATENBANKFELDER FÜR GRADUIERUNGEN:
- graduierung_id (PRIMARY KEY)
- stil_id (FOREIGN KEY zu stile)
- name (VARCHAR, Gürtel-Name)
- reihenfolge (INT, für Drag & Drop)
- trainingsstunden_min (INT)
- mindestzeit_monate (INT)  
- farbe_hex (VARCHAR(7), #RRGGBB)
- farbe_sekundaer (VARCHAR(7), optional)
- kategorie (ENUM: grundstufe, mittelstufe, oberstufe, dan, meister, custom)
- dan_grad (INT, 1-10 für DAN-Graduierungen)
- aktiv (BOOLEAN)
- erstellt_am (TIMESTAMP)
- aktualisiert_am (TIMESTAMP)

ERWEITERTE FEATURES:
- Vollständige Hex-Farb-Validierung
- DAN-Grad Unique-Constraints  
- Transaktionale Sicherheit für Batch-Updates
- Erweiterte Fehlerbehandlung mit Details
- Soft-Delete für Stile
- Hard-Delete für Graduierungen (wenn keine Abhängigkeiten)
- Mitglieder-Dependency-Checks vor Löschung

STATISTIK-FEATURES:
- Graduierungs-Verteilung nach Kategorien
- Mitglieder-Verteilung nach Altersgruppen
- Geschlechts-Statistiken
- Durchschnittliche Trainingszeiten
- Kategorie-übergreifende Analysen

WICHTIGE HINWEISE:
1. Diese Route MUSS als '/api/stile' registriert werden
2. Ersetzt die einfache stile.js Route komplett
3. Benötigt Datenbank-Schema-Updates
4. Unterstützt @dnd-kit Drag & Drop vollständig
================================================================================
*/