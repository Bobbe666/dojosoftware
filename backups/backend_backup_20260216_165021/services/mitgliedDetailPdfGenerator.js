/**
 * Vollständiger PDF-Generator für Mitgliedsdatenblätter
 * Erfasst ALLE Felder aus allen 12 Tabs von MitgliedDetailShared.jsx
 * Zeigt "n/a" für fehlende Daten
 */

const PDFDocument = require('pdfkit');
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

const queryAsync = promisify(db.query).bind(db);

// === HILFSFUNKTIONEN ===

const formatDate = (dateInput) => {
  if (!dateInput) return 'n/a';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'n/a';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatCurrency = (cents) => {
  if (cents === null || cents === undefined) return 'n/a';
  const euros = cents / 100;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(euros);
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'n/a';
  return String(value);
};

const drawSectionHeader = (doc, x, y, width, title, context = null) => {
  // Automatischer Page Break wenn nötig
  if (context && checkPageSpace(doc, y, 30)) {
    y = addNewPage(doc, context.mitglied, context.logoPath);
  }

  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text(title, x, y);

  doc.moveTo(x, y + 14)
     .lineTo(x + width, y + 14)
     .strokeColor('#CCCCCC')
     .lineWidth(1)
     .stroke();

  return y + 22;
};

const drawField = (doc, x, y, label, value, context = null) => {
  // Automatischer Page Break wenn nötig
  if (context && checkPageSpace(doc, y, 20)) {
    y = addNewPage(doc, context.mitglied, context.logoPath);
  }

  doc.fontSize(8).fillColor('#666666').font('Helvetica')
     .text(label, x, y);
  doc.fontSize(8).fillColor('#000000').font('Helvetica')
     .text(formatValue(value), x + 120, y, { width: 350 });
  return y + 14;
};

const checkPageSpace = (doc, currentY, requiredSpace) => {
  const pageHeight = 841.89;
  const bottomMargin = 70;
  return (currentY + requiredSpace) > (pageHeight - bottomMargin);
};

const addNewPage = (doc, mitglied, logoPath) => {
  doc.addPage();
  addPageHeaderFooter(doc, mitglied, logoPath);
  return 50 + 40; // margin + header height
};

const addPageHeaderFooter = (doc, mitglied, logoPath = null) => {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;

  if (logoPath && fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, margin, margin - 10, { width: 50 });
    } catch (error) {
      logger.warn('⚠️ Fehler beim Laden des Logos:', error.message);
    }
  }

  doc.fontSize(13)
     .font('Helvetica-Bold')
     .fillColor('#000000')
     .text('MITGLIEDSDATENBLATT', margin + 60, margin);

  doc.fontSize(8)
     .font('Helvetica')
     .fillColor('#666666')
     .text(`${mitglied.vorname || ''} ${mitglied.nachname || ''} (ID: ${mitglied.mitglied_id || 'n/a'})`, margin + 60, margin + 16);

  const footerY = pageHeight - margin + 10;
  doc.fontSize(7)
     .fillColor('#999999')
     .text(`Erstellt am: ${formatDate(new Date())}`, margin, footerY, { width: pageWidth - margin * 2, align: 'center' });
};

// === DATEN LADEN ===

