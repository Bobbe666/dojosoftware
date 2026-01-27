// Backend/services/vertragPdfGeneratorExtended.js
// PDF-Generierung nach Template-Vorlage (Vertrag - 12.11.2023.pdf)

const PDFDocument = require('pdfkit');
const db = require('../db');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Promise-Wrapper für Datenbankabfragen
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
 * Lädt aktive Vertragsdokumente für ein Dojo
 */
const loadVertragsdokumente = async (dojoId, dokumentTypen = ['agb', 'datenschutz', 'broschure']) => {
  try {
    const placeholders = dokumentTypen.map(() => '?').join(', ');
    const query = `
      SELECT
        id,
        dokumenttyp,
        version,
        titel,
        inhalt,
        gueltig_ab,
        gueltig_bis
      FROM vertragsdokumente
      WHERE dojo_id = ?
        AND dokumenttyp IN (${placeholders})
        AND aktiv = true
        AND gueltig_ab <= CURDATE()
        AND (gueltig_bis IS NULL OR gueltig_bis >= CURDATE())
      ORDER BY dokumenttyp, version DESC
    `;

    const params = [dojoId, ...dokumentTypen];
    const results = await queryAsync(query, params);

    // Nur das neueste Dokument pro Typ nehmen
    const dokumenteMap = new Map();
    results.forEach(dok => {
      if (!dokumenteMap.has(dok.dokumenttyp)) {
        dokumenteMap.set(dok.dokumenttyp, dok);
      }
    });

    return Array.from(dokumenteMap.values());
  } catch (error) {
    logger.error('❌ Fehler beim Laden der Vertragsdokumente:', { error: error.message, stack: error.stack });
    return [];
  }
};

/**
 * Zeichnet eine graue Box mit Text (Template-Style)
 */
const drawGreyBox = (doc, x, y, width, height, label, value, fontSize = 9) => {
  // Graue Box
  doc.rect(x, y, width, height)
     .fillAndStroke('#F0F0F0', '#CCCCCC')
     .fill('#000000');

  // Label (kleinere Schrift, oben)
  doc.fontSize(7)
     .fillColor('#666666')
     .text(label, x + 5, y + 3, { width: width - 10, align: 'left' });

  // Value (größere Schrift, darunter)
  doc.fontSize(fontSize)
     .fillColor('#000000')
     .text(value || '', x + 5, y + 12, { width: width - 10, align: 'left' });
};

/**
 * Zeichnet eine Tabellenzeile mit Label und Value
 */
const drawTableRow = (doc, x, y, labelWidth, valueWidth, height, label, value) => {
  // Label Box (links)
  doc.rect(x, y, labelWidth, height)
     .fillAndStroke('#F8F8F8', '#CCCCCC');

  doc.fontSize(9)
     .fillColor('#333333')
     .text(label, x + 5, y + 8, { width: labelWidth - 10, align: 'left' });

  // Value Box (rechts)
  doc.rect(x + labelWidth, y, valueWidth, height)
     .fillAndStroke('#FFFFFF', '#CCCCCC');

  doc.fontSize(9)
     .fillColor('#000000')
     .text(value || '', x + labelWidth + 5, y + 8, { width: valueWidth - 10, align: 'left' });
};

/**
 * SEITE 1: MITGLIEDSVERTRAG (Template-Design)
 */
