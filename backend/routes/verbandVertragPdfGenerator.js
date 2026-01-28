// ============================================================================
// VERBANDSMITGLIEDSCHAFT PDF GENERATOR
// TDA International - Mitgliedsvertrag für Dojos und Einzelpersonen
// ============================================================================

const PDFDocument = require('pdfkit');
const db = require('../db');
const fs = require('fs');
const path = require('path');

// Promise-Wrapper für DB-Queries
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Formatierung
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('de-DE');
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
};

// HTML zu Plain Text konvertieren (für AGB etc.)
const htmlToPlainText = (html) => {
  if (!html) return '';
  return html
    .replace(/<h[1-6][^>]*>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<table[^>]*>/gi, '\n')
    .replace(/<\/table>/gi, '\n')
    .replace(/<tr[^>]*>/gi, '\n')
    .replace(/<\/tr>/gi, '')
    .replace(/<th[^>]*>/gi, ' | ')
    .replace(/<\/th>/gi, '')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<\/td>/gi, '')
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// ============================================================================
// HAUPT-PDF-GENERATOR
// ============================================================================

const generateVerbandVertragPdf = async (mitgliedschaftId, res) => {
  try {
    // Mitgliedschaft laden
    const [mitgliedschaft] = await queryAsync(`
      SELECT vm.*, d.dojoname, d.ort as dojo_ort, d.strasse as dojo_strasse,
             d.hausnummer as dojo_hausnummer, d.plz as dojo_plz, d.email as dojo_email
      FROM verbandsmitgliedschaften vm
      LEFT JOIN dojo d ON vm.dojo_id = d.id
      WHERE vm.id = ?
    `, [mitgliedschaftId]);

    if (!mitgliedschaft) {
      throw new Error('Mitgliedschaft nicht gefunden');
    }

    // SEPA-Mandat laden falls vorhanden
    const [sepaMandat] = await queryAsync(`
      SELECT * FROM verband_sepa_mandate
      WHERE verbandsmitgliedschaft_id = ? AND status = 'aktiv'
      ORDER BY created_at DESC LIMIT 1
    `, [mitgliedschaftId]);

    // Dokumente laden
    const dokumente = await queryAsync(`
      SELECT * FROM verband_dokumente
      WHERE aktiv = 1 ORDER BY typ, version DESC
    `);

    // PDF erstellen
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `TDA Mitgliedsvertrag - ${mitgliedschaft.mitgliedsnummer}`,
        Author: 'Tiger & Dragon Association International',
        Subject: 'Verbandsmitgliedsvertrag',
        Keywords: 'TDA, Mitgliedschaft, Vertrag'
      }
    });

    // Response Headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="TDA-Vertrag-${mitgliedschaft.mitgliedsnummer}.pdf"`);
    doc.pipe(res);

    // ========================================
    // SEITE 1: MITGLIEDSVERTRAG
    // ========================================
    generatePage1(doc, mitgliedschaft);

    // ========================================
    // SEITE 2: SEPA-LASTSCHRIFTMANDAT
    // ========================================
    if (sepaMandat || mitgliedschaft.zahlungsart === 'lastschrift') {
      doc.addPage();
      generatePage2_Sepa(doc, mitgliedschaft, sepaMandat);
    }

    // ========================================
    // SEITE 3+: AGB, DSGVO, Widerrufsbelehrung
    // ========================================
    const agb = dokumente.find(d => d.typ === 'agb');
    if (agb) {
      doc.addPage();
      generateDokumentSeite(doc, agb);
    }

    const dsgvo = dokumente.find(d => d.typ === 'dsgvo');
    if (dsgvo) {
      doc.addPage();
      generateDokumentSeite(doc, dsgvo);
    }

    const widerruf = dokumente.find(d => d.typ === 'widerrufsbelehrung');
    if (widerruf) {
      doc.addPage();
      generateDokumentSeite(doc, widerruf);
    }

    const beitragsordnung = dokumente.find(d => d.typ === 'beitragsordnung');
    if (beitragsordnung) {
      doc.addPage();
      generateDokumentSeite(doc, beitragsordnung);
    }

    // ========================================
    // LETZTE SEITE: UNTERSCHRIFTEN
    // ========================================
    doc.addPage();
    generateUnterschriftSeite(doc, mitgliedschaft);

    doc.end();

  } catch (error) {
    console.error('PDF-Generierung fehlgeschlagen:', error);
    throw error;
  }
};

// ============================================================================
// SEITE 1: MITGLIEDSVERTRAG
// ============================================================================

