// routes/buchhaltung.js
// EÜR (Einnahmen-Überschuss-Rechnung) für Super Admin Dashboard
// GoBD-konform mit Audit-Trail

const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');

// ===================================================================
// 📂 FILE UPLOAD CONFIG
// ===================================================================
const uploadDir = path.join(__dirname, '..', 'uploads', 'belege');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF, JPG und PNG Dateien erlaubt'));
    }
  }
});

// Bank-Import Upload Config
const bankUploadDir = path.join(__dirname, '..', 'uploads', 'bank-import');
if (!fs.existsSync(bankUploadDir)) {
  fs.mkdirSync(bankUploadDir, { recursive: true });
}

const bankStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, bankUploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const bankUpload = multer({
  storage: bankStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB für große Kontoauszüge
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'text/plain', 'application/octet-stream',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const allowedExts = ['.csv', '.sta', '.mt940', '.txt', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Nur CSV, MT940 und Excel Dateien erlaubt'));
    }
  }
});

// ===================================================================
// 🏦 BANK CSV PARSER (Deutsche Banken)
// ===================================================================

// Erkennt Bank-Format anhand der Header-Zeile
const detectBankFormat = (headerLine) => {
  const lower = headerLine.toLowerCase();
  if (lower.includes('auftragskonto') || lower.includes('kontonummer des auftraggebers')) {
    return 'sparkasse';
  }
  if (lower.includes('textschlüssel') || lower.includes('textschluessel')) {
    return 'volksbank';
  }
  if (lower.includes('gläubiger-id') || lower.includes('glaeubiger-id') || lower.includes('mandatsreferenz')) {
    return 'dkb';
  }
  if (lower.includes('buchungstag') && lower.includes('betrag')) {
    return 'generic';
  }
  return 'unknown';
};

// Parsed deutschen Betrag (1.234,56 -> 1234.56)
const parseGermanAmount = (str) => {
  if (!str) return 0;
  // Entferne Währungssymbole und Leerzeichen
  let cleaned = str.replace(/[€\s]/g, '').trim();
  // Deutsche Notation: 1.234,56 -> 1234.56
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

// Parsed deutsches Datum (DD.MM.YYYY -> YYYY-MM-DD)
const parseGermanDate = (str) => {
  if (!str) return null;
  const parts = str.trim().split('.');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? '19' + year : '20' + year;
    }
    return `${year}-${month}-${day}`;
  }
  // Falls ISO-Format
  if (str.includes('-')) return str;
  return null;
};

// CSV Parser für verschiedene Bank-Formate
const parseCSVContent = (content, encoding = 'utf-8') => {
  // Konvertiere Encoding falls nötig
  let text = content;
  if (encoding !== 'utf-8') {
    text = iconv.decode(Buffer.from(content), encoding);
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return { error: 'Datei ist leer oder hat keine Daten', transaktionen: [] };

  // Finde Header-Zeile (kann in Zeile 0-5 sein)
  let headerIndex = 0;
  let format = 'unknown';
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    format = detectBankFormat(lines[i]);
    if (format !== 'unknown') {
      headerIndex = i;
      break;
    }
  }

  if (format === 'unknown') {
    return { error: 'Unbekanntes Bank-Format', transaktionen: [] };
  }

  const headerLine = lines[headerIndex];
  const separator = headerLine.includes('\t') ? '\t' : ';';
  const headers = headerLine.split(separator).map(h => h.replace(/"/g, '').trim().toLowerCase());

  const transaktionen = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Parse CSV-Zeile (berücksichtigt Anführungszeichen)
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line + separator) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (values.length < 3) continue;

    // Erstelle Objekt aus Spalten
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    // Normalisiere basierend auf Format
    let transaktion;
    try {
      transaktion = normalizeTransaction(row, format);
      if (transaktion && transaktion.buchungsdatum && transaktion.betrag !== 0) {
        transaktionen.push(transaktion);
      }
    } catch (e) {
      console.error('Fehler beim Parsen der Zeile:', e, row);
    }
  }

  return { format, bank: getBankName(format), transaktionen };
};

// Normalisiert Transaktion basierend auf Bank-Format
const normalizeTransaction = (row, format) => {
  let t = {
    buchungsdatum: null,
    valutadatum: null,
    betrag: 0,
    verwendungszweck: '',
    auftraggeber_empfaenger: '',
    iban_gegenkonto: '',
    bic: '',
    buchungstext: '',
    mandatsreferenz: '',
    kundenreferenz: ''
  };

  switch (format) {
    case 'sparkasse':
      t.buchungsdatum = parseGermanDate(row['buchungstag'] || row['buchungsdatum']);
      t.valutadatum = parseGermanDate(row['valuta'] || row['wertstellung']);
      t.betrag = parseGermanAmount(row['betrag']);
      t.verwendungszweck = row['verwendungszweck'] || '';
      t.auftraggeber_empfaenger = row['beguenstigter/zahlungspflichtiger'] || row['begünstigter'] || row['name'] || '';
      t.iban_gegenkonto = row['iban'] || row['kontonummer'] || '';
      t.bic = row['bic'] || row['blz'] || '';
      t.buchungstext = row['buchungstext'] || '';
      break;

    case 'volksbank':
      t.buchungsdatum = parseGermanDate(row['buchungstag'] || row['buchungsdatum']);
      t.valutadatum = parseGermanDate(row['valuta'] || row['wertstellung']);
      t.betrag = parseGermanAmount(row['betrag']);
      t.verwendungszweck = row['verwendungszweck'] || '';
      t.auftraggeber_empfaenger = row['auftraggeber/zahlungsempfänger'] || row['auftraggeber/zahlungsempfaenger'] || row['name'] || '';
      t.iban_gegenkonto = row['iban'] || '';
      t.bic = row['bic'] || '';
      t.buchungstext = row['textschlüssel'] || row['textschluessel'] || row['buchungstext'] || '';
      break;

    case 'dkb':
      t.buchungsdatum = parseGermanDate(row['buchungstag'] || row['buchungsdatum']);
      t.valutadatum = parseGermanDate(row['wertstellung'] || row['valuta']);
      t.betrag = parseGermanAmount(row['betrag (eur)'] || row['betrag']);
      t.verwendungszweck = row['verwendungszweck'] || '';
      t.auftraggeber_empfaenger = row['auftraggeber / begünstigter'] || row['auftraggeber/begünstigter'] || row['auftraggeber / beguenstigter'] || '';
      t.iban_gegenkonto = row['kontonummer'] || row['iban'] || '';
      t.bic = row['blz'] || row['bic'] || '';
      t.buchungstext = row['buchungstext'] || '';
      t.mandatsreferenz = row['mandatsreferenz'] || '';
      break;

    case 'generic':
    default:
      // Versuche häufige Spaltennamen
      t.buchungsdatum = parseGermanDate(row['buchungstag'] || row['buchungsdatum'] || row['datum']);
      t.valutadatum = parseGermanDate(row['valuta'] || row['wertstellung'] || row['valutadatum']);
      t.betrag = parseGermanAmount(row['betrag'] || row['betrag (eur)'] || row['umsatz']);
      t.verwendungszweck = row['verwendungszweck'] || row['beschreibung'] || row['text'] || '';
      t.auftraggeber_empfaenger = row['name'] || row['auftraggeber'] || row['empfaenger'] || row['begünstigter'] || '';
      t.iban_gegenkonto = row['iban'] || row['konto'] || row['kontonummer'] || '';
      break;
  }

  return t;
};

// Bank-Name für Anzeige
const getBankName = (format) => {
  const names = {
    'sparkasse': 'Sparkasse',
    'volksbank': 'Volksbank',
    'dkb': 'DKB',
    'generic': 'Unbekannte Bank'
  };
  return names[format] || 'Unbekannte Bank';
};

// ===================================================================
// 🏦 EXCEL PARSER (XLS/XLSX) - using ExcelJS
// ===================================================================

const parseExcelContent = async (filePath) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      return { error: 'Excel-Datei enthält keine Arbeitsblätter', transaktionen: [] };
    }

    // Konvertiere zu Array (mit Header-Zeile)
    const jsonData = [];
    sheet.eachRow((row, rowNumber) => {
      const rowValues = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        rowValues[colNumber - 1] = cell.value;
      });
      jsonData.push(rowValues);
    });

    if (jsonData.length < 2) {
      return { error: 'Excel-Datei enthält keine Daten', transaktionen: [] };
    }

    // Finde Header-Zeile (kann in den ersten 15 Zeilen sein - Holvi hat Header in Zeile 7)
    let headerIndex = -1;
    let headers = [];
    for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
      const row = jsonData[i].map(cell => String(cell || '').toLowerCase().trim());
      // Suche nach typischen Bank-Spalten (inkl. Holvi: valutadatum, gegenpartei)
      if (row.some(cell =>
        cell.includes('buchung') ||
        cell.includes('valuta') ||
        cell.includes('datum') ||
        cell.includes('betrag') ||
        cell.includes('umsatz') ||
        cell.includes('gegenpartei') ||
        cell.includes('counterparty')
      )) {
        headerIndex = i;
        headers = row;
        break;
      }
    }

    if (headerIndex === -1) {
      // Versuche erste Zeile als Header
      headerIndex = 0;
      headers = jsonData[0].map(cell => String(cell || '').toLowerCase().trim());
    }

    const transaktionen = [];

    for (let i = headerIndex + 1; i < jsonData.length; i++) {
      const rowData = jsonData[i];
      if (!rowData || rowData.length < 3) continue;

      // Erstelle Objekt aus Spalten (numerische Werte beibehalten!)
      const row = {};
      headers.forEach((header, idx) => {
        const val = rowData[idx];
        if (val === undefined || val === null) {
          row[header] = '';
        } else if (typeof val === 'number') {
          row[header] = val; // Numerische Werte direkt übernehmen
        } else if (val instanceof Date) {
          row[header] = val; // Date-Objekte direkt übernehmen
        } else {
          row[header] = String(val).trim();
        }
      });

      // Versuche Transaktion zu parsen
      const tx = parseExcelRow(row, headers);
      if (tx && tx.buchungsdatum && tx.betrag !== 0) {
        transaktionen.push(tx);
      }
    }

    return { format: 'excel', bank: 'Excel Import', transaktionen };
  } catch (err) {
    console.error('Excel Parse Error:', err);
    return { error: 'Excel-Datei konnte nicht gelesen werden: ' + err.message, transaktionen: [] };
  }
};

// Parse eine Excel-Zeile (sucht nach bekannten Spaltennamen)
const parseExcelRow = (row, headers) => {
  const t = {
    buchungsdatum: null,
    valutadatum: null,
    betrag: 0,
    verwendungszweck: '',
    auftraggeber_empfaenger: '',
    iban_gegenkonto: '',
    bic: '',
    buchungstext: '',
    mandatsreferenz: '',
    kundenreferenz: ''
  };

  // Finde Spalten anhand verschiedener möglicher Namen
  const findColumn = (keywords) => {
    for (const key of Object.keys(row)) {
      if (keywords.some(kw => key.includes(kw))) {
        return row[key];
      }
    }
    return '';
  };

  // Datum
  const datumValue = findColumn(['buchungstag', 'buchungsdatum', 'datum', 'valuta', 'wertstellung']);
  if (datumValue) {
    // Excel kann Datum als Nummer (Serial) oder als String liefern
    if (typeof datumValue === 'number') {
      // Excel Serial Date to JS Date
      const excelEpoch = new Date(1899, 11, 30);
      const jsDate = new Date(excelEpoch.getTime() + datumValue * 24 * 60 * 60 * 1000);
      t.buchungsdatum = jsDate.toISOString().split('T')[0];
    } else {
      t.buchungsdatum = parseGermanDate(String(datumValue));
    }
  }

  // Valuta
  const valutaValue = findColumn(['valuta', 'wertstellung', 'wert']);
  if (valutaValue && valutaValue !== datumValue) {
    if (typeof valutaValue === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const jsDate = new Date(excelEpoch.getTime() + valutaValue * 24 * 60 * 60 * 1000);
      t.valutadatum = jsDate.toISOString().split('T')[0];
    } else {
      t.valutadatum = parseGermanDate(String(valutaValue));
    }
  }

  // Betrag
  const betragValue = findColumn(['betrag', 'umsatz', 'soll', 'haben', 'betrag (eur)', 'betrag in eur']);
  if (betragValue !== '' && betragValue !== undefined) {
    if (typeof betragValue === 'number') {
      t.betrag = betragValue;
    } else {
      t.betrag = parseGermanAmount(String(betragValue));
    }
  }

  // Prüfe ob Soll/Haben getrennt sind
  const sollValue = findColumn(['soll', 'ausgabe', 'lastschrift']);
  const habenValue = findColumn(['haben', 'einnahme', 'gutschrift']);
  if (sollValue && !habenValue) {
    t.betrag = -Math.abs(parseGermanAmount(String(sollValue)));
  } else if (habenValue && !sollValue) {
    t.betrag = Math.abs(parseGermanAmount(String(habenValue)));
  }

  // Verwendungszweck (inkl. Holvi: "Bezeichnung", "Nachricht")
  t.verwendungszweck = findColumn(['verwendungszweck', 'bezeichnung', 'nachricht', 'message', 'description', 'beschreibung', 'buchungstext', 'text', 'info']) || '';

  // Auftraggeber/Empfänger (inkl. Holvi: "Gegenpartei")
  t.auftraggeber_empfaenger = findColumn(['gegenpartei', 'counterparty', 'auftraggeber', 'empfänger', 'empfaenger', 'name', 'begünstigter', 'beguenstigter', 'zahlungspflichtiger']) || '';

  // IBAN
  t.iban_gegenkonto = findColumn(['iban', 'konto', 'kontonummer', 'gegenkonto']) || '';

  // BIC
  t.bic = findColumn(['bic', 'blz', 'bankleitzahl']) || '';

  // Buchungstext
  t.buchungstext = findColumn(['buchungsart', 'buchungstext', 'textschlüssel', 'art']) || '';

  return t;
};

