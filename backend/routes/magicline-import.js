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
const { JWT_SECRET } = require('../middleware/auth');

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('MagicLine Import: Kein Token vorhanden');
    return res.status(401).json({ error: 'Zugriff verweigert: Kein Token' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.error('MagicLine Import: Token-Verifizierung fehlgeschlagen', {
        error: err.message,
        tokenStart: token.substring(0, 20) + '...'
      });
      return res.status(403).json({ error: 'Zugriff verweigert: Ungültiger Token', details: err.message });
    }
    req.user = user;
    logger.info('MagicLine Import: Token erfolgreich verifiziert', { userId: user.id });
    next();
  });
};

// Multer Setup für ZIP-Upload
// SECURITY: Dateigröße auf 50MB begrenzt, nur ZIP-Dateien erlaubt
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (vorher 500MB - zu groß!)
    files: 1 // Nur eine Datei pro Request
  },
  fileFilter: (req, file, cb) => {
    // Erlaubte MIME-Types für ZIP-Dateien
    const allowedMimes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      'multipart/x-zip'
    ];
    // Prüfe auch Dateiendung
    const isZipExtension = file.originalname.toLowerCase().endsWith('.zip');

    if (allowedMimes.includes(file.mimetype) || isZipExtension) {
      cb(null, true);
    } else {
      cb(new Error('Nur ZIP-Dateien sind erlaubt. Erkannter Typ: ' + file.mimetype), false);
    }
  }
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
function mapPaymentMethod(magiclineType) {
  const mapping = {
    'Lastschrift': 'direct_debit',
    'SEPA': 'direct_debit',
    'Überweisung': 'bank_transfer',
    'Bar': 'cash',
    'Barzahlung': 'cash'
  };
  return mapping[magiclineType] || 'direct_debit';
}

/**
 * Extrahiert Zahlungszyklus aus MagicLine paymentFrequency
 */