const generatePage1_Mitgliedsvertrag = (doc, dojo, mitglied, vertrag, logoPath = null) => {
  const pageWidth = 595.28; // A4 width in points
  const margin = 50;

  // ========================================
  // LOGO (rechts oben)
  // ========================================
  // Verwende dynamisches Logo aus dojo_logos oder Fallback
  let actualLogoPath = logoPath;
  if (!actualLogoPath || !fs.existsSync(actualLogoPath)) {
    // Fallback auf Standard-Logo
    actualLogoPath = path.join(__dirname, '../../assets/dojo-logo.png');
  }

  if (fs.existsSync(actualLogoPath)) {
    doc.image(actualLogoPath, pageWidth - margin - 80, margin, { width: 80 });
  }

  // ========================================
  // HEADER: Dojo-Informationen (links oben)
  // ========================================
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text(dojo.dojoname || 'Dojo Name', margin, margin);

  doc.fontSize(8)
     .font('Helvetica')
     .text(dojo.untertitel || '', margin, margin + 18)
     .text(`${dojo.strasse || ''} ${dojo.hausnummer || ''}`, margin, margin + 30)
     .text(`${dojo.plz || ''} ${dojo.ort || ''}`, margin, margin + 42)
     .text(`Tel: ${dojo.telefon || ''}`, margin, margin + 54)
     .text(`E-Mail: ${dojo.email || ''}`, margin, margin + 66)
     .text(`Web: ${dojo.internet || ''}`, margin, margin + 78);

  // ========================================
  // TITEL: MITGLIEDSVERTRAG
  // ========================================
  let currentY = margin + 110;

  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('MITGLIEDSVERTRAG', margin, currentY, { align: 'center', width: pageWidth - 2 * margin });

  currentY += 35;

  // ========================================
  // GRAUER KASTEN: Vertragsnummer + Datum
  // ========================================
  const boxWidth = (pageWidth - 2 * margin - 10) / 2;
  drawGreyBox(doc, margin, currentY, boxWidth, 30, 'Vertragsnummer', vertrag.vertragsnummer || '[wird vergeben]', 10);
  drawGreyBox(doc, margin + boxWidth + 10, currentY, boxWidth, 30, 'Datum', new Date().toLocaleDateString('de-DE'), 10);

  currentY += 45;

  // ========================================
  // TABELLE: Persönliche Daten
  // ========================================
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('Persönliche Daten', margin, currentY);

  currentY += 20;

  const tableWidth = pageWidth - 2 * margin;
  const labelWidth = 150;
  const valueWidth = tableWidth - labelWidth;
  const rowHeight = 25;

  // Mitgliedsnummer
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Mitgliedsnummer:', mitglied.mitgliedsnummer || '[wird vergeben]');
  currentY += rowHeight;

  // Anrede
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Anrede:', mitglied.anrede || '');
  currentY += rowHeight;

  // Vorname
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Vorname:', mitglied.vorname || '');
  currentY += rowHeight;

  // Nachname
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Nachname:', mitglied.nachname || '');
  currentY += rowHeight;

  // Geburtsdatum
  const geburtsdatum = mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : '';
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Geburtsdatum:', geburtsdatum);
  currentY += rowHeight;

  // Straße + Hausnummer
  const adresse = `${mitglied.strasse || ''} ${mitglied.hausnummer || ''}`.trim();
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Straße, Hausnr.:', adresse);
  currentY += rowHeight;

  // PLZ + Ort
  const plzOrt = `${mitglied.plz || ''} ${mitglied.ort || ''}`.trim();
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'PLZ, Ort:', plzOrt);
  currentY += rowHeight;

  // Telefon
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Telefon:', mitglied.telefon || '');
  currentY += rowHeight;

  // E-Mail
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'E-Mail:', mitglied.email || '');
  currentY += rowHeight + 20;

  // ========================================
  // VERTRAGSDATEN
  // ========================================
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('Vertragsdaten', margin, currentY);

  currentY += 20;

  // Vertragsbeginn
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Vertragsbeginn:', vertrag.vertragsbeginn || '');
  currentY += rowHeight;

  // Monatsbeitrag
  const monatsbeitrag = vertrag.monatsbeitrag ? `${vertrag.monatsbeitrag} EUR` : '';
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Monatsbeitrag:', monatsbeitrag);
  currentY += rowHeight;

  // Zahlungsweise
  const billingCycle = getBillingCycleLabel(vertrag.billing_cycle);
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Zahlungsweise:', billingCycle);
  currentY += rowHeight;

  // Zahlungsmethode
  const paymentMethod = getPaymentMethodLabel(vertrag.payment_method);
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Zahlungsmethode:', paymentMethod);
  currentY += rowHeight;

  // Mindestlaufzeit
  const mindestlaufzeit = `${vertrag.mindestlaufzeit_monate || 12} Monate`;
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Mindestlaufzeit:', mindestlaufzeit);
  currentY += rowHeight;

  // Kündigungsfrist
  const kuendigungsfrist = `${vertrag.kuendigungsfrist_monate || 3} Monate`;
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Kündigungsfrist:', kuendigungsfrist);
  currentY += rowHeight + 20;

  // ========================================
  // UNTERSCHRIFTEN
  // ========================================
  if (currentY > 700) {
    doc.addPage();
    currentY = margin;
  }

  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('Unterschriften', margin, currentY);

  currentY += 20;

  doc.fontSize(8)
     .font('Helvetica')
     .text('Mit meiner Unterschrift bestätige ich, dass ich den Mitgliedsvertrag und alle zugehörigen Dokumente gelesen und verstanden habe.', margin, currentY, { align: 'justify', width: tableWidth });

  currentY += 40;

  // Unterschrift Dojo (links)
  const signatureBoxWidth = (tableWidth - 20) / 2;
  doc.fontSize(8)
     .text(`${dojo.ort || '[Ort]'}, ${new Date().toLocaleDateString('de-DE')}`, margin, currentY);

  doc.moveTo(margin, currentY + 50)
     .lineTo(margin + signatureBoxWidth, currentY + 50)
     .stroke();

  doc.fontSize(8)
     .text('Unterschrift Dojo/Trainer', margin, currentY + 55, { width: signatureBoxWidth, align: 'center' });

  // Unterschrift Mitglied (rechts)
  const rightX = margin + signatureBoxWidth + 20;
  doc.fontSize(8)
     .text(`${mitglied.ort || '[Ort]'}, _______________`, rightX, currentY);

  doc.moveTo(rightX, currentY + 50)
     .lineTo(rightX + signatureBoxWidth, currentY + 50)
     .stroke();

  doc.fontSize(8)
     .text('Unterschrift Mitglied', rightX, currentY + 55, { width: signatureBoxWidth, align: 'center' })
     .text(`(${mitglied.vorname || ''} ${mitglied.nachname || ''})`, rightX, currentY + 68, { width: signatureBoxWidth, align: 'center' });
};

