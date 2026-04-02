// routes/csv-import.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Zugriff verweigert: Kein Token' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Zugriff verweigert: Ungültiger Token' });
    }
    req.user = user;
    next();
  });
};

// Multer Setup für CSV-Upload
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const isCSV = file.mimetype === 'text/csv' ||
                  file.mimetype === 'application/vnd.ms-excel' ||
                  file.originalname.toLowerCase().endsWith('.csv');
    if (isCSV) {
      cb(null, true);
    } else {
      cb(new Error('Nur CSV-Dateien sind erlaubt'), false);
    }
  }
});

// Erwartete Spalten für den Import
const REQUIRED_COLUMNS = ['vorname', 'nachname'];
const OPTIONAL_COLUMNS = [
  'email', 'telefon', 'mobil', 'geburtsdatum',
  'strasse', 'hausnummer', 'plz', 'ort', 'land',
  'geschlecht', 'mitgliedsnummer', 'eintrittsdatum',
  'notfallkontakt_name', 'notfallkontakt_telefon',
  'notizen', 'status'
];

/**
 * GET /template - Lädt eine Vorlage-CSV herunter
 */
router.get('/template', authenticateToken, (req, res) => {
  const headers = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
  const exampleRow = [
    'Max', 'Mustermann', 'max@beispiel.de', '+49 123 456789', '+49 170 1234567',
    '15.03.1990', 'Musterstraße', '42', '12345', 'Musterstadt', 'Deutschland',
    'm', 'M-001', '01.01.2024', 'Maria Mustermann', '+49 123 987654',
    'Anfänger, Karate', 'aktiv'
  ];

  const csvContent = headers.join(';') + '\n' + exampleRow.join(';') + '\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=mitglieder-import-vorlage.csv');
  // BOM für Excel-Kompatibilität
  res.send('\uFEFF' + csvContent);
});

/**
 * GET /info - Gibt Informationen über die erwarteten Spalten zurück
 */
router.get('/info', authenticateToken, (req, res) => {
  res.json({
    success: true,
    required_columns: REQUIRED_COLUMNS,
    optional_columns: OPTIONAL_COLUMNS,
    column_descriptions: {
      vorname: 'Vorname des Mitglieds (Pflicht)',
      nachname: 'Nachname des Mitglieds (Pflicht)',
      email: 'E-Mail-Adresse',
      telefon: 'Telefonnummer (Festnetz)',
      mobil: 'Mobilnummer',
      geburtsdatum: 'Geburtsdatum (Format: TT.MM.JJJJ oder JJJJ-MM-TT)',
      strasse: 'Straßenname',
      hausnummer: 'Hausnummer',
      plz: 'Postleitzahl',
      ort: 'Stadt/Ort',
      land: 'Land (Standard: Deutschland)',
      geschlecht: 'm = männlich, w = weiblich, d = divers',
      mitgliedsnummer: 'Eigene Mitgliedsnummer (optional, wird sonst generiert)',
      eintrittsdatum: 'Eintrittsdatum (Format: TT.MM.JJJJ oder JJJJ-MM-TT)',
      notfallkontakt_name: 'Name des Notfallkontakts',
      notfallkontakt_telefon: 'Telefon des Notfallkontakts',
      notizen: 'Zusätzliche Notizen',
      status: 'aktiv, inaktiv, gekuendigt (Standard: aktiv)'
    },
    format_hints: {
      separator: 'Semikolon (;) als Trennzeichen',
      encoding: 'UTF-8 empfohlen',
      date_format: 'TT.MM.JJJJ oder JJJJ-MM-TT'
    }
  });
});

/**
 * POST /upload - Importiert Mitglieder aus einer CSV-Datei
 */
