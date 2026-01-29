/**
 * EÜR (Einnahmen-Überschuss-Rechnung) Routes
 * ==========================================
 * Berechnet EÜR für einzelne Dojos und für TDA (Gesamtübersicht)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Alle Routes erfordern Authentifizierung
router.use(authenticateToken);

/**
 * Helper: Führt eine Query aus und gibt ein Promise zurück
 */
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

/**
 * Helper: Formatiert Cent in Euro
 */
const centToEuro = (cent) => (cent || 0) / 100;

/**
 * GET /api/euer/dojo/:dojo_id
 * EÜR für ein einzelnes Dojo
 * Query-Parameter: jahr (default: aktuelles Jahr)
 */
router.get('/dojo/:dojo_id', async (req, res) => {
  const { dojo_id } = req.params;
  const jahr = parseInt(req.query.jahr) || new Date().getFullYear();

  try {
    // 1. Mitgliedsbeiträge (bezahlt)
    const beitraegeQuery = `
      SELECT
        MONTH(zahlungsdatum) as monat,
        SUM(betrag) as summe
      FROM beitraege
      WHERE dojo_id = ?
        AND YEAR(zahlungsdatum) = ?
        AND bezahlt = 1
      GROUP BY MONTH(zahlungsdatum)
    `;
    const beitraege = await queryAsync(beitraegeQuery, [dojo_id, jahr]);

    // 2. Rechnungen (bezahlt)
    const rechnungenQuery = `
      SELECT
        MONTH(bezahlt_am) as monat,
        SUM(betrag) as summe
      FROM rechnungen
      WHERE dojo_id = ?
        AND YEAR(bezahlt_am) = ?
        AND status = 'bezahlt'
      GROUP BY MONTH(bezahlt_am)
    `;
    const rechnungen = await queryAsync(rechnungenQuery, [dojo_id, jahr]);

    // 3. Verkäufe (nicht storniert)
    const verkaufeQuery = `
      SELECT
        MONTH(verkauf_datum) as monat,
        SUM(brutto_gesamt_cent) as summe_cent,
        SUM(netto_gesamt_cent) as netto_cent,
        SUM(mwst_gesamt_cent) as mwst_cent
      FROM verkaeufe
      WHERE dojo_id = ?
        AND YEAR(verkauf_datum) = ?
        AND (storniert IS NULL OR storniert = 0)
      GROUP BY MONTH(verkauf_datum)
    `;
    const verkaeufe = await queryAsync(verkaufeQuery, [dojo_id, jahr]);

    // 4. Kassenbuch Ausgaben
    const ausgabenQuery = `
      SELECT
        MONTH(geschaeft_datum) as monat,
        SUM(betrag_cent) as summe_cent
      FROM kassenbuch
      WHERE dojo_id = ?
        AND YEAR(geschaeft_datum) = ?
        AND bewegungsart = 'Ausgabe'
      GROUP BY MONTH(geschaeft_datum)
    `;
    const ausgaben = await queryAsync(ausgabenQuery, [dojo_id, jahr]);

    // Monatliche Zusammenfassung erstellen
    const monate = [];
    for (let m = 1; m <= 12; m++) {
      const beitragMonat = beitraege.find(b => b.monat === m);
      const rechnungMonat = rechnungen.find(r => r.monat === m);
      const verkaufMonat = verkaeufe.find(v => v.monat === m);
      const ausgabeMonat = ausgaben.find(a => a.monat === m);

      const einnahmen_beitraege = parseFloat(beitragMonat?.summe || 0);
      const einnahmen_rechnungen = parseFloat(rechnungMonat?.summe || 0);
      const einnahmen_verkaeufe = centToEuro(verkaufMonat?.summe_cent || 0);
      const einnahmen_gesamt = einnahmen_beitraege + einnahmen_rechnungen + einnahmen_verkaeufe;

      const ausgaben_gesamt = centToEuro(ausgabeMonat?.summe_cent || 0);
      const ueberschuss = einnahmen_gesamt - ausgaben_gesamt;

      monate.push({
        monat: m,
        monat_name: new Date(jahr, m - 1, 1).toLocaleString('de-DE', { month: 'long' }),
        einnahmen: {
          beitraege: einnahmen_beitraege,
          rechnungen: einnahmen_rechnungen,
          verkaeufe: einnahmen_verkaeufe,
          gesamt: einnahmen_gesamt
        },
        ausgaben: {
          gesamt: ausgaben_gesamt
        },
        ueberschuss
      });
    }

    // Jahressummen
    const jahresSumme = monate.reduce((acc, m) => ({
      einnahmen_beitraege: acc.einnahmen_beitraege + m.einnahmen.beitraege,
      einnahmen_rechnungen: acc.einnahmen_rechnungen + m.einnahmen.rechnungen,
      einnahmen_verkaeufe: acc.einnahmen_verkaeufe + m.einnahmen.verkaeufe,
      einnahmen_gesamt: acc.einnahmen_gesamt + m.einnahmen.gesamt,
      ausgaben_gesamt: acc.ausgaben_gesamt + m.ausgaben.gesamt,
      ueberschuss: acc.ueberschuss + m.ueberschuss
    }), {
      einnahmen_beitraege: 0,
      einnahmen_rechnungen: 0,
      einnahmen_verkaeufe: 0,
      einnahmen_gesamt: 0,
      ausgaben_gesamt: 0,
      ueberschuss: 0
    });

    res.json({
      success: true,
      dojo_id: parseInt(dojo_id),
      jahr,
      monate,
      jahresSumme
    });

  } catch (err) {
    console.error('EÜR Fehler:', err);
    res.status(500).json({ error: 'Fehler bei der EÜR-Berechnung', details: err.message });
  }
});