const loadAllMemberData = async (mitgliedId) => {
  try {
    // 1. Mitgliedsdaten
    const memberQuery = `
      SELECT m.*, d.dojoname
      FROM mitglieder m
      LEFT JOIN dojo d ON m.dojo_id = d.id
      WHERE m.mitglied_id = ?
    `;
    const memberResults = await queryAsync(memberQuery, [mitgliedId]);
    if (memberResults.length === 0) {
      throw new Error(`Mitglied mit ID ${mitgliedId} nicht gefunden`);
    }
    const mitglied = memberResults[0];

    // 2. Stile & Graduierungen
    const stilQuery = `
      SELECT msd.*, s.name as stil_name, s.beschreibung as stil_beschreibung,
             g.name as graduierung_name, g.farbe_hex, g.farbe_sekundaer,
             g.kategorie, g.trainingsstunden_min, g.mindestzeit_monate,
             msd.letzte_pruefung
      FROM mitglied_stil_data msd
      LEFT JOIN stile s ON msd.stil_id = s.stil_id
      LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
      WHERE msd.mitglied_id = ?
      ORDER BY msd.stil_id ASC
    `;
    const stile = await queryAsync(stilQuery, [mitgliedId]);

    // 3. Prüfungen
    const examQuery = `
      SELECT p.*, s.name as stil_name,
             g.name as graduierung_nachher_name
      FROM pruefungen p
      LEFT JOIN stile s ON p.stil_id = s.stil_id
      LEFT JOIN graduierungen g ON p.graduierung_nachher_id = g.graduierung_id
      WHERE p.mitglied_id = ?
      ORDER BY p.pruefungsdatum DESC
      LIMIT 20
    `;
    const exams = await queryAsync(examQuery, [mitgliedId]);

    // 4. Verträge
    const contractQuery = `
      SELECT v.*, t.name as tarif_name, t.price_cents
      FROM vertraege v
      LEFT JOIN tarife t ON v.tarif_id = t.id
      WHERE v.mitglied_id = ?
      ORDER BY v.vertragsbeginn DESC
    `;
    const contracts = await queryAsync(contractQuery, [mitgliedId]);

    // 5. Zahlungen/Beiträge
    const paymentQuery = `
      SELECT * FROM beitraege
      WHERE mitglied_id = ?
      ORDER BY zahlungsdatum DESC
      LIMIT 50
    `;
    const payments = await queryAsync(paymentQuery, [mitgliedId]);

    // 6. SEPA-Mandate (aktiv und archiviert)
    const sepaQuery = `
      SELECT * FROM sepa_mandate
      WHERE mitglied_id = ?
      ORDER BY created_at DESC
    `;
    const sepaMandate = await queryAsync(sepaQuery, [mitgliedId]);

    // 7. Anwesenheitsstatistiken
    const attendanceQuery = `
      SELECT * FROM anwesenheit
      WHERE mitglied_id = ? AND anwesend = 1
      ORDER BY datum DESC
      LIMIT 100
    `;
    const attendance = await queryAsync(attendanceQuery, [mitgliedId]);

    // 8. Benachrichtigungen (falls vorhanden - notifications Tabelle hat keine direkte mitglied_id Verknüpfung)
    // Die notifications Tabelle verwendet 'recipient' (E-Mail) statt member_id
    let notifications = [];
    if (mitglied.email) {
      const notificationsQuery = `
        SELECT * FROM notifications
        WHERE recipient = ?
        ORDER BY created_at DESC
        LIMIT 20
      `;
      notifications = await queryAsync(notificationsQuery, [mitglied.email]);
    }

    return {
      mitglied,
      stile,
      exams,
      contracts,
      payments,
      sepaMandate,
      attendance,
      notifications
    };
  } catch (error) {
    logger.error('❌ Fehler beim Laden der Mitgliedsdaten:', error.message);
    throw error;
  }
};

const loadDojoLogo = async (dojoId) => {
  try {
    const logoQuery = 'SELECT logo_pfad FROM dojo_logos WHERE dojo_id = ? LIMIT 1';
    const results = await queryAsync(logoQuery, [dojoId]);

    if (results.length > 0 && results[0].logo_pfad) {
      const absolutePath = path.join(__dirname, '..', results[0].logo_pfad);
      if (fs.existsSync(absolutePath)) {
        return absolutePath;
      }
    }
    return null;
  } catch (error) {
    logger.warn('⚠️ Fehler beim Laden des Logos:', error.message);
    return null;
  }
};

// === SEITEN-GENERATOR FUNKTIONEN ===