/**
 * SEITE 2: SEPA-LASTSCHRIFTMANDAT
 */
const generatePage2_SEPA = (doc, dojo, mitglied, vertrag) => {
  doc.addPage();

  const pageWidth = 595.28;
  const margin = 50;
  const tableWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // ========================================
  // TITEL
  // ========================================
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('SEPA-LASTSCHRIFTMANDAT', margin, currentY, { align: 'center', width: tableWidth });

  currentY += 35;

  // ========================================
  // Gläubiger-Informationen
  // ========================================
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('Zahlungsempfänger (Gläubiger)', margin, currentY);

  currentY += 20;

  const labelWidth = 150;
  const valueWidth = tableWidth - labelWidth;
  const rowHeight = 25;

  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Name:', dojo.dojoname || '');
  currentY += rowHeight;

  const dojoAdresse = `${dojo.strasse || ''} ${dojo.hausnummer || ''}`.trim();
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Straße, Hausnr.:', dojoAdresse);
  currentY += rowHeight;

  const dojoPlzOrt = `${dojo.plz || ''} ${dojo.ort || ''}`.trim();
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'PLZ, Ort:', dojoPlzOrt);
  currentY += rowHeight;

  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Gläubiger-ID:', dojo.glaeubiger_id || '[Gläubiger-ID]');
  currentY += rowHeight;

  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Mandatsreferenz:', vertrag.vertragsnummer || '[Mandatsreferenz]');
  currentY += rowHeight + 20;

  // ========================================
  // Zahler-Informationen (Mitglied)
  // ========================================
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('Zahler (Schuldner)', margin, currentY);

  currentY += 20;

  const mitgliedName = `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim();
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Name:', mitgliedName);
  currentY += rowHeight;

  const mitgliedAdresse = `${mitglied.strasse || ''} ${mitglied.hausnummer || ''}`.trim();
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Straße, Hausnr.:', mitgliedAdresse);
  currentY += rowHeight;

  const mitgliedPlzOrt = `${mitglied.plz || ''} ${mitglied.ort || ''}`.trim();
  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'PLZ, Ort:', mitgliedPlzOrt);
  currentY += rowHeight + 20;

  // ========================================
  // Bankverbindung
  // ========================================
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('Bankverbindung', margin, currentY);

  currentY += 20;

  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'IBAN:', mitglied.iban || '');
  currentY += rowHeight;

  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'BIC:', mitglied.bic || '');
  currentY += rowHeight;

  drawTableRow(doc, margin, currentY, labelWidth, valueWidth, rowHeight, 'Kreditinstitut:', mitglied.bank || '');
  currentY += rowHeight + 20;

  // ========================================
  // SEPA-Mandatstext
  // ========================================
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .text('SEPA-Lastschriftmandat', margin, currentY);

  currentY += 15;

  doc.fontSize(8)
     .font('Helvetica')
     .text(
       'Ich ermächtige den oben genannten Zahlungsempfänger (Gläubiger), Zahlungen von meinem Konto mittels Lastschrift einzuziehen. ' +
       'Zugleich weise ich mein Kreditinstitut an, die vom Zahlungsempfänger auf mein Konto gezogenen Lastschriften einzulösen.',
       margin,
       currentY,
       { align: 'justify', width: tableWidth, lineGap: 2 }
     );

  currentY += 40;

  doc.fontSize(7)
     .fillColor('#666666')
     .text(
       'Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. ' +
       'Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.',
       margin,
       currentY,
       { align: 'justify', width: tableWidth, lineGap: 1 }
     );

  currentY += 50;

  // ========================================
  // Unterschrift
  // ========================================
  const signatureBoxWidth = (tableWidth - 20) / 2;

  doc.fontSize(8)
     .fillColor('#000000')
     .text(`${mitglied.ort || '[Ort]'}, ${new Date().toLocaleDateString('de-DE')}`, margin, currentY);

  doc.moveTo(margin, currentY + 50)
     .lineTo(margin + signatureBoxWidth, currentY + 50)
     .stroke();

  doc.fontSize(8)
     .text('Unterschrift Kontoinhaber', margin, currentY + 55, { width: signatureBoxWidth, align: 'center' })
     .text(`(${mitgliedName})`, margin, currentY + 68, { width: signatureBoxWidth, align: 'center' });
};

/**
 * SEITE 3: ZAHLUNGSTERMINE
 */
const generatePage3_Zahlungstermine = (doc, dojo, mitglied, vertrag, zahlungen) => {
  doc.addPage();

  const pageWidth = 595.28;
  const margin = 50;
  const tableWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // ========================================
  // TITEL
  // ========================================
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('ZAHLUNGSTERMINE', margin, currentY, { align: 'center', width: tableWidth });

  currentY += 40;

  // ========================================
  // Tabellen-Header
  // ========================================
  const colWidths = {
    datum: 100,
    typ: 90,
    beschreibung: 220,
    betrag: 85
  };

  // Header-Hintergrund (dunkelgrau)
  doc.rect(margin, currentY, tableWidth, 25)
     .fillAndStroke('#666666', '#000000');

  // Header-Text (weiß)
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor('#FFFFFF')
     .text('Fälligkeitsdatum', margin + 5, currentY + 8, { width: colWidths.datum - 10 })
     .text('Typ', margin + colWidths.datum + 5, currentY + 8, { width: colWidths.typ - 10 })
     .text('Beschreibung', margin + colWidths.datum + colWidths.typ + 5, currentY + 8, { width: colWidths.beschreibung - 10 })
     .text('Betrag', margin + colWidths.datum + colWidths.typ + colWidths.beschreibung + 5, currentY + 8, { width: colWidths.betrag - 10, align: 'right' });

  currentY += 25;

  // ========================================
  // Zahlungstermine generieren (falls nicht vorhanden)
  // ========================================
  if (!zahlungen || zahlungen.length === 0) {
    zahlungen = generatePaymentSchedule(vertrag);
  }

  // ========================================
  // Tabellen-Zeilen
  // ========================================
  const rowHeight = 30;
  let rowIndex = 0;

  zahlungen.forEach((zahlung) => {
    // Seitenumbruch prüfen
    if (currentY + rowHeight > doc.page.height - 100) {
      doc.addPage();
      currentY = margin;
    }

    // Alternierende Zeilenfarben
    const fillColor = rowIndex % 2 === 0 ? '#F8F8F8' : '#FFFFFF';

    doc.rect(margin, currentY, tableWidth, rowHeight)
       .fillAndStroke(fillColor, '#CCCCCC');

    // Daten
    const fälligkeitsdatum = zahlung.faelligkeitsdatum || zahlung.datum || '';
    const typ = zahlung.typ || 'Vertrag';
    const beschreibung = zahlung.beschreibung || '';
    const betrag = zahlung.betrag ? `${parseFloat(zahlung.betrag).toFixed(2)} €` : '';

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#000000')
       .text(fälligkeitsdatum, margin + 5, currentY + 10, { width: colWidths.datum - 10 })
       .text(typ, margin + colWidths.datum + 5, currentY + 10, { width: colWidths.typ - 10 })
       .text(beschreibung, margin + colWidths.datum + colWidths.typ + 5, currentY + 10, { width: colWidths.beschreibung - 10 })
       .text(betrag, margin + colWidths.datum + colWidths.typ + colWidths.beschreibung + 5, currentY + 10, { width: colWidths.betrag - 10, align: 'right' });

    currentY += rowHeight;
    rowIndex++;
  });
};

/**
 * Hilfsfunktion: Generiert Zahlungstermine basierend auf Vertragsdaten
 */
const generatePaymentSchedule = (vertrag) => {
  const schedule = [];
  const startDate = new Date(vertrag.vertragsbeginn || new Date());
  const monatsbeitrag = parseFloat(vertrag.monatsbeitrag || 0);
  const aufnahmegebuehr = parseFloat(vertrag.aufnahmegebuehr || 0);
  const mindestlaufzeit = parseInt(vertrag.mindestlaufzeit_monate || 12);

  // Aufnahmegebühr (falls vorhanden)
  if (aufnahmegebuehr > 0) {
    schedule.push({
      faelligkeitsdatum: startDate.toLocaleDateString('de-DE'),
      typ: 'Startpaket',
      beschreibung: 'Aufnahmegebühr',
      betrag: aufnahmegebuehr
    });
  }

  // Monatliche Beiträge für Mindestlaufzeit
  for (let i = 0; i < mindestlaufzeit; i++) {
    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + i);

    const nextMonth = new Date(paymentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(0); // Letzter Tag des Monats

    schedule.push({
      faelligkeitsdatum: paymentDate.toLocaleDateString('de-DE'),
      typ: 'Vertrag',
      beschreibung: `${vertrag.tarifname || 'Mitgliedschaft'}\n${paymentDate.toLocaleDateString('de-DE')} - ${nextMonth.toLocaleDateString('de-DE')}`,
      betrag: monatsbeitrag
    });
  }

  return schedule.slice(0, 8); // Maximal 8 Termine anzeigen
};

/**
 * SEITE 4-5: BROSCHÜRE MIT LOGO UND WILLKOMMEN
 */
const generatePage_Broschure = (doc, dojo) => {
  doc.addPage();

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;

  // ========================================
  // LOGO/BILD (zentriert, falls vorhanden)
  // ========================================
  const logoPath = path.join(__dirname, '../../assets/dojo-logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, (pageWidth - 150) / 2, margin + 50, { width: 150 });
  }

  let currentY = margin + 230;

  // ========================================
  // TITEL: Dojo-Name
  // ========================================
  doc.fontSize(24)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text(dojo.dojoname || 'Dojo Name', margin, currentY, { align: 'center', width: pageWidth - 2 * margin });

  currentY += 40;

  doc.fontSize(14)
     .font('Helvetica')
     .fillColor('#666666')
     .text(dojo.untertitel || 'Kampfsportschule', margin, currentY, { align: 'center', width: pageWidth - 2 * margin });

  currentY += 100;

  // ========================================
  // Mitgliedsname (Platzhalter)
  // ========================================
  doc.fontSize(10)
     .fillColor('#000000')
     .text('Name, Vorname', margin, currentY, { align: 'center', width: pageWidth - 2 * margin });

  currentY += 20;

  doc.moveTo(margin + 100, currentY)
     .lineTo(pageWidth - margin - 100, currentY)
     .stroke();

  // ========================================
  // Footer mit Kontakt
  // ========================================
  const footerY = pageHeight - 100;

  doc.fontSize(9)
     .fillColor('#000000')
     .font('Helvetica-Bold')
     .text(`${dojo.dojoname || ''}`, margin, footerY, { align: 'center', width: pageWidth - 2 * margin });

  doc.fontSize(8)
     .font('Helvetica')
     .text(`${dojo.internet || ''} | ${dojo.email || ''}`, margin, footerY + 15, { align: 'center', width: pageWidth - 2 * margin });

  // ========================================
  // SEITE 5: WILLKOMMEN
  // ========================================
  doc.addPage();
  currentY = margin + 80;

  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('Herzlich Willkommen!', margin, currentY, { align: 'center', width: pageWidth - 2 * margin });

  currentY += 50;

  const welcomeText =
    `Wir freuen uns, dich als neues Mitglied bei ${dojo.dojoname || 'uns'} begrüßen zu dürfen. ` +
    `Auf den folgenden Seiten findest du alle wichtigen Informationen über deine Mitgliedschaft.\n\n` +
    `Solltest du irgendetwas vermissen oder Hilfe brauchen, dann wende dich bitte direkt an uns ` +
    `oder einen der Trainer. Gerne auch per E-Mail oder Telefon.\n\n` +
    `Eine Ausfertigung dieser Vertragsunterlagen mit deiner Unterschrift erhältst du ausgehändigt, ` +
    `eine Ausfertigung verbleibt bei uns.\n\n` +
    `Änderungen bedürfen der Schriftform und müssen gesondert angefertigt und zum Vertrag ` +
    `hinzugefügt werden.`;

  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#000000')
     .text(welcomeText, margin, currentY, { align: 'justify', width: pageWidth - 2 * margin, lineGap: 4 });

  currentY += 220;

  // Unterschriften
  const signatureBoxWidth = (pageWidth - 2 * margin - 40) / 2;

  doc.moveTo(margin, currentY)
     .lineTo(margin + signatureBoxWidth, currentY)
     .stroke();

  doc.moveTo(pageWidth - margin - signatureBoxWidth, currentY)
     .lineTo(pageWidth - margin, currentY)
     .stroke();

  doc.fontSize(8)
     .text('Schulleitung', margin, currentY + 10, { width: signatureBoxWidth, align: 'center' })
     .text('Schulleitung', pageWidth - margin - signatureBoxWidth, currentY + 10, { width: signatureBoxWidth, align: 'center' });
};

/**
 * SEITE 6: HAFTUNGSAUSSCHLUSS
 */
const generatePage_Haftung = (doc, dojo) => {
  doc.addPage();

  const pageWidth = 595.28;
  const margin = 50;
  const tableWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // ========================================
  // TITEL
  // ========================================
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('HAFTUNGSAUSSCHLUSS', margin, currentY, { align: 'center', width: tableWidth });

  currentY += 35;

  const haftungsText = `Kampfsport sowie andere sportliche Betätigungen sind nie ohne Risiko. Es ist zu beachten, dass gerade im Sport ein erhöhtes Unfallrisiko besteht, das auch durch umsichtige Betreuung durch unser Schulungspersonal nie vollkommen reduziert oder ausgeschlossen werden kann.