/**
 * GET /api/euer/tda
 * EÜR für TDA International (Gesamtübersicht)
 * Enthält: Dojo-Mitglieder, Verbandsmitgliedschaften, Software-Einnahmen, Verbandsrechnungen
 * Query-Parameter: jahr (default: aktuelles Jahr)
 */
router.get('/tda', async (req, res) => {
  const jahr = parseInt(req.query.jahr) || new Date().getFullYear();

  // TDA Dojo-ID aus Einstellungen oder Standard
  const TDA_DOJO_ID = 2; // TODO: Aus Konfiguration laden

  try {
    // 1. TDA Dojo-Mitglieder (Beiträge)
    const beitraegeQuery = `
      SELECT
        MONTH(zahlungsdatum) as monat,
        SUM(betrag) as summe
      FROM beitraege
      WHERE dojo_id = ?
        AND YEAR(zahlungsdatum) = ?
        AND bezahlt = 1
      GROUP BY MONTH(zahlungsdatum)
    `;
    const beitraege = await queryAsync(beitraegeQuery, [TDA_DOJO_ID, jahr]);

    // 2. TDA Dojo-Rechnungen
    const rechnungenQuery = `
      SELECT
        MONTH(bezahlt_am) as monat,
        SUM(betrag) as summe
      FROM rechnungen
      WHERE dojo_id = ?
        AND YEAR(bezahlt_am) = ?
        AND status = 'bezahlt'
      GROUP BY MONTH(bezahlt_am)
    `;
    const rechnungen = await queryAsync(rechnungenQuery, [TDA_DOJO_ID, jahr]);

    // 3. TDA Dojo-Verkäufe
    const verkaufeQuery = `
      SELECT
        MONTH(verkauf_datum) as monat,
        SUM(brutto_gesamt_cent) as summe_cent
      FROM verkaeufe
      WHERE dojo_id = ?
        AND YEAR(verkauf_datum) = ?
        AND (storniert IS NULL OR storniert = 0)
      GROUP BY MONTH(verkauf_datum)
    `;
    const verkaeufe = await queryAsync(verkaufeQuery, [TDA_DOJO_ID, jahr]);

    // 4. Verbandsmitgliedschaften (bezahlt)
    const verbandQuery = `
      SELECT
        MONTH(bezahlt_am) as monat,
        SUM(betrag_brutto) as summe
      FROM verbandsmitgliedschaft_zahlungen
      WHERE YEAR(bezahlt_am) = ?
        AND status = 'bezahlt'
      GROUP BY MONTH(bezahlt_am)
    `;
    const verbandZahlungen = await queryAsync(verbandQuery, [jahr]);

    // 5. Software-Einnahmen (Dojo-Abos)
    // TODO: Tabelle für Software-Lizenzen/Abos erstellen
    // Vorerst Platzhalter - muss später implementiert werden
    const softwareQuery = `
      SELECT
        MONTH(bezahlt_am) as monat,
        SUM(betrag) as summe
      FROM software_lizenzen
      WHERE YEAR(bezahlt_am) = ?
        AND status = 'bezahlt'
      GROUP BY MONTH(bezahlt_am)
    `;
    let softwareEinnahmen = [];
    try {
      softwareEinnahmen = await queryAsync(softwareQuery, [jahr]);
    } catch (e) {
      // Tabelle existiert noch nicht - wird später erstellt
      console.log('Software-Lizenzen Tabelle existiert noch nicht');
    }

    // 6. Kassenbuch Ausgaben (TDA)
    const ausgabenQuery = `
      SELECT
        MONTH(geschaeft_datum) as monat,
        SUM(betrag_cent) as summe_cent
      FROM kassenbuch
      WHERE dojo_id = ?
        AND YEAR(geschaeft_datum) = ?
        AND bewegungsart = 'Ausgabe'
      GROUP BY MONTH(geschaeft_datum)
    `;
    const ausgaben = await queryAsync(ausgabenQuery, [TDA_DOJO_ID, jahr]);

    // Monatliche Zusammenfassung erstellen
    const monate = [];
    for (let m = 1; m <= 12; m++) {
      const beitragMonat = beitraege.find(b => b.monat === m);
      const rechnungMonat = rechnungen.find(r => r.monat === m);
      const verkaufMonat = verkaeufe.find(v => v.monat === m);
      const verbandMonat = verbandZahlungen.find(v => v.monat === m);
      const softwareMonat = softwareEinnahmen.find(s => s.monat === m);
      const ausgabeMonat = ausgaben.find(a => a.monat === m);

      const einnahmen_mitglieder = parseFloat(beitragMonat?.summe || 0);
      const einnahmen_rechnungen = parseFloat(rechnungMonat?.summe || 0);
      const einnahmen_verkaeufe = centToEuro(verkaufMonat?.summe_cent || 0);
      const einnahmen_verband = parseFloat(verbandMonat?.summe || 0);
      const einnahmen_software = parseFloat(softwareMonat?.summe || 0);

      const einnahmen_gesamt = einnahmen_mitglieder + einnahmen_rechnungen +
                               einnahmen_verkaeufe + einnahmen_verband + einnahmen_software;

      const ausgaben_gesamt = centToEuro(ausgabeMonat?.summe_cent || 0);
      const ueberschuss = einnahmen_gesamt - ausgaben_gesamt;

      monate.push({
        monat: m,
        monat_name: new Date(jahr, m - 1, 1).toLocaleString('de-DE', { month: 'long' }),
        einnahmen: {
          mitglieder: einnahmen_mitglieder,
          rechnungen: einnahmen_rechnungen,
          verkaeufe: einnahmen_verkaeufe,
          verbandsmitgliedschaften: einnahmen_verband,
          software_lizenzen: einnahmen_software,
          gesamt: einnahmen_gesamt
        },
        ausgaben: {
          gesamt: ausgaben_gesamt
        },
        ueberschuss
      });
    }

    // Jahressummen
    const jahresSumme = monate.reduce((acc, m) => ({
      einnahmen_mitglieder: acc.einnahmen_mitglieder + m.einnahmen.mitglieder,
      einnahmen_rechnungen: acc.einnahmen_rechnungen + m.einnahmen.rechnungen,
      einnahmen_verkaeufe: acc.einnahmen_verkaeufe + m.einnahmen.verkaeufe,
      einnahmen_verband: acc.einnahmen_verband + m.einnahmen.verbandsmitgliedschaften,
      einnahmen_software: acc.einnahmen_software + m.einnahmen.software_lizenzen,
      einnahmen_gesamt: acc.einnahmen_gesamt + m.einnahmen.gesamt,
      ausgaben_gesamt: acc.ausgaben_gesamt + m.ausgaben.gesamt,
      ueberschuss: acc.ueberschuss + m.ueberschuss
    }), {
      einnahmen_mitglieder: 0,
      einnahmen_rechnungen: 0,
      einnahmen_verkaeufe: 0,
      einnahmen_verband: 0,
      einnahmen_software: 0,
      einnahmen_gesamt: 0,
      ausgaben_gesamt: 0,
      ueberschuss: 0
    });

    // Zusätzliche Statistiken für TDA
    const verbandStatsQuery = `
      SELECT
        COUNT(DISTINCT CASE WHEN typ = 'dojo' THEN id END) as anzahl_dojos,
        COUNT(DISTINCT CASE WHEN typ = 'einzel' THEN id END) as anzahl_einzelmitglieder,
        COUNT(*) as gesamt_mitglieder
      FROM verbandsmitgliedschaften
      WHERE status = 'aktiv'
    `;
    const [verbandStats] = await queryAsync(verbandStatsQuery);

    res.json({
      success: true,
      typ: 'tda',
      jahr,
      monate,
      jahresSumme,
      statistiken: {
        aktive_verbandsmitglieder: {
          dojos: verbandStats?.anzahl_dojos || 0,
          einzelpersonen: verbandStats?.anzahl_einzelmitglieder || 0,
          gesamt: verbandStats?.gesamt_mitglieder || 0
        }
      }
    });

  } catch (err) {
    console.error('TDA EÜR Fehler:', err);
    res.status(500).json({ error: 'Fehler bei der TDA EÜR-Berechnung', details: err.message });
  }
});