// TAB 1: ALLGEMEIN
const generateAllgemeinSection = (doc, mitglied, fotoPath, currentY, logoPath) => {
  const margin = 50;
  const pageWidth = 595.28;
  const context = { mitglied, logoPath };

  currentY = drawSectionHeader(doc, margin, currentY, 495, '1. ALLGEMEIN');

  // Foto rechts oben (klein)
  if (fotoPath && fs.existsSync(fotoPath)) {
    try {
      doc.image(fotoPath, pageWidth - margin - 70, currentY, { width: 60, height: 80, fit: [60, 80] });
    } catch (error) {
      doc.rect(pageWidth - margin - 70, currentY, 60, 80).fillAndStroke('#F0F0F0', '#CCCCCC');
      doc.fontSize(7).fillColor('#999999').text('Kein Foto', pageWidth - margin - 70, currentY + 35, { width: 60, align: 'center' });
    }
  } else {
    doc.rect(pageWidth - margin - 70, currentY, 60, 80).fillAndStroke('#F0F0F0', '#CCCCCC');
    doc.fontSize(7).fillColor('#999999').text('Kein Foto', pageWidth - margin - 70, currentY + 35, { width: 60, align: 'center' });
  }

  // Persönliche Daten
  currentY = drawField(doc, margin, currentY, 'Mitgliedsnummer:', mitglied.mitglied_id);
  currentY = drawField(doc, margin, currentY, 'Vorname:', mitglied.vorname);
  currentY = drawField(doc, margin, currentY, 'Nachname:', mitglied.nachname);
  currentY = drawField(doc, margin, currentY, 'Geburtsdatum:', formatDate(mitglied.geburtsdatum));

  const geschlecht = mitglied.geschlecht === 'm' ? 'Männlich' : mitglied.geschlecht === 'w' ? 'Weiblich' : mitglied.geschlecht === 'd' ? 'Divers' : 'n/a';
  currentY = drawField(doc, margin, currentY, 'Geschlecht:', geschlecht);
  currentY = drawField(doc, margin, currentY, 'Gewicht (kg):', mitglied.gewicht);
  currentY = drawField(doc, margin, currentY, 'Aktuelle Graduierung:', mitglied.gurtfarbe || mitglied.aktuelle_graduierungen);

  currentY += 8;

  // Kontaktdaten
  currentY = drawField(doc, margin, currentY, 'E-Mail:', mitglied.email);
  currentY = drawField(doc, margin, currentY, 'Telefon:', mitglied.telefon);
  currentY = drawField(doc, margin, currentY, 'Mobil:', mitglied.telefon_mobil);
  currentY = drawField(doc, margin, currentY, 'Straße:', mitglied.strasse ? `${mitglied.strasse} ${mitglied.hausnummer || ''}` : 'n/a');
  currentY = drawField(doc, margin, currentY, 'PLZ / Ort:', mitglied.plz && mitglied.ort ? `${mitglied.plz} ${mitglied.ort}` : 'n/a');

  currentY += 8;

  // Erweiterte Informationen
  currentY = drawField(doc, margin, currentY, 'Newsletter:', mitglied.newsletter_abo ? 'Ja' : 'Nein');
  currentY = drawField(doc, margin, currentY, 'Marketing-Quelle:', mitglied.marketing_quelle);
  currentY = drawField(doc, margin, currentY, 'Bevorzugte Trainingszeiten:', mitglied.bevorzugte_trainingszeiten);
  currentY = drawField(doc, margin, currentY, 'Online-Portal:', mitglied.online_portal_aktiv ? 'Aktiv' : 'Inaktiv');
  currentY = drawField(doc, margin, currentY, 'Letzter Login:', formatDate(mitglied.letzter_login));
  currentY = drawField(doc, margin, currentY, 'Kontostand:', formatCurrency(mitglied.kontostand * 100));
  currentY = drawField(doc, margin, currentY, 'Interne Notizen:', mitglied.notizen);

  currentY += 15;
  return currentY;
};

