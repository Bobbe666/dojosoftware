const express = require('express');
const router = express.Router();
const db = require('../db');
const { createRechnungForBeitrag } = require('../utils/rechnungAutomation');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const QRCode = require('qrcode');
const generateInvoiceHTML = require('../utils/invoicePdfTemplate');

// Helper: Erstelle documents Verzeichnis falls nicht vorhanden
async function ensureDocumentsDir() {
  const docsDir = path.join(__dirname, '..', 'generated_documents');
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
    console.error('Fehler bei QR-Code-Generierung:', error);
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

    const rechnung = await new Promise((resolve, reject) => {
      db.query(rechnungQuery, [rechnungId], (err, results) => {
        if (err) reject(err);
        else if (results.length === 0) reject(new Error('Rechnung nicht gefunden'));
        else resolve(results[0]);
      });
    });

    // Lade Positionen
    const positionen = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM rechnungspositionen WHERE rechnung_id = ? ORDER BY position_nr', [rechnungId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

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

    await new Promise((resolve, reject) => {
      const insertQuery = `
        INSERT INTO mitglied_dokumente
        (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
        VALUES (?, ?, NULL, ?, ?, NOW())
      `;
      db.query(insertQuery, [rechnung.mitglied_id, rechnung.dojo_id, dokumentname, relativePath], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    console.log(`✅ PDF für Rechnung ${rechnung.rechnungsnummer} erstellt und gespeichert`);
    return { success: true, filepath };
  } catch (error) {
    console.error('Fehler bei PDF-Generierung:', error);
    throw error;
  }
}

// Helper: Generiere PDF aus Frontend-HTML
async function generatePDFFromHTML(rechnungId, htmlContent) {
  try {
    // Lade Rechnungs-Metadaten für Dateinamen und DB-Eintrag
    const rechnungQuery = `
      SELECT
        r.rechnungsnummer,
        r.mitglied_id,
        m.dojo_id
      FROM rechnungen r
      JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      WHERE r.rechnung_id = ?
    `;

    const rechnung = await new Promise((resolve, reject) => {
      db.query(rechnungQuery, [rechnungId], (err, results) => {
        if (err) reject(err);
        else if (results.length === 0) reject(new Error('Rechnung nicht gefunden'));
        else resolve(results[0]);
      });
    });

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
      console.warn('⚠️ Timeout beim Laden der Bilder, fahre trotzdem fort');
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

    await new Promise((resolve, reject) => {
      const insertQuery = `
        INSERT INTO mitglied_dokumente
        (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
        VALUES (?, ?, NULL, ?, ?, NOW())
      `;
      db.query(insertQuery, [rechnung.mitglied_id, rechnung.dojo_id, dokumentname, relativePath], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    console.log(`✅ PDF aus Frontend-HTML für Rechnung ${rechnung.rechnungsnummer} erstellt`);
    return { success: true, filepath };
  } catch (error) {
    console.error('Fehler bei PDF-Generierung aus HTML:', error);
    throw error;
  }
}

// ===== RECHNUNGEN ÜBERSICHT =====
// GET /api/rechnungen - Alle Rechnungen mit Filter
router.get('/', (req, res) => {
  const { status, mitglied_id, von, bis, art, archiviert } = req.query;

  let query = `
    SELECT
      r.*,
      CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
      m.email,
      (SELECT COUNT(*) FROM rechnungspositionen WHERE rechnung_id = r.rechnung_id) as anzahl_positionen,
      (SELECT COALESCE(SUM(betrag), 0) FROM zahlungen WHERE rechnung_id = r.rechnung_id) as bezahlter_betrag,
      CASE
        WHEN r.status = 'bezahlt' THEN 'Bezahlt'
        WHEN r.faelligkeitsdatum < CURDATE() AND r.status = 'offen' THEN 'Überfällig'
        ELSE 'Offen'
      END as status_text
    FROM rechnungen r
    JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    WHERE 1=1
  `;

  const params = [];

  if (status) {
    query += ` AND r.status = ?`;
    params.push(status);
  }

  if (mitglied_id) {
    query += ` AND r.mitglied_id = ?`;
    params.push(mitglied_id);
  }

  if (von) {
    query += ` AND r.datum >= ?`;
    params.push(von);
  }

  if (bis) {
    query += ` AND r.datum <= ?`;
    params.push(bis);
  }

  if (art) {
    query += ` AND r.art = ?`;
    params.push(art);
  }

  if (archiviert !== undefined) {
    query += ` AND r.archiviert = ?`;
    params.push(archiviert === 'true' ? 1 : 0);
  }

  query += ` ORDER BY r.datum DESC, r.rechnung_id DESC`;

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Rechnungen:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, data: results });
  });
});

// GET /api/rechnungen/naechste-nummer - Nächste Rechnungsnummer für Datum
router.get('/naechste-nummer', (req, res) => {
  const { datum } = req.query;

  if (!datum) {
    return res.status(400).json({ success: false, error: 'Datum erforderlich' });
  }

  const datumObj = new Date(datum);
  const jahr = datumObj.getFullYear();
  const monat = String(datumObj.getMonth() + 1).padStart(2, '0');
  const tag = String(datumObj.getDate()).padStart(2, '0');
  const datumPrefix = `${jahr}/${monat}/${tag}`;

  const checkQuery = `SELECT COUNT(*) as count FROM rechnungen WHERE DATE(datum) = ?`;

  db.query(checkQuery, [datum], (err, results) => {
    if (err) {
      console.error('Fehler beim Ermitteln der nächsten Nummer:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    const count = results[0].count;
    const laufnummer = 1000 + count;
    const rechnungsnummer = `${datumPrefix}-${laufnummer}`;

    res.json({ success: true, rechnungsnummer: rechnungsnummer });
  });
});

// GET /api/rechnungen/statistiken - Statistiken für Dashboard
router.get('/statistiken', (req, res) => {
  const query = `
    SELECT
      COUNT(*) as gesamt_rechnungen,
      COUNT(CASE WHEN status = 'offen' THEN 1 END) as offene_rechnungen,
      COUNT(CASE WHEN status = 'bezahlt' THEN 1 END) as bezahlte_rechnungen,
      COUNT(CASE WHEN status = 'ueberfaellig' OR (faelligkeitsdatum < CURDATE() AND status = 'offen') THEN 1 END) as ueberfaellige_rechnungen,
      COALESCE(SUM(CASE WHEN status = 'offen' THEN betrag ELSE 0 END), 0) as offene_summe,
      COALESCE(SUM(CASE WHEN status = 'bezahlt' THEN betrag ELSE 0 END), 0) as bezahlte_summe,
      COALESCE(SUM(CASE WHEN status = 'ueberfaellig' OR (faelligkeitsdatum < CURDATE() AND status = 'offen') THEN betrag ELSE 0 END), 0) as ueberfaellige_summe,
      COALESCE(SUM(betrag), 0) as gesamt_summe
    FROM rechnungen
    WHERE archiviert = 0
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Statistiken:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, data: results[0] });
  });
});

// GET /api/rechnungen/:id - Einzelne Rechnung mit Details
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const rechnungQuery = `
    SELECT
      r.*,
      CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
      m.email,
      m.telefon,
      m.plz,
      m.ort
    FROM rechnungen r
    JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    WHERE r.rechnung_id = ?
  `;

  db.query(rechnungQuery, [id], (err, rechnungResults) => {
    if (err) {
      console.error('Fehler beim Laden der Rechnung:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    if (rechnungResults.length === 0) {
      return res.status(404).json({ success: false, error: 'Rechnung nicht gefunden' });
    }

    const rechnung = rechnungResults[0];

    // Lade Positionen
    const positionenQuery = `SELECT * FROM rechnungspositionen WHERE rechnung_id = ? ORDER BY position_nr`;

    db.query(positionenQuery, [id], (posErr, positionen) => {
      if (posErr) {
        console.error('Fehler beim Laden der Positionen:', posErr);
        return res.status(500).json({ success: false, error: posErr.message });
      }

      // Lade Zahlungen
      const zahlungenQuery = `SELECT * FROM zahlungen WHERE rechnung_id = ? ORDER BY zahlungsdatum DESC`;

      db.query(zahlungenQuery, [id], (zahlErr, zahlungen) => {
        if (zahlErr) {
          console.error('Fehler beim Laden der Zahlungen:', zahlErr);
          return res.status(500).json({ success: false, error: zahlErr.message });
        }

        rechnung.positionen = positionen;
        rechnung.zahlungen = zahlungen;

        res.json({ success: true, data: rechnung });
      });
    });
  });
});

// POST /api/rechnungen - Neue Rechnung erstellen
router.post('/', (req, res) => {
  const {
    mitglied_id,
    datum,
    faelligkeitsdatum,
    art,
    beschreibung,
    notizen,
    positionen,
    mwst_satz,
    pdfHtml  // NEU: HTML für PDF-Generierung aus Frontend
  } = req.body;

  // Validierung
  if (!mitglied_id || !datum || !faelligkeitsdatum || !art || !positionen || positionen.length === 0) {
    return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen' });
  }

  // Berechne Beträge
  let netto_betrag = 0;
  positionen.forEach(pos => {
    netto_betrag += parseFloat(pos.gesamtpreis || 0);
  });

  const mwst_satz_num = parseFloat(mwst_satz || 19.0);
  const mwst_betrag = netto_betrag * (mwst_satz_num / 100);
  const brutto_betrag = netto_betrag + mwst_betrag;

  // Generiere Rechnungsnummer im Format yyyy/mm/dd-1000
  const datumObj = new Date(datum);
  const jahr = datumObj.getFullYear();
  const monat = String(datumObj.getMonth() + 1).padStart(2, '0');
  const tag = String(datumObj.getDate()).padStart(2, '0');
  const datumPrefix = `${jahr}/${monat}/${tag}`;

  // Zähle Rechnungen für diesen Tag
  const checkQuery = `SELECT COUNT(*) as count FROM rechnungen WHERE DATE(datum) = ?`;

  db.query(checkQuery, [datum], (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Fehler beim Prüfen der Rechnungsnummer:', checkErr);
      return res.status(500).json({ success: false, error: checkErr.message });
    }

    const count = checkResults[0].count;
    const laufnummer = 1000 + count;
    const rechnungsnummer = `${datumPrefix}-${laufnummer}`;

    // Rechnung einfügen
    const insertQuery = `
      INSERT INTO rechnungen (
        rechnungsnummer, mitglied_id, datum, faelligkeitsdatum,
        betrag, netto_betrag, brutto_betrag, mwst_satz, mwst_betrag,
        art, beschreibung, notizen, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offen')
    `;

    const values = [
      rechnungsnummer, mitglied_id, datum, faelligkeitsdatum,
      brutto_betrag, netto_betrag, brutto_betrag, mwst_satz_num, mwst_betrag,
      art, beschreibung, notizen
    ];

    db.query(insertQuery, values, (insertErr, insertResult) => {
      if (insertErr) {
        console.error('Fehler beim Erstellen der Rechnung:', insertErr);
        return res.status(500).json({ success: false, error: insertErr.message });
      }

      const rechnung_id = insertResult.insertId;

      // Positionen einfügen
      const positionenInserts = positionen.map((pos, index) => {
        return new Promise((resolve, reject) => {
          const posQuery = `
            INSERT INTO rechnungspositionen (
              rechnung_id, position_nr, bezeichnung, menge, einzelpreis, gesamtpreis, mwst_satz, beschreibung
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(posQuery, [
            rechnung_id,
            index + 1,
            pos.bezeichnung,
            pos.menge || 1,
            pos.einzelpreis,
            pos.gesamtpreis,
            pos.mwst_satz || mwst_satz_num,
            pos.beschreibung || null
          ], (posErr) => {
            if (posErr) reject(posErr);
            else resolve();
          });
        });
      });

      Promise.all(positionenInserts)
        .then(async () => {
          // Generiere und speichere PDF im Hintergrund
          try {
            if (pdfHtml) {
              // Nutze Frontend-HTML für PDF-Generierung
              await generatePDFFromHTML(rechnung_id, pdfHtml);
              console.log(`📄 PDF aus Frontend-HTML für Rechnung ${rechnungsnummer} wurde erstellt`);
            } else {
              // Fallback: Nutze Backend-Template
              await generateAndSaveRechnungPDF(rechnung_id);
              console.log(`📄 PDF für Rechnung ${rechnungsnummer} wurde erstellt`);
            }
          } catch (pdfErr) {
            console.error('⚠️ PDF-Generierung fehlgeschlagen (Rechnung wurde trotzdem erstellt):', pdfErr);
            // Fehler nicht weitergeben, da Rechnung erfolgreich erstellt wurde
          }

          res.json({
            success: true,
            message: 'Rechnung erfolgreich erstellt',
            rechnung_id: rechnung_id,
            rechnungsnummer: rechnungsnummer
          });
        })
        .catch(posErr => {
          console.error('Fehler beim Einfügen der Positionen:', posErr);
          res.status(500).json({ success: false, error: posErr.message });
        });
    });
  });
});