// ===================================================================
// 🏦 MT940 PARSER (SWIFT-Standard)
// ===================================================================

const parseMT940Content = (content) => {
  const transaktionen = [];

  // MT940 Blöcke finden
  const blocks = content.split(/(?=:20:)/);

  for (const block of blocks) {
    if (!block.includes(':61:')) continue;

    // Finde alle :61: Zeilen (Transaktionen)
    const lines = block.split('\n');
    let currentTx = null;
    let infoBuffer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // :61: - Transaktionszeile
      if (line.startsWith(':61:')) {
        if (currentTx) {
          currentTx.verwendungszweck = infoBuffer.trim();
          transaktionen.push(currentTx);
        }

        const txData = line.substring(4);
        currentTx = parseMT940Transaction(txData);
        infoBuffer = '';
      }
      // :86: - Verwendungszweck (kann mehrzeilig sein)
      else if (line.startsWith(':86:')) {
        infoBuffer = line.substring(4);
      }
      // Fortsetzung der :86: Info
      else if (currentTx && !line.startsWith(':') && line.length > 0) {
        infoBuffer += ' ' + line;
      }
    }

    // Letzte Transaktion
    if (currentTx) {
      currentTx.verwendungszweck = infoBuffer.trim();
      transaktionen.push(currentTx);
    }
  }

  return { format: 'mt940', bank: 'MT940 Import', transaktionen };
};

// Parsed eine MT940 :61: Zeile
const parseMT940Transaction = (line) => {
  // Format: YYMMDDYYMMDD[C/D/RC/RD]amount...
  // Beispiel: 2301150115C1234,56NTRFNONREF
  const t = {
    buchungsdatum: null,
    valutadatum: null,
    betrag: 0,
    verwendungszweck: '',
    auftraggeber_empfaenger: '',
    iban_gegenkonto: '',
    bic: '',
    buchungstext: '',
    mandatsreferenz: '',
    kundenreferenz: ''
  };

  try {
    // Valutadatum (YYMMDD)
    const valutaStr = line.substring(0, 6);
    const valutaYear = parseInt(valutaStr.substring(0, 2)) > 50 ? '19' : '20';
    t.valutadatum = `${valutaYear}${valutaStr.substring(0, 2)}-${valutaStr.substring(2, 4)}-${valutaStr.substring(4, 6)}`;

    // Buchungsdatum (optional, MMDD)
    let offset = 6;
    if (line.length > 10 && /^\d{4}/.test(line.substring(6, 10))) {
      const buchungStr = line.substring(6, 10);
      t.buchungsdatum = `${valutaYear}${valutaStr.substring(0, 2)}-${buchungStr.substring(0, 2)}-${buchungStr.substring(2, 4)}`;
      offset = 10;
    } else {
      t.buchungsdatum = t.valutadatum;
    }

    // Credit/Debit Indikator
    let isCredit = true;
    if (line.charAt(offset) === 'R') {
      offset++;
    }
    if (line.charAt(offset) === 'D') {
      isCredit = false;
      offset++;
    } else if (line.charAt(offset) === 'C') {
      isCredit = true;
      offset++;
    }

    // Betrag (bis zum nächsten Buchstaben)
    let amountStr = '';
    while (offset < line.length && (/[\d,.]/.test(line.charAt(offset)))) {
      amountStr += line.charAt(offset);
      offset++;
    }
    t.betrag = parseGermanAmount(amountStr);
    if (!isCredit) t.betrag = -t.betrag;

    // Buchungstext (3 Zeichen)
    if (offset + 3 <= line.length) {
      t.buchungstext = line.substring(offset, offset + 4);
    }

  } catch (e) {
    console.error('MT940 Parse Error:', e, line);
  }

  return t;
};

// ===================================================================
// 🔧 HELPER FUNCTIONS
// ===================================================================

// Generiere fortlaufende Belegnummer
const generateBelegNummer = async (dojoId, jahr) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT MAX(CAST(SUBSTRING_INDEX(beleg_nummer, '-', -1) AS UNSIGNED)) as max_nr
      FROM buchhaltung_belege
      WHERE dojo_id = ? AND YEAR(buchungsdatum) = ?
    `;
    db.query(sql, [dojoId, jahr], (err, results) => {
      if (err) return reject(err);
      const nextNr = (results[0]?.max_nr || 0) + 1;
      const belegNummer = `${jahr}-${String(nextNr).padStart(5, '0')}`;
      resolve(belegNummer);
    });
  });
};

// Prüfe Super Admin Berechtigung
const requireSuperAdmin = (req, res, next) => {
  // Check various ways super admin might be indicated
  const isSuperAdmin =
    req.user?.is_super_admin === true ||
    req.user?.rolle === 'super_admin' ||
    req.user?.role === 'admin' ||  // Main admin user has role "admin"
    req.user?.role === 'super_admin' ||
    (req.user?.username === 'admin' && req.user?.dojo_id === null);

  if (isSuperAdmin) {
    return next();
  }
  return res.status(403).json({ message: 'Nur für Super-Admin zugänglich' });
};

// Log to Audit
const logAudit = async (belegId, aktion, alteWerte, neueWerte, benutzerId, benutzerName) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO buchhaltung_audit_log (beleg_id, aktion, alte_werte, neue_werte, benutzer_id, benutzer_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [
      belegId,
      aktion,
      alteWerte ? JSON.stringify(alteWerte) : null,
      neueWerte ? JSON.stringify(neueWerte) : null,
      benutzerId,
      benutzerName || ''
    ], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

// ===================================================================
// 📊 GET /api/buchhaltung/dashboard - Dashboard Übersicht
// ===================================================================
router.get('/dashboard', requireSuperAdmin, (req, res) => {
  const { organisation, jahr } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  // EÜR Zusammenfassung für Dashboard
  const einnahmenSql = `
    SELECT
      COALESCE(SUM(betrag_brutto), 0) as summe,
      MONTH(datum) as monat
    FROM v_euer_einnahmen
    WHERE jahr = ?
    ${organisation && organisation !== 'alle' ? `AND organisation_name = ?` : ''}
    GROUP BY MONTH(datum)
    ORDER BY monat
  `;

  const ausgabenSql = `
    SELECT
      COALESCE(SUM(betrag_brutto), 0) as summe,
      MONTH(datum) as monat
    FROM v_euer_ausgaben
    WHERE jahr = ?
    ${organisation && organisation !== 'alle' ? `AND organisation_name = ?` : ''}
    GROUP BY MONTH(datum)
    ORDER BY monat
  `;

  const params = organisation && organisation !== 'alle' ? [currentYear, organisation] : [currentYear];

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(einnahmenSql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenSql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([einnahmen, ausgaben]) => {
    // Berechne Totals
    const totalEinnahmen = einnahmen.reduce((sum, row) => sum + parseFloat(row.summe || 0), 0);
    const totalAusgaben = ausgaben.reduce((sum, row) => sum + parseFloat(row.summe || 0), 0);

    res.json({
      jahr: currentYear,
      organisation: organisation || 'alle',
      einnahmen: {
        gesamt: totalEinnahmen,
        proMonat: einnahmen
      },
      ausgaben: {
        gesamt: totalAusgaben,
        proMonat: ausgaben
      },
      gewinnVerlust: totalEinnahmen - totalAusgaben
    });
  })
  .catch(err => {
    console.error('Dashboard-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Dashboard-Daten', error: err.message });
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/euer - EÜR Übersicht nach Kategorien
// ===================================================================
router.get('/euer', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, quartal } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  let dateFilter = `jahr = ${db.escape(currentYear)}`;
  if (quartal) {
    const q = parseInt(quartal);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    dateFilter += ` AND monat BETWEEN ${startMonth} AND ${endMonth}`;
  }

  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  // Einnahmen - Gruppiert nach Kategorie und Quelle
  const einnahmenGroupedSql = `
    SELECT
      kategorie,
      quelle,
      COALESCE(SUM(betrag_brutto), 0) as summe,
      COUNT(*) as anzahl
    FROM v_euer_einnahmen
    WHERE ${dateFilter} ${orgFilter}
    GROUP BY kategorie, quelle
    ORDER BY kategorie, quelle
  `;

  // Einnahmen - Einzelne Buchungen für Details
  const einnahmenDetailsSql = `
    SELECT
      kategorie,
      quelle,
      datum,
      betrag_brutto,
      beschreibung
    FROM v_euer_einnahmen
    WHERE ${dateFilter} ${orgFilter}
    ORDER BY kategorie, quelle, datum DESC
  `;

  // Ausgaben - Gruppiert nach Kategorie und Quelle
  const ausgabenGroupedSql = `
    SELECT
      kategorie,
      quelle,
      COALESCE(SUM(betrag_brutto), 0) as summe,
      COUNT(*) as anzahl
    FROM v_euer_ausgaben
    WHERE ${dateFilter} ${orgFilter}
    GROUP BY kategorie, quelle
    ORDER BY kategorie, quelle
  `;

  // Ausgaben - Einzelne Buchungen für Details
  const ausgabenDetailsSql = `
    SELECT
      kategorie,
      quelle,
      datum,
      betrag_brutto,
      beschreibung
    FROM v_euer_ausgaben
    WHERE ${dateFilter} ${orgFilter}
    ORDER BY kategorie, quelle, datum DESC
  `;

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(einnahmenGroupedSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(einnahmenDetailsSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenGroupedSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenDetailsSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([einnahmenGrouped, einnahmenDetails, ausgabenGrouped, ausgabenDetails]) => {
    // Gruppiere Einnahmen nach Kategorie mit Einzelbuchungen
    const einnahmenNachKategorie = {};
    let totalEinnahmen = 0;
    einnahmenGrouped.forEach(row => {
      if (!einnahmenNachKategorie[row.kategorie]) {
        einnahmenNachKategorie[row.kategorie] = { summe: 0, details: [] };
      }
      einnahmenNachKategorie[row.kategorie].summe += parseFloat(row.summe);

      // Finde die Einzelbuchungen für diese Kategorie + Quelle
      const einzelbuchungen = einnahmenDetails
        .filter(d => d.kategorie === row.kategorie && d.quelle === row.quelle)
        .map(d => ({
          datum: d.datum,
          betrag: parseFloat(d.betrag_brutto),
          beschreibung: d.beschreibung
        }));

      einnahmenNachKategorie[row.kategorie].details.push({
        quelle: row.quelle,
        summe: parseFloat(row.summe),
        anzahl: parseInt(row.anzahl),
        einzelbuchungen: einzelbuchungen
      });
      totalEinnahmen += parseFloat(row.summe);
    });

    const ausgabenNachKategorie = {};
    let totalAusgaben = 0;
    ausgabenGrouped.forEach(row => {
      if (!ausgabenNachKategorie[row.kategorie]) {
        ausgabenNachKategorie[row.kategorie] = { summe: 0, details: [] };
      }
      ausgabenNachKategorie[row.kategorie].summe += parseFloat(row.summe);

      // Finde die Einzelbuchungen für diese Kategorie + Quelle
      const einzelbuchungen = ausgabenDetails
        .filter(d => d.kategorie === row.kategorie && d.quelle === row.quelle)
        .map(d => ({
          datum: d.datum,
          betrag: parseFloat(d.betrag_brutto),
          beschreibung: d.beschreibung
        }));

      ausgabenNachKategorie[row.kategorie].details.push({
        quelle: row.quelle,
        summe: parseFloat(row.summe),
        anzahl: parseInt(row.anzahl),
        einzelbuchungen: einzelbuchungen
      });
      totalAusgaben += parseFloat(row.summe);
    });

    res.json({
      jahr: currentYear,
      quartal: quartal || null,
      organisation: organisation || 'alle',
      einnahmen: {
        gesamt: totalEinnahmen,
        nachKategorie: einnahmenNachKategorie
      },
      ausgaben: {
        gesamt: totalAusgaben,
        nachKategorie: ausgabenNachKategorie
      },
      gewinnVerlust: totalEinnahmen - totalAusgaben
    });
  })
  .catch(err => {
    console.error('EÜR-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der EÜR', error: err.message });
  });
});

// ===================================================================
// 📋 GET /api/buchhaltung/belege - Alle Belege abrufen
// ===================================================================
router.get('/belege', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, kategorie, buchungsart, seite = 1, limit = 50 } = req.query;
  const offset = (parseInt(seite) - 1) * parseInt(limit);

  let whereClause = '1=1';
  const params = [];

  if (organisation && organisation !== 'alle') {
    whereClause += ' AND organisation_name = ?';
    params.push(organisation);
  }

  if (jahr) {
    whereClause += ' AND YEAR(buchungsdatum) = ?';
    params.push(jahr);
  }

  if (kategorie) {
    whereClause += ' AND kategorie = ?';
    params.push(kategorie);
  }

  if (buchungsart) {
    whereClause += ' AND buchungsart = ?';
    params.push(buchungsart);
  }

  const countSql = `SELECT COUNT(*) as total FROM buchhaltung_belege WHERE ${whereClause} AND storniert = FALSE`;
  const dataSql = `
    SELECT
      beleg_id,
      beleg_nummer,
      organisation_name,
      buchungsart,
      beleg_datum,
      buchungsdatum,
      betrag_netto,
      mwst_satz,
      mwst_betrag,
      betrag_brutto,
      kategorie,
      beschreibung,
      lieferant_kunde,
      rechnungsnummer_extern,
      datei_name,
      festgeschrieben,
      storniert,
      erstellt_am,
      geaendert_am
    FROM buchhaltung_belege
    WHERE ${whereClause} AND storniert = FALSE
    ORDER BY buchungsdatum DESC, beleg_nummer DESC
    LIMIT ? OFFSET ?
  `;

  db.query(countSql, params, (err, countResult) => {
    if (err) {
      console.error('Belege-Count-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Zählen der Belege' });
    }

    const total = countResult[0]?.total || 0;
    const dataParams = [...params, parseInt(limit), offset];

    db.query(dataSql, dataParams, (err, belege) => {
      if (err) {
        console.error('Belege-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Laden der Belege' });
      }

      res.json({
        belege,
        pagination: {
          seite: parseInt(seite),
          limit: parseInt(limit),
          total,
          seiten: Math.ceil(total / parseInt(limit))
        }
      });
    });
  });
});

// ===================================================================
// ➕ POST /api/buchhaltung/belege - Neuen Beleg erstellen
// ===================================================================
router.post('/belege', requireSuperAdmin, async (req, res) => {
  try {
    const {
      organisation_name,
      buchungsart,
      beleg_datum,
      buchungsdatum,
      betrag_netto,
      mwst_satz = 19,
      kategorie,
      beschreibung,
      lieferant_kunde,
      rechnungsnummer_extern
    } = req.body;

    // Validierung
    if (!organisation_name || !buchungsart || !beleg_datum || !betrag_netto || !kategorie || !beschreibung) {
      return res.status(400).json({ message: 'Pflichtfelder fehlen' });
    }

    // Berechne MwSt und Brutto
    const netto = parseFloat(betrag_netto);
    const mwst = parseFloat(mwst_satz);
    const mwstBetrag = Math.round(netto * (mwst / 100) * 100) / 100;
    const brutto = Math.round((netto + mwstBetrag) * 100) / 100;

    // Dojo ID basierend auf Organisation
    const dojoId = organisation_name === 'TDA International' ? 2 : 1;
    const jahr = new Date(buchungsdatum || beleg_datum).getFullYear();

    // Generiere Belegnummer
    const belegNummer = await generateBelegNummer(dojoId, jahr);

    const sql = `
      INSERT INTO buchhaltung_belege (
        beleg_nummer, dojo_id, organisation_name, buchungsart,
        beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
        kategorie, beschreibung, lieferant_kunde, rechnungsnummer_extern, erstellt_von
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      belegNummer,
      dojoId,
      organisation_name,
      buchungsart,
      beleg_datum,
      buchungsdatum || beleg_datum,
      netto,
      mwst,
      mwstBetrag,
      brutto,
      kategorie,
      beschreibung,
      lieferant_kunde || null,
      rechnungsnummer_extern || null,
      req.user?.id || 1
    ];

    db.query(sql, params, async (err, result) => {
      if (err) {
        console.error('Beleg-Erstellung-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Erstellen des Belegs', error: err.message });
      }

      const belegId = result.insertId;

      // Audit Log
      await logAudit(belegId, 'erstellt', null, {
        beleg_nummer: belegNummer,
        betrag_brutto: brutto,
        kategorie,
        beschreibung
      }, req.user?.id || 1, req.user?.username);

      res.status(201).json({
        message: 'Beleg erfolgreich erstellt',
        beleg_id: belegId,
        beleg_nummer: belegNummer
      });
    });
  } catch (err) {
    console.error('Beleg-Erstellung-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Erstellen des Belegs', error: err.message });
  }
});

