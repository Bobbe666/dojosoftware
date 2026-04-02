// routes/einstellungendojo.js
const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

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
      logger.error(`Fehler beim Prüfen der Spalte ${columnName}:`, { error: err.message });
      return callback(err);
    }
    if (results[0].count === 0) {
      const alterSql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`;
      db.query(alterSql, (errAlter) => {
        if (errAlter) {
          logger.error(`Fehler beim Hinzufügen der Spalte ${columnName}:`, { error: errAlter.message });
          return callback(errAlter);
        }
        callback(null);
      });
    } else {
      callback(null);
    }
  });
}

// Funktion um Tabellen-Struktur sicherzustellen (Migration)
function ensureTableStructure(callback) {
  const columns = [
    { name: 'agb_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'dsgvo_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'dojo_regeln_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'hausordnung_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'haftungsausschluss_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'widerrufsbelehrung_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'impressum_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'vertragsbedingungen_text', definition: 'TEXT DEFAULT NULL' },
    { name: 'untertitel', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vertreter', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'gruendungsjahr', definition: 'VARCHAR(10) DEFAULT NULL' },
    { name: 'land', definition: "VARCHAR(100) DEFAULT 'Deutschland'" },
    { name: 'fax', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'email_info', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'email_anmeldung', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'whatsapp_nummer', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'steuernummer', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'umsatzsteuer_id', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'finanzamt', definition: 'JSON DEFAULT NULL' },
    { name: 'steuerberater', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'steuerberater_telefon', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'umsatzsteuerpflichtig', definition: 'BOOLEAN DEFAULT FALSE' },
    { name: 'kleinunternehmer', definition: 'BOOLEAN DEFAULT FALSE' },
    { name: 'gemeinnuetzig', definition: 'BOOLEAN DEFAULT FALSE' },
    { name: 'freistellungsbescheid_datum', definition: 'DATE DEFAULT NULL' },
    { name: 'rechtsform', definition: "VARCHAR(100) DEFAULT 'Verein'" },
    { name: 'vereinsregister_nr', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'amtsgericht', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'handelsregister_nr', definition: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'geschaeftsfuehrer', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vorstand_1_vorsitzender', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vorstand_2_vorsitzender', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vorstand_kassenwart', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'vorstand_schriftfuehrer', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'theme_scheme', definition: "VARCHAR(50) DEFAULT 'default'" },
    { name: 'logo_url', definition: 'VARCHAR(500) DEFAULT NULL' },
    { name: 'favicon_url', definition: 'VARCHAR(500) DEFAULT NULL' },
    { name: 'dsgvo_beauftragte', definition: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'max_mitglieder', definition: 'INT DEFAULT 500' },
    { name: 'kuendigungsfrist_monate', definition: 'INT DEFAULT 3' },
    { name: 'mindestlaufzeit_monate', definition: 'INT DEFAULT 12' },
    { name: 'probezeit_tage', definition: 'INT DEFAULT 14' },
    { name: 'kuendigung_nur_monatsende', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'kuendigung_schriftlich', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'automatische_verlaengerung', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'verlaengerung_monate', definition: 'INT DEFAULT 12' },
    { name: 'kuendigung_erstlaufzeit_monate', definition: 'INT DEFAULT 3' },
    { name: 'kuendigung_verlaengerung_monate', definition: 'INT DEFAULT 1' },
    { name: 'vertrag_3_monate_preis', definition: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'vertrag_6_monate_preis', definition: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'vertrag_12_monate_preis', definition: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'vertrag_3_monate_aktiv', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'vertrag_6_monate_aktiv', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'vertrag_12_monate_aktiv', definition: 'BOOLEAN DEFAULT TRUE' },
    { name: 'jahresbeitrag', definition: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'familienrabatt_prozent', definition: 'DECIMAL(5,2) DEFAULT NULL' },
    { name: 'schuelerrabatt_prozent', definition: 'DECIMAL(5,2) DEFAULT NULL' },
    { name: 'vereinsmitglied_rabatt_prozent', definition: 'DECIMAL(5,2) DEFAULT NULL' },
    { name: 'mehrfachtraining_rabatt_prozent', definition: 'DECIMAL(5,2) DEFAULT NULL' },
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
      if (err) logger.error(`Konnte Spalte ${column.name} nicht hinzufügen:`, { error: err.message });
      completedColumns++;
      if (completedColumns === columns.length) callback();
    });
  });
}

// GET /api/dojo
router.get('/', (req, res) => {
  logger.debug('🔵 GET /api/dojo aufgerufen');
  const dojoId = getSecureDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
  }

  ensureTableStructure(() => {
    db.query('SELECT * FROM dojo WHERE id = ?', [dojoId], (err, results) => {
      if (err) {
        logger.error('Fehler beim Laden der Dojo-Daten:', { error: err });
        return res.status(500).json({ error: 'Serverfehler beim Laden der Dojo-Daten' });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: 'Dojo nicht gefunden' });
      }
      res.json(results[0]);
    });
  });
});

// PUT /api/dojo
router.put('/', (req, res) => {
  logger.debug('🟡 PUT /api/dojo aufgerufen');
  const dojoId = getSecureDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
  }

  try {
    ensureTableStructure(() => {
      db.query('SHOW COLUMNS FROM dojo', (errCols, columns) => {
        if (errCols) {
          logger.error('Fehler beim Abrufen der Spalten:', { error: errCols });
          return res.status(500).json({ error: 'Serverfehler beim Prüfen der Tabelle' });
        }

        const validColumns = columns.map(col => col.Field);
        const protectedFields = ['id', 'created_at', 'updated_at', 'last_backup', 'aktualisiert_am'];

        const filteredData = {};
        const skippedFields = [];

        Object.keys(req.body).forEach(key => {
          if (protectedFields.includes(key)) {
            skippedFields.push(key + ' (protected)');
          } else if (validColumns.includes(key)) {
            let value = req.body[key];
            if (key === 'gruendungsjahr' || key === 'max_mitglieder') {
              if (value === '' || value === null || value === undefined) {
                value = null;
              } else {
                const numValue = parseInt(value);
                value = isNaN(numValue) ? null : numValue.toString();
              }
            }
            filteredData[key] = value;
          } else {
            skippedFields.push(key);
          }
        });

        if (skippedFields.length > 0) logger.debug('Übersprungene Felder:', skippedFields.join(', '));

        // UPDATE nur für das eigene Dojo
        db.query('UPDATE dojo SET ? WHERE id = ?', [filteredData, dojoId], (errUpdate) => {
          if (errUpdate) {
            logger.error('UPDATE Fehler:', { error: errUpdate });
            return res.status(500).json({ error: 'Serverfehler beim Aktualisieren: ' + errUpdate.sqlMessage });
          }

          db.query('SELECT * FROM dojo WHERE id = ?', [dojoId], (err3, current) => {
            if (err3) {
              logger.error('Fehler nach UPDATE:', { error: err3 });
              return res.status(500).json({ error: 'Serverfehler nach Update' });
            }
            res.json({ success: true, message: 'Gespeichert!', ...current[0] });
          });
        });
      });
    });
  } catch (error) {
    logger.error('PUT Fehler:', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dojo/dokumente
router.get('/dokumente', (req, res) => {
  logger.debug('🔵 GET /api/dojo/dokumente aufgerufen');
  const dojoId = getSecureDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
  }

  const sqlSelect = `
    SELECT agb_text, dsgvo_text, dojo_regeln_text, hausordnung_text,
           haftungsausschluss_text, widerrufsbelehrung_text, impressum_text, vertragsbedingungen_text
    FROM dojo WHERE id = ?
  `;

  db.query(sqlSelect, [dojoId], (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Dokumente:', { error: err });
      return res.status(500).json({ error: 'Serverfehler beim Laden der Dokumente' });
    }
    if (results.length === 0) {
      return res.json({
        agb_text: '', dsgvo_text: '', dojo_regeln_text: '', hausordnung_text: '',
        haftungsausschluss_text: '', widerrufsbelehrung_text: '', impressum_text: '',
        vertragsbedingungen_text: ''
      });
    }
    res.json(results[0]);
  });
});

module.exports = router;
