// Script zum Hinzufügen der Bewertungs-Endpoints zur pruefungen.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'routes', 'pruefungen.js');

const newEndpoints = `
// ============================================================================
// PRÜFUNGSBEWERTUNGEN ENDPOINTS
// ============================================================================

/**
 * GET /api/pruefungen/:id/bewertungen
 * Lädt alle detaillierten Bewertungen für eine Prüfung
 */
router.get('/:id/bewertungen', (req, res) => {
  const pruefungId = req.params.id;

  const query = \`
    SELECT
      pb.*,
      pi.kategorie,
      pi.titel,
      pi.beschreibung,
      pi.reihenfolge as inhalt_reihenfolge
    FROM pruefung_bewertungen pb
    INNER JOIN pruefungsinhalte pi ON pb.inhalt_id = pi.inhalt_id
    WHERE pb.pruefung_id = ?
    ORDER BY pi.kategorie, pi.reihenfolge
  \`;

  db.query(query, [pruefungId], (error, results) => {
    if (error) {
      console.error('❌ Fehler beim Laden der Bewertungen:', error);
      return res.status(500).json({ error: 'Fehler beim Laden der Bewertungen' });
    }

    // Gruppiere nach Kategorie
    const bewertungen = {};
    results.forEach(row => {
      if (!bewertungen[row.kategorie]) {
        bewertungen[row.kategorie] = [];
      }
      bewertungen[row.kategorie].push({
        bewertung_id: row.bewertung_id,
        inhalt_id: row.inhalt_id,
        titel: row.titel,
        beschreibung: row.beschreibung,
        bestanden: row.bestanden,
        punktzahl: row.punktzahl,
        max_punktzahl: row.max_punktzahl,
        kommentar: row.kommentar
      });
    });

    res.json({ success: true, bewertungen });
  });
});

/**
 * POST /api/pruefungen/:id/bewertungen
 * Speichert oder aktualisiert detaillierte Bewertungen für eine Prüfung
 * Body: { bewertungen: [{ inhalt_id, bestanden, punktzahl, max_punktzahl, kommentar }] }
 */
router.post('/:id/bewertungen', (req, res) => {
  const pruefungId = req.params.id;
  const { bewertungen } = req.body;

  if (!bewertungen || !Array.isArray(bewertungen)) {
    return res.status(400).json({ error: 'Bewertungen-Array ist erforderlich' });
  }

  // Verwende Transaktion für atomare Operation
  db.getConnection((err, connection) => {
    if (err) {
      console.error('Fehler beim Verbindungsaufbau:', err);
      return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen' });
    }

    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        console.error('Fehler beim Starten der Transaktion:', err);
        return res.status(500).json({ error: 'Fehler beim Starten der Transaktion' });
      }

      // Lösche alle bestehenden Bewertungen für diese Prüfung
      connection.query('DELETE FROM pruefung_bewertungen WHERE pruefung_id = ?', [pruefungId], (deleteErr) => {
        if (deleteErr) {
          return connection.rollback(() => {
            connection.release();
            console.error('Fehler beim Löschen alter Bewertungen:', deleteErr);
            res.status(500).json({ error: 'Fehler beim Löschen alter Bewertungen' });
          });
        }

        // Füge neue Bewertungen ein
        if (bewertungen.length === 0) {
          // Keine Bewertungen zum Einfügen
          return connection.commit(err => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('Fehler beim Commit:', err);
                res.status(500).json({ error: 'Fehler beim Speichern' });
              });
            }
            connection.release();
            res.json({ success: true, message: 'Bewertungen gelöscht', count: 0 });
          });
        }

        const insertQuery = \`
          INSERT INTO pruefung_bewertungen
          (pruefung_id, inhalt_id, bestanden, punktzahl, max_punktzahl, kommentar)
          VALUES (?, ?, ?, ?, ?, ?)
        \`;

        let completed = 0;
        let hasError = false;

        bewertungen.forEach(bew => {
          connection.query(insertQuery, [
            pruefungId,
            bew.inhalt_id,
            bew.bestanden !== undefined ? bew.bestanden : null,
            bew.punktzahl || null,
            bew.max_punktzahl || 10,
            bew.kommentar || null
          ], (insertErr) => {
            if (insertErr && !hasError) {
              hasError = true;
              return connection.rollback(() => {
                connection.release();
                console.error('Fehler beim Einfügen der Bewertungen:', insertErr);
                res.status(500).json({ error: 'Fehler beim Einfügen der Bewertungen' });
              });
            }

            completed++;

            if (completed === bewertungen.length && !hasError) {
              connection.commit(err => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error('Fehler beim Commit:', err);
                    res.status(500).json({ error: 'Fehler beim Speichern' });
                  });
                }
                connection.release();
                console.log(\`✅ \${bewertungen.length} Bewertungen gespeichert für Prüfung \${pruefungId}\`);
                res.json({ success: true, message: 'Bewertungen gespeichert', count: bewertungen.length });
              });
            }
          });
        });
      });
    });
  });
});

`;

// Lese die Datei
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('❌ Fehler beim Lesen der Datei:', err);
    process.exit(1);
  }

  // Finde die Zeile mit module.exports
  const lines = data.split('\n');
  const exportIndex = lines.findIndex(line => line.includes('module.exports = router;'));

  if (exportIndex === -1) {
    console.error('❌ Konnte "module.exports = router;" nicht finden');
    process.exit(1);
  }

  // Füge die neuen Endpoints vor module.exports ein
  lines.splice(exportIndex, 0, newEndpoints);

  // Schreibe die Datei zurück
  const newContent = lines.join('\n');

  fs.writeFile(filePath, newContent, 'utf8', (writeErr) => {
    if (writeErr) {
      console.error('❌ Fehler beim Schreiben der Datei:', writeErr);
      process.exit(1);
    }

    console.log('✅ Bewertungs-Endpoints erfolgreich hinzugefügt!');
    console.log('📝 Datei: backend/routes/pruefungen.js');
    console.log('📍 Position: Vor module.exports = router;');
    process.exit(0);
  });
});