router.post('/upload', authenticateToken, upload.single('csvFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Keine CSV-Datei hochgeladen' });
  }

  const dojoId = req.body.dojo_id || req.user.dojo_id;
  if (!dojoId) {
    // Cleanup
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Keine Dojo-ID angegeben' });
  }

  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    imported: []
  };

  const startTime = Date.now();

  try {
    // CSV-Datei lesen und parsen
    const rows = [];
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');

    // BOM entfernen falls vorhanden
    const cleanContent = fileContent.replace(/^\uFEFF/, '');

    // Zeilen parsen (unterstützt ; und , als Trennzeichen)
    const lines = cleanContent.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV-Datei enthält keine Daten (mindestens Header + 1 Zeile erforderlich)');
    }

    // Header analysieren
    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    // Pflichtfelder prüfen
    const missingRequired = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    if (missingRequired.length > 0) {
      throw new Error(`Pflichtfelder fehlen: ${missingRequired.join(', ')}`);
    }

    // Daten-Zeilen parsen
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push({ line: i + 1, data: row });
    }

    results.total = rows.length;

    // Jede Zeile importieren
    for (const { line, data } of rows) {
      try {
        // Validierung
        if (!data.vorname || !data.nachname) {
          results.failed++;
          results.errors.push({ line, error: 'Vorname oder Nachname fehlt' });
          continue;
        }

        // Datum konvertieren
        const geburtsdatum = convertDate(data.geburtsdatum);
        const eintrittsdatum = convertDate(data.eintrittsdatum) || new Date().toISOString().split('T')[0];

        // Prüfen ob Mitglied bereits existiert (per Email oder Name+Geburtsdatum)
        let existingMember = null;
        if (data.email) {
          const [existing] = await db.promise().query(
            'SELECT mitglied_id FROM mitglieder WHERE dojo_id = ? AND email = ?',
            [dojoId, data.email]
          );
          if (existing.length > 0) {
            existingMember = existing[0];
          }
        }

        if (!existingMember && geburtsdatum) {
          const [existing] = await db.promise().query(
            'SELECT mitglied_id FROM mitglieder WHERE dojo_id = ? AND vorname = ? AND nachname = ? AND geburtsdatum = ?',
            [dojoId, data.vorname, data.nachname, geburtsdatum]
          );
          if (existing.length > 0) {
            existingMember = existing[0];
          }
        }

        if (existingMember) {
          results.skipped++;
          results.errors.push({
            line,
            error: `Mitglied existiert bereits: ${data.vorname} ${data.nachname}`,
            type: 'warning'
          });
          continue;
        }

        // Mitglied anlegen
        const memberData = {
          dojo_id: dojoId,
          vorname: data.vorname,
          nachname: data.nachname,
          email: data.email || null,
          telefon: data.telefon || null,
          mobil: data.mobil || null,
          geburtsdatum: geburtsdatum,
          strasse: data.strasse || null,
          hausnummer: data.hausnummer || null,
          plz: data.plz || null,
          ort: data.ort || null,
          land: data.land || 'Deutschland',
          geschlecht: mapGender(data.geschlecht),
          mitgliedsnummer: data.mitgliedsnummer || null,
          eintrittsdatum: eintrittsdatum,
          notfallkontakt_name: data.notfallkontakt_name || null,
          notfallkontakt_telefon: data.notfallkontakt_telefon || null,
          notizen: data.notizen || null,
          status: mapStatus(data.status)
        };

        const [result] = await db.promise().query(
          `INSERT INTO mitglieder SET ?`,
          [memberData]
        );

        results.successful++;
        results.imported.push({
          line,
          mitglied_id: result.insertId,
          name: `${data.vorname} ${data.nachname}`
        });

      } catch (err) {
        results.failed++;
        results.errors.push({ line, error: err.message });
      }
    }

    // Cleanup
    fs.unlinkSync(req.file.path);

    const duration = (Date.now() - startTime) / 1000;

    res.json({
      success: true,
      results: {
        ...results,
        duration
      }
    });

  } catch (error) {
    // Cleanup bei Fehler
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('CSV Import Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

// Hilfsfunktionen
function convertDate(dateStr) {
  if (!dateStr) return null;

  // Format: DD.MM.YYYY
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // Format: YYYY-MM-DD
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  return null;
}

function mapGender(value) {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  if (v === 'm' || v === 'männlich' || v === 'male') return 'm';
  if (v === 'w' || v === 'weiblich' || v === 'female' || v === 'f') return 'w';
  if (v === 'd' || v === 'divers' || v === 'diverse') return 'd';
  return null;
}

function mapStatus(value) {
  if (!value) return 'aktiv';
  const v = value.toLowerCase().trim();
  if (v === 'inaktiv' || v === 'inactive') return 'inaktiv';
  if (v === 'gekuendigt' || v === 'gekündigt' || v === 'cancelled') return 'gekuendigt';
  return 'aktiv';
}

module.exports = router;