/**
 * GET /api/euer/kategorien
 * Gibt die EÜR-Kategorien zurück (für Dropdowns etc.)
 */
router.get('/kategorien', (req, res) => {
  res.json({
    einnahmen: [
      { key: 'mitglieder', label: 'Mitgliedsbeiträge', icon: 'users' },
      { key: 'rechnungen', label: 'Rechnungen', icon: 'file-invoice' },
      { key: 'verkaeufe', label: 'Verkäufe/Kasse', icon: 'cash-register' },
      { key: 'verbandsmitgliedschaften', label: 'Verbandsmitgliedschaften', icon: 'building' },
      { key: 'software_lizenzen', label: 'Software-Lizenzen', icon: 'laptop' }
    ],
    ausgaben: [
      { key: 'miete', label: 'Miete & Nebenkosten', icon: 'home' },
      { key: 'personal', label: 'Personalkosten', icon: 'user-tie' },
      { key: 'material', label: 'Material & Ausstattung', icon: 'box' },
      { key: 'marketing', label: 'Marketing & Werbung', icon: 'bullhorn' },
      { key: 'versicherung', label: 'Versicherungen', icon: 'shield' },
      { key: 'sonstiges', label: 'Sonstige Ausgaben', icon: 'ellipsis-h' }
    ]
  });
});

