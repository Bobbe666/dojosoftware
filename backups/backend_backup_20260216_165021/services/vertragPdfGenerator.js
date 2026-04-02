// Backend/services/vertragPdfGenerator.js
// Service für die Generierung von Mitgliedschaftsverträgen

const PDFDocument = require('pdfkit');

/**
 * Generiert einen professionellen Mitgliedschaftsvertrag
 * @param {Object} db - Datenbankverbindung
 * @param {Object} parameter - Parameter für die Vertragserstellung
 * @returns {Promise<Buffer>} - PDF als Buffer
 */
async function generateMitgliedschaftsvertragPDF(db, parameter = {}) {
  return new Promise((resolve, reject) => {
    try {
      // Hole Dojo-Informationen aus der Datenbank
      db.query('SELECT * FROM dojo LIMIT 1', async (err, dojoData) => {
        if (err) {
          return reject(err);
        }

        const dojo = dojoData[0] || {};
        const mitglied = parameter.mitglied || {};
        const vertrag = parameter.vertrag || {};

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

        // Helper-Funktion für Footer
        let pageCount = 1;
        const addFooter = () => {
          const currentY = doc.y;
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor('#666666')
             .text(
               `Seite ${pageCount}`,
               50,
               doc.page.height - 30,
               { align: 'center', width: doc.page.width - 100 }
             );

          doc.fontSize(7)
             .text(
               `${dojo.dojoname || '[Dojo]'} | ${dojo.strasse || '[Straße]'} ${dojo.hausnummer || '[Nr]'}, ${dojo.plz || '[PLZ]'} ${dojo.ort || '[Ort]'} | Tel: ${dojo.telefon || '[Tel]'} | ${dojo.email || '[E-Mail]'}`,
               50,
               doc.page.height - 20,
               { align: 'center', width: doc.page.width - 100 }
             );

          // Farbe und Position zurücksetzen
          doc.fillColor('#000000');
          doc.y = currentY;
        };

        // ========================================
        // SEITE 1: VERTRAG
        // ========================================

        // Header / Briefkopf
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text(dojo.dojoname || '[DOJO NAME]', { align: 'center' });

        doc.fontSize(10)
           .font('Helvetica')
           .text(dojo.untertitel || '[Untertitel]', { align: 'center' })
           .moveDown(0.5);

        // Kontaktdaten im Header
        const headerY = doc.y;
        doc.fontSize(8)
           .text(`${dojo.strasse || '[Straße]'} ${dojo.hausnummer || '[Nr]'}`, { align: 'center' })
           .text(`${dojo.plz || '[PLZ]'} ${dojo.ort || '[Ort]'}`, { align: 'center' })
           .text(`Tel: ${dojo.telefon || '[Telefon]'} | E-Mail: ${dojo.email || '[E-Mail]'}`, { align: 'center' })
           .text(`Web: ${dojo.internet || '[Website]'}`, { align: 'center' })
           .moveDown(1.5);

        // Trennlinie
        doc.moveTo(50, doc.y)
           .lineTo(545, doc.y)
           .stroke()
           .moveDown(1);

        // Vertragstitel
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('MITGLIEDSCHAFTSVERTRAG', { align: 'center' })
           .moveDown(0.5);

        doc.fontSize(9)
           .font('Helvetica')
           .text(`Vertragsnummer: ${vertrag.vertragsnummer || '[wird vergeben]'}`, { align: 'center' })
           .text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' })
           .moveDown(1.5);

        // § 1 VERTRAGSPARTEIEN
        addSection(doc, '§ 1 VERTRAGSPARTEIEN');

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Vertragspartner 1 (Dojo):', { continued: false })
           .font('Helvetica')
           .text(`${dojo.dojoname || '[Dojo-Name]'}`)
           .text(`${dojo.inhaber || '[Inhaber]'}`)
           .text(`${dojo.strasse || '[Straße]'} ${dojo.hausnummer || '[Nr]'}`)
           .text(`${dojo.plz || '[PLZ]'} ${dojo.ort || '[Ort]'}`)
           .moveDown(0.5);

        doc.font('Helvetica-Bold')
           .text('Vertragspartner 2 (Mitglied):', { continued: false })
           .font('Helvetica')
           .text(`${mitglied.vorname || '[Vorname]'} ${mitglied.nachname || '[Nachname]'}`)
           .text(`Geb.: ${mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : '[Geburtsdatum]'}`)
           .text(`${mitglied.strasse || '[Straße]'} ${mitglied.hausnummer || '[Nr]'}`)
           .text(`${mitglied.plz || '[PLZ]'} ${mitglied.ort || '[Ort]'}`)
           .text(`E-Mail: ${mitglied.email || '[E-Mail]'}`)
           .text(`Tel: ${mitglied.telefon || '[Telefon]'}`)
           .moveDown(1);

        // § 2 VERTRAGSGEGENSTAND
        addSection(doc, '§ 2 VERTRAGSGEGENSTAND');

        addParagraph(doc, `Der Vertragspartner 1 verpflichtet sich, dem Vertragspartner 2 die Teilnahme am Trainingsangebot im Bereich ${dojo.kampfkunst_stil || '[Kampfkunst-Stil]'} zu ermöglichen.`);

        addParagraph(doc, 'Die Teilnahme erfolgt gemäß dem jeweils gültigen Trainingsplan und den Dojo-Regeln.');

        addParagraph(doc, `Gewählte Mitgliedschaft: ${vertrag.mitgliedschaftstyp || '[Mitgliedschaftstyp]'}`);

        if (vertrag.kurse && vertrag.kurse.length > 0) {
          doc.text('Gebuchte Kurse:', { continued: false });
          vertrag.kurse.forEach(kurs => {
            doc.text(`  • ${kurs}`, { indent: 20 });
          });
        }
        doc.moveDown(1);

        // § 3 VERTRAGSLAUFZEIT
        addSection(doc, '§ 3 VERTRAGSLAUFZEIT UND KÜNDIGUNG');

        addParagraph(doc, `Vertragsbeginn: ${vertrag.vertragsbeginn || '[Datum]'}`);

        addParagraph(doc, `Mindestlaufzeit: ${dojo.mindestlaufzeit_monate || '12'} Monate`);

        addParagraph(doc, `Der Vertrag verlängert sich nach Ablauf der Mindestlaufzeit automatisch um jeweils ${dojo.verlaengerung_monate || '12'} Monate, sofern er nicht fristgerecht gekündigt wird.`);

        addParagraph(doc, `Kündigungsfrist: ${dojo.kuendigungsfrist_monate || '3'} Monate zum Ende der jeweiligen Laufzeit.`);

        addParagraph(doc, 'Die Kündigung muss schriftlich (per Brief, E-Mail oder Fax) erfolgen.');

        addParagraph(doc, `Probezeit: ${dojo.probezeit_tage || '14'} Tage ab Vertragsbeginn. Innerhalb dieser Zeit kann der Vertrag ohne Angabe von Gründen gekündigt werden.`);
        doc.moveDown(1);

        // § 4 BEITRÄGE
        addSection(doc, '§ 4 MITGLIEDSBEITRÄGE UND ZAHLUNGSMODALITÄTEN');

        addParagraph(doc, `Monatsbeitrag: ${vertrag.monatsbeitrag || '[Betrag]'} EUR`);

        if (vertrag.aufnahmegebuehr && parseFloat(vertrag.aufnahmegebuehr) > 0) {
          addParagraph(doc, `Einmalige Aufnahmegebühr: ${vertrag.aufnahmegebuehr} EUR`);
        }

        addParagraph(doc, `Zahlungsweise: ${vertrag.zahlungsweise || 'Monatlich'} per ${vertrag.zahlungsart || 'SEPA-Lastschrift'}`);

        addParagraph(doc, 'Die Beiträge sind zu Beginn des jeweiligen Monats fällig und werden automatisch per SEPA-Lastschrift eingezogen.');

        addParagraph(doc, `Mahngebühr bei Zahlungsverzug: ${dojo.mahnung_gebuehr || '5.00'} EUR`);

        addParagraph(doc, `Rückbuchungsgebühr: ${dojo.rueckbuchung_gebuehr || '10.00'} EUR`);
        doc.moveDown(1);

        // Neue Seite für weitere Paragraphen
        addFooter();
        pageCount++;
        doc.addPage();

        // § 5 RECHTE UND PFLICHTEN
        addSection(doc, '§ 5 RECHTE UND PFLICHTEN DES MITGLIEDS');

        addParagraph(doc, 'Das Mitglied hat das Recht:');
        doc.text('  • An allen im Vertrag vereinbarten Kursen teilzunehmen', { indent: 20 })
           .text('  • Die Trainingsräume und -einrichtungen während der Öffnungszeiten zu nutzen', { indent: 20 })
           .text('  • Aktuelle Informationen über Trainingszeiten und Änderungen zu erhalten', { indent: 20 })
           .moveDown(0.5);

        addParagraph(doc, 'Das Mitglied verpflichtet sich:');
        doc.text('  • Die Dojo-Regeln und Hausordnung einzuhalten', { indent: 20 })
           .text('  • Pünktlich und regelmäßig am Training teilzunehmen', { indent: 20 })
           .text('  • Respektvoll gegenüber Trainern und anderen Mitgliedern zu sein', { indent: 20 })
           .text('  • Die Trainingsräume sauber und ordentlich zu hinterlassen', { indent: 20 })
           .text('  • Änderungen der persönlichen Daten unverzüglich mitzuteilen', { indent: 20 })
           .moveDown(1);

        // § 6 HAFTUNG
        addSection(doc, '§ 6 HAFTUNG UND VERSICHERUNG');

        addParagraph(doc, 'Die Teilnahme am Training erfolgt auf eigene Gefahr. Das Dojo haftet nicht für Unfälle oder Verletzungen während des Trainings, außer bei grober Fahrlässigkeit oder Vorsatz.');

        addParagraph(doc, 'Jedes Mitglied ist verpflichtet, eine eigene Sportversicherung abzuschließen.');

        addParagraph(doc, 'Das Dojo haftet nicht für den Verlust oder die Beschädigung persönlicher Gegenstände.');
        doc.moveDown(1);

        // § 7 DATENSCHUTZ
        addSection(doc, '§ 7 DATENSCHUTZ (DSGVO)');

        addParagraph(doc, 'Die Verarbeitung personenbezogener Daten erfolgt ausschließlich zur Vertragsabwicklung und gemäß der Datenschutz-Grundverordnung (DSGVO).');

        addParagraph(doc, 'Das Mitglied willigt ein, dass folgende Daten gespeichert werden:');
        doc.text('  • Name, Anschrift, Geburtsdatum', { indent: 20 })
           .text('  • Kontaktdaten (Telefon, E-Mail)', { indent: 20 })
           .text('  • Bankverbindung (für SEPA-Lastschrift)', { indent: 20 })
           .text('  • Trainingshistorie und Prüfungsergebnisse', { indent: 20 })
           .moveDown(0.5);

        addParagraph(doc, 'Die Datenschutzerklärung ist Bestandteil dieses Vertrags und kann jederzeit auf unserer Website eingesehen werden.');

        addParagraph(doc, `Datenschutzbeauftragter: ${dojo.dsgvo_beauftragte || '[Name]'}`);
        doc.moveDown(1);

        // § 8 BESONDERE VEREINBARUNGEN
        addSection(doc, '§ 8 BESONDERE VEREINBARUNGEN');

        if (mitglied.gesundheitliche_einschraenkungen) {
          addParagraph(doc, `Gesundheitliche Einschränkungen: ${mitglied.gesundheitliche_einschraenkungen}`);
        } else {
          addParagraph(doc, 'Keine besonderen gesundheitlichen Einschränkungen bekannt.');
        }

        if (vertrag.besonderheiten) {
          addParagraph(doc, `Weitere Vereinbarungen: ${vertrag.besonderheiten}`);
        }
        doc.moveDown(1);

        // Neue Seite für AGB und Unterschriften
        addFooter();
        pageCount++;
        doc.addPage();

        // § 9 ALLGEMEINE GESCHÄFTSBEDINGUNGEN
        addSection(doc, '§ 9 ALLGEMEINE GESCHÄFTSBEDINGUNGEN');

        addParagraph(doc, 'Die Allgemeinen Geschäftsbedingungen (AGB) des Dojos sind Bestandteil dieses Vertrags.');

        if (dojo.agb_text && dojo.agb_text.length > 100) {
          doc.fontSize(8)
             .text(dojo.agb_text.substring(0, 500) + '...', { align: 'justify' })
             .fontSize(10);
        } else {
          addParagraph(doc, '[Die vollständigen AGB werden separat ausgehändigt bzw. können auf der Website eingesehen werden.]');
        }
        doc.moveDown(1);

        // § 10 WIDERRUFSBELEHRUNG
        addSection(doc, '§ 10 WIDERRUFSBELEHRUNG');

        addParagraph(doc, 'WIDERRUFSRECHT:');
        addParagraph(doc, 'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.');

        addParagraph(doc, 'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.');

        addParagraph(doc, 'Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.');

        addParagraph(doc, `Widerrufsadresse:\n${dojo.dojoname || '[Dojo-Name]'}\n${dojo.strasse || '[Straße]'} ${dojo.hausnummer || '[Nr]'}\n${dojo.plz || '[PLZ]'} ${dojo.ort || '[Ort]'}\nE-Mail: ${dojo.email || '[E-Mail]'}`);
        doc.moveDown(2);

        // § 11 SCHLUSSBESTIMMUNGEN
        addSection(doc, '§ 11 SCHLUSSBESTIMMUNGEN');

        addParagraph(doc, 'Änderungen und Ergänzungen dieses Vertrags bedürfen der Schriftform.');

        addParagraph(doc, 'Sollten einzelne Bestimmungen dieses Vertrags unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen hiervon unberührt.');

        addParagraph(doc, 'Es gilt deutsches Recht.');
        doc.moveDown(3);

        // UNTERSCHRIFTEN
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('UNTERSCHRIFTEN', { align: 'center' })
           .moveDown(1);

        // Unterschriftenfelder nebeneinander
        const signatureY = doc.y;
        const leftX = 80;
        const rightX = 350;

        // Linke Unterschrift (Dojo)
        doc.font('Helvetica')
           .fontSize(10);

        doc.text(`${dojo.ort || '[Ort]'}, ${new Date().toLocaleDateString('de-DE')}`, leftX, signatureY, { width: 200 });
        doc.moveTo(leftX, signatureY + 60)
           .lineTo(leftX + 180, signatureY + 60)
           .stroke();
        doc.text('Unterschrift Dojo / Trainer', leftX, signatureY + 65, { width: 200, align: 'center' });
        doc.text(`(${dojo.inhaber || '[Inhaber]'})`, leftX, signatureY + 80, { width: 200, align: 'center' });

        // Rechte Unterschrift (Mitglied)
        doc.text(`${mitglied.ort || '[Ort]'}, _______________`, rightX, signatureY, { width: 200 });
        doc.moveTo(rightX, signatureY + 60)
           .lineTo(rightX + 180, signatureY + 60)
           .stroke();
        doc.text('Unterschrift Mitglied', rightX, signatureY + 65, { width: 200, align: 'center' });
        doc.text(`(${mitglied.vorname || '[Vorname]'} ${mitglied.nachname || '[Nachname]'})`, rightX, signatureY + 80, { width: 200, align: 'center' });

        doc.moveDown(5);

        // Minderjährige - Unterschrift des gesetzlichen Vertreters
        if (mitglied.minderjaehrig || (mitglied.geburtsdatum && calculateAge(mitglied.geburtsdatum) < 18)) {
          doc.moveDown(2);
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .text('Gesetzlicher Vertreter (bei Minderjährigen):', { align: 'center' })
             .moveDown(0.5);

          const guardianY = doc.y;
          doc.font('Helvetica')
             .text(`Name: ${mitglied.gesetzlicher_vertreter_name || '_'.repeat(50)}`, 80, guardianY);
          doc.moveTo(150, guardianY + 40)
             .lineTo(480, guardianY + 40)
             .stroke();
          doc.text('Unterschrift gesetzlicher Vertreter', 80, guardianY + 45, { width: 400, align: 'center' });
        }

        // SEPA-Lastschriftmandat (neue Seite)
        addFooter();
        pageCount++;
        doc.addPage();

        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('SEPA-LASTSCHRIFTMANDAT', { align: 'center' })
           .moveDown(1);

        doc.fontSize(10)
           .font('Helvetica')
           .text(`Gläubiger-Identifikationsnummer: ${dojo.sepa_glaeubiger_id || '[wird vergeben]'}`)
           .text(`Mandatsreferenz: ${vertrag.mandatsreferenz || '[wird vergeben]'}`)
           .moveDown(1);

        addParagraph(doc, 'Ich ermächtige den oben genannten Zahlungsempfänger, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die vom Zahlungsempfänger auf mein Konto gezogenen Lastschriften einzulösen.');

        addParagraph(doc, 'Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.');
        doc.moveDown(1);

        doc.font('Helvetica-Bold')
           .text('Kontoinhaber:', { continued: false })
           .font('Helvetica')
           .text(mitglied.kontoinhaber || `${mitglied.vorname || '[Vorname]'} ${mitglied.nachname || '[Nachname]'}`)
           .moveDown(0.5);

        doc.font('Helvetica-Bold')
           .text('IBAN:', { continued: false })
           .font('Helvetica')
           .text(mitglied.iban || '_'.repeat(34))
           .moveDown(0.5);

        doc.font('Helvetica-Bold')
           .text('BIC:', { continued: false })
           .font('Helvetica')
           .text(mitglied.bic || '_'.repeat(11))
           .moveDown(0.5);

        doc.font('Helvetica-Bold')
           .text('Kreditinstitut:', { continued: false })
           .font('Helvetica')
           .text(mitglied.bank || '_'.repeat(40))
           .moveDown(2);

        const sepaY = doc.y;
        doc.text(`${mitglied.ort || '[Ort]'}, _______________`, 80, sepaY);
        doc.moveTo(80, sepaY + 60)
           .lineTo(260, sepaY + 60)
           .stroke();
        doc.text('Datum', 80, sepaY + 65, { width: 180, align: 'center' });

        doc.text('', 350, sepaY);
        doc.moveTo(350, sepaY + 60)
           .lineTo(530, sepaY + 60)
           .stroke();
        doc.text('Unterschrift Kontoinhaber', 350, sepaY + 65, { width: 180, align: 'center' });

        // Footer auf letzter Seite hinzufügen
        addFooter();

        doc.end();
      });

    } catch (error) {
      reject(error);
    }
  });
}

// Hilfsfunktionen
function addSection(doc, title) {
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text(title, { continued: false })
     .moveDown(0.5);
}

function addParagraph(doc, text, options = {}) {
  doc.fontSize(10)
     .font('Helvetica')
     .text(text, { align: 'justify', ...options })
     .moveDown(0.5);
}

function calculateAge(birthdate) {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

module.exports = {
  generateMitgliedschaftsvertragPDF
};