Hiergegen hat sich das Mitglied selbst im eigenen Interesse abzusichern. Es wird angeraten, eine private Unfall- und Haftpflichtversicherung oder ähnliches abzuschließen.

Jedes Mitglied verzichtet auf die Geltendmachung von Schadenersatzansprüchen jeglicher Art wegen leichter Fahrlässigkeit gegen das Schulungspersonal, andere Mitglieder oder den Verein, soweit nicht durch bestehende Haftpflichtversicherungen der entsprechende Schaden abgedeckt ist.

Während der Trainingseinheiten ist Körperschmuck zu entfernen. Des Weiteren ist der Schüler verpflichtet, folgende Schutzausrüstung zu tragen:

• Kopfschutz
• Zahnschutz
• Boxhandschuhe
• Tiefschutz
• Fußschoner
• Brustschutz (für Frauen)

Die Schutzausrüstung ist auf eigene Kosten anzuschaffen. Die Haftung wegen Vorsatz oder grober Fahrlässigkeit ist hiervon nicht umfasst.

Der Betreiber übernimmt bei Verlust oder Diebstahl von mitgebrachten Gegenständen keine Haftung.`;

  doc.fontSize(9)
     .font('Helvetica')
     .text(haftungsText, margin, currentY, { align: 'justify', width: tableWidth, lineGap: 3 });

  currentY += 430;

  // Unterschrift
  doc.fontSize(8)
     .text('Ich habe den Haftungsausschluss gelesen und akzeptiere die Bedingungen.', margin, currentY, { align: 'left', width: tableWidth });

  currentY += 40;

  const signatureBoxWidth = (tableWidth - 20) / 2;

  doc.moveTo(margin, currentY)
     .lineTo(margin + signatureBoxWidth, currentY)
     .stroke();

  doc.fontSize(8)
     .text('Ort, Datum', margin, currentY + 10, { width: signatureBoxWidth, align: 'left' });

  doc.moveTo(pageWidth - margin - signatureBoxWidth, currentY)
     .lineTo(pageWidth - margin, currentY)
     .stroke();

  doc.fontSize(8)
     .text('Unterschrift des Mitglieds', pageWidth - margin - signatureBoxWidth, currentY + 10, { width: signatureBoxWidth, align: 'center' });
};

/**
 * SEITE 7: DOJO-ETIKETTE
 */
const generatePage_Etikette = (doc, dojo) => {
  doc.addPage();

  const pageWidth = 595.28;
  const margin = 50;
  const tableWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // ========================================
  // TITEL
  // ========================================
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('DOJO-ETIKETTE', margin, currentY, { align: 'center', width: tableWidth });

  currentY += 35;

  const etikette = [
    'Jeder Schüler unterliegt der Schulordnung und hat den Anweisungen des Schulungspersonals Folge zu leisten.',
    'Während des Trainings ist ein von der Schule vorgeschriebener Anzug mit dem entsprechenden Gürtel zu tragen.',
    'Während des Kampftrainings ist dementsprechende Schutzkleidung zu tragen. Ohne diese darf nicht am Kampftraining teilgenommen werden.',
    'Während des Trainings sind sämtlicher Schmuck, Ringe, Piercings, Ohrringe, Uhren und ähnliches abzulegen.',
    'Jeder Schüler hat dem Ranghöheren Gurten Respekt entgegenzubringen und dessen Anweisungen Folge zu leisten.',
    'Während des Trainings wird nur auf Anweisung geredet, getrunken oder gegessen. Kaugummi während des Trainings ist nicht erlaubt.',
    'Der Missbrauch von Techniken auch außerhalb des Unterrichts bzw. der Schule kann den Ausschluss aus der Schule zur Folge haben.',
    'Für mitgebrachte Kleidung, Wertgegenstände, Geld und sonstige Sachen wird keine Haftung übernommen.',
    'Verschuldete Sachbeschädigungen werden auf Kosten des Verursachers behoben.',
    'Unsportliches bzw. unkameradschaftliches Verhalten sowie Verstöße gegen die Regeln des Anstandes oder gegen die Schulordnung können den sofortigen Ausschluss des Schülers zur Folge haben.'
  ];

  etikette.forEach((regel, index) => {
    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = margin;
    }

    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#000000')
       .text(`${index + 1}. `, margin, currentY, { continued: true })
       .text(regel, { align: 'justify', width: tableWidth - 20 });

    currentY += 30;
  });
};

/**
 * SEITE 8: NOTFALLKONTAKTE
 */
const generatePage_Notfallkontakte = (doc, mitglied) => {
  doc.addPage();

  const pageWidth = 595.28;
  const margin = 50;
  const tableWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // ========================================
  // TITEL
  // ========================================
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('NOTFALLKONTAKTE', margin, currentY, { align: 'center', width: tableWidth });

  currentY += 35;

  doc.fontSize(9)
     .font('Helvetica')
     .text('Bitte geben Sie mindestens einen Notfallkontakt an, der im Falle eines Unfalls kontaktiert werden kann.', margin, currentY, { align: 'justify', width: tableWidth });

  currentY += 30;

  // Felder für 3 Notfallkontakte
  for (let i = 1; i <= 3; i++) {
    if (currentY > doc.page.height - 150) {
      doc.addPage();
      currentY = margin;
    }

    // Kontakt-Box
    doc.rect(margin, currentY, tableWidth, 100)
       .stroke('#CCCCCC');

    currentY += 10;

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(`Notfallkontakt ${i}`, margin + 10, currentY);

    currentY += 20;

    // Felder
    const fieldWidth = (tableWidth - 40) / 2;

    doc.fontSize(8)
       .font('Helvetica')
       .text('Name: _________________________________', margin + 10, currentY)
       .text('Beziehung: _____________________________', margin + fieldWidth + 20, currentY);

    currentY += 20;

    doc.text('Telefon: _______________________________', margin + 10, currentY)
       .text('Mobil: __________________________________', margin + fieldWidth + 20, currentY);

    currentY += 30;
  }
};

/**
 * SEITE 9: ANAMNESE
 */
const generatePage_Anamnese = (doc) => {
  doc.addPage();

  const pageWidth = 595.28;
  const margin = 50;
  const tableWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // ========================================
  // TITEL
  // ========================================
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('GESUNDHEITLICHE ANAMNESE', margin, currentY, { align: 'center', width: tableWidth });

  currentY += 35;

  doc.fontSize(8)
     .font('Helvetica')
     .text('Alle Daten unterliegen dem Datenschutz und werden vertraulich behandelt. Diese Angaben helfen uns, das Training optimal auf Sie abzustimmen.', margin, currentY, { align: 'justify', width: tableWidth });

  currentY += 25;

  // Allgemeine Fragen
  const fragen = [
    'Sind Sie zurzeit in ärztlicher Behandlung?',
    'Hatten Sie in den letzten 2 Wochen eine fiebrige Erkältung?',
    'Haben Sie chronische Beschwerden oder Erkrankungen?',
    'Nehmen Sie regelmäßig Medikamente?',
    'Haben Sie Allergien?',
    'Sind Sie körperliche Anstrengungen gewohnt?'
  ];

  fragen.forEach((frage) => {
    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = margin;
    }

    doc.fontSize(9)
       .text(frage, margin, currentY)
       .text('☐ Ja    ☐ Nein', pageWidth - margin - 100, currentY);

    currentY += 20;
  });

  currentY += 10;

  // Unterschrift
  doc.fontSize(8)
     .text('Hiermit bestätige ich die Richtigkeit und Vollständigkeit der oben gemachten Angaben.', margin, currentY, { align: 'justify', width: tableWidth });

  currentY += 30;

  doc.moveTo(margin, currentY)
     .lineTo(margin + (tableWidth / 2), currentY)
     .stroke();

  doc.fontSize(8)
     .text('Ort, Datum / Unterschrift', margin, currentY + 10);
};

/**
 * SEITE 10: DATENSCHUTZ UND EINWILLIGUNGSERKLÄRUNG
 */
const generatePage_Datenschutz = (doc, dojo) => {
  doc.addPage();

  const pageWidth = 595.28;
  const margin = 50;
  const tableWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // ========================================
  // TITEL
  // ========================================
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('DATENSCHUTZ & EINWILLIGUNGSERKLÄRUNG', margin, currentY, { align: 'center', width: tableWidth });

  currentY += 35;

  const datenschutzText = `Im Interesse der Darstellung der Schulziele und einer damit verbundenen Öffentlichkeitsarbeit werden personenbezogene Daten (Name, Fotos, Ergebnisse) verarbeitet.