// TAB 2: MEDIZINISCH
const generateMedizinischSection = (doc, mitglied, currentY, logoPath) => {
  const margin = 50;
  const context = { mitglied, logoPath };

  currentY = drawSectionHeader(doc, margin, currentY, 495, '2. MEDIZINISCH');

  currentY = drawField(doc, margin, currentY, 'Allergien:', mitglied.allergien);
  currentY = drawField(doc, margin, currentY, 'Medizinische Hinweise:', mitglied.medizinische_hinweise);

  currentY += 8;

  // Notfallkontakte
  doc.fontSize(9).fillColor('#666666').font('Helvetica-Bold')
     .text('Notfallkontakte:', margin, currentY);
  currentY += 14;

  currentY = drawField(doc, margin + 10, currentY, 'Kontakt 1 - Name:', mitglied.notfallkontakt_name);
  currentY = drawField(doc, margin + 10, currentY, 'Kontakt 1 - Telefon:', mitglied.notfallkontakt_telefon);
  currentY = drawField(doc, margin + 10, currentY, 'Kontakt 1 - Verhältnis:', mitglied.notfallkontakt_verhaeltnis);

  currentY += 4;

  currentY = drawField(doc, margin + 10, currentY, 'Kontakt 2 - Name:', mitglied.notfallkontakt2_name);
  currentY = drawField(doc, margin + 10, currentY, 'Kontakt 2 - Telefon:', mitglied.notfallkontakt2_telefon);
  currentY = drawField(doc, margin + 10, currentY, 'Kontakt 2 - Verhältnis:', mitglied.notfallkontakt2_verhaeltnis);

  currentY += 4;

  currentY = drawField(doc, margin + 10, currentY, 'Kontakt 3 - Name:', mitglied.notfallkontakt3_name);
  currentY = drawField(doc, margin + 10, currentY, 'Kontakt 3 - Telefon:', mitglied.notfallkontakt3_telefon);
  currentY = drawField(doc, margin + 10, currentY, 'Kontakt 3 - Verhältnis:', mitglied.notfallkontakt3_verhaeltnis);

  currentY += 15;
  return currentY;
};

// TAB 3: FAMILIE
const generateFamilieSection = (doc, mitglied, currentY, logoPath) => {
  const margin = 50;

  currentY = drawSectionHeader(doc, margin, currentY, 495, '3. FAMILIE & VERTRETER');

  currentY = drawField(doc, margin, currentY, 'Familien-ID:', mitglied.familien_id);
  currentY = drawField(doc, margin, currentY, 'Rabatt (%):', mitglied.rabatt_prozent);
  currentY = drawField(doc, margin, currentY, 'Rabatt-Grund:', mitglied.rabatt_grund);

  currentY += 8;

  // Gesetzliche Vertreter
  doc.fontSize(9).fillColor('#666666').font('Helvetica-Bold')
     .text('Gesetzliche Vertreter:', margin, currentY);
  currentY += 14;

  currentY = drawField(doc, margin + 10, currentY, 'Vertreter 1 - Name:', mitglied.vertreter1_name);
  currentY = drawField(doc, margin + 10, currentY, 'Vertreter 1 - Telefon:', mitglied.vertreter1_telefon);
  currentY = drawField(doc, margin + 10, currentY, 'Vertreter 1 - E-Mail:', mitglied.vertreter1_email);

  currentY += 4;

  currentY = drawField(doc, margin + 10, currentY, 'Vertreter 2 - Name:', mitglied.vertreter2_name);
  currentY = drawField(doc, margin + 10, currentY, 'Vertreter 2 - Telefon:', mitglied.vertreter2_telefon);
  currentY = drawField(doc, margin + 10, currentY, 'Vertreter 2 - E-Mail:', mitglied.vertreter2_email);

  currentY += 15;
  return currentY;
};

// TAB 4: GURT & STIL
const generateGurtStilSection = (doc, stile, currentY, logoPath, mitglied) => {
  const margin = 50;

  currentY = drawSectionHeader(doc, margin, currentY, 495, '4. GURT & STIL');

  if (!stile || stile.length === 0) {
    doc.fontSize(8).fillColor('#999999').font('Helvetica')
       .text('Keine Stile eingetragen', margin, currentY);
    currentY += 20;
  } else {
    // Nur die ersten 5 Stile anzeigen (normalerweise hat ein Mitglied 1-3)
    const displayStile = stile.slice(0, 5);
    if (stile.length > 5) {
      doc.fontSize(7).fillColor('#999999').font('Helvetica-Oblique')
         .text(`Hinweis: Es werden nur die ersten 5 von ${stile.length} Stilen angezeigt`, margin, currentY);
      currentY += 14;
    }
    displayStile.forEach((stil, index) => {
      currentY = drawField(doc, margin, currentY, `Stil ${index + 1}:`, stil.stil_name);
      currentY = drawField(doc, margin + 10, currentY, 'Aktuelle Graduierung:', stil.graduierung_name);
      currentY = drawField(doc, margin + 10, currentY, 'Kategorie:', stil.kategorie);
      currentY = drawField(doc, margin + 10, currentY, 'Mindest-Trainingsstunden:', stil.trainingsstunden_min);
      currentY = drawField(doc, margin + 10, currentY, 'Mindestzeit (Monate):', stil.mindestzeit_monate);
      currentY = drawField(doc, margin + 10, currentY, 'Letzte Prüfung:', formatDate(stil.letzte_pruefung));
      currentY = drawField(doc, margin + 10, currentY, 'Beschreibung:', stil.stil_beschreibung);
      currentY += 8;
    });
  }

  currentY += 15;
  return currentY;
};

