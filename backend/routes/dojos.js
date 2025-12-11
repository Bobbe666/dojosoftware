// Backend/routes/dojos.js
// Multi-Dojo-Verwaltung API

const express = require('express');
const router = express.Router();

// =====================================================
// GET /api/dojos - Alle Dojos abrufen
// =====================================================
router.get('/', (req, res) => {
  const query = `
    SELECT
      d.id,
      d.dojoname,
      d.inhaber,
      d.strasse,
      d.hausnummer,
      d.plz,
      d.ort,
      d.telefon,
      d.email,
      d.internet,
      d.steuer_status,
      d.ust_satz,
      d.kleinunternehmer_grenze,
      COALESCE(
        (SELECT SUM(
          CASE 
            WHEN v.billing_cycle = 'monthly' THEN COALESCE(v.monatsbeitrag, t.price_cents / 100) * 12
            WHEN v.billing_cycle = 'quarterly' THEN COALESCE(v.monatsbeitrag, t.price_cents / 100) * 4
            WHEN v.billing_cycle = 'yearly' THEN COALESCE(v.monatsbeitrag, t.price_cents / 100)
            WHEN v.billing_cycle = 'weekly' THEN COALESCE(v.monatsbeitrag, t.price_cents / 100) * 52
            WHEN v.billing_cycle = 'daily' THEN COALESCE(v.monatsbeitrag, t.price_cents / 100) * 365
            ELSE COALESCE(v.monatsbeitrag, t.price_cents / 100) * 12
          END
        )
         FROM vertraege v
         LEFT JOIN tarife t ON v.tarif_id = t.id
         WHERE v.dojo_id = d.id
         AND v.status = 'aktiv'),
        0
      ) as jahresumsatz_aktuell,
      d.jahresumsatz_vorjahr,
      d.steuer_jahr,
      d.steuer_warnung_80_prozent,
      d.steuer_warnung_100_prozent,
      d.ist_aktiv,
      d.ist_hauptdojo,
      d.sortierung,
      d.farbe,
      d.finanzamt_name,
      d.steuernummer,
      d.ust_id,
      d.sepa_glaeubiger_id,
      d.iban,
      d.bic,
      d.bank,
      d.aktualisiert_am
    FROM dojo d
    WHERE d.ist_aktiv = TRUE
    ORDER BY d.sortierung ASC, d.id ASC
  `;

  req.db.query(query, (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen der Dojos:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Dojos' });
    }

    res.json(results);
  });
});

// =====================================================
// GET /api/dojos/:id - Einzelnes Dojo abrufen (alle Felder)
// =====================================================
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const query = `SELECT * FROM dojo WHERE id = ?`;

  req.db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen des Dojos:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    res.json(results[0]);
  });
});

