/**
 * Kontoauszug Import Routes
 * ==========================
 * CSV-Import für Kontoauszüge verschiedener Banken mit automatischer Erkennung
 * Unterstützte Banken: ING, DKB, Comdirect, Sparkasse, Volksbank, Deutsche Bank, N26
 */

const express = require('express');
const multer = require('multer');
const iconv = require('iconv-lite');
const crypto = require('crypto');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

router.use(authenticateToken);

// Multer: CSV im Arbeitsspeicher halten
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Nur CSV-Dateien sind erlaubt'));
    }
  }
});

// ============================================================
// BANK-SIGNATUREN (Port von haushaltsbuch/config.py)
// ============================================================
const BANK_SIGNATURES = [
  {
    name: 'ING',
    label: 'ING-DiBa',
    encodings: ['latin1', 'utf-8'],
    delimiter: ';',
    requiredHeaders: ['Buchung', 'Auftraggeber/Empfänger', 'Buchungstext', 'Betrag (EUR)'],
    dateCol: 'Buchung',
    amountCol: 'Betrag (EUR)',
    descriptionCol: 'Buchungstext',
    payeeCol: 'Auftraggeber/Empfänger',
    skipLines: 4
  },
  {
    name: 'DKB',
    label: 'DKB Deutsche Kreditbank',
    encodings: ['utf-8', 'latin1'],
    delimiter: ';',
    requiredHeaders: ['Gläubiger-ID', 'Mandatsreferenz', 'Kundenreferenz'],
    dateCol: 'Buchungstag',
    amountCol: 'Betrag (EUR)',
    descriptionCol: 'Verwendungszweck',
    payeeCol: 'Auftraggeber / Beguenstigter',
    skipLines: 0
  },
  {
    name: 'DKB2',
    label: 'DKB (neues Format)',
    encodings: ['utf-8'],
    delimiter: ';',
    requiredHeaders: ['Buchungsdatum', 'Wertstellung', 'Status', 'Zahlungspflichtige*r', 'Zahlungsempfänger*in'],
    dateCol: 'Buchungsdatum',
    amountCol: 'Betrag (€)',
    descriptionCol: 'Verwendungszweck',
    payeeCol: 'Zahlungsempfänger*in',
    skipLines: 0
  },
  {
    name: 'COMDIRECT',
    label: 'Comdirect',
    encodings: ['latin1', 'utf-8'],
    delimiter: ';',
    requiredHeaders: ['Buchungstag', 'Wertstellung (Valuta)', 'Vorgang', 'Buchungstext', 'Umsatz in EUR'],
    dateCol: 'Buchungstag',
    amountCol: 'Umsatz in EUR',
    descriptionCol: 'Buchungstext',
    payeeCol: 'Vorgang',
    skipLines: 4
  },
  {
    name: 'SPARKASSE',
    label: 'Sparkasse',
    encodings: ['latin1', 'utf-8'],
    delimiter: ';',
    requiredHeaders: ['Auftragskonto', 'Buchungstag', 'Valutadatum', 'Name Auftraggeber/Beguenstigter', 'Verwendungszweck'],
    dateCol: 'Buchungstag',
    amountCol: 'Betrag',
    descriptionCol: 'Verwendungszweck',
    payeeCol: 'Name Auftraggeber/Beguenstigter',
    skipLines: 0
  },
  {
    name: 'SPARKASSE2',
    label: 'Sparkasse (CSV-CAMT)',
    encodings: ['utf-8', 'latin1'],
    delimiter: ';',
    requiredHeaders: ['Auftragskonto', 'Buchungstag', 'Valutadatum', 'Name Auftraggeber/Beguenstigter', 'IBAN Auftraggeber/Beguenstigter'],
    dateCol: 'Buchungstag',
    amountCol: 'Betrag',
    descriptionCol: 'Verwendungszweck',
    payeeCol: 'Name Auftraggeber/Beguenstigter',
    skipLines: 0
  },
  {
    name: 'VOLKSBANK',
    label: 'Volksbank / Raiffeisenbank',
    encodings: ['utf-8', 'latin1'],
    delimiter: ';',
    requiredHeaders: ['Bezeichnung Auftragskonto', 'IBAN Auftragskonto', 'BIC Auftragskonto', 'Bankname Auftragskonto', 'Buchungstag'],
    dateCol: 'Buchungstag',
    amountCol: 'Betrag',
    descriptionCol: 'Verwendungszweck',
    payeeCol: 'Name Zahlungsbeteiligter',
    skipLines: 0
  },
  {
    name: 'DEUTSCHE_BANK',
    label: 'Deutsche Bank',
    encodings: ['utf-8', 'latin1'],
    delimiter: '\t',
    requiredHeaders: ['Buchungstag', 'Wert', 'Buchungsdetails', 'Auftraggeber oder Empfänger', 'Betrag (EUR)'],
    dateCol: 'Buchungstag',
    amountCol: 'Betrag (EUR)',
    descriptionCol: 'Buchungsdetails',
    payeeCol: 'Auftraggeber oder Empfänger',
    skipLines: 0
  },
  {
    name: 'N26',
    label: 'N26',
    encodings: ['utf-8'],
    delimiter: ',',
    requiredHeaders: ['Datum', 'Empfänger', 'Kontonummer', 'Transaktionstyp', 'Zahlungsreferenz', 'Betrag (EUR)'],
    dateCol: 'Datum',
    amountCol: 'Betrag (EUR)',
    descriptionCol: 'Zahlungsreferenz',
    payeeCol: 'Empfänger',
    skipLines: 0
  }
];

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function parseGermanAmount(amountStr) {
  if (!amountStr || amountStr.trim() === '' || amountStr.trim() === '-') return null;
  // Entferne Tausenderpunkte, ersetze Komma durch Punkt
  let cleaned = amountStr.trim()
    .replace(/\./g, '')   // 1.234,56 → 1234,56
    .replace(',', '.')    // 1234,56 → 1234.56
    .replace(/[^0-9.\-+]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function parseGermanDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  dateStr = dateStr.trim();

  // DD.MM.YYYY
  let m = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // YYYY-MM-DD (bereits ISO)
  m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return dateStr;

  // DD.MM.YY
  m = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (m) {
    const year = parseInt(m[3]) > 50 ? '19' + m[3] : '20' + m[3];
    return `${year}-${m[2]}-${m[1]}`;
  }

  return null;
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let inQuotes = false;
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && line.slice(i, i + delimiter.length) === delimiter) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
      i += delimiter.length - 1;
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function detectBank(buffer) {
  for (const bank of BANK_SIGNATURES) {
    for (const encoding of bank.encodings) {
      try {
        const text = iconv.decode(buffer, encoding);
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Suche Header-Zeile (die Zeile mit den meisten Trennzeichen)
        let headerLineIdx = -1;
        let maxDelimiters = 0;
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
          const count = (lines[i].split(bank.delimiter).length - 1);
          if (count > maxDelimiters) {
            maxDelimiters = count;
            headerLineIdx = i;
          }
        }

        if (headerLineIdx === -1) continue;

        const headerLine = lines[headerLineIdx];
        const headers = parseCsvLine(headerLine, bank.delimiter);

        // Prüfe ob alle required headers vorhanden sind
        const allMatch = bank.requiredHeaders.every(req =>
          headers.some(h => h.includes(req) || req.includes(h))
        );

        if (allMatch) {
          return { bank, encoding, headerLineIdx, headers };
        }
      } catch (e) {
        // Encoding-Fehler ignorieren
      }
    }
  }
  return null;
}