// TAB 5: PRÜFUNGEN
const generatePruefungenSection = (doc, exams, currentY, logoPath, mitglied) => {
  const margin = 50;


  currentY = drawSectionHeader(doc, margin, currentY, 495, '5. PRÜFUNGSHISTORIE');

  if (!exams || exams.length === 0) {
    doc.fontSize(8).fillColor('#999999').font('Helvetica')
       .text('Keine Prüfungen vorhanden', margin, currentY);
    currentY += 20;
  } else {
    // Nur die letzten 10 Prüfungen anzeigen
    const recentExams = exams.slice(0, 10);
    console.log(`📊 Prüfungen: Zeige ${recentExams.length} von ${exams.length} Prüfungen`);
    if (exams.length > 10) {
      doc.fontSize(7).fillColor('#999999').font('Helvetica-Oblique')
         .text(`Hinweis: Es werden nur die letzten 10 von ${exams.length} Prüfungen angezeigt`, margin, currentY);
      currentY += 14;
    }
    recentExams.forEach((exam, index) => {
      currentY = drawField(doc, margin, currentY, `Prüfung ${index + 1}:`, formatDate(exam.pruefungsdatum));
      currentY = drawField(doc, margin + 10, currentY, 'Stil:', exam.stil_name);
      currentY = drawField(doc, margin + 10, currentY, 'Graduierung nachher:', exam.graduierung_nachher_name);

      // Ergebnis aus status oder bestanden-Feld
      let ergebnis = 'n/a';
      if (exam.status) {
        ergebnis = exam.status === 'bestanden' ? 'Bestanden' :
                   exam.status === 'nicht_bestanden' ? 'Nicht bestanden' :
                   exam.status === 'durchgefuehrt' && exam.bestanden ? 'Bestanden' :
                   exam.status === 'durchgefuehrt' && !exam.bestanden ? 'Nicht bestanden' :
                   exam.status;
      } else if (exam.bestanden !== null && exam.bestanden !== undefined) {
        ergebnis = exam.bestanden ? 'Bestanden' : 'Nicht bestanden';
      }

      currentY = drawField(doc, margin + 10, currentY, 'Ergebnis:', ergebnis);
      if (exam.punktzahl !== null && exam.punktzahl !== undefined) {
        const punkteText = exam.max_punktzahl ? `${exam.punktzahl}/${exam.max_punktzahl}` : exam.punktzahl;
        currentY = drawField(doc, margin + 10, currentY, 'Punktzahl:', punkteText);
      }
      currentY += 6;
    });
  }

  currentY += 15;
  return currentY;
};

