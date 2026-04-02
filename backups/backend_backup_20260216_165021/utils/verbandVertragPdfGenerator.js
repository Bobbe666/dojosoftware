// ============================================================================
// VERBANDSMITGLIEDSCHAFT PDF GENERATOR
// TDA International - Mitgliedsvertrag für Dojos und Einzelpersonen
// ============================================================================

const PDFDocument = require('pdfkit');
const logger = require('./logger');
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
    logger.error('PDF-Generierung fehlgeschlagen:', { error: error });
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
      logger.error('Fehler beim Einfügen der Unterschrift:', { error: e });
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
      logger.error('Fehler beim Einfügen der Unterschrift:', { error: e });
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

// ============================================================================
// RECHNUNGS-PDF-GENERATOR - TDA International Design
// ============================================================================

// Hilfsfunktion: Config aus Key-Value Store laden
const loadVerbandConfig = async () => {
  const rows = await queryAsync('SELECT einstellung_key, einstellung_value FROM verband_einstellungen');
  const config = {};
  rows.forEach(row => {
    config[row.einstellung_key] = row.einstellung_value;
  });
  return config;
};

const generateVerbandRechnungPdf = async (zahlungsId, res, typ = 'beitrag') => {
  try {
    let zahlung;

    if (typ === 'beitrag') {
      // Beitragsrechnung aus verbandsmitgliedschaft_zahlungen
      [zahlung] = await queryAsync(`
        SELECT z.*, vm.typ as mitglied_typ, vm.id as mitglied_id, vm.mitgliedsnummer,
               vm.dojo_name, vm.person_vorname, vm.person_nachname,
               vm.dojo_strasse, vm.dojo_plz, vm.dojo_ort, vm.dojo_land,
               vm.person_strasse, vm.person_plz, vm.person_ort, vm.person_land
        FROM verbandsmitgliedschaft_zahlungen z
        JOIN verbandsmitgliedschaften vm ON z.verbandsmitgliedschaft_id = vm.id
        WHERE z.id = ?
      `, [zahlungsId]);
    } else {
      // Sonstige Rechnung aus verband_rechnungen
      [zahlung] = await queryAsync(`
        SELECT r.*, vm.typ as mitglied_typ, vm.id as mitglied_id, vm.mitgliedsnummer,
               vm.dojo_name, vm.person_vorname, vm.person_nachname,
               vm.dojo_strasse, vm.dojo_plz, vm.dojo_ort, vm.dojo_land,
               vm.person_strasse, vm.person_plz, vm.person_ort, vm.person_land,
               r.empfaenger_name, r.empfaenger_adresse
        FROM verband_rechnungen r
        LEFT JOIN verbandsmitgliedschaften vm ON r.empfaenger_id = vm.id AND r.empfaenger_typ = 'verbandsmitglied'
        WHERE r.id = ?
      `, [zahlungsId]);
    }

    if (!zahlung) {
      throw new Error('Rechnung nicht gefunden');
    }

    // Verband-Einstellungen laden (Key-Value Store)
    const config = await loadVerbandConfig();

    // Verband-Daten
    const verbandName = config.verband_name || 'Tiger & Dragon Association International';
    const verbandKurzname = config.verband_kurzname || 'TDA Int\'l';
    const verbandStrasse = config.verband_strasse || 'Ohmstr. 14';
    const verbandPlz = config.verband_plz || '84137';
    const verbandOrt = config.verband_ort || 'Vilsbiburg';
    const verbandEmail = config.verband_email || 'info@tda-intl.com';
    const verbandTelefon = config.verband_telefon || '';
    const verbandWebsite = config.verband_website || 'www.tda-intl.com';
    const verbandSteuernummer = config.verband_steuernummer || '';
    const verbandUstId = config.verband_ustid || '';

    // Bank-Daten
    const bankName = config.sepa_bankname || 'Fyrst Bank';
    const iban = config.sepa_iban || '';
    const bic = config.sepa_bic || '';
    const kontoinhaber = config.sepa_kontoinhaber || verbandName;

    // Empfänger-Daten
    let empfaengerName = '';
    let empfaengerStrasse = '';
    let empfaengerOrt = '';

    if (zahlung.mitglied_typ === 'dojo') {
      empfaengerName = zahlung.dojo_name || zahlung.empfaenger_name || '';
      empfaengerStrasse = zahlung.dojo_strasse || '';
      empfaengerOrt = `${zahlung.dojo_plz || ''} ${zahlung.dojo_ort || ''}`.trim();
    } else {
      empfaengerName = `${zahlung.person_vorname || ''} ${zahlung.person_nachname || ''}`.trim() || zahlung.empfaenger_name || '';
      empfaengerStrasse = zahlung.person_strasse || '';
      empfaengerOrt = `${zahlung.person_plz || ''} ${zahlung.person_ort || ''}`.trim();
    }

    // Mitgliedsnummer
    const mitgliedsnummer = zahlung.mitgliedsnummer ||
      (zahlung.mitglied_typ === 'dojo' ? `TDA-D-${String(zahlung.mitglied_id).padStart(5, '0')}` : `TDA-E-${String(zahlung.mitglied_id).padStart(5, '0')}`);

    // Leistungsbeschreibung
    const leistung = zahlung.mitglied_typ === 'dojo'
      ? 'TDA Verbandsmitgliedschaft - Dojo'
      : 'TDA Verbandsmitgliedschaft - Einzelperson';

    // Beträge
    const nettoPreis = Number(typ === 'beitrag' ? zahlung.betrag_netto : zahlung.summe_netto) || 0;
    const mwstSatz = Number(zahlung.mwst_satz) || 19;
    const mwstBetrag = Number(typ === 'beitrag' ? zahlung.mwst_betrag : zahlung.summe_mwst) || (nettoPreis * mwstSatz / 100);
    const bruttoBetrag = Number(typ === 'beitrag' ? zahlung.betrag_brutto : zahlung.summe_brutto) || (nettoPreis + mwstBetrag);

    // PDF erstellen
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: {
        Title: `Rechnung ${zahlung.rechnungsnummer}`,
        Author: verbandName,
        Subject: 'Rechnung',
        Creator: 'TDA International'
      }
    });

    // Response-Header setzen
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Rechnung-${zahlung.rechnungsnummer}.pdf"`);
    doc.pipe(res);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const leftMargin = 50;
    const rightMargin = 545;

    // === ABSENDERZEILE (klein, oben) ===
    doc.fontSize(7).fillColor('#666');
    const absenderzeile = [verbandName, verbandStrasse, `${verbandPlz} ${verbandOrt}`].filter(Boolean).join(' | ');
    doc.text(absenderzeile, leftMargin, 45, { width: 300 });
    doc.moveTo(leftMargin, 58).lineTo(leftMargin + 300, 58).strokeColor('#000').lineWidth(0.5).stroke();

    // === LOGO (rechts oben) ===
    const logoPath = path.join(__dirname, '../assets/tda-logo.png');
    const logoPathAlt = '/var/www/tda-intl/tda-logo.png';
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 480, 40, { width: 60 });
    } else if (fs.existsSync(logoPathAlt)) {
      doc.image(logoPathAlt, 480, 40, { width: 60 });
    } else {
      // Platzhalter-Logo
      doc.circle(510, 70, 25).lineWidth(2).strokeColor('#000').stroke();
      doc.fontSize(10).fillColor('#000').text('TDA', 497, 65);
    }

    // === EMPFÄNGERADRESSE ===
    doc.fontSize(10).fillColor('#000');
    let addrY = 70;
    doc.text(empfaengerName, leftMargin, addrY);
    if (empfaengerStrasse) doc.text(empfaengerStrasse, leftMargin, addrY + 14);
    if (empfaengerOrt) doc.text(empfaengerOrt, leftMargin, addrY + 28);

    // === RECHNUNGSDETAILS (rechts) ===
    doc.fontSize(8).fillColor('#000');
    let metaY = 105;
    doc.text(`Rechnungs-Nr.: ${zahlung.rechnungsnummer || ''}`, 380, metaY);
    doc.text(`Mitgliedsnummer: ${mitgliedsnummer}`, 380, metaY + 12);
    doc.text(`Belegdatum: ${formatDate(zahlung.rechnungsdatum)}`, 380, metaY + 24);
    if (typ === 'beitrag' && zahlung.zeitraum_von && zahlung.zeitraum_bis) {
      doc.text(`Leistungszeitraum: ${formatDate(zahlung.zeitraum_von)} - ${formatDate(zahlung.zeitraum_bis)}`, 380, metaY + 36);
    }

    // === TITEL ===
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000');
    doc.text('RECHNUNG', leftMargin, 165);
    doc.fontSize(8).font('Helvetica').fillColor('#666');
    doc.text('Seite 1 von 1', rightMargin - 60, 168);
    doc.moveTo(leftMargin, 185).lineTo(rightMargin, 185).strokeColor('#000').lineWidth(1.5).stroke();

    // === POSITIONSTABELLE ===
    let tableY = 200;

    // Tabellenkopf
    doc.rect(leftMargin, tableY, rightMargin - leftMargin, 18).fill('#f3f4f6');
    doc.moveTo(leftMargin, tableY).lineTo(rightMargin, tableY).strokeColor('#000').lineWidth(0.5).stroke();
    doc.moveTo(leftMargin, tableY + 18).lineTo(rightMargin, tableY + 18).stroke();

    doc.font('Helvetica-Bold').fontSize(7).fillColor('#000');
    doc.text('Pos.', leftMargin + 5, tableY + 5);
    doc.text('Bezeichnung', leftMargin + 35, tableY + 5);
    doc.text('Art.-Nr.', 200, tableY + 5);
    doc.text('Menge', 260, tableY + 5);
    doc.text('Einheit', 300, tableY + 5);
    doc.text('Preis', 350, tableY + 5);
    doc.text('USt %', 410, tableY + 5);
    doc.text('Betrag EUR', 470, tableY + 5, { width: 70, align: 'right' });

    // Tabelleninhalt
    tableY += 22;
    doc.font('Helvetica').fontSize(8);

    if (typ === 'beitrag') {
      // Beitragsrechnung - eine Position
      const zeitraum = zahlung.zeitraum_von && zahlung.zeitraum_bis
        ? `Zeitraum: ${formatDate(zahlung.zeitraum_von)} - ${formatDate(zahlung.zeitraum_bis)}`
        : '';

      doc.text('1', leftMargin + 5, tableY);
      doc.text(leistung, leftMargin + 35, tableY, { width: 155 });
      if (zeitraum) {
        doc.fontSize(6).fillColor('#666').text(zeitraum, leftMargin + 35, tableY + 10);
        doc.fontSize(8).fillColor('#000');
      }
      doc.text(zahlung.mitglied_typ === 'dojo' ? 'TDA-VM-DOJO' : 'TDA-VM-EINZEL', 200, tableY);
      doc.text('1', 260, tableY);
      doc.text('Jahr', 300, tableY);
      doc.text(formatCurrency(nettoPreis), 350, tableY);
      doc.text(`${mwstSatz.toFixed(0)}%`, 410, tableY);
      doc.text(formatCurrency(nettoPreis), 470, tableY, { width: 70, align: 'right' });
      tableY += 30;
    } else {
      // Sonstige Rechnung - Positionen laden
      const positionen = await queryAsync(
        'SELECT * FROM verband_rechnungspositionen WHERE rechnung_id = ?',
        [zahlungsId]
      );

      if (positionen.length > 0) {
        let posNr = 1;
        for (const pos of positionen) {
          doc.text(String(posNr), leftMargin + 5, tableY);
          doc.text(pos.beschreibung || pos.artikel_name || 'Position', leftMargin + 35, tableY, { width: 155 });
          doc.text(pos.artikelnummer || '-', 200, tableY);
          doc.text(String(pos.menge || 1), 260, tableY);
          doc.text(pos.einheit || 'Stk', 300, tableY);
          doc.text(formatCurrency(pos.einzelpreis || 0), 350, tableY);
          doc.text(`${(pos.mwst_satz || mwstSatz).toFixed(0)}%`, 410, tableY);
          doc.text(formatCurrency(pos.gesamt_netto || pos.einzelpreis * (pos.menge || 1)), 470, tableY, { width: 70, align: 'right' });
          tableY += 18;
          posNr++;
        }
      } else {
        doc.text('1', leftMargin + 5, tableY);
        doc.text('Gemäß Bestellung', leftMargin + 35, tableY);
        doc.text('-', 200, tableY);
        doc.text('1', 260, tableY);
        doc.text('Stk', 300, tableY);
        doc.text(formatCurrency(nettoPreis), 350, tableY);
        doc.text(`${mwstSatz.toFixed(0)}%`, 410, tableY);
        doc.text(formatCurrency(nettoPreis), 470, tableY, { width: 70, align: 'right' });
        tableY += 18;
      }
    }

    // Trennlinie unter Positionen
    doc.moveTo(leftMargin, tableY).lineTo(rightMargin, tableY).strokeColor('#e5e7eb').lineWidth(0.5).stroke();

    // === SUMMENBEREICH (rechts) ===
    let sumY = tableY + 15;
    const sumLeft = 350;
    const sumRight = rightMargin;

    doc.font('Helvetica').fontSize(8).fillColor('#000');

    // Zwischensumme
    doc.text('Zwischensumme:', sumLeft, sumY);
    doc.text(formatCurrency(nettoPreis), sumRight - 75, sumY, { width: 70, align: 'right' });
    sumY += 14;

    // Summe Netto
    doc.text('Summe:', sumLeft, sumY);
    doc.text(formatCurrency(nettoPreis), sumRight - 75, sumY, { width: 70, align: 'right' });
    sumY += 14;

    // MwSt
    doc.text(`${mwstSatz.toFixed(0)}% USt. auf EUR ${formatCurrency(nettoPreis)}:`, sumLeft, sumY);
    doc.text(formatCurrency(mwstBetrag), sumRight - 75, sumY, { width: 70, align: 'right' });
    sumY += 5;

    // Endbetrag (fett, mit Rahmen)
    sumY += 8;
    doc.moveTo(sumLeft, sumY).lineTo(sumRight, sumY).strokeColor('#000').lineWidth(1.5).stroke();
    sumY += 5;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Endbetrag:', sumLeft, sumY);
    doc.text(formatCurrency(bruttoBetrag), sumRight - 75, sumY, { width: 70, align: 'right' });
    sumY += 12;
    doc.moveTo(sumLeft, sumY).lineTo(sumRight, sumY).strokeColor('#000').lineWidth(1.5).stroke();

    // === ZAHLUNGSBEDINGUNGEN ===
    let payY = sumY + 30;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
    doc.text('Bitte beachten Sie unsere Zahlungsbedingung:', leftMargin, payY);
    payY += 14;
    doc.font('Helvetica').fontSize(9);
    doc.text(`Ohne Abzug bis zum ${formatDate(zahlung.faellig_am)}.`, leftMargin, payY);

    // Bankverbindung
    if (iban) {
      payY += 20;
      doc.font('Helvetica-Bold').text('Bankverbindung:', leftMargin, payY);
      payY += 14;
      doc.font('Helvetica');
      doc.text(`Empfänger: ${kontoinhaber}`, leftMargin, payY);
      payY += 12;
      if (bankName) {
        doc.text(`Bank: ${bankName}`, leftMargin, payY);
        payY += 12;
      }
      doc.text(`IBAN: ${iban}`, leftMargin, payY);
      payY += 12;
      if (bic) {
        doc.text(`BIC: ${bic}`, leftMargin, payY);
        payY += 12;
      }
      doc.text(`Verwendungszweck: ${zahlung.rechnungsnummer}`, leftMargin, payY);
    }

    // === FOOTER ===
    const footerY = pageHeight - 60;
    doc.moveTo(leftMargin, footerY).lineTo(rightMargin, footerY).strokeColor('#ccc').lineWidth(0.5).stroke();

    doc.font('Helvetica').fontSize(7).fillColor('#666');
    const footerLine1 = [verbandName, verbandStrasse, `${verbandPlz} ${verbandOrt}`, verbandEmail, verbandTelefon].filter(Boolean).join(' | ');
    doc.text(footerLine1, leftMargin, footerY + 8, { align: 'center', width: rightMargin - leftMargin });

    if (iban) {
      const footerLine2 = [bankName, kontoinhaber, iban, bic].filter(Boolean).join(' | ');
      doc.text(footerLine2, leftMargin, footerY + 20, { align: 'center', width: rightMargin - leftMargin });
    }

    if (verbandWebsite) {
      doc.text(`Web: ${verbandWebsite}`, leftMargin, footerY + 32, { align: 'center', width: rightMargin - leftMargin });
    }

    doc.end();

  } catch (error) {
    logger.error('Rechnungs-PDF-Generierung fehlgeschlagen:', { error: error.message, stack: error.stack, zahlungsId, typ });
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF konnte nicht erstellt werden' });
    }
  }
};

module.exports = {
  generateVerbandVertragPdf,
  generateVerbandRechnungPdf
};
