// routes/einstellungendojo.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // MySQL-Verbindung

// GET /api/dojo
router.get('/', (req, res) => {
  console.log('🔵 GET /api/dojo aufgerufen (einstellungendojo.js)');
  
  // Erst Migration ausführen, dann Daten laden
  ensureTableStructure(() => {
    const sqlSelect = `SELECT * FROM dojo LIMIT 1`;
    db.query(sqlSelect, (err, results) => {
      if (err) {
        console.error('Fehler beim Laden der Dojo-Daten:', err);
        return res.status(500).json({ error: 'Serverfehler beim Laden der Dojo-Daten' });
      }
      
      if (results.length === 0) {

        const defaultData = {
          dojoname: 'Mein Dojo',
          inhaber: 'Dojo-Leiter',
          strasse: '',
          hausnummer: '',
          plz: '',
          ort: '',
          telefon: '',
          mobil: '',
          email: '',
          internet: '',
          // Rechtliche Felder mit Standardwerten
          agb_text: '',
          dsgvo_text: '',
          dojo_regeln_text: '',
          hausordnung_text: '',
          haftungsausschluss_text: '',
          widerrufsbelehrung_text: '',
          impressum_text: '',
          vertragsbedingungen_text: '',
          // Erweiterte Felder
          untertitel: '',
          vertreter: '',
          gruendungsjahr: '',
          land: 'Deutschland',
          rechtsform: 'Verein',
          theme_scheme: 'default'
        };
        
        const sqlInsert = `INSERT INTO dojo SET ?`;
        db.query(sqlInsert, defaultData, (errInsert, insertResult) => {
          if (errInsert) {
            console.error('Fehler beim Anlegen des Standard-Datensatzes:', errInsert);
            return res.status(500).json({ error: 'Serverfehler beim Anlegen des Datensatzes' });
          }

          db.query(sqlSelect, (err2, rows2) => {
            if (err2) {
              console.error('Fehler nach dem Anlegen des Datensatzes:', err2);
              return res.status(500).json({ error: 'Serverfehler nach Einfügen' });
            }

            res.json(rows2[0]);
          });
        });
      } else {

        res.json(results[0]);
      }
    });
  });
});