// TAB 6: VERTRÄGE
const generateVertraegeSection = (doc, mitglied, contracts, currentY, logoPath) => {
  const margin = 50;


  currentY = drawSectionHeader(doc, margin, currentY, 495, '6. VERTRÄGE');

  currentY = drawField(doc, margin, currentY, 'Vertragsfrei:', mitglied.vertragsfrei ? 'Ja' : 'Nein');
  currentY = drawField(doc, margin, currentY, 'Vertragsfrei Grund:', mitglied.vertragsfrei_grund);

  currentY += 8;

  if (!contracts || contracts.length === 0) {
    doc.fontSize(8).fillColor('#999999').font('Helvetica')
       .text('Keine Verträge vorhanden', margin, currentY);
    currentY += 20;
  } else {
    // Nur die letzten 10 Verträge anzeigen
    const recentContracts = contracts.slice(0, 10);
    if (contracts.length > 10) {
      doc.fontSize(7).fillColor('#999999').font('Helvetica-Oblique')
         .text(`Hinweis: Es werden nur die letzten 10 von ${contracts.length} Verträgen angezeigt`, margin, currentY);
      currentY += 14;
    }
    recentContracts.forEach((contract, index) => {
      currentY = drawField(doc, margin, currentY, `Vertrag ${index + 1} - Nr:`, contract.vertragsnummer);
      currentY = drawField(doc, margin + 10, currentY, 'Status:', contract.status);
      currentY = drawField(doc, margin + 10, currentY, 'Tarif:', contract.tarif_name);
      currentY = drawField(doc, margin + 10, currentY, 'Monatsbeitrag:', formatCurrency(contract.price_cents));
      currentY = drawField(doc, margin + 10, currentY, 'Vertragsbeginn:', formatDate(contract.vertragsbeginn));
      currentY = drawField(doc, margin + 10, currentY, 'Vertragsende:', formatDate(contract.vertragsende));

      const billingCycle = contract.billing_cycle === 'monthly' ? 'Monatlich' :
                           contract.billing_cycle === 'quarterly' ? 'Vierteljährlich' :
                           contract.billing_cycle === 'annually' ? 'Jährlich' : contract.billing_cycle || 'n/a';
      currentY = drawField(doc, margin + 10, currentY, 'Zahlungszyklus:', billingCycle);

      const paymentMethod = contract.payment_method === 'direct_debit' ? 'Lastschrift' :
                           contract.payment_method === 'bank_transfer' ? 'Überweisung' :
                           contract.payment_method === 'cash' ? 'Bar' : contract.payment_method || 'n/a';
      currentY = drawField(doc, margin + 10, currentY, 'Zahlungsart:', paymentMethod);

      currentY = drawField(doc, margin + 10, currentY, 'Aufnahmegebühr:', formatCurrency(contract.aufnahmegebuehr_cents));
      currentY = drawField(doc, margin + 10, currentY, 'Kündigungsfrist (Monate):', contract.kuendigungsfrist_monate);
      currentY = drawField(doc, margin + 10, currentY, 'Mindestlaufzeit (Monate):', contract.mindestlaufzeit_monate);
      currentY = drawField(doc, margin + 10, currentY, 'Kündigung eingegangen:', formatDate(contract.kuendigung_eingegangen));
      currentY = drawField(doc, margin + 10, currentY, 'Ruhepause von:', formatDate(contract.ruhepause_von));
      currentY = drawField(doc, margin + 10, currentY, 'Ruhepause bis:', formatDate(contract.ruhepause_bis));
      currentY += 8;
    });
  }

  currentY += 15;
  return currentY;
};

// TAB 7: ANWESENHEIT
const generateAnwesenheitSection = (doc, attendance, currentY, logoPath, mitglied) => {
  const margin = 50;


  currentY = drawSectionHeader(doc, margin, currentY, 495, '7. ANWESENHEIT & STATISTIKEN');

  const totalAttendances = attendance ? attendance.length : 0;

  // Berechne Statistiken
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const thisMonthAttendances = attendance ? attendance.filter(a => new Date(a.datum) >= thisMonth).length : 0;

  let lastAttendance = 'n/a';
  if (attendance && attendance.length > 0) {
    lastAttendance = formatDate(attendance[0].datum);
  }

  currentY = drawField(doc, margin, currentY, 'Gesamte Anwesenheiten:', totalAttendances);
  currentY = drawField(doc, margin, currentY, 'Dieser Monat:', thisMonthAttendances);
  currentY = drawField(doc, margin, currentY, 'Letzte Anwesenheit:', lastAttendance);

  currentY += 15;
  return currentY;
};