// PUT /api/rechnungen/:id - Rechnung aktualisieren
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status, beschreibung, notizen, bezahlt_am, zahlungsart } = req.body;

  const updateQuery = `
    UPDATE rechnungen
    SET status = ?, beschreibung = ?, notizen = ?, bezahlt_am = ?, zahlungsart = ?
    WHERE rechnung_id = ?
  `;

  db.query(updateQuery, [status, beschreibung, notizen, bezahlt_am, zahlungsart, id], (err, result) => {
    if (err) {
      console.error('Fehler beim Aktualisieren der Rechnung:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, message: 'Rechnung aktualisiert' });
  });
});

// POST /api/rechnungen/:id/zahlung - Zahlung erfassen
router.post('/:id/zahlung', (req, res) => {
  const { id } = req.params;
  const { betrag, zahlungsdatum, zahlungsart, referenz, notizen } = req.body;

  if (!betrag || !zahlungsdatum || !zahlungsart) {
    return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen' });
  }

  // Zahlung einfügen
  const insertQuery = `
    INSERT INTO zahlungen (rechnung_id, betrag, zahlungsdatum, zahlungsart, referenz, notizen)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(insertQuery, [id, betrag, zahlungsdatum, zahlungsart, referenz, notizen], (insertErr) => {
    if (insertErr) {
      console.error('Fehler beim Erfassen der Zahlung:', insertErr);
      return res.status(500).json({ success: false, error: insertErr.message });
    }

    // Prüfe Zahlungsstatus
    const checkQuery = `
      SELECT
        r.betrag as rechnung_betrag,
        COALESCE(SUM(z.betrag), 0) as gezahlt
      FROM rechnungen r
      LEFT JOIN zahlungen z ON r.rechnung_id = z.rechnung_id
      WHERE r.rechnung_id = ?
      GROUP BY r.rechnung_id, r.betrag
    `;

    db.query(checkQuery, [id], (checkErr, checkResults) => {
      if (checkErr) {
        console.error('Fehler beim Prüfen des Status:', checkErr);
        return res.status(500).json({ success: false, error: checkErr.message });
      }

      const { rechnung_betrag, gezahlt } = checkResults[0];
      let neuer_status = 'offen';
      let bezahlt_am = null;

      if (parseFloat(gezahlt) >= parseFloat(rechnung_betrag)) {
        neuer_status = 'bezahlt';
        bezahlt_am = zahlungsdatum;
      } else if (parseFloat(gezahlt) > 0) {
        neuer_status = 'teilweise_bezahlt';
      }

      // Update Status
      const updateQuery = `UPDATE rechnungen SET status = ?, bezahlt_am = ? WHERE rechnung_id = ?`;

      db.query(updateQuery, [neuer_status, bezahlt_am, id], (updateErr) => {
        if (updateErr) {
          console.error('Fehler beim Aktualisieren des Status:', updateErr);
          return res.status(500).json({ success: false, error: updateErr.message });
        }

        res.json({ success: true, message: 'Zahlung erfasst', status: neuer_status });
      });
    });
  });
});

// PUT /api/rechnungen/:id/archivieren - Rechnung archivieren
router.put('/:id/archivieren', (req, res) => {
  const { id } = req.params;
  const { archiviert } = req.body;

  const query = `UPDATE rechnungen SET archiviert = ? WHERE rechnung_id = ?`;

  db.query(query, [archiviert ? 1 : 0, id], (err) => {
    if (err) {
      console.error('Fehler beim Archivieren:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, message: archiviert ? 'Rechnung archiviert' : 'Archivierung aufgehoben' });
  });
});

// DELETE /api/rechnungen/:id - Rechnung löschen
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM rechnungen WHERE rechnung_id = ?`;

  db.query(query, [id], (err) => {
    if (err) {
      console.error('Fehler beim Löschen der Rechnung:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, message: 'Rechnung gelöscht' });
  });
});

// ===== AUTOMATISCHE BEITRAGS-RECHNUNGEN =====
// POST /api/rechnungen/generate-monthly - Monatliche Rechnungen für alle 'invoice' Verträge erstellen
router.post('/generate-monthly', async (req, res) => {
  const { monat, jahr } = req.body;

  if (!monat || !jahr) {
    return res.status(400).json({ success: false, error: 'Monat und Jahr erforderlich' });
  }

  try {
    // Alle aktiven Verträge mit payment_method='invoice' laden
    const vertraegeQuery = `
      SELECT v.id, v.mitglied_id, v.payment_method
      FROM vertraege v
      WHERE v.status = 'aktiv'
        AND v.payment_method = 'invoice'
    `;

    db.query(vertraegeQuery, async (err, vertraege) => {
      if (err) {
        console.error('Fehler beim Laden der Verträge:', err);
        return res.status(500).json({ success: false, error: err.message });
      }

      const results = {
        success: 0,
        skipped: 0,
        errors: 0,
        rechnungen: []
      };

      // Für jeden Vertrag Rechnung erstellen
      for (const vertrag of vertraege) {
        try {
          const rechnungInfo = await createRechnungForBeitrag(
            vertrag.id,
            vertrag.mitglied_id,
            monat,
            jahr
          );

          if (rechnungInfo) {
            results.success++;
            results.rechnungen.push(rechnungInfo);
          } else {
            results.skipped++;
          }
        } catch (error) {
          console.error(`Fehler bei Vertrag #${vertrag.id}:`, error);
          results.errors++;
        }
      }

      res.json({
        success: true,
        message: `Rechnungserstellung abgeschlossen: ${results.success} erstellt, ${results.skipped} übersprungen, ${results.errors} Fehler`,
        data: results
      });
    });

  } catch (error) {
    console.error('Fehler bei monatlicher Rechnungserstellung:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/rechnungen/:id/vorschau - HTML-Vorschau für Rechnung (zum Anzeigen/Drucken)
router.get('/:id/vorschau', (req, res) => {
  const { id } = req.params;

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
      d.dojoname,
      d.strasse AS dojo_strasse,
      d.hausnummer AS dojo_hausnummer,
      d.plz AS dojo_plz,
      d.ort AS dojo_ort,
      d.telefon AS dojo_telefon,
      d.email AS dojo_email
    FROM rechnungen r
    JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    LEFT JOIN dojo d ON m.dojo_id = d.id
    WHERE r.rechnung_id = ?
  `;

  db.query(rechnungQuery, [id], (err, rechnungResults) => {
    if (err) {
      console.error('Fehler beim Laden der Rechnung:', err);
      return res.status(500).send('Fehler beim Laden der Rechnung');
    }

    if (rechnungResults.length === 0) {
      return res.status(404).send('Rechnung nicht gefunden');
    }

    const rechnung = rechnungResults[0];

    // Lade Positionen
    const positionenQuery = `SELECT * FROM rechnungspositionen WHERE rechnung_id = ? ORDER BY position_nr`;

    db.query(positionenQuery, [id], (posErr, positionen) => {
      if (posErr) {
        console.error('Fehler beim Laden der Positionen:', posErr);
        return res.status(500).send('Fehler beim Laden der Positionen');
      }

      // Erstelle HTML für Rechnung
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${rechnung.rechnungsnummer}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
      padding: 20mm;
      max-width: 210mm;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3rem;
    }
    .company-small {
      font-size: 8pt;
      color: #666;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #000;
    }
    .recipient {
      margin-top: 1rem;
      line-height: 1.6;
    }
    .meta {
      text-align: right;
      font-size: 9pt;
      line-height: 1.8;
    }
    h1 {
      font-size: 18pt;
      margin: 2rem 0 1rem 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
      font-size: 9pt;
    }
    thead {
      background: #f3f4f6;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    th {
      padding: 0.5rem 0.25rem;
      text-align: left;
      font-weight: bold;
      font-size: 8pt;
    }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) {
      text-align: right;
    }
    td {
      padding: 0.5rem 0.25rem;
      border-bottom: 1px solid #e5e7eb;
    }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) {
      text-align: right;
    }
    .totals {
      margin-left: auto;
      width: 50%;
      font-size: 10pt;
      margin-top: 2rem;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.final {
      font-weight: bold;
      font-size: 11pt;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
    }
    .payment-terms {
      margin-top: 2rem;
      font-size: 9pt;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 20mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-small">
        ${rechnung.dojoname || ''} | ${rechnung.dojo_strasse || ''} ${rechnung.dojo_hausnummer || ''} | ${rechnung.dojo_plz || ''} ${rechnung.dojo_ort || ''}
      </div>
      <div class="recipient">
        <div>Herrn/Frau</div>
        <div>${rechnung.mitglied_name}</div>
        <div>${rechnung.strasse || ''} ${rechnung.hausnummer || ''}</div>
        <div>${rechnung.plz || ''} ${rechnung.ort || ''}</div>
      </div>
    </div>
    <div class="meta">
      <div>Rechnungs-Nr.: ${rechnung.rechnungsnummer}</div>
      <div>Kundennummer: ${rechnung.mitglied_id}</div>
      <div>Belegdatum: ${new Date(rechnung.datum).toLocaleDateString('de-DE')}</div>
      <div>Fälligkeit: ${rechnung.faelligkeitsdatum ? new Date(rechnung.faelligkeitsdatum).toLocaleDateString('de-DE') : '-'}</div>
    </div>
  </div>

  <h1>Rechnung</h1>

  <table>
    <thead>
      <tr>
        <th>Pos.</th>
        <th>Bezeichnung</th>
        <th>Menge</th>
        <th>Preis</th>
        <th>Betrag EUR</th>
      </tr>
    </thead>
    <tbody>
      ${positionen.map(pos => `
        <tr>
          <td>${pos.position_nr}</td>
          <td>${pos.bezeichnung}</td>
          <td>${pos.menge}</td>
          <td>${parseFloat(pos.einzelpreis || 0).toFixed(2)}</td>
          <td>${parseFloat(pos.gesamtpreis || 0).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Nettobetrag:</span>
      <span>${parseFloat(rechnung.netto_betrag || 0).toFixed(2)} €</span>
    </div>
    <div class="totals-row">
      <span>${rechnung.mwst_satz || 19}% MwSt.:</span>
      <span>${parseFloat(rechnung.mwst_betrag || 0).toFixed(2)} €</span>
    </div>
    <div class="totals-row final">
      <span>Endbetrag:</span>
      <span>${parseFloat(rechnung.brutto_betrag || rechnung.betrag || 0).toFixed(2)} €</span>
    </div>
  </div>

  <div class="payment-terms">
    <p>Bitte beachten Sie unsere Zahlungsbedingung:</p>
    <p>Ohne Abzug bis zum ${rechnung.faelligkeitsdatum ? new Date(rechnung.faelligkeitsdatum).toLocaleDateString('de-DE') : '___________'}.</p>
  </div>
</body>
</html>
      `;

      res.send(html);
    });
  });
});

// GET /api/rechnungen/:id/pdf - PDF-Download für Rechnung (aus gespeichertem Dokument)
router.get('/:id/pdf', async (req, res) => {
  const { id } = req.params;

  try {
    // Hole Rechnungsnummer für Suche
    const rechnungQuery = 'SELECT rechnungsnummer, mitglied_id FROM rechnungen WHERE rechnung_id = ?';
    const rechnung = await new Promise((resolve, reject) => {
      db.query(rechnungQuery, [id], (err, results) => {
        if (err) reject(err);
        else if (results.length === 0) reject(new Error('Rechnung nicht gefunden'));
        else resolve(results[0]);
      });
    });

    // Suche nach gespeichertem PDF in mitglied_dokumente
    const dokumentQuery = `
      SELECT dateipfad, dokumentname
      FROM mitglied_dokumente
      WHERE mitglied_id = ?
        AND dokumentname LIKE ?
      ORDER BY erstellt_am DESC
      LIMIT 1
    `;

    const dokument = await new Promise((resolve, reject) => {
      db.query(dokumentQuery, [rechnung.mitglied_id, `Rechnung ${rechnung.rechnungsnummer}%`], (err, results) => {
        if (err) reject(err);
        else resolve(results.length > 0 ? results[0] : null);
      });
    });

    if (!dokument) {
      return res.status(404).json({
        error: 'PDF nicht gefunden',
        message: 'Für diese Rechnung wurde noch kein PDF gespeichert. Bitte erstellen Sie die Rechnung neu.'
      });
    }

    // Erstelle vollständigen Dateipfad
    const filepath = path.join(__dirname, '..', dokument.dateipfad);

    // Prüfe ob Datei existiert
    const fileExists = await fs.access(filepath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(404).json({
        error: 'PDF-Datei nicht gefunden',
        message: 'Die PDF-Datei existiert nicht mehr auf dem Server.'
      });
    }

    // Lese PDF-Datei
    const pdfBuffer = await fs.readFile(filepath);

    // Sende PDF mit korrekten Headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Rechnung_${rechnung.rechnungsnummer.replace(/[\/\\]/g, '_')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(pdfBuffer);

    console.log(`✅ PDF für Rechnung ${rechnung.rechnungsnummer} erfolgreich gesendet`);

  } catch (error) {
    console.error('Fehler beim PDF-Abruf:', error);
    res.status(500).json({ error: 'Fehler beim PDF-Abruf', details: error.message });
  }
});

// ===== AUTOMATISCHE RECHNUNGSERSTELLUNG AUS BEITRÄGEN =====
const { createRechnungenFromBeitraege, syncRechnungStatus } = require('../services/rechnungAutomationFromBeitraege');

// POST /api/rechnungen/auto-create - Erstellt Rechnungen für offene Lastschrift-Beiträge
router.post('/auto-create', async (req, res) => {
  try {
    const { dojo_id } = req.body;
    const result = await createRechnungenFromBeitraege(dojo_id);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Fehler bei automatischer Rechnungserstellung:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/rechnungen/:id/sync-status - Synchronisiert Status mit Beiträgen
router.post('/:id/sync-status', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await syncRechnungStatus(id);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Fehler bei Status-Synchronisation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