const generatePage1 = (doc, m) => {
  const pageWidth = 595.28;
  const margin = 50;
  let y = margin;

  // Logo
  const logoPath = path.join(__dirname, '../assets/tda-logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, pageWidth - margin - 100, y, { width: 100 });
  }

  // Header
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#000')
     .text('Tiger & Dragon Association', margin, y);

  doc.fontSize(10)
     .font('Helvetica')
     .text('International', margin, y + 20);

  y += 60;

  // Titel
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .text('MITGLIEDSVERTRAG', margin, y, { align: 'center', width: pageWidth - 2 * margin });

  y += 40;

  // Vertragsinfo Box
  doc.rect(margin, y, pageWidth - 2 * margin, 40)
     .fillAndStroke('#f0f0f0', '#ccc');

  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor('#000')
     .text(`Mitgliedsnummer: ${m.mitgliedsnummer}`, margin + 10, y + 8);

  doc.text(`Mitgliedschaftstyp: ${m.typ === 'dojo' ? 'Dojo-Mitgliedschaft' : 'Einzelmitgliedschaft'}`,
           margin + 10, y + 22);

  doc.text(`Vertragsdatum: ${formatDate(m.created_at)}`, pageWidth - margin - 150, y + 8);
  doc.text(`Jahresbeitrag: ${formatCurrency(m.jahresbeitrag)}`, pageWidth - margin - 150, y + 22);

  y += 55;

  // Mitgliedsdaten
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .text(m.typ === 'dojo' ? '1. Dojo-Daten' : '1. Personendaten', margin, y);

  y += 20;

  if (m.typ === 'dojo') {
    drawField(doc, margin, y, 'Dojo-Name:', m.dojoname || '-');
    y += 25;
    drawField(doc, margin, y, 'Anschrift:', `${m.dojo_strasse || ''} ${m.dojo_hausnummer || ''}, ${m.dojo_plz || ''} ${m.dojo_ort || ''}`);
    y += 25;
    drawField(doc, margin, y, 'E-Mail:', m.dojo_email || '-');
  } else {
    drawField(doc, margin, y, 'Name:', `${m.person_vorname || ''} ${m.person_nachname || ''}`);
    y += 25;
    drawField(doc, margin, y, 'Anschrift:', `${m.person_strasse || ''}, ${m.person_plz || ''} ${m.person_ort || ''}`);
    y += 25;
    drawField(doc, margin, y, 'E-Mail:', m.person_email || '-');
    y += 25;
    drawField(doc, margin, y, 'Telefon:', m.person_telefon || '-');
    y += 25;
    drawField(doc, margin, y, 'Geburtsdatum:', formatDate(m.person_geburtsdatum));
  }

  y += 35;

  // Vertragsdaten
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .text('2. Vertragsdaten', margin, y);

  y += 20;

  drawField(doc, margin, y, 'Vertragsbeginn:', formatDate(m.gueltig_von));
  y += 25;
  drawField(doc, margin, y, 'Vertragsende:', formatDate(m.gueltig_bis));
  y += 25;
  drawField(doc, margin, y, 'Jahresbeitrag:', formatCurrency(m.jahresbeitrag));
  y += 25;
  drawField(doc, margin, y, 'Zahlungsart:', getZahlungsartText(m.zahlungsart));

  y += 35;

  // Leistungen
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .text('3. Leistungen der Mitgliedschaft', margin, y);

  y += 20;

  doc.fontSize(9)
     .font('Helvetica');

  const leistungen = m.typ === 'dojo' ? [
    '• 20% Rabatt auf Turnier-Startgebühren für alle Dojo-Mitglieder',
    '• 15% Rabatt auf TDA-Seminargebühren',
    '• 10% Rabatt auf Prüfungsgebühren',
    '• 10% Rabatt im TDA-Shop',
    '• Berechtigung zur Führung des TDA-Logos',
    '• Listung auf der TDA-Website als Mitgliedsdojo'
  ] : [
    '• 15% Rabatt auf Turnier-Startgebühren',
    '• 10% Rabatt auf TDA-Seminargebühren',
    '• 10% Rabatt im TDA-Shop',
    '• TDA-Mitgliedsausweis',
    '• Einladungen zu exklusiven TDA-Events'
  ];

  leistungen.forEach(l => {
    doc.text(l, margin + 10, y);
    y += 14;
  });

  y += 20;

  // Hinweise
  doc.fontSize(8)
     .fillColor('#666')
     .text('Die Mitgliedschaft verlängert sich automatisch um ein Jahr, wenn sie nicht mit einer Frist von 3 Monaten zum Vertragsende schriftlich gekündigt wird.',
           margin, y, { width: pageWidth - 2 * margin });

  // Footer
  doc.fontSize(8)
     .fillColor('#999')
     .text(`Seite 1 | Erstellt am ${formatDate(new Date())}`, margin, 780, { align: 'center', width: pageWidth - 2 * margin });
};