// TAB 8: FINANZEN
const generateFinanzenSection = (doc, mitglied, payments, sepaMandate, currentY, logoPath) => {
  const margin = 50;


  currentY = drawSectionHeader(doc, margin, currentY, 495, '8. FINANZEN');

  // Bankdaten
  doc.fontSize(9).fillColor('#666666').font('Helvetica-Bold')
     .text('Bankdaten:', margin, currentY);
  currentY += 14;

  currentY = drawField(doc, margin + 10, currentY, 'IBAN:', mitglied.iban);
  currentY = drawField(doc, margin + 10, currentY, 'BIC:', mitglied.bic);
  currentY = drawField(doc, margin + 10, currentY, 'Bankname:', mitglied.bankname);
  currentY = drawField(doc, margin + 10, currentY, 'Kontoinhaber:', mitglied.kontoinhaber);
  currentY = drawField(doc, margin + 10, currentY, 'Zahlungsmethode:', mitglied.zahlungsmethode);
  currentY = drawField(doc, margin + 10, currentY, 'Zahllaufgruppe:', mitglied.zahllaufgruppe);

  currentY += 8;

  // SEPA-Mandat
  if (sepaMandate && sepaMandate.length > 0) {
    const aktivesMandat = sepaMandate.find(m => m.status === 'aktiv');
    if (aktivesMandat) {
      doc.fontSize(9).fillColor('#666666').font('Helvetica-Bold')
         .text('SEPA-Lastschriftmandat:', margin, currentY);
      currentY += 14;

      currentY = drawField(doc, margin + 10, currentY, 'Mandatsreferenz:', aktivesMandat.mandatsreferenz);
      currentY = drawField(doc, margin + 10, currentY, 'Erstellt am:', formatDate(aktivesMandat.created_at));
      currentY = drawField(doc, margin + 10, currentY, 'Gläubiger-ID:', aktivesMandat.glaeubiger_id);
      currentY = drawField(doc, margin + 10, currentY, 'IBAN:', aktivesMandat.iban);
      currentY = drawField(doc, margin + 10, currentY, 'Kontoinhaber:', aktivesMandat.kontoinhaber);
      currentY = drawField(doc, margin + 10, currentY, 'BIC:', aktivesMandat.bic);

      currentY += 8;
    }
  }

  // Zahlungsstatistiken
  if (payments && payments.length > 0) {
    const bezahlt = payments.filter(p => p.bezahlt).reduce((sum, p) => sum + (p.betrag || 0), 0);
    const offen = payments.filter(p => !p.bezahlt).reduce((sum, p) => sum + (p.betrag || 0), 0);

    currentY = drawField(doc, margin, currentY, 'Anzahl Zahlungen:', payments.length);
    currentY = drawField(doc, margin, currentY, 'Bezahlt (gesamt):', formatCurrency(bezahlt * 100));
    currentY = drawField(doc, margin, currentY, 'Offen (gesamt):', formatCurrency(offen * 100));
  }

  currentY += 15;
  return currentY;
};

// TAB 9: DOKUMENTE
const generateDokumenteSection = (doc, mitglied, currentY, logoPath) => {
  const margin = 50;


  currentY = drawSectionHeader(doc, margin, currentY, 495, '9. DOKUMENTE & EINVERSTÄNDNISSE');

  currentY = drawField(doc, margin, currentY, 'Hausordnung akzeptiert:', mitglied.hausordnung_akzeptiert ? `Ja (${formatDate(mitglied.hausordnung_akzeptiert_am)})` : 'Nein');
  currentY = drawField(doc, margin, currentY, 'Datenschutz akzeptiert:', mitglied.datenschutz_akzeptiert ? `Ja (${formatDate(mitglied.datenschutz_akzeptiert_am)})` : 'Nein');
  currentY = drawField(doc, margin, currentY, 'Foto-Einverständnis:', mitglied.foto_einverstaendnis ? `Ja (${formatDate(mitglied.foto_einverstaendnis_datum)})` : 'Nein');
  currentY = drawField(doc, margin, currentY, 'AGB akzeptiert:', mitglied.agb_akzeptiert ? `Ja (${formatDate(mitglied.agb_akzeptiert_am)})` : 'Nein');
  currentY = drawField(doc, margin, currentY, 'Haftungsausschluss:', mitglied.haftungsausschluss_akzeptiert ? `Ja (${formatDate(mitglied.haftungsausschluss_datum)})` : 'Nein');
  currentY = drawField(doc, margin, currentY, 'Gesundheitserklärung:', mitglied.gesundheitserklaerung ? `Ja (${formatDate(mitglied.gesundheitserklaerung_datum)})` : 'Nein');
  currentY = drawField(doc, margin, currentY, 'Vereinsordnung Datum:', formatDate(mitglied.vereinsordnung_datum));

  currentY += 15;
  return currentY;
};