// ===================================================================
// ✏️ PUT /api/buchhaltung/belege/:id - Beleg bearbeiten
// ===================================================================
router.put('/belege/:id', requireSuperAdmin, (req, res) => {
  const belegId = req.params.id;

  // Erst prüfen ob festgeschrieben
  db.query('SELECT * FROM buchhaltung_belege WHERE beleg_id = ?', [belegId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'Beleg nicht gefunden' });
    }

    const beleg = results[0];
    if (beleg.festgeschrieben) {
      return res.status(403).json({ message: 'Beleg ist festgeschrieben und kann nicht mehr geändert werden' });
    }

    const {
      beleg_datum,
      buchungsdatum,
      betrag_netto,
      mwst_satz,
      kategorie,
      beschreibung,
      lieferant_kunde,
      rechnungsnummer_extern
    } = req.body;

    // Berechne MwSt und Brutto
    const netto = parseFloat(betrag_netto || beleg.betrag_netto);
    const mwst = parseFloat(mwst_satz || beleg.mwst_satz);
    const mwstBetrag = Math.round(netto * (mwst / 100) * 100) / 100;
    const brutto = Math.round((netto + mwstBetrag) * 100) / 100;

    const sql = `
      UPDATE buchhaltung_belege SET
        beleg_datum = ?,
        buchungsdatum = ?,
        betrag_netto = ?,
        mwst_satz = ?,
        mwst_betrag = ?,
        betrag_brutto = ?,
        kategorie = ?,
        beschreibung = ?,
        lieferant_kunde = ?,
        rechnungsnummer_extern = ?,
        geaendert_von = ?
      WHERE beleg_id = ?
    `;

    const params = [
      beleg_datum || beleg.beleg_datum,
      buchungsdatum || beleg.buchungsdatum,
      netto,
      mwst,
      mwstBetrag,
      brutto,
      kategorie || beleg.kategorie,
      beschreibung || beleg.beschreibung,
      lieferant_kunde !== undefined ? lieferant_kunde : beleg.lieferant_kunde,
      rechnungsnummer_extern !== undefined ? rechnungsnummer_extern : beleg.rechnungsnummer_extern,
      req.user?.id || 1,
      belegId
    ];

    db.query(sql, params, async (err) => {
      if (err) {
        console.error('Beleg-Update-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Aktualisieren des Belegs' });
      }

      // Audit Log (Trigger macht das automatisch, aber zusätzlich für IP etc.)
      await logAudit(belegId, 'geaendert', {
        betrag_brutto: beleg.betrag_brutto,
        kategorie: beleg.kategorie,
        beschreibung: beleg.beschreibung
      }, {
        betrag_brutto: brutto,
        kategorie: kategorie || beleg.kategorie,
        beschreibung: beschreibung || beleg.beschreibung
      }, req.user?.id || 1, req.user?.username);

      res.json({ message: 'Beleg erfolgreich aktualisiert' });
    });
  });
});

// ===================================================================
// 📎 POST /api/buchhaltung/belege/:id/upload - Beleg-Datei hochladen
// ===================================================================
router.post('/belege/:id/upload', requireSuperAdmin, upload.single('datei'), (req, res) => {
  const belegId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ message: 'Keine Datei hochgeladen' });
  }

  // Erst prüfen ob festgeschrieben
  db.query('SELECT festgeschrieben FROM buchhaltung_belege WHERE beleg_id = ?', [belegId], (err, results) => {
    if (err || results.length === 0) {
      // Lösche hochgeladene Datei wieder
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Beleg nicht gefunden' });
    }

    if (results[0].festgeschrieben) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Beleg ist festgeschrieben' });
    }

    const sql = `
      UPDATE buchhaltung_belege SET
        datei_pfad = ?,
        datei_name = ?,
        datei_typ = ?,
        datei_groesse = ?,
        geaendert_von = ?
      WHERE beleg_id = ?
    `;

    db.query(sql, [
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.user?.id || 1,
      belegId
    ], (err) => {
      if (err) {
        console.error('Datei-Upload-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Speichern der Datei' });
      }

      res.json({
        message: 'Datei erfolgreich hochgeladen',
        datei_name: req.file.originalname
      });
    });
  });
});

// ===================================================================
// 📥 GET /api/buchhaltung/belege/:id/datei - Beleg-Datei herunterladen
// ===================================================================
router.get('/belege/:id/datei', requireSuperAdmin, (req, res) => {
  const belegId = req.params.id;

  db.query('SELECT datei_pfad, datei_name, datei_typ FROM buchhaltung_belege WHERE beleg_id = ?', [belegId], (err, results) => {
    if (err || results.length === 0 || !results[0].datei_pfad) {
      return res.status(404).json({ message: 'Datei nicht gefunden' });
    }

    const { datei_pfad, datei_name, datei_typ } = results[0];

    if (!fs.existsSync(datei_pfad)) {
      return res.status(404).json({ message: 'Datei nicht mehr vorhanden' });
    }

    res.setHeader('Content-Type', datei_typ);
    res.setHeader('Content-Disposition', `inline; filename="${datei_name}"`);
    res.sendFile(datei_pfad);
  });
});

// ===================================================================
// 🔒 POST /api/buchhaltung/belege/:id/festschreiben - Beleg festschreiben
// ===================================================================
router.post('/belege/:id/festschreiben', requireSuperAdmin, (req, res) => {
  const belegId = req.params.id;

  db.query(
    `UPDATE buchhaltung_belege SET
      festgeschrieben = TRUE,
      festgeschrieben_am = NOW(),
      festgeschrieben_von = ?
    WHERE beleg_id = ? AND festgeschrieben = FALSE`,
    [req.user?.id || 1, belegId],
    async (err, result) => {
      if (err) {
        console.error('Festschreiben-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Festschreiben' });
      }

      if (result.affectedRows === 0) {
        return res.status(400).json({ message: 'Beleg bereits festgeschrieben oder nicht gefunden' });
      }

      await logAudit(belegId, 'festgeschrieben', null, { festgeschrieben: true }, req.user?.id || 1, req.user?.username);

      res.json({ message: 'Beleg erfolgreich festgeschrieben' });
    }
  );
});

// ===================================================================
// ❌ POST /api/buchhaltung/belege/:id/stornieren - Beleg stornieren
// ===================================================================
router.post('/belege/:id/stornieren', requireSuperAdmin, (req, res) => {
  const belegId = req.params.id;
  const { grund } = req.body;

  if (!grund) {
    return res.status(400).json({ message: 'Storno-Grund ist erforderlich' });
  }

  db.query(
    `UPDATE buchhaltung_belege SET
      storniert = TRUE,
      storno_grund = ?,
      storno_am = NOW(),
      storno_von = ?
    WHERE beleg_id = ? AND storniert = FALSE`,
    [grund, req.user?.id || 1, belegId],
    async (err, result) => {
      if (err) {
        console.error('Storno-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Stornieren' });
      }

      if (result.affectedRows === 0) {
        return res.status(400).json({ message: 'Beleg bereits storniert oder nicht gefunden' });
      }

      await logAudit(belegId, 'storniert', null, { storniert: true, grund }, req.user?.id || 1, req.user?.username);

      res.json({ message: 'Beleg erfolgreich storniert' });
    }
  );
});