function mapBillingCycle(frequency) {
  const mapping = {
    '1M': 'monthly',
    '3M': 'quarterly',
    '6M': 'biannual',
    '12M': 'annual'
  };
  return mapping[frequency] || 'monthly';
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
      payments: 0,
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

    let contactData = null;
    try {
      contactData = JSON.parse(
        await fs.readFile(path.join(memberFolder, 'contact.json'), 'utf8')
      );
    } catch (e) {
      importLog.warnings.push('Keine Kontaktdaten vorhanden');
    }

    let accountDetails = null;
    try {
      accountDetails = JSON.parse(
        await fs.readFile(path.join(memberFolder, 'account_details.json'), 'utf8')
      );
    } catch (e) {
      importLog.warnings.push('Keine Zahlungshistorie vorhanden');
    }

    // 2. MITGLIED IMPORTIEREN
    // Prüfe ob Mitglied bereits existiert (anhand magicline_uuid)
    const checkMemberSQL = `SELECT mitglied_id FROM mitglieder WHERE magicline_uuid = ? LIMIT 1`;
    const existingMember = await queryPromise(checkMemberSQL, [customerData.uuid]);

    let mitgliedId;

    if (existingMember.length > 0) {
      // Mitglied existiert bereits - überspringen
      mitgliedId = existingMember[0].mitglied_id;
      importLog.warnings.push('Mitglied bereits vorhanden - übersprungen');
      logger.info('Mitglied bereits vorhanden - übersprungen', {
        mitgliedId,
        uuid: customerData.uuid,
        name: `${customerData.firstName} ${customerData.lastName}`
      });

      // Setze Flag, dass Mitglied existiert (nicht neu importiert)
      importLog.imported.member = false;
      importLog.memberAlreadyExists = true;
    } else {
      // Neues Mitglied - importieren
      const address = customerData.addresses?.[0] || {};

      // Telefonnummer aus contact.json holen
      const telefon = contactData?.telPrivateMobile || contactData?.telPrivate ||
                     contactData?.telBusinessMobile || contactData?.telBusiness || null;

      // Prüfe ob Mitglied aktiv ist:
      // 1. Expliziter Status aus customerData (falls vorhanden)
      // 2. Prüfe ob ALLE Verträge gekündigt/beendet sind -> ehemalig
      // 3. Prüfe ob Vertragsende in der Vergangenheit liegt
      let istAktiv = 1; // Standard: aktiv

      // Prüfe customerData auf active/status Feld
      if (customerData.active === false || customerData.status === 'INACTIVE' || customerData.status === 'FORMER') {
        istAktiv = 0;
      }

      // Prüfe alle Verträge - wenn ALLE gekündigt oder beendet sind -> ehemalig
      if (contractsData && contractsData.length > 0) {
        const alleVertraegeBeendet = contractsData.every(contract => {
          // Vertrag ist beendet wenn:
          // 1. cancelledAt existiert
          // 2. endDate in der Vergangenheit liegt
          if (contract.cancelledAt) return true;
          if (contract.endDate) {
            const endDate = new Date(convertDate(contract.endDate));
            if (endDate < new Date()) return true;
          }
          return false;
        });

        if (alleVertraegeBeendet) {
          istAktiv = 0;
          importLog.warnings.push('Alle Verträge beendet - Mitglied als ehemalig importiert');
        }
      }

      const memberInsertSQL = `
        INSERT INTO mitglieder (
          vorname, nachname, geburtsdatum, geschlecht,
          email, telefon, telefon_mobil,
          strasse, hausnummer, plz, ort, land,
          iban, bic, bankname, kontoinhaber,
          magicline_customer_number, magicline_uuid,
          aktiv, eintrittsdatum
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())
      `;

      const memberValues = [
        customerData.firstName,
        customerData.lastName,
        convertDate(customerData.dateOfBirth),
        mapGender(customerData.gender),
        customerData.email || null,
        telefon, // Telefon aus contact.json
        telefon, // telefon_mobil - verwende gleichen Wert
        address.street || null,
        address.houseNumber || null,
        address.zip || null,
        address.city || null,
        address.country === 'DE' ? 'Deutschland' : address.country,
        bankData?.iban || null,
        bankData?.bic || null,
        bankData?.bankName || null,
        bankData?.accountHolder || null,
        contractsData[0]?.customerNumber || null,
        customerData.uuid,
        istAktiv, // 1 = aktiv, 0 = ehemalig
      ];

      const memberResult = await queryPromise(memberInsertSQL, memberValues);
      mitgliedId = memberResult.insertId;
      importLog.imported.member = true;

      logger.info('Mitglied importiert', {
        mitgliedId,
        name: `${customerData.firstName} ${customerData.lastName}`,
        aktiv: istAktiv === 1 ? 'ja' : 'nein (ehemalig)'
      });
    }

    // 3. VERTRÄGE IMPORTIEREN
    for (const contract of contractsData) {
      try {
        // Prüfe ob Vertrag bereits existiert (anhand magicline_contract_id)
        const checkContractSQL = `SELECT vertrag_id FROM vertraege WHERE magicline_contract_id = ? LIMIT 1`;
        const existingContract = await queryPromise(checkContractSQL, [contract.id]);

        if (existingContract.length > 0) {
          // Vertrag existiert bereits - überspringen
          importLog.warnings.push(`Vertrag ${contract.id} bereits vorhanden - übersprungen`);
          logger.info('Vertrag bereits vorhanden - übersprungen', {
            vertragId: existingContract[0].vertrag_id,
            magiclineId: contract.id,
            mitgliedId
          });
          continue; // Nächster Vertrag
        }

        // Neuer Vertrag - importieren
        // Finde oder erstelle Tarif
        const tarifId = await findOrCreateTarif(contract.rateName, contract.chargeAmountCurrent);

        const contractInsertSQL = `
          INSERT INTO vertraege (
            mitglied_id, tarif_id,
            vertragsbeginn, vertragsende,
            kuendigungsfrist_monate, mindestlaufzeit_monate,
            monatsbeitrag, billing_cycle,
            payment_method, status,
            magicline_contract_id, magicline_rate_term,
            magicline_payment_run_group
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const contractValues = [
          mitgliedId,
          tarifId,
          convertDate(contract.startDate),
          convertDate(contract.endDate),
          extractCancellationMonths(contract.cancellationPeriod),
          extractTermMonths(contract.rateTerm),
          contract.chargeAmountCurrent,
          mapBillingCycle(contract.paymentFrequency),
          mapPaymentMethod(contract.paymentType),
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
          const mandatsreferenz = sepaMandate?.referenceNumber || `IMPORT-${Date.now()}`;

          // Prüfe ob SEPA-Mandat bereits existiert (anhand IBAN + mitglied_id oder mandatsreferenz)
          const checkMandateSQL = `
            SELECT id FROM sepa_mandate
            WHERE mitglied_id = ? AND iban = ?
            LIMIT 1
          `;
          const existingMandate = await queryPromise(checkMandateSQL, [mitgliedId, bankData.iban]);

          if (existingMandate.length > 0) {
            // SEPA-Mandat existiert bereits - überspringen
            importLog.warnings.push('SEPA-Mandat bereits vorhanden - übersprungen');
            logger.info('SEPA-Mandat bereits vorhanden - übersprungen', {
              mandateId: existingMandate[0].id,
              mitgliedId,
              iban: bankData.iban
            });
          } else {
            // Neues SEPA-Mandat - importieren
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
              mandatsreferenz,
              convertDate(sepaMandate?.mandateGivenDate) || new Date().toISOString().split('T')[0]
            ];

            await queryPromise(sepaMandateSQL, sepaMandateValues);
            importLog.imported.sepaMandate = true;

            logger.info('SEPA-Mandat importiert', { mitgliedId });
          }
        }

      } catch (contractError) {
        importLog.errors.push(`Vertrag Import: ${contractError.message}`);
        logger.error('Vertrag Import Fehler', { error: contractError.message });
      }
    }

    // 5. ZAHLUNGSHISTORIE IMPORTIEREN (falls vorhanden)
    if (accountDetails && accountDetails.dtos && Array.isArray(accountDetails.dtos)) {
      let importedPayments = 0;

      for (const transaction of accountDetails.dtos) {
        try {
          // Nur PAYMENT_RUN_TYPE (tatsächliche Zahlungen) importieren
          if (transaction.parent?.typeAsString === 'PAYMENT_RUN_TYPE' && transaction.parent?.amount) {
            // Prüfe ob Zahlung bereits existiert (anhand magicline_transaction_id)
            const checkPaymentSQL = `
              SELECT id FROM beitraege
              WHERE magicline_transaction_id = ?
              LIMIT 1
            `;
            const existingPayment = await queryPromise(checkPaymentSQL, [transaction.parent.id]);

            if (existingPayment.length > 0) {
              // Zahlung existiert bereits - überspringen
              logger.debug('Zahlung bereits vorhanden - übersprungen', {
                transactionId: transaction.parent.id
              });
              continue; // Nächste Zahlung
            }

            // Neue Zahlung - importieren
            const paymentSQL = `
              INSERT INTO beitraege (
                mitglied_id, betrag, zahlungsart, zahlungsdatum, bezahlt, dojo_id,
                magicline_transaction_id, magicline_description
              ) VALUES (?, ?, 'direct_debit', ?, 1, 1, ?, ?)
            `;

            const paymentValues = [
              mitgliedId,
              transaction.parent.amount,
              convertDate(transaction.parent.date) || convertDate(transaction.linkDate),
              transaction.parent.id,
              transaction.parent.description
            ];

            await queryPromise(paymentSQL, paymentValues);
            importedPayments++;
          }
        } catch (paymentError) {
          // Stille Fehler bei Zahlungen
          logger.warn('Zahlung Import Fehler', {
            error: paymentError.message,
            transactionId: transaction.parent?.id
          });
        }
      }

      if (importedPayments > 0) {
        importLog.imported.payments = importedPayments;
        logger.info('Zahlungshistorie importiert', { mitgliedId, count: importedPayments });
      }
    }

    // 6. DOKUMENTE IMPORTIEREN (PDFs)
    const documentsPath = path.join(memberFolder, 'documents');
    try {
      const files = await fs.readdir(documentsPath);

      for (const file of files) {
        if (file.endsWith('.pdf')) {
          const fileName = `magicline_${file}`;

          // Prüfe ob Dokument bereits existiert (anhand dateiname + mitglied_id)
          const checkDocumentSQL = `
            SELECT id FROM mitglieder_dokumente
            WHERE mitglied_id = ? AND dateiname = ?
            LIMIT 1
          `;
          const existingDocument = await queryPromise(checkDocumentSQL, [mitgliedId, fileName]);

          if (existingDocument.length > 0) {
            // Dokument existiert bereits - überspringen
            logger.debug('Dokument bereits vorhanden - übersprungen', {
              mitgliedId,
              fileName
            });
            continue; // Nächstes Dokument
          }

          // Neues Dokument - importieren
          const sourcePath = path.join(documentsPath, file);
          const targetDir = path.join(__dirname, '../uploads/mitglieder', mitgliedId.toString());

          // Erstelle Zielverzeichnis
          await fs.mkdir(targetDir, { recursive: true });

          const targetPath = path.join(targetDir, fileName);
          await fs.copyFile(sourcePath, targetPath);

          // Speichere in Datenbank
          const documentSQL = `
            INSERT INTO mitglieder_dokumente (
              mitglied_id, dateiname, dateipfad, dokumenttyp, hochgeladen_am
            ) VALUES (?, ?, ?, 'import_magicline', NOW())
          `;

          await queryPromise(documentSQL, [
            mitgliedId,
            fileName,
            `/uploads/mitglieder/${mitgliedId}/${fileName}`
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
  const findSQL = `SELECT id FROM tarife WHERE name = ? LIMIT 1`;
  const existing = await queryPromise(findSQL, [tarifName]);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Erstelle neuen Tarif
  const priceCents = Math.round(beitrag * 100); // Konvertiere Euro zu Cents
  const createSQL = `
    INSERT INTO tarife (name, price_cents, duration_months, billing_cycle, payment_method, active)
    VALUES (?, ?, 1, 'MONTHLY', 'SEPA', 1)
  `;
  const result = await queryPromise(createSQL, [tarifName, priceCents]);
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

      // MagicLine Ordner beginnen mit Mitgliedsnummer, z.B. "1-80_Name" oder "M-123_Name"
      // Akzeptiere alle Ordner, die mit einer Zahl oder "M-" beginnen
      if (stat.isDirectory() && (entry.match(/^\d+-/) || entry.startsWith('M-'))) {
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