// TAB 10: NACHRICHTEN
const generateNachrichtenSection = (doc, notifications, currentY, logoPath, mitglied) => {
  const margin = 50;


  currentY = drawSectionHeader(doc, margin, currentY, 495, '10. NACHRICHTEN');

  if (!notifications || notifications.length === 0) {
    doc.fontSize(8).fillColor('#999999').font('Helvetica')
       .text('Keine Nachrichten vorhanden', margin, currentY);
    currentY += 20;
  } else {
    const recent = notifications.slice(0, 10);
    recent.forEach((notif, index) => {
      currentY = drawField(doc, margin, currentY, `Nachricht ${index + 1}:`, formatDate(notif.created_at));
      currentY = drawField(doc, margin + 10, currentY, 'Typ:', notif.type);
      currentY = drawField(doc, margin + 10, currentY, 'Betreff:', notif.subject);
      currentY = drawField(doc, margin + 10, currentY, 'Status:', notif.status);
      currentY += 6;
    });
  }

  currentY += 15;
  return currentY;
};

// === HAUPTFUNKTION ===

async function generateMitgliedDetailPDF(mitgliedId, options = {}) {
  try {
    logger.info(`📄 Generiere vollständiges Mitgliedsdatenblatt für ID: ${mitgliedId}`);

    const data = await loadAllMemberData(mitgliedId);
    const { mitglied, stile, exams, contracts, payments, sepaMandate, attendance, notifications } = data;

    const logoPath = mitglied.dojo_id ? await loadDojoLogo(mitglied.dojo_id) : null;

    let fotoPath = null;
    if (mitglied.foto_pfad) {
      const absoluteFotoPath = path.join(__dirname, '..', mitglied.foto_pfad);
      if (fs.existsSync(absoluteFotoPath)) {
        fotoPath = absoluteFotoPath;
      }
    }

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Mitgliedsdatenblatt - ${mitglied.vorname} ${mitglied.nachname}`,
        Author: 'DojoSoftware',
        Subject: 'Vollständige Mitgliedsinformationen'
      }
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    let currentY = 50 + 40;

    // Header auf erster Seite
    addPageHeaderFooter(doc, mitglied, logoPath);

    // TAB 1: ALLGEMEIN (prüft intern ob Platz vorhanden)
    currentY = generateAllgemeinSection(doc, mitglied, fotoPath, currentY, logoPath);

    // TAB 2: MEDIZINISCH (prüft intern ob Platz vorhanden)
    currentY = generateMedizinischSection(doc, mitglied, currentY, logoPath);

    // TAB 3: FAMILIE (prüft intern ob Platz vorhanden)
    currentY = generateFamilieSection(doc, mitglied, currentY, logoPath);

    // TAB 4: GURT & STIL (prüft intern ob Platz vorhanden)
    currentY = generateGurtStilSection(doc, stile, currentY, logoPath, mitglied);

    // TAB 5: PRÜFUNGEN (prüft intern ob Platz vorhanden)
    currentY = generatePruefungenSection(doc, exams, currentY, logoPath, mitglied);

    // TAB 6: VERTRÄGE (prüft intern ob Platz vorhanden)
    currentY = generateVertraegeSection(doc, mitglied, contracts, currentY, logoPath);

    // TAB 7: ANWESENHEIT (prüft intern ob Platz vorhanden)
    currentY = generateAnwesenheitSection(doc, attendance, currentY, logoPath, mitglied);

    // TAB 8: FINANZEN (prüft intern ob Platz vorhanden)
    currentY = generateFinanzenSection(doc, mitglied, payments, sepaMandate, currentY, logoPath);

    // TAB 9: DOKUMENTE (prüft intern ob Platz vorhanden)
    currentY = generateDokumenteSection(doc, mitglied, currentY, logoPath);

    // TAB 10: NACHRICHTEN (prüft intern ob Platz vorhanden)
    currentY = generateNachrichtenSection(doc, notifications, currentY, logoPath, mitglied);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const pageCount = doc.bufferedPageRange().count;
        logger.info(`✅ Vollständiges PDF generiert: ${pageCount} Seiten, ${pdfBuffer.length} bytes`);
        console.log(`📄 PDF-Statistik: ${pageCount} Seiten generiert`);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
    });

  } catch (error) {
    logger.error('❌ Fehler bei PDF-Generierung:', error.message);
    throw error;
  }
}

module.exports = {
  generateMitgliedDetailPDF
};
