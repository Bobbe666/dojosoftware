/**
 * Kuendigungsbestaetigung PDF-Generator
 * Generiert ein rechtssicheres Kuendigungsbestaetigungs-Schreiben
 */
const PDFDocument = require('pdfkit');

// Farbschema passend zur Software
const COLORS = {
  primary: '#8B0000',      // Dunkelrot (Dojo-Theme)
  text: '#1A1A1A',         // Dunkelgrau
  lightGray: '#F5F5F5',    // Hellgrau
  border: '#CCCCCC',       // Grau fuer Rahmen
  accent: '#333333'        // Schwarz fuer Akzente
};

/**
 * Generiert eine Kuendigungsbestaetigung als PDF
 * @param {Object} data - Alle notwendigen Daten
 * @param {Object} data.mitglied - Mitgliedsdaten (vorname, nachname, strasse, plz, ort, etc.)
 * @param {Object} data.vertrag - Vertragsdaten (vertragsnummer, vertragsbeginn, vertragsende, kuendigungsdatum, etc.)
 * @param {Object} data.dojo - Dojo-Daten (dojoname, inhaber, strasse, plz, ort, telefon, email, etc.)
 * @returns {Promise<Buffer>} PDF als Buffer
 */
function generateKuendigungsbestaetigungPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const { mitglied, vertrag, dojo } = data;

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Kuendigungsbestaetigung - ${mitglied.vorname} ${mitglied.nachname}`,
          Author: dojo.dojoname || 'Dojo Software',
          Subject: 'Kuendigungsbestaetigung Mitgliedsvertrag',
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

      // ==========================================
      // ABSENDER (Dojo) - oben rechts
      // ==========================================
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor(COLORS.text);

      // Absender-Zeile (klein, oben)
      const absenderZeile = [
        dojo.dojoname,
        dojo.strasse && dojo.hausnummer ? `${dojo.strasse} ${dojo.hausnummer}` : '',
        dojo.plz && dojo.ort ? `${dojo.plz} ${dojo.ort}` : ''
      ].filter(Boolean).join(' | ');

      doc.fontSize(8)
        .text(absenderZeile, 50, 50, { align: 'left', underline: true })
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
      const heute = new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const ortDatum = `${dojo.ort || ''}, ${heute}`;
      doc.text(ortDatum, { align: 'right' });

      doc.moveDown(2);

      // ==========================================
      // BETREFF
      // ==========================================
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text('Kuendigungsbestaetigung Ihres Mitgliedsvertrags')
        .moveDown(0.3);

      if (vertrag.vertragsnummer) {
        doc.fontSize(10)
          .font('Helvetica')
          .text(`Vertragsnummer: ${vertrag.vertragsnummer}`);
      }

      if (vertrag.mitgliedsnummer) {
        doc.text(`Mitgliedsnummer: ${vertrag.mitgliedsnummer}`);
      }

      doc.moveDown(1.5);

      // ==========================================
      // ANREDE
      // ==========================================
      doc.fontSize(11)
        .font('Helvetica');

      const briefAnrede = mitglied.anrede === 'Frau' ? 'Sehr geehrte Frau' :
                         mitglied.anrede === 'Herr' ? 'Sehr geehrter Herr' :
                         'Sehr geehrte/r';

      doc.text(`${briefAnrede} ${mitglied.nachname},`)
        .moveDown(1);

      // ==========================================
      // HAUPTTEXT
      // ==========================================
      const kuendigungEingegangen = vertrag.kuendigung_eingegangen ?
        new Date(vertrag.kuendigung_eingegangen).toLocaleDateString('de-DE') :
        heute;

      const vertragsende = vertrag.vertragsende ?
        new Date(vertrag.vertragsende).toLocaleDateString('de-DE') :
        vertrag.kuendigungsdatum ?
          new Date(vertrag.kuendigungsdatum).toLocaleDateString('de-DE') :
          'zum naechstmoeglichen Termin';

      doc.text(
        `hiermit bestaetigen wir den Eingang Ihrer Kuendigung vom ${kuendigungEingegangen}.`,
        { lineGap: 4 }
      );

      doc.moveDown(0.8);

      doc.text(
        `Ihr Mitgliedsvertrag endet vertragsgemäß am ${vertragsende}.`,
        { lineGap: 4 }
      );

      doc.moveDown(0.8);

      doc.text(
        'Bis zu diesem Datum sind Sie weiterhin berechtigt, an allen Trainings und Veranstaltungen unseres Dojos teilzunehmen.',
        { lineGap: 4 }
      );

      doc.moveDown(1);

      // ==========================================
      // DETAILS BOX
      // ==========================================
      const boxY = doc.y;
      const boxHeight = 100;

      doc.rect(50, boxY, pageWidth, boxHeight)
        .fillAndStroke(COLORS.lightGray, COLORS.border);

      doc.fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Zusammenfassung:', 60, boxY + 12);

      doc.font('Helvetica')
        .fontSize(10);

      let detailY = boxY + 30;

      const details = [
        ['Vertragsnummer:', vertrag.vertragsnummer || '-'],
        ['Vertragsbeginn:', vertrag.vertragsbeginn ? new Date(vertrag.vertragsbeginn).toLocaleDateString('de-DE') : '-'],
        ['Vertragsende:', vertragsende],
        ['Kuendigung eingegangen:', kuendigungEingegangen]
      ];

      details.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(label, 60, detailY, { continued: true, width: 150 });
        doc.font('Helvetica').text(` ${value}`, { width: pageWidth - 150 });
        detailY += 16;
      });

      doc.y = boxY + boxHeight + 20;

      // ==========================================
      // HINWEISE
      // ==========================================
      doc.moveDown(0.5);

      if (vertrag.kuendigungsgrund) {
        doc.fontSize(10)
          .font('Helvetica')
          .text(`Angegebener Kuendigungsgrund: ${vertrag.kuendigungsgrund}`, { lineGap: 4 });
        doc.moveDown(0.5);
      }

      doc.text(
        'Bitte denken Sie daran, eventuelle ausgeliehene Materialien (z.B. Schluessel, Trainingsgeraete) vor Vertragsende zurueckzugeben.',
        { lineGap: 4 }
      );

      doc.moveDown(1);

      doc.text(
        'Wir bedauern, Sie als Mitglied zu verlieren, und wuerden uns freuen, Sie zu einem spaeteren Zeitpunkt wieder in unserem Dojo begruessen zu duerfen.',
        { lineGap: 4 }
      );

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

      doc.strokeColor(COLORS.primary)
        .lineWidth(1)
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

module.exports = {
  generateKuendigungsbestaetigungPDF
};