// ============================================================================
// SEITE 2: SEPA-LASTSCHRIFTMANDAT
// ============================================================================

const generatePage2_Sepa = (doc, m, sepa) => {
  const pageWidth = 595.28;
  const margin = 50;
  let y = margin;

  // Titel
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#000')
     .text('SEPA-Lastschriftmandat', margin, y, { align: 'center', width: pageWidth - 2 * margin });

  y += 40;

  // Info-Box
  doc.rect(margin, y, pageWidth - 2 * margin, 60)
     .fillAndStroke('#f5f5f5', '#ddd');

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#000')
     .text('Gläubiger-Identifikationsnummer: DE98ZZZ00002344567', margin + 10, y + 10);

  doc.text(`Mandatsreferenz: ${sepa?.mandatsreferenz || m.mitgliedsnummer + '-SEPA'}`, margin + 10, y + 24);
  doc.text('Zahlungsart: Wiederkehrende Zahlung (RCUR)', margin + 10, y + 38);

  y += 75;

  // Ermächtigung
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .text('Ich/Wir ermächtige(n):', margin, y);

  y += 20;

  doc.fontSize(9)
     .font('Helvetica')
     .text('Tiger & Dragon Association International', margin, y);

  y += 15;

  doc.text('Zahlungen von meinem/unserem Konto mittels Lastschrift einzuziehen. Zugleich weise ich/weisen wir mein/unser Kreditinstitut an, die von der TDA International auf mein/unser Konto gezogenen Lastschriften einzulösen.',
           margin, y, { width: pageWidth - 2 * margin });

  y += 50;

  doc.text('Hinweis: Ich kann/Wir können innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem/unserem Kreditinstitut vereinbarten Bedingungen.',
           margin, y, { width: pageWidth - 2 * margin, oblique: true });

  y += 45;

  // Kontodaten
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .text('Kontodaten des Zahlungspflichtigen', margin, y);

  y += 25;

  drawField(doc, margin, y, 'Kontoinhaber:', sepa?.kontoinhaber || (m.typ === 'dojo' ? m.dojoname : `${m.person_vorname} ${m.person_nachname}`));
  y += 30;

  drawField(doc, margin, y, 'IBAN:', sepa?.iban || m.sepa_iban || '________________________________');
  y += 30;

  drawField(doc, margin, y, 'BIC:', sepa?.bic || m.sepa_bic || '________________________________');
  y += 30;

  drawField(doc, margin, y, 'Kreditinstitut:', '________________________________');

  y += 50;

  // Unterschrift
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .text('Unterschrift / Digitale Signatur', margin, y);

  y += 25;

  // Unterschriftsfeld
  doc.rect(margin, y, 250, 60)
     .stroke('#ccc');

  // Digitale Unterschrift einfügen falls vorhanden
  if (sepa?.unterschrift_digital) {
    try {
      const signatureBuffer = Buffer.from(sepa.unterschrift_digital.split(',')[1], 'base64');
      doc.image(signatureBuffer, margin + 5, y + 5, { width: 240, height: 50 });
    } catch (e) {
      console.error('Fehler beim Einfügen der Unterschrift:', e);
    }
  }

  doc.fontSize(8)
     .font('Helvetica')
     .fillColor('#666')
     .text('Ort, Datum', margin, y + 70);

  doc.text('Unterschrift', margin + 270, y + 70);

  y += 100;

  // Hinweis
  doc.fontSize(8)
     .fillColor('#666')
     .text(`Mandatsdatum: ${formatDate(sepa?.unterschriftsdatum || m.created_at)}`, margin, y);

  if (sepa?.unterschrift_ip) {
    doc.text(`IP-Adresse: ${sepa.unterschrift_ip}`, margin, y + 12);
  }

  // Footer
  doc.fontSize(8)
     .fillColor('#999')
     .text(`Seite 2 | SEPA-Lastschriftmandat`, margin, 780, { align: 'center', width: pageWidth - 2 * margin });
};

// ============================================================================
// DOKUMENT-SEITE (AGB, DSGVO, etc.)
// ============================================================================

const generateDokumentSeite = (doc, dokument) => {
  const pageWidth = 595.28;
  const margin = 50;
  let y = margin;

  // Titel
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('#000')
     .text(dokument.titel, margin, y, { align: 'center', width: pageWidth - 2 * margin });

  y += 30;

  // Version
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor('#666')
     .text(`Version: ${dokument.version} | Gültig ab: ${formatDate(dokument.gueltig_ab)}`, margin, y);

  y += 20;

  // Inhalt
  const plainText = htmlToPlainText(dokument.inhalt);

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#000')
     .text(plainText, margin, y, {
       width: pageWidth - 2 * margin,
       align: 'justify',
       lineGap: 2
     });

  // Footer
  doc.fontSize(8)
     .fillColor('#999')
     .text(`${dokument.titel} | Version ${dokument.version}`, margin, 780, { align: 'center', width: pageWidth - 2 * margin });
};

