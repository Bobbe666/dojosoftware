// Vertrags-PDF-Generator mit rechtssicheren Feldern
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generiert ein Vertrags-PDF mit allen rechtlichen Elementen
 * @param {Object} vertrag - Vertragsdaten
 * @param {Object} mitglied - Mitgliedsdaten
 * @param {Object} dojo - Dojo-Daten
 * @param {Object} dokumente - AGB, Datenschutz, etc.
 * @param {Object} sepaMandat - SEPA-Mandat (optional)
 * @returns {Buffer} PDF als Buffer
 */
function generateVertragPDF(vertrag, mitglied, dojo, dokumente = {}, sepaMandat = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Mitgliedsvertrag - ${mitglied.vorname} ${mitglied.nachname}`,
          Author: dojo.dojoname,
          Subject: 'Mitgliedsvertrag',
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

      // HEADER: Dojo-Informationen
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(dojo.dojoname, { align: 'center' })
        .fontSize(10)
        .font('Helvetica')
        .moveDown(0.3);

      if (dojo.strasse && dojo.ort) {
        doc.text(`${dojo.strasse} ${dojo.hausnummer}, ${dojo.plz} ${dojo.ort}`, { align: 'center' });
      }
      if (dojo.telefon) {
        doc.text(`Tel: ${dojo.telefon}`, { align: 'center' });
      }
      if (dojo.email) {
        doc.text(`E-Mail: ${dojo.email}`, { align: 'center' });
      }

      doc.moveDown(2);

      // TITEL
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('MITGLIEDSVERTRAG', { align: 'center', underline: true })
        .moveDown(1.5);

      // VERTRAGSNUMMER
      if (vertrag.vertragsnummer) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(`Vertragsnummer: ${vertrag.vertragsnummer}`, { align: 'right' })
          .moveDown(1);
      }

      // VERTRAGSPARTEIEN
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('§1 Vertragsparteien')
        .moveDown(0.5)
        .fontSize(10)
        .font('Helvetica');

      doc.text('Dieser Vertrag wird geschlossen zwischen:');
      doc.moveDown(0.5);

      // Dojo-Info
      doc
        .font('Helvetica-Bold')
        .text(dojo.dojoname)
        .font('Helvetica')
        .text(`${dojo.strasse || ''} ${dojo.hausnummer || ''}`)
        .text(`${dojo.plz || ''} ${dojo.ort || ''}`)
        .text(`Vertreten durch: ${dojo.inhaber || ''}`)
        .moveDown(0.3)
        .text('– nachfolgend "Verein" genannt –')
        .moveDown(1);

      doc.text('und');
      doc.moveDown(0.5);

      // Mitglied-Info
      doc
        .font('Helvetica-Bold')
        .text(`${mitglied.vorname} ${mitglied.nachname}`)
        .font('Helvetica')
        .text(`${mitglied.adresse || ''}`)
        .text(`Geburtsdatum: ${mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : 'N/A'}`)
        .moveDown(0.3)
        .text('– nachfolgend "Mitglied" genannt –')
        .moveDown(2);

      // VERTRAGSLAUFZEIT & KÜNDIGUNG
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('§2 Vertragslaufzeit & Kündigung')
        .moveDown(0.5)
        .fontSize(10)
        .font('Helvetica');

      const kuendigungsfrist = vertrag.kuendigungsfrist_monate || 3;
      const vertragsende = vertrag.vertragsende ? new Date(vertrag.vertragsende) : null;
      const vertragsbeginn = vertrag.vertragsbeginn ? new Date(vertrag.vertragsbeginn).toLocaleDateString('de-DE') : 'N/A';
      const vertragsende_str = vertragsende ? vertragsende.toLocaleDateString('de-DE') : 'N/A';

      // Berechne Kündigungsdatum
      let kuendigungBisDatum = 'N/A';
      if (vertragsende) {
        const kuendigungBis = new Date(vertragsende);
        kuendigungBis.setMonth(kuendigungBis.getMonth() - kuendigungsfrist);
        kuendigungBisDatum = kuendigungBis.toLocaleDateString('de-DE');
      }

      doc.text(`Vertragsbeginn: ${vertragsbeginn}`);
      doc.text(`Vertragsende: ${vertragsende_str}`);
      doc.text(`Mindestlaufzeit: ${vertrag.mindestlaufzeit_monate || 12} Monate`);
      doc.text(`Kündigungsfrist: ${kuendigungsfrist} Monate zum Vertragsende`);

      if (vertragsende) {
        doc.text(`Kündigungstermin (spätestens): ${kuendigungBisDatum}`);
      }

      if (vertrag.automatische_verlaengerung) {
        doc.moveDown(0.5);
        doc.text(`Automatische Verlängerung: Ja, um ${vertrag.verlaengerung_monate || 12} Monate`);
        doc.text(`Falls nicht fristgerecht gekündigt, verlängert sich der Vertrag automatisch.`);
      } else {
        doc.moveDown(0.5);
        doc.text(`Automatische Verlängerung: Nein`);
      }

      doc.moveDown(2);

      // NEUE SEITE für Rechtliche Akzeptanzen
      doc.addPage();

      // RECHTLICHE AKZEPTANZEN
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('§3 Rechtliche Dokumente & Einverständniserklärungen')
        .moveDown(0.5)
        .fontSize(10)
        .font('Helvetica');

      doc.text('Das Mitglied bestätigt die Kenntnisnahme und Akzeptanz folgender Dokumente:');
      doc.moveDown(0.5);

      // AGB
      if (vertrag.agb_akzeptiert_am) {
        doc
          .font('Helvetica-Bold')
          .text(`✓ AGB (Version ${vertrag.agb_version || '1.0'})`)
          .font('Helvetica')
          .text(`   Akzeptiert am: ${new Date(vertrag.agb_akzeptiert_am).toLocaleString('de-DE')}`)
          .moveDown(0.5);
      }

      // Datenschutz
      if (vertrag.datenschutz_akzeptiert_am) {
        doc
          .font('Helvetica-Bold')
          .text(`✓ Datenschutzerklärung (Version ${vertrag.datenschutz_version || '1.0'})`)
          .font('Helvetica')
          .text(`   Akzeptiert am: ${new Date(vertrag.datenschutz_akzeptiert_am).toLocaleString('de-DE')}`)
          .moveDown(0.5);
      }

      // Hausordnung
      if (vertrag.hausordnung_akzeptiert_am) {
        doc
          .font('Helvetica-Bold')
          .text('✓ Hausordnung')
          .font('Helvetica')
          .text(`   Akzeptiert am: ${new Date(vertrag.hausordnung_akzeptiert_am).toLocaleString('de-DE')}`)
          .moveDown(0.5);
      }

      // Haftungsausschluss
      if (vertrag.haftungsausschluss_datum) {
        doc
          .font('Helvetica-Bold')
          .text('✓ Haftungsausschluss')
          .font('Helvetica')
          .text(`   Akzeptiert am: ${new Date(vertrag.haftungsausschluss_datum).toLocaleString('de-DE')}`)
          .moveDown(0.5);
      }

      // Gesundheitserklärung
      if (vertrag.gesundheitserklaerung_datum) {
        doc
          .font('Helvetica-Bold')
          .text('✓ Gesundheitliche Eignung bestätigt')
          .font('Helvetica')
          .text(`   Bestätigt am: ${new Date(vertrag.gesundheitserklaerung_datum).toLocaleString('de-DE')}`)
          .moveDown(0.5);
      }

      // Foto-Einverständnis
      if (vertrag.foto_einverstaendnis_datum) {
        doc
          .font('Helvetica-Bold')
          .text('✓ Foto/Video-Einwilligung')
          .font('Helvetica')
          .text(`   Erteilt am: ${new Date(vertrag.foto_einverstaendnis_datum).toLocaleString('de-DE')}`)
          .moveDown(0.5);
      }

      doc.moveDown(2);

      // ZAHLUNGSBEDINGUNGEN
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('§4 Zahlungsbedingungen')
        .moveDown(0.5)
        .fontSize(10)
        .font('Helvetica');

      const zahlungsmethoden = {
        'bank_transfer': 'Banküberweisung',
        'direct_debit': 'SEPA-Lastschrift',
        'credit_card': 'Kreditkarte',
        'cash': 'Barzahlung'
      };

      doc.text(`Zahlungsmethode: ${zahlungsmethoden[vertrag.payment_method] || vertrag.payment_method}`);
      doc.text(`Fälligkeit: Zum ${vertrag.faelligkeit_tag || 1}. des Monats`);

      if (vertrag.payment_method === 'direct_debit' && sepaMandat) {
        doc.moveDown(0.5);
        doc
          .font('Helvetica-Bold')
          .text('SEPA-Mandat:')
          .font('Helvetica')
          .text(`Mandatsreferenz: ${sepaMandat.mandatsreferenz}`)
          .text(`IBAN: ${sepaMandat.iban}`)
          .text(`Gläubiger-ID: ${sepaMandat.glaeubiger_id}`);
      }

      if (vertrag.rabatt_prozent && vertrag.rabatt_prozent > 0) {
        doc.moveDown(0.5);
        doc
          .font('Helvetica-Bold')
          .text(`Rabatt: ${vertrag.rabatt_prozent}%`)
          .font('Helvetica');
        if (vertrag.rabatt_grund) {
          doc.text(`Grund: ${vertrag.rabatt_grund}`);
        }
      }

      doc.moveDown(2);

      // UNTERSCHRIFT
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('§5 Unterschrift')
        .moveDown(0.5)
        .fontSize(10)
        .font('Helvetica');

      if (vertrag.unterschrift_datum) {
        doc.text(`Unterzeichnet am: ${new Date(vertrag.unterschrift_datum).toLocaleString('de-DE')}`);
        if (vertrag.unterschrift_ip) {
          doc.text(`IP-Adresse: ${vertrag.unterschrift_ip}`);
        }
        doc.moveDown(1);

        // Digitale Unterschrift (falls vorhanden)
        if (vertrag.unterschrift_digital) {
          try {
            const signatureBuffer = Buffer.from(vertrag.unterschrift_digital.split(',')[1], 'base64');
            doc.text('Digitale Unterschrift:');
            doc.image(signatureBuffer, { width: 200, height: 60 });
          } catch (err) {
            doc.text('(Digitale Unterschrift konnte nicht geladen werden)');
          }
        }
      } else {
        doc.text('Noch nicht unterzeichnet.');
      }

      doc.moveDown(2);

      // Kündigungshinweis am Ende (dezent)
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('────────────────────────────────────────────────────────────────────────', { align: 'center' })
        .moveDown(0.5)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('HINWEIS ZUR KÜNDIGUNGSFRIST:', { align: 'left' })
        .font('Helvetica')
        .text(`Die Kündigungsfrist von ${kuendigungsfrist} Monaten bezieht sich auf das Vertragsende (${vertragsende_str}), `, { continued: true })
        .text('nicht auf die Mindestlaufzeit. Die Kündigung muss spätestens ', { continued: true })
        .text(`${kuendigungsfrist} Monate vor dem Vertragsende beim Verein eingehen.`, { continued: false })
        .fillColor('#000000');

      doc.moveDown(1);

      // FOOTER
      const bottomY = doc.page.height - 80;
      doc
        .fontSize(8)
        .text('_'.repeat(100), 50, bottomY, { width: doc.page.width - 100 })
        .moveDown(0.3)
        .text(`Generiert am: ${new Date().toLocaleString('de-DE')}`, { align: 'center' })
        .text('Erstellt mit DojoSoftware', { align: 'center' });

      // PDF abschließen
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateVertragPDF };
