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
const { requireFeature } = require('../middleware/featureAccess');
const { convert: xmlConvert } = require('xmlbuilder2');
const Anthropic = require('@anthropic-ai/sdk');

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
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf', 'text/xml', 'application/xml'];
    const allowedExts = ['.csv', '.sta', '.mt940', '.txt', '.xls', '.xlsx', '.pdf', '.xml'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Nur CSV, MT940, Excel und camt XML Dateien erlaubt'));
    }
  }
});

// ===================================================================
// 🏦 BANK CSV PARSER (Deutsche Banken — erweitertes Multi-Bank-Format)
// ===================================================================

// Erkennungsregeln je Bank — geordnet nach Spezifität (spezifischste zuerst)
const BANK_SIGNATURES = [
  {
    format: 'comdirect',
    name: 'comdirect',
    test: (h) => h.includes('buchungstag') && h.includes('vorgang') && h.includes('umsatz in eur'),
    dateCol: 'buchungstag',
    amountCol: 'umsatz in eur',
    descCol: 'vorgang',
    payeeCol: 'buchungstext',
    signCol: true, // S/H Spalte ohne Name
  },
  {
    format: 'ing',
    name: 'ING',
    test: (h) => h.includes('buchungstag') && h.includes('auftraggeber/empfänger') && h.includes('buchungstext') && h.includes('betrag'),
    dateCol: 'buchungstag',
    amountCol: 'betrag',
    descCol: 'buchungstext',
    payeeCol: 'auftraggeber/empfänger',
  },
  {
    format: 'dkb2',
    name: 'DKB',
    test: (h) => h.includes('buchungsdatum') && h.includes('glaeubiger-id') && h.includes('verwendungszweck'),
    dateCol: 'buchungsdatum',
    amountCol: 'betrag (eur)',
    descCol: 'verwendungszweck',
    payeeCol: 'zahlungsempfaenger*in',
  },
  {
    format: 'dkb',
    name: 'DKB',
    test: (h) => h.includes('buchungstag') && (h.includes('gläubiger-id') || h.includes('glaeubiger-id') || h.includes('mandatsreferenz')) && h.includes('verwendungszweck'),
    dateCol: 'buchungstag',
    amountCol: 'betrag (eur)',
    descCol: 'verwendungszweck',
    payeeCol: 'auftraggeber / begünstigter',
  },
  {
    format: 'n26',
    name: 'N26',
    test: (h) => h.includes('datum') && h.includes('empfänger') && h.includes('transaktionstyp') && h.includes('betrag (eur)'),
    dateCol: 'datum',
    amountCol: 'betrag (eur)',
    descCol: 'verwendungszweck',
    payeeCol: 'empfänger',
    delimiter: ',',
  },
  {
    format: 'deutsche_bank',
    name: 'Deutsche Bank',
    test: (h) => h.includes('buchungstag') && h.includes('umsatzart') && (h.includes('begünstigter / auftraggeber') || h.includes('beguenstigter / auftraggeber')),
    dateCol: 'buchungstag',
    amountCol: 'betrag',
    descCol: 'verwendungszweck',
    payeeCol: 'begünstigter / auftraggeber',
  },
  {
    format: 'postbank',
    name: 'Postbank',
    test: (h) => h.includes('buchungsdatum') && h.includes('empfänger/auftraggeber') && h.includes('buchungsdetails'),
    dateCol: 'buchungsdatum',
    amountCol: 'betrag',
    descCol: 'buchungsdetails',
    payeeCol: 'empfänger/auftraggeber',
  },
  {
    format: 'sparkasse2',
    name: 'Sparkasse',
    test: (h) => h.includes('auftragskonto') && h.includes('buchungstag') && h.includes('beguenstigter/zahlungspflichtiger'),
    dateCol: 'buchungstag',
    amountCol: 'betrag',
    descCol: 'verwendungszweck',
    payeeCol: 'beguenstigter/zahlungspflichtiger',
  },
  {
    format: 'sparkasse',
    name: 'Sparkasse',
    test: (h) => h.includes('auftragskonto') || h.includes('kontonummer des auftraggebers'),
    dateCol: 'buchungstag',
    amountCol: 'betrag',
    descCol: 'verwendungszweck',
    payeeCol: 'beguenstigter/zahlungspflichtiger',
  },
  {
    format: 'volksbank',
    name: 'Volksbank / Raiffeisenbank',
    test: (h) => h.includes('textschlüssel') || h.includes('textschluessel') || h.includes('bezeichnung auftragskonto'),
    dateCol: 'buchungstag',
    amountCol: 'betrag',
    descCol: 'verwendungszweck',
    payeeCol: 'empfaenger/auftraggeber',
  },
  {
    format: 'wise',
    name: 'Wise',
    test: (h) => h.includes('transferwise id') || (h.includes('payment reference') && h.includes('running balance')),
    dateCol: 'date',
    amountCol: 'amount',
    descCol: 'description',
    payeeCol: 'payee name',
    payerCol: 'payer name',
    merchantCol: 'merchant',
    refCol: 'payment reference',
    delimiter: ',',
  },
  {
    format: 'generic',
    name: 'Unbekannte Bank',
    test: (h) => (h.includes('buchungstag') || h.includes('buchungsdatum') || h.includes('datum')) && h.includes('betrag'),
    dateCol: 'buchungstag',
    amountCol: 'betrag',
    descCol: 'verwendungszweck',
    payeeCol: 'auftraggeber',
  },
];

// Erkennt Bank-Format anhand der normalisierten Header-Zeile
const detectBankSignature = (headerLine) => {
  const lower = headerLine.toLowerCase().replace(/"/g, '');
  for (const sig of BANK_SIGNATURES) {
    if (sig.test(lower)) return sig;
  }
  return null;
};

// Parsed deutschen Betrag (1.234,56 -> 1234.56)
const parseGermanAmount = (str) => {
  if (!str) return 0;
  let cleaned = str.replace(/[€\s]/g, '').trim();
  // Wenn kein Komma aber Punkt (z.B. 1234.56 von N26): direkt parsen
  if (cleaned.includes('.') && !cleaned.includes(',')) return parseFloat(cleaned) || 0;
  // Deutsche Notation: 1.234,56 -> 1234.56
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

// Parsed deutsches Datum (DD.MM.YYYY, DD-MM-YYYY oder YYYY-MM-DD)
const parseGermanDate = (str) => {
  if (!str) return null;
  str = str.trim();
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  // DD-MM-YYYY (Wise)
  if (/^\d{2}-\d{2}-\d{4}/.test(str)) {
    const [day, month, year] = str.substring(0, 10).split('-');
    return `${year}-${month}-${day}`;
  }
  // DD.MM.YYYY
  const parts = str.split('.');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2].trim().split(' ')[0];
    if (year.length === 2) year = parseInt(year) > 50 ? '19' + year : '20' + year;
    return `${year}-${month}-${day}`;
  }
  return null;
};

// Parsed eine CSV-Zeile (respektiert Anführungszeichen)
const parseCSVRow = (line, sep) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (const char of line + sep) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === sep && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  return values;
};

// CSV Parser für verschiedene Bank-Formate
const parseCSVContent = (content) => {
  // Encoding-Normalisierung (BOM entfernen, Latin-1 Fallback)
  let text = content;
  if (typeof content !== 'string') {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      text = buf.toString('utf-8').substring(1);
    } else {
      try { text = buf.toString('utf-8'); } catch { text = iconv.decode(buf, 'latin-1'); }
    }
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { error: 'Datei ist leer oder hat keine Daten', transaktionen: [] };

  // Finde Header-Zeile und Bank-Signatur (erste 10 Zeilen)
  let headerIndex = 0;
  let signature = null;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    signature = detectBankSignature(lines[i]);
    if (signature) { headerIndex = i; break; }
  }

  if (!signature) {
    return { error: 'Unbekanntes Bank-Format. Unterstützt: Sparkasse, Volksbank, DKB, ING, Comdirect, N26, Deutsche Bank, Postbank, Wise und MT940.', transaktionen: [] };
  }

  const headerLine = lines[headerIndex];
  const sep = signature.delimiter || (headerLine.includes('\t') ? '\t' : ';');
  const headers = headerLine.split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase());

  // Spaltenpositionen bestimmen
  const colIdx = (name) => {
    if (!name) return -1;
    const n = name.toLowerCase();
    return headers.findIndex(h => h === n || h.includes(n) || n.includes(h));
  };

  const dateIdx  = colIdx(signature.dateCol);
  const amtIdx   = colIdx(signature.amountCol);
  const descIdx  = colIdx(signature.descCol);
  const payeeIdx    = colIdx(signature.payeeCol);
  const payerIdx    = signature.payerCol    ? colIdx(signature.payerCol)    : -1;
  const merchantIdx = signature.merchantCol ? colIdx(signature.merchantCol) : -1;
  const refIdx      = signature.refCol      ? colIdx(signature.refCol)      : -1;
  const ibanIdx  = headers.findIndex(h => h === 'iban' || h === 'kontonummer' || h.includes('payee account') || h.includes('iban'));
  const bicIdx   = headers.findIndex(h => h === 'bic' || h === 'blz');

  if (dateIdx < 0 || amtIdx < 0) {
    return { error: `Bank-Format erkannt (${signature.name}), aber Pflicht-Spalten nicht gefunden.`, transaktionen: [] };
  }

  const transaktionen = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVRow(line, sep);
    if (values.length < 3) continue;

    try {
      let betrag = parseGermanAmount(values[amtIdx] || '');

      // Comdirect: S/H-Zeichen in letzter Spalte gibt Vorzeichen an
      if (signature.signCol) {
        const lastVal = values[values.length - 1]?.trim().toUpperCase();
        if (lastVal === 'S' || lastVal === 'H') {
          betrag = lastVal === 'S' ? -Math.abs(betrag) : Math.abs(betrag);
        }
      }

      if (betrag === 0) continue;

      const buchungsdatum = parseGermanDate(values[dateIdx] || '');
      if (!buchungsdatum) continue;

      // Wise: bei Eingang Payer Name, bei Ausgang Payee Name, Fallback Merchant
      let gegenpartei = (payeeIdx >= 0 ? values[payeeIdx] : '') || '';
      if (betrag > 0 && payerIdx >= 0 && values[payerIdx]?.trim()) {
        gegenpartei = values[payerIdx].trim();
      }
      if (!gegenpartei && merchantIdx >= 0 && values[merchantIdx]?.trim()) {
        gegenpartei = values[merchantIdx].trim();
      }
      // Wise: Payment Reference als Verwendungszweck wenn Description leer
      let vwz = (descIdx >= 0 ? values[descIdx] : '') || '';
      if (!vwz && refIdx >= 0) vwz = values[refIdx] || '';

      const t = {
        buchungsdatum,
        valutadatum: null,
        betrag,
        verwendungszweck: vwz,
        auftraggeber_empfaenger: gegenpartei,
        iban_gegenkonto: (ibanIdx >= 0 ? values[ibanIdx] : '') || '',
        bic: (bicIdx >= 0 ? values[bicIdx] : '') || '',
        buchungstext: '',
        mandatsreferenz: '',
      };

      transaktionen.push(t);
    } catch (e) {
      logger.debug('CSV-Zeile übersprungen:', { error: e.message });
    }
  }

  return { format: signature.format, bank: signature.name, transaktionen };
};

// Legacy-Alias (wird intern noch referenziert)
const detectBankFormat = (headerLine) => {
  const sig = detectBankSignature(headerLine);
  return sig ? sig.format : 'unknown';
};
const getBankName = (format) => {
  const sig = BANK_SIGNATURES.find(s => s.format === format);
  return sig ? sig.name : 'Unbekannte Bank';
};

// ===================================================================
// 🏷️ AUTO-KATEGORISIERUNG (Keyword-Regeln)
// ===================================================================

// Standardkategorien mit Keywords — Kampfkunstschule + allgemein
const AUTO_KATEGORISIERUNG_REGELN = [
  // ---- Betriebseinnahmen ----
  { kategorie: 'Mitgliedsbeiträge', typ: 'einnahme', euer_typ: 'betriebseinnahme',
    keywords: ['mitgliedsbeitrag', 'monatsbeitrag', 'jahresbeitrag', 'kursbeitrag', 'vereinsbeitrag'] },
  { kategorie: 'Prüfungsgebühren', typ: 'einnahme', euer_typ: 'betriebseinnahme',
    keywords: ['prüfungsgebühr', 'pruefungsgebuehr', 'prüfung', 'graduierung', 'gürtelprüfung', 'danprüfung'] },
  { kategorie: 'Seminar-/Lehrgangsgebühren', typ: 'einnahme', euer_typ: 'betriebseinnahme',
    keywords: ['seminargebühr', 'lehrgangsgebühr', 'lehrgangsbeitrag', 'seminarbeitrag', 'workshop'] },
  { kategorie: 'Shopverkäufe', typ: 'einnahme', euer_typ: 'betriebseinnahme',
    keywords: ['shopverkauf', 'artikelverkauf', 'ausrüstung', 'gi', 'judogi', 'karateanzug', 'kimono', 'gürtel'] },
  { kategorie: 'Spenden', typ: 'einnahme', euer_typ: 'betriebseinnahme',
    keywords: ['spende', 'förderung', 'zuschuss', 'donation'] },

  // ---- Betriebsausgaben: Raumkosten ----
  { kategorie: 'Miete / Hallenmiete', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['miete', 'raummiete', 'hallenmiete', 'hallenbenutzung', 'sportstätte', 'mietvertrag', 'nebenkosten wohnraum'] },
  { kategorie: 'Strom / Energie', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['strom', 'energie', 'stadtwerke', 'eon ', 'e.on', 'rwe ', 'vattenfall', 'stromanbieter'] },
  { kategorie: 'Wasser / Abwasser', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['wasser', 'abwasser', 'wasserwerk'] },

  // ---- Betriebsausgaben: KFZ-Kosten (vor Versicherungen, damit kfz-versicherung hier landet) ----
  { kategorie: 'KFZ-Kosten', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['kfz-versicherung', 'kfz versicherung', 'autoversicherung', 'fahrzeugversicherung', 'kraftfahrtversicherung', 'kfz-steuer', 'kraftfahrzeugsteuer', 'hauptuntersuchung', 'tüv', 'kraftstoff', 'tankstelle', 'shell ', 'aral ', 'bp ', 'esso ', 'werkstatt', 'reifenwechsel', 'kfz-reparatur', 'fahrzeugreparatur'] },

  // ---- Betriebsausgaben: Versicherung ----
  { kategorie: 'Versicherungen', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['versicherung', 'haftpflicht', 'betriebshaftpflicht', 'sportversicherung', 'unfallversicherung', 'allianz', 'axa ', 'huk ', 'generali', 'zurich versicherung', 'dak ', 'techniker krankenkasse', 'krankenkasse', 'aok '] },

  // ---- Betriebsausgaben: Sportausrüstung / Material ----
  { kategorie: 'Sportmaterial / Ausrüstung', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['budosport', 'kampfsport', 'tatami', 'matten', 'schutzausrüstung', 'wettkampf', 'fightsport', 'budo', 'ippon', 'judo', 'karate', 'taekwondo', 'boxen', 'ju-jutsu', 'jiu-jitsu'] },

  // ---- Betriebsausgaben: Verbandsbeiträge ----
  { kategorie: 'Verbandsbeiträge', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['djb ', 'djjv', 'dkv ', 'jjv', 'bjj', 'verband', 'bund ', 'tda ', 'landesverband', 'regionalverband'] },

  // ---- Betriebsausgaben: Verwaltung ----
  { kategorie: 'Büro / Verwaltung', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['bürobedarf', 'briefpapier', 'druckkosten', 'kopierpapier', 'büromaterial', 'toner', 'druckerpatrone'] },
  { kategorie: 'Software / IT', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['software', 'lizenz', 'hosting', 'domain', 'webhosting', 'microsoft', 'adobe', 'zoom ', 'slack ', 'apple ', 'google workspace'] },
  { kategorie: 'Steuerberater / Buchführung', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['steuerberater', 'steuerbüro', 'buchhaltung', 'datev ', 'lexware', 'steuerberatung'] },

  // ---- Betriebsausgaben: Marketing ----
  { kategorie: 'Marketing / Werbung', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['werbung', 'anzeige', 'flyer', 'plakat', 'facebook ads', 'google ads', 'instagram', 'marketing', 'druck',
      'wir machen druck', 'wirmachendruck', 'flyeralarm', 'vistaprint', 'print24', 'onlineprinters', 'saxoprint',
      'druckerei', 'drucksachen', 'poster', 'banner druck', 'visitenkarten', 'werbeagentur'] },

  // ---- Betriebsausgaben: Fortbildung ----
  { kategorie: 'Fortbildung / Lehrgänge', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['fortbildung', 'lehrgang', 'seminar trainer', 'trainerschein', 'c-lizenz', 'b-lizenz', 'a-lizenz'] },

  // ---- Betriebsausgaben: Fahrt ----
  { kategorie: 'Fahrtkosten', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['fahrtkosten', 'reisekosten', 'tankstelle', 'shell ', 'aral ', 'bp ', 'esso ', 'bahn ', 'db ', 'deutsche bahn', 'bus ', 'taxi', 'uber ', 'flug', 'parkgebühr', 'parkhaus'] },

  // ---- Betriebsausgaben: Löhne ----
  { kategorie: 'Trainer-Honorare / Löhne', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['honorar', 'trainer', 'übungsleiter', 'übungsleiterpauschale', 'lohn', 'gehalt'] },

  // ---- Transfers / Intern ----
  { kategorie: 'Eigene Konten (Transfer)', typ: 'transfer', euer_typ: null,
    keywords: ['umbuchung', 'übertrag eigene', 'kontoübertrag', 'girokonto', 'sparkonto', 'eigentransfer'] },

  // ---- Bankgebühren ----
  { kategorie: 'Kontoführungsgebühren', typ: 'ausgabe', euer_typ: 'betriebsausgabe',
    keywords: ['kontoführungsgebühr', 'kontoführung', 'bankgebühr', 'gebühr konto', 'entgelt konto', 'jahresgebühr karte', 'kartengebühr', 'kontogebühr', 'buchungsgebühr', 'überweisungsgebühr', 'serviceentgelt', 'kreditkartengebühr'] },

  // ---- Steuerzahlungen / Finanzamt ----
  { kategorie: 'Steuerzahlungen / Finanzamt', typ: 'ausgabe', euer_typ: 'steuerzahlung',
    keywords: ['finanzamt', 'finanzkasse', 'fk ', 'umsatzsteuer', 'ust ', 'ustg', 'einkommensteuer', 'est ', 'gewerbesteuer', 'gewst', 'körperschaftsteuer', 'lohnsteuer', 'kirchensteuer', 'solidaritätszuschlag', 'vorauszahlung steuer', 'steuer-vorauszahlung'] },
];

/**
 * Mapped eine freie Kategorie-Bezeichnung auf einen gültigen ENUM-Wert für buchhaltung_belege.kategorie.
 * ENUM: betriebseinnahmen, wareneingang, personalkosten, raumkosten, versicherungen,
 *       kfz_kosten, werbekosten, reisekosten, telefon_internet, buerokosten,
 *       fortbildung, abschreibungen, sonstige_kosten, privateinlage, privatentnahme
 */
const mapZuBelegeKategorie = (kategorieFreitext, euerTyp, betrag) => {
  const k = (kategorieFreitext || '').toLowerCase();
  // Direkte 1:1-Übernahme wenn bereits ein gültiger DB-Wert
  const direktWerte = ['betriebseinnahmen','wareneingang','personalkosten','raumkosten','versicherungen',
    'kfz_kosten','werbekosten','reisekosten','telefon_internet','buerokosten','fortbildung',
    'abschreibungen','sonstige_kosten','privateinlage','privatentnahme','steuerzahlungen','bankgebuehren','ausstattung'];
  if (direktWerte.includes(kategorieFreitext)) return kategorieFreitext;
  if (betrag > 0) return 'betriebseinnahmen';
  if (k.includes('steuer') || k.includes('finanzamt') || k.includes('finanzkasse')) return 'steuerzahlungen';
  if (k.includes('bankgebühr') || k.includes('kontoführung') || k.includes('kontogebühr') || k.includes('kartengebühr') || k.includes('entgelt konto')) return 'bankgebuehren';
  if (k.includes('personal') || k.includes('honorar') || k.includes('lohn') || k.includes('gehalt') || k.includes('trainer')) return 'personalkosten';
  if (k.includes('miete') || k.includes('raum') || k.includes('strom') || k.includes('energie') || k.includes('wasser') || k.includes('nebenkosten')) return 'raumkosten';
  if (k.includes('kfz') || k.includes('autoversicherung') || k.includes('fahrzeugversicherung') || k.includes('kraftfahrt') || k.includes('tüv') || k.includes('hauptuntersuchung') || k.includes('kraftstoff') || k.includes('werkstatt')) return 'kfz_kosten';
  if (k.includes('versicherung')) return 'versicherungen';
  if (k.includes('fahrt') || k.includes('reise')) return 'reisekosten';
  if (k.includes('werbung') || k.includes('marketing') || k.includes('anzeige')) return 'werbekosten';
  if (k.includes('telefon') || k.includes('internet') || k.includes('mobil')) return 'telefon_internet';
  if (k.includes('büro') || k.includes('buro') || k.includes('porto') || k.includes('steuerberater') || k.includes('buchhaltung')) return 'buerokosten';
  if (k.includes('fortbildung') || k.includes('seminar') || k.includes('lehrgang')) return 'fortbildung';
  if (k.includes('abschreibung')) return 'abschreibungen';
  if (k.includes('privateinlage')) return 'privateinlage';
  if (k.includes('privatentnahme')) return 'privatentnahme';
  return 'sonstige_kosten';
};

/**
 * Ermittelt automatisch eine Kategorie für eine Transaktion.
 * @param {string} verwendungszweck
 * @param {string} auftraggeber
 * @returns {{ kategorie: string, typ: string, euer_typ: string|null }|null}
 */
const autoKategorisieren = (verwendungszweck, auftraggeber) => {
  const searchText = `${verwendungszweck} ${auftraggeber}`.toLowerCase();
  for (const regel of AUTO_KATEGORISIERUNG_REGELN) {
    for (const kw of regel.keywords) {
      if (searchText.includes(kw)) {
        return { kategorie: regel.kategorie, typ: regel.typ, euer_typ: regel.euer_typ };
      }
    }
  }
  return null;
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

const parsePDFContent = async (filePath) => {
  try {
    const { execSync } = require('child_process');
    const rawText = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf-8', timeout: 30000 });
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    const transaktionen = [];
    const dateRegex = /\b(\d{2})\.(\d{2})\.(\d{2,4})\b/;
    const amountRegex = /([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*[+-]?)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dateMatch = line.match(dateRegex);
      const amountMatch = line.match(amountRegex);
      if (!dateMatch || !amountMatch) continue;

      let [, day, month, year] = dateMatch;
      if (year.length === 2) year = '20' + year;
      const buchungsdatum = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      let amtStr = amountMatch[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
      if (amtStr.endsWith('-')) amtStr = '-' + amtStr.slice(0, -1);
      const betrag = parseFloat(amtStr);
      if (isNaN(betrag) || betrag === 0) continue;

      const descParts = [];
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (!lines[j] || dateRegex.test(lines[j])) break;
        descParts.push(lines[j]);
      }
      const verwendungszweck = descParts.join(' ').trim() || line;

      transaktionen.push({
        buchungsdatum,
        valutadatum: buchungsdatum,
        betrag: Math.abs(betrag),
        waehrung: 'EUR',
        verwendungszweck: verwendungszweck.slice(0, 500),
        auftraggeber_empfaenger: '',
        buchungsart: betrag >= 0 ? 'Einnahme' : 'Ausgabe',
        iban: '',
        bic: ''
      });
    }

    if (transaktionen.length === 0) {
      return { error: 'Keine Buchungen im PDF erkannt. Bitte laden Sie den Kontoauszug als CSV aus dem Online-Banking herunter.' };
    }

    return { transaktionen, bank: 'PDF-Import', format: 'pdf' };
  } catch (e) {
    return { error: 'PDF konnte nicht verarbeitet werden: ' + e.message };
  }
};

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
const generateBelegNummer = async (dojoId, jahr, offset = 0) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT MAX(CAST(SUBSTRING_INDEX(beleg_nummer, '-', -1) AS UNSIGNED)) as max_nr
      FROM buchhaltung_belege
      WHERE dojo_id = ? AND YEAR(buchungsdatum) = ?
    `;
    db.query(sql, [dojoId, jahr], (err, results) => {
      if (err) return reject(err);
      const nextNr = (results[0]?.max_nr || 0) + 1 + offset;
      const belegNummer = `${jahr}-${String(nextNr).padStart(5, '0')}`;
      resolve(belegNummer);
    });
  });
};

// ===================================================================
// 🏦 CAMT.052 / CAMT.053 PARSER (ISO 20022 XML — Holvi, Sparkasse, etc.)
// ===================================================================
const parseCamtContent = (content) => {
  try {
    const doc = xmlConvert(content, { format: 'object' });

    // camt.052 = BkToCstmrAcctRpt / camt.053 = BkToCstmrStmt
    const root = doc?.Document;
    if (!root) return { error: 'Kein gültiges camt-Dokument (fehlendes <Document>)', transaktionen: [] };

    const rptContainer = root.BkToCstmrAcctRpt || root.BkToCstmrStmt;
    if (!rptContainer) return { error: 'Kein BkToCstmrAcctRpt/Stmt Element gefunden', transaktionen: [] };

    // Rpt/Stmt kann ein Objekt oder ein Array von Objekten sein
    const rptRaw = rptContainer.Rpt || rptContainer.Stmt;
    const rpts = Array.isArray(rptRaw) ? rptRaw : [rptRaw];

    const transaktionen = [];

    for (const rpt of rpts) {
      if (!rpt) continue;
      const entries = rpt.Ntry ? (Array.isArray(rpt.Ntry) ? rpt.Ntry : [rpt.Ntry]) : [];

      for (const ntry of entries) {
        // Betrag und Richtung
        const betragRaw = ntry.Amt?.['#'] || ntry.Amt || 0;
        const betrag = parseFloat(String(betragRaw).replace(',', '.')) || 0;
        const isDebit = ntry.CdtDbtInd === 'DBIT';

        // Datum
        const buchDt = ntry.BookgDt?.Dt || ntry.BookgDt?.DtTm?.substring(0, 10) || '';
        const valtDt = ntry.ValDt?.Dt || ntry.ValDt?.DtTm?.substring(0, 10) || buchDt;

        // Transaktionsdetails (können mehrfach vorhanden sein)
        const txDtlsRaw = ntry.NtryDtls?.TxDtls;
        const txDtlsList = txDtlsRaw ? (Array.isArray(txDtlsRaw) ? txDtlsRaw : [txDtlsRaw]) : [{}];
        const tx = txDtlsList[0] || {};

        // Verwendungszweck — alle möglichen Felder kombinieren
        const ustrdRaw = tx.RmtInf?.Ustrd;
        const ustrd = Array.isArray(ustrdRaw) ? ustrdRaw.join(' ') : String(ustrdRaw || '').trim();
        const addtlStrd = (() => {
          const strd = tx.RmtInf?.Strd;
          if (!strd) return '';
          const parts = [];
          const ref = strd.CdtrRefInf?.Ref; if (ref) parts.push(String(ref));
          const addtl = strd.AddtlRmtInf; if (addtl) parts.push(Array.isArray(addtl) ? addtl.join(' ') : String(addtl));
          return parts.join(' ').trim();
        })();
        const purpCd = tx.Purp?.Cd || '';  // SEPA Purpose Code z.B. TAXS, SALA, RENT
        const endToEnd = tx.Refs?.EndToEndId || '';
        const addtlEntry = String(ntry.AddtlNtryInf || ntry.AddtlInf || '').trim();

        // Bevorzuge echten Verwendungszweck über generisches "Ausgehende/Eingehende Zahlung"
        const genericTerms = /^(ausgehende|eingehende|ausführung|sepa|überweisung)\s*(zahlung|auftrag|gutschrift)?$/i;
        const useAddtlEntry = !ustrd || genericTerms.test(ustrd);
        const rawVwz = useAddtlEntry
          ? [ustrd, addtlStrd, purpCd, endToEnd, addtlEntry].filter(Boolean).join(' | ')
          : [ustrd, addtlStrd, purpCd].filter(Boolean).join(' | ');
        const verwendungszweck = rawVwz.replace(/\s*\|\s*$/,'').trim() || addtlEntry;

        // Auftraggeber/Empfänger
        const gegenpartei = isDebit
          ? (tx.RltdPties?.Cdtr?.Nm || tx.RltdPties?.CdtrAcct?.Id?.IBAN || '')
          : (tx.RltdPties?.Dbtr?.Nm || tx.RltdPties?.DbtrAcct?.Id?.IBAN || '');

        // IBAN Gegenkonto
        const ibanGegen = isDebit
          ? (tx.RltdPties?.CdtrAcct?.Id?.IBAN || '')
          : (tx.RltdPties?.DbtrAcct?.Id?.IBAN || '');

        // Buchungstext / Transaktionstyp
        const buchungstext = addtlEntry || tx.RmtInf?.Strd?.CdtrRefInf?.Ref || '';

        if (!buchDt || betrag === 0) continue;

        transaktionen.push({
          buchungsdatum: buchDt,
          valutadatum: valtDt,
          betrag: isDebit ? -Math.abs(betrag) : Math.abs(betrag),
          waehrung: 'EUR',
          verwendungszweck: verwendungszweck || buchungstext,
          auftraggeber_empfaenger: String(gegenpartei).trim(),
          iban_gegenkonto: String(ibanGegen).trim(),
          buchungstext: String(buchungstext).trim(),
        });
      }
    }

    return { transaktionen, bank: 'camt-Import', format: 'camt' };
  } catch (e) {
    return { error: 'camt XML konnte nicht verarbeitet werden: ' + e.message, transaktionen: [] };
  }
};

// Prüfe Super Admin Berechtigung (unverändert, für interne Nutzung)
const requireSuperAdmin = (req, res, next) => {
  const isSuperAdmin =
    req.user?.is_super_admin === true ||
    req.user?.rolle === 'super_admin' ||
    req.user?.role === 'admin' ||
    req.user?.role === 'super_admin' ||
    (req.user?.username === 'admin' && req.user?.dojo_id === null);
  if (isSuperAdmin) { return next(); }
  return res.status(403).json({ message: 'Nur für Super-Admin zugänglich' });
};

// Buchhaltung-Zugriff: Super-Admin ODER Dojo-Admin (buchfuehrung-Feature ab Premium)
const requireBuchhaltungAccess = (req, res, next) => {
  const isSuperAdmin =
    req.user?.is_super_admin === true ||
    req.user?.rolle === 'super_admin' ||
    req.user?.role === 'admin' ||
    req.user?.role === 'super_admin' ||
    (req.user?.username === 'admin' && req.user?.dojo_id === null);
  if (isSuperAdmin) {
    req.buchhaltungDojoId = null; // null = alle Dojos sichtbar (Super-Admin)
    return next();
  }
  const dojoId = req.user?.dojo_id;
  if (!dojoId) return res.status(403).json({ message: 'Kein Zugriff auf Buchhaltung' });
  req.buchhaltungDojoId = dojoId; // Dojo-Admin: nur eigene Daten
  return next();
};

// Baut SQL-Filter: dojo_id für Dojo-Admins, organisation_name für Super-Admin
const buildOrgFilter = (req, organisation) => {
  if (req.buchhaltungDojoId !== null && req.buchhaltungDojoId !== undefined) {
    return { sql: 'AND dojo_id = ?', params: [req.buchhaltungDojoId] };
  }
  if (organisation && organisation !== 'alle') {
    return { sql: 'AND organisation_name = ?', params: [organisation] };
  }
  return { sql: '', params: [] };
};

// Ownership-Check: Gibt 403 wenn Dojo-Admin fremde Daten zugreifen will
const checkDojoOwnership = (req, res, dojoId) => {
  if (req.buchhaltungDojoId !== null && req.buchhaltungDojoId !== undefined
      && parseInt(dojoId) !== parseInt(req.buchhaltungDojoId)) {
    res.status(403).json({ message: 'Keine Berechtigung für diesen Datensatz' });
    return false;
  }
  return true;
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
router.get('/dashboard', requireBuchhaltungAccess, (req, res) => {
  const { organisation, jahr } = req.query;
  const currentYear = jahr || new Date().getFullYear();
  const _df = buildOrgFilter(req, organisation);

  // EÜR Zusammenfassung für Dashboard
  const einnahmenSql = `
    SELECT
      COALESCE(SUM(betrag_brutto), 0) as summe,
      MONTH(datum) as monat
    FROM v_euer_einnahmen
    WHERE jahr = ?
    ${_df.sql}
    GROUP BY MONTH(datum)
    ORDER BY monat
  `;

  const ausgabenSql = `
    SELECT
      COALESCE(SUM(betrag_brutto), 0) as summe,
      MONTH(datum) as monat
    FROM v_euer_ausgaben
    WHERE jahr = ?
    ${_df.sql}
    GROUP BY MONTH(datum)
    ORDER BY monat
  `;

  const params = [currentYear, ..._df.params];

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
router.get('/euer', requireBuchhaltungAccess, (req, res) => {
  const { organisation, jahr, quartal } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  let dateFilter = `jahr = ${db.escape(currentYear)}`;
  if (quartal) {
    const q = parseInt(quartal);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    dateFilter += ` AND monat BETWEEN ${startMonth} AND ${endMonth}`;
  }

  const _of = buildOrgFilter(req, organisation);
  const orgFilter = _of.params.length ? _of.sql.replace('?', db.escape(_of.params[0])) : '';

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
      beschreibung,
      referenz_id
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
      const rawBuchungen = einnahmenDetails
        .filter(d => d.kategorie === row.kategorie && d.quelle === row.quelle);

      // Beiträge: nach Monat aggregieren statt 248 Einzelzeilen
      let einzelbuchungen;
      if (row.quelle === 'Beitrag') {
        const monatsnamen = ['Januar','Februar','März','April','Mai','Juni',
          'Juli','August','September','Oktober','November','Dezember'];
        const byMonth = {};
        rawBuchungen.forEach(d => {
          const dt = new Date(d.datum);
          const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
          if (!byMonth[key]) byMonth[key] = { datum: d.datum, summe: 0, monat: dt.getMonth(), jahr: dt.getFullYear() };
          byMonth[key].summe += parseFloat(d.betrag_brutto);
        });
        einzelbuchungen = Object.values(byMonth)
          .sort((a, b) => a.datum < b.datum ? -1 : 1)
          .map(m => ({
            datum: m.datum,
            betrag: Math.round(m.summe * 100) / 100,
            beschreibung: `Mitgliedsbeiträge ${monatsnamen[m.monat]} ${m.jahr}`,
            drilldown: { typ: 'beitraege', monat: m.monat + 1, jahr: m.jahr, organisation: organisation || 'alle' }
          }));
      } else if (row.quelle === 'Verkauf') {
        einzelbuchungen = rawBuchungen.map(d => ({
          datum: d.datum,
          betrag: parseFloat(d.betrag_brutto),
          beschreibung: d.beschreibung,
          drilldown: { typ: 'verkauf', verkauf_id: d.referenz_id }
        }));
      } else {
        einzelbuchungen = rawBuchungen.map(d => ({
          datum: d.datum,
          betrag: parseFloat(d.betrag_brutto),
          beschreibung: d.beschreibung
        }));
      }

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
// 🔍 GET /api/buchhaltung/euer/beitraege-detail - Einzelne Beiträge eines Monats
// ===================================================================
router.get('/euer/beitraege-detail', requireBuchhaltungAccess, (req, res) => {
  const { jahr, monat, organisation } = req.query;
  if (!jahr || !monat) return res.status(400).json({ message: 'jahr und monat erforderlich' });

  const params = [];
  let dojoFilter = '';

  if (req.buchhaltungDojoId) {
    dojoFilter = 'AND b.dojo_id = ?';
    params.push(req.buchhaltungDojoId);
  } else if (organisation && organisation !== 'alle') {
    const dojoId = organisation === 'TDA International' ? 2 : organisation === 'Kampfkunstschule Schreiner' ? 3 : null;
    if (dojoId) { dojoFilter = 'AND b.dojo_id = ?'; params.push(dojoId); }
  }

  params.push(parseInt(jahr), parseInt(monat));

  db.query(`
    SELECT b.beitrag_id, b.betrag, b.zahlungsdatum, b.zahlungsart,
           COALESCE(m.vorname, 'unbekannt') as vorname,
           COALESCE(m.nachname, '(gelöscht)') as nachname,
           b.mitglied_id
    FROM beitraege b
    LEFT JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
    WHERE b.bezahlt = 1 ${dojoFilter}
      AND YEAR(b.zahlungsdatum) = ? AND MONTH(b.zahlungsdatum) = ?
    ORDER BY nachname, vorname, b.zahlungsdatum
  `, params, (err, rows) => {
    if (err) {
      logger.error('beitraege-detail Fehler:', { error: err.message, sql: err.sql, params });
      return res.status(500).json({ message: err.message });
    }
    res.json(rows);
  });
});

// 🔍 GET /api/buchhaltung/euer/verkauf-detail/:id - Positionen eines Verkaufs
router.get('/euer/verkauf-detail/:id', requireBuchhaltungAccess, (req, res) => {
  const verkaufId = parseInt(req.params.id);
  if (!verkaufId) return res.status(400).json({ message: 'Ungültige Verkauf-ID' });

  db.query(`
    SELECT v.bon_nummer, v.verkauf_datum, v.zahlungsart,
           COALESCE(v.kunde_name, m.vorname, '') as kunde_vorname,
           COALESCE(m.nachname, '') as kunde_nachname,
           v.brutto_gesamt_cent / 100 as gesamt,
           vp.artikel_name, vp.menge, vp.einzelpreis_cent / 100 as einzelpreis,
           vp.brutto_cent / 100 as brutto
    FROM verkaeufe v
    LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
    JOIN verkauf_positionen vp ON v.verkauf_id = vp.verkauf_id
    WHERE v.verkauf_id = ?
    ORDER BY vp.position_nummer
  `, [verkaufId], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!rows.length) return res.status(404).json({ message: 'Verkauf nicht gefunden' });
    res.json({
      bon_nummer: rows[0].bon_nummer,
      datum: rows[0].verkauf_datum,
      zahlungsart: rows[0].zahlungsart,
      kunde: [rows[0].kunde_vorname, rows[0].kunde_nachname].filter(Boolean).join(' ') || 'Laufkunde',
      gesamt: rows[0].gesamt,
      positionen: rows.map(r => ({
        artikel_name: r.artikel_name,
        menge: r.menge,
        einzelpreis: r.einzelpreis,
        brutto: r.brutto
      }))
    });
  });
});

// ===================================================================
// 🤖 POST /api/buchhaltung/belege/ocr - Beleg mit KI auslesen
// ===================================================================
const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilder erlaubt (JPG, PNG, WEBP)'));
    }
  }
});

router.post('/belege/ocr', requireBuchhaltungAccess, ocrUpload.single('bild'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'KI-OCR nicht konfiguriert (ANTHROPIC_API_KEY fehlt)' });

  try {
    const anthropic = new Anthropic({ apiKey });
    const base64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          {
            type: 'text',
            text: `Analysiere diesen Kassenbon oder Beleg und extrahiere die Daten als JSON.

Felder:
- betrag_brutto: Gesamtbetrag inkl. MwSt als Zahl (z.B. 12.99). Falls mehrere Beträge: Endbetrag/Summe nehmen.
- mwst_satz: Mehrwertsteuersatz in % (19, 7 oder 0). Falls unklar: 19.
- datum: Datum im Format YYYY-MM-DD. Falls kein Jahr erkennbar: aktuelles Jahr annehmen.
- lieferant: Name des Geschäfts oder Lieferanten (max 60 Zeichen).
- beschreibung: Was wurde gekauft — kurz, prägnant (max 80 Zeichen, auf Deutsch).
- buchungsart: "ausgabe" (Standard) oder "einnahme".

Antworte NUR mit dem JSON-Objekt, ohne Markdown, ohne Erklärung.
Falls ein Wert absolut nicht erkennbar ist: null verwenden.

Beispiel: {"betrag_brutto":24.99,"mwst_satz":19,"datum":"2026-05-06","lieferant":"REWE","beschreibung":"Lebensmittel / Büromaterial","buchungsart":"ausgabe"}`
          }
        ]
      }]
    });

    const raw = response.content[0]?.text?.trim() || '{}';
    let parsed = {};
    try {
      // Claude antwortet manchmal mit ```json ... ``` — bereinigen
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({ error: 'KI konnte keinen strukturierten Text extrahieren', raw });
    }

    // Sanity checks
    const result = {
      betrag_brutto: typeof parsed.betrag_brutto === 'number' && parsed.betrag_brutto > 0 ? parsed.betrag_brutto : null,
      mwst_satz: [0, 7, 19].includes(Number(parsed.mwst_satz)) ? Number(parsed.mwst_satz) : 19,
      datum: parsed.datum && /^\d{4}-\d{2}-\d{2}$/.test(parsed.datum) ? parsed.datum : new Date().toISOString().split('T')[0],
      lieferant: typeof parsed.lieferant === 'string' ? parsed.lieferant.substring(0, 60) : '',
      beschreibung: typeof parsed.beschreibung === 'string' ? parsed.beschreibung.substring(0, 80) : '',
      buchungsart: parsed.buchungsart === 'einnahme' ? 'einnahme' : 'ausgabe',
    };

    res.json(result);
  } catch (err) {
    logger.error('OCR-Fehler', { error: err.message });
    res.status(500).json({ error: 'KI-Analyse fehlgeschlagen: ' + err.message });
  }
});

// ===================================================================
// 📋 GET /api/buchhaltung/belege - Alle Belege abrufen
// ===================================================================
router.get('/belege', requireBuchhaltungAccess, (req, res) => {
  const { organisation, jahr, kategorie, buchungsart, seite = 1, limit = 50 } = req.query;
  const offset = (parseInt(seite) - 1) * parseInt(limit);

  let whereClause = '1=1';
  const params = [];

  const _orgFilter = buildOrgFilter(req, organisation);
  if (_orgFilter.sql) {
    whereClause += ' ' + _orgFilter.sql;
    params.push(..._orgFilter.params);
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
router.post('/belege', requireBuchhaltungAccess, async (req, res) => {
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
      rechnungsnummer_extern,
      ist_gwg = 0,
      privatanteil_prozent = 0
    } = req.body;

    // Validierung
    if (!(organisation_name || req.buchhaltungDojoId) || !buchungsart || !beleg_datum || !betrag_netto || !kategorie || !beschreibung) {
      return res.status(400).json({ message: 'Pflichtfelder fehlen' });
    }

    // Berechne MwSt und Brutto
    const netto = parseFloat(betrag_netto);
    const mwst = parseFloat(mwst_satz);
    const mwstBetrag = Math.round(netto * (mwst / 100) * 100) / 100;
    const brutto = Math.round((netto + mwstBetrag) * 100) / 100;

    // Dojo ID: Dojo-Admin nutzt eigene dojo_id, Super-Admin nutzt Organisation
    const _orgMapBeleg = { 'TDA International': 2, 'Kampfkunstschule Schreiner': 3 };
    const dojoId = req.buchhaltungDojoId || _orgMapBeleg[organisation_name] || null;
    const effectiveOrgName = organisation_name || `Dojo ${dojoId}`;
    const jahr = new Date(buchungsdatum || beleg_datum).getFullYear();

    // Generiere Belegnummer
    const belegNummer = await generateBelegNummer(dojoId, jahr);

    const sql = `
      INSERT INTO buchhaltung_belege (
        beleg_nummer, dojo_id, organisation_name, buchungsart,
        beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
        kategorie, beschreibung, lieferant_kunde, rechnungsnummer_extern, ist_gwg, privatanteil_prozent, erstellt_von
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      ist_gwg ? 1 : 0,
      parseFloat(privatanteil_prozent) || 0,
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
router.put('/belege/:id', requireBuchhaltungAccess, (req, res) => {
  const belegId = req.params.id;

  // Erst prüfen ob festgeschrieben
  db.query('SELECT * FROM buchhaltung_belege WHERE beleg_id = ?', [belegId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'Beleg nicht gefunden' });
    }

    const beleg = results[0];
    if (!checkDojoOwnership(req, res, beleg.dojo_id)) return;
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
      rechnungsnummer_extern,
      ist_gwg,
      privatanteil_prozent
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
        ist_gwg = ?,
        privatanteil_prozent = ?,
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
      ist_gwg !== undefined ? (ist_gwg ? 1 : 0) : beleg.ist_gwg,
      privatanteil_prozent !== undefined ? (parseFloat(privatanteil_prozent)||0) : beleg.privatanteil_prozent,
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
router.post('/belege/:id/upload', requireBuchhaltungAccess, upload.single('datei'), (req, res) => {
  const belegId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ message: 'Keine Datei hochgeladen' });
  }

  // Erst prüfen ob festgeschrieben
  db.query('SELECT festgeschrieben, dojo_id FROM buchhaltung_belege WHERE beleg_id = ?', [belegId], (err, results) => {
    if (err || results.length === 0) {
      // Lösche hochgeladene Datei wieder
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Beleg nicht gefunden' });
    }

    if (!checkDojoOwnership(req, res, results[0].dojo_id)) { fs.unlinkSync(req.file.path); return; }
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
router.get('/belege/:id/datei', requireBuchhaltungAccess, (req, res) => {
  const belegId = req.params.id;

  db.query('SELECT datei_pfad, datei_name, datei_typ, dojo_id FROM buchhaltung_belege WHERE beleg_id = ?', [belegId], (err, results) => {
    if (err || results.length === 0 || !results[0].datei_pfad) {
      return res.status(404).json({ message: 'Datei nicht gefunden' });
    }

    if (!checkDojoOwnership(req, res, results[0].dojo_id)) return;
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
// 📎 POST /api/buchhaltung/bank-import/transaktion/:id/upload
// ===================================================================
router.post('/bank-import/transaktion/:id/upload', requireFeature('kontoauszug'), requireBuchhaltungAccess, upload.single('datei'), async (req, res) => {
  const txId = parseInt(req.params.id);
  if (!req.file) return res.status(400).json({ message: 'Keine Datei hochgeladen' });

  try {
    const pool = db.promise();
    const dojoId = req.buchhaltungDojoId;

    const [rows] = await pool.query(
      'SELECT transaktion_id, dojo_id FROM bank_transaktionen WHERE transaktion_id = ?', [txId]
    );
    if (!rows.length) { fs.unlinkSync(req.file.path); return res.status(404).json({ message: 'Transaktion nicht gefunden' }); }
    if (dojoId && rows[0].dojo_id !== dojoId) { fs.unlinkSync(req.file.path); return res.status(403).json({ message: 'Keine Berechtigung' }); }

    // Alte Datei löschen wenn vorhanden
    const [oldRows] = await pool.query('SELECT datei_pfad FROM bank_transaktionen WHERE transaktion_id = ?', [txId]);
    if (oldRows[0]?.datei_pfad && fs.existsSync(oldRows[0].datei_pfad)) {
      try { fs.unlinkSync(oldRows[0].datei_pfad); } catch {}
    }

    await pool.query(`
      UPDATE bank_transaktionen SET
        datei_pfad = ?, datei_name = ?, datei_typ = ?, datei_groesse = ?
      WHERE transaktion_id = ?
    `, [req.file.path, req.file.originalname, req.file.mimetype, req.file.size, txId]);

    res.json({ message: 'Anhang hochgeladen', datei_name: req.file.originalname });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ message: 'Upload fehlgeschlagen', error: err.message });
  }
});

// ===================================================================
// 📥 GET /api/buchhaltung/bank-import/transaktion/:id/datei
// ===================================================================
router.get('/bank-import/transaktion/:id/datei', requireBuchhaltungAccess, async (req, res) => {
  const txId = parseInt(req.params.id);
  try {
    const pool = db.promise();
    const dojoId = req.buchhaltungDojoId;
    const [rows] = await pool.query(
      'SELECT datei_pfad, datei_name, datei_typ, dojo_id FROM bank_transaktionen WHERE transaktion_id = ?', [txId]
    );
    if (!rows.length || !rows[0].datei_pfad) return res.status(404).json({ message: 'Keine Datei vorhanden' });
    if (dojoId && rows[0].dojo_id !== dojoId) return res.status(403).json({ message: 'Keine Berechtigung' });
    const { datei_pfad, datei_name, datei_typ } = rows[0];
    if (!fs.existsSync(datei_pfad)) return res.status(404).json({ message: 'Datei nicht mehr vorhanden' });
    res.setHeader('Content-Type', datei_typ);
    res.setHeader('Content-Disposition', `inline; filename="${datei_name}"`);
    res.sendFile(datei_pfad);
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// ===================================================================
// 🗑️ DELETE /api/buchhaltung/bank-import/transaktion/:id/datei
// ===================================================================
router.delete('/bank-import/transaktion/:id/datei', requireBuchhaltungAccess, async (req, res) => {
  const txId = parseInt(req.params.id);
  try {
    const pool = db.promise();
    const dojoId = req.buchhaltungDojoId;
    const [rows] = await pool.query(
      'SELECT datei_pfad, dojo_id FROM bank_transaktionen WHERE transaktion_id = ?', [txId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Nicht gefunden' });
    if (dojoId && rows[0].dojo_id !== dojoId) return res.status(403).json({ message: 'Keine Berechtigung' });
    if (rows[0].datei_pfad && fs.existsSync(rows[0].datei_pfad)) {
      try { fs.unlinkSync(rows[0].datei_pfad); } catch {}
    }
    await pool.query(
      'UPDATE bank_transaktionen SET datei_pfad=NULL, datei_name=NULL, datei_typ=NULL, datei_groesse=NULL WHERE transaktion_id=?', [txId]
    );
    res.json({ message: 'Anhang gelöscht' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// ===================================================================
// 🔒 POST /api/buchhaltung/belege/:id/festschreiben - Beleg festschreiben
// ===================================================================
router.post('/belege/:id/festschreiben', requireBuchhaltungAccess, (req, res) => {
  const belegId = req.params.id;

  db.query(
    `UPDATE buchhaltung_belege SET
      festgeschrieben = TRUE,
      festgeschrieben_am = NOW(),
      festgeschrieben_von = ?
    WHERE beleg_id = ? AND (? IS NULL OR dojo_id = ?) AND festgeschrieben = FALSE`,
    [req.user?.id || 1, belegId, req.buchhaltungDojoId ?? null, req.buchhaltungDojoId ?? null],
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
router.post('/belege/:id/stornieren', requireBuchhaltungAccess, (req, res) => {
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
    WHERE beleg_id = ? AND (? IS NULL OR dojo_id = ?) AND storniert = FALSE`,
    [grund, req.user?.id || 1, belegId, req.buchhaltungDojoId ?? null, req.buchhaltungDojoId ?? null],
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
router.get('/einnahmen-auto', requireBuchhaltungAccess, (req, res) => {
  const { organisation, jahr, monat, seite = 1, limit = 50 } = req.query;
  const currentYear = jahr || new Date().getFullYear();
  const offset = (parseInt(seite) - 1) * parseInt(limit);

  let whereClause = `jahr = ${db.escape(currentYear)}`;
  const _wof = buildOrgFilter(req, organisation);
  if (_wof.sql) {
    if (_wof.params.length) whereClause += ` ${_wof.sql.replace('?', db.escape(_wof.params[0]))}`;
    else whereClause += ` ${_wof.sql}`;
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
router.get('/abschluss/:jahr', requireBuchhaltungAccess, (req, res) => {
  const { jahr } = req.params;
  const { organisation } = req.query;

  const _of = buildOrgFilter(req, organisation);
  const orgFilter = _of.params.length ? _of.sql.replace('?', db.escape(_of.params[0])) : '';

  // Prüfe ob Abschluss existiert
  const abschlussSql = `
    SELECT * FROM euer_abschluesse
    WHERE jahr = ? ${orgFilter}
  `;

  db.query(abschlussSql, [jahr], (err, abschlussResults) => {
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
router.post('/abschluss/:jahr/festschreiben', requireBuchhaltungAccess, (req, res) => {
  const { jahr } = req.params;
  const { organisation } = req.body;

  // Für Dojo-Admin: organisation aus dojo_id ableiten; Super-Admin: organisation aus Body
  const _orgMapDel = { 'TDA International': 2, 'Kampfkunstschule Schreiner': 3 };
  const dojoId = req.buchhaltungDojoId || _orgMapDel[organisation] || null;
  if (!dojoId) return res.status(400).json({ message: 'Organisation oder dojo_id erforderlich' });

  // Erst alle nicht-festgeschriebenen Belege des Jahres festschreiben
  const festschreibenBelegeSql = `
    UPDATE buchhaltung_belege SET
      festgeschrieben = TRUE,
      festgeschrieben_am = NOW(),
      festgeschrieben_von = ?
    WHERE YEAR(buchungsdatum) = ? AND dojo_id = ? AND festgeschrieben = FALSE
  `;

  db.query(festschreibenBelegeSql, [req.user?.id || 1, jahr, dojoId], (err, belegeResult) => {
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

    const orgName = organisation || `Dojo ${dojoId}`;
    db.query(upsertSql, [dojoId, orgName, jahr, req.user?.id || 1, req.user?.id || 1], (err) => {
      if (err) {
        console.error('Abschluss-Festschreiben-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Erstellen des Abschlusses' });
      }

      res.json({
        message: `Jahresabschluss ${jahr} erfolgreich festgeschrieben`,
        belege_festgeschrieben: belegeResult.affectedRows
      });
    });
  });
});

// ===================================================================
// 📤 GET /api/buchhaltung/abschluss/:jahr/export - CSV Export
// ===================================================================
router.get('/abschluss/:jahr/export', requireBuchhaltungAccess, (req, res) => {
  const { jahr } = req.params;
  const { organisation, format = 'csv' } = req.query;

  const _of = buildOrgFilter(req, organisation);
  const orgFilter = _of.params.length ? _of.sql.replace('?', db.escape(_of.params[0])) : '';

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
    const _orgMapExp = { 'TDA International': 2, 'Kampfkunstschule Schreiner': 3 };
    const _exportDojoId = req.buchhaltungDojoId || _orgMapExp[organisation] || null;
    if (_exportDojoId) {
      db.query(
        `UPDATE euer_abschluesse SET letzter_export_datum = NOW(), letzter_export_format = ? WHERE dojo_id = ? AND jahr = ?`,
        [format, _exportDojoId, jahr]
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
router.get('/kategorien', requireBuchhaltungAccess, (req, res) => {
  const kategorien = [
    { id: 'betriebseinnahmen', name: 'Betriebseinnahmen', typ: 'einnahme', beschreibung: 'Umsatzerlöse, Mitgliedsbeiträge' },
    { id: 'wareneingang', name: 'Wareneingang', typ: 'ausgabe', beschreibung: 'Einkauf Artikel, Material' },
    { id: 'personalkosten', name: 'Personalkosten', typ: 'ausgabe', beschreibung: 'Löhne, Gehälter, Sozialabgaben' },
    { id: 'raumkosten', name: 'Raumkosten', typ: 'ausgabe', beschreibung: 'Miete, Nebenkosten, Reinigung' },
    { id: 'versicherungen', name: 'Versicherungen', typ: 'ausgabe', beschreibung: 'Haftpflicht, Unfallversicherung' },
    { id: 'kfz_kosten', name: 'KFZ-Kosten', typ: 'ausgabe', beschreibung: 'Fahrzeugkosten, Kraftstoff, KFZ-Versicherung, TÜV' },
    { id: 'werbekosten', name: 'Werbekosten', typ: 'ausgabe', beschreibung: 'Marketing, Flyer, Online-Werbung' },
    { id: 'reisekosten', name: 'Reisekosten', typ: 'ausgabe', beschreibung: 'Fahrten, Übernachtungen' },
    { id: 'telefon_internet', name: 'Telefon/Internet', typ: 'ausgabe', beschreibung: 'Kommunikationskosten' },
    { id: 'software', name: 'Software / IT', typ: 'ausgabe', beschreibung: 'Software, Lizenzen, Hosting' },
    { id: 'buerokosten', name: 'Bürokosten', typ: 'ausgabe', beschreibung: 'Büromaterial, Porto' },
    { id: 'fortbildung', name: 'Fortbildung', typ: 'ausgabe', beschreibung: 'Seminare, Weiterbildung' },
    { id: 'abschreibungen', name: 'Abschreibungen', typ: 'ausgabe', beschreibung: 'AfA auf Anlagegüter' },
    { id: 'bankgebuehren', name: 'Kontoführungsgebühren', typ: 'ausgabe', beschreibung: 'Bankgebühren, Kontoführung, Kartengebühren' },
    { id: 'ausstattung', name: 'Betriebs-/Geschäftsausstattung', typ: 'ausgabe', beschreibung: 'Geräte, Ausrüstung, Equipment (bis 800€ netto)' },
    { id: 'sonstige_kosten', name: 'Sonstige Kosten', typ: 'ausgabe', beschreibung: 'Sonstige betriebliche Aufwendungen' },
    { id: 'privateinlage', name: 'Privateinlage', typ: 'privat', beschreibung: 'Private Einzahlung (kein Umsatz)' },
    { id: 'privatentnahme', name: 'Privatentnahme', typ: 'privat', beschreibung: 'Private Entnahme (keine Ausgabe)' },
    { id: 'steuerzahlungen', name: 'Steuerzahlungen / Finanzamt', typ: 'ausgabe', beschreibung: 'USt, ESt, GewSt, Vorauszahlungen' },
    { id: 'anlagevermögen', name: 'Anlagevermögen (Kauf / Rate)', typ: 'ausgabe', beschreibung: 'Kauf eines Anlageguts — AfA wird separat im Anlagenregister berechnet' }
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
router.post('/bank-import/upload', requireFeature('kontoauszug'), requireBuchhaltungAccess, bankUpload.single('datei'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Keine Datei hochgeladen' });
    }

    const { organisation = 'Kampfkunstschule Schreiner', format: requestedFormat } = req.body;
    const orgDojoMap = { 'TDA International': 2, 'Kampfkunstschule Schreiner': 3 };
    const dojoId = req.buchhaltungDojoId || orgDojoMap[organisation] || null;
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

    // Bestimme Format (PDF, Excel, camt XML, MT940 oder CSV)
    let parseResult;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isPDF = ext === '.pdf' || req.file.mimetype === 'application/pdf';
    const isExcel = ext === '.xls' || ext === '.xlsx';
    const isCamt = ext === '.xml' || req.file.mimetype === 'text/xml' || req.file.mimetype === 'application/xml'
      || (content && content.includes('<BkToCstmrAcctRpt') || content?.includes('<BkToCstmrStmt'));
    const isMT940 = ext === '.sta' || ext === '.mt940' || (content && content.includes(':20:') && content.includes(':61:'));

    if (isPDF) {
      parseResult = await parsePDFContent(req.file.path);
    } else if (isExcel) {
      parseResult = await parseExcelContent(req.file.path);
    } else if (isCamt || requestedFormat === 'camt') {
      parseResult = parseCamtContent(content);
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

    // Auto-Kategorisierung + Auto-Matching für alle neuen Transaktionen
    let autoKatCount = 0;
    for (const tx of insertedTransactions) {
      // Auto-Kategorisierung anwenden
      const kat = autoKategorisieren(tx.verwendungszweck, tx.auftraggeber_empfaenger);
      if (kat) {
        await new Promise((resolve) => {
          db.query(
            `UPDATE bank_transaktionen
             SET auto_kategorie = ?, auto_kategorie_typ = ?, auto_kategorie_euer = ?
             WHERE transaktion_id = ?`,
            [kat.kategorie, kat.typ, kat.euer_typ, tx.transaktion_id],
            () => resolve()
          );
        });
        autoKatCount++;
      }
      // Bestehendes Auto-Matching (Rechnungsabgleich etc.)
      await runAutoMatching(tx.transaktion_id, dojoId);
    }

    res.json({
      message: 'Import erfolgreich',
      import_id: importId,
      bank: parseResult.bank,
      format: isExcel ? 'excel' : (isMT940 ? 'mt940' : 'csv'),
      count: insertedCount,
      duplikate: duplicateCount,
      gesamt: parseResult.transaktionen.length,
      auto_kategorisiert: autoKatCount
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

      // 3b. Verkaufs-Matching: Barverkauf / Kartenzahlung (Einnahmen, Betrag + Datum ±1 Tag)
      if (!bestMatch && isEinnahme) {
        const verkaufe = await new Promise((resolve) => {
          db.query(`
            SELECT v.verkauf_id, v.bon_nummer, v.brutto_gesamt_cent, v.verkauf_datum,
                   v.zahlungsart, v.kunde_name
            FROM verkaeufe v
            WHERE v.dojo_id = ?
              AND ABS(v.brutto_gesamt_cent / 100.0 - ?) < 0.02
              AND ABS(DATEDIFF(v.verkauf_datum, ?)) <= 2
              AND v.storniert = 0
            ORDER BY ABS(DATEDIFF(v.verkauf_datum, ?)) ASC
            LIMIT 1
          `, [dojoId, betrag, tx.buchungsdatum, tx.buchungsdatum], (err, results) => {
            resolve(err ? [] : results);
          });
        });
        if (verkaufe.length > 0) {
          bestMatch = {
            typ: 'verkauf',
            id: verkaufe[0].verkauf_id,
            details: {
              bon_nummer: verkaufe[0].bon_nummer,
              betrag: verkaufe[0].brutto_gesamt_cent / 100,
              zahlungsart: verkaufe[0].zahlungsart,
              kunde: verkaufe[0].kunde_name,
              datum: verkaufe[0].verkauf_datum,
            }
          };
          bestConfidence = 0.82;
        }
      }

      // 3c. Verbandsbeitrag-Matching (Ausgaben)
      if (!bestMatch && !isEinnahme) {
        const searchText = verwendungszweck + ' ' + auftraggeber;
        const isVerbandsbeitrag = /tda|verband|djb|djjv|dkv|jjv|landesverband/i.test(searchText);
        if (isVerbandsbeitrag) {
          bestMatch = {
            typ: 'verbandsbeitrag',
            id: null,
            details: { hinweis: 'Verbandsbeitrag erkannt', text: auftraggeber }
          };
          bestConfidence = 0.72;
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
router.get('/bank-import/transaktionen', requireFeature('kontoauszug'), requireBuchhaltungAccess, (req, res) => {
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

  const _orgFilter = buildOrgFilter(req, organisation);
  if (_orgFilter.sql) {
    whereClause += ' ' + _orgFilter.sql;
    params.push(..._orgFilter.params);
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
      beleg_id, zugeordnet_am, datei_name, datei_typ
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
router.get('/bank-import/statistik', requireFeature('kontoauszug'), requireBuchhaltungAccess, (req, res) => {
  const { organisation } = req.query;

  let whereClause = '1=1';
  const params = [];

  const _orgFilter = buildOrgFilter(req, organisation);
  if (_orgFilter.sql) {
    whereClause += ' ' + _orgFilter.sql;
    params.push(..._orgFilter.params);
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
// 🔍 GET /api/buchhaltung/bank-import/aehnliche/:id
// Liefert Anzahl ähnlicher unzugeordneter Transaktionen (für Modal-Vorschau)
// ===================================================================
router.get('/bank-import/aehnliche/:id', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const txRows = await new Promise((resolve, reject) => {
      db.query('SELECT dojo_id, auftraggeber_empfaenger, betrag FROM bank_transaktionen WHERE transaktion_id = ?',
        [id], (err, r) => { if (err) reject(err); else resolve(r); });
    });
    if (!txRows.length) return res.status(404).json({ anzahl: 0 });
    const tx = txRows[0];
    if (!tx.auftraggeber_empfaenger) return res.json({ anzahl: 0, auftraggeber: '' });

    const pattern = tx.auftraggeber_empfaenger.substring(0, 50).replace(/[%_\\]/g, '\\$&');
    const rows = await new Promise((resolve, reject) => {
      db.query(
        `SELECT COUNT(*) AS anzahl FROM bank_transaktionen
         WHERE dojo_id = ? AND transaktion_id != ?
           AND status IN ('unzugeordnet','vorgeschlagen')
           AND (match_typ IS NULL OR match_typ NOT IN ('rechnung','beitrag','verkauf'))
           AND LOWER(auftraggeber_empfaenger) LIKE LOWER(?)`,
        [tx.dojo_id, id, `%${pattern}%`],
        (err, r) => { if (err) reject(err); else resolve(r); }
      );
    });
    res.json({ anzahl: rows[0]?.anzahl || 0, auftraggeber: tx.auftraggeber_empfaenger });
  } catch (err) {
    res.status(500).json({ anzahl: 0 });
  }
});

// ===================================================================
// ✅ POST /api/buchhaltung/bank-import/zuordnen/:id - Transaktion zuordnen
// ===================================================================
router.post('/bank-import/zuordnen/:id', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const transaktionId = req.params.id;
    const { kategorie, match_typ, match_id, lerne_regel = false, mwst_satz: mwstRaw } = req.body;

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
    if (!checkDojoOwnership(req, res, tx.dojo_id)) return;
    const buchungsart = tx.betrag > 0 ? 'einnahme' : 'ausgabe';

    // MwSt berechnen
    const mwstSatz = parseFloat(mwstRaw ?? 0);
    const brutto = Math.abs(tx.betrag);
    const netto = mwstSatz > 0 ? brutto / (1 + mwstSatz / 100) : brutto;
    const mwstBetrag = brutto - netto;

    // Erstelle Buchhaltungs-Beleg
    const jahr = new Date(tx.buchungsdatum).getFullYear();
    const belegNummer = await generateBelegNummer(tx.dojo_id, jahr);

    const belegResult = await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO buchhaltung_belege (
          beleg_nummer, dojo_id, organisation_name, buchungsart,
          beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
          kategorie, beschreibung, lieferant_kunde, erstellt_von
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        belegNummer,
        tx.dojo_id,
        tx.organisation_name,
        buchungsart,
        tx.buchungsdatum,
        tx.buchungsdatum,
        parseFloat(netto.toFixed(2)),
        mwstSatz,
        parseFloat(mwstBetrag.toFixed(2)),
        brutto,
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

    // Regel immer speichern (für künftige Importe)
    if (tx.auftraggeber_empfaenger) {
      await new Promise((resolve) => {
        db.query(`
          INSERT INTO bank_zuordnung_regeln
            (dojo_id, match_feld, match_wert, match_typ, kategorie, erstellt_von)
          VALUES (?, 'auftraggeber', ?, 'enthält', ?, ?)
          ON DUPLICATE KEY UPDATE kategorie = VALUES(kategorie), erstellt_von = VALUES(erstellt_von)
        `, [tx.dojo_id, tx.auftraggeber_empfaenger.substring(0, 100), kategorie, req.user?.id || 1],
        () => resolve()); // immer resolve, Fehler ignorieren
      });
    }

    // Alle anderen unzugeordneten Transaktionen vom gleichen Auftraggeber automatisch zuordnen
    let autoZugeordnet = 0;
    if (tx.auftraggeber_empfaenger) {
      const auftraggerberPattern = tx.auftraggeber_empfaenger.substring(0, 50).replace(/[%_\\]/g, '\\$&');
      const aehnliche = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM bank_transaktionen
           WHERE dojo_id = ? AND transaktion_id != ?
             AND status IN ('unzugeordnet','vorgeschlagen')
             AND (match_typ IS NULL OR match_typ NOT IN ('rechnung','beitrag','verkauf'))
             AND LOWER(auftraggeber_empfaenger) LIKE LOWER(?)`,
          [tx.dojo_id, transaktionId, `%${auftraggerberPattern}%`],
          (err, rows) => { if (err) reject(err); else resolve(rows); }
        );
      });

      logger.info(`Auto-Zuordnung: ${aehnliche.length} ähnliche TX für Auftraggeber "${tx.auftraggeber_empfaenger}"`);

      for (const aTx of aehnliche) {
        try {
          const aBuchungsart = parseFloat(aTx.betrag) > 0 ? 'einnahme' : 'ausgabe';
          const aJahr = new Date(aTx.buchungsdatum).getFullYear();
          // offset +1 weil primary bereits +0 verwendet hat; autoZugeordnet zählt erfolgreiche
          const aBelegNr = await generateBelegNummer(aTx.dojo_id, aJahr, autoZugeordnet + 1);

          const aBelegResult = await new Promise((resolve, reject) => {
            db.query(
              `INSERT INTO buchhaltung_belege
                (beleg_nummer, dojo_id, organisation_name, buchungsart,
                 beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
                 kategorie, beschreibung, lieferant_kunde, erstellt_von)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
              [
                aBelegNr,
                aTx.dojo_id,
                aTx.organisation_name || null,
                aBuchungsart,
                aTx.buchungsdatum,
                aTx.buchungsdatum,
                Math.abs(parseFloat(aTx.betrag)),
                Math.abs(parseFloat(aTx.betrag)),
                kategorie,
                aTx.verwendungszweck || 'Bank-Import (Auto)',
                aTx.auftraggeber_empfaenger || null,
                req.user?.id || 1
              ],
              (err, r) => { if (err) reject(err); else resolve(r); }
            );
          });

          await new Promise((resolve, reject) => {
            db.query(
              `UPDATE bank_transaktionen SET
                 status = 'zugeordnet', kategorie = ?, match_typ = 'manuell',
                 beleg_id = ?, zugeordnet_von = ?, zugeordnet_am = NOW()
               WHERE transaktion_id = ?`,
              [kategorie, aBelegResult.insertId, req.user?.id || 1, aTx.transaktion_id],
              (err) => { if (err) reject(err); else resolve(); }
            );
          });
          autoZugeordnet++;
        } catch (autoErr) {
          logger.error(`Auto-Zuordnung Fehler TX ${aTx.transaktion_id}: ${autoErr.message}`);
        }
      }
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
      beleg_nummer: belegNummer,
      auto_zugeordnet: autoZugeordnet
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
router.post('/bank-import/rechnung-verknuepfen/:id', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
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
router.get('/bank-import/offene-rechnungen', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
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
router.post('/bank-import/batch-zuordnen', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
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
router.post('/bank-import/ignorieren/:id', requireFeature('kontoauszug'), requireBuchhaltungAccess, (req, res) => {
  const transaktionId = req.params.id;
  const { lerne_regel = false } = req.body;

  db.query('SELECT * FROM bank_transaktionen WHERE transaktion_id = ?', [transaktionId], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'Transaktion nicht gefunden' });
    }

    const tx = results[0];
    if (!checkDojoOwnership(req, res, tx.dojo_id)) return;

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
router.post('/bank-import/umbuchen/:id', requireFeature('kontoauszug'), requireBuchhaltungAccess, (req, res) => {
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
    if (!checkDojoOwnership(req, res, tx.dojo_id)) return;

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
router.post('/bank-import/vorschlag-annehmen/:id', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
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
    if (!checkDojoOwnership(req, res, tx.dojo_id)) return;
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

    // Beitrag/Rechnung/Verkauf-Matches brauchen keinen eigenen Beleg — die erscheinen
    // bereits über ihren eigenen EÜR-Branch. Nur Status auf 'zugeordnet' setzen.
    const euerManagedTypes = ['beitrag', 'rechnung', 'verkauf'];
    if (euerManagedTypes.includes(tx.match_typ)) {
      const kategorie = mapZuBelegeKategorie(matchDetails?.kategorie, matchDetails?.euer_typ, tx.betrag);
      await new Promise((resolve, reject) => {
        db.query(`
          UPDATE bank_transaktionen SET
            status = 'zugeordnet',
            kategorie = ?,
            zugeordnet_von = ?,
            zugeordnet_am = NOW()
          WHERE transaktion_id = ?
        `, [kategorie, req.user?.id || 1, transaktionId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.json({ message: 'Vorschlag angenommen', match_typ: tx.match_typ });
    }

    // Alle anderen Match-Typen: Beleg erstellen
    const buchungsart = tx.betrag > 0 ? 'einnahme' : 'ausgabe';
    const kategorie = mapZuBelegeKategorie(matchDetails?.kategorie, matchDetails?.euer_typ, tx.betrag);
    const jahr = new Date(tx.buchungsdatum).getFullYear();
    const belegNummer = await generateBelegNummer(tx.dojo_id, jahr);

    const mwstSatz = parseFloat(req.body?.mwst_satz ?? 0);
    const brutto = Math.abs(tx.betrag);
    const netto = mwstSatz > 0 ? brutto / (1 + mwstSatz / 100) : brutto;
    const mwstBetrag = brutto - netto;

    const belegResult = await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO buchhaltung_belege (
          beleg_nummer, dojo_id, organisation_name, buchungsart,
          beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
          kategorie, beschreibung, lieferant_kunde, erstellt_von
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        belegNummer,
        tx.dojo_id,
        tx.organisation_name,
        buchungsart,
        tx.buchungsdatum,
        tx.buchungsdatum,
        parseFloat(netto.toFixed(2)),
        mwstSatz,
        parseFloat(mwstBetrag.toFixed(2)),
        brutto,
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
// 🤖 POST /api/buchhaltung/bank-import/auto-alle-vorschlagen
// Läuft Auto-Kategorisierung + gelernte Regeln auf alle offenen Transaktionen
// ===================================================================
router.post('/bank-import/auto-alle-vorschlagen', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { organisation } = req.query;
    const orgFilter = buildOrgFilter(req, organisation);
    const whereExtra = orgFilter.sql ? orgFilter.sql : '';
    const whereParams = orgFilter.params || [];

    // Alle unzugeordneten Transaktionen holen
    const txList = await new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM bank_transaktionen WHERE status = 'unzugeordnet' ${whereExtra}`,
        whereParams, (err, results) => err ? reject(err) : resolve(results)
      );
    });

    if (txList.length === 0) {
      return res.json({ message: 'Keine offenen Transaktionen', count: 0 });
    }

    let vorgeschlagenCount = 0;

    for (const tx of txList) {
      try {
        // 1. Gelernte Regeln prüfen (runAutoMatching setzt status='vorgeschlagen' wenn Match)
        await runAutoMatching(tx.transaktion_id, tx.dojo_id);

        // Nach runAutoMatching prüfen ob bereits vorgeschlagen
        const afterMatch = await new Promise((resolve) => {
          db.query('SELECT status FROM bank_transaktionen WHERE transaktion_id = ?',
            [tx.transaktion_id], (err, r) => resolve(r?.[0] || tx));
        });

        if (afterMatch.status === 'vorgeschlagen') {
          vorgeschlagenCount++;
          continue;
        }

        // 2. Keyword-basierte Auto-Kategorisierung
        const kat = autoKategorisieren(tx.verwendungszweck, tx.auftraggeber_empfaenger);

        // 3. Fallback: immer einen Vorschlag machen basierend auf Betrag-Vorzeichen
        const vorschlag = kat || (tx.betrag > 0
          ? { kategorie: 'Betriebseinnahmen', typ: 'einnahme', euer_typ: 'betriebseinnahme' }
          : { kategorie: 'Sonstige Kosten', typ: 'ausgabe', euer_typ: 'betriebsausgabe' });
        const confidence = kat ? 0.65 : 0.30;

        await new Promise((resolve, reject) => {
          db.query(`
            UPDATE bank_transaktionen SET
              status = 'vorgeschlagen',
              match_typ = 'manuell',
              match_confidence = ?,
              match_details = ?
            WHERE transaktion_id = ? AND status = 'unzugeordnet'
          `, [
            confidence,
            JSON.stringify({ kategorie: vorschlag.kategorie, typ: vorschlag.typ, euer_typ: vorschlag.euer_typ, quelle: kat ? 'auto_kategorie' : 'fallback' }),
            tx.transaktion_id
          ], (err) => err ? reject(err) : resolve());
        });
        vorgeschlagenCount++;
      } catch (txErr) {
        logger.error('Auto-Vorschlag Transaktion Fehler:', { error: txErr, id: tx.transaktion_id });
      }
    }

    res.json({
      message: `${vorgeschlagenCount} von ${txList.length} Transaktionen automatisch vorgeschlagen`,
      count: vorgeschlagenCount,
      gesamt: txList.length
    });

  } catch (err) {
    logger.error('Auto-Vorschlag-Fehler:', { error: err });
    res.status(500).json({ message: 'Fehler beim automatischen Vorschlagen', error: err.message });
  }
});

// ===================================================================
// ✅ POST /api/buchhaltung/bank-import/alle-vorschlaege-annehmen
// Nimmt alle vorgeschlagenen Transaktionen auf einmal an → EÜR-Belege
// ===================================================================
router.post('/bank-import/alle-vorschlaege-annehmen', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { organisation } = req.query;
    const orgFilter = buildOrgFilter(req, organisation);
    const whereExtra = orgFilter.sql ? orgFilter.sql : '';
    const whereParams = orgFilter.params || [];

    const txList = await new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM bank_transaktionen WHERE status = 'vorgeschlagen' ${whereExtra}`,
        whereParams, (err, results) => err ? reject(err) : resolve(results)
      );
    });

    if (txList.length === 0) {
      return res.json({ message: 'Keine vorgeschlagenen Transaktionen', count: 0 });
    }

    let angenommenCount = 0;
    let fehlerCount = 0;

    for (const tx of txList) {
      try {
        let matchDetails = tx.match_details;
        if (typeof matchDetails === 'string') {
          try { matchDetails = JSON.parse(matchDetails); } catch (e) {}
        }

        // Beitrag bezahlt markieren
        if (tx.match_typ === 'beitrag' && tx.match_id) {
          await new Promise((resolve) => {
            db.query(`UPDATE beitraege SET bezahlt=1, zahlungsdatum=?, zahlungsart='Überweisung' WHERE beitrag_id=?`,
              [tx.buchungsdatum, tx.match_id], () => resolve());
          });
        }
        // Rechnung bezahlt markieren
        else if (tx.match_typ === 'rechnung' && tx.match_id) {
          await new Promise((resolve) => {
            db.query(`UPDATE rechnungen SET status='bezahlt', bezahlt_am=? WHERE rechnung_id=?`,
              [tx.buchungsdatum, tx.match_id], () => resolve());
          });
        }

        const roheKategorie = matchDetails?.kategorie || tx.auto_kategorie;
        const kategorie = mapZuBelegeKategorie(roheKategorie, matchDetails?.euer_typ, tx.betrag);

        // Beitrag/Rechnung/Verkauf: bereits in EÜR über eigenen Branch — kein Beleg erstellen
        if (['beitrag', 'rechnung', 'verkauf'].includes(tx.match_typ)) {
          await new Promise((resolve, reject) => {
            db.query(`
              UPDATE bank_transaktionen SET
                status='zugeordnet', kategorie=?,
                zugeordnet_von=?, zugeordnet_am=NOW()
              WHERE transaktion_id=?
            `, [kategorie, req.user?.id || 1, tx.transaktion_id],
            (err) => err ? reject(err) : resolve());
          });
          angenommenCount++;
          continue;
        }

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
            belegNummer, tx.dojo_id, tx.organisation_name, buchungsart,
            tx.buchungsdatum, tx.buchungsdatum,
            Math.abs(tx.betrag), Math.abs(tx.betrag),
            kategorie, tx.verwendungszweck || 'Bank-Import',
            tx.auftraggeber_empfaenger, req.user?.id || 1
          ], (err, result) => err ? reject(err) : resolve(result));
        });

        await new Promise((resolve, reject) => {
          db.query(`
            UPDATE bank_transaktionen SET
              status='zugeordnet', kategorie=?, beleg_id=?,
              zugeordnet_von=?, zugeordnet_am=NOW()
            WHERE transaktion_id=?
          `, [kategorie, belegResult.insertId, req.user?.id || 1, tx.transaktion_id],
          (err) => err ? reject(err) : resolve());
        });

        // Lernende Regel speichern wenn Auftraggeber bekannt
        if (tx.auftraggeber_empfaenger && matchDetails?.kategorie && tx.dojo_id) {
          const suchWert = tx.auftraggeber_empfaenger.toLowerCase().trim();
          db.query(`
            INSERT IGNORE INTO bank_zuordnung_regeln
              (dojo_id, match_feld, match_typ, match_wert, kategorie, aktion, verwendungen)
            VALUES (?, 'auftraggeber', 'enthaelt', ?, ?, 'kategorisieren', 1)
            ON DUPLICATE KEY UPDATE verwendungen = verwendungen + 1
          `, [tx.dojo_id, suchWert, matchDetails.kategorie], () => {});
        }

        angenommenCount++;
      } catch (txErr) {
        logger.error('Fehler bei Transaktion ' + tx.transaktion_id, { error: txErr });
        fehlerCount++;
      }
    }

    res.json({
      message: `${angenommenCount} Transaktionen in EÜR übertragen`,
      count: angenommenCount,
      fehler: fehlerCount
    });

  } catch (err) {
    logger.error('Alle-Vorschläge-Annehmen-Fehler:', { error: err });
    res.status(500).json({ message: 'Fehler beim Annehmen aller Vorschläge', error: err.message });
  }
});

// ===================================================================
// 🗑️ DELETE /api/buchhaltung/bank-import/transaktion/:id - Einzelne Transaktion löschen
// ===================================================================
router.delete('/bank-import/transaktion/:id', requireFeature('kontoauszug'), requireBuchhaltungAccess, (req, res) => {
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
router.delete('/bank-import/import/:importId', requireFeature('kontoauszug'), requireBuchhaltungAccess, (req, res) => {
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
router.get('/bank-import/historie', requireFeature('kontoauszug'), requireBuchhaltungAccess, (req, res) => {
  const { organisation, limit = 20 } = req.query;

  let whereClause = '1=1';
  const params = [];

  const _orgFilter = buildOrgFilter(req, organisation);
  if (_orgFilter.sql) {
    whereClause += ' ' + _orgFilter.sql;
    params.push(..._orgFilter.params);
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
// 📊 BANK-IMPORT STEUERAUSWERTUNG (Enterprise)
// ===================================================================

/**
 * GET /api/buchhaltung/bank-import/steuerauswertung
 * EÜR-relevante Transaktionen aus Kontoauszügen auswerten.
 * Gruppiert nach EÜR-Typ (Betriebseinnahmen, Betriebsausgaben) und Kategorie.
 * Liefert auch eine Übertragungsvorschau für die EÜR.
 */
router.get('/bank-import/steuerauswertung', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { jahr = new Date().getFullYear() } = req.query;
    const dojoId = req.buchhaltungDojoId;
    const pool = db.promise();
    const y = parseInt(jahr);

    const dojoFilter = dojoId ? 'AND dojo_id = ?' : '';
    const baseParams = dojoId ? [y, dojoId] : [y];

    // Dojo-Einstellungen für Anzeige-Modus (Kleinunternehmer → netto, sonst brutto)
    let kleinunternehmer = false;
    if (dojoId) {
      const [dojoRows] = await pool.query(
        'SELECT kleinunternehmer FROM dojo WHERE dojo_id = ?', [dojoId]
      );
      kleinunternehmer = !!(dojoRows[0]?.kleinunternehmer);
    }

    // ----------------------------------------------------------------
    // 1) Einnahmen nach Kategorie
    // ----------------------------------------------------------------
    const [einnahmenRows] = await pool.query(`
      SELECT
        COALESCE(kategorie, 'Unkategorisiert') AS kategorie,
        SUM(betrag_netto)   AS summe_netto,
        SUM(betrag_brutto)  AS summe_brutto,
        SUM(mwst_betrag)    AS ust_summe,
        COUNT(*)            AS anzahl
      FROM buchhaltung_belege
      WHERE YEAR(buchungsdatum) = ?
        AND buchungsart = 'einnahme'
        ${dojoFilter}
      GROUP BY kategorie
      ORDER BY summe_netto DESC
    `, baseParams);

    // ----------------------------------------------------------------
    // 2) Ausgaben nach Kategorie, OHNE Steuerzahlungen
    // ----------------------------------------------------------------
    const [ausgabenRows] = await pool.query(`
      SELECT
        COALESCE(kategorie, 'Unkategorisiert') AS kategorie,
        SUM(betrag_netto)   AS summe_netto,
        SUM(betrag_brutto)  AS summe_brutto,
        SUM(CASE WHEN mwst_satz > 0 THEN mwst_betrag ELSE 0 END) AS vorsteuer_summe,
        COUNT(*)            AS anzahl
      FROM buchhaltung_belege
      WHERE YEAR(buchungsdatum) = ?
        AND buchungsart = 'ausgabe'
        AND (kategorie IS NULL OR kategorie != 'steuerzahlungen')
        ${dojoFilter}
      GROUP BY kategorie
      ORDER BY summe_netto DESC
    `, baseParams);

    // ----------------------------------------------------------------
    // 3) USt / Vorsteuer / Zahllast (gesamt)
    // ----------------------------------------------------------------
    const [ustRow] = await pool.query(`
      SELECT
        SUM(CASE WHEN buchungsart = 'einnahme' THEN mwst_betrag ELSE 0 END)                                        AS umsatzsteuer,
        SUM(CASE WHEN buchungsart = 'ausgabe' AND mwst_satz > 0
                      AND (kategorie IS NULL OR kategorie != 'steuerzahlungen') THEN mwst_betrag ELSE 0 END)       AS vorsteuer,
        SUM(CASE WHEN buchungsart = 'ausgabe' AND kategorie = 'steuerzahlungen' THEN betrag_brutto ELSE 0 END)     AS steuerzahlungen
      FROM buchhaltung_belege
      WHERE YEAR(buchungsdatum) = ?
        ${dojoFilter}
    `, baseParams);

    const umsatzsteuer   = parseFloat(ustRow[0]?.umsatzsteuer   || 0);
    const vorsteuer      = parseFloat(ustRow[0]?.vorsteuer      || 0);
    const steuerzahlungen = parseFloat(ustRow[0]?.steuerzahlungen || 0);
    const zahllast       = Math.round((umsatzsteuer - vorsteuer) * 100) / 100;

    // ----------------------------------------------------------------
    // 4) Quartale (Q1–Q4)
    // ----------------------------------------------------------------
    const quartalDef = [
      { quartal: 1, label: 'Q1 Jan–Mär', monate: '01-03', von: '01', bis: '03' },
      { quartal: 2, label: 'Q2 Apr–Jun', monate: '04-06', von: '04', bis: '06' },
      { quartal: 3, label: 'Q3 Jul–Sep', monate: '07-09', von: '07', bis: '09' },
      { quartal: 4, label: 'Q4 Okt–Dez', monate: '10-12', von: '10', bis: '12' },
    ];

    const [quartalRows] = await pool.query(`
      SELECT
        QUARTER(buchungsdatum)  AS q,
        buchungsart,
        SUM(betrag_netto)       AS netto,
        SUM(betrag_brutto)      AS brutto,
        SUM(CASE WHEN buchungsart = 'einnahme' THEN mwst_betrag ELSE 0 END) AS ust,
        SUM(CASE WHEN buchungsart = 'ausgabe' AND mwst_satz > 0
                      AND (kategorie IS NULL OR kategorie != 'steuerzahlungen') THEN mwst_betrag ELSE 0 END) AS vorsteuer
      FROM buchhaltung_belege
      WHERE YEAR(buchungsdatum) = ?
        AND (buchungsart = 'einnahme'
          OR (buchungsart = 'ausgabe' AND (kategorie IS NULL OR kategorie != 'steuerzahlungen')))
        ${dojoFilter}
      GROUP BY q, buchungsart
    `, baseParams);

    const quartale = quartalDef.map(qd => {
      const eRow = quartalRows.find(r => r.q === qd.quartal && r.buchungsart === 'einnahme');
      const aRow = quartalRows.find(r => r.q === qd.quartal && r.buchungsart === 'ausgabe');
      const qUst      = parseFloat(eRow?.ust      || 0);
      const qVorsteuer = parseFloat(aRow?.vorsteuer || 0);
      return {
        quartal:          qd.quartal,
        label:            qd.label,
        monate:           qd.monate,
        umsatzsteuer:     Math.round(qUst * 100) / 100,
        vorsteuer:        Math.round(qVorsteuer * 100) / 100,
        zahllast:         Math.round((qUst - qVorsteuer) * 100) / 100,
        einnahmen_netto:  Math.round(parseFloat(eRow?.netto   || 0) * 100) / 100,
        ausgaben_netto:   Math.round(parseFloat(aRow?.netto   || 0) * 100) / 100,
        einnahmen_brutto: Math.round(parseFloat(eRow?.brutto  || 0) * 100) / 100,
        ausgaben_brutto:  Math.round(parseFloat(aRow?.brutto  || 0) * 100) / 100,
      };
    });

    // ----------------------------------------------------------------
    // 5) Monatlicher Cashflow (12 Monate)
    // ----------------------------------------------------------------
    const [monatsRows] = await pool.query(`
      SELECT
        MONTH(buchungsdatum)    AS m,
        buchungsart,
        SUM(betrag_netto)       AS netto,
        SUM(CASE WHEN buchungsart = 'einnahme' THEN mwst_betrag ELSE 0 END) AS ust,
        SUM(CASE WHEN buchungsart = 'ausgabe' AND mwst_satz > 0
                      AND (kategorie IS NULL OR kategorie != 'steuerzahlungen') THEN mwst_betrag ELSE 0 END) AS vorsteuer
      FROM buchhaltung_belege
      WHERE YEAR(buchungsdatum) = ?
        AND (buchungsart = 'einnahme'
          OR (buchungsart = 'ausgabe' AND (kategorie IS NULL OR kategorie != 'steuerzahlungen')))
        ${dojoFilter}
      GROUP BY m, buchungsart
    `, baseParams);

    const monatsNamen = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    const monate = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const eRow = monatsRows.find(r => r.m === m && r.buchungsart === 'einnahme');
      const aRow = monatsRows.find(r => r.m === m && r.buchungsart === 'ausgabe');
      return {
        monat:           m,
        label:           monatsNamen[i],
        einnahmen_netto: Math.round(parseFloat(eRow?.netto    || 0) * 100) / 100,
        ausgaben_netto:  Math.round(parseFloat(aRow?.netto    || 0) * 100) / 100,
        ust:             Math.round(parseFloat(eRow?.ust      || 0) * 100) / 100,
        vorsteuer:       Math.round(parseFloat(aRow?.vorsteuer || 0) * 100) / 100,
      };
    });

    // ----------------------------------------------------------------
    // 6) Nicht kategorisierte Belege zählen
    // ----------------------------------------------------------------
    const [unkategorisiert] = await pool.query(`
      SELECT COUNT(*) AS anzahl, SUM(betrag_brutto) AS summe
      FROM buchhaltung_belege
      WHERE YEAR(buchungsdatum) = ?
        AND kategorie IS NULL
        ${dojoFilter}
    `, baseParams);

    // ----------------------------------------------------------------
    // 7) Gesamtanzahl Belege
    // ----------------------------------------------------------------
    const [belegeCount] = await pool.query(`
      SELECT COUNT(*) AS gesamt
      FROM buchhaltung_belege
      WHERE YEAR(buchungsdatum) = ?
        ${dojoFilter}
    `, baseParams);

    // ----------------------------------------------------------------
    // Summen aggregieren (netto + brutto)
    // ----------------------------------------------------------------
    const sumEinnahmen       = einnahmenRows.reduce((s, r) => s + parseFloat(r.summe_netto  || 0), 0);
    const sumAusgaben        = ausgabenRows.reduce((s, r)  => s + parseFloat(r.summe_netto  || 0), 0);
    const sumBruttoEinnahmen = einnahmenRows.reduce((s, r) => s + parseFloat(r.summe_brutto || 0), 0);
    const sumBruttoAusgaben  = ausgabenRows.reduce((s, r)  => s + parseFloat(r.summe_brutto || 0), 0);

    const auswertung = {
      kleinunternehmer,
      // EÜR-Kernfelder pro Kategorie
      betriebseinnahmen: einnahmenRows.map(r => ({
        kategorie:    r.kategorie,
        summe:        Math.round(parseFloat(r.summe_netto  || 0) * 100) / 100,
        summe_brutto: Math.round(parseFloat(r.summe_brutto || 0) * 100) / 100,
        anzahl:       r.anzahl,
      })),
      betriebsausgaben: ausgabenRows.map(r => ({
        kategorie:    r.kategorie,
        summe:        Math.round(parseFloat(r.summe_netto  || 0) * 100) / 100,
        summe_brutto: Math.round(parseFloat(r.summe_brutto || 0) * 100) / 100,
        anzahl:       r.anzahl,
      })),
      // Netto-Summen (Kleinunternehmer + formale EÜR)
      gewinn:          Math.round((sumEinnahmen - sumAusgaben) * 100) / 100,
      summe_einnahmen: Math.round(sumEinnahmen * 100) / 100,
      summe_ausgaben:  Math.round(sumAusgaben  * 100) / 100,
      // Brutto-Summen (Regelbesteuerung-Anzeige)
      gewinn_brutto:          Math.round((sumBruttoEinnahmen - sumBruttoAusgaben) * 100) / 100,
      summe_brutto_einnahmen: Math.round(sumBruttoEinnahmen * 100) / 100,
      summe_brutto_ausgaben:  Math.round(sumBruttoAusgaben  * 100) / 100,
      nicht_kategorisiert: {
        anzahl: parseInt(unkategorisiert[0]?.anzahl || 0),
        summe:  Math.round(parseFloat(unkategorisiert[0]?.summe || 0) * 100) / 100,
      },
      // Kategorie-Aufschlüsselung (Alias für Frontend-Kompatibilität)
      einnahmen_nach_kategorie: einnahmenRows.map(r => ({
        kategorie:    r.kategorie,
        summe:        Math.round(parseFloat(r.summe_netto  || 0) * 100) / 100,
        summe_brutto: Math.round(parseFloat(r.summe_brutto || 0) * 100) / 100,
        anzahl:       r.anzahl,
      })),
      ausgaben_nach_kategorie: ausgabenRows.map(r => ({
        kategorie:    r.kategorie,
        summe:        Math.round(parseFloat(r.summe_netto  || 0) * 100) / 100,
        summe_brutto: Math.round(parseFloat(r.summe_brutto || 0) * 100) / 100,
        anzahl:       r.anzahl,
      })),
      // USt-Auswertung
      ust: {
        umsatzsteuer:   Math.round(umsatzsteuer  * 100) / 100,
        vorsteuer:      Math.round(vorsteuer      * 100) / 100,
        zahllast,
        steuerzahlungen: Math.round(steuerzahlungen * 100) / 100,
        quartale,
      },
      // Monatlicher Cashflow
      monate,
    };

    res.json({
      jahr: y,
      transaktionen_gesamt: parseInt(belegeCount[0]?.gesamt || 0),
      auswertung,
    });

  } catch (err) {
    logger.error('Steuerauswertung-Fehler:', { error: err.message });
    res.status(500).json({ message: 'Fehler bei der Steuerauswertung', error: err.message });
  }
});

/**
 * POST /api/buchhaltung/bank-import/euer-uebertragen
 * Überträgt kategorisierte Bank-Transaktionen als Belege in die EÜR.
 * Nur Transaktionen mit status='zugeordnet' oder auto_kategorie_euer gesetzt.
 */
router.post('/bank-import/euer-uebertragen', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { jahr = new Date().getFullYear(), nur_vorschau = false } = req.body;
    const dojoId = req.buchhaltungDojoId;
    if (!dojoId) return res.status(400).json({ message: 'Dojo-ID erforderlich' });

    const pool = db.promise();
    const dojoFilter = 'AND t.dojo_id = ?';

    // Alle noch nicht übertragenen, kategorisierten Transaktionen
    // WICHTIG: Transaktionen die auf eine Rechnung, Beitrag oder Verkauf gemappt sind
    // NICHT übertragen — diese sind bereits in der EÜR via v_euer_einnahmen (views)!
    const [txList] = await pool.query(`
      SELECT t.*,
        COALESCE(t.kategorie, t.auto_kategorie) AS eff_kategorie,
        COALESCE(t.auto_kategorie_euer, 'betriebsausgabe') AS eff_euer_typ
      FROM bank_transaktionen t
      LEFT JOIN bank_euer_zuordnungen e ON e.transaktion_id = t.transaktion_id
      WHERE YEAR(t.buchungsdatum) = ?
        AND t.status != 'ignoriert'
        AND e.id IS NULL
        AND (t.kategorie IS NOT NULL OR t.auto_kategorie IS NOT NULL)
        -- Bereits im System vorhandene Einnahmen NICHT doppelt zählen:
        -- rechnung → in v_euer_einnahmen via rechnungen-Tabelle
        -- beitrag  → in v_euer_einnahmen via beitraege-Tabelle
        -- verkauf  → in v_euer_einnahmen via verkaeufe-Tabelle
        AND (t.match_typ IS NULL OR t.match_typ NOT IN ('rechnung', 'beitrag', 'verkauf'))
        ${dojoFilter}
    `, [parseInt(jahr), dojoId]);

    // Ausgaben die bereits als Kassenbuch-Beleg erfasst sind, herausfiltern
    const [existingBelege] = await pool.query(`
      SELECT extern_ref_id FROM buchhaltung_belege
      WHERE dojo_id = ? AND YEAR(buchungsdatum) = ? AND extern_ref_id IS NOT NULL
    `, [dojoId, parseInt(jahr)]);
    const bereitsUebertragene = new Set(existingBelege.map(b => b.extern_ref_id));
    const zuUebertragen = txList.filter(tx => !bereitsUebertragene.has(tx.transaktion_id));

    if (nur_vorschau) {
      return res.json({
        vorschau: true,
        anzahl: zuUebertragen.length,
        uebersprungen_bereits_in_euer: txList.length - zuUebertragen.length +
          (await pool.query(`
            SELECT COUNT(*) AS c FROM bank_transaktionen
            WHERE dojo_id = ? AND YEAR(buchungsdatum) = ?
              AND match_typ IN ('rechnung','beitrag','verkauf')
          `, [dojoId, parseInt(jahr)]))[0][0]?.c || 0,
        summe_einnahmen: zuUebertragen.filter(t => parseFloat(t.betrag) > 0).reduce((s, t) => s + Math.abs(parseFloat(t.betrag)), 0),
        summe_ausgaben: zuUebertragen.filter(t => parseFloat(t.betrag) < 0).reduce((s, t) => s + Math.abs(parseFloat(t.betrag)), 0),
      });
    }

    let uebertragen = 0;
    for (const tx of zuUebertragen) {
      // Eintrag in bank_euer_zuordnungen
      await pool.query(`
        INSERT INTO bank_euer_zuordnungen
          (dojo_id, transaktion_id, euer_kategorie, betrag_eur, buchungsjahr, notiz)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE euer_kategorie = VALUES(euer_kategorie)
      `, [
        dojoId,
        tx.transaktion_id,
        tx.eff_euer_typ,
        Math.abs(parseFloat(tx.betrag)),
        parseInt(jahr),
        tx.eff_kategorie,
      ]);

      // Optional: Beleg in buchhaltung_belege anlegen
      const buchungsart = parseFloat(tx.betrag) > 0 ? 'Einnahme' : 'Ausgabe';
      const betragCent  = Math.round(Math.abs(parseFloat(tx.betrag)) * 100);
      await pool.query(`
        INSERT INTO buchhaltung_belege
          (dojo_id, organisation_name, buchungsart, buchungsdatum, betrag_cent,
           beschreibung, kategorie, quelle, extern_ref_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'bank_import', ?)
        ON DUPLICATE KEY UPDATE beschreibung = VALUES(beschreibung)
      `, [
        dojoId,
        `Dojo ${dojoId}`,
        buchungsart,
        tx.buchungsdatum,
        betragCent,
        tx.verwendungszweck?.substring(0, 200) || tx.eff_kategorie,
        tx.eff_kategorie,
        tx.transaktion_id,
      ]).catch(() => {}); // Fehler ignorieren wenn Spalte extern_ref_id fehlt

      uebertragen++;
    }

    res.json({
      message: `${uebertragen} Transaktionen in EÜR übertragen`,
      uebertragen,
      jahr: parseInt(jahr),
    });

  } catch (err) {
    logger.error('EÜR-Übertragung-Fehler:', { error: err.message });
    res.status(500).json({ message: 'Fehler bei der EÜR-Übertragung', error: err.message });
  }
});

/**
 * GET /api/buchhaltung/bank-import/kategorien-vorschlag
 * Liefert Auto-Kategorisierungsvorschlag für eine einzelne Transaktion.
 */
router.get('/bank-import/kategorien-vorschlag', requireFeature('kontoauszug'), requireBuchhaltungAccess, (req, res) => {
  const { verwendungszweck = '', auftraggeber = '' } = req.query;
  const kat = autoKategorisieren(verwendungszweck, auftraggeber);
  res.json(kat || { kategorie: null, typ: null, euer_typ: null });
});

/**
 * GET /api/buchhaltung/bank-import/kategorien-liste
 * Liefert alle verfügbaren Standard-Kategorien mit EÜR-Typ.
 */
router.get('/bank-import/kategorien-liste', requireFeature('kontoauszug'), requireBuchhaltungAccess, (req, res) => {
  const kategorien = AUTO_KATEGORISIERUNG_REGELN.map(r => ({
    name: r.kategorie,
    typ: r.typ,
    euer_typ: r.euer_typ,
    keywords_count: r.keywords.length,
  }));
  res.json(kategorien);
});

// ===================================================================
// 📊 BANK-IMPORT ABGLEICH & CASHFLOW ANALYSE
// ===================================================================

/**
 * GET /api/buchhaltung/bank-import/abgleich-bericht
 * Zeigt welche Bank-Transaktionen bereits im System vorhanden sind
 * und welche neu (bisher unbekannt) sind — verhindert Doppelzählung in EÜR.
 */
router.get('/bank-import/abgleich-bericht', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { jahr = new Date().getFullYear() } = req.query;
    const dojoId = req.buchhaltungDojoId;
    const pool = db.promise();
    const dojoFilter = dojoId ? 'AND t.dojo_id = ?' : '';
    const params = dojoId ? [parseInt(jahr), dojoId] : [parseInt(jahr)];

    const [rows] = await pool.query(`
      SELECT
        t.transaktion_id,
        t.buchungsdatum,
        t.betrag,
        t.verwendungszweck,
        t.auftraggeber_empfaenger,
        t.status,
        t.match_typ,
        t.match_confidence,
        t.match_details,
        COALESCE(t.auto_kategorie, t.kategorie) AS kategorie,
        CASE
          WHEN t.match_typ = 'rechnung'       THEN 'In EÜR via Rechnung — kein Doppeleintrag'
          WHEN t.match_typ = 'beitrag'        THEN 'In EÜR via Mitgliedsbeitrag — kein Doppeleintrag'
          WHEN t.match_typ = 'verkauf'        THEN 'In EÜR via Verkauf — kein Doppeleintrag'
          WHEN t.match_typ = 'verbandsbeitrag' THEN 'Als Verbandsbeitrag kategorisiert'
          WHEN t.match_typ = 'manuell'        THEN 'Manuelle Regel — wird übertragen wenn kategorisiert'
          WHEN t.status = 'ignoriert'         THEN 'Ignoriert'
          WHEN t.auto_kategorie IS NOT NULL   THEN 'Auto-kategorisiert — bereit zur EÜR-Übertragung'
          ELSE 'Unkategorisiert — bitte manuell zuordnen'
        END AS euer_status,
        CASE
          WHEN t.match_typ IN ('rechnung','beitrag','verkauf') THEN 'bereits_erfasst'
          WHEN t.status = 'ignoriert'         THEN 'ignoriert'
          WHEN t.auto_kategorie IS NOT NULL   THEN 'neu_kategorisiert'
          ELSE 'offen'
        END AS abgleich_typ
      FROM bank_transaktionen t
      WHERE YEAR(t.buchungsdatum) = ?
        ${dojoFilter}
      ORDER BY t.buchungsdatum DESC
    `, params);

    // Zusammenfassung
    const zusammenfassung = rows.reduce((acc, r) => {
      acc[r.abgleich_typ] = (acc[r.abgleich_typ] || 0) + 1;
      if (r.abgleich_typ === 'bereits_erfasst') {
        acc.bereits_erfasst_summe = (acc.bereits_erfasst_summe || 0) + Math.abs(parseFloat(r.betrag));
      }
      if (r.abgleich_typ === 'neu_kategorisiert') {
        acc.neu_kategorisiert_summe = (acc.neu_kategorisiert_summe || 0) + Math.abs(parseFloat(r.betrag));
      }
      return acc;
    }, {});

    res.json({
      jahr: parseInt(jahr),
      zusammenfassung,
      transaktionen: rows.map(r => ({
        ...r,
        match_details: typeof r.match_details === 'string' ? JSON.parse(r.match_details || '{}') : r.match_details,
        betrag: parseFloat(r.betrag),
      })),
    });
  } catch (err) {
    logger.error('Abgleich-Bericht-Fehler:', { error: err.message });
    res.status(500).json({ message: 'Fehler beim Laden des Abgleich-Berichts', error: err.message });
  }
});

/**
 * GET /api/buchhaltung/bank-import/cashflow
 * Monatlicher Cashflow aus Bank-Transaktionen für Charts.
 * Liefert Einnahmen, Ausgaben und Saldo je Monat + Kategorie-Breakdown.
 */
router.get('/bank-import/cashflow', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { jahr = new Date().getFullYear() } = req.query;
    const dojoId = req.buchhaltungDojoId;
    const pool = db.promise();
    const dojoFilter = dojoId ? 'AND dojo_id = ?' : '';
    const params = dojoId ? [parseInt(jahr), dojoId] : [parseInt(jahr)];

    // Monatliche Übersicht
    const [monatsRows] = await pool.query(`
      SELECT
        MONTH(buchungsdatum) AS monat,
        SUM(CASE WHEN betrag > 0 THEN betrag ELSE 0 END) AS einnahmen,
        SUM(CASE WHEN betrag < 0 THEN ABS(betrag) ELSE 0 END) AS ausgaben,
        SUM(betrag) AS netto,
        COUNT(*) AS anzahl
      FROM bank_transaktionen
      WHERE YEAR(buchungsdatum) = ?
        AND status != 'ignoriert'
        ${dojoFilter}
      GROUP BY MONTH(buchungsdatum)
      ORDER BY monat
    `, params);

    // Kategorie-Breakdown (Top 10)
    const [katRows] = await pool.query(`
      SELECT
        COALESCE(auto_kategorie, kategorie, 'Unkategorisiert') AS kategorie,
        SUM(CASE WHEN betrag > 0 THEN betrag ELSE 0 END) AS einnahmen,
        SUM(CASE WHEN betrag < 0 THEN ABS(betrag) ELSE 0 END) AS ausgaben,
        COUNT(*) AS anzahl
      FROM bank_transaktionen
      WHERE YEAR(buchungsdatum) = ?
        AND status != 'ignoriert'
        ${dojoFilter}
      GROUP BY COALESCE(auto_kategorie, kategorie, 'Unkategorisiert')
      ORDER BY (SUM(CASE WHEN betrag > 0 THEN betrag ELSE 0 END) + SUM(CASE WHEN betrag < 0 THEN ABS(betrag) ELSE 0 END)) DESC
      LIMIT 15
    `, params);

    // Abgleich-Status-Verteilung
    const [abgleichRows] = await pool.query(`
      SELECT
        CASE
          WHEN match_typ IN ('rechnung','beitrag','verkauf') THEN 'Bereits in EÜR'
          WHEN status = 'ignoriert'    THEN 'Ignoriert'
          WHEN auto_kategorie IS NOT NULL THEN 'Auto-kategorisiert'
          WHEN status = 'vorgeschlagen' THEN 'Vorschlag vorhanden'
          ELSE 'Nicht zugeordnet'
        END AS gruppe,
        COUNT(*) AS anzahl,
        SUM(ABS(betrag)) AS summe
      FROM bank_transaktionen
      WHERE YEAR(buchungsdatum) = ?
        ${dojoFilter}
      GROUP BY gruppe
    `, params);

    // Monatsnamen
    const MONATE = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    // Jahressummen
    const jahresEinnahmen = monatsRows.reduce((s, m) => s + parseFloat(m.einnahmen || 0), 0);
    const jahresAusgaben  = monatsRows.reduce((s, m) => s + parseFloat(m.ausgaben  || 0), 0);

    res.json({
      jahr: parseInt(jahr),
      jahressummen: {
        einnahmen: Math.round(jahresEinnahmen * 100) / 100,
        ausgaben:  Math.round(jahresAusgaben  * 100) / 100,
        netto:     Math.round((jahresEinnahmen - jahresAusgaben) * 100) / 100,
      },
      monate: monatsRows.map(m => ({
        monat: m.monat,
        label: MONATE[m.monat],
        einnahmen: Math.round(parseFloat(m.einnahmen || 0) * 100) / 100,
        ausgaben:  Math.round(parseFloat(m.ausgaben  || 0) * 100) / 100,
        netto:     Math.round(parseFloat(m.netto     || 0) * 100) / 100,
        anzahl: m.anzahl,
      })),
      kategorien: katRows.map(k => ({
        kategorie: k.kategorie,
        einnahmen: Math.round(parseFloat(k.einnahmen || 0) * 100) / 100,
        ausgaben:  Math.round(parseFloat(k.ausgaben  || 0) * 100) / 100,
        anzahl: k.anzahl,
      })),
      abgleich_status: abgleichRows.map(a => ({
        gruppe: a.gruppe,
        anzahl: a.anzahl,
        summe: Math.round(parseFloat(a.summe || 0) * 100) / 100,
      })),
    });
  } catch (err) {
    logger.error('Cashflow-Fehler:', { error: err.message });
    res.status(500).json({ message: 'Fehler beim Laden des Cashflows', error: err.message });
  }
});

/**
 * POST /api/buchhaltung/bank-import/rematch-all
 * Führt Auto-Matching für alle unzugeordneten Transaktionen eines Jahres erneut durch.
 */
router.post('/bank-import/rematch-all', requireFeature('kontoauszug'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { jahr = new Date().getFullYear() } = req.body;
    const dojoId = req.buchhaltungDojoId;
    if (!dojoId) return res.status(400).json({ message: 'Dojo-ID erforderlich' });

    const [rows] = await db.promise().query(`
      SELECT transaktion_id FROM bank_transaktionen
      WHERE dojo_id = ? AND YEAR(buchungsdatum) = ?
        AND status IN ('unzugeordnet', 'vorgeschlagen')
    `, [dojoId, parseInt(jahr)]);

    let matched = 0;
    for (const row of rows) {
      await runAutoMatching(row.transaktion_id, dojoId);
      matched++;
    }

    res.json({ message: `${matched} Transaktionen neu abgeglichen`, matched });
  } catch (err) {
    logger.error('Rematch-Fehler:', { error: err.message });
    res.status(500).json({ message: 'Fehler beim Neu-Abgleich', error: err.message });
  }
});

// ===================================================================
// 📋 SKR KONTORAHMEN MAPPING
// ===================================================================
const KATEGORIE_SKR_MAP = {
  // Einnahmen
  betriebseinnahmen: {
    typ: 'einnahme',
    skr03: { nr: '8000', name: 'Umsatzerlöse', ku_nr: '8190', ku_name: 'Steuerfreie Umsätze §19 UStG' },
    skr04: { nr: '4000', name: 'Umsatzerlöse', ku_nr: '4120', ku_name: 'Steuerfreie Umsätze §19 UStG' }
  },
  // Ausgaben
  wareneingang:     { typ: 'ausgabe', skr03: { nr: '3200', name: 'Wareneinkauf' },                   skr04: { nr: '5200', name: 'Wareneinkauf' } },
  personalkosten:   { typ: 'ausgabe', skr03: { nr: '4000', name: 'Löhne u. Gehälter' },              skr04: { nr: '6000', name: 'Löhne u. Gehälter' } },
  raumkosten:       { typ: 'ausgabe', skr03: { nr: '4200', name: 'Raumkosten/Miete' },               skr04: { nr: '6300', name: 'Miet-/Pachtaufwand' } },
  versicherungen:   { typ: 'ausgabe', skr03: { nr: '4300', name: 'Versicherungen' },                 skr04: { nr: '6400', name: 'Versicherungen' } },
  werbekosten:      { typ: 'ausgabe', skr03: { nr: '4520', name: 'Werbung/Marketing' },              skr04: { nr: '6600', name: 'Werbekosten' } },
  kfz_kosten:       { typ: 'ausgabe', skr03: { nr: '4600', name: 'KFZ-Kosten' },                     skr04: { nr: '6640', name: 'KFZ-Kosten' } },
  reisekosten:      { typ: 'ausgabe', skr03: { nr: '4630', name: 'Reise-/Fahrtkosten' },             skr04: { nr: '6650', name: 'Reisekosten' } },
  buerokosten:      { typ: 'ausgabe', skr03: { nr: '4800', name: 'Bürobedarf' },                     skr04: { nr: '6800', name: 'Büromaterial' } },
  telefon_internet: { typ: 'ausgabe', skr03: { nr: '4820', name: 'Telefon/Internet' },               skr04: { nr: '6805', name: 'Telefon/Internet' } },
  abschreibungen:   { typ: 'ausgabe', skr03: { nr: '4830', name: 'Abschreibungen auf Sachanlagen' }, skr04: { nr: '6200', name: 'Abschreibungen' } },
  ausstattung:      { typ: 'ausgabe', skr03: { nr: '4910', name: 'GWG-Sofortabschreibung' },         skr04: { nr: '6220', name: 'GWG-Abschreibung' } },
  bankgebuehren:    { typ: 'ausgabe', skr03: { nr: '4970', name: 'Kontoführungsgebühren' },          skr04: { nr: '6855', name: 'Bankgebühren' } },
  software:         { typ: 'ausgabe', skr03: { nr: '4980', name: 'EDV/Software' },                   skr04: { nr: '6815', name: 'EDV-Kosten/Software' } },
  sonstige_kosten:  { typ: 'ausgabe', skr03: { nr: '4900', name: 'Sonstige Betriebsausgaben' },      skr04: { nr: '6900', name: 'Sonstige Betriebsausgaben' } },
  steuerzahlungen:  { typ: 'ausgabe', skr03: { nr: '1790', name: 'Steuerzahlungen Finanzamt' },      skr04: { nr: '7610', name: 'Steuern vom Einkommen' } },
};

// ===================================================================
// 📊 GET /api/buchhaltung/bwa - Betriebswirtschaftliche Auswertung
// ===================================================================
router.get('/bwa', requireBuchhaltungAccess, async (req, res) => {
  const { organisation, jahr } = req.query;
  const currentYear = parseInt(jahr) || new Date().getFullYear();
  const vorjahr = currentYear - 1;

  const _of = buildOrgFilter(req, organisation);
  const orgFilter = _of.params.length ? _of.sql.replace('?', db.escape(_of.params[0])) : '';

  try {
    const pool = db.promise();

    const [einnahmen] = await pool.query(
      `SELECT monat, ROUND(SUM(betrag_brutto), 2) AS summe, kategorie
       FROM v_euer_einnahmen WHERE jahr = ? ${orgFilter}
       GROUP BY monat, kategorie ORDER BY monat`,
      [currentYear]
    );
    const [ausgaben] = await pool.query(
      `SELECT monat, ROUND(SUM(betrag_brutto), 2) AS summe, kategorie
       FROM v_euer_ausgaben WHERE jahr = ? ${orgFilter}
         AND kategorie NOT IN ('privateinlage','privatentnahme','anlagevermögen')
       GROUP BY monat, kategorie ORDER BY monat`,
      [currentYear]
    );
    const [vjEinnahmen] = await pool.query(
      `SELECT monat, ROUND(SUM(betrag_brutto), 2) AS summe
       FROM v_euer_einnahmen WHERE jahr = ? ${orgFilter} GROUP BY monat`,
      [vorjahr]
    );
    const [vjAusgaben] = await pool.query(
      `SELECT monat, ROUND(SUM(betrag_brutto), 2) AS summe
       FROM v_euer_ausgaben WHERE jahr = ? ${orgFilter}
         AND kategorie NOT IN ('privateinlage','privatentnahme','anlagevermögen')
       GROUP BY monat`,
      [vorjahr]
    );

    const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

    const monatsDaten = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const einM = einnahmen.filter(r => r.monat === m);
      const ausM = ausgaben.filter(r => r.monat === m);

      const umsatz      = einM.reduce((s, r) => s + Number(r.summe), 0);
      const material    = ausM.filter(r => r.kategorie === 'wareneingang').reduce((s, r) => s + Number(r.summe), 0);
      const personal    = ausM.filter(r => r.kategorie === 'personalkosten').reduce((s, r) => s + Number(r.summe), 0);
      const raum        = ausM.filter(r => r.kategorie === 'raumkosten').reduce((s, r) => s + Number(r.summe), 0);
      const afa         = ausM.filter(r => r.kategorie === 'abschreibungen').reduce((s, r) => s + Number(r.summe), 0);
      const sonstige    = ausM.filter(r => !['wareneingang','personalkosten','raumkosten','abschreibungen'].includes(r.kategorie)).reduce((s, r) => s + Number(r.summe), 0);
      const rohertrag   = umsatz - material;
      const ebit        = rohertrag - personal - raum - afa - sonstige;

      const vjE = vjEinnahmen.find(r => r.monat === m);
      const vjA = vjAusgaben.find(r => r.monat === m);
      const vjErgebnis = (Number(vjE?.summe || 0)) - (Number(vjA?.summe || 0));

      return {
        monat: m, monatName: MONATE[i],
        umsatz: Math.round(umsatz * 100) / 100,
        material: Math.round(material * 100) / 100,
        rohertrag: Math.round(rohertrag * 100) / 100,
        personal: Math.round(personal * 100) / 100,
        raumkosten: Math.round(raum * 100) / 100,
        abschreibungen: Math.round(afa * 100) / 100,
        sonstige_kosten: Math.round(sonstige * 100) / 100,
        ebit: Math.round(ebit * 100) / 100,
        vj_ergebnis: Math.round(vjErgebnis * 100) / 100,
        abweichung: Math.round((ebit - vjErgebnis) * 100) / 100
      };
    });

    const jahresSumme = monatsDaten.reduce((acc, m) => ({
      umsatz: acc.umsatz + m.umsatz,
      rohertrag: acc.rohertrag + m.rohertrag,
      personal: acc.personal + m.personal,
      raumkosten: acc.raumkosten + m.raumkosten,
      abschreibungen: acc.abschreibungen + m.abschreibungen,
      sonstige_kosten: acc.sonstige_kosten + m.sonstige_kosten,
      ebit: acc.ebit + m.ebit,
      vj_ergebnis: acc.vj_ergebnis + m.vj_ergebnis
    }), { umsatz: 0, rohertrag: 0, personal: 0, raumkosten: 0, abschreibungen: 0, sonstige_kosten: 0, ebit: 0, vj_ergebnis: 0 });

    Object.keys(jahresSumme).forEach(k => { jahresSumme[k] = Math.round(jahresSumme[k] * 100) / 100; });

    res.json({ jahr: currentYear, vorjahr, monate: monatsDaten, jahresSumme });
  } catch (err) {
    console.error('BWA-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der BWA', error: err.message });
  }
});

// ===================================================================
// 📊 GET /api/buchhaltung/guv - GuV (Gewinn- und Verlustrechnung)
// ===================================================================
router.get('/guv', requireBuchhaltungAccess, (req, res) => {
  const { organisation, jahr, quartal } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  let dateFilter = `jahr = ${db.escape(currentYear)}`;
  if (quartal) {
    const q = parseInt(quartal);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    dateFilter += ` AND monat BETWEEN ${startMonth} AND ${endMonth}`;
  }

  const _of = buildOrgFilter(req, organisation);
  const orgFilter = _of.params.length ? _of.sql.replace('?', db.escape(_of.params[0])) : '';

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

    const gesamtaufwand    = materialaufwand + personalaufwand + abschreibungen + sonstigeAufwendungen;
    const rohergebnis      = umsatzerloese - materialaufwand;
    const ebit             = rohergebnis - personalaufwand - abschreibungen - sonstigeAufwendungen;
    const jahresueberschuss = ebit;

    res.json({
      jahr: currentYear,
      quartal: quartal || null,
      organisation: organisation || 'alle',
      guv: {
        umsatzerloese,
        materialaufwand,
        rohergebnis,
        personalaufwand,
        abschreibungen,
        sonstige_aufwendungen: sonstigeAufwendungen,
        gesamtaufwand,
        ebit,
        ebt: ebit,
        jahresueberschuss
      }
    });
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/guv/details - GuV with detailed breakdowns
// ===================================================================
router.get('/guv/details', requireBuchhaltungAccess, (req, res) => {
  const { organisation, jahr, quartal } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  let dateFilter = `jahr = ${db.escape(currentYear)}`;
  if (quartal) {
    const q = parseInt(quartal);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    dateFilter += ` AND monat BETWEEN ${startMonth} AND ${endMonth}`;
  }

  const _of = buildOrgFilter(req, organisation);
  const orgFilter = _of.params.length ? _of.sql.replace('?', db.escape(_of.params[0])) : '';

  // Detailed revenue breakdown
  const einnahmenDetailsSql = `
    SELECT kategorie, quelle, SUM(betrag_brutto) as summe
    FROM v_euer_einnahmen
    WHERE ${dateFilter} ${orgFilter}
    GROUP BY kategorie, quelle
  `;

  // Individual revenue entries for drill-down
  const einnahmenEinzelSql = `
    SELECT quelle, datum, betrag_brutto, beschreibung, referenz_id
    FROM v_euer_einnahmen
    WHERE ${dateFilter} ${orgFilter}
    ORDER BY quelle, datum
  `;

  // Detailed expense breakdown by category
  const ausgabenDetailsSql = `
    SELECT kategorie, quelle, SUM(betrag_brutto) as summe
    FROM v_euer_ausgaben
    WHERE ${dateFilter} ${orgFilter}
    GROUP BY kategorie, quelle
  `;

  // Individual expense entries for drill-down
  const ausgabenEinzelSql = `
    SELECT kategorie, quelle, datum, betrag_brutto, beschreibung
    FROM v_euer_ausgaben
    WHERE ${dateFilter} ${orgFilter}
    ORDER BY kategorie, quelle, datum
  `;

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(einnahmenDetailsSql, (err, results) => {
        if (err) reject(err); else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(einnahmenEinzelSql, (err, results) => {
        if (err) reject(err); else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenDetailsSql, (err, results) => {
        if (err) reject(err); else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenEinzelSql, (err, results) => {
        if (err) reject(err); else resolve(results);
      });
    })
  ])
  .then(([einnahmenDetails, einnahmenEinzel, ausgabenDetails, ausgabenEinzel]) => {
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

    // Monatsnamen
    const monatsnamen = ['Januar','Februar','März','April','Mai','Juni',
      'Juli','August','September','Oktober','November','Dezember'];

    // Process revenues with drill-down
    einnahmenDetails.forEach(row => {
      const betrag = parseFloat(row.summe || 0);
      guvDetails.umsatzerloese.gesamt += betrag;

      const rawEinzel = einnahmenEinzel.filter(e => e.quelle === row.quelle);
      let einzelbuchungen;

      if (row.quelle === 'Beitrag') {
        // Beiträge: nach Monat aggregieren
        const byMonth = {};
        rawEinzel.forEach(e => {
          const dt = new Date(e.datum);
          const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
          if (!byMonth[key]) byMonth[key] = { datum: e.datum, summe: 0, monat: dt.getMonth(), jahr: dt.getFullYear() };
          byMonth[key].summe += parseFloat(e.betrag_brutto);
        });
        einzelbuchungen = Object.values(byMonth)
          .sort((a, b) => a.datum < b.datum ? -1 : 1)
          .map(m => ({
            datum: m.datum,
            betrag: Math.round(m.summe * 100) / 100,
            beschreibung: `${monatsnamen[m.monat]} ${m.jahr}`
          }));
      } else if (row.quelle === 'Verkauf') {
        einzelbuchungen = rawEinzel.map(e => ({
          datum: e.datum,
          betrag: parseFloat(e.betrag_brutto),
          beschreibung: e.beschreibung,
          referenz_id: e.referenz_id
        }));
      } else {
        einzelbuchungen = rawEinzel.map(e => ({
          datum: e.datum,
          betrag: parseFloat(e.betrag_brutto),
          beschreibung: e.beschreibung
        }));
      }

      guvDetails.umsatzerloese.details.push({ quelle: row.quelle, betrag, einzelbuchungen });
    });

    // Process expenses by category with drill-down
    ausgabenDetails.forEach(row => {
      const betrag = parseFloat(row.summe || 0);
      const rawEinzel = ausgabenEinzel.filter(e => e.kategorie === row.kategorie && e.quelle === row.quelle);
      const einzelbuchungen = rawEinzel.map(e => ({
        datum: e.datum,
        betrag: parseFloat(e.betrag_brutto),
        beschreibung: e.beschreibung
      }));

      if (row.kategorie === 'wareneingang') {
        guvDetails.materialaufwand.gesamt += betrag;
        guvDetails.materialaufwand.details.push({ quelle: row.quelle, betrag, einzelbuchungen });
      } else if (row.kategorie === 'personalkosten') {
        guvDetails.personalaufwand.gesamt += betrag;
        guvDetails.personalaufwand.details.push({ quelle: row.quelle, betrag, einzelbuchungen });
      } else if (row.kategorie === 'abschreibungen') {
        guvDetails.abschreibungen.gesamt += betrag;
        guvDetails.abschreibungen.details.push({ quelle: row.quelle, betrag, einzelbuchungen });
      } else {
        guvDetails.sonstige_aufwendungen.gesamt += betrag;
        guvDetails.sonstige_aufwendungen.details.push({
          kategorie: row.kategorie,
          quelle: row.quelle,
          betrag,
          einzelbuchungen
        });
      }
    });

    const gesamtaufwand = guvDetails.materialaufwand.gesamt +
                          guvDetails.personalaufwand.gesamt +
                          guvDetails.abschreibungen.gesamt +
                          guvDetails.sonstige_aufwendungen.gesamt;

    // HGB §275 Zwischensummen
    const rohergebnis    = guvDetails.umsatzerloese.gesamt - guvDetails.materialaufwand.gesamt;
    const ebit           = rohergebnis - guvDetails.personalaufwand.gesamt
                           - guvDetails.abschreibungen.gesamt - guvDetails.sonstige_aufwendungen.gesamt;
    const ebt            = ebit; // kein Zinsergebnis in EÜR-Modus
    const jahresueberschuss = ebt;

    res.json({
      jahr: currentYear,
      quartal: quartal || null,
      organisation: organisation || 'alle',
      ...guvDetails,
      gesamtaufwand,
      // HGB §275-Zwischensummen
      rohergebnis,
      ebit,
      ebt,
      jahresueberschuss
    });
  })
  .catch(err => {
    console.error('GuV-Details-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der GuV-Details', error: err.message });
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/guv/skr - GuV nach SKR03/SKR04 Kontorahmen
// ===================================================================
router.get('/guv/skr', requireBuchhaltungAccess, async (req, res) => {
  const { organisation, jahr, kontorahmen = 'SKR03' } = req.query;
  const currentYear = parseInt(jahr) || new Date().getFullYear();
  const rahmen = kontorahmen === 'SKR04' ? 'skr04' : 'skr03';

  const _of = buildOrgFilter(req, organisation);
  const orgFilter = _of.params.length ? _of.sql.replace('?', db.escape(_of.params[0])) : '';

  try {
    const pool = db.promise();

    // Kleinunternehmer-Flag prüfen
    let kleinunternehmer = false;
    const dojoId = req.buchhaltungDojoId;
    if (dojoId) {
      const [dojoRows] = await pool.query('SELECT kleinunternehmer FROM dojo WHERE id = ?', [dojoId]);
      kleinunternehmer = !!(dojoRows[0]?.kleinunternehmer);
    }

    const einnahmenSql = `
      SELECT kategorie, quelle, ROUND(SUM(betrag_brutto), 2) AS summe
      FROM v_euer_einnahmen
      WHERE jahr = ${db.escape(currentYear)} ${orgFilter}
      GROUP BY kategorie, quelle
    `;
    const ausgabenSql = `
      SELECT kategorie, quelle, ROUND(SUM(betrag_brutto), 2) AS summe
      FROM v_euer_ausgaben
      WHERE jahr = ${db.escape(currentYear)} ${orgFilter}
        AND kategorie NOT IN ('privateinlage', 'privatentnahme', 'anlagevermögen')
      GROUP BY kategorie, quelle
    `;
    const einnahmenEinzelSql = `
      SELECT kategorie, quelle, datum, betrag_brutto, beschreibung
      FROM v_euer_einnahmen
      WHERE jahr = ${db.escape(currentYear)} ${orgFilter}
      ORDER BY kategorie, datum
    `;
    const ausgabenEinzelSql = `
      SELECT kategorie, quelle, datum, betrag_brutto, beschreibung
      FROM v_euer_ausgaben
      WHERE jahr = ${db.escape(currentYear)} ${orgFilter}
        AND kategorie NOT IN ('privateinlage', 'privatentnahme', 'anlagevermögen')
      ORDER BY kategorie, datum
    `;

    const [[einnahmen], [ausgaben], [einnahmenEinzel], [ausgabenEinzel]] = await Promise.all([
      pool.query(einnahmenSql),
      pool.query(ausgabenSql),
      pool.query(einnahmenEinzelSql),
      pool.query(ausgabenEinzelSql)
    ]);

    // SKR-Konten aufbauen
    const kontenMap = {};
    const addKonto = (nr, name, betrag, typ, kategorie) => {
      if (!kontenMap[nr]) kontenMap[nr] = { nr, name, typ, betrag: 0, positionen: [] };
      kontenMap[nr].betrag = Math.round((kontenMap[nr].betrag + betrag) * 100) / 100;
      if (!kontenMap[nr].positionen.includes(kategorie)) kontenMap[nr].positionen.push(kategorie);
    };

    let totalEinnahmen = 0;
    einnahmen.forEach(row => {
      const betrag = parseFloat(row.summe || 0);
      totalEinnahmen += betrag;
      const map = KATEGORIE_SKR_MAP[row.kategorie];
      if (map?.typ === 'einnahme' && map[rahmen]) {
        const konto = map[rahmen];
        const nr = (kleinunternehmer && konto.ku_nr) ? konto.ku_nr : konto.nr;
        const name = (kleinunternehmer && konto.ku_name) ? konto.ku_name : konto.name;
        addKonto(nr, name, betrag, 'einnahme', row.kategorie);
      } else {
        const fallbackNr = rahmen === 'skr03' ? '8000' : '4000';
        addKonto(fallbackNr, 'Umsatzerlöse', betrag, 'einnahme', row.kategorie);
      }
    });

    let totalAusgaben = 0;
    ausgaben.forEach(row => {
      const betrag = parseFloat(row.summe || 0);
      totalAusgaben += betrag;
      const map = KATEGORIE_SKR_MAP[row.kategorie];
      if (map?.typ === 'ausgabe' && map[rahmen]) {
        addKonto(map[rahmen].nr, map[rahmen].name, betrag, 'ausgabe', row.kategorie);
      } else {
        const fallbackNr = rahmen === 'skr03' ? '4900' : '6900';
        addKonto(fallbackNr, 'Sonstige Betriebsausgaben', betrag, 'ausgabe', row.kategorie);
      }
    });

    // Einzelbuchungen je Konto hinzufügen
    Object.values(kontenMap).forEach(konto => {
      const quelle = konto.typ === 'einnahme' ? einnahmenEinzel : ausgabenEinzel;
      konto.buchungen = quelle
        .filter(e => konto.positionen.includes(e.kategorie))
        .map(e => ({ datum: e.datum, betrag: parseFloat(e.betrag_brutto), beschreibung: e.beschreibung }))
        .sort((a, b) => new Date(a.datum) - new Date(b.datum));
    });

    const einnahmenKonten = Object.values(kontenMap)
      .filter(k => k.typ === 'einnahme')
      .sort((a, b) => a.nr.localeCompare(b.nr));
    const ausgabenKonten = Object.values(kontenMap)
      .filter(k => k.typ === 'ausgabe')
      .sort((a, b) => a.nr.localeCompare(b.nr));

    res.json({
      jahr: currentYear,
      kontorahmen: rahmen === 'skr04' ? 'SKR04' : 'SKR03',
      kleinunternehmer,
      einnahmen: einnahmenKonten,
      ausgaben: ausgabenKonten,
      summe_einnahmen: Math.round(totalEinnahmen * 100) / 100,
      summe_ausgaben: Math.round(totalAusgaben * 100) / 100,
      ergebnis: Math.round((totalEinnahmen - totalAusgaben) * 100) / 100
    });
  } catch (err) {
    console.error('GuV-SKR-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der SKR-Daten', error: err.message });
  }
});

// ===================================================================
// 📋 GET /api/buchhaltung/offene-posten/altersliste - Debitorenaltersliste
// ===================================================================
router.get('/offene-posten/altersliste', requireBuchhaltungAccess, async (req, res) => {
  const { organisation } = req.query;
  const dojoId = req.buchhaltungDojoId;
  const orgFilter = dojoId ? `AND m.dojo_id = ${db.escape(dojoId)}` : '';
  const today = new Date().toISOString().slice(0, 10);

  try {
    const pool = db.promise();
    const [rows] = await pool.query(
      `SELECT r.rechnung_id, r.rechnungsnummer, r.erstellt_am, r.faellig_am,
              COALESCE(r.brutto_betrag, r.betrag) AS betrag,
              r.status, m.vorname, m.nachname, m.email,
              DATEDIFF(?, COALESCE(r.faellig_am, r.erstellt_am)) AS tage_ueberfaellig
       FROM rechnungen r
       JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
       WHERE r.status IN ('offen','teilbezahlt')
         AND r.storniert = 0 ${orgFilter}
       ORDER BY tage_ueberfaellig DESC`,
      [today]
    );

    const buckets = { aktuell: [], d30: [], d60: [], d90: [], ueber90: [] };
    let summen = { aktuell: 0, d30: 0, d60: 0, d90: 0, ueber90: 0 };

    rows.forEach(r => {
      const t = Number(r.tage_ueberfaellig);
      const b = Number(r.betrag);
      const key = t <= 0 ? 'aktuell' : t <= 30 ? 'd30' : t <= 60 ? 'd60' : t <= 90 ? 'd90' : 'ueber90';
      buckets[key].push(r);
      summen[key] += b;
    });

    Object.keys(summen).forEach(k => { summen[k] = Math.round(summen[k] * 100) / 100; });

    res.json({
      stichtag: today,
      buckets,
      summen,
      gesamt: Math.round(Object.values(summen).reduce((a, b) => a + b, 0) * 100) / 100
    });
  } catch (err) {
    res.status(500).json({ message: 'Fehler bei Altersliste', error: err.message });
  }
});

// ===================================================================
// 📄 GET /api/buchhaltung/mahnungen/:id/pdf - Mahnbrief PDF
// ===================================================================
router.get('/mahnungen/:id/pdf', requireBuchhaltungAccess, async (req, res) => {
  const dojoId = req.buchhaltungDojoId;
  try {
    const pool = db.promise();
    const [[mahn]] = await pool.query(
      `SELECT m.*, d.organisation_name AS dojo_name, d.strasse AS dojo_strasse,
              d.plz AS dojo_plz, d.ort AS dojo_ort, d.email AS dojo_email,
              d.telefon AS dojo_telefon, d.iban AS dojo_iban, d.bic AS dojo_bic
       FROM mahnungen m
       LEFT JOIN dojo d ON m.dojo_id = d.id
       WHERE m.mahnung_id = ? ${dojoId ? 'AND m.dojo_id = ' + db.escape(dojoId) : ''}`,
      [req.params.id]
    );
    if (!mahn) return res.status(404).json({ error: 'Mahnung nicht gefunden' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 60, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Mahnung_${mahn.mahnung_id}.pdf"`);
    doc.pipe(res);

    const fmtEur = (n) => Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '—';
    const mahnstufeText = ['', 'Mahnung', '2. Mahnung', 'Letzte Mahnung'];

    // Absender
    doc.fontSize(9).fillColor('#666')
       .text(`${mahn.dojo_name} · ${mahn.dojo_strasse} · ${mahn.dojo_plz} ${mahn.dojo_ort}`, 60, 60);

    // Empfänger
    doc.fontSize(11).fillColor('#000')
       .text(mahn.schuldner_name, 60, 110)
       .moveDown(3);

    // Datum + Ort
    doc.fontSize(10).text(`${mahn.dojo_ort || ''}, ${fmtDate(mahn.erstellt_am)}`, { align: 'right' });
    doc.moveDown(2);

    // Betreff
    const stufe = mahnstufeText[mahn.mahnstufe] || 'Mahnung';
    doc.fontSize(13).font('Helvetica-Bold')
       .text(`${stufe} — Offene Forderung`, 60);
    doc.moveDown(1);

    // Anrede
    doc.fontSize(11).font('Helvetica')
       .text(`Sehr geehrte(r) ${mahn.schuldner_name},`).moveDown(0.5);

    if (mahn.mahntext) {
      doc.text(mahn.mahntext).moveDown(1);
    } else {
      doc.text(`trotz unserer freundlichen Erinnerung ist die unten genannte Forderung bisher noch nicht bei uns eingegangen. Wir bitten Sie, den offenen Betrag umgehend zu begleichen.`).moveDown(1);
    }

    // Tabelle
    const tableTop = doc.y + 10;
    doc.rect(60, tableTop, 475, 22).fill('#f5f5f5');
    doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
    doc.text('Position', 65, tableTop + 6);
    doc.text('Fälligkeit', 250, tableTop + 6);
    doc.text('Betrag', 430, tableTop + 6, { width: 100, align: 'right' });

    const rowTop = tableTop + 28;
    doc.font('Helvetica').fontSize(10);
    doc.text(`Rechnung ${mahn.rechnung_id ? '#' + mahn.rechnung_id : ''}`, 65, rowTop);
    doc.text(fmtDate(mahn.faelligkeitsdatum), 250, rowTop);
    doc.text(fmtEur(mahn.offener_betrag), 430, rowTop, { width: 100, align: 'right' });

    if (Number(mahn.mahngebuehr) > 0) {
      const feeTop = rowTop + 20;
      doc.text('Mahngebühr', 65, feeTop);
      doc.text(fmtEur(mahn.mahngebuehr), 430, feeTop, { width: 100, align: 'right' });
    }

    const totalBetrag = Number(mahn.offener_betrag) + Number(mahn.mahngebuehr || 0);
    const totalTop = rowTop + (Number(mahn.mahngebuehr) > 0 ? 50 : 30);
    doc.moveTo(60, totalTop).lineTo(535, totalTop).stroke();
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Gesamtbetrag:', 65, totalTop + 8);
    doc.text(fmtEur(totalBetrag), 430, totalTop + 8, { width: 100, align: 'right' });

    doc.moveDown(3).font('Helvetica').fontSize(10);
    doc.text(`Bitte überweisen Sie den Betrag von ${fmtEur(totalBetrag)} bis spätestens 7 Tage nach Erhalt dieses Schreibens auf unser Konto:`);
    doc.moveDown(0.5);
    if (mahn.dojo_iban) doc.text(`IBAN: ${mahn.dojo_iban}  BIC: ${mahn.dojo_bic || ''}`);
    doc.moveDown(2);
    doc.text('Sollten Sie bereits gezahlt haben, betrachten Sie dieses Schreiben als gegenstandslos.');
    doc.moveDown(2);
    doc.text('Mit freundlichen Grüßen');
    doc.moveDown(1);
    doc.text(mahn.dojo_name || '');

    doc.end();
  } catch (err) {
    console.error('Mahnbrief-PDF-Fehler:', err);
    res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen', details: err.message });
  }
});

// ===================================================================
// 📊 GET /api/buchhaltung/bilanz - Balance Sheet (HGB §266)
// ===================================================================
router.get('/bilanz', requireBuchhaltungAccess, (req, res) => {
  const { organisation, jahr } = req.query;
  const currentYear = parseInt(jahr) || new Date().getFullYear();

  const _of = buildOrgFilter(req, organisation);
  const orgFilter = _of.params.length ? _of.sql.replace('?', db.escape(_of.params[0])) : '';

  // dojoFilter always uses numeric dojo_id (map org name for super-admin)
  let dojoIdValue = req.buchhaltungDojoId;
  if (dojoIdValue === null || dojoIdValue === undefined) {
    if (organisation === 'TDA International') dojoIdValue = 2;
    else if (organisation === 'Kampfkunstschule Schreiner') dojoIdValue = 3;
    else dojoIdValue = null; // alle
  }
  const dojoFilter = dojoIdValue ? `AND dojo_id = ${db.escape(dojoIdValue)}` : '';

  const stammdatenSql = `SELECT * FROM bilanz_stammdaten WHERE jahr = ? ${dojoFilter} LIMIT 1`;
  const bankBestandSql = `SELECT COALESCE(SUM(bank_saldo), 0) as bank_saldo FROM v_bilanz_bank_bestand WHERE jahr <= ? ${orgFilter}`;
  const forderungenSql = `SELECT COALESCE(SUM(forderungen), 0) as forderungen FROM v_bilanz_forderungen WHERE jahr = ? ${dojoFilter}`;
  const jahresueberschussSql = `SELECT COALESCE(SUM(jahresueberschuss), 0) as jahresueberschuss FROM v_bilanz_eigenkapital WHERE jahr = ? ${dojoFilter}`;
  const kassenbuchSql = `SELECT kassenstand_nachher_cent / 100 as kasse_aktuell FROM kassenbuch WHERE dojo_id = ? AND geschaeft_datum <= ? ORDER BY geschaeft_datum DESC, eintrag_timestamp DESC LIMIT 1`;
  // Auto-Sachanlagen aus Anlagenregister
  const anlageAutoSql = dojoIdValue
    ? `SELECT COALESCE(SUM(buchwert_aktuell), 0) AS sachanlagen_auto FROM v_bilanz_anlagevermoegen WHERE dojo_id = ?`
    : `SELECT COALESCE(SUM(buchwert_aktuell), 0) AS sachanlagen_auto FROM v_bilanz_anlagevermoegen`;
  // USt-Schulden aus eingereichten Meldungen
  const ustSchuldenSql = dojoIdValue
    ? `SELECT COALESCE(SUM(zahllast), 0) AS ust_schulden FROM ustVA_abgaben WHERE dojo_id = ? AND jahr = ? AND abgabe_status IN ('eingereicht','korrektur')`
    : `SELECT 0 AS ust_schulden`;

  Promise.all([
    new Promise((resolve, reject) => db.query(stammdatenSql, [currentYear], (err, r) => err ? reject(err) : resolve(r[0] || {}))),
    new Promise((resolve, reject) => db.query(bankBestandSql, [currentYear], (err, r) => err ? reject(err) : resolve(r[0] || {}))),
    new Promise((resolve, reject) => db.query(forderungenSql, [currentYear], (err, r) => err ? reject(err) : resolve(r[0] || {}))),
    new Promise((resolve, reject) => db.query(jahresueberschussSql, [currentYear], (err, r) => err ? reject(err) : resolve(r[0] || {}))),
    new Promise((resolve, reject) => {
      if (!dojoIdValue) return resolve({ kasse_aktuell: 0 });
      db.query(kassenbuchSql, [dojoIdValue, `${currentYear}-12-31`], (err, r) => err ? reject(err) : resolve(r[0] || {}));
    }),
    new Promise((resolve, reject) => {
      const params = dojoIdValue ? [dojoIdValue] : [];
      db.query(anlageAutoSql, params, (err, r) => err ? resolve({ sachanlagen_auto: 0 }) : resolve(r[0] || {}));
    }),
    new Promise((resolve, reject) => {
      const params = dojoIdValue ? [dojoIdValue, currentYear] : [];
      db.query(ustSchuldenSql, params, (err, r) => err ? resolve({ ust_schulden: 0 }) : resolve(r[0] || {}));
    })
  ])
  .then(([stammdaten, bankBestand, forderungen, jahresueberschussRow, kassenbuch, anlageAuto, ustSchuldenRow]) => {
    // --- AKTIVA ---
    const immatVG = parseFloat(stammdaten.immat_vermoegensgegenstaende || 0);
    // Auto-Buchwert aus Anlagenregister hat Vorrang vor manuellem Stammdaten-Wert
    const sachanlagenAuto = parseFloat(anlageAuto.sachanlagen_auto || 0);
    const sachanlagenManuell = parseFloat(stammdaten.sachanlagen || 0);
    const sachanlagen = sachanlagenAuto > 0 ? sachanlagenAuto : sachanlagenManuell;
    const finanzanlagen = parseFloat(stammdaten.finanzanlagen || 0);
    const gesamtAnlage = immatVG + sachanlagen + finanzanlagen;

    const vorraete = parseFloat(stammdaten.vorraete || 0);
    const forderungenLL = parseFloat(forderungen.forderungen || 0);
    const sonstigeForderungen = parseFloat(stammdaten.sonstige_forderungen || 0);
    const bankGuthaben = parseFloat(stammdaten.bank_anfangsbestand || 0) + parseFloat(bankBestand.bank_saldo || 0);
    // Kassenbuch-Saldo hat Vorrang vor Stammdaten-Anfangsbestand
    const kassenbestand = kassenbuch.kasse_aktuell !== undefined
      ? parseFloat(kassenbuch.kasse_aktuell || 0)
      : parseFloat(stammdaten.kasse_anfangsbestand || 0);
    const gesamtUmlauf = vorraete + forderungenLL + sonstigeForderungen + bankGuthaben + kassenbestand;

    const rapAktiv = parseFloat(stammdaten.rechnungsabgrenzung_aktiv || 0);
    const gesamtAktiva = gesamtAnlage + gesamtUmlauf + rapAktiv;

    // --- PASSIVA ---
    const eigenkapitalAnfang = parseFloat(stammdaten.eigenkapital_anfang || 0);
    // Gewinnvortrag kommt aus Stammdaten (manuell eingetragen aus geprüftem Vorjahresabschluss)
    const gewinnvortrag = parseFloat(stammdaten.gewinnvortrag || 0);
    const jahresueberschuss = parseFloat(jahresueberschussRow.jahresueberschuss || 0);
    const gesamtEigenkapital = eigenkapitalAnfang + gewinnvortrag + jahresueberschuss;

    const steuerrueck = parseFloat(stammdaten.steuerrueckstellungen || 0);
    const sonstigeRueck = parseFloat(stammdaten.sonstige_rueckstellungen || 0);
    const gesamtRueckstellungen = steuerrueck + sonstigeRueck;

    const darlehen = parseFloat(stammdaten.darlehen || 0);
    const verbLieferanten = parseFloat(stammdaten.verbindlichkeiten_lieferanten || 0);
    const sonstigeVerb = parseFloat(stammdaten.sonstige_verbindlichkeiten || 0);
    // USt-Schulden: manuell überschrieben oder auto aus eingereichten UStVA-Meldungen
    const ustSchuldenAuto = parseFloat(ustSchuldenRow.ust_schulden || 0);
    const ustSchuldenStamm = parseFloat(stammdaten.ust_schulden || 0);
    const ustSchulden = (stammdaten.ust_schulden_manuell) ? ustSchuldenStamm : ustSchuldenAuto;
    const gesamtVerbindlichkeiten = darlehen + verbLieferanten + sonstigeVerb + ustSchulden;

    const rapPassiv = parseFloat(stammdaten.rechnungsabgrenzung_passiv || 0);
    const gesamtPassiva = gesamtEigenkapital + gesamtRueckstellungen + gesamtVerbindlichkeiten + rapPassiv;

    res.json({
      jahr: currentYear,
      organisation: organisation || 'alle',
      stammdaten_vorhanden: Object.keys(stammdaten).length > 0,
      aktiva: {
        anlagevermoegen: {
          immat_vermoegensgegenstaende: immatVG,
          sachanlagen,
          sachanlagen_auto: sachanlagenAuto,
          sachanlagen_quelle: sachanlagenAuto > 0 ? 'auto' : 'manuell',
          finanzanlagen,
          gesamt: gesamtAnlage
        },
        umlaufvermoegen: {
          vorraete,
          forderungen_ll: forderungenLL,
          sonstige_forderungen: sonstigeForderungen,
          bank_guthaben: bankGuthaben,
          kassenbestand,
          gesamt: gesamtUmlauf
        },
        rechnungsabgrenzung: rapAktiv,
        gesamt: gesamtAktiva
      },
      passiva: {
        eigenkapital: {
          anfangsbestand: eigenkapitalAnfang,
          gewinnvortrag,
          jahresueberschuss,
          gesamt: gesamtEigenkapital
        },
        rueckstellungen: {
          steuerrueckstellungen: steuerrueck,
          sonstige_rueckstellungen: sonstigeRueck,
          gesamt: gesamtRueckstellungen
        },
        verbindlichkeiten: {
          darlehen,
          verbindlichkeiten_lieferanten: verbLieferanten,
          sonstige_verbindlichkeiten: sonstigeVerb,
          ust_schulden: ustSchulden,
          ust_schulden_auto: ustSchuldenAuto,
          ust_schulden_manuell: !!(stammdaten.ust_schulden_manuell),
          gesamt: gesamtVerbindlichkeiten
        },
        rechnungsabgrenzung: rapPassiv,
        gesamt: gesamtPassiva
      },
      bilanz_ausgeglichen: Math.abs(gesamtAktiva - gesamtPassiva) < 0.01,
      // Rohe Stammdaten-Felder für Frontend-Speichervorgänge (z.B. Inline-Edit Gewinnvortrag)
      raw: {
        bank_anfangsbestand: parseFloat(stammdaten.bank_anfangsbestand || 0),
        kasse_anfangsbestand: parseFloat(stammdaten.kasse_anfangsbestand || 0),
        sachanlagen: parseFloat(stammdaten.sachanlagen || 0),
        sachanlagen_beschreibung: stammdaten.sachanlagen_beschreibung || '',
        immat_vermoegensgegenstaende: parseFloat(stammdaten.immat_vermoegensgegenstaende || 0),
        finanzanlagen: parseFloat(stammdaten.finanzanlagen || 0),
        vorraete: parseFloat(stammdaten.vorraete || 0),
        sonstige_forderungen: parseFloat(stammdaten.sonstige_forderungen || 0),
        rechnungsabgrenzung_aktiv: parseFloat(stammdaten.rechnungsabgrenzung_aktiv || 0),
        eigenkapital_anfang: parseFloat(stammdaten.eigenkapital_anfang || 0),
        gewinnvortrag: parseFloat(stammdaten.gewinnvortrag || 0),
        darlehen: parseFloat(stammdaten.darlehen || 0),
        darlehen_beschreibung: stammdaten.darlehen_beschreibung || '',
        steuerrueckstellungen: parseFloat(stammdaten.steuerrueckstellungen || 0),
        sonstige_rueckstellungen: parseFloat(stammdaten.sonstige_rueckstellungen || 0),
        verbindlichkeiten_lieferanten: parseFloat(stammdaten.verbindlichkeiten_lieferanten || 0),
        sonstige_verbindlichkeiten: parseFloat(stammdaten.sonstige_verbindlichkeiten || 0),
        rechnungsabgrenzung_passiv: parseFloat(stammdaten.rechnungsabgrenzung_passiv || 0),
        ust_schulden: parseFloat(stammdaten.ust_schulden || 0),
        ust_schulden_manuell: !!(stammdaten.ust_schulden_manuell)
      }
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
router.post('/bilanz/stammdaten', requireBuchhaltungAccess, (req, res) => {
  const {
    organisation, jahr,
    bank_anfangsbestand, kasse_anfangsbestand,
    sachanlagen, sachanlagen_beschreibung,
    immat_vermoegensgegenstaende, finanzanlagen,
    vorraete, sonstige_forderungen, rechnungsabgrenzung_aktiv,
    eigenkapital_anfang, gewinnvortrag,
    darlehen, darlehen_beschreibung,
    steuerrueckstellungen, sonstige_rueckstellungen,
    verbindlichkeiten_lieferanten, sonstige_verbindlichkeiten,
    rechnungsabgrenzung_passiv,
    ust_schulden, ust_schulden_manuell
  } = req.body;

  let dojoId = req.buchhaltungDojoId;
  if (!dojoId) {
    dojoId = organisation === 'TDA International' ? 2 : organisation === 'Kampfkunstschule Schreiner' ? 3 : 1;
  }
  const orgName = organisation || 'Kampfkunstschule Schreiner';
  const userId = req.user?.user_id || req.user?.id || 1;

  const sql = `
    INSERT INTO bilanz_stammdaten (
      dojo_id, organisation_name, jahr,
      bank_anfangsbestand, kasse_anfangsbestand,
      sachanlagen, sachanlagen_beschreibung,
      immat_vermoegensgegenstaende, finanzanlagen,
      vorraete, sonstige_forderungen, rechnungsabgrenzung_aktiv,
      eigenkapital_anfang, gewinnvortrag,
      darlehen, darlehen_beschreibung,
      steuerrueckstellungen, sonstige_rueckstellungen,
      verbindlichkeiten_lieferanten, sonstige_verbindlichkeiten,
      rechnungsabgrenzung_passiv, ust_schulden, ust_schulden_manuell,
      erstellt_von
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      bank_anfangsbestand = VALUES(bank_anfangsbestand),
      kasse_anfangsbestand = VALUES(kasse_anfangsbestand),
      sachanlagen = VALUES(sachanlagen),
      sachanlagen_beschreibung = VALUES(sachanlagen_beschreibung),
      immat_vermoegensgegenstaende = VALUES(immat_vermoegensgegenstaende),
      finanzanlagen = VALUES(finanzanlagen),
      vorraete = VALUES(vorraete),
      sonstige_forderungen = VALUES(sonstige_forderungen),
      rechnungsabgrenzung_aktiv = VALUES(rechnungsabgrenzung_aktiv),
      eigenkapital_anfang = VALUES(eigenkapital_anfang),
      gewinnvortrag = VALUES(gewinnvortrag),
      darlehen = VALUES(darlehen),
      darlehen_beschreibung = VALUES(darlehen_beschreibung),
      steuerrueckstellungen = VALUES(steuerrueckstellungen),
      sonstige_rueckstellungen = VALUES(sonstige_rueckstellungen),
      verbindlichkeiten_lieferanten = VALUES(verbindlichkeiten_lieferanten),
      sonstige_verbindlichkeiten = VALUES(sonstige_verbindlichkeiten),
      rechnungsabgrenzung_passiv = VALUES(rechnungsabgrenzung_passiv),
      ust_schulden = VALUES(ust_schulden),
      ust_schulden_manuell = VALUES(ust_schulden_manuell),
      geaendert_von = VALUES(erstellt_von),
      geaendert_am = CURRENT_TIMESTAMP
  `;

  db.query(sql, [
    dojoId, orgName, parseInt(jahr) || new Date().getFullYear(),
    bank_anfangsbestand || 0, kasse_anfangsbestand || 0,
    sachanlagen || 0, sachanlagen_beschreibung || '',
    immat_vermoegensgegenstaende || 0, finanzanlagen || 0,
    vorraete || 0, sonstige_forderungen || 0, rechnungsabgrenzung_aktiv || 0,
    eigenkapital_anfang || 0, gewinnvortrag || 0,
    darlehen || 0, darlehen_beschreibung || '',
    steuerrueckstellungen || 0, sonstige_rueckstellungen || 0,
    verbindlichkeiten_lieferanten || 0, sonstige_verbindlichkeiten || 0,
    rechnungsabgrenzung_passiv || 0,
    ust_schulden || 0, ust_schulden_manuell ? 1 : 0,
    userId
  ], (err, result) => {
    if (err) {
      console.error('Stammdaten-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Speichern der Stammdaten', error: err.message });
    }
    res.json({ message: 'Bilanz-Stammdaten erfolgreich gespeichert', stammdaten_id: result.insertId || result.affectedRows });
  });
});

// ===================================================================
// 📤 GET /api/buchhaltung/guv/export - GuV Export (PDF/CSV)
// ===================================================================
router.get('/guv/export', requireBuchhaltungAccess, (req, res) => {
  const { organisation, jahr, format = 'csv' } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  let dateFilter = `jahr = ${db.escape(currentYear)}`;
  const _of = buildOrgFilter(req, organisation);
  const orgFilter = _of.params.length ? _of.sql.replace('?', db.escape(_of.params[0])) : '';

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
router.get('/bilanz/export', requireBuchhaltungAccess, (req, res) => {
  const { organisation, jahr, format = 'csv' } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  const _bef = buildOrgFilter(req, organisation);
  const orgFilter = _bef.params.length ? _bef.sql.replace('?', db.escape(_bef.params[0])) : '';
  const dojoFilter = _bef.params.length ? `AND dojo_id = ${db.escape(_bef.params[0])}` : '';

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

// ===================================================================
// 📊 GET /api/buchhaltung/export/datev - DATEV CSV Export
// ===================================================================
router.get('/export/datev', requireBuchhaltungAccess, async (req, res) => {
  const jahr = parseInt(req.query.jahr) || new Date().getFullYear();
  const dojoId = req.buchhaltungDojoId;

  let sql = 'SELECT * FROM buchhaltung_belege WHERE YEAR(buchungsdatum) = ? AND status != "storniert"';
  const params = [jahr];
  if (dojoId !== null && dojoId !== undefined) {
    sql += ' AND dojo_id = ?';
    params.push(dojoId);
  }
  sql += ' ORDER BY buchungsdatum ASC';

  try {
    const belege = await new Promise((resolve, reject) =>
      db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
    );

    const kontoMap = {
      betriebseinnahmen: '8400',
      wareneingang: '3400',
      personalkosten: '4110',
      raumkosten: '4210',
      versicherungen: '4360',
      kfz_kosten: '4530',
      werbekosten: '4610',
      reisekosten: '4670',
      telefon_internet: '4920',
      software: '4970',
      buerokosten: '4730',
      fortbildung: '4900',
      abschreibungen: '4830',
      bankgebuehren: '4970',
      ausstattung: '4985',
      steuerzahlungen: '4320',
      sonstige_kosten: '4970',
      privateinlage: '1800',
      privatentnahme: '1800'
    };

    const datevDate = new Date(jahr, 0, 1).toISOString().slice(0, 10).replace(/-/g, '');

    // DATEV header line 1
    const header1 = `"EXTF";700;21;"Buchungsstapel";13;${datevDate};;"DOJOSOFTWARE";;;"";1;${datevDate};4;${jahr};12;;;`;

    // DATEV header line 2 (column names)
    const header2 = 'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext;Postensperre;Diverse Adressnummer;Geschäftspartnerbank;Sachverhalt;Zinssperre;Beleglink;Beleginfo - Art 1;Beleginfo - Inhalt 1;Beleginfo - Art 2;Beleginfo - Inhalt 2;KOST1 - Kostenstelle;KOST2 - Kostenstelle;Kost-Menge;EU-Land u. UStId;EU-Steuersatz;Abw. Versteuerungsart;Sachverhalt L+L;Funktionsergänzung L+L;BU 49 Hauptfunktionstyp;BU 49 Hauptfunktionsnummer;BU 49 Funktionsergänzung;Zusatzinformation - Art 1;Zusatzinformation- Inhalt 1;Zusatzinformation - Art 2;Zusatzinformation- Inhalt 2;Zusatzinformation - Art 3;Zusatzinformation- Inhalt 3;Zusatzinformation - Art 4;Zusatzinformation- Inhalt 4;Stück;Gewicht;Zahlweise;Forderungsart;Veranlagungsjahr;Zugeordnete Fälligkeit;Skontotyp;Auftragsnummer;Buchungstyp;Ust-Schlüssel (Vorsystem);EU-Mitgliedstaat (Vorsystem);Sachverhalt§13b UStG (Vorsystem);EU-Steuersatz (Vorsystem);Erlöskonto (Vorsystem);Herkunft-Kz;Buchungs GUID;KOST-Datum;SEPA-Mandatsreferenz;Skontosperre;Gesellschaftername;Beteiligtennummer;Identifikationsnummer;Zeichnernummer;Postensperre bis;Bezeichnung SoBil-Sachverhalt;Kennzeichen SoBil-Buchung;Festschreibung;Leistungsdatum;Leistungsdatum Ende';

    const lines = [header1, header2];

    for (const b of belege) {
      const betrag = parseFloat(b.betrag_netto || 0).toFixed(2).replace('.', ',');
      const shKz = b.buchungsart === 'ausgabe' ? 'S' : 'H';
      const konto = kontoMap[b.kategorie] || '4970';
      const gegenkonto = '1800';

      let buSchluessel = '';
      const mwst = parseInt(b.mwst_satz || 0);
      if (mwst === 7) buSchluessel = '9';
      else if (mwst === 0) buSchluessel = '40';

      const datum = b.buchungsdatum ? new Date(b.buchungsdatum) : new Date();
      const dd = String(datum.getDate()).padStart(2, '0');
      const mm = String(datum.getMonth() + 1).padStart(2, '0');
      const belegdatum = `${dd}${mm}`;

      const belegfeld1 = b.beleg_nummer || '';
      const buchungstext = (b.beschreibung || '').substring(0, 60);

      // Build CSV line: only first 14 fields populated, rest empty (73 total columns = 72 semicolons)
      const fields = [
        betrag,      // Umsatz
        shKz,        // S/H
        'EUR',       // WKZ
        '',          // Kurs
        '',          // Basis-Umsatz
        '',          // WKZ Basis
        konto,       // Konto
        gegenkonto,  // Gegenkonto
        buSchluessel,// BU-Schlüssel
        belegdatum,  // Belegdatum
        belegfeld1,  // Belegfeld 1
        '',          // Belegfeld 2
        '',          // Skonto
        buchungstext // Buchungstext
      ];

      // Pad to 74 fields (73 semicolons) as required by DATEV format
      while (fields.length < 74) fields.push('');

      lines.push(fields.join(';'));
    }

    const csv = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=latin1');
    res.setHeader('Content-Disposition', `attachment; filename=DATEV_Buchungsstapel_${jahr}.csv`);
    res.send(Buffer.from(csv, 'latin1'));
  } catch (err) {
    console.error('DATEV-Export-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim DATEV-Export', error: err.message });
  }
});

// ===================================================================
// GET /api/buchhaltung/einstellungen - Steuerliche Einstellungen des Dojos
// ===================================================================
router.get('/einstellungen', requireBuchhaltungAccess, async (req, res) => {
  const dojoId = req.buchhaltungDojoId;

  if (dojoId === null || dojoId === undefined) {
    // Super-Admin: no specific dojo selected, return defaults
    return res.json({ kleinunternehmer: false, umsatzsteuerpflichtig: true });
  }

  try {
    const rows = await new Promise((resolve, reject) =>
      db.query(
        'SELECT kleinunternehmer, umsatzsteuerpflichtig, gemeinnuetzig, rechtsform, steuernummer, umsatzsteuer_id, finanzamt FROM dojo WHERE dojo_id = ?',
        [dojoId],
        (err, r) => err ? reject(err) : resolve(r)
      )
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Dojo nicht gefunden' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Einstellungen-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Einstellungen', error: err.message });
  }
});

// ===================================================================
// 📐 AfA-BERECHNUNG (Lineare Abschreibung nach § 7 EStG)
// ===================================================================

const dbQuery = (sql, params) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
  );

function berechneAfaJahre(anschaffungskosten, restwert, nutzungsdauer, kaufdatum) {
  const aks = parseFloat(anschaffungskosten);
  const rw  = parseFloat(restwert) || 0;
  const nd  = parseInt(nutzungsdauer);
  const kauf = new Date(kaufdatum);
  const kaufJahr  = kauf.getFullYear();
  const kaufMonat = kauf.getMonth() + 1; // 1–12

  const basis      = aks - rw;
  const jahresAfa  = basis / nd;
  const anteilMon  = 12 - kaufMonat + 1;
  const erstjahrAfa = Math.round(jahresAfa * (anteilMon / 12) * 100) / 100;

  const positionen = [];
  let buchwert = aks;

  for (let i = 0; i < nd; i++) {
    const ist_erstes_jahr  = i === 0 ? 1 : 0;
    const ist_letztes_jahr = i === nd - 1 ? 1 : 0;
    let afa;
    if (ist_erstes_jahr)       afa = erstjahrAfa;
    else if (ist_letztes_jahr) afa = Math.max(0, Math.round((buchwert - rw) * 100) / 100);
    else                       afa = Math.round(jahresAfa * 100) / 100;

    const endeWert = Math.max(rw, Math.round((buchwert - afa) * 100) / 100);
    positionen.push({
      afa_jahr: kaufJahr + i,
      afa_betrag: afa,
      buchwert_beginn: Math.round(buchwert * 100) / 100,
      buchwert_ende:   endeWert,
      ist_erstes_jahr,
      ist_letztes_jahr
    });
    buchwert = endeWert;
  }
  return positionen;
}

const ANLAGE_ORG_MAP = { 'TDA International': 2, 'Kampfkunstschule Schreiner': 3 };

// ===================================================================
// 📋 GET /api/buchhaltung/anlagevermögen
// ===================================================================
router.get('/anlageverm%C3%B6gen', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { organisation } = req.query;
    const of = buildOrgFilter(req, organisation);
    const where = of.sql ? `WHERE 1=1 ${of.sql}` : 'WHERE 1=1';
    const rows = await dbQuery(
      `SELECT ar.*,
         (SELECT ap.afa_betrag FROM afa_positionen ap WHERE ap.anlage_id = ar.anlage_id AND ap.afa_jahr = YEAR(CURDATE())) AS afa_aktuelles_jahr,
         (SELECT ap.buchwert_ende FROM afa_positionen ap WHERE ap.anlage_id = ar.anlage_id AND ap.afa_jahr = YEAR(CURDATE())) AS buchwert_aktuell
       FROM anlage_register ar ${where} ORDER BY ar.kaufdatum DESC`,
      of.params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// ===================================================================
// 📋 GET /api/buchhaltung/anlagevermögen/:id/afa
// ===================================================================
router.get('/anlageverm%C3%B6gen/:id/afa', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [anlage] = await dbQuery('SELECT * FROM anlage_register WHERE anlage_id = ?', [req.params.id]);
    if (!anlage) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, anlage.dojo_id)) return;
    const positionen = await dbQuery('SELECT * FROM afa_positionen WHERE anlage_id = ? ORDER BY afa_jahr ASC', [req.params.id]);
    res.json({ anlage, positionen });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// ===================================================================
// ➕ POST /api/buchhaltung/anlagevermögen
// ===================================================================
router.post('/anlageverm%C3%B6gen', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { organisation_name, bezeichnung, beschreibung, anlage_kategorie,
            kaufdatum, anschaffungskosten, restwert = 0,
            nutzungsdauer, lieferant, rechnungsnummer } = req.body;
    if (!bezeichnung || !kaufdatum || !anschaffungskosten || !nutzungsdauer)
      return res.status(400).json({ message: 'Pflichtfelder fehlen' });

    const dojoId = req.buchhaltungDojoId || ANLAGE_ORG_MAP[organisation_name] || null;
    const orgName = organisation_name || (dojoId === 2 ? 'TDA International' : 'Kampfkunstschule Schreiner');

    const ins = await dbQuery(
      `INSERT INTO anlage_register (dojo_id, organisation_name, bezeichnung, beschreibung,
         anlage_kategorie, kaufdatum, anschaffungskosten, restwert, nutzungsdauer,
         lieferant, rechnungsnummer, erstellt_von)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [dojoId, orgName, bezeichnung, beschreibung || null, anlage_kategorie || 'sonstiges',
       kaufdatum, parseFloat(anschaffungskosten), parseFloat(restwert) || 0,
       parseInt(nutzungsdauer), lieferant || null, rechnungsnummer || null, req.user?.id || 1]
    );
    const anlageId = ins.insertId;

    const positionen = berechneAfaJahre(anschaffungskosten, restwert, nutzungsdauer, kaufdatum);
    for (const p of positionen) {
      await dbQuery(
        `INSERT INTO afa_positionen (anlage_id, dojo_id, organisation_name,
           afa_jahr, afa_betrag, buchwert_beginn, buchwert_ende, ist_erstes_jahr, ist_letztes_jahr)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [anlageId, dojoId, orgName, p.afa_jahr, p.afa_betrag,
         p.buchwert_beginn, p.buchwert_ende, p.ist_erstes_jahr, p.ist_letztes_jahr]
      );
    }
    res.status(201).json({ anlage_id: anlageId, afa_positionen: positionen });
  } catch (err) {
    console.error('Anlage-Create-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Anlegen', error: err.message });
  }
});

// ===================================================================
// ✏️ PUT /api/buchhaltung/anlagevermögen/:id
// ===================================================================
router.put('/anlageverm%C3%B6gen/:id', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [existing] = await dbQuery('SELECT dojo_id, organisation_name FROM anlage_register WHERE anlage_id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, existing.dojo_id)) return;

    const { bezeichnung, beschreibung, anlage_kategorie, kaufdatum,
            anschaffungskosten, restwert = 0, nutzungsdauer, lieferant, rechnungsnummer } = req.body;

    await dbQuery(
      `UPDATE anlage_register SET bezeichnung=?, beschreibung=?, anlage_kategorie=?,
         kaufdatum=?, anschaffungskosten=?, restwert=?, nutzungsdauer=?,
         lieferant=?, rechnungsnummer=?, geaendert_von=?
       WHERE anlage_id=?`,
      [bezeichnung, beschreibung || null, anlage_kategorie || 'sonstiges', kaufdatum,
       parseFloat(anschaffungskosten), parseFloat(restwert) || 0, parseInt(nutzungsdauer),
       lieferant || null, rechnungsnummer || null, req.user?.id || 1, req.params.id]
    );

    await dbQuery('DELETE FROM afa_positionen WHERE anlage_id = ?', [req.params.id]);
    const positionen = berechneAfaJahre(anschaffungskosten, restwert, nutzungsdauer, kaufdatum);
    for (const p of positionen) {
      await dbQuery(
        `INSERT INTO afa_positionen (anlage_id, dojo_id, organisation_name,
           afa_jahr, afa_betrag, buchwert_beginn, buchwert_ende, ist_erstes_jahr, ist_letztes_jahr)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [req.params.id, existing.dojo_id, existing.organisation_name,
         p.afa_jahr, p.afa_betrag, p.buchwert_beginn, p.buchwert_ende,
         p.ist_erstes_jahr, p.ist_letztes_jahr]
      );
    }
    res.json({ message: 'Aktualisiert', afa_positionen: positionen });
  } catch (err) {
    console.error('Anlage-Update-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Aktualisieren', error: err.message });
  }
});

// ===================================================================
// 🗑️ DELETE /api/buchhaltung/anlagevermögen/:id
// ===================================================================
router.delete('/anlageverm%C3%B6gen/:id', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [row] = await dbQuery('SELECT dojo_id FROM anlage_register WHERE anlage_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, row.dojo_id)) return;
    await dbQuery('UPDATE anlage_register SET aktiv=0, ausgeschieden_am=CURDATE(), geaendert_von=? WHERE anlage_id=?',
      [req.user?.id || 1, req.params.id]);
    res.json({ message: 'Anlage ausgeschieden' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// ===================================================================
// 💳 KREDITOREN / LIEFERANTENAKTE
// ===================================================================

router.get('/kreditoren', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const dojoId = req.buchhaltungDojoId;
    const orgFilter = req.query.organisation;
    let sql = 'SELECT * FROM kreditoren WHERE aktiv = 1';
    const params = [];
    if (dojoId) {
      sql += ' AND dojo_id = ?'; params.push(dojoId);
    } else if (orgFilter && orgFilter !== 'alle') {
      sql += ' AND organisation_name = ?'; params.push(orgFilter);
    }
    if (req.query.q) {
      sql += ' AND name LIKE ?'; params.push(`%${req.query.q}%`);
    }
    sql += ' ORDER BY name ASC';
    const rows = await dbQuery(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

router.post('/kreditoren', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { organisation_name, name, kurzname, adresse, email, telefon, ust_id, zahlungsziel_tage = 14, iban, bic, notizen } = req.body;
    if (!name) return res.status(400).json({ message: 'Name ist Pflichtfeld' });
    const _orgMap = { 'TDA International': 2, 'Kampfkunstschule Schreiner': 3 };
    const dojoId = req.buchhaltungDojoId || _orgMap[organisation_name] || null;
    if (!dojoId) return res.status(400).json({ message: 'Dojo-ID fehlt' });
    const result = await dbQuery(
      `INSERT INTO kreditoren (dojo_id, organisation_name, name, kurzname, adresse, email, telefon, ust_id, zahlungsziel_tage, iban, bic, notizen)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [dojoId, organisation_name || `Dojo ${dojoId}`, name, kurzname||null, adresse||null, email||null, telefon||null, ust_id||null, zahlungsziel_tage, iban||null, bic||null, notizen||null]
    );
    res.status(201).json({ kreditor_id: result.insertId, message: 'Kreditor angelegt' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

router.put('/kreditoren/:id', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [row] = await dbQuery('SELECT dojo_id FROM kreditoren WHERE kreditor_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, row.dojo_id)) return;
    const { name, kurzname, adresse, email, telefon, ust_id, zahlungsziel_tage, iban, bic, notizen } = req.body;
    await dbQuery(
      `UPDATE kreditoren SET name=?, kurzname=?, adresse=?, email=?, telefon=?, ust_id=?, zahlungsziel_tage=?, iban=?, bic=?, notizen=? WHERE kreditor_id=?`,
      [name, kurzname||null, adresse||null, email||null, telefon||null, ust_id||null, zahlungsziel_tage||14, iban||null, bic||null, notizen||null, req.params.id]
    );
    res.json({ message: 'Aktualisiert' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

router.delete('/kreditoren/:id', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [row] = await dbQuery('SELECT dojo_id FROM kreditoren WHERE kreditor_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, row.dojo_id)) return;
    await dbQuery('UPDATE kreditoren SET aktiv=0 WHERE kreditor_id=?', [req.params.id]);
    res.json({ message: 'Gelöscht' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// ===================================================================
// 📋 OFFENE POSTEN + MAHNWESEN
// ===================================================================

// GET /offene-posten — listet unbezahlte Belege + externe Rechnungen
router.get('/offene-posten', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const dojoId = req.buchhaltungDojoId;
    const orgFilter = req.query.organisation;
    let dojoWhere = '';
    const params = [];
    if (dojoId) {
      dojoWhere = 'AND b.dojo_id = ?'; params.push(dojoId);
    } else if (orgFilter && orgFilter !== 'alle') {
      dojoWhere = 'AND b.organisation_name = ?'; params.push(orgFilter);
    }

    // Belege ohne zugehörige bezahlte Transaktion (offene Ausgaben-Belege als Verbindlichkeiten)
    // Für EÜR: offene Forderungen = Rechnungen aus dem Rechnungsmodul die noch offen sind
    const offeneRechnungen = await dbQuery(`
      SELECT
        r.rechnung_id,
        r.rechnungsnummer,
        r.gesamtbetrag AS betrag,
        r.erstellt_am AS beleg_datum,
        r.faellig_am AS faelligkeitsdatum,
        m.vorname, m.nachname,
        m.dojo_id,
        CASE WHEN m.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END AS organisation_name,
        DATEDIFF(CURDATE(), IFNULL(r.faellig_am, r.erstellt_am)) AS tage_ueberfaellig,
        COALESCE(mah.hoechste_stufe, 0) AS mahnstufe
      FROM rechnungen r
      JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      LEFT JOIN (
        SELECT rechnung_id, MAX(mahnstufe) AS hoechste_stufe FROM mahnungen WHERE storniert=0 AND bezahlt_am IS NULL GROUP BY rechnung_id
      ) mah ON mah.rechnung_id = r.rechnung_id
      WHERE r.status IN ('offen','ueberfaellig')
        ${dojoId ? 'AND m.dojo_id = ?' : (orgFilter && orgFilter !== 'alle') ? 'AND m.dojo_id = (SELECT dojo_id FROM mitglieder WHERE organisation_name = ? LIMIT 1)' : ''}
      ORDER BY tage_ueberfaellig DESC
    `, dojoId ? [dojoId] : (orgFilter && orgFilter !== 'alle' ? [orgFilter] : []));

    const mahnungen = await dbQuery(`
      SELECT mah.*, r.rechnungsnummer
      FROM mahnungen mah
      LEFT JOIN rechnungen r ON r.rechnung_id = mah.rechnung_id
      WHERE mah.storniert = 0 AND mah.bezahlt_am IS NULL
        ${dojoId ? 'AND mah.dojo_id = ?' : (orgFilter && orgFilter !== 'alle') ? 'AND mah.organisation_name = ?' : ''}
      ORDER BY mah.erstellt_am DESC
    `, dojoId ? [dojoId] : (orgFilter && orgFilter !== 'alle' ? [orgFilter] : []));

    res.json({ offeneRechnungen, mahnungen });
  } catch (err) {
    console.error('Offene-Posten-Fehler:', err);
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// POST /mahnungen — neue Mahnung erstellen
router.post('/mahnungen', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { organisation_name, rechnung_id, mitglied_id, schuldner_name, offener_betrag,
            faelligkeitsdatum, mahnstufe = 1, mahngebuehr = 0, mahntext } = req.body;
    if (!schuldner_name || !offener_betrag || !faelligkeitsdatum) {
      return res.status(400).json({ message: 'Pflichtfelder fehlen' });
    }
    const _orgMap = { 'TDA International': 2, 'Kampfkunstschule Schreiner': 3 };
    const dojoId = req.buchhaltungDojoId || _orgMap[organisation_name] || null;
    if (!dojoId) return res.status(400).json({ message: 'Dojo-ID fehlt' });

    const result = await dbQuery(
      `INSERT INTO mahnungen (dojo_id, organisation_name, rechnung_id, mitglied_id, schuldner_name,
         offener_betrag, faelligkeitsdatum, mahnstufe, mahngebuehr, mahntext, erstellt_von)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [dojoId, organisation_name || `Dojo ${dojoId}`, rechnung_id||null, mitglied_id||null,
       schuldner_name, parseFloat(offener_betrag), faelligkeitsdatum, mahnstufe,
       parseFloat(mahngebuehr)||0, mahntext||null, req.user?.id||1]
    );
    res.status(201).json({ mahnung_id: result.insertId, message: 'Mahnung erstellt' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// PUT /mahnungen/:id/versandt
router.put('/mahnungen/:id/versandt', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [row] = await dbQuery('SELECT dojo_id FROM mahnungen WHERE mahnung_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, row.dojo_id)) return;
    const { versandt_per = 'email' } = req.body;
    await dbQuery('UPDATE mahnungen SET versandt_am=CURDATE(), versandt_per=? WHERE mahnung_id=?',
      [versandt_per, req.params.id]);
    res.json({ message: 'Als versandt markiert' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// PUT /mahnungen/:id/bezahlt
router.put('/mahnungen/:id/bezahlt', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [row] = await dbQuery('SELECT dojo_id FROM mahnungen WHERE mahnung_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, row.dojo_id)) return;
    await dbQuery('UPDATE mahnungen SET bezahlt_am=CURDATE() WHERE mahnung_id=?', [req.params.id]);
    res.json({ message: 'Als bezahlt markiert' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// DELETE (stornieren) /mahnungen/:id
router.delete('/mahnungen/:id', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [row] = await dbQuery('SELECT dojo_id FROM mahnungen WHERE mahnung_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, row.dojo_id)) return;
    await dbQuery('UPDATE mahnungen SET storniert=1 WHERE mahnung_id=?', [req.params.id]);
    res.json({ message: 'Storniert' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// ===================================================================
// 🔁 WIEDERKEHRENDE BUCHUNGEN
// ===================================================================

router.get('/wiederkehrend', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const dojoId = req.buchhaltungDojoId;
    const orgFilter = req.query.organisation;
    let sql = 'SELECT * FROM wiederkehrende_buchungen WHERE 1=1';
    const params = [];
    if (dojoId) {
      sql += ' AND dojo_id = ?'; params.push(dojoId);
    } else if (orgFilter && orgFilter !== 'alle') {
      sql += ' AND organisation_name = ?'; params.push(orgFilter);
    }
    sql += ' ORDER BY naechste_faelligkeit ASC';
    const rows = await dbQuery(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

router.post('/wiederkehrend', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const { organisation_name, bezeichnung, buchungsart = 'ausgabe', betrag_netto, mwst_satz = 19,
            kategorie, beschreibung, lieferant_kunde, intervall = 'monatlich',
            naechste_faelligkeit, auto_ausfuehren = 0 } = req.body;
    if (!bezeichnung || !betrag_netto || !kategorie || !naechste_faelligkeit) {
      return res.status(400).json({ message: 'Pflichtfelder fehlen' });
    }
    const _orgMap = { 'TDA International': 2, 'Kampfkunstschule Schreiner': 3 };
    const dojoId = req.buchhaltungDojoId || _orgMap[organisation_name] || null;
    if (!dojoId) return res.status(400).json({ message: 'Dojo-ID fehlt' });

    const result = await dbQuery(
      `INSERT INTO wiederkehrende_buchungen (dojo_id, organisation_name, bezeichnung, buchungsart,
         betrag_netto, mwst_satz, kategorie, beschreibung, lieferant_kunde, intervall,
         naechste_faelligkeit, auto_ausfuehren, erstellt_von)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [dojoId, organisation_name||`Dojo ${dojoId}`, bezeichnung, buchungsart,
       parseFloat(betrag_netto), parseFloat(mwst_satz), kategorie, beschreibung||null,
       lieferant_kunde||null, intervall, naechste_faelligkeit, auto_ausfuehren?1:0, req.user?.id||1]
    );
    res.status(201).json({ template_id: result.insertId, message: 'Template erstellt' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

router.put('/wiederkehrend/:id', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [row] = await dbQuery('SELECT dojo_id FROM wiederkehrende_buchungen WHERE template_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, row.dojo_id)) return;
    const { bezeichnung, buchungsart, betrag_netto, mwst_satz, kategorie, beschreibung,
            lieferant_kunde, intervall, naechste_faelligkeit, auto_ausfuehren, aktiv } = req.body;
    await dbQuery(
      `UPDATE wiederkehrende_buchungen SET bezeichnung=?, buchungsart=?, betrag_netto=?, mwst_satz=?,
         kategorie=?, beschreibung=?, lieferant_kunde=?, intervall=?, naechste_faelligkeit=?,
         auto_ausfuehren=?, aktiv=? WHERE template_id=?`,
      [bezeichnung, buchungsart, parseFloat(betrag_netto), parseFloat(mwst_satz), kategorie,
       beschreibung||null, lieferant_kunde||null, intervall, naechste_faelligkeit,
       auto_ausfuehren?1:0, aktiv===false?0:1, req.params.id]
    );
    res.json({ message: 'Aktualisiert' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

router.delete('/wiederkehrend/:id', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [row] = await dbQuery('SELECT dojo_id FROM wiederkehrende_buchungen WHERE template_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, row.dojo_id)) return;
    await dbQuery('DELETE FROM wiederkehrende_buchungen WHERE template_id=?', [req.params.id]);
    res.json({ message: 'Gelöscht' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// POST /wiederkehrend/:id/ausfuehren — bucht genau dieses Template als Beleg
router.post('/wiederkehrend/:id/ausfuehren', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const [tmpl] = await dbQuery('SELECT * FROM wiederkehrende_buchungen WHERE template_id = ?', [req.params.id]);
    if (!tmpl) return res.status(404).json({ message: 'Nicht gefunden' });
    if (!checkDojoOwnership(req, res, tmpl.dojo_id)) return;

    const netto = parseFloat(tmpl.betrag_netto);
    const mwst = parseFloat(tmpl.mwst_satz);
    const mwstBetrag = Math.round(netto * (mwst / 100) * 100) / 100;
    const brutto = Math.round((netto + mwstBetrag) * 100) / 100;
    const heute = new Date().toISOString().split('T')[0];
    const jahr = new Date().getFullYear();

    const belegNummer = await generateBelegNummer(tmpl.dojo_id, jahr);
    const result = await dbQuery(
      `INSERT INTO buchhaltung_belege (beleg_nummer, dojo_id, organisation_name, buchungsart,
         beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
         kategorie, beschreibung, lieferant_kunde, erstellt_von)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [belegNummer, tmpl.dojo_id, tmpl.organisation_name, tmpl.buchungsart,
       heute, heute, netto, mwst, mwstBetrag, brutto,
       tmpl.kategorie, tmpl.beschreibung || tmpl.bezeichnung, tmpl.lieferant_kunde||null, req.user?.id||1]
    );

    // Nächste Fälligkeit berechnen
    const naechste = berechnenaechsteFaelligkeit(tmpl.naechste_faelligkeit, tmpl.intervall);
    await dbQuery('UPDATE wiederkehrende_buchungen SET letzte_ausfuehrung=?, naechste_faelligkeit=? WHERE template_id=?',
      [heute, naechste, tmpl.template_id]);

    res.status(201).json({ beleg_id: result.insertId, beleg_nummer: belegNummer, naechste_faelligkeit: naechste });
  } catch (err) {
    console.error('Wiederkehrend-Ausführen-Fehler:', err);
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// Hilfsfunktion: nächste Fälligkeit berechnen
function berechnenaechsteFaelligkeit(aktuell, intervall) {
  const d = new Date(aktuell);
  switch (intervall) {
    case 'wöchentlich':       d.setDate(d.getDate() + 7); break;
    case 'monatlich':         d.setMonth(d.getMonth() + 1); break;
    case 'vierteljährlich':   d.setMonth(d.getMonth() + 3); break;
    case 'halbjährlich':      d.setMonth(d.getMonth() + 6); break;
    case 'jährlich':          d.setFullYear(d.getFullYear() + 1); break;
    default:                  d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

// POST /wiederkehrend/ausfuehren-faellige — alle fälligen auto_ausfuehren=1 Templates buchen
router.post('/wiederkehrend/ausfuehren-faellige', requireFeature('buchhaltung'), requireBuchhaltungAccess, async (req, res) => {
  try {
    const dojoId = req.buchhaltungDojoId;
    let sql = `SELECT * FROM wiederkehrende_buchungen WHERE aktiv=1 AND auto_ausfuehren=1 AND naechste_faelligkeit <= CURDATE()`;
    const params = [];
    if (dojoId) { sql += ' AND dojo_id=?'; params.push(dojoId); }
    const faellige = await dbQuery(sql, params);
    const gebuchte = [];
    const heute = new Date().toISOString().split('T')[0];

    for (const tmpl of faellige) {
      const netto = parseFloat(tmpl.betrag_netto);
      const mwst = parseFloat(tmpl.mwst_satz);
      const mwstBetrag = Math.round(netto * (mwst / 100) * 100) / 100;
      const brutto = Math.round((netto + mwstBetrag) * 100) / 100;
      const jahr = new Date().getFullYear();
      const belegNummer = await generateBelegNummer(tmpl.dojo_id, jahr);
      await dbQuery(
        `INSERT INTO buchhaltung_belege (beleg_nummer, dojo_id, organisation_name, buchungsart,
           beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
           kategorie, beschreibung, lieferant_kunde, erstellt_von)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [belegNummer, tmpl.dojo_id, tmpl.organisation_name, tmpl.buchungsart,
         heute, heute, netto, mwst, mwstBetrag, brutto,
         tmpl.kategorie, tmpl.beschreibung||tmpl.bezeichnung, tmpl.lieferant_kunde||null, req.user?.id||1]
      );
      const naechste = berechnenaechsteFaelligkeit(tmpl.naechste_faelligkeit, tmpl.intervall);
      await dbQuery('UPDATE wiederkehrende_buchungen SET letzte_ausfuehrung=?, naechste_faelligkeit=? WHERE template_id=?',
        [heute, naechste, tmpl.template_id]);
      gebuchte.push({ template_id: tmpl.template_id, bezeichnung: tmpl.bezeichnung, belegNummer });
    }

    res.json({ gebuchte, anzahl: gebuchte.length });
  } catch (err) {
    console.error('Fällige-Ausführen-Fehler:', err);
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// ===================================================================
// 📋 GET /api/buchhaltung/export/anlage-euer
//    Anlage EÜR Excel-Export (amtliche Zeilennummern 2024)
//    → direkt in WISO Steuer / ELSTER übertragbar
// ===================================================================
router.get('/export/anlage-euer', requireBuchhaltungAccess, async (req, res) => {
  try {
    const jahr = parseInt(req.query.jahr) || new Date().getFullYear();
    const dojoId = req.buchhaltungDojoId;
    const orgFilter = req.query.organisation;

    // -- Dojo-Einstellungen (Kleinunternehmer?)
    let kleinunternehmer = false;
    let steuernummer = '';
    let finanzamt = '';
    let rechtsform = '';
    if (dojoId) {
      const [einst] = await dbQuery(
        'SELECT kleinunternehmer, steuernummer, finanzamt, rechtsform FROM dojo WHERE dojo_id = ?', [dojoId]
      );
      kleinunternehmer = !!(einst?.kleinunternehmer);
      steuernummer     = einst?.steuernummer || '';
      finanzamt        = einst?.finanzamt || '';
      rechtsform       = einst?.rechtsform || 'Einzelunternehmen';
    }

    // -- Org-Where für Queries
    let orgWhere = '';
    const orgParams = [jahr];
    if (dojoId) { orgWhere = 'AND dojo_id = ?'; orgParams.push(dojoId); }
    else if (orgFilter && orgFilter !== 'alle') { orgWhere = 'AND organisation_name = ?'; orgParams.push(orgFilter); }

    // -- Einnahmen aggregiert nach Kategorie
    const einnahmenRows = await dbQuery(`
      SELECT kategorie,
             SUM(betrag_brutto) AS summe,
             COUNT(*) AS anzahl
      FROM v_euer_einnahmen
      WHERE jahr = ? ${orgWhere}
      GROUP BY kategorie
    `, orgParams);

    // -- Ausgaben aggregiert nach Kategorie
    const ausgabenRows = await dbQuery(`
      SELECT kategorie,
             SUM(betrag_brutto) AS summe,
             COUNT(*) AS anzahl
      FROM v_euer_ausgaben
      WHERE jahr = ? ${orgWhere}
      GROUP BY kategorie
    `, orgParams);

    // -- MwSt-Beträge aus Belegen (für Zeile 18/40)
    const mwstParams = [jahr];
    let mwstWhere = 'YEAR(buchungsdatum) = ?';
    if (dojoId) { mwstWhere += ' AND dojo_id = ?'; mwstParams.push(dojoId); }
    const mwstRows = await dbQuery(`
      SELECT
        SUM(CASE WHEN buchungsart='einnahme' AND storniert=0 THEN mwst_betrag ELSE 0 END) AS einnahmen_mwst,
        SUM(CASE WHEN buchungsart='ausgabe' AND storniert=0 THEN mwst_betrag ELSE 0 END) AS ausgaben_vorsteuer
      FROM buchhaltung_belege
      WHERE ${mwstWhere}
    `, mwstParams);
    const einnahmenMwst  = parseFloat(mwstRows[0]?.einnahmen_mwst || 0);
    const ausgabenVorsteuer = parseFloat(mwstRows[0]?.ausgaben_vorsteuer || 0);

    // -- GWG-Belege (ist_gwg = 1)
    const gwgParams = [jahr];
    let gwgWhere = 'buchungsart="ausgabe" AND ist_gwg=1 AND storniert=0 AND YEAR(beleg_datum) = ?';
    if (dojoId) { gwgWhere += ' AND dojo_id = ?'; gwgParams.push(dojoId); }
    const gwgRows = await dbQuery(`
      SELECT COALESCE(SUM(ROUND(betrag_brutto * (1 - COALESCE(privatanteil_prozent,0)/100), 2)), 0) AS summe
      FROM buchhaltung_belege WHERE ${gwgWhere}
    `, gwgParams);
    const gwgSumme = parseFloat(gwgRows[0]?.summe || 0);

    // Hilfsfunktion: Kategorie-Summe holen
    const getE = (kat) => {
      const cats = Array.isArray(kat) ? kat : [kat];
      return einnahmenRows.filter(r => cats.includes(r.kategorie)).reduce((s, r) => s + parseFloat(r.summe || 0), 0);
    };
    const getA = (kat) => {
      const cats = Array.isArray(kat) ? kat : [kat];
      return ausgabenRows.filter(r => cats.includes(r.kategorie)).reduce((s, r) => s + parseFloat(r.summe || 0), 0);
    };

    // -- EÜR-Zeilen berechnen (Anlage EÜR 2024 amtliche Struktur)
    const totalEinnahmen = einnahmenRows.reduce((s, r) => s + parseFloat(r.summe || 0), 0);
    const ek_betriebseinnahmen = totalEinnahmen; // alle Einnahmen aus v_euer_einnahmen (excl. privateinlage)

    // Betriebseinnahmen aufgeteilt
    const z11  = kleinunternehmer ? ek_betriebseinnahmen : 0;          // Kleinunternehmer § 19
    const z14  = kleinunternehmer ? 0 : (ek_betriebseinnahmen - getE(['mitgliedsbeitraege'])); // USt-pflichtig (netto)
    const z16  = kleinunternehmer ? 0 : getE('mitgliedsbeitraege');     // USt-frei (Mitgliedsbeiträge Sport oft steuerfrei)
    const z18  = kleinunternehmer ? 0 : einnahmenMwst;                  // Vereinnahmte USt
    const z24  = z11 + z14 + z16 + z18;                                 // Summe Betriebseinnahmen

    // Betriebsausgaben
    const z26  = getA('wareneingang');
    const z29  = getA('abschreibungen');                  // AfA (aus afa_positionen via v_euer_ausgaben)
    const z30  = gwgSumme;                                // GWG Sofortabschreibung
    const z33  = getA('raumkosten');                      // Miete/Pacht Grundstücke
    const z36  = getA('kfz_kosten');                      // Kfz-Kosten
    const z40  = kleinunternehmer ? 0 : ausgabenVorsteuer; // Gezahlte Vorsteuer
    const z46  = getA('personalkosten');                  // Löhne und Gehälter
    const z57  = getA(['telefon_internet', 'buerokosten']); // Telefon, Porto, Büro
    const z59  = getA('versicherungen');                  // Versicherungen
    const z61  = getA('fortbildung');                     // Fortbildung
    const z62  = getA('werbekosten');                     // Werbekosten
    const z63  = getA('reisekosten');                     // Reisekosten
    const z66  = getA(['sonstige_kosten', 'bankgebuehren', 'software', 'steuerzahlungen', 'ausstattung']); // Sonstige
    const z82  = z26 + z29 + z30 + z33 + z36 + z40 + z46 + z57 + z59 + z61 + z62 + z63 + z66;
    const z83  = z24 - z82;                               // Gewinn (+) / Verlust (-)

    // -- Excel erstellen
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Dojosoftware';
    workbook.created = new Date();

    // ── SHEET 1: Anlage EÜR ──────────────────────────────────────────
    const ws = workbook.addWorksheet(`Anlage EÜR ${jahr}`, {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true }
    });

    ws.columns = [
      { key: 'zeile', width: 8 },
      { key: 'beschreibung', width: 58 },
      { key: 'betrag', width: 16 },
      { key: 'quelle', width: 32 },
    ];

    const EUR = (v) => v === 0 ? '' : Math.round(v * 100) / 100;

    // Farben
    const COL_HEADER   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
    const COL_SECTION  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5986' } };
    const COL_SUBSECT  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0F8' } };
    const COL_VALUE    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDFDE8' } };
    const COL_TOTAL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDFF2CC' } };
    const COL_RESULT   = { type: 'pattern', pattern: 'solid', fgColor: { argb: z83 >= 0 ? 'FFCCFFCC' : 'FFFFCCCC' } };

    const addTitle = (text) => {
      const r = ws.addRow(['', text]);
      r.getCell(2).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      r.getCell(2).fill = COL_HEADER;
      ws.mergeCells(`B${r.number}:D${r.number}`);
      r.height = 22;
    };
    const addMeta = (label, value) => {
      const r = ws.addRow(['', label, value]);
      r.getCell(2).font = { bold: false, size: 10, color: { argb: 'FF555555' } };
      r.getCell(3).font = { bold: true, size: 10 };
    };
    const addBlank = () => ws.addRow([]);
    const addSection = (text) => {
      const r = ws.addRow(['', text]);
      r.getCell(2).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      r.getCell(2).fill = COL_SECTION;
      ws.mergeCells(`B${r.number}:D${r.number}`);
      r.height = 18;
    };
    const addSubsection = (text) => {
      const r = ws.addRow(['', text]);
      r.getCell(2).font = { bold: true, size: 10, color: { argb: 'FF1A3A5C' } };
      r.getCell(2).fill = COL_SUBSECT;
      ws.mergeCells(`B${r.number}:D${r.number}`);
    };
    const addRow = (zeile, beschreibung, betrag, quelle = '') => {
      const r = ws.addRow([zeile, beschreibung, EUR(betrag), quelle]);
      r.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF666666' } };
      r.getCell(1).alignment = { horizontal: 'center' };
      r.getCell(2).font = { size: 10 };
      if (betrag !== 0 && betrag !== '') {
        r.getCell(3).numFmt = '#,##0.00 €';
        r.getCell(3).fill = COL_VALUE;
        r.getCell(3).font = { bold: true, size: 10, color: { argb: 'FF1A3A5C' } };
      }
      r.getCell(3).alignment = { horizontal: 'right' };
      r.getCell(4).font = { size: 9, color: { argb: 'FF888888' }, italic: true };
      // Border unten
      ['A','B','C','D'].forEach(col => {
        r.getCell(col).border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
      });
    };
    const addTotal = (beschreibung, betrag) => {
      const r = ws.addRow(['', beschreibung, EUR(betrag)]);
      r.getCell(2).font = { bold: true, size: 11 };
      r.getCell(2).fill = COL_TOTAL;
      r.getCell(3).numFmt = '#,##0.00 €';
      r.getCell(3).fill = COL_TOTAL;
      r.getCell(3).font = { bold: true, size: 11 };
      r.getCell(3).alignment = { horizontal: 'right' };
      r.height = 18;
    };

    // ── Kopfzeile ───────────────────────────────
    addTitle(`Anlage EÜR ${jahr} — Einnahmen-Überschuss-Rechnung (§ 4 Abs. 3 EStG)`);
    addBlank();
    addMeta('Organisation:', orgFilter || (dojoId === 2 ? 'TDA International' : 'Kampfkunstschule Schreiner'));
    addMeta('Steuernummer:', steuernummer || '(bitte eintragen)');
    addMeta('Finanzamt:', finanzamt || '(bitte eintragen)');
    addMeta('Veranlagungsjahr:', String(jahr));
    addMeta('Rechtsform:', rechtsform);
    addMeta('Kleinunternehmer gem. § 19 UStG:', kleinunternehmer ? 'Ja' : 'Nein');
    addMeta('Erstellt am:', new Date().toLocaleDateString('de-DE'));
    addMeta('', '');
    addMeta('→ WISO Steuer:', 'Formularbasierte Eingabe auswählen, dann Zeilen-Nummern übernehmen');
    addBlank();

    // ── A. BETRIEBSEINNAHMEN ─────────────────────────────────────────
    addSection('A   BETRIEBSEINNAHMEN (Zeilen 11–24)');
    addSubsection('Hinweis: Nur eine der Zeilen 11 oder 14+16 ausfüllen (je nach USt-Status)');

    addRow(11, 'Betriebseinnahmen als Kleinunternehmer (§ 19 Abs. 1 UStG) — brutto',
      z11, kleinunternehmer ? 'Alle Einnahmen' : 'Nicht zutreffend (kein Kleinunternehmer)');
    addRow(14, 'Umsatzsteuerpflichtige Einnahmen (ohne Umsatzsteuer) — netto',
      z14, kleinunternehmer ? 'Nicht zutreffend' : 'Betriebseinnahmen netto');
    addRow(16, 'Umsatzsteuerfreie/nicht-steuerbare Einnahmen',
      z16, 'Mitgliedsbeiträge, steuerbefreite Einnahmen');
    addRow(18, 'Vereinnahmte Umsatzsteuer / Umsatzsteuer-Vorauszahlungen',
      z18, 'MwSt-Beträge aus Belegen');
    addTotal('Summe Betriebseinnahmen (Zeile 24)', z24);
    addBlank();

    // ── B. BETRIEBSAUSGABEN ──────────────────────────────────────────
    addSection('B   BETRIEBSAUSGABEN (Zeilen 25–82)');

    addSubsection('Wareneinkauf & Material');
    addRow(26, 'Waren, Roh-, Hilfs- und Betriebsstoffe, Fremdleistungen',
      z26, 'Kategorie: Wareneingang');

    addSubsection('Abschreibungen');
    addRow(29, 'Absetzung für Abnutzung (AfA) auf Anlagegüter',
      z29, 'AfA aus Anlagenregister (lineare Abschreibung § 7 EStG)');
    addRow(30, 'Sofortabschreibung GWG ≤ 800 € netto (§ 6 Abs. 2 EStG)',
      z30, 'Belege mit GWG-Flag');

    addSubsection('Raumkosten');
    addRow(33, 'Miete/Pacht für Grundstücke, Gebäude, Räume, Garagen',
      z33, 'Kategorie: Raumkosten');

    addSubsection('Fahrzeugkosten');
    addRow(36, 'Kraftfahrzeugkosten (inkl. Kfz-Versicherung, Kraftstoff, TÜV)',
      z36, 'Kategorie: KFZ-Kosten');

    addSubsection('Umsatzsteuer');
    addRow(40, 'Gezahlte/abgeführte Vorsteuerbeträge',
      z40, kleinunternehmer ? 'Nicht zutreffend (Kleinunternehmer)' : 'Vorsteuer aus Belegen');

    addSubsection('Personalkosten');
    addRow(46, 'Löhne und Gehälter (Bruttoarbeitslöhne)',
      z46, 'Kategorie: Personalkosten');

    addSubsection('Kommunikation & Büro');
    addRow(57, 'Aufwendungen für Telekommunikation, Porto, Büromaterial',
      z57, 'Kategorien: Telefon/Internet, Bürokosten');

    addSubsection('Versicherungen & Beiträge');
    addRow(59, 'Versicherungen (Haftpflicht, Unfall etc.)',
      z59, 'Kategorie: Versicherungen');

    addSubsection('Sonstige Betriebsausgaben');
    addRow(61, 'Fortbildungskosten',
      z61, 'Kategorie: Fortbildung');
    addRow(62, 'Werbekosten, Anzeigen, Marketing',
      z62, 'Kategorie: Werbekosten');
    addRow(63, 'Reisekosten (Fahrtkosten, Übernachtung)',
      z63, 'Kategorie: Reisekosten');
    addRow(66, 'Sonstige Betriebsausgaben (Bankgebühren, Software, Steuern etc.)',
      z66, 'Kategorien: Sonstige Kosten, Bankgebühren, Software, Steuerzahlungen, Ausstattung');

    addTotal('Summe Betriebsausgaben (Zeile 82)', z82);
    addBlank();

    // ── C. ERGEBNIS ──────────────────────────────────────────────────
    addSection('C   ERGEBNIS');
    const ergebnisRow = ws.addRow(['83', z83 >= 0 ? 'Gewinn  (+)' : 'Verlust  (−)', EUR(Math.abs(z83))]);
    ergebnisRow.getCell(1).font  = { bold: true, size: 11 };
    ergebnisRow.getCell(1).alignment = { horizontal: 'center' };
    ergebnisRow.getCell(2).font  = { bold: true, size: 13 };
    ergebnisRow.getCell(2).fill  = COL_RESULT;
    ergebnisRow.getCell(3).font  = { bold: true, size: 13, color: { argb: z83 >= 0 ? 'FF006600' : 'FFCC0000' } };
    ergebnisRow.getCell(3).numFmt = '#,##0.00 €';
    ergebnisRow.getCell(3).fill  = COL_RESULT;
    ergebnisRow.getCell(3).alignment = { horizontal: 'right' };
    ergebnisRow.height = 24;
    addBlank();

    // ── D. HINWEISE ──────────────────────────────────────────────────
    addSection('D   EINGABE IN WISO STEUER-WEB / ELSTER');
    const hinweisRow = ws.addRow(['', [
      '1. WISO Steuer-Web öffnen → Selbständige Arbeit → "Formularbasierte Eingabe" wählen',
      '2. Zeilennummern (linke Spalte) direkt in die entsprechenden Felder des WISO-Formulars übertragen',
      '3. Bei Kleinunternehmer: Nur Zeile 11 ausfüllen (Zeilen 14/16/18/40 bleiben leer)',
      '4. Bei USt-Pflicht: Zeilen 14 + 16 + 18 ausfüllen (Zeile 11 bleibt leer)',
      '5. Zeile 29 (AfA): Dojosoftware → Anlagevermögen-Tab für Detailnachweis',
      '6. Fertig: Zeile 83 = Gewinn/Verlust → erscheint automatisch in Steuerbescheid',
    ].join('\n')]);
    hinweisRow.getCell(2).font = { size: 10 };
    hinweisRow.getCell(2).alignment = { wrapText: true };
    hinweisRow.height = 100;
    ws.mergeCells(`B${hinweisRow.number}:D${hinweisRow.number}`);

    // ── SHEET 2: Detailaufstellung ───────────────────────────────────
    const ws2 = workbook.addWorksheet('Detailaufstellung');
    ws2.columns = [
      { header: 'Typ',         key: 'typ',    width: 10 },
      { header: 'Kategorie',   key: 'kat',    width: 28 },
      { header: 'Summe (€)',   key: 'summe',  width: 14 },
      { header: 'Anzahl',      key: 'anz',    width: 10 },
      { header: 'EÜR-Zeile',   key: 'zeile',  width: 12 },
    ];
    ws2.getRow(1).font = { bold: true };
    ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
    ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Zeilen-Mapping für Detailblatt
    const zeileMap = {
      betriebseinnahmen: kleinunternehmer ? 11 : 14,
      mitgliedsbeitraege: kleinunternehmer ? 11 : 16,
      sonstige_einnahmen: kleinunternehmer ? 11 : 14,
      beitrag: kleinunternehmer ? 11 : 16,
      rechnung: kleinunternehmer ? 11 : 14,
      verkauf: kleinunternehmer ? 11 : 14,
      kassenbuch: kleinunternehmer ? 11 : 14,
      bank: kleinunternehmer ? 11 : 14,
      beleg: kleinunternehmer ? 11 : 14,
      wareneingang: 26, abschreibungen: 29,
      raumkosten: 33, kfz_kosten: 36,
      personalkosten: 46, telefon_internet: 57, buerokosten: 57,
      versicherungen: 59, fortbildung: 61, werbekosten: 62,
      reisekosten: 63, sonstige_kosten: 66, bankgebuehren: 66,
      software: 66, steuerzahlungen: 66, ausstattung: 66,
    };

    einnahmenRows.forEach(r => {
      const row = ws2.addRow({
        typ: 'Einnahme', kat: r.kategorie,
        summe: parseFloat(r.summe).toFixed(2),
        anz: r.anzahl,
        zeile: zeileMap[r.kategorie] || '14/16'
      });
      row.getCell('summe').numFmt = '#,##0.00';
      row.getCell('typ').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F8E8' } };
    });
    ausgabenRows.forEach(r => {
      const row = ws2.addRow({
        typ: 'Ausgabe', kat: r.kategorie,
        summe: parseFloat(r.summe).toFixed(2),
        anz: r.anzahl,
        zeile: zeileMap[r.kategorie] || 66
      });
      row.getCell('summe').numFmt = '#,##0.00';
      row.getCell('typ').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } };
    });

    // -- Response senden
    const orgName = orgFilter || (dojoId === 2 ? 'TDA' : 'Schreiner');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="AnlageEUeR_${jahr}_${orgName}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Anlage-EÜR-Export-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Anlage EÜR Export', error: err.message });
  }
});

module.exports = router;