// Hilfsfunktion um einzelne Spalte hinzuzufügen (nur wenn sie nicht existiert)
function addColumnIfNotExists(tableName, columnName, columnDefinition, callback) {
  const checkSql = `
    SELECT COUNT(*) as count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = ?
    AND COLUMN_NAME = ?
  `;

  db.query(checkSql, [tableName, columnName], (err, results) => {
    if (err) {
      console.error(`Fehler beim Prüfen der Spalte ${columnName}:`, err.message);
      return callback(err);
    }

    if (results[0].count === 0) {
      // Spalte existiert nicht, also hinzufügen
      const alterSql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`;
      db.query(alterSql, (errAlter) => {
        if (errAlter) {
          console.error(`Fehler beim Hinzufügen der Spalte ${columnName}:`, errAlter.message);
          return callback(errAlter);
        }

        callback(null);
      });
    } else {
      // Spalte existiert bereits

      callback(null);
    }
  });
}

// Funktion um Tabellen-Struktur sicherzustellen
function ensureTableStructure(callback) {

  const columns = [
    // Rechtliche Texte
    { name: 'agb_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'dsgvo_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'dojo_regeln_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'hausordnung_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'haftungsausschluss_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'widerrufsbelehrung_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'impressum_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'vertragsbedingungen_text', definition: 'TEXT DEFAULT NULL' },

    // Erweiterte Grunddaten
    { name: 'untertitel', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vertreter', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'gruendungsjahr', definition: 'VARCHAR(10) DEFAULT NULL' },
    { name: 'land', definition: "VARCHAR(100) DEFAULT 'Deutschland'" },

    // Kontakt erweitert
    { name: 'fax', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'email_info', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'email_anmeldung', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'whatsapp_nummer', definition: 'VARCHAR(50) DEFAULT NULL' },

    // Steuerliches
    { name: 'steuernummer', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'umsatzsteuer_id', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'finanzamt', definition: 'JSON DEFAULT NULL' },
    { name: 'steuerberater', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'steuerberater_telefon', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'umsatzsteuerpflichtig', definition: 'BOOLEAN DEFAULT FALSE' },
    { name: 'kleinunternehmer', definition: 'BOOLEAN DEFAULT FALSE' },
    { name: 'gemeinnuetzig', definition: 'BOOLEAN DEFAULT FALSE' },
    { name: 'freistellungsbescheid_datum', definition: 'DATE DEFAULT NULL' },

    // Rechtliches
    { name: 'rechtsform', definition: "VARCHAR(100) DEFAULT 'Verein'" },
    { name: 'vereinsregister_nr', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'amtsgericht', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'handelsregister_nr', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'geschaeftsfuehrer', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vorstand_1_vorsitzender', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vorstand_2_vorsitzender', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vorstand_kassenwart', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vorstand_schriftfuehrer', definition: 'VARCHAR(255) DEFAULT NULL' },

    // System
    { name: 'theme_scheme', definition: "VARCHAR(50) DEFAULT 'default'" },
    { name: 'logo_url', definition: 'VARCHAR(500) DEFAULT NULL' },
    { name: 'favicon_url', definition: 'VARCHAR(500) DEFAULT NULL' },
    { name: 'dsgvo_beauftragte', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'max_mitglieder', definition: 'INT DEFAULT 500' },

    // Vertragseinstellungen (Kuendigungen & Bedingungen)
    { name: 'kuendigungsfrist_monate', definition: 'INT DEFAULT 3' },
    { name: 'mindestlaufzeit_monate', definition: 'INT DEFAULT 12' },
    { name: 'probezeit_tage', definition: 'INT DEFAULT 14' },
    { name: 'kuendigung_nur_monatsende', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'kuendigung_schriftlich', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'automatische_verlaengerung', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'verlaengerung_monate', definition: 'INT DEFAULT 12' },
    { name: 'kuendigung_erstlaufzeit_monate', definition: 'INT DEFAULT 3' },
    { name: 'kuendigung_verlaengerung_monate', definition: 'INT DEFAULT 1' },

    // Vertragslaufzeiten und Preise
    { name: 'vertrag_3_monate_preis', definition: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'vertrag_6_monate_preis', definition: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'vertrag_12_monate_preis', definition: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'vertrag_3_monate_aktiv', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'vertrag_6_monate_aktiv', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'vertrag_12_monate_aktiv', definition: 'BOOLEAN DEFAULT TRUE' },

    // Rabatte
    { name: 'jahresbeitrag', definition: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'familienrabatt_prozent', definition: 'DECIMAL(5,2) DEFAULT NULL' },
    { name: 'schuelerrabatt_prozent', definition: 'DECIMAL(5,2) DEFAULT NULL' },
    { name: 'vereinsmitglied_rabatt_prozent', definition: 'DECIMAL(5,2) DEFAULT NULL' },
    { name: 'mehrfachtraining_rabatt_prozent', definition: 'DECIMAL(5,2) DEFAULT NULL' },

    // Vertragsmodell-Auswahl (gesetzlich vs. Beitragsgarantie)
    { name: 'vertragsmodell', definition: "ENUM('gesetzlich', 'beitragsgarantie') DEFAULT 'gesetzlich'" },
    { name: 'beitragsgarantie_bei_nichtverlaengerung', definition: "ENUM('aktueller_tarif', 'vertrag_endet') DEFAULT 'aktueller_tarif'" },
    { name: 'verlaengerung_erinnerung_tage', definition: 'INT DEFAULT 60' },
    { name: 'verlaengerung_erinnerung2_tage', definition: 'INT DEFAULT 30' },
    { name: 'verlaengerung_erinnerung3_tage', definition: 'INT DEFAULT 14' },
    { name: 'verlaengerung_email_text', definition: 'TEXT DEFAULT NULL' }
  ];

  let completedColumns = 0;

  columns.forEach((column) => {
    addColumnIfNotExists('dojo', column.name, column.definition, (err) => {
      if (err) {
        // Fehler loggen, aber weitermachen
        console.error(`Konnte Spalte ${column.name} nicht hinzufügen:`, err.message);
      }

      completedColumns++;

      // Alle Spalten abgearbeitet
      if (completedColumns === columns.length) {

        callback();
      }
    });
  });
}

// PUT /api/dojo
router.put('/', (req, res) => {
  console.log('🟡 PUT /api/dojo aufgerufen (einstellungendojo.js)');
  console.log('Request Body Keys:', Object.keys(req.body));

  try {
    // Zuerst sicherstellen, dass die Tabelle alle notwendigen Spalten hat
    ensureTableStructure(() => {
      // Dann die aktuellen Spalten prüfen
      db.query('SHOW COLUMNS FROM dojo', (errCols, columns) => {
        if (errCols) {
          console.error('Fehler beim Abrufen der Spalten:', errCols);
          return res.status(500).json({ error: 'Serverfehler beim Prüfen der Tabelle' });
        }

        // Liste der gültigen Spaltennamen
        const validColumns = columns.map(col => col.Field);

        // Felder, die NICHT vom Frontend geändert werden dürfen (automatisch verwaltet)
        const protectedFields = ['id', 'created_at', 'updated_at', 'last_backup', 'aktualisiert_am'];

        // Nur gültige Felder aus req.body filtern
        const filteredData = {};
        const skippedFields = [];

        Object.keys(req.body).forEach(key => {
          if (protectedFields.includes(key)) {
            // Protected fields werden ignoriert
            skippedFields.push(key + ' (protected)');
          } else if (validColumns.includes(key)) {
            let value = req.body[key];
            
            // Spezielle Behandlung für numerische Felder
            if (key === 'gruendungsjahr' || key === 'max_mitglieder') {
              // Leere Strings oder ungültige Werte zu NULL konvertieren
              if (value === '' || value === null || value === undefined) {
                value = null;
              } else {
                // Sicherstellen dass es eine gültige Zahl ist
                const numValue = parseInt(value);
                if (isNaN(numValue)) {
                  value = null;
                } else {
                  value = numValue.toString();
                }
              }
            }
            
            filteredData[key] = value;
          } else {
            skippedFields.push(key);
          }
        });

        if (skippedFields.length > 0) {
          console.log(`Übersprungene Felder:`, skippedFields.join(', '));
        }

        console.log('Gefilterte Daten:', Object.keys(filteredData).length, 'Felder');

        // Prüfen ob Eintrag existiert
        db.query('SELECT id FROM dojo LIMIT 1', (err, existing) => {
          if (err) {
            console.error('Fehler bei ID-Prüfung:', err);
            return res.status(500).json({ error: 'Serverfehler bei ID-Prüfung' });
          }

          if (existing.length === 0) {

            db.query('INSERT INTO dojo SET ?', filteredData, (errInsert) => {
              if (errInsert) {
                console.error('INSERT Fehler:', errInsert);
                console.error('INSERT Fehler Details:', errInsert.sqlMessage);
                return res.status(500).json({ error: 'Serverfehler beim Einfügen: ' + errInsert.sqlMessage });
              }

              // Nach INSERT neu laden
              db.query('SELECT * FROM dojo LIMIT 1', (err2, current) => {
                if (err2) {
                  console.error('Fehler nach INSERT:', err2);
                  return res.status(500).json({ error: 'Serverfehler nach Einfügen' });
                }

                res.json({
                  success: true,
                  message: 'Gespeichert!',
                  ...current[0]
                });
              });
            });
          } else {

            db.query('UPDATE dojo SET ? WHERE id = ?', [filteredData, existing[0].id], (errUpdate) => {
              if (errUpdate) {
                console.error('UPDATE Fehler:', errUpdate);
                console.error('UPDATE Fehler Details:', errUpdate.sqlMessage);
                return res.status(500).json({ error: 'Serverfehler beim Aktualisieren: ' + errUpdate.sqlMessage });
              }

              // Nach UPDATE neu laden
              db.query('SELECT * FROM dojo LIMIT 1', (err3, current) => {
                if (err3) {
                  console.error('Fehler nach UPDATE:', err3);
                  return res.status(500).json({ error: 'Serverfehler nach Update' });
                }

                res.json({
                  success: true,
                  message: 'Gespeichert!',
                  ...current[0]
                });
              });
            });
          }
        });
      });
    });

  } catch (error) {
    console.error('PUT Fehler:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

// GET /api/dojo/dokumente - Lade nur die rechtlichen Dokumente
router.get('/dokumente', (req, res) => {
  console.log('🔵 GET /api/dojo/dokumente aufgerufen');

  const sqlSelect = `
    SELECT
      agb_text,
      dsgvo_text,
      dojo_regeln_text,
      hausordnung_text,
      haftungsausschluss_text,
      widerrufsbelehrung_text,
      impressum_text,
      vertragsbedingungen_text
    FROM dojo
    LIMIT 1
  `;

  db.query(sqlSelect, (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Dokumente:', err);
      return res.status(500).json({ error: 'Serverfehler beim Laden der Dokumente' });
    }

    if (results.length === 0) {
      // Keine Dokumente vorhanden - leere Dokumente zurückgeben
      return res.json({
        agb_text: '',
        dsgvo_text: '',
        dojo_regeln_text: '',
        hausordnung_text: '',
        haftungsausschluss_text: '',
        widerrufsbelehrung_text: '',
        impressum_text: '',
        vertragsbedingungen_text: ''
      });
    }

    res.json(results[0]);
  });
});

module.exports = router;