Es wird darauf hingewiesen, dass ausreichende technische Maßnahmen zur Gewährleistung des Datenschutzes getroffen wurden. Dennoch kann bei einer Veröffentlichung von personenbezogenen Daten im Internet ein umfassender Datenschutz nicht garantiert werden.

Ich erkläre hiermit meine Zustimmung zu der Veröffentlichung von:

☐ Bildern und Fotos für Öffentlichkeitsarbeit
☐ Namen und Ergebnissen bei Wettkämpfen
☐ Sonstigen Dateien zum Zwecke der Öffentlichkeitswerbung

Diese Einwilligung kann jederzeit schriftlich ohne Angabe von Gründen widerrufen werden.

Die Verarbeitung Ihrer personenbezogenen Daten erfolgt ausschließlich im Rahmen der gesetzlichen Bestimmungen der DSGVO. Weitere Informationen zum Datenschutz erhalten Sie auf unserer Website oder auf Anfrage.`;

  doc.fontSize(9)
     .font('Helvetica')
     .text(datenschutzText, margin, currentY, { align: 'justify', width: tableWidth, lineGap: 3 });

  currentY += 280;

  // Unterschrift
  const signatureBoxWidth = (tableWidth - 20) / 2;

  doc.moveTo(margin, currentY)
     .lineTo(margin + signatureBoxWidth, currentY)
     .stroke();

  doc.fontSize(8)
     .text('Ort, Datum', margin, currentY + 10, { width: signatureBoxWidth, align: 'left' });

  doc.moveTo(pageWidth - margin - signatureBoxWidth, currentY)
     .lineTo(pageWidth - margin, currentY)
     .stroke();

  doc.fontSize(8)
     .text('Unterschrift', pageWidth - margin - signatureBoxWidth, currentY + 10, { width: signatureBoxWidth, align: 'center' });
};

/**
 * Generiert den vollständigen Vertrag (alle 10+ Seiten)
 */
async function generateCompleteVertragPDF(dojoId, mitglied, vertrag, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      // Lade Dojo-Daten
      const dojoResults = await queryAsync('SELECT * FROM dojo WHERE id = ?', [dojoId]);
      const dojo = dojoResults[0] || {};

      // Lade Haupt-Logo aus dojo_logos Tabelle
      let logoPath = null;
      try {
        const logoResults = await queryAsync(
          'SELECT file_path FROM dojo_logos WHERE dojo_id = ? AND logo_type = ? LIMIT 1',
          [dojoId, 'haupt']
        );
        if (logoResults && logoResults.length > 0) {
          logoPath = logoResults[0].file_path;
          logger.info(`📷 Haupt-Logo gefunden: ${logoPath}`);
        }
      } catch (logoError) {
        logger.warn('⚠️ Fehler beim Laden des Haupt-Logos:', { error: logoError.message });
      }

      logger.info(`📄 Generiere vollständiges Vertragspaket (10+ Seiten)`);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        info: {
          Title: 'Mitgliedschaftsvertrag',
          Author: dojo.dojoname || 'Dojo Software',
          Subject: 'Mitgliedschaftsvertrag'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // ========================================
      // SEITE 1: MITGLIEDSVERTRAG
      // ========================================
      generatePage1_Mitgliedsvertrag(doc, dojo, mitglied, vertrag, logoPath);

      // ========================================
      // SEITE 2: SEPA-LASTSCHRIFTMANDAT
      // ========================================
      if (vertrag.payment_method === 'sepa' || !vertrag.payment_method) {
        generatePage2_SEPA(doc, dojo, mitglied, vertrag);
      }

      // ========================================
      // SEITE 3: ZAHLUNGSTERMINE
      // ========================================
      if (!options.skipZahlungstermine) {
        generatePage3_Zahlungstermine(doc, dojo, mitglied, vertrag, options.zahlungen);
      }

      // ========================================
      // SEITE 4-5: BROSCHÜRE
      // ========================================
      if (!options.skipBroschure) {
        generatePage_Broschure(doc, dojo);
      }

      // ========================================
      // SEITE 6: HAFTUNGSAUSSCHLUSS
      // ========================================
      if (!options.skipHaftung) {
        generatePage_Haftung(doc, dojo);
      }

      // ========================================
      // SEITE 7: DOJO-ETIKETTE
      // ========================================
      if (!options.skipEtikette) {
        generatePage_Etikette(doc, dojo);
      }

      // ========================================
      // SEITE 8: NOTFALLKONTAKTE
      // ========================================
      if (!options.skipNotfallkontakte) {
        generatePage_Notfallkontakte(doc, mitglied);
      }

      // ========================================
      // SEITE 9: ANAMNESE
      // ========================================
      if (!options.skipAnamnese) {
        generatePage_Anamnese(doc);
      }

      // ========================================
      // SEITE 10: DATENSCHUTZ
      // ========================================
      if (!options.skipDatenschutz) {
        generatePage_Datenschutz(doc, dojo);
      }

      // ========================================
      // FOOTER AUF ALLEN SEITEN
      // ========================================
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);

        doc.fontSize(7)
           .font('Helvetica')
           .fillColor('#666666')
           .text(
             `Seite ${i + 1} von ${range.count}`,
             50,
             doc.page.height - 30,
             { align: 'center', width: doc.page.width - 100 }
           );

        doc.fontSize(6)
           .text(
             `${dojo.dojoname || '[Dojo]'} | ${dojo.strasse || ''} ${dojo.hausnummer || ''}, ${dojo.plz || ''} ${dojo.ort || ''}`,
             50,
             doc.page.height - 20,
             { align: 'center', width: doc.page.width - 100 }
           );
      }

      doc.end();

    } catch (error) {
      logger.error('❌ Fehler bei PDF-Generierung:', { error: error.message, stack: error.stack });
      reject(error);
    }
  });
}

// Hilfsfunktionen
function getBillingCycleLabel(cycle) {
  const labels = {
    'monatlich': 'Monatlich',
    'quarterly': 'Vierteljährlich',
    'halbjährlich': 'Halbjährlich',
    'jährlich': 'Jährlich'
  };
  return labels[cycle] || cycle || 'Monatlich';
}

function getPaymentMethodLabel(method) {
  const labels = {
    'sepa': 'SEPA-Lastschrift',
    'bar': 'Barzahlung',
    'überweisung': 'Überweisung',
    'kreditkarte': 'Kreditkarte'
  };
  return labels[method] || method || 'SEPA-Lastschrift';
}

module.exports = {
  generateCompleteVertragPDF,
  loadVertragsdokumente
};
