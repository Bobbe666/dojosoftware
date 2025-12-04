// routes/magicline-import.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Zugriff verweigert: Kein Token' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'dein_geheimer_key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Zugriff verweigert: Ungültiger Token' });
    }
    req.user = user;
    next();
  });
};

// Multer Setup für ZIP-Upload
const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

/**
 * MagicLine Import Router
 * Importiert Mitglieder, Verträge, SEPA-Mandate und Dokumente aus MagicLine-Exporten
 */

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Konvertiert MagicLine Datumsformat zu MySQL-Format
 */
function convertDate(dateStr) {
  if (!dateStr) return null;
  // MagicLine Format: "YYYY-MM-DD" oder "DD.MM.YYYY"
  if (dateStr.includes('.')) {
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr; // Already in MySQL format
}

/**
 * Mapping: MagicLine Geschlecht → Dojo System
 */
function mapGender(magiclineGender) {
  const mapping = {
    'Männlich': 'm',
    'Weiblich': 'w',
    'Divers': 'd',
    'MALE': 'm',
    'FEMALE': 'w',
    'DIVERSE': 'd'
  };
  return mapping[magiclineGender] || 'k.A.';
}

/**
 * Mapping: MagicLine Zahlungsart → Dojo System
 */
function mapPaymentType(magiclineType) {
  const mapping = {
    'Lastschrift': 'sepa',
    'SEPA': 'sepa',
    'Überweisung': 'ueberweisung',
    'Bar': 'bar',
    'Barzahlung': 'bar'
  };
  return mapping[magiclineType] || 'ueberweisung';
}

/**
 * Extrahiert Zahlungszyklus aus MagicLine paymentFrequency
 */
function mapPaymentFrequency(frequency) {
  const mapping = {
    '1M': 1,   // Monatlich
    '3M': 3,   // Vierteljährlich
    '6M': 6,   // Halbjährlich
    '12M': 12  // Jährlich
  };
  return mapping[frequency] || 1;
}

/**
 * Extrahiert Kündigungsfrist in Monaten
 */
function extractCancellationMonths(period) {
  if (!period) return 3;
  const match = period.match(/(\d+)M/);
  return match ? parseInt(match[1]) : 3;
}

/**
 * Extrahiert Vertragslaufzeit in Monaten
 */
function extractTermMonths(term) {
  if (!term) return 12;
  const match = term.match(/(\d+)M/);
  return match ? parseInt(match[1]) : 12;
}

// ============================================
// IMPORT LOGIC
// ============================================

/**
 * Importiert ein einzelnes Mitglied aus MagicLine-Daten
 */
async function importMember(memberFolder, baseDir) {
  const importLog = {
    memberNumber: path.basename(memberFolder),
    success: false,
    errors: [],
    warnings: [],
    imported: {
      member: false,
      contract: false,
      sepaMandate: false,
      documents: 0
    }
  };

  try {
    // 1. Lade alle JSON-Dateien
    const customerData = JSON.parse(
      await fs.readFile(path.join(memberFolder, 'customer.json'), 'utf8')
    );

    const contractsData = JSON.parse(
      await fs.readFile(path.join(memberFolder, 'contracts.json'), 'utf8')
    );

    let bankData = null;
    try {
      bankData = JSON.parse(
        await fs.readFile(path.join(memberFolder, 'bank_account.json'), 'utf8')
      );
    } catch (e) {
      importLog.warnings.push('Keine Bankdaten vorhanden');
    }

    // 2. MITGLIED IMPORTIEREN
    const address = customerData.addresses?.[0] || {};

    const memberInsertSQL = `
      INSERT INTO mitglieder (
        vorname, nachname, geburtsdatum, geschlecht,
        email, telefon,
        strasse, hausnummer, plz, ort, land,
        magicline_customer_number, magicline_uuid,
        status, erstellt_am
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktiv', NOW())
    `;

    const memberValues = [
      customerData.firstName,
      customerData.lastName,
      convertDate(customerData.dateOfBirth),
      mapGender(customerData.gender),
      customerData.email || null,
      null, // Telefon - nicht in customer.json
      address.street || null,
      address.houseNumber || null,
      address.zip || null,
      address.city || null,
      address.country === 'DE' ? 'Deutschland' : address.country,
      contractsData[0]?.customerNumber || null,
      customerData.uuid,
    ];

    const memberResult = await queryPromise(memberInsertSQL, memberValues);
    const mitgliedId = memberResult.insertId;
    importLog.imported.member = true;

    logger.info('Mitglied importiert', {
      mitgliedId,
      name: `${customerData.firstName} ${customerData.lastName}`
    });

    // 3. VERTRÄGE IMPORTIEREN
    for (const contract of contractsData) {
      try {
        // Finde oder erstelle Tarif
        const tarifId = await findOrCreateTarif(contract.rateName, contract.chargeAmountCurrent);

        const contractInsertSQL = `
          INSERT INTO vertraege (
            mitglied_id, tarif_id,
            vertragsbeginn, vertragsende,
            kuendigungsfrist_monate, mindestlaufzeit_monate,
            beitrag, zahlungsintervall_monate,
            zahlungsart, status,
            magicline_contract_id, magicline_rate_term,
            magicline_payment_run_group,
            erstellt_am
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        const contractValues = [
          mitgliedId,
          tarifId,
          convertDate(contract.startDate),
          convertDate(contract.endDate),
          extractCancellationMonths(contract.cancellationPeriod),
          extractTermMonths(contract.rateTerm),
          contract.chargeAmountCurrent,
          mapPaymentFrequency(contract.paymentFrequency),
          mapPaymentType(contract.paymentType),
          contract.cancelledAt ? 'gekuendigt' : 'aktiv',
          contract.id,
          contract.rateTerm,
          contract.paymentRunGroupName
        ];

        const contractResult = await queryPromise(contractInsertSQL, contractValues);
        const vertragId = contractResult.insertId;
        importLog.imported.contract = true;

        logger.info('Vertrag importiert', { vertragId, mitgliedId });

        // 4. SEPA-MANDAT IMPORTIEREN (falls vorhanden)
        if (bankData && bankData.iban && contract.paymentType === 'Lastschrift') {
          const sepaMandate = bankData.sepaMandateDtos?.[0];

          const sepaMandateSQL = `
            INSERT INTO sepa_mandate (
              mitglied_id,
              iban, bic, kontoinhaber, bankname,
              mandatsreferenz, erstellungsdatum,
              status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'aktiv')
          `;

          const sepaMandateValues = [
            mitgliedId,
            bankData.iban,
            bankData.bic,
            bankData.accountHolder,
            bankData.bankName,
            sepaMandate?.referenceNumber || `IMPORT-${Date.now()}`,
            convertDate(sepaMandate?.mandateGivenDate) || new Date().toISOString().split('T')[0]
          ];

          await queryPromise(sepaMandateSQL, sepaMandateValues);
          importLog.imported.sepaMandate = true;

          logger.info('SEPA-Mandat importiert', { mitgliedId });
        }

      } catch (contractError) {
        importLog.errors.push(`Vertrag Import: ${contractError.message}`);
        logger.error('Vertrag Import Fehler', { error: contractError.message });
      }
    }

    // 5. DOKUMENTE IMPORTIEREN (PDFs)
    const documentsPath = path.join(memberFolder, 'documents');
    try {
      const files = await fs.readdir(documentsPath);

      for (const file of files) {
        if (file.endsWith('.pdf')) {
          const sourcePath = path.join(documentsPath, file);
          const targetDir = path.join(__dirname, '../uploads/mitglieder', mitgliedId.toString());

          // Erstelle Zielverzeichnis
          await fs.mkdir(targetDir, { recursive: true });

          const targetPath = path.join(targetDir, `magicline_${file}`);
          await fs.copyFile(sourcePath, targetPath);

          // Speichere in Datenbank
          const documentSQL = `
            INSERT INTO mitglieder_dokumente (
              mitglied_id, dateiname, dateipfad, dokumenttyp, hochgeladen_am
            ) VALUES (?, ?, ?, 'import_magicline', NOW())
          `;

          await queryPromise(documentSQL, [
            mitgliedId,
            `magicline_${file}`,
            `/uploads/mitglieder/${mitgliedId}/magicline_${file}`
          ]);

          importLog.imported.documents++;
        }
      }
    } catch (docError) {
      if (docError.code !== 'ENOENT') {
        importLog.warnings.push(`Dokumente: ${docError.message}`);
      }
    }

    importLog.success = true;

  } catch (error) {
    importLog.errors.push(error.message);
    logger.error('Mitglied Import Fehler', {
      memberFolder: path.basename(memberFolder),
      error: error.message
    });
  }

  return importLog;
}

/**
 * Findet oder erstellt einen Tarif
 */
async function findOrCreateTarif(tarifName, beitrag) {
  // Suche existierenden Tarif
  const findSQL = `SELECT tarif_id FROM tarife WHERE tarifname = ? LIMIT 1`;
  const existing = await queryPromise(findSQL, [tarifName]);

  if (existing.length > 0) {
    return existing[0].tarif_id;
  }

  // Erstelle neuen Tarif
  const createSQL = `
    INSERT INTO tarife (tarifname, beitrag, beschreibung, aktiv)
    VALUES (?, ?, 'Importiert aus MagicLine', 1)
  `;
  const result = await queryPromise(createSQL, [tarifName, beitrag]);
  return result.insertId;
}

/**
 * Promisified DB Query
 */
function queryPromise(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * POST /api/magicline-import/upload
 * Akzeptiert MagicLine ZIP-Export
 */
router.post('/upload', authenticateToken, upload.single('zipFile'), async (req, res) => {
  const importResults = {
    startTime: new Date(),
    totalMembers: 0,
    successful: 0,
    failed: 0,
    logs: []
  };

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    logger.info('MagicLine Import gestartet', { file: req.file.originalname });

    // 1. ZIP extrahieren
    const zip = new AdmZip(req.file.path);
    const extractPath = path.join(__dirname, '../uploads/temp/magicline_extract_' + Date.now());
    zip.extractAllTo(extractPath, true);

    // 2. Finde alle Mitglieder-Ordner
    const entries = await fs.readdir(extractPath);
    const memberFolders = [];

    for (const entry of entries) {
      const fullPath = path.join(extractPath, entry);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory() && entry.startsWith('M-')) {
        memberFolders.push(fullPath);
      }
    }

    importResults.totalMembers = memberFolders.length;

    // 3. Importiere jeden Mitglieder-Ordner
    for (const folder of memberFolders) {
      const log = await importMember(folder, extractPath);
      importResults.logs.push(log);

      if (log.success) {
        importResults.successful++;
      } else {
        importResults.failed++;
      }
    }

    // 4. Cleanup
    await fs.unlink(req.file.path); // Lösche ZIP
    // await fs.rm(extractPath, { recursive: true }); // Optional: Lösche extrahierte Daten

    importResults.endTime = new Date();
    importResults.duration = (importResults.endTime - importResults.startTime) / 1000;

    logger.success('MagicLine Import abgeschlossen', {
      total: importResults.totalMembers,
      successful: importResults.successful,
      failed: importResults.failed
    });

    res.json({
      success: true,
      message: `Import abgeschlossen: ${importResults.successful}/${importResults.totalMembers} erfolgreich`,
      results: importResults
    });

  } catch (error) {
    logger.error('MagicLine Import Fehler', { error: error.message, stack: error.stack });
    res.status(500).json({
      error: 'Import fehlgeschlagen',
      details: error.message,
      results: importResults
    });
  }
});

/**
 * GET /api/magicline-import/preview/:zipPath
 * Zeigt Vorschau der zu importierenden Daten
 */
router.get('/preview', async (req, res) => {
  try {
    // Implementiere Preview-Logik falls gewünscht
    res.json({ message: 'Preview-Funktion noch nicht implementiert' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/magicline-import/status
 * Zeigt Import-Status und Statistiken
 */
router.get('/status', async (req, res) => {
  try {
    const statsSQL = `
      SELECT
        COUNT(DISTINCT mitglied_id) as imported_members,
        COUNT(DISTINCT CASE WHEN magicline_customer_number IS NOT NULL THEN mitglied_id END) as magicline_members,
        (SELECT COUNT(*) FROM vertraege WHERE magicline_contract_id IS NOT NULL) as magicline_contracts,
        (SELECT COUNT(*) FROM sepa_mandate WHERE mandatsreferenz LIKE 'MLREF%') as magicline_mandates
      FROM mitglieder
    `;

    const stats = await queryPromise(statsSQL);

    res.json({
      success: true,
      statistics: stats[0]
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
