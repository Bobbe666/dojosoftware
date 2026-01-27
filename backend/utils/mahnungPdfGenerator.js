/**
 * Mahnung PDF-Generator
 * Generiert professionelle Mahnschreiben als PDF
 */
const PDFDocument = require('pdfkit');

// Farbschema passend zur Software
const COLORS = {
  primary: '#8B0000',      // Dunkelrot (Dojo-Theme)
  warning: '#F59E0B',      // Orange fuer Warnung
  danger: '#DC2626',       // Rot fuer dringende Mahnung
  text: '#1A1A1A',         // Dunkelgrau
  lightGray: '#F5F5F5',    // Hellgrau
  border: '#CCCCCC',       // Grau fuer Rahmen
  accent: '#333333'        // Schwarz fuer Akzente
};

// Mahnstufen-Farben
const MAHNSTUFE_COLORS = {
  1: COLORS.warning,   // 1. Mahnung - Orange
  2: '#EA580C',        // 2. Mahnung - Dunkelorange
  3: COLORS.danger     // 3. Mahnung - Rot
};

/**
 * Formatiert einen Betrag als Euro-String
 */
function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/**
 * Formatiert ein Datum im deutschen Format
 */
function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formatiert ein Datum im langen deutschen Format
 */
function formatDateLong(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Generiert eine Mahnung als PDF
 * @param {Object} data - Alle notwendigen Daten
 * @param {Object} data.mitglied - Mitgliedsdaten (vorname, nachname, strasse, plz, ort, etc.)
 * @param {Object} data.beitrag - Beitragsdaten (betrag, faelligkeitsdatum, beschreibung, etc.)
 * @param {Object} data.mahnung - Mahnungsdaten (mahnstufe, mahngebuehr, mahndatum)
 * @param {Object} data.dojo - Dojo-Daten (dojoname, inhaber, strasse, plz, ort, telefon, email, bank_iban, bank_bic, etc.)
 * @param {Object} data.mahnstufeSettings - Einstellungen der Mahnstufe (email_betreff, tage_nach_faelligkeit)
 * @returns {Promise<Buffer>} PDF als Buffer
 */
function generateMahnungPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const { mitglied, beitrag, mahnung, dojo, mahnstufeSettings } = data;
      const mahnstufe = mahnung.mahnstufe || 1;

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Mahnung ${mahnstufe}. Mahnstufe - ${mitglied.vorname} ${mitglied.nachname}`,
          Author: dojo.dojoname || 'Dojo Software',
          Subject: `Zahlungserinnerung - ${mahnstufe}. Mahnung`,
          Creator: 'DojoSoftware',
          CreationDate: new Date()
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const mahnColor = MAHNSTUFE_COLORS[mahnstufe] || COLORS.warning;

      // ==========================================
      // HEADER mit Mahnstufe-Badge
      // ==========================================

      // Mahnstufe-Badge oben rechts
      const badgeWidth = 120;
      const badgeHeight = 30;
      const badgeX = doc.page.width - doc.page.margins.right - badgeWidth;
      const badgeY = 30;

      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 5)
        .fill(mahnColor);

      doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FFFFFF')
        .text(`${mahnstufe}. MAHNUNG`, badgeX, badgeY + 9, {
          width: badgeWidth,
          align: 'center'
        });

      // ==========================================
      // ABSENDER (Dojo) - oben links
      // ==========================================
      doc.fontSize(8)
        .font('Helvetica')
        .fillColor(COLORS.text);

      const absenderZeile = [
        dojo.dojoname,
        dojo.strasse && dojo.hausnummer ? `${dojo.strasse} ${dojo.hausnummer}` : '',
        dojo.plz && dojo.ort ? `${dojo.plz} ${dojo.ort}` : ''
      ].filter(Boolean).join(' | ');

      doc.text(absenderZeile, 50, 50, { underline: true })
        .moveDown(2);

      // ==========================================
      // EMPFAENGER (Mitglied)
      // ==========================================
      doc.fontSize(11)
        .font('Helvetica');

      const anrede = mitglied.anrede || '';
      const empfaengerName = `${anrede ? anrede + ' ' : ''}${mitglied.vorname} ${mitglied.nachname}`;

      doc.text(empfaengerName);
      if (mitglied.strasse) {
        doc.text(`${mitglied.strasse}${mitglied.hausnummer ? ' ' + mitglied.hausnummer : ''}`);
      }
      if (mitglied.plz || mitglied.ort) {
        doc.text(`${mitglied.plz || ''} ${mitglied.ort || ''}`);
      }

      doc.moveDown(2);

      // ==========================================
      // DATUM (rechtsbuendig)
      // ==========================================
      const heute = formatDateLong(new Date());
      const ortDatum = `${dojo.ort || ''}, ${heute}`;
      doc.text(ortDatum, { align: 'right' });

      doc.moveDown(2);

      // ==========================================
      // BETREFF
      // ==========================================
      const betreffTexte = {
        1: 'Zahlungserinnerung',
        2: 'Zweite Mahnung',
        3: 'Letzte Mahnung vor weiteren Massnahmen'
      };

      doc.fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(mahnColor)
        .text(betreffTexte[mahnstufe] || `${mahnstufe}. Mahnung`)
        .moveDown(0.3);

      if (beitrag.beschreibung) {
        doc.fontSize(10)
          .font('Helvetica')
          .fillColor(COLORS.text)
          .text(`Betreff: ${beitrag.beschreibung}`);
      }

      if (mitglied.mitgliedsnummer) {
        doc.text(`Mitgliedsnummer: ${mitglied.mitgliedsnummer}`);
      }

      doc.moveDown(1.5);

      // ==========================================
      // ANREDE
      // ==========================================
      doc.fontSize(11)
        .font('Helvetica')
        .fillColor(COLORS.text);

      const briefAnrede = mitglied.anrede === 'Frau' ? 'Sehr geehrte Frau' :
                         mitglied.anrede === 'Herr' ? 'Sehr geehrter Herr' :
                         'Sehr geehrte/r';

      doc.text(`${briefAnrede} ${mitglied.nachname},`)
        .moveDown(1);

      // ==========================================
      // HAUPTTEXT (je nach Mahnstufe)
      // ==========================================
      const hauptTexte = {
        1: `bei der Durchsicht unserer Buchhaltung ist uns aufgefallen, dass die folgende Zahlung noch aussteht. Wir moechten Sie freundlich daran erinnern, den offenen Betrag zu begleichen.`,
        2: `leider haben wir trotz unserer ersten Zahlungserinnerung noch keinen Zahlungseingang feststellen koennen. Wir bitten Sie, den ausstehenden Betrag umgehend zu ueberweisen.`,
        3: `trotz unserer bisherigen Mahnungen ist die nachstehende Forderung noch immer offen. Wir fordern Sie hiermit letztmalig auf, den Gesamtbetrag innerhalb von 7 Tagen zu begleichen. Andernfalls sehen wir uns gezwungen, weitere rechtliche Schritte einzuleiten.`
      };

      doc.text(hauptTexte[mahnstufe] || hauptTexte[1], { lineGap: 4 });
      doc.moveDown(1);

      // ==========================================
      // DETAILS BOX
      // ==========================================
      const boxY = doc.y;
      const boxHeight = 130;

      doc.rect(50, boxY, pageWidth, boxHeight)
        .fillAndStroke(COLORS.lightGray, COLORS.border);

      doc.fillColor(COLORS.text)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Zahlungsdetails:', 60, boxY + 15);

      doc.font('Helvetica')
        .fontSize(10);

      let detailY = boxY + 38;
      const labelWidth = 180;

      // Berechne Gesamtbetrag
      const urspruenglicherBetrag = parseFloat(beitrag.betrag) || 0;
      const mahngebuehr = parseFloat(mahnung.mahngebuehr) || 0;
      const gesamtBetrag = urspruenglicherBetrag + mahngebuehr;

      const details = [
        ['Urspruenglicher Betrag:', formatCurrency(urspruenglicherBetrag)],
        ['Faelligkeitsdatum:', formatDate(beitrag.faelligkeitsdatum)],
        ['Mahnstufe:', `${mahnstufe}. Mahnung`],
        ['Mahngebuehr:', formatCurrency(mahngebuehr)]
      ];

      details.forEach(([label, value]) => {
        doc.font('Helvetica').text(label, 60, detailY, { continued: false, width: labelWidth });
        doc.text(value, 60 + labelWidth, detailY);
        detailY += 18;
      });

      // Gesamtbetrag hervorgehoben
      detailY += 5;
      doc.strokeColor(COLORS.border)
        .lineWidth(1)
        .moveTo(60, detailY)
        .lineTo(pageWidth + 40, detailY)
        .stroke();

      detailY += 8;
      doc.font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(mahnColor)
        .text('Gesamtbetrag:', 60, detailY, { continued: false, width: labelWidth });
      doc.text(formatCurrency(gesamtBetrag), 60 + labelWidth, detailY);

      doc.y = boxY + boxHeight + 20;

      // ==========================================
      // ZAHLUNGSHINWEIS
      // ==========================================
      doc.fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica');

      doc.text('Bitte ueberweisen Sie den Gesamtbetrag auf folgendes Konto:', { lineGap: 4 });
      doc.moveDown(0.5);

      // Bankverbindung
      if (dojo.bank_iban || dojo.bank_name) {
        doc.font('Helvetica-Bold');
        if (dojo.bank_name) doc.text(`Bank: ${dojo.bank_name}`);
        if (dojo.bank_iban) doc.text(`IBAN: ${dojo.bank_iban}`);
        if (dojo.bank_bic) doc.text(`BIC: ${dojo.bank_bic}`);
        if (dojo.bank_inhaber) doc.text(`Kontoinhaber: ${dojo.bank_inhaber}`);
        doc.font('Helvetica');
      }

      doc.moveDown(0.5);
      doc.text(`Verwendungszweck: Mahnung ${mitglied.mitgliedsnummer || mitglied.nachname} - ${formatDate(new Date())}`);

      doc.moveDown(1.5);

      // ==========================================
      // SCHLUSSSATZ
      // ==========================================
      const schlussTexte = {
        1: 'Sollte sich Ihre Zahlung mit diesem Schreiben gekreuzt haben, betrachten Sie dieses bitte als gegenstandslos.',
        2: 'Sollten Sie Fragen zu dieser Mahnung haben oder eine Ratenzahlung vereinbaren wollen, setzen Sie sich bitte umgehend mit uns in Verbindung.',
        3: 'Bei Fragen oder falls Sie eine Zahlungsvereinbarung treffen moechten, kontaktieren Sie uns bitte unverzueglich. Nach Ablauf der Frist werden wir rechtliche Schritte einleiten.'
      };

      doc.text(schlussTexte[mahnstufe] || schlussTexte[1], { lineGap: 4 });
      doc.moveDown(1.5);

      // ==========================================
      // GRUSSFORMEL
      // ==========================================
      doc.text('Mit freundlichen Gruessen');
      doc.moveDown(2);

      // Unterschriftszeile
      doc.strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(250, doc.y)
        .stroke();

      doc.moveDown(0.3);
      doc.fontSize(10)
        .text(dojo.inhaber || dojo.dojoname || 'Dojo-Leitung');
      doc.fontSize(9)
        .fillColor('#666666')
        .text(dojo.dojoname || '');

      // ==========================================
      // FOOTER
      // ==========================================
      const footerY = doc.page.height - 80;

      doc.strokeColor(mahnColor)
        .lineWidth(2)
        .moveTo(50, footerY)
        .lineTo(doc.page.width - 50, footerY)
        .stroke();

      doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#888888');

      const footerText = [
        dojo.dojoname,
        dojo.strasse && dojo.ort ? `${dojo.strasse} ${dojo.hausnummer || ''}, ${dojo.plz} ${dojo.ort}` : '',
        dojo.telefon ? `Tel: ${dojo.telefon}` : '',
        dojo.email ? `E-Mail: ${dojo.email}` : ''
      ].filter(Boolean).join(' | ');

      doc.text(footerText, 50, footerY + 10, {
        align: 'center',
        width: pageWidth
      });

      // Generierungszeitpunkt
      const generatedAt = new Date().toLocaleString('de-DE');
      doc.text(`Dokument erstellt am: ${generatedAt}`, 50, footerY + 25, {
        align: 'center',
        width: pageWidth
      });

      // PDF finalisieren
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Ersetzt Platzhalter im Text mit tatsaechlichen Werten
 * @param {string} text - Text mit Platzhaltern
 * @param {Object} data - Daten fuer Platzhalter
 * @returns {string} Text mit ersetzten Platzhaltern
 */
function replacePlaceholders(text, data) {
  if (!text) return '';

  const { mitglied, beitrag, mahnung, dojo } = data;
  const mahngebuehr = parseFloat(mahnung?.mahngebuehr) || 0;
  const betrag = parseFloat(beitrag?.betrag) || 0;
  const gesamtbetrag = betrag + mahngebuehr;

  const replacements = {
    '{vorname}': mitglied?.vorname || '',
    '{nachname}': mitglied?.nachname || '',
    '{anrede}': mitglied?.anrede || '',
    '{mitgliedsnummer}': mitglied?.mitgliedsnummer || '',
    '{strasse}': mitglied?.strasse || '',
    '{plz}': mitglied?.plz || '',
    '{ort}': mitglied?.ort || '',
    '{betrag}': formatCurrency(betrag),
    '{mahngebuehr}': formatCurrency(mahngebuehr),
    '{gesamtbetrag}': formatCurrency(gesamtbetrag),
    '{faelligkeitsdatum}': formatDate(beitrag?.faelligkeitsdatum),
    '{mahndatum}': formatDate(mahnung?.mahndatum || new Date()),
    '{mahnstufe}': mahnung?.mahnstufe || '1',
    '{dojoname}': dojo?.dojoname || '',
    '{dojo_telefon}': dojo?.telefon || '',
    '{dojo_email}': dojo?.email || '',
    '{bank_name}': dojo?.bank_name || '',
    '{bank_iban}': dojo?.bank_iban || '',
    '{bank_bic}': dojo?.bank_bic || '',
    '{heute}': formatDate(new Date())
  };

  let result = text;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.split(placeholder).join(value);
  }

  return result;
}

module.exports = {
  generateMahnungPDF,
  replacePlaceholders,
  formatCurrency,
  formatDate
};
