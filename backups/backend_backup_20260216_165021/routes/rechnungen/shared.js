/**
 * Rechnungen Shared - Helper Functions
 * PDF-Generierung, QR-Codes, Formatierung
 */
const db = require('../../db');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const QRCode = require('qrcode');
const logger = require('../../utils/logger');
const generateInvoiceHTML = require('../../utils/invoicePdfTemplate');

// Helper: Promise-Wrapper für DB-Queries
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Helper: Erstelle documents Verzeichnis falls nicht vorhanden
async function ensureDocumentsDir() {
  const docsDir = path.join(__dirname, '..', '..', 'generated_documents');
  try {
    await fs.access(docsDir);
  } catch {
    await fs.mkdir(docsDir, { recursive: true });
  }
  return docsDir;
}

// Helper: Generiere EPC QR-Code String für SEPA-Überweisung
function generateEPCQRCodeString(bankDaten, betrag, rechnungsnummer, verwendungszweck) {
  if (!bankDaten || !bankDaten.iban || !bankDaten.bic || !bankDaten.kontoinhaber) {
    return null;
  }

  const epcString = [
    'BCD',                    // Service Tag
    '002',                    // Version
    '1',                      // Character Set (1 = UTF-8)
    'SCT',                    // Identification (SEPA Credit Transfer)
    bankDaten.bic.trim(),     // BIC (max 11 Zeichen)
    bankDaten.kontoinhaber.trim().substring(0, 70), // Name (max 70 Zeichen)
    bankDaten.iban.trim(),    // IBAN (max 34 Zeichen)
    `EUR${Number(betrag).toFixed(2)}`, // Betrag (EUR + Betrag)
    '',                       // Purpose (optional)
    verwendungszweck.substring(0, 140), // Verwendungszweck (max 140 Zeichen)
    (rechnungsnummer || '').substring(0, 35), // Reference (max 35 Zeichen)
    '',                       // Text (optional)
    ''                        // End of data
  ].join('\n');

  return epcString;
}

// Helper: Generiere QR-Code als Data URI
async function generateQRCodeDataURI(text) {
  if (!text) return null;
  try {
    const dataURI = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      width: 150,
      margin: 1
    });
    return dataURI;
  } catch (error) {
    logger.error('Fehler bei QR-Code-Generierung:', { error: error });
    return null;
  }
}