// ============================================================================
// UNTERSCHRIFT-SEITE
// ============================================================================

const generateUnterschriftSeite = (doc, m) => {
  const pageWidth = 595.28;
  const margin = 50;
  let y = margin;

  // Titel
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('#000')
     .text('Vertragsabschluss & Einwilligungen', margin, y, { align: 'center', width: pageWidth - 2 * margin });

  y += 40;

  // Einwilligungen
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .text('Hiermit bestätige ich:', margin, y);

  y += 25;

  const checks = [
    ['agb_akzeptiert', 'Ich habe die Allgemeinen Geschäftsbedingungen (AGB) gelesen und akzeptiere diese.'],
    ['dsgvo_akzeptiert', 'Ich habe die Datenschutzerklärung gelesen und stimme der Verarbeitung meiner Daten zu.'],
    ['widerrufsrecht_akzeptiert', 'Ich wurde über mein Widerrufsrecht belehrt und habe die Widerrufsbelehrung erhalten.']
  ];

  doc.fontSize(9)
     .font('Helvetica');

  checks.forEach(([field, text]) => {
    const checked = m[field] ? '☑' : '☐';
    doc.text(`${checked} ${text}`, margin + 10, y, { width: pageWidth - 2 * margin - 20 });
    y += 30;
  });

  y += 20;

  // Zusammenfassung
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .text('Vertragszusammenfassung:', margin, y);

  y += 20;

  doc.fontSize(9)
     .font('Helvetica');

  const summary = [
    `Mitgliedsnummer: ${m.mitgliedsnummer}`,
    `Mitgliedschaftstyp: ${m.typ === 'dojo' ? 'Dojo-Mitgliedschaft' : 'Einzelmitgliedschaft'}`,
    `Jahresbeitrag: ${formatCurrency(m.jahresbeitrag)}`,
    `Laufzeit: ${formatDate(m.gueltig_von)} bis ${formatDate(m.gueltig_bis)}`,
    `Zahlungsart: ${getZahlungsartText(m.zahlungsart)}`
  ];

  summary.forEach(s => {
    doc.text(s, margin + 10, y);
    y += 16;
  });

  y += 40;

  // Unterschriftsbereich
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .text('Unterschrift des Mitglieds:', margin, y);

  y += 20;

  // Unterschriftsfeld
  doc.rect(margin, y, 250, 80)
     .stroke('#ccc');

  // Digitale Unterschrift einfügen falls vorhanden
  if (m.unterschrift_digital) {
    try {
      const signatureBuffer = Buffer.from(m.unterschrift_digital.split(',')[1], 'base64');
      doc.image(signatureBuffer, margin + 5, y + 5, { width: 240, height: 70 });
    } catch (e) {
      console.error('Fehler beim Einfügen der Unterschrift:', e);
    }
  }

  doc.fontSize(8)
     .font('Helvetica')
     .fillColor('#666');

  doc.text('_______________________________', margin, y + 90);
  doc.text('Ort, Datum', margin, y + 102);

  doc.text('_______________________________', margin + 270, y + 90);
  doc.text('Unterschrift', margin + 270, y + 102);

  y += 130;

  // Metadaten bei digitaler Unterschrift
  if (m.unterschrift_digital) {
    doc.fontSize(7)
       .fillColor('#999')
       .text(`Digital unterzeichnet am: ${formatDate(m.vertrag_unterschrieben_am)}`, margin, y);

    if (m.unterschrift_ip) {
      doc.text(`IP-Adresse: ${m.unterschrift_ip}`, margin, y + 10);
    }

    if (m.unterschrift_hash) {
      doc.text(`Signatur-Hash: ${m.unterschrift_hash.substring(0, 32)}...`, margin, y + 20);
    }
  }

  // Footer
  doc.fontSize(8)
     .fillColor('#999')
     .text('Tiger & Dragon Association International | www.tda-intl.org', margin, 780, { align: 'center', width: pageWidth - 2 * margin });
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const drawField = (doc, x, y, label, value) => {
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor('#333')
     .text(label, x, y, { continued: true, width: 120 });

  doc.font('Helvetica')
     .fillColor('#000')
     .text(` ${value || '-'}`, { width: 350 });
};

const getZahlungsartText = (zahlungsart) => {
  const arten = {
    'rechnung': 'Rechnung',
    'lastschrift': 'SEPA-Lastschrift',
    'paypal': 'PayPal',
    'ueberweisung': 'Überweisung'
  };
  return arten[zahlungsart] || zahlungsart;
};

module.exports = {
  generateVerbandVertragPdf
};