/**
 * GET /api/euer/export/:dojo_id
 * Exportiert die EÜR als CSV
 */
router.get('/export/:dojo_id', async (req, res) => {
  const { dojo_id } = req.params;
  const jahr = parseInt(req.query.jahr) || new Date().getFullYear();
  const isTDA = dojo_id === 'tda';

  try {
    // Daten laden basierend auf Typ
    let euerData;

    if (isTDA) {
      const TDA_DOJO_ID = 2;

      // Alle TDA-relevanten Daten laden
      const beitraege = await queryAsync(`
        SELECT MONTH(zahlungsdatum) as monat, SUM(betrag) as summe
        FROM beitraege WHERE dojo_id = ? AND YEAR(zahlungsdatum) = ? AND bezahlt = 1
        GROUP BY MONTH(zahlungsdatum)
      `, [TDA_DOJO_ID, jahr]);

      const verbandZahlungen = await queryAsync(`
        SELECT MONTH(bezahlt_am) as monat, SUM(betrag_brutto) as summe
        FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(bezahlt_am) = ? AND status = 'bezahlt'
        GROUP BY MONTH(bezahlt_am)
      `, [jahr]);

      const ausgaben = await queryAsync(`
        SELECT MONTH(geschaeft_datum) as monat, SUM(betrag_cent) as summe_cent
        FROM kassenbuch WHERE dojo_id = ? AND YEAR(geschaeft_datum) = ? AND bewegungsart = 'Ausgabe'
        GROUP BY MONTH(geschaeft_datum)
      `, [TDA_DOJO_ID, jahr]);

      euerData = { beitraege, verbandZahlungen, ausgaben, isTDA: true };
    } else {
      // Dojo-spezifische Daten
      const beitraege = await queryAsync(`
        SELECT MONTH(zahlungsdatum) as monat, SUM(betrag) as summe
        FROM beitraege WHERE dojo_id = ? AND YEAR(zahlungsdatum) = ? AND bezahlt = 1
        GROUP BY MONTH(zahlungsdatum)
      `, [dojo_id, jahr]);

      const rechnungen = await queryAsync(`
        SELECT MONTH(bezahlt_am) as monat, SUM(betrag) as summe
        FROM rechnungen WHERE dojo_id = ? AND YEAR(bezahlt_am) = ? AND status = 'bezahlt'
        GROUP BY MONTH(bezahlt_am)
      `, [dojo_id, jahr]);

      const verkaeufe = await queryAsync(`
        SELECT MONTH(verkauf_datum) as monat, SUM(brutto_gesamt_cent) as summe_cent
        FROM verkaeufe WHERE dojo_id = ? AND YEAR(verkauf_datum) = ? AND (storniert IS NULL OR storniert = 0)
        GROUP BY MONTH(verkauf_datum)
      `, [dojo_id, jahr]);

      const ausgaben = await queryAsync(`
        SELECT MONTH(geschaeft_datum) as monat, SUM(betrag_cent) as summe_cent
        FROM kassenbuch WHERE dojo_id = ? AND YEAR(geschaeft_datum) = ? AND bewegungsart = 'Ausgabe'
        GROUP BY MONTH(geschaeft_datum)
      `, [dojo_id, jahr]);

      euerData = { beitraege, rechnungen, verkaeufe, ausgaben, isTDA: false };
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=EUER_${isTDA ? 'TDA' : 'Dojo' + dojo_id}_${jahr}.csv`);

    // CSV Header
    let csv = '\uFEFF'; // BOM für Excel
    if (isTDA) {
      csv += 'Monat;Einnahmen Mitglieder;Einnahmen Verband;Einnahmen Gesamt;Ausgaben Gesamt;Überschuss\n';
    } else {
      csv += 'Monat;Einnahmen Beiträge;Einnahmen Rechnungen;Einnahmen Verkäufe;Einnahmen Gesamt;Ausgaben Gesamt;Überschuss\n';
    }

    // Monatsdaten
    const monatsnamen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                         'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    let jahresSumme = { einnahmen: 0, ausgaben: 0 };

    for (let m = 1; m <= 12; m++) {
      const monatName = monatsnamen[m - 1];

      if (isTDA) {
        const mitglieder = parseFloat(euerData.beitraege.find(b => b.monat === m)?.summe || 0);
        const verband = parseFloat(euerData.verbandZahlungen.find(v => v.monat === m)?.summe || 0);
        const einnahmen = mitglieder + verband;
        const ausgaben = centToEuro(euerData.ausgaben.find(a => a.monat === m)?.summe_cent || 0);
        const ueberschuss = einnahmen - ausgaben;

        jahresSumme.einnahmen += einnahmen;
        jahresSumme.ausgaben += ausgaben;

        csv += `${monatName};${formatCSVNumber(mitglieder)};${formatCSVNumber(verband)};${formatCSVNumber(einnahmen)};${formatCSVNumber(ausgaben)};${formatCSVNumber(ueberschuss)}\n`;
      } else {
        const beitraege = parseFloat(euerData.beitraege.find(b => b.monat === m)?.summe || 0);
        const rechnungen = parseFloat(euerData.rechnungen.find(r => r.monat === m)?.summe || 0);
        const verkaeufe = centToEuro(euerData.verkaeufe.find(v => v.monat === m)?.summe_cent || 0);
        const einnahmen = beitraege + rechnungen + verkaeufe;
        const ausgaben = centToEuro(euerData.ausgaben.find(a => a.monat === m)?.summe_cent || 0);
        const ueberschuss = einnahmen - ausgaben;

        jahresSumme.einnahmen += einnahmen;
        jahresSumme.ausgaben += ausgaben;

        csv += `${monatName};${formatCSVNumber(beitraege)};${formatCSVNumber(rechnungen)};${formatCSVNumber(verkaeufe)};${formatCSVNumber(einnahmen)};${formatCSVNumber(ausgaben)};${formatCSVNumber(ueberschuss)}\n`;
      }
    }

    // Jahressumme
    csv += `\nGESAMT ${jahr};;;;${formatCSVNumber(jahresSumme.einnahmen)};${formatCSVNumber(jahresSumme.ausgaben)};${formatCSVNumber(jahresSumme.einnahmen - jahresSumme.ausgaben)}\n`;

    res.send(csv);

  } catch (err) {
    console.error('EÜR Export Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Export' });
  }
});

/**
 * Helper: Formatiert Zahl für CSV (mit Komma als Dezimaltrennzeichen)
 */
const formatCSVNumber = (num) => {
  return num.toFixed(2).replace('.', ',');
};

/**
 * GET /api/euer/pdf/dojo/:dojo_id
 * Generiert EÜR als PDF für ein Dojo
 */
router.get('/pdf/dojo/:dojo_id', async (req, res) => {
  const { dojo_id } = req.params;
  const jahr = parseInt(req.query.jahr) || new Date().getFullYear();

  try {
    // Dojo-Daten laden
    const [dojoInfo] = await queryAsync(`
      SELECT d.*, d.dojoname as name
      FROM dojo d
      WHERE d.id = ?
    `, [dojo_id]);

    // EÜR-Daten berechnen (gleiche Logik wie GET /dojo/:dojo_id)
    const beitraege = await queryAsync(`
      SELECT MONTH(zahlungsdatum) as monat, SUM(betrag) as summe
      FROM beitraege WHERE dojo_id = ? AND YEAR(zahlungsdatum) = ? AND bezahlt = 1
      GROUP BY MONTH(zahlungsdatum)
    `, [dojo_id, jahr]);

    const rechnungen = await queryAsync(`
      SELECT MONTH(bezahlt_am) as monat, SUM(betrag) as summe
      FROM rechnungen WHERE dojo_id = ? AND YEAR(bezahlt_am) = ? AND status = 'bezahlt'
      GROUP BY MONTH(bezahlt_am)
    `, [dojo_id, jahr]);

    const verkaeufe = await queryAsync(`
      SELECT MONTH(verkauf_datum) as monat, SUM(brutto_gesamt_cent) as summe_cent
      FROM verkaeufe WHERE dojo_id = ? AND YEAR(verkauf_datum) = ? AND (storniert IS NULL OR storniert = 0)
      GROUP BY MONTH(verkauf_datum)
    `, [dojo_id, jahr]);

    const ausgaben = await queryAsync(`
      SELECT MONTH(geschaeft_datum) as monat, SUM(betrag_cent) as summe_cent
      FROM kassenbuch WHERE dojo_id = ? AND YEAR(geschaeft_datum) = ? AND bewegungsart = 'Ausgabe'
      GROUP BY MONTH(geschaeft_datum)
    `, [dojo_id, jahr]);

    // Monatliche Zusammenfassung
    const monate = [];
    for (let m = 1; m <= 12; m++) {
      const beitragMonat = beitraege.find(b => b.monat === m);
      const rechnungMonat = rechnungen.find(r => r.monat === m);
      const verkaufMonat = verkaeufe.find(v => v.monat === m);
      const ausgabeMonat = ausgaben.find(a => a.monat === m);

      const einnahmen_beitraege = parseFloat(beitragMonat?.summe || 0);
      const einnahmen_rechnungen = parseFloat(rechnungMonat?.summe || 0);
      const einnahmen_verkaeufe = centToEuro(verkaufMonat?.summe_cent || 0);
      const einnahmen_gesamt = einnahmen_beitraege + einnahmen_rechnungen + einnahmen_verkaeufe;
      const ausgaben_gesamt = centToEuro(ausgabeMonat?.summe_cent || 0);

      monate.push({
        monat: m,
        einnahmen: {
          beitraege: einnahmen_beitraege,
          rechnungen: einnahmen_rechnungen,
          verkaeufe: einnahmen_verkaeufe,
          gesamt: einnahmen_gesamt
        },
        ausgaben: { gesamt: ausgaben_gesamt },
        ueberschuss: einnahmen_gesamt - ausgaben_gesamt
      });
    }

    const jahresSumme = monate.reduce((acc, m) => ({
      einnahmen_beitraege: acc.einnahmen_beitraege + m.einnahmen.beitraege,
      einnahmen_rechnungen: acc.einnahmen_rechnungen + m.einnahmen.rechnungen,
      einnahmen_verkaeufe: acc.einnahmen_verkaeufe + m.einnahmen.verkaeufe,
      einnahmen_gesamt: acc.einnahmen_gesamt + m.einnahmen.gesamt,
      ausgaben_gesamt: acc.ausgaben_gesamt + m.ausgaben.gesamt,
      ueberschuss: acc.ueberschuss + m.ueberschuss
    }), {
      einnahmen_beitraege: 0, einnahmen_rechnungen: 0, einnahmen_verkaeufe: 0,
      einnahmen_gesamt: 0, ausgaben_gesamt: 0, ueberschuss: 0
    });

    // PDF generieren
    const generateEuerPdfHTML = require('../utils/euerPdfTemplate');
    const puppeteer = require('puppeteer');

    const html = generateEuerPdfHTML(
      { jahr, monate, jahresSumme, isTDA: false },
      dojoInfo
    );

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();

    const filename = `EUER_${dojoInfo?.dojoname?.replace(/[^a-zA-Z0-9]/g, '_') || 'Dojo'}_${jahr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('EÜR PDF Fehler:', err);
    res.status(500).json({ error: 'Fehler bei der PDF-Generierung', details: err.message });
  }
});

/**
 * GET /api/euer/pdf/tda
 * Generiert EÜR als PDF für TDA International
 */
router.get('/pdf/tda', async (req, res) => {
  const jahr = parseInt(req.query.jahr) || new Date().getFullYear();
  const TDA_DOJO_ID = 2;

  try {
    // TDA-Daten laden
    const [dojoInfo] = await queryAsync(`
      SELECT d.*, d.dojoname as name
      FROM dojo d
      WHERE d.id = ?
    `, [TDA_DOJO_ID]);

    // TDA-spezifische Daten
    const beitraege = await queryAsync(`
      SELECT MONTH(zahlungsdatum) as monat, SUM(betrag) as summe
      FROM beitraege WHERE dojo_id = ? AND YEAR(zahlungsdatum) = ? AND bezahlt = 1
      GROUP BY MONTH(zahlungsdatum)
    `, [TDA_DOJO_ID, jahr]);

    const rechnungen = await queryAsync(`
      SELECT MONTH(bezahlt_am) as monat, SUM(betrag) as summe
      FROM rechnungen WHERE dojo_id = ? AND YEAR(bezahlt_am) = ? AND status = 'bezahlt'
      GROUP BY MONTH(bezahlt_am)
    `, [TDA_DOJO_ID, jahr]);

    const verkaeufe = await queryAsync(`
      SELECT MONTH(verkauf_datum) as monat, SUM(brutto_gesamt_cent) as summe_cent
      FROM verkaeufe WHERE dojo_id = ? AND YEAR(verkauf_datum) = ? AND (storniert IS NULL OR storniert = 0)
      GROUP BY MONTH(verkauf_datum)
    `, [TDA_DOJO_ID, jahr]);

    const verbandZahlungen = await queryAsync(`
      SELECT MONTH(bezahlt_am) as monat, SUM(betrag_brutto) as summe
      FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(bezahlt_am) = ? AND status = 'bezahlt'
      GROUP BY MONTH(bezahlt_am)
    `, [jahr]);

    let softwareEinnahmen = [];
    try {
      softwareEinnahmen = await queryAsync(`
        SELECT MONTH(bezahlt_am) as monat, SUM(betrag) as summe
        FROM software_lizenzen WHERE YEAR(bezahlt_am) = ? AND status = 'bezahlt'
        GROUP BY MONTH(bezahlt_am)
      `, [jahr]);
    } catch (e) {
      // Tabelle existiert evtl. nicht
    }

    const ausgaben = await queryAsync(`
      SELECT MONTH(geschaeft_datum) as monat, SUM(betrag_cent) as summe_cent
      FROM kassenbuch WHERE dojo_id = ? AND YEAR(geschaeft_datum) = ? AND bewegungsart = 'Ausgabe'
      GROUP BY MONTH(geschaeft_datum)
    `, [TDA_DOJO_ID, jahr]);

    // Monatliche Zusammenfassung
    const monate = [];
    for (let m = 1; m <= 12; m++) {
      const beitragMonat = beitraege.find(b => b.monat === m);
      const rechnungMonat = rechnungen.find(r => r.monat === m);
      const verkaufMonat = verkaeufe.find(v => v.monat === m);
      const verbandMonat = verbandZahlungen.find(v => v.monat === m);
      const softwareMonat = softwareEinnahmen.find(s => s.monat === m);
      const ausgabeMonat = ausgaben.find(a => a.monat === m);

      const einnahmen_mitglieder = parseFloat(beitragMonat?.summe || 0);
      const einnahmen_rechnungen = parseFloat(rechnungMonat?.summe || 0);
      const einnahmen_verkaeufe = centToEuro(verkaufMonat?.summe_cent || 0);
      const einnahmen_verband = parseFloat(verbandMonat?.summe || 0);
      const einnahmen_software = parseFloat(softwareMonat?.summe || 0);
      const einnahmen_gesamt = einnahmen_mitglieder + einnahmen_rechnungen +
                               einnahmen_verkaeufe + einnahmen_verband + einnahmen_software;
      const ausgaben_gesamt = centToEuro(ausgabeMonat?.summe_cent || 0);

      monate.push({
        monat: m,
        einnahmen: {
          mitglieder: einnahmen_mitglieder,
          rechnungen: einnahmen_rechnungen,
          verkaeufe: einnahmen_verkaeufe,
          verbandsmitgliedschaften: einnahmen_verband,
          software_lizenzen: einnahmen_software,
          gesamt: einnahmen_gesamt
        },
        ausgaben: { gesamt: ausgaben_gesamt },
        ueberschuss: einnahmen_gesamt - ausgaben_gesamt
      });
    }

    const jahresSumme = monate.reduce((acc, m) => ({
      einnahmen_mitglieder: acc.einnahmen_mitglieder + m.einnahmen.mitglieder,
      einnahmen_rechnungen: acc.einnahmen_rechnungen + m.einnahmen.rechnungen,
      einnahmen_verkaeufe: acc.einnahmen_verkaeufe + m.einnahmen.verkaeufe,
      einnahmen_verband: acc.einnahmen_verband + m.einnahmen.verbandsmitgliedschaften,
      einnahmen_software: acc.einnahmen_software + m.einnahmen.software_lizenzen,
      einnahmen_gesamt: acc.einnahmen_gesamt + m.einnahmen.gesamt,
      ausgaben_gesamt: acc.ausgaben_gesamt + m.ausgaben.gesamt,
      ueberschuss: acc.ueberschuss + m.ueberschuss
    }), {
      einnahmen_mitglieder: 0, einnahmen_rechnungen: 0, einnahmen_verkaeufe: 0,
      einnahmen_verband: 0, einnahmen_software: 0, einnahmen_gesamt: 0,
      ausgaben_gesamt: 0, ueberschuss: 0
    });

    // PDF generieren
    const generateEuerPdfHTML = require('../utils/euerPdfTemplate');
    const puppeteer = require('puppeteer');

    const html = generateEuerPdfHTML(
      { jahr, monate, jahresSumme, isTDA: true },
      { ...dojoInfo, dojoname: 'Tiger & Dragon Association International' }
    );

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="EUER_TDA_International_${jahr}.pdf"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('TDA EÜR PDF Fehler:', err);
    res.status(500).json({ error: 'Fehler bei der PDF-Generierung', details: err.message });
  }
});

module.exports = router;