// ===================================================================
// 📈 GET /api/buchhaltung/einnahmen-auto - Automatische Einnahmen
// ===================================================================
router.get('/einnahmen-auto', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, monat, seite = 1, limit = 50 } = req.query;
  const currentYear = jahr || new Date().getFullYear();
  const offset = (parseInt(seite) - 1) * parseInt(limit);

  let whereClause = `jahr = ${db.escape(currentYear)}`;
  if (organisation && organisation !== 'alle') {
    whereClause += ` AND organisation_name = ${db.escape(organisation)}`;
  }
  if (monat) {
    whereClause += ` AND monat = ${db.escape(monat)}`;
  }

  const sql = `
    SELECT
      quelle,
      referenz_id,
      organisation_name,
      datum,
      betrag_brutto,
      kategorie,
      beschreibung
    FROM v_euer_einnahmen
    WHERE ${whereClause}
    ORDER BY datum DESC
    LIMIT ? OFFSET ?
  `;

  db.query(sql, [parseInt(limit), offset], (err, results) => {
    if (err) {
      console.error('Auto-Einnahmen-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Laden der automatischen Einnahmen' });
    }

    res.json({
      einnahmen: results,
      pagination: {
        seite: parseInt(seite),
        limit: parseInt(limit)
      }
    });
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/abschluss/:jahr - Jahresabschluss
// ===================================================================
router.get('/abschluss/:jahr', requireSuperAdmin, (req, res) => {
  const { jahr } = req.params;
  const { organisation } = req.query;

  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  // Prüfe ob Abschluss existiert
  const abschlussSql = `
    SELECT * FROM euer_abschluesse
    WHERE jahr = ? ${organisation && organisation !== 'alle' ? `AND organisation_name = ?` : ''}
  `;
  const abschlussParams = organisation && organisation !== 'alle' ? [jahr, organisation] : [jahr];

  db.query(abschlussSql, abschlussParams, (err, abschlussResults) => {
    if (err) {
      console.error('Abschluss-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Laden des Abschlusses' });
    }

    // Berechne aktuelle Werte
    const einnahmenSql = `
      SELECT kategorie, COALESCE(SUM(betrag_brutto), 0) as summe
      FROM v_euer_einnahmen
      WHERE jahr = ? ${orgFilter}
      GROUP BY kategorie
    `;

    const ausgabenSql = `
      SELECT kategorie, COALESCE(SUM(betrag_brutto), 0) as summe
      FROM v_euer_ausgaben
      WHERE jahr = ? ${orgFilter}
      GROUP BY kategorie
    `;

    Promise.all([
      new Promise((resolve, reject) => {
        db.query(einnahmenSql, [jahr], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(ausgabenSql, [jahr], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      })
    ])
    .then(([einnahmen, ausgaben]) => {
      const einnahmenDetails = {};
      let totalEinnahmen = 0;
      einnahmen.forEach(row => {
        einnahmenDetails[row.kategorie] = parseFloat(row.summe);
        totalEinnahmen += parseFloat(row.summe);
      });

      const ausgabenDetails = {};
      let totalAusgaben = 0;
      ausgaben.forEach(row => {
        ausgabenDetails[row.kategorie] = parseFloat(row.summe);
        totalAusgaben += parseFloat(row.summe);
      });

      const abschluss = abschlussResults[0] || null;

      res.json({
        jahr: parseInt(jahr),
        organisation: organisation || 'alle',
        abschluss: abschluss ? {
          status: abschluss.status,
          abgeschlossen_am: abschluss.abgeschlossen_am,
          letzter_export: abschluss.letzter_export_datum
        } : null,
        berechnet: {
          einnahmen: {
            gesamt: totalEinnahmen,
            details: einnahmenDetails
          },
          ausgaben: {
            gesamt: totalAusgaben,
            details: ausgabenDetails
          },
          gewinnVerlust: totalEinnahmen - totalAusgaben
        }
      });
    })
    .catch(err => {
      console.error('Abschluss-Berechnung-Fehler:', err);
      res.status(500).json({ message: 'Fehler bei der Berechnung' });
    });
  });
});

// ===================================================================
// 🔐 POST /api/buchhaltung/abschluss/:jahr/festschreiben - Jahr festschreiben
// ===================================================================
router.post('/abschluss/:jahr/festschreiben', requireSuperAdmin, (req, res) => {
  const { jahr } = req.params;
  const { organisation } = req.body;

  if (!organisation) {
    return res.status(400).json({ message: 'Organisation ist erforderlich' });
  }

  const dojoId = organisation === 'TDA International' ? 2 : 1;

  // Erst alle nicht-festgeschriebenen Belege des Jahres festschreiben
  const festschreibenBelegeSql = `
    UPDATE buchhaltung_belege SET
      festgeschrieben = TRUE,
      festgeschrieben_am = NOW(),
      festgeschrieben_von = ?
    WHERE YEAR(buchungsdatum) = ? AND organisation_name = ? AND festgeschrieben = FALSE
  `;

  db.query(festschreibenBelegeSql, [req.user?.id || 1, jahr, organisation], (err, belegeResult) => {
    if (err) {
      console.error('Belege-Festschreiben-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Festschreiben der Belege' });
    }

    // Dann Abschluss erstellen/aktualisieren
    const upsertSql = `
      INSERT INTO euer_abschluesse (dojo_id, organisation_name, jahr, status, abgeschlossen_am, abgeschlossen_von)
      VALUES (?, ?, ?, 'abgeschlossen', NOW(), ?)
      ON DUPLICATE KEY UPDATE
        status = 'abgeschlossen',
        abgeschlossen_am = NOW(),
        abgeschlossen_von = ?
    `;

    db.query(upsertSql, [dojoId, organisation, jahr, req.user?.id || 1, req.user?.id || 1], (err) => {
      if (err) {
        console.error('Abschluss-Festschreiben-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Erstellen des Abschlusses' });
      }

      res.json({
        message: `Jahresabschluss ${jahr} für ${organisation} erfolgreich festgeschrieben`,
        belege_festgeschrieben: belegeResult.affectedRows
      });
    });
  });
});