// =====================================================
// POST /api/dojos - Neues Dojo erstellen (dynamisch)
// =====================================================
router.post('/', (req, res) => {

  console.log('Request Body Keys:', Object.keys(req.body));

  // Validation
  if (!req.body.dojoname || !req.body.inhaber) {
    return res.status(400).json({ error: 'Dojoname und Inhaber sind Pflichtfelder' });
  }

  // Hole alle Spalten der Tabelle
  req.db.query('SHOW COLUMNS FROM dojo', (errCols, columns) => {
    if (errCols) {
      console.error('Fehler beim Abrufen der Spalten:', errCols);
      return res.status(500).json({ error: 'Serverfehler beim Prüfen der Tabelle' });
    }

    // Liste der gültigen Spaltennamen
    const validColumns = columns.map(col => col.Field);

    // Felder, die NICHT vom Frontend gesetzt werden dürfen
    const protectedFields = ['id', 'created_at', 'updated_at', 'last_backup', 'aktualisiert_am'];

    // Nur gültige Felder aus req.body filtern
    const filteredData = {};
    const skippedFields = [];

    Object.keys(req.body).forEach(key => {
      if (protectedFields.includes(key)) {
        skippedFields.push(key + ' (protected)');
      } else if (validColumns.includes(key)) {
        filteredData[key] = req.body[key];
      } else {
        skippedFields.push(key);
      }
    });

    if (skippedFields.length > 0) {
      console.log(`Übersprungene Felder:`, skippedFields.join(', '));
    }

    // Hole die nächste Sortierung
    req.db.query('SELECT MAX(sortierung) as max_sort FROM dojo', (err, sortResult) => {
      if (err) {
        console.error('Fehler beim Abrufen der Sortierung:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      const nextSort = (sortResult[0].max_sort || 0) + 1;

      // Standardwerte setzen, falls nicht vorhanden
      if (!filteredData.steuer_status) filteredData.steuer_status = 'kleinunternehmer';
      if (!filteredData.ust_satz) filteredData.ust_satz = 0.00;
      if (!filteredData.farbe) filteredData.farbe = '#FFD700';
      if (!filteredData.kleinunternehmer_grenze) filteredData.kleinunternehmer_grenze = 22000.00;
      if (!filteredData.jahresumsatz_aktuell) filteredData.jahresumsatz_aktuell = 0.00;

      filteredData.sortierung = nextSort;
      filteredData.ist_aktiv = true;
      filteredData.ist_hauptdojo = false;

      // Konvertiere leere Strings zu NULL für Date/Timestamp/Numeric-Felder
      console.log('🔧 Validiere und bereinige Felder (CREATE)...');
      let convertedFields = [];
      Object.keys(filteredData).forEach(field => {
        // Prüfe ob der Wert ein leerer String ist
        if (filteredData[field] === '') {
          // Felder die wahrscheinlich Datum/Timestamp sind sollten NULL sein statt ''
          const likelyDateFields = ['datum', 'ablauf', 'pruefung', 'turnier', 'lehrgang', '_at', '_am'];
          const isDateField = likelyDateFields.some(pattern => field.toLowerCase().includes(pattern));

          // Felder die wahrscheinlich numerisch sind (DECIMAL, INT, etc.)
          const likelyNumericFields = ['beitrag', 'betrag', 'satz', 'grenze', 'umsatz', 'gebuehr', 'anzahl',
                                         'prozent', 'jahr', 'monate', 'tage', 'max_', 'min_', 'mitgliederzahl',
                                         'police_nr', 'kaution', 'aufnahmegebuehr'];
          const isNumericField = likelyNumericFields.some(pattern => field.toLowerCase().includes(pattern));

          if (isDateField || isNumericField) {
            filteredData[field] = null;
            convertedFields.push(field);
          }
        }
      });
      if (convertedFields.length > 0) {
        console.log('✅ Konvertierte leere Strings zu NULL:', convertedFields.join(', '));
      }

      console.log('Gefilterte Daten:', Object.keys(filteredData).length, 'Felder');

      // Dynamisches INSERT
      req.db.query('INSERT INTO dojo SET ?', filteredData, (insertErr, result) => {
        if (insertErr) {
          console.error('Fehler beim Erstellen des Dojos:', insertErr);
          console.error('INSERT Fehler Details:', insertErr.sqlMessage);
          return res.status(500).json({ error: 'Fehler beim Erstellen: ' + insertErr.sqlMessage });
        }

        res.status(201).json({
          success: true,
          id: result.insertId,
          message: 'Dojo erfolgreich erstellt',
          dojo: {
            id: result.insertId,
            dojoname: filteredData.dojoname,
            inhaber: filteredData.inhaber,
            steuer_status: filteredData.steuer_status,
            sortierung: nextSort
          }
        });
      });
    });
  });
});

// =====================================================
// PUT /api/dojos/:id - Dojo aktualisieren (dynamisch)
// =====================================================
router.put('/:id', (req, res) => {
  const { id } = req.params;

  console.log('Request Body Keys:', Object.keys(req.body));

  // Hole alle Spalten der Tabelle
  req.db.query('SHOW COLUMNS FROM dojo', (errCols, columns) => {
    if (errCols) {
      console.error('Fehler beim Abrufen der Spalten:', errCols);
      return res.status(500).json({ error: 'Serverfehler beim Prüfen der Tabelle' });
    }

    // Liste der gültigen Spaltennamen
    const validColumns = columns.map(col => col.Field);

    // Felder, die NICHT vom Frontend geändert werden dürfen (automatisch verwaltet)
    const protectedFields = ['id', 'created_at', 'updated_at', 'last_backup', 'aktualisiert_am', 'ist_aktiv', 'ist_hauptdojo'];

    // Nur gültige Felder aus req.body filtern
    const filteredData = {};
    const skippedFields = [];

    Object.keys(req.body).forEach(key => {
      if (protectedFields.includes(key)) {
        // Protected fields werden ignoriert
        skippedFields.push(key + ' (protected)');
      } else if (validColumns.includes(key)) {
        filteredData[key] = req.body[key];
      } else {
        skippedFields.push(key);
      }
    });

    if (skippedFields.length > 0) {
      console.log(`Übersprungene Felder:`, skippedFields.join(', '));
    }

    console.log('Gefilterte Daten:', Object.keys(filteredData).length, 'Felder');

    // Konvertiere leere Strings zu NULL für Date/Timestamp/Numeric-Felder

    let convertedFields = [];
    Object.keys(filteredData).forEach(field => {
      // Prüfe ob der Wert ein leerer String ist
      if (filteredData[field] === '') {
        // Felder die wahrscheinlich Datum/Timestamp sind sollten NULL sein statt ''
        const likelyDateFields = ['datum', 'ablauf', 'pruefung', 'turnier', 'lehrgang', '_at', '_am'];
        const isDateField = likelyDateFields.some(pattern => field.toLowerCase().includes(pattern));

        // Felder die wahrscheinlich numerisch sind (DECIMAL, INT, etc.)
        const likelyNumericFields = ['beitrag', 'betrag', 'satz', 'grenze', 'umsatz', 'gebuehr', 'anzahl',
                                       'prozent', 'jahr', 'monate', 'tage', 'max_', 'min_', 'mitgliederzahl',
                                       'police_nr', 'kaution', 'aufnahmegebuehr'];
        const isNumericField = likelyNumericFields.some(pattern => field.toLowerCase().includes(pattern));

        if (isDateField || isNumericField) {
          filteredData[field] = null;
          convertedFields.push(field);
        }
      }
    });
    if (convertedFields.length > 0) {
      console.log('✅ Konvertierte leere Strings zu NULL:', convertedFields.join(', '));
    }

    // Prüfe ob Dojo existiert
    req.db.query('SELECT id FROM dojo WHERE id = ?', [id], (err, existing) => {
      if (err) {
        console.error('Fehler bei ID-Prüfung:', err);
        return res.status(500).json({ error: 'Serverfehler bei ID-Prüfung' });
      }

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Dojo nicht gefunden' });
      }

      // Dynamisches UPDATE mit allen gefilterten Feldern
      req.db.query('UPDATE dojo SET ? WHERE id = ?', [filteredData, id], (errUpdate) => {
        if (errUpdate) {
          console.error('UPDATE Fehler:', errUpdate);
          console.error('UPDATE Fehler Details:', errUpdate.sqlMessage);
          return res.status(500).json({ error: 'Fehler beim Aktualisieren: ' + errUpdate.sqlMessage });
        }

        res.json({
          success: true,
          message: 'Dojo erfolgreich aktualisiert'
        });
      });
    });
  });
});

// =====================================================
// DELETE /api/dojos/:id - Dojo deaktivieren (Soft Delete)
// =====================================================
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // Prüfe ob es das Haupt-Dojo ist
  req.db.query('SELECT ist_hauptdojo FROM dojo WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Fehler beim Prüfen des Dojos:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    if (results[0].ist_hauptdojo) {
      return res.status(400).json({ error: 'Das Haupt-Dojo kann nicht gelöscht werden' });
    }

    // Soft Delete - setze ist_aktiv auf FALSE
    const deleteQuery = 'UPDATE dojo SET ist_aktiv = FALSE WHERE id = ?';

    req.db.query(deleteQuery, [id], (deleteErr) => {
      if (deleteErr) {
        console.error('Fehler beim Deaktivieren des Dojos:', deleteErr);
        return res.status(500).json({ error: 'Fehler beim Löschen' });
      }

      res.json({ message: 'Dojo erfolgreich deaktiviert' });
    });
  });
});