// Helper: Formatiere Datum im Format dd.mm.yyyy
function formatDateDDMMYYYY(dateString, addDays = 0) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (addDays > 0) {
    date.setDate(date.getDate() + addDays);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Helper: Generiere und speichere Rechnungs-PDF
async function generateAndSaveRechnungPDF(rechnungId) {
  try {
    // Lade Rechnung mit allen Details
    const rechnungQuery = `
      SELECT
        r.*,
        CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
        m.email,
        m.strasse,
        m.hausnummer,
        m.plz,
        m.ort,
        m.dojo_id,
        d.dojoname,
        d.strasse AS dojo_strasse,
        d.hausnummer AS dojo_hausnummer,
        d.plz AS dojo_plz,
        d.ort AS dojo_ort,
        d.telefon AS dojo_telefon,
        d.email AS dojo_email,
        db.bank_name,
        db.kontoinhaber,
        db.iban,
        db.bic
      FROM rechnungen r
      JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      LEFT JOIN dojo d ON m.dojo_id = d.id
      LEFT JOIN dojo_banken db ON d.id = db.dojo_id AND db.ist_aktiv = 1
      WHERE r.rechnung_id = ?
    `;

    const results = await queryAsync(rechnungQuery, [rechnungId]);
    if (results.length === 0) throw new Error('Rechnung nicht gefunden');
    const rechnung = results[0];

    // Lade Positionen
    const positionen = await queryAsync(
      'SELECT * FROM rechnungspositionen WHERE rechnung_id = ? ORDER BY position_nr',
      [rechnungId]
    );

    // Generiere QR-Codes für Zahlung
    const qrCodeDataURIs = [];
    const bankDaten = {
      iban: rechnung.iban,
      bic: rechnung.bic,
      kontoinhaber: rechnung.kontoinhaber,
      bank_name: rechnung.bank_name
    };

    // Berechne Endbetrag und Skonto
    const calculateTotal = () => {
      return positionen.reduce((sum, pos) => {
        const bruttoPreis = Number(pos.einzelpreis) * Number(pos.menge);
        const rabattBetrag = pos.ist_rabattfaehig ? (bruttoPreis * Number(pos.rabatt_prozent) / 100) : 0;
        return sum + (bruttoPreis - rabattBetrag);
      }, 0);
    };

    const zwischensumme = calculateTotal();
    const rabatt = Number(rechnung.rabatt_prozent) > 0
      ? ((rechnung.rabatt_auf_betrag || zwischensumme) * Number(rechnung.rabatt_prozent)) / 100
      : 0;
    const summe = zwischensumme - rabatt;
    const ust = (summe * 19) / 100;
    const endbetrag = summe + ust;
    const skonto = Number(rechnung.skonto_prozent) > 0
      ? (endbetrag * Number(rechnung.skonto_prozent)) / 100
      : 0;

    const hasSkonto = Number(rechnung.skonto_prozent) > 0 && Number(rechnung.skonto_tage) > 0;
    const betragMitSkonto = endbetrag - skonto;
    const betragOhneSkonto = endbetrag;

    if (bankDaten.iban && bankDaten.bic && bankDaten.kontoinhaber) {
      const verwendungszweck = `Rechnung ${rechnung.rechnungsnummer}`;

      // QR-Code mit Skonto (falls vorhanden)
      if (hasSkonto) {
        const epcStringMitSkonto = generateEPCQRCodeString(
          bankDaten,
          betragMitSkonto,
          rechnung.rechnungsnummer,
          verwendungszweck
        );
        if (epcStringMitSkonto) {
          const qrMitSkonto = await generateQRCodeDataURI(epcStringMitSkonto);
          if (qrMitSkonto) qrCodeDataURIs.push(qrMitSkonto);
        }
      }

      // QR-Code ohne Skonto (immer)
      const epcStringOhneSkonto = generateEPCQRCodeString(
        bankDaten,
        betragOhneSkonto,
        rechnung.rechnungsnummer,
        verwendungszweck
      );
      if (epcStringOhneSkonto) {
        const qrOhneSkonto = await generateQRCodeDataURI(epcStringOhneSkonto);
        if (qrOhneSkonto) qrCodeDataURIs.push(qrOhneSkonto);
      }
    }

    // Generiere HTML mit neuem Template
    const html = generateInvoiceHTML(rechnung, positionen, qrCodeDataURIs, formatDateDDMMYYYY);

    // Generiere PDF
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const docsDir = await ensureDocumentsDir();
    const filename = `Rechnung_${rechnung.rechnungsnummer.replace(/[\/\\]/g, '_')}_${Date.now()}.pdf`;
    const filepath = path.join(docsDir, filename);

    await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });

    await browser.close();

    // Speichere in mitglied_dokumente
    const dokumentname = `Rechnung ${rechnung.rechnungsnummer}`;
    const relativePath = `generated_documents/${filename}`;

    await queryAsync(
      `INSERT INTO mitglied_dokumente
       (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
       VALUES (?, ?, NULL, ?, ?, NOW())`,
      [rechnung.mitglied_id, rechnung.dojo_id, dokumentname, relativePath]
    );

    logger.info(`PDF für Rechnung ${rechnung.rechnungsnummer} erstellt und gespeichert`);
    return { success: true, filepath };
  } catch (error) {
    logger.error('Fehler bei PDF-Generierung:', { error: error });
    throw error;
  }
}

// Helper: Generiere PDF aus Frontend-HTML
async function generatePDFFromHTML(rechnungId, htmlContent) {
  try {
    // Lade Rechnungs-Metadaten für Dateinamen und DB-Eintrag
    const results = await queryAsync(
      `SELECT r.rechnungsnummer, r.mitglied_id, m.dojo_id
       FROM rechnungen r
       JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
       WHERE r.rechnung_id = ?`,
      [rechnungId]
    );

    if (results.length === 0) throw new Error('Rechnung nicht gefunden');
    const rechnung = results[0];

    // Generiere PDF mit Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Setze HTML-Content
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });

    // Warte bis alle Bilder geladen sind (wichtig für QR-Codes)
    await page.waitForFunction(() => {
      const images = Array.from(document.images);
      return images.every(img => img.complete);
    }, { timeout: 5000 }).catch(() => {
      logger.warn('Timeout beim Laden der Bilder, fahre trotzdem fort');
    });

    // Bereite Speicherort vor
    const docsDir = await ensureDocumentsDir();
    const filename = `Rechnung_${rechnung.rechnungsnummer.replace(/[\/\\]/g, '_')}_${Date.now()}.pdf`;
    const filepath = path.join(docsDir, filename);

    // Generiere PDF
    await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    });

    await browser.close();

    // Speichere in mitglied_dokumente
    const dokumentname = `Rechnung ${rechnung.rechnungsnummer}`;
    const relativePath = `generated_documents/${filename}`;

    await queryAsync(
      `INSERT INTO mitglied_dokumente
       (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
       VALUES (?, ?, NULL, ?, ?, NOW())`,
      [rechnung.mitglied_id, rechnung.dojo_id, dokumentname, relativePath]
    );

    logger.info(`PDF aus Frontend-HTML für Rechnung ${rechnung.rechnungsnummer} erstellt`);
    return { success: true, filepath };
  } catch (error) {
    logger.error('Fehler bei PDF-Generierung aus HTML:', { error: error });
    throw error;
  }
}

module.exports = {
  queryAsync,
  ensureDocumentsDir,
  generateEPCQRCodeString,
  generateQRCodeDataURI,
  formatDateDDMMYYYY,
  generateAndSaveRechnungPDF,
  generatePDFFromHTML
};