// ===================================================================
// 📤 GET /api/buchhaltung/abschluss/:jahr/export - CSV Export
// ===================================================================
router.get('/abschluss/:jahr/export', requireSuperAdmin, (req, res) => {
  const { jahr } = req.params;
  const { organisation, format = 'csv' } = req.query;

  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  // Hole alle Buchungen des Jahres
  const einnahmenSql = `
    SELECT
      datum, kategorie, beschreibung, betrag_brutto, quelle, organisation_name
    FROM v_euer_einnahmen
    WHERE jahr = ? ${orgFilter}
    ORDER BY datum
  `;

  const ausgabenSql = `
    SELECT
      datum, kategorie, beschreibung, betrag_brutto, quelle, organisation_name
    FROM v_euer_ausgaben
    WHERE jahr = ? ${orgFilter}
    ORDER BY datum
  `;

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(einnahmenSql, [jahr], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenSql, [jahr], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([einnahmen, ausgaben]) => {
    // CSV generieren
    let csv = 'Datum;Typ;Kategorie;Beschreibung;Betrag;Quelle;Organisation\n';

    einnahmen.forEach(row => {
      csv += `${row.datum};Einnahme;${row.kategorie};${row.beschreibung};${row.betrag_brutto};${row.quelle};${row.organisation_name}\n`;
    });

    ausgaben.forEach(row => {
      csv += `${row.datum};Ausgabe;${row.kategorie};${row.beschreibung};${row.betrag_brutto};${row.quelle};${row.organisation_name}\n`;
    });

    // Zusammenfassung
    const totalEinnahmen = einnahmen.reduce((sum, row) => sum + parseFloat(row.betrag_brutto || 0), 0);
    const totalAusgaben = ausgaben.reduce((sum, row) => sum + parseFloat(row.betrag_brutto || 0), 0);
    const gewinn = totalEinnahmen - totalAusgaben;

    csv += '\n;;;\n';
    csv += `;Summe Einnahmen;;;${totalEinnahmen.toFixed(2)};;\n`;
    csv += `;Summe Ausgaben;;;${totalAusgaben.toFixed(2)};;\n`;
    csv += `;Gewinn/Verlust;;;${gewinn.toFixed(2)};;\n`;

    // Update Export-Tracking
    if (organisation && organisation !== 'alle') {
      const dojoId = organisation === 'TDA International' ? 2 : 1;
      db.query(
        `UPDATE euer_abschluesse SET letzter_export_datum = NOW(), letzter_export_format = ? WHERE dojo_id = ? AND jahr = ?`,
        [format, dojoId, jahr]
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="EUeR_${jahr}_${organisation || 'alle'}.csv"`);
    res.send('\ufeff' + csv); // BOM für Excel UTF-8
  })
  .catch(err => {
    console.error('Export-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Export' });
  });
});

// ===================================================================
// 📋 GET /api/buchhaltung/kategorien - Alle EÜR-Kategorien
// ===================================================================
router.get('/kategorien', requireSuperAdmin, (req, res) => {
  const kategorien = [
    { id: 'betriebseinnahmen', name: 'Betriebseinnahmen', typ: 'einnahme', beschreibung: 'Umsatzerlöse, Mitgliedsbeiträge' },
    { id: 'wareneingang', name: 'Wareneingang', typ: 'ausgabe', beschreibung: 'Einkauf Artikel, Material' },
    { id: 'personalkosten', name: 'Personalkosten', typ: 'ausgabe', beschreibung: 'Löhne, Gehälter, Sozialabgaben' },
    { id: 'raumkosten', name: 'Raumkosten', typ: 'ausgabe', beschreibung: 'Miete, Nebenkosten, Reinigung' },
    { id: 'versicherungen', name: 'Versicherungen', typ: 'ausgabe', beschreibung: 'Haftpflicht, Unfallversicherung' },
    { id: 'kfz_kosten', name: 'KFZ-Kosten', typ: 'ausgabe', beschreibung: 'Fahrzeugkosten, Kraftstoff' },
    { id: 'werbekosten', name: 'Werbekosten', typ: 'ausgabe', beschreibung: 'Marketing, Flyer, Online-Werbung' },
    { id: 'reisekosten', name: 'Reisekosten', typ: 'ausgabe', beschreibung: 'Fahrten, Übernachtungen' },
    { id: 'telefon_internet', name: 'Telefon/Internet', typ: 'ausgabe', beschreibung: 'Kommunikationskosten' },
    { id: 'buerokosten', name: 'Bürokosten', typ: 'ausgabe', beschreibung: 'Büromaterial, Porto' },
    { id: 'fortbildung', name: 'Fortbildung', typ: 'ausgabe', beschreibung: 'Seminare, Weiterbildung' },
    { id: 'abschreibungen', name: 'Abschreibungen', typ: 'ausgabe', beschreibung: 'AfA auf Anlagegüter' },
    { id: 'sonstige_kosten', name: 'Sonstige Kosten', typ: 'ausgabe', beschreibung: 'Sonstige betriebliche Aufwendungen' },
    { id: 'privateinlage', name: 'Privateinlage', typ: 'privat', beschreibung: 'Private Einzahlung (kein Umsatz)' },
    { id: 'privatentnahme', name: 'Privatentnahme', typ: 'privat', beschreibung: 'Private Entnahme (keine Ausgabe)' }
  ];

  res.json(kategorien);
});

// ===================================================================
// 🏦 BANK-IMPORT ENDPOINTS
// ===================================================================

// Generiere Hash für Duplikaterkennung
const generateTransactionHash = (buchungsdatum, betrag, verwendungszweck) => {
  const data = `${buchungsdatum}|${betrag}|${verwendungszweck.substring(0, 100)}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Generiere Import-ID
const generateImportId = () => {
  return `IMP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

// ===================================================================
// 📤 POST /api/buchhaltung/bank-import/upload - Bank-Datei hochladen
// ===================================================================
router.post('/bank-import/upload', requireSuperAdmin, bankUpload.single('datei'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Keine Datei hochgeladen' });
    }

    const { organisation = 'Kampfkunstschule Schreiner', format: requestedFormat } = req.body;
    const dojoId = organisation === 'TDA International' ? 2 : 1;
    const importId = generateImportId();

    // Lese Datei
    let content;
    try {
      // Versuche verschiedene Encodings
      const rawBuffer = fs.readFileSync(req.file.path);
      // Prüfe auf UTF-8 BOM
      if (rawBuffer[0] === 0xEF && rawBuffer[1] === 0xBB && rawBuffer[2] === 0xBF) {
        content = rawBuffer.toString('utf-8').substring(1);
      }
      // Versuche ISO-8859-1 wenn Umlaute kaputt aussehen
      else if (rawBuffer.includes(0xC4) || rawBuffer.includes(0xD6) || rawBuffer.includes(0xDC)) {
        content = iconv.decode(rawBuffer, 'iso-8859-1');
      } else {
        content = rawBuffer.toString('utf-8');
      }
    } catch (e) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Datei konnte nicht gelesen werden' });
    }

    // Bestimme Format (Excel, MT940 oder CSV)
    let parseResult;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isExcel = ext === '.xls' || ext === '.xlsx';
    const isMT940 = ext === '.sta' || ext === '.mt940' || (content && content.includes(':20:') && content.includes(':61:'));

    if (isExcel) {
      parseResult = await parseExcelContent(req.file.path);
    } else if (isMT940 || requestedFormat === 'mt940') {
      parseResult = parseMT940Content(content);
    } else {
      parseResult = parseCSVContent(content);
    }

    if (parseResult.error) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: parseResult.error });
    }

    if (parseResult.transaktionen.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Keine Transaktionen in der Datei gefunden' });
    }

    // Speichere Transaktionen in Datenbank
    let insertedCount = 0;
    let duplicateCount = 0;
    const insertedTransactions = [];

    for (const tx of parseResult.transaktionen) {
      const hashKey = generateTransactionHash(tx.buchungsdatum, tx.betrag, tx.verwendungszweck);

      // Prüfe auf Duplikat
      const existingCheck = await new Promise((resolve, reject) => {
        db.query('SELECT transaktion_id FROM bank_transaktionen WHERE hash_key = ?', [hashKey], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      if (existingCheck.length > 0) {
        duplicateCount++;
        continue;
      }

      // Füge Transaktion ein
      const insertSql = `
        INSERT INTO bank_transaktionen (
          import_id, import_datei, import_format, dojo_id, organisation_name,
          buchungsdatum, valutadatum, betrag, verwendungszweck, auftraggeber_empfaenger,
          iban_gegenkonto, bic, buchungstext, mandatsreferenz, kundenreferenz, hash_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await new Promise((resolve, reject) => {
        db.query(insertSql, [
          importId,
          req.file.originalname,
          isExcel ? 'csv' : (isMT940 ? 'mt940' : 'csv'),
          dojoId,
          organisation,
          tx.buchungsdatum,
          tx.valutadatum,
          tx.betrag,
          tx.verwendungszweck,
          tx.auftraggeber_empfaenger,
          tx.iban_gegenkonto,
          tx.bic,
          tx.buchungstext,
          tx.mandatsreferenz,
          tx.kundenreferenz,
          hashKey
        ], (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      insertedCount++;
      insertedTransactions.push({
        transaktion_id: result.insertId,
        ...tx
      });
    }

    // Speichere Import-Historie
    const datumVon = parseResult.transaktionen.reduce((min, tx) =>
      !min || tx.buchungsdatum < min ? tx.buchungsdatum : min, null);
    const datumBis = parseResult.transaktionen.reduce((max, tx) =>
      !max || tx.buchungsdatum > max ? tx.buchungsdatum : max, null);

    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO bank_import_historie (
          import_id, dojo_id, organisation_name, datei_name, datei_format,
          bank_name, anzahl_transaktionen, anzahl_duplikate, datum_von, datum_bis, importiert_von
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        importId, dojoId, organisation, req.file.originalname,
        isMT940 ? 'mt940' : 'csv', parseResult.bank,
        insertedCount, duplicateCount, datumVon, datumBis,
        req.user?.id || 1
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Führe Auto-Matching für alle neuen Transaktionen durch
    for (const tx of insertedTransactions) {
      await runAutoMatching(tx.transaktion_id, dojoId);
    }

    res.json({
      message: 'Import erfolgreich',
      import_id: importId,
      bank: parseResult.bank,
      format: isExcel ? 'excel' : (isMT940 ? 'mt940' : 'csv'),
      count: insertedCount,
      duplikate: duplicateCount,
      gesamt: parseResult.transaktionen.length
    });

  } catch (err) {
    console.error('Bank-Import-Fehler:', err);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ message: 'Fehler beim Import', error: err.message });
  }
});

// Auto-Matching für eine Transaktion
const runAutoMatching = async (transaktionId, dojoId) => {
  return new Promise((resolve, reject) => {
    // Hole Transaktion
    db.query('SELECT * FROM bank_transaktionen WHERE transaktion_id = ?', [transaktionId], async (err, results) => {
      if (err || results.length === 0) return resolve();

      const tx = results[0];
      const verwendungszweck = (tx.verwendungszweck || '').toLowerCase();
      const auftraggeber = (tx.auftraggeber_empfaenger || '').toLowerCase();
      const betrag = Math.abs(tx.betrag);
      const isEinnahme = tx.betrag > 0;

      let bestMatch = null;
      let bestConfidence = 0;

      // 1. Suche nach Rechnungsnummer im Verwendungszweck
      const rechnungsMatch = verwendungszweck.match(/re[-\s]?(\d+)/i) || verwendungszweck.match(/rechnung\s*[-#:]?\s*(\d+)/i);
      if (rechnungsMatch && isEinnahme) {
        const rechnungen = await new Promise((resolve) => {
          db.query(`
            SELECT r.rechnung_id, r.rechnungsnummer, r.brutto_betrag,
                   m.vorname, m.nachname
            FROM rechnungen r
            LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
            WHERE r.rechnungsnummer LIKE ? AND ABS(r.brutto_betrag - ?) < 1
          `, [`%${rechnungsMatch[1]}%`, betrag], (err, results) => {
            resolve(err ? [] : results);
          });
        });

        if (rechnungen.length > 0) {
          bestMatch = {
            typ: 'rechnung',
            id: rechnungen[0].rechnung_id,
            details: {
              rechnungsnummer: rechnungen[0].rechnungsnummer,
              name: `${rechnungen[0].vorname || ''} ${rechnungen[0].nachname || ''}`.trim(),
              betrag: rechnungen[0].brutto_betrag
            }
          };
          bestConfidence = 0.95;
        }
      }

      // 2. Suche nach Mitgliedsnummer im Verwendungszweck
      if (!bestMatch) {
        const mitgliedMatch = verwendungszweck.match(/mitglied\s*[-#:]?\s*(\d+)/i) ||
                              verwendungszweck.match(/nr\.\s*(\d+)/i);
        if (mitgliedMatch && isEinnahme) {
          const beitraege = await new Promise((resolve) => {
            db.query(`
              SELECT b.beitrag_id, b.betrag, b.monat, b.jahr,
                     m.mitglieder_nr, m.vorname, m.nachname
              FROM beitraege b
              JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
              WHERE m.mitglieder_nr LIKE ? AND ABS(b.betrag - ?) < 1 AND b.bezahlt = 0
              ORDER BY b.faelligkeit ASC
              LIMIT 1
            `, [`%${mitgliedMatch[1]}%`, betrag], (err, results) => {
              resolve(err ? [] : results);
            });
          });

          if (beitraege.length > 0) {
            bestMatch = {
              typ: 'beitrag',
              id: beitraege[0].beitrag_id,
              details: {
                mitglieder_nr: beitraege[0].mitglieder_nr,
                name: `${beitraege[0].vorname} ${beitraege[0].nachname}`,
                monat: beitraege[0].monat,
                jahr: beitraege[0].jahr,
                betrag: beitraege[0].betrag
              }
            };
            bestConfidence = 0.85;
          }
        }
      }

      // 3. Suche nach Namensübereinstimmung + Betrag
      if (!bestMatch && isEinnahme) {
        // Extrahiere mögliche Namen aus Verwendungszweck/Auftraggeber
        const nameWords = (auftraggeber + ' ' + verwendungszweck)
          .replace(/[^a-zäöüß\s]/gi, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2);

        for (const name of nameWords) {
          const mitglieder = await new Promise((resolve) => {
            db.query(`
              SELECT b.beitrag_id, b.betrag, b.monat, b.jahr,
                     m.mitglieder_nr, m.vorname, m.nachname
              FROM beitraege b
              JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
              WHERE (m.nachname LIKE ? OR m.vorname LIKE ?)
                AND ABS(b.betrag - ?) < 1
                AND b.bezahlt = 0
              ORDER BY b.faelligkeit ASC
              LIMIT 1
            `, [`%${name}%`, `%${name}%`, betrag], (err, results) => {
              resolve(err ? [] : results);
            });
          });

          if (mitglieder.length > 0) {
            bestMatch = {
              typ: 'beitrag',
              id: mitglieder[0].beitrag_id,
              details: {
                mitglieder_nr: mitglieder[0].mitglieder_nr,
                name: `${mitglieder[0].vorname} ${mitglieder[0].nachname}`,
                monat: mitglieder[0].monat,
                jahr: mitglieder[0].jahr,
                betrag: mitglieder[0].betrag
              }
            };
            bestConfidence = 0.75;
            break;
          }
        }
      }

      // 4. Prüfe gelernte Regeln
      if (!bestMatch) {
        const regeln = await new Promise((resolve) => {
          db.query(`
            SELECT * FROM bank_zuordnung_regeln
            WHERE dojo_id = ? AND aktiv = TRUE
            ORDER BY verwendungen DESC
          `, [dojoId], (err, results) => {
            resolve(err ? [] : results);
          });
        });

        for (const regel of regeln) {
          const suchfeld = regel.match_feld === 'auftraggeber' ? auftraggeber :
                           regel.match_feld === 'iban' ? tx.iban_gegenkonto : verwendungszweck;
          const suchwert = regel.match_wert.toLowerCase();

          let matches = false;
          if (regel.match_typ === 'exakt') {
            matches = suchfeld === suchwert;
          } else if (regel.match_typ === 'beginnt_mit') {
            matches = suchfeld.startsWith(suchwert);
          } else {
            matches = suchfeld.includes(suchwert);
          }

          if (matches) {
            if (regel.aktion === 'ignorieren') {
              // Transaktion ignorieren
              await new Promise((resolve) => {
                db.query(`
                  UPDATE bank_transaktionen SET status = 'ignoriert'
                  WHERE transaktion_id = ?
                `, [transaktionId], () => resolve());
              });
              return resolve();
            } else {
              // Kategorie-Vorschlag
              bestMatch = {
                typ: 'manuell',
                id: null,
                details: { kategorie: regel.kategorie, regel_id: regel.regel_id }
              };
              bestConfidence = 0.70;
              break;
            }
          }
        }
      }

      // Update Transaktion mit Match
      if (bestMatch && bestConfidence >= 0.5) {
        await new Promise((resolve) => {
          db.query(`
            UPDATE bank_transaktionen SET
              status = 'vorgeschlagen',
              match_typ = ?,
              match_id = ?,
              match_confidence = ?,
              match_details = ?
            WHERE transaktion_id = ?
          `, [
            bestMatch.typ,
            bestMatch.id,
            bestConfidence,
            JSON.stringify(bestMatch.details),
            transaktionId
          ], () => resolve());
        });
      }

      resolve();
    });
  });
};

// ===================================================================
// 📋 GET /api/buchhaltung/bank-import/transaktionen - Transaktionen abrufen
// ===================================================================
router.get('/bank-import/transaktionen', requireSuperAdmin, (req, res) => {
  const { status, import_id, organisation, von, bis, seite = 1, limit = 50 } = req.query;
  const offset = (parseInt(seite) - 1) * parseInt(limit);

  let whereClause = '1=1';
  const params = [];

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  if (import_id) {
    whereClause += ' AND import_id = ?';
    params.push(import_id);
  }

  if (organisation && organisation !== 'alle') {
    whereClause += ' AND organisation_name = ?';
    params.push(organisation);
  }

  if (von) {
    whereClause += ' AND buchungsdatum >= ?';
    params.push(von);
  }

  if (bis) {
    whereClause += ' AND buchungsdatum <= ?';
    params.push(bis);
  }

  const countSql = `SELECT COUNT(*) as total FROM bank_transaktionen WHERE ${whereClause}`;
  const dataSql = `
    SELECT
      transaktion_id, import_id, import_datei, import_format, import_datum,
      organisation_name, buchungsdatum, valutadatum, betrag, waehrung,
      verwendungszweck, auftraggeber_empfaenger, iban_gegenkonto, buchungstext,
      status, kategorie, match_typ, match_id, match_confidence, match_details,
      beleg_id, zugeordnet_am
    FROM bank_transaktionen
    WHERE ${whereClause}
    ORDER BY buchungsdatum DESC, transaktion_id DESC
    LIMIT ? OFFSET ?
  `;

  db.query(countSql, params, (err, countResult) => {
    if (err) {
      console.error('Transaktionen-Count-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Zählen' });
    }

    const total = countResult[0]?.total || 0;
    const dataParams = [...params, parseInt(limit), offset];

    db.query(dataSql, dataParams, (err, transaktionen) => {
      if (err) {
        console.error('Transaktionen-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Laden' });
      }

      // Parse JSON fields
      transaktionen.forEach(tx => {
        if (tx.match_details && typeof tx.match_details === 'string') {
          try { tx.match_details = JSON.parse(tx.match_details); } catch (e) {}
        }
      });

      res.json({
        transaktionen,
        pagination: {
          seite: parseInt(seite),
          limit: parseInt(limit),
          total,
          seiten: Math.ceil(total / parseInt(limit))
        }
      });
    });
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/bank-import/statistik - Import-Statistiken
// ===================================================================
router.get('/bank-import/statistik', requireSuperAdmin, (req, res) => {
  const { organisation } = req.query;

  let whereClause = '1=1';
  const params = [];

  if (organisation && organisation !== 'alle') {
    whereClause += ' AND organisation_name = ?';
    params.push(organisation);
  }

  db.query(`
    SELECT
      COUNT(*) as gesamt,
      SUM(CASE WHEN status = 'unzugeordnet' THEN 1 ELSE 0 END) as unzugeordnet,
      SUM(CASE WHEN status = 'vorgeschlagen' THEN 1 ELSE 0 END) as vorgeschlagen,
      SUM(CASE WHEN status = 'zugeordnet' THEN 1 ELSE 0 END) as zugeordnet,
      SUM(CASE WHEN status = 'ignoriert' THEN 1 ELSE 0 END) as ignoriert,
      SUM(CASE WHEN betrag > 0 THEN betrag ELSE 0 END) as summe_einnahmen,
      SUM(CASE WHEN betrag < 0 THEN ABS(betrag) ELSE 0 END) as summe_ausgaben
    FROM bank_transaktionen
    WHERE ${whereClause}
  `, params, (err, results) => {
    if (err) {
      console.error('Statistik-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Laden der Statistik' });
    }

    const stats = results[0] || {};

    // Letzte Imports
    db.query(`
      SELECT import_id, datei_name, bank_name, anzahl_transaktionen, importiert_am
      FROM bank_import_historie
      WHERE ${whereClause.replace('1=1', '1=1')}
      ORDER BY importiert_am DESC
      LIMIT 5
    `, params, (err, imports) => {
      res.json({
        statistik: stats,
        letzteImports: imports || []
      });
    });
  });
});

// ===================================================================
// ✅ POST /api/buchhaltung/bank-import/zuordnen/:id - Transaktion zuordnen
// ===================================================================
router.post('/bank-import/zuordnen/:id', requireSuperAdmin, async (req, res) => {
  try {
    const transaktionId = req.params.id;
    const { kategorie, match_typ, match_id, lerne_regel = false } = req.body;

    if (!kategorie) {
      return res.status(400).json({ message: 'Kategorie ist erforderlich' });
    }

    // Hole Transaktion
    const txResult = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM bank_transaktionen WHERE transaktion_id = ?', [transaktionId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (txResult.length === 0) {
      return res.status(404).json({ message: 'Transaktion nicht gefunden' });
    }

    const tx = txResult[0];
    const buchungsart = tx.betrag > 0 ? 'einnahme' : 'ausgabe';

    // Erstelle Buchhaltungs-Beleg
    const jahr = new Date(tx.buchungsdatum).getFullYear();
    const belegNummer = await generateBelegNummer(tx.dojo_id, jahr);

    const belegResult = await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO buchhaltung_belege (
          beleg_nummer, dojo_id, organisation_name, buchungsart,
          beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
          kategorie, beschreibung, lieferant_kunde, erstellt_von
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
      `, [
        belegNummer,
        tx.dojo_id,
        tx.organisation_name,
        buchungsart,
        tx.buchungsdatum,
        tx.buchungsdatum,
        Math.abs(tx.betrag),
        Math.abs(tx.betrag),
        kategorie,
        tx.verwendungszweck || 'Bank-Import',
        tx.auftraggeber_empfaenger,
        req.user?.id || 1
      ], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Update Transaktion
    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE bank_transaktionen SET
          status = 'zugeordnet',
          kategorie = ?,
          match_typ = ?,
          match_id = ?,
          beleg_id = ?,
          zugeordnet_von = ?,
          zugeordnet_am = NOW()
        WHERE transaktion_id = ?
      `, [kategorie, match_typ || 'manuell', match_id, belegResult.insertId, req.user?.id || 1, transaktionId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Optional: Lerne Regel
    if (lerne_regel && tx.auftraggeber_empfaenger) {
      await new Promise((resolve) => {
        db.query(`
          INSERT IGNORE INTO bank_zuordnung_regeln (
            dojo_id, match_feld, match_wert, match_typ, kategorie, erstellt_von
          ) VALUES (?, 'auftraggeber', ?, 'enthält', ?, ?)
        `, [tx.dojo_id, tx.auftraggeber_empfaenger.substring(0, 100), kategorie, req.user?.id || 1], () => resolve());
      });
    }

    // Audit Log
    await logAudit(belegResult.insertId, 'erstellt', null, {
      beleg_nummer: belegNummer,
      betrag_brutto: Math.abs(tx.betrag),
      kategorie,
      quelle: 'bank-import',
      transaktion_id: transaktionId
    }, req.user?.id || 1, req.user?.username);

    res.json({
      message: 'Transaktion erfolgreich zugeordnet',
      beleg_id: belegResult.insertId,
      beleg_nummer: belegNummer
    });

  } catch (err) {
    console.error('Zuordnung-Fehler:', err);
    res.status(500).json({ message: 'Fehler bei der Zuordnung', error: err.message });
  }
});

// ===================================================================
// ✅ POST /api/buchhaltung/bank-import/rechnung-verknuepfen/:id
// Verknüpft Bank-Transaktion mit Verbandsrechnung OHNE EÜR-Buchung
// (EÜR kommt aus der Bank-Transaktion selbst)
// ===================================================================
router.post('/bank-import/rechnung-verknuepfen/:id', requireSuperAdmin, async (req, res) => {
  try {
    const transaktionId = req.params.id;
    const { rechnung_id } = req.body;

    if (!rechnung_id) {
      return res.status(400).json({ message: 'Rechnungs-ID ist erforderlich' });
    }

    // Hole Transaktion
    const txResult = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM bank_transaktionen WHERE transaktion_id = ?', [transaktionId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (txResult.length === 0) {
      return res.status(404).json({ message: 'Transaktion nicht gefunden' });
    }

    // Hole Rechnung
    const rechnungResult = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM verband_rechnungen WHERE id = ?', [rechnung_id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (rechnungResult.length === 0) {
      return res.status(404).json({ message: 'Rechnung nicht gefunden' });
    }

    const rechnung = rechnungResult[0];
    const tx = txResult[0];

    // Update Bank-Transaktion (Verknüpfung, KEIN neuer Beleg!)
    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE bank_transaktionen SET
          status = 'zugeordnet',
          kategorie = 'betriebseinnahmen',
          match_typ = 'verband_rechnung',
          match_id = ?,
          match_details = ?,
          zugeordnet_von = ?,
          zugeordnet_am = NOW()
        WHERE transaktion_id = ?
      `, [
        rechnung_id,
        JSON.stringify({ rechnungsnummer: rechnung.rechnungsnummer, empfaenger: rechnung.empfaenger_name }),
        req.user?.id || 1,
        transaktionId
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Update Rechnung (als bezahlt markieren + Bank-Transaktion verknüpfen)
    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE verband_rechnungen SET
          status = 'bezahlt',
          bezahlt_am = ?,
          bank_transaktion_id = ?
        WHERE id = ?
      `, [tx.buchungsdatum, transaktionId, rechnung_id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info(`Bank-Transaktion ${transaktionId} mit Verbandsrechnung ${rechnung.rechnungsnummer} verknüpft (ohne EÜR-Buchung)`);

    res.json({
      success: true,
      message: `Transaktion mit Rechnung ${rechnung.rechnungsnummer} verknüpft`,
      rechnungsnummer: rechnung.rechnungsnummer
    });

  } catch (err) {
    console.error('Rechnung-Verknüpfung-Fehler:', err);
    res.status(500).json({ message: 'Fehler bei der Verknüpfung', error: err.message });
  }
});

// ===================================================================
// ✅ GET /api/buchhaltung/bank-import/offene-rechnungen
// Lädt offene Verbandsrechnungen für Verknüpfung
// ===================================================================
router.get('/bank-import/offene-rechnungen', requireSuperAdmin, async (req, res) => {
  try {
    const rechnungen = await new Promise((resolve, reject) => {
      db.query(`
        SELECT id, rechnungsnummer, empfaenger_name, summe_brutto, rechnungsdatum, status
        FROM verband_rechnungen
        WHERE status = 'offen'
        ORDER BY rechnungsdatum DESC
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({ success: true, rechnungen });
  } catch (err) {
    console.error('Fehler beim Laden offener Rechnungen:', err);
    res.status(500).json({ message: 'Fehler beim Laden', error: err.message });
  }
});

// ===================================================================
// ✅ POST /api/buchhaltung/bank-import/batch-zuordnen - Mehrere zuordnen
// ===================================================================
router.post('/bank-import/batch-zuordnen', requireSuperAdmin, async (req, res) => {
  try {
    const { transaktionen } = req.body;

    if (!Array.isArray(transaktionen) || transaktionen.length === 0) {
      return res.status(400).json({ message: 'Keine Transaktionen angegeben' });
    }

    const results = [];
    for (const tx of transaktionen) {
      try {
        // Hole Transaktion
        const txResult = await new Promise((resolve, reject) => {
          db.query('SELECT * FROM bank_transaktionen WHERE transaktion_id = ? AND status != "zugeordnet"',
            [tx.id], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });

        if (txResult.length === 0) {
          results.push({ id: tx.id, success: false, message: 'Nicht gefunden oder bereits zugeordnet' });
          continue;
        }

        const transaction = txResult[0];
        const buchungsart = transaction.betrag > 0 ? 'einnahme' : 'ausgabe';
        const jahr = new Date(transaction.buchungsdatum).getFullYear();
        const belegNummer = await generateBelegNummer(transaction.dojo_id, jahr);

        const belegResult = await new Promise((resolve, reject) => {
          db.query(`
            INSERT INTO buchhaltung_belege (
              beleg_nummer, dojo_id, organisation_name, buchungsart,
              beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
              kategorie, beschreibung, lieferant_kunde, erstellt_von
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
          `, [
            belegNummer,
            transaction.dojo_id,
            transaction.organisation_name,
            buchungsart,
            transaction.buchungsdatum,
            transaction.buchungsdatum,
            Math.abs(transaction.betrag),
            Math.abs(transaction.betrag),
            tx.kategorie,
            transaction.verwendungszweck || 'Bank-Import',
            transaction.auftraggeber_empfaenger,
            req.user?.id || 1
          ], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        await new Promise((resolve, reject) => {
          db.query(`
            UPDATE bank_transaktionen SET
              status = 'zugeordnet',
              kategorie = ?,
              match_typ = 'manuell',
              beleg_id = ?,
              zugeordnet_von = ?,
              zugeordnet_am = NOW()
            WHERE transaktion_id = ?
          `, [tx.kategorie, belegResult.insertId, req.user?.id || 1, tx.id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        results.push({ id: tx.id, success: true, beleg_id: belegResult.insertId });
      } catch (err) {
        results.push({ id: tx.id, success: false, message: err.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    res.json({
      message: `${successful} von ${transaktionen.length} Transaktionen zugeordnet`,
      results
    });

  } catch (err) {
    console.error('Batch-Zuordnung-Fehler:', err);
    res.status(500).json({ message: 'Fehler bei der Batch-Zuordnung', error: err.message });
  }
});

// ===================================================================
// ❌ POST /api/buchhaltung/bank-import/ignorieren/:id - Transaktion ignorieren
// ===================================================================
router.post('/bank-import/ignorieren/:id', requireSuperAdmin, (req, res) => {
  const transaktionId = req.params.id;
  const { lerne_regel = false } = req.body;

  db.query('SELECT * FROM bank_transaktionen WHERE transaktion_id = ?', [transaktionId], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'Transaktion nicht gefunden' });
    }

    const tx = results[0];

    db.query(`
      UPDATE bank_transaktionen SET status = 'ignoriert'
      WHERE transaktion_id = ?
    `, [transaktionId], async (err) => {
      if (err) {
        console.error('Ignorieren-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Ignorieren' });
      }

      // Optional: Lerne Ignorier-Regel
      if (lerne_regel && tx.auftraggeber_empfaenger) {
        await new Promise((resolve) => {
          db.query(`
            INSERT IGNORE INTO bank_zuordnung_regeln (
              dojo_id, match_feld, match_wert, match_typ, kategorie, aktion, erstellt_von
            ) VALUES (?, 'auftraggeber', ?, 'enthält', 'sonstige_kosten', 'ignorieren', ?)
          `, [tx.dojo_id, tx.auftraggeber_empfaenger.substring(0, 100), req.user?.id || 1], () => resolve());
        });
      }

      res.json({ message: 'Transaktion ignoriert' });
    });
  });
});

// ===================================================================
// 🔄 POST /api/buchhaltung/bank-import/umbuchen/:id - Kategorie ändern (Umbuchung)
// ===================================================================
router.post('/bank-import/umbuchen/:id', requireSuperAdmin, (req, res) => {
  const transaktionId = req.params.id;
  const { kategorie } = req.body;

  if (!kategorie) {
    return res.status(400).json({ message: 'Kategorie ist erforderlich' });
  }

  db.query('SELECT * FROM bank_transaktionen WHERE transaktion_id = ?', [transaktionId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'Transaktion nicht gefunden' });
    }

    const tx = results[0];

    // Update Kategorie in bank_transaktionen
    db.query(`
      UPDATE bank_transaktionen SET kategorie = ?
      WHERE transaktion_id = ?
    `, [kategorie, transaktionId], (err) => {
      if (err) {
        console.error('Umbuchung-Fehler:', err);
        return res.status(500).json({ message: 'Fehler bei der Umbuchung' });
      }

      // Falls ein Beleg existiert, auch dort die Kategorie ändern
      if (tx.beleg_id) {
        db.query(`
          UPDATE buchhaltung_belege SET kategorie = ?
          WHERE beleg_id = ?
        `, [kategorie, tx.beleg_id], (err) => {
          if (err) {
            console.error('Beleg-Update-Fehler:', err);
          }
          res.json({ message: 'Kategorie geändert' });
        });
      } else {
        res.json({ message: 'Kategorie geändert' });
      }
    });
  });
});

// ===================================================================
// 🔄 POST /api/buchhaltung/bank-import/vorschlag-annehmen/:id - Vorschlag annehmen
// ===================================================================
router.post('/bank-import/vorschlag-annehmen/:id', requireSuperAdmin, async (req, res) => {
  try {
    const transaktionId = req.params.id;

    // Hole Transaktion mit Vorschlag
    const txResult = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM bank_transaktionen WHERE transaktion_id = ? AND status = "vorgeschlagen"',
        [transaktionId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (txResult.length === 0) {
      return res.status(404).json({ message: 'Transaktion nicht gefunden oder kein Vorschlag vorhanden' });
    }

    const tx = txResult[0];
    let matchDetails = tx.match_details;
    if (typeof matchDetails === 'string') {
      try { matchDetails = JSON.parse(matchDetails); } catch (e) {}
    }

    // Je nach Match-Typ unterschiedliche Aktionen
    if (tx.match_typ === 'beitrag' && tx.match_id) {
      // Markiere Beitrag als bezahlt
      await new Promise((resolve, reject) => {
        db.query(`
          UPDATE beitraege SET
            bezahlt = 1,
            zahlungsdatum = ?,
            zahlungsart = 'Überweisung'
          WHERE beitrag_id = ?
        `, [tx.buchungsdatum, tx.match_id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else if (tx.match_typ === 'rechnung' && tx.match_id) {
      // Markiere Rechnung als bezahlt
      await new Promise((resolve, reject) => {
        db.query(`
          UPDATE rechnungen SET
            status = 'bezahlt',
            bezahlt_am = ?
          WHERE rechnung_id = ?
        `, [tx.buchungsdatum, tx.match_id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Erstelle Beleg und markiere als zugeordnet
    const kategorie = matchDetails?.kategorie || 'betriebseinnahmen';
    const buchungsart = tx.betrag > 0 ? 'einnahme' : 'ausgabe';
    const jahr = new Date(tx.buchungsdatum).getFullYear();
    const belegNummer = await generateBelegNummer(tx.dojo_id, jahr);

    const belegResult = await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO buchhaltung_belege (
          beleg_nummer, dojo_id, organisation_name, buchungsart,
          beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
          kategorie, beschreibung, lieferant_kunde, erstellt_von
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
      `, [
        belegNummer,
        tx.dojo_id,
        tx.organisation_name,
        buchungsart,
        tx.buchungsdatum,
        tx.buchungsdatum,
        Math.abs(tx.betrag),
        Math.abs(tx.betrag),
        kategorie,
        tx.verwendungszweck || 'Bank-Import',
        tx.auftraggeber_empfaenger,
        req.user?.id || 1
      ], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE bank_transaktionen SET
          status = 'zugeordnet',
          kategorie = ?,
          beleg_id = ?,
          zugeordnet_von = ?,
          zugeordnet_am = NOW()
        WHERE transaktion_id = ?
      `, [kategorie, belegResult.insertId, req.user?.id || 1, transaktionId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      message: 'Vorschlag angenommen',
      beleg_id: belegResult.insertId,
      beleg_nummer: belegNummer
    });

  } catch (err) {
    console.error('Vorschlag-Annehmen-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Annehmen des Vorschlags', error: err.message });
  }
});

// ===================================================================
// 🗑️ DELETE /api/buchhaltung/bank-import/transaktion/:id - Einzelne Transaktion löschen
// ===================================================================
router.delete('/bank-import/transaktion/:id', requireSuperAdmin, (req, res) => {
  const transaktionId = req.params.id;

  db.query('DELETE FROM bank_transaktionen WHERE transaktion_id = ? AND beleg_id IS NULL', [transaktionId], (err, result) => {
    if (err) {
      console.error('Transaktion-Löschen-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Löschen' });
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'Transaktion nicht gefunden oder bereits mit Beleg verknüpft' });
    }

    res.json({ message: 'Transaktion gelöscht' });
  });
});

// ===================================================================
// 🗑️ DELETE /api/buchhaltung/bank-import/import/:importId - Ganzen Import löschen
// ===================================================================
router.delete('/bank-import/import/:importId', requireSuperAdmin, (req, res) => {
  const importId = req.params.importId;

  // Lösche nur Transaktionen ohne Beleg-Verknüpfung
  db.query('DELETE FROM bank_transaktionen WHERE import_id = ? AND beleg_id IS NULL', [importId], (err, result) => {
    if (err) {
      console.error('Import-Löschen-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Löschen' });
    }

    // Update Historie
    db.query('DELETE FROM bank_import_historie WHERE import_id = ?', [importId], () => {
      res.json({
        message: `${result.affectedRows} Transaktionen gelöscht`,
        deleted: result.affectedRows
      });
    });
  });
});

// ===================================================================
// 📜 GET /api/buchhaltung/bank-import/historie - Import-Historie
// ===================================================================
router.get('/bank-import/historie', requireSuperAdmin, (req, res) => {
  const { organisation, limit = 20 } = req.query;

  let whereClause = '1=1';
  const params = [];

  if (organisation && organisation !== 'alle') {
    whereClause += ' AND organisation_name = ?';
    params.push(organisation);
  }

  db.query(`
    SELECT
      h.*,
      (SELECT COUNT(*) FROM bank_transaktionen t WHERE t.import_id = h.import_id AND t.status = 'zugeordnet') as aktuell_zugeordnet
    FROM bank_import_historie h
    WHERE ${whereClause}
    ORDER BY importiert_am DESC
    LIMIT ?
  `, [...params, parseInt(limit)], (err, results) => {
    if (err) {
      console.error('Historie-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Laden der Historie' });
    }

    res.json(results);
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/guv - GuV (Gewinn- und Verlustrechnung)
// ===================================================================
router.get('/guv', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, quartal } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  let dateFilter = `jahr = ${db.escape(currentYear)}`;
  if (quartal) {
    const q = parseInt(quartal);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    dateFilter += ` AND monat BETWEEN ${startMonth} AND ${endMonth}`;
  }

  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  // Fetch GuV structured data
  const guvSql = `
    SELECT
      SUM(umsatzerloese) as umsatzerloese,
      SUM(materialaufwand) as materialaufwand,
      SUM(personalaufwand) as personalaufwand,
      SUM(abschreibungen) as abschreibungen,
      SUM(sonstige_aufwendungen) as sonstige_aufwendungen
    FROM v_guv_daten
    WHERE ${dateFilter} ${orgFilter}
  `;

  db.query(guvSql, (err, results) => {
    if (err) {
      console.error('GuV-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Laden der GuV-Daten', error: err.message });
    }

    const data = results[0] || {};
    const umsatzerloese = parseFloat(data.umsatzerloese || 0);
    const materialaufwand = parseFloat(data.materialaufwand || 0);
    const personalaufwand = parseFloat(data.personalaufwand || 0);
    const abschreibungen = parseFloat(data.abschreibungen || 0);
    const sonstigeAufwendungen = parseFloat(data.sonstige_aufwendungen || 0);

    const gesamtaufwand = materialaufwand + personalaufwand + abschreibungen + sonstigeAufwendungen;
    const jahresueberschuss = umsatzerloese - gesamtaufwand;

    res.json({
      jahr: currentYear,
      quartal: quartal || null,
      organisation: organisation || 'alle',
      guv: {
        umsatzerloese,
        materialaufwand,
        personalaufwand,
        abschreibungen,
        sonstige_aufwendungen: sonstigeAufwendungen,
        gesamtaufwand,
        jahresueberschuss
      }
    });
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/guv/details - GuV with detailed breakdowns
// ===================================================================
router.get('/guv/details', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, quartal } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  let dateFilter = `jahr = ${db.escape(currentYear)}`;
  if (quartal) {
    const q = parseInt(quartal);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    dateFilter += ` AND monat BETWEEN ${startMonth} AND ${endMonth}`;
  }

  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  // Detailed revenue breakdown
  const einnahmenDetailsSql = `
    SELECT kategorie, quelle, SUM(betrag_brutto) as summe
    FROM v_euer_einnahmen
    WHERE ${dateFilter} ${orgFilter}
    GROUP BY kategorie, quelle
  `;

  // Detailed expense breakdown by category
  const ausgabenDetailsSql = `
    SELECT kategorie, quelle, SUM(betrag_brutto) as summe
    FROM v_euer_ausgaben
    WHERE ${dateFilter} ${orgFilter}
    GROUP BY kategorie, quelle
  `;

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(einnahmenDetailsSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenDetailsSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([einnahmenDetails, ausgabenDetails]) => {
    // Structure according to GuV format
    const guvDetails = {
      umsatzerloese: {
        gesamt: 0,
        details: []
      },
      materialaufwand: {
        gesamt: 0,
        details: []
      },
      personalaufwand: {
        gesamt: 0,
        details: []
      },
      abschreibungen: {
        gesamt: 0,
        details: []
      },
      sonstige_aufwendungen: {
        gesamt: 0,
        details: []
      }
    };

    // Process revenues
    einnahmenDetails.forEach(row => {
      const betrag = parseFloat(row.summe || 0);
      guvDetails.umsatzerloese.gesamt += betrag;
      guvDetails.umsatzerloese.details.push({
        quelle: row.quelle,
        betrag
      });
    });

    // Process expenses by category
    ausgabenDetails.forEach(row => {
      const betrag = parseFloat(row.summe || 0);

      if (row.kategorie === 'wareneingang') {
        guvDetails.materialaufwand.gesamt += betrag;
        guvDetails.materialaufwand.details.push({ quelle: row.quelle, betrag });
      } else if (row.kategorie === 'personalkosten') {
        guvDetails.personalaufwand.gesamt += betrag;
        guvDetails.personalaufwand.details.push({ quelle: row.quelle, betrag });
      } else if (row.kategorie === 'abschreibungen') {
        guvDetails.abschreibungen.gesamt += betrag;
        guvDetails.abschreibungen.details.push({ quelle: row.quelle, betrag });
      } else {
        guvDetails.sonstige_aufwendungen.gesamt += betrag;
        guvDetails.sonstige_aufwendungen.details.push({
          kategorie: row.kategorie,
          quelle: row.quelle,
          betrag
        });
      }
    });

    const gesamtaufwand = guvDetails.materialaufwand.gesamt +
                          guvDetails.personalaufwand.gesamt +
                          guvDetails.abschreibungen.gesamt +
                          guvDetails.sonstige_aufwendungen.gesamt;

    res.json({
      jahr: currentYear,
      quartal: quartal || null,
      organisation: organisation || 'alle',
      ...guvDetails,
      gesamtaufwand,
      jahresueberschuss: guvDetails.umsatzerloese.gesamt - gesamtaufwand
    });
  })
  .catch(err => {
    console.error('GuV-Details-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der GuV-Details', error: err.message });
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/bilanz - Balance Sheet
// ===================================================================
router.get('/bilanz', requireSuperAdmin, (req, res) => {
  const { organisation, jahr } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  const dojoFilter = organisation && organisation !== 'alle'
    ? `AND dojo_id = ${organisation === 'TDA International' ? 2 : 1}`
    : '';

  // Fetch initial balance data
  const stammdatenSql = `
    SELECT * FROM bilanz_stammdaten
    WHERE jahr = ? ${dojoFilter}
    LIMIT 1
  `;

  // Fetch bank balance
  const bankBestandSql = `
    SELECT COALESCE(SUM(bank_saldo), 0) as bank_saldo
    FROM v_bilanz_bank_bestand
    WHERE jahr <= ? ${orgFilter}
  `;

  // Fetch receivables
  const forderungenSql = `
    SELECT COALESCE(SUM(forderungen), 0) as forderungen
    FROM v_bilanz_forderungen
    WHERE jahr = ? ${dojoFilter}
  `;

  // Fetch cumulative profit/equity
  const eigenkapitalSql = `
    SELECT COALESCE(SUM(jahresueberschuss), 0) as kumulierter_gewinn
    FROM v_bilanz_eigenkapital
    WHERE jahr <= ? ${orgFilter}
  `;

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(stammdatenSql, [currentYear], (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || {});
      });
    }),
    new Promise((resolve, reject) => {
      db.query(bankBestandSql, [currentYear], (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || {});
      });
    }),
    new Promise((resolve, reject) => {
      db.query(forderungenSql, [currentYear], (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || {});
      });
    }),
    new Promise((resolve, reject) => {
      db.query(eigenkapitalSql, [currentYear], (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || {});
      });
    })
  ])
  .then(([stammdaten, bankBestand, forderungen, eigenkapital]) => {
    // Calculate Assets (Aktiva)
    const bankGuthaben = parseFloat(stammdaten.bank_anfangsbestand || 0) + parseFloat(bankBestand.bank_saldo || 0);
    const kassenbestand = parseFloat(stammdaten.kasse_anfangsbestand || 0);
    const forderungenBetrag = parseFloat(forderungen.forderungen || 0);
    const sachanlagen = parseFloat(stammdaten.sachanlagen || 0);

    const umlaufvermoegen = bankGuthaben + kassenbestand + forderungenBetrag;
    const anlagevermoegen = sachanlagen;
    const gesamtAktiva = umlaufvermoegen + anlagevermoegen;

    // Calculate Liabilities & Equity (Passiva)
    const eigenkapitalAnfang = parseFloat(stammdaten.eigenkapital_anfang || 0);
    const kumulierterGewinn = parseFloat(eigenkapital.kumulierter_gewinn || 0);
    const eigenkapitalGesamt = eigenkapitalAnfang + kumulierterGewinn;

    const verbindlichkeiten = parseFloat(stammdaten.darlehen || 0);

    const gesamtPassiva = eigenkapitalGesamt + verbindlichkeiten;

    res.json({
      jahr: currentYear,
      organisation: organisation || 'alle',
      aktiva: {
        anlagevermoegen: {
          sachanlagen,
          gesamt: anlagevermoegen
        },
        umlaufvermoegen: {
          bank_guthaben: bankGuthaben,
          kassenbestand,
          forderungen: forderungenBetrag,
          gesamt: umlaufvermoegen
        },
        gesamt: gesamtAktiva
      },
      passiva: {
        eigenkapital: {
          anfangsbestand: eigenkapitalAnfang,
          kumulierter_gewinn: kumulierterGewinn,
          gesamt: eigenkapitalGesamt
        },
        verbindlichkeiten: {
          darlehen: verbindlichkeiten,
          gesamt: verbindlichkeiten
        },
        gesamt: gesamtPassiva
      },
      bilanz_ausgeglichen: Math.abs(gesamtAktiva - gesamtPassiva) < 0.01
    });
  })
  .catch(err => {
    console.error('Bilanz-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Bilanz-Daten', error: err.message });
  });
});

// ===================================================================
// 📝 POST /api/buchhaltung/bilanz/stammdaten - Update opening balances
// ===================================================================
router.post('/bilanz/stammdaten', requireSuperAdmin, (req, res) => {
  const {
    organisation,
    jahr,
    bank_anfangsbestand,
    kasse_anfangsbestand,
    sachanlagen,
    sachanlagen_beschreibung,
    eigenkapital_anfang,
    darlehen,
    darlehen_beschreibung
  } = req.body;

  const dojoId = organisation === 'TDA International' ? 2 : 1;
  const userId = req.user?.user_id || req.user?.id || 1;

  const sql = `
    INSERT INTO bilanz_stammdaten (
      dojo_id, organisation_name, jahr,
      bank_anfangsbestand, kasse_anfangsbestand,
      sachanlagen, sachanlagen_beschreibung,
      eigenkapital_anfang,
      darlehen, darlehen_beschreibung,
      erstellt_von
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      bank_anfangsbestand = VALUES(bank_anfangsbestand),
      kasse_anfangsbestand = VALUES(kasse_anfangsbestand),
      sachanlagen = VALUES(sachanlagen),
      sachanlagen_beschreibung = VALUES(sachanlagen_beschreibung),
      eigenkapital_anfang = VALUES(eigenkapital_anfang),
      darlehen = VALUES(darlehen),
      darlehen_beschreibung = VALUES(darlehen_beschreibung),
      geaendert_von = VALUES(erstellt_von),
      geaendert_am = CURRENT_TIMESTAMP
  `;

  db.query(sql, [
    dojoId, organisation, jahr,
    bank_anfangsbestand || 0, kasse_anfangsbestand || 0,
    sachanlagen || 0, sachanlagen_beschreibung || '',
    eigenkapital_anfang || 0,
    darlehen || 0, darlehen_beschreibung || '',
    userId
  ], (err, result) => {
    if (err) {
      console.error('Stammdaten-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Speichern der Stammdaten', error: err.message });
    }

    res.json({
      message: 'Bilanz-Stammdaten erfolgreich gespeichert',
      stammdaten_id: result.insertId || result.affectedRows
    });
  });
});

// ===================================================================
// 📤 GET /api/buchhaltung/guv/export - GuV Export (PDF/CSV)
// ===================================================================
router.get('/guv/export', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, format = 'csv' } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  let dateFilter = `jahr = ${db.escape(currentYear)}`;
  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  // Fetch GuV data
  const einnahmenSql = `SELECT kategorie, quelle, SUM(betrag_brutto) as summe FROM v_euer_einnahmen WHERE ${dateFilter} ${orgFilter} GROUP BY kategorie, quelle`;
  const ausgabenSql = `SELECT kategorie, quelle, SUM(betrag_brutto) as summe FROM v_euer_ausgaben WHERE ${dateFilter} ${orgFilter} GROUP BY kategorie, quelle`;

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(einnahmenSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([einnahmen, ausgaben]) => {
    const umsatzerloese = einnahmen.reduce((sum, row) => sum + parseFloat(row.summe || 0), 0);
    const materialaufwand = ausgaben.filter(r => r.kategorie === 'wareneingang').reduce((sum, r) => sum + parseFloat(r.summe || 0), 0);
    const personalaufwand = ausgaben.filter(r => r.kategorie === 'personalkosten').reduce((sum, r) => sum + parseFloat(r.summe || 0), 0);
    const abschreibungen = ausgaben.filter(r => r.kategorie === 'abschreibungen').reduce((sum, r) => sum + parseFloat(r.summe || 0), 0);
    const sonstigeAufwendungen = ausgaben.filter(r => !['wareneingang', 'personalkosten', 'abschreibungen'].includes(r.kategorie)).reduce((sum, r) => sum + parseFloat(r.summe || 0), 0);
    const jahresueberschuss = umsatzerloese - (materialaufwand + personalaufwand + abschreibungen + sonstigeAufwendungen);

    if (format === 'csv') {
      let csv = 'Position;Betrag\n';
      csv += `Umsatzerlöse;${umsatzerloese.toFixed(2)}\n`;
      csv += `Materialaufwand;-${materialaufwand.toFixed(2)}\n`;
      csv += `Personalaufwand;-${personalaufwand.toFixed(2)}\n`;
      csv += `Abschreibungen;-${abschreibungen.toFixed(2)}\n`;
      csv += `Sonstige Aufwendungen;-${sonstigeAufwendungen.toFixed(2)}\n`;
      csv += `;\n`;
      csv += `Jahresüberschuss;${jahresueberschuss.toFixed(2)}\n`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="GuV_${jahr}_${organisation || 'alle'}.csv"`);
      res.send('\ufeff' + csv);
    } else {
      res.status(400).json({ message: 'Nur CSV-Export wird derzeit unterstützt' });
    }
  })
  .catch(err => {
    console.error('GuV-Export-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Export der GuV', error: err.message });
  });
});

// ===================================================================
// 📤 GET /api/buchhaltung/bilanz/export - Bilanz Export (CSV)
// ===================================================================
router.get('/bilanz/export', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, format = 'csv' } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  const orgFilter = organisation && organisation !== 'alle' ? `AND organisation_name = ${db.escape(organisation)}` : '';
  const dojoFilter = organisation && organisation !== 'alle' ? `AND dojo_id = ${organisation === 'TDA International' ? 2 : 1}` : '';

  const stammdatenSql = `SELECT * FROM bilanz_stammdaten WHERE jahr = ? ${dojoFilter} LIMIT 1`;
  const bankBestandSql = `SELECT COALESCE(SUM(bank_saldo), 0) as bank_saldo FROM v_bilanz_bank_bestand WHERE jahr <= ? ${orgFilter}`;
  const forderungenSql = `SELECT COALESCE(SUM(forderungen), 0) as forderungen FROM v_bilanz_forderungen WHERE jahr = ? ${dojoFilter}`;
  const eigenkapitalSql = `SELECT COALESCE(SUM(jahresueberschuss), 0) as kumulierter_gewinn FROM v_bilanz_eigenkapital WHERE jahr <= ? ${orgFilter}`;

  Promise.all([
    new Promise((resolve, reject) => db.query(stammdatenSql, [currentYear], (err, r) => err ? reject(err) : resolve(r[0] || {}))),
    new Promise((resolve, reject) => db.query(bankBestandSql, [currentYear], (err, r) => err ? reject(err) : resolve(r[0] || {}))),
    new Promise((resolve, reject) => db.query(forderungenSql, [currentYear], (err, r) => err ? reject(err) : resolve(r[0] || {}))),
    new Promise((resolve, reject) => db.query(eigenkapitalSql, [currentYear], (err, r) => err ? reject(err) : resolve(r[0] || {})))
  ])
  .then(([stammdaten, bankBestand, forderungen, eigenkapital]) => {
    const bankGuthaben = parseFloat(stammdaten.bank_anfangsbestand || 0) + parseFloat(bankBestand.bank_saldo || 0);
    const kassenbestand = parseFloat(stammdaten.kasse_anfangsbestand || 0);
    const forderungenBetrag = parseFloat(forderungen.forderungen || 0);
    const sachanlagen = parseFloat(stammdaten.sachanlagen || 0);
    const eigenkapitalAnfang = parseFloat(stammdaten.eigenkapital_anfang || 0);
    const kumulierterGewinn = parseFloat(eigenkapital.kumulierter_gewinn || 0);
    const darlehen = parseFloat(stammdaten.darlehen || 0);

    const umlaufvermoegen = bankGuthaben + kassenbestand + forderungenBetrag;
    const eigenkapitalGesamt = eigenkapitalAnfang + kumulierterGewinn;
    const gesamtAktiva = sachanlagen + umlaufvermoegen;
    const gesamtPassiva = eigenkapitalGesamt + darlehen;

    if (format === 'csv') {
      let csv = 'AKTIVA;Betrag;PASSIVA;Betrag\n';
      csv += `Anlagevermögen;${sachanlagen.toFixed(2)};Eigenkapital;${eigenkapitalGesamt.toFixed(2)}\n`;
      csv += `Umlaufvermögen;${umlaufvermoegen.toFixed(2)};Verbindlichkeiten;${darlehen.toFixed(2)}\n`;
      csv += `;;;\n`;
      csv += `Summe Aktiva;${gesamtAktiva.toFixed(2)};Summe Passiva;${gesamtPassiva.toFixed(2)}\n`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="Bilanz_${jahr}_${organisation || 'alle'}.csv"`);
      res.send('\ufeff' + csv);
    } else {
      res.status(400).json({ message: 'Nur CSV-Export wird derzeit unterstützt' });
    }
  })
  .catch(err => {
    console.error('Bilanz-Export-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Export der Bilanz', error: err.message });
  });
});

module.exports = router;