// =====================================================
// GET /api/dojos/:id/statistics - Dojo-Statistiken
// =====================================================
router.get('/:id/statistics', (req, res) => {
  const { id } = req.params;
  const jahr = req.query.jahr || new Date().getFullYear();

  const query = `
    SELECT
      (SELECT COUNT(*) FROM mitglieder WHERE dojo_id = ? AND status = 'aktiv') as mitglieder_aktiv,
      (SELECT COUNT(*) FROM kurse WHERE dojo_id = ?) as kurse_anzahl,
      (SELECT COUNT(*) FROM trainer WHERE dojo_id = ?) as trainer_anzahl,
      (SELECT COUNT(*) FROM vertraege WHERE dojo_id = ?) as vertraege_anzahl,
      (SELECT COALESCE(SUM(betrag), 0) FROM beitraege
       WHERE dojo_id = ? AND YEAR(erstellt_am) = ?) as jahresumsatz,
      (SELECT COALESCE(SUM(betrag), 0) FROM beitraege
       WHERE dojo_id = ? AND YEAR(erstellt_am) = ? - 1) as jahresumsatz_vorjahr,
      (SELECT steuer_status FROM dojo WHERE id = ?) as steuer_status,
      (SELECT ust_satz FROM dojo WHERE id = ?) as ust_satz,
      (SELECT kleinunternehmer_grenze FROM dojo WHERE id = ?) as kleinunternehmer_grenze
  `;

  req.db.query(query, [id, id, id, id, id, jahr, id, jahr, id, id, id], (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen der Statistiken:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
    }

    const stats = results[0];
    const grenze = parseFloat(stats.kleinunternehmer_grenze);
    const umsatz = parseFloat(stats.jahresumsatz);

    // Berechne Prozentsatz der Grenze
    stats.grenze_prozent = grenze > 0 ? (umsatz / grenze * 100).toFixed(2) : 0;
    stats.grenze_erreicht_80 = stats.grenze_prozent >= 80;
    stats.grenze_erreicht_100 = stats.grenze_prozent >= 100;

    // Berechne USt wenn Regelbesteuerung
    if (stats.steuer_status === 'regelbesteuerung') {
      stats.ust_betrag = (umsatz * (stats.ust_satz / 100)).toFixed(2);
    } else {
      stats.ust_betrag = 0;
    }

    res.json(stats);
  });
});