// ============================================================
// RÜCKLASTSCHRIFT-ERKENNUNG
// ============================================================
const RUECKLASTSCHRIFT_KEYWORDS = [
  'rücklastschrift', 'ruecklastschrift', 'retoure', 'retour',
  'zurückbelastung', 'rueckbelastung', 'rlk', 'ruecklast',
  'rückbuchung', 'rueckbuchung', 'lastschrift retour',
  'sepa-retoure', 'sepa retoure', 'rückgabe lastschrift'
];

const RUECKLASTSCHRIFT_CODES = ['am04', 'md01', 'md06', 'ac01', 'ms02', 'ag01', 'ag02', 'be01', 'rr01'];

function isRuecklastschrift(beschreibung, empfaenger) {
  const text = ((beschreibung || '') + ' ' + (empfaenger || '')).toLowerCase();
  if (RUECKLASTSCHRIFT_KEYWORDS.some(kw => text.includes(kw))) return true;
  if (RUECKLASTSCHRIFT_CODES.some(code => text.includes(code))) return true;
  return false;
}

function hashTransaction(datum, betrag, beschreibung) {
  const str = `${datum}|${betrag}|${(beschreibung || '').slice(0, 100)}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

// Kategorie-Vorschlag basierend auf Keywords in Beschreibung/Empfänger
function suggestKategorie(beschreibung, empfaenger) {
  const text = ((beschreibung || '') + ' ' + (empfaenger || '')).toLowerCase();

  const rules = [
    { kategorie: 'miete', keywords: ['miete', 'nebenkosten', 'strom', 'gas', 'wasser', 'heizung', 'hausverwaltung', 'grundsteuer'] },
    { kategorie: 'personal', keywords: ['lohn', 'gehalt', 'sozialversicherung', 'minijob', 'personalkost'] },
    { kategorie: 'versicherung', keywords: ['versicherung', 'allianz', 'axa', 'huk', 'signal iduna', 'ergo', 'generali'] },
    { kategorie: 'telefon', keywords: ['telekom', 'vodafone', 'o2', 'internet', 'telefon', '1&1', 'ionos', 'mobilfunk'] },
    { kategorie: 'software', keywords: ['adobe', 'microsoft', 'amazon web', 'aws', 'hosting', 'domain', 'software', 'lizenz', 'saas', 'github', 'google workspace'] },
    { kategorie: 'fahrtkosten', keywords: ['tankstelle', 'shell', 'aral', 'bp', 'esso', 'bahn', 'db ', 'öpnv', 'taxi', 'parkhaus', 'parken', 'mautgebühr'] },
    { kategorie: 'marketing', keywords: ['werbung', 'marketing', 'facebook', 'instagram', 'google ads', 'druck', 'banner', 'flyer', 'design'] },
    { kategorie: 'fortbildung', keywords: ['fortbildung', 'seminar', 'schulung', 'kurs', 'weiterbildung', 'kongress', 'akademie'] },
    { kategorie: 'reparatur', keywords: ['reparatur', 'wartung', 'instandhaltung', 'service', 'sanitär', 'elektriker', 'handwerker'] },
    { kategorie: 'buero', keywords: ['bürobedarf', 'büro', 'papier', 'stift', 'druckertinte', 'toner', 'staples', 'avery'] },
    { kategorie: 'gebuehren', keywords: ['gebühr', 'beitrag', 'mitgliedschaft', 'verein', 'bank', 'kontoführung', 'sepa', 'lastschrift'] },
    { kategorie: 'material', keywords: ['material', 'ausrüstung', 'sport', 'kampfsport', 'tatami', 'matte', 'uniform', 'gi', 'kimono', 'gürtel', 'schutz'] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      return rule.kategorie;
    }
  }

  return 'sonstiges';
}

function parseTransactions(buffer, detectionResult) {
  const { bank, encoding, headerLineIdx, headers } = detectionResult;
  const text = iconv.decode(buffer, encoding);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const transactions = [];

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('"Kontonummer') || line.startsWith('Kontonummer')) continue;

    const values = parseCsvLine(line, bank.delimiter);
    if (values.length < 3) continue;

    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    // Datum
    const datumRaw = row[bank.dateCol] || '';
    const datum = parseGermanDate(datumRaw);
    if (!datum) continue;

    // Betrag
    const betragRaw = row[bank.amountCol] || '';
    const betrag = parseGermanAmount(betragRaw);
    if (betrag === null || betrag === 0) continue;

    // Beschreibung und Empfänger
    const beschreibung = (row[bank.descriptionCol] || '').slice(0, 500);
    const empfaenger = (row[bank.payeeCol] || '').slice(0, 255);

    const betragAbs = Math.abs(betrag);
    const ruecklastschrift = isRuecklastschrift(beschreibung, empfaenger);
    const typ = ruecklastschrift ? 'Rücklastschrift' : (betrag < 0 ? 'Ausgabe' : 'Einnahme');
    const hash = hashTransaction(datum, betragAbs, beschreibung || empfaenger);

    transactions.push({
      datum,
      betrag: betragAbs,
      betragOriginal: betrag,
      typ,
      beschreibung: beschreibung || empfaenger || 'Import',
      empfaenger,
      ruecklastschrift,
      hash,
      kategorie_vorschlag: typ === 'Ausgabe' ? suggestKategorie(beschreibung, empfaenger) : null
    });
  }

  return transactions;
}

// ============================================================
// ROUTE: POST /api/kontoauszug/upload
// Datei hochladen, Bank erkennen, Transaktionen zurückgeben
// ============================================================
router.post('/upload', upload.single('csv'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  }

  const secureDojoId = getSecureDojoId(req);

  try {
    const detection = detectBank(req.file.buffer);

    if (!detection) {
      return res.status(422).json({
        error: 'Bank nicht erkannt',
        hint: 'Die CSV-Datei konnte keiner unterstützten Bank zugeordnet werden. Unterstützte Banken: ING, DKB, Comdirect, Sparkasse, Volksbank, Deutsche Bank, N26'
      });
    }

    let transactions = parseTransactions(req.file.buffer, detection);

    if (transactions.length === 0) {
      return res.status(422).json({ error: 'Keine Transaktionen in der Datei gefunden' });
    }

    // ── Zahllauf-Abgleich & Duplikaterkennung (nur wenn Dojo-ID vorhanden) ─
    if (secureDojoId) {
      const pool = db.promise();

      // Alle Zahlläufe holen (für Amount-Matching ±0.50€, Date ±3 Tage)
      const [zahllaeufe] = await pool.query(
        `SELECT zahllauf_id, buchungsnummer, betrag, geplanter_einzug FROM zahllaeufe WHERE status = 'abgeschlossen' ORDER BY geplanter_einzug DESC LIMIT 50`
      );

      // Bestehende Kassenbuch-Hashes für Duplikaterkennung
      // Nutze die letzten 6 Monate, um die Menge zu begrenzen
      const [kassenbuchEintraege] = await pool.query(
        `SELECT geschaeft_datum, betrag_cent, beschreibung FROM kassenbuch WHERE dojo_id = ? AND geschaeft_datum >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)`,
        [secureDojoId]
      );
      const kassenbuchHashes = new Set(
        kassenbuchEintraege.map(e =>
          hashTransaction(
            e.geschaeft_datum.toISOString().slice(0, 10),
            e.betrag_cent / 100,
            e.beschreibung
          )
        )
      );

      transactions = transactions.map(tx => {
        // Zahllauf-Abgleich: Einnahmen die dem Betrag eines Zahllaufs entsprechen
        if (!tx.ruecklastschrift && tx.betragOriginal > 0) {
          const txDate = new Date(tx.datum);
          const match = zahllaeufe.find(zl => {
            const betragDiff = Math.abs(parseFloat(zl.betrag) - tx.betrag);
            if (betragDiff > 0.50) return false;
            if (!zl.geplanter_einzug) return false;
            const zlDate = new Date(zl.geplanter_einzug);
            const daysDiff = Math.abs((txDate - zlDate) / (1000 * 60 * 60 * 24));
            return daysDiff <= 3;
          });
          if (match) {
            tx.zahllauf_match = {
              id: match.zahllauf_id,
              buchungsnummer: match.buchungsnummer,
              betrag: parseFloat(match.betrag)
            };
          }
        }

        // Duplikat-Erkennung
        if (kassenbuchHashes.has(tx.hash)) {
          tx.duplikat = true;
        }

        return tx;
      });
    }

    res.json({
      success: true,
      bank: detection.bank.name,
      bankLabel: detection.bank.label,
      anzahl: transactions.length,
      transaktionen: transactions
    });

  } catch (err) {
    logger.error('Kontoauszug Upload Fehler:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Verarbeiten der Datei' });
  }
});

// ============================================================
// ROUTE: POST /api/kontoauszug/import
// Ausgewählte Transaktionen in kassenbuch speichern
// ============================================================
router.post('/import', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  if (!secureDojoId) {
    return res.status(400).json({ error: 'Keine Berechtigung - dojo_id nicht verfügbar' });
  }

  const { transaktionen } = req.body;
  if (!Array.isArray(transaktionen) || transaktionen.length === 0) {
    return res.status(400).json({ error: 'Keine Transaktionen zum Importieren' });
  }

  const pool = db.promise();
  let importiert = 0;
  let fehler = 0;
  let uebersprungen = 0; // Rücklastschriften werden nicht ins Kassenbuch importiert

  try {
    // Aktuellen Kassenstand holen
    const [[letzterEintrag]] = await pool.query(
      'SELECT kassenstand_nachher_cent FROM kassenbuch WHERE dojo_id = ? ORDER BY eintrag_id DESC LIMIT 1',
      [secureDojoId]
    );
    let kassenstand = letzterEintrag?.kassenstand_nachher_cent || 0;

    const erfasstVon = req.user?.id || null;
    const erfasstVonName = req.user?.name || req.user?.email || 'Kontoauszug-Import';

    for (const tx of transaktionen) {
      try {
        const { datum, betrag, typ, beschreibung, kategorie, ruecklastschrift } = tx;

        if (!datum || !betrag || !typ || !beschreibung) continue;

        // Rücklastschriften werden nicht ins Kassenbuch importiert
        // → Admin legt sie manuell in der Rücklastschrift-Verwaltung an
        if (ruecklastschrift || typ === 'Rücklastschrift') {
          uebersprungen++;
          continue;
        }

        const betragCent = Math.round(parseFloat(betrag) * 100);
        const kassenstandVorher = kassenstand;
        const kassenstandNachher = typ === 'Ausgabe'
          ? kassenstand - betragCent
          : kassenstand + betragCent;

        await pool.query(
          `INSERT INTO kassenbuch (
            dojo_id, geschaeft_datum, bewegungsart, betrag_cent,
            beschreibung, kategorie,
            kassenstand_vorher_cent, kassenstand_nachher_cent,
            erfasst_von, erfasst_von_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            secureDojoId,
            datum,
            typ,
            betragCent,
            beschreibung.slice(0, 500),
            kategorie || 'sonstiges',
            kassenstandVorher,
            kassenstandNachher,
            erfasstVon,
            erfasstVonName
          ]
        );

        kassenstand = kassenstandNachher;
        importiert++;
      } catch (txErr) {
        logger.error('Transaktion Import Fehler:', { error: txErr.message });
        fehler++;
      }
    }

    const parts = [`${importiert} Transaktionen erfolgreich importiert`];
    if (uebersprungen > 0) parts.push(`${uebersprungen} Rücklastschrift(en) übersprungen (bitte in Rücklastschrift-Verwaltung anlegen)`);
    if (fehler > 0) parts.push(`${fehler} Fehler`);

    res.json({
      success: true,
      importiert,
      uebersprungen,
      fehler,
      message: parts.join(', ')
    });

  } catch (err) {
    logger.error('Kontoauszug Import Fehler:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Importieren' });
  }
});

module.exports = router;