// =====================================================
// GET /api/dojos/statistics/gesamt - Gesamt-Statistiken
// =====================================================
router.get('/statistics/gesamt', (req, res) => {
  const jahr = req.query.jahr || new Date().getFullYear();

  const query = `
    SELECT
      -- Anzahl aktiver Dojos
      (SELECT COUNT(*) FROM dojo WHERE ist_aktiv = TRUE) as dojos_anzahl,

      -- Anzahl aktiver Mitglieder (über alle Dojos)
      (SELECT COUNT(*) FROM mitglieder WHERE ist_aktiv = TRUE) as mitglieder_gesamt,

      -- Anzahl Kurse (über alle Dojos)
      (SELECT COUNT(*) FROM kurse) as kurse_gesamt,

      -- Umsatz von Kleinunternehmer-Dojos (aktuelles Jahr)
      (SELECT COALESCE(SUM(d.jahresumsatz_aktuell), 0)
       FROM dojo d
       WHERE d.ist_aktiv = TRUE AND d.steuer_status = 'kleinunternehmer'
      ) as umsatz_kleinunternehmer,

      -- Umsatz von Regelbesteuerten Dojos (aktuelles Jahr)
      (SELECT COALESCE(SUM(d.jahresumsatz_aktuell), 0)
       FROM dojo d
       WHERE d.ist_aktiv = TRUE AND d.steuer_status = 'regelbesteuert'
      ) as umsatz_regelbesteuerung,

      -- Gesamtumsatz (aktuelles Jahr)
      (SELECT COALESCE(SUM(d.jahresumsatz_aktuell), 0)
       FROM dojo d
       WHERE d.ist_aktiv = TRUE
      ) as umsatz_gesamt,

      -- USt zu zahlen (nur von regelbesteuerten Dojos, aktuelles Jahr)
      (SELECT COALESCE(SUM(d.jahresumsatz_aktuell * d.ust_satz / 100), 0)
       FROM dojo d
       WHERE d.ist_aktiv = TRUE AND d.steuer_status = 'regelbesteuert'
      ) as ust_gesamt
  `;

  req.db.query(query, (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen der Gesamt-Statistiken:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
    }

    res.json(results[0]);
  });
});

// =====================================================
// POST /api/dojos/migrate/add-bank-fields - MIGRATION
// =====================================================
router.post('/migrate/add-bank-fields', (req, res) => {

  const fields = [
    { name: 'sepa_glaeubiger_id', type: 'VARCHAR(35)', after: 'internet' },
    { name: 'iban', type: 'VARCHAR(34)', after: 'sepa_glaeubiger_id' },
    { name: 'bic', type: 'VARCHAR(11)', after: 'iban' },
    { name: 'bank', type: 'VARCHAR(100)', after: 'bic' }
  ];

  const results = [];
  let completed = 0;

  fields.forEach((field, index) => {
    // Check if column exists
    req.db.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dojo' AND COLUMN_NAME = ?
    `, [field.name], (err, columns) => {
      if (err) {
        console.error(`Error checking ${field.name}:`, err.message);
        results.push({ field: field.name, status: 'error', error: err.message });
        completed++;
        if (completed === fields.length) {
          res.json({ success: true, message: 'Migration completed', results });
        }
        return;
      }

      if (columns.length === 0) {
        // Add the column
        req.db.query(
          `ALTER TABLE dojo ADD COLUMN ${field.name} ${field.type} DEFAULT NULL AFTER ${field.after}`,
          (err2) => {
            if (err2) {
              console.error(`Error adding ${field.name}:`, err2.message);
              results.push({ field: field.name, status: 'error', error: err2.message });
            } else {

              results.push({ field: field.name, status: 'added' });
            }
            completed++;
            if (completed === fields.length) {
              res.json({ success: true, message: 'Migration completed', results });
            }
          }
        );
      } else {

        results.push({ field: field.name, status: 'exists' });
        completed++;
        if (completed === fields.length) {
          res.json({ success: true, message: 'Migration completed', results });
        }
      }
    });
  });
});

module.exports = router;
