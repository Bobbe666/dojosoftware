// ============================================================================
// URKUNDEN-PDF-GENERATOR
// Backend/utils/urkundePdfGenerator.js
// ============================================================================

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class UrkundePdfGenerator {
  /**
   * Generiert eine Prüfungsurkunde als PDF
   * @param {Object} pruefungData - Prüfungsdaten
   * @param {Object} memberData - Mitgliedsdaten
   * @param {Object} dojoData - Dojo-Daten
   * @returns {Promise<Buffer>} - PDF Buffer
   */
  async generateUrkundePDF(pruefungData, memberData, dojoData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margins: { top: 40, bottom: 40, left: 60, right: 60 }
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Hintergrund-Farbe und Rand
        doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
           .lineWidth(3)
           .strokeColor('#8b5cf6')
           .stroke();

        doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
           .lineWidth(1)
           .strokeColor('#c084fc')
           .stroke();

        // Titel
        doc.fontSize(36)
           .font('Helvetica-Bold')
           .fillColor('#1f2937')
           .text('URKUNDE', 0, 80, { align: 'center' });

        // Dojo-Name
        doc.fontSize(14)
           .font('Helvetica')
           .fillColor('#6b7280')
           .text(dojoData.dojoname || 'Dojo', 0, 130, { align: 'center' });

        // Haupttext
        doc.fontSize(18)
           .font('Helvetica')
           .fillColor('#374151')
           .text('Hiermit wird bescheinigt, dass', 0, 180, { align: 'center' });

        // Name des Mitglieds
        doc.fontSize(32)
           .font('Helvetica-Bold')
           .fillColor('#8b5cf6')
           .text(`${memberData.vorname} ${memberData.nachname}`, 0, 220, { align: 'center' });

        // Geburtsdatum
        if (memberData.geburtsdatum) {
          const gebDatum = new Date(memberData.geburtsdatum).toLocaleDateString('de-DE');
          doc.fontSize(12)
             .font('Helvetica')
             .fillColor('#9ca3af')
             .text(`geboren am ${gebDatum}`, 0, 265, { align: 'center' });
        }

        // Prüfungstext
        doc.fontSize(18)
           .font('Helvetica')
           .fillColor('#374151')
           .text('am', 0, 310, { align: 'center' });

        // Prüfungsdatum
        const pruefungsDatum = new Date(pruefungData.pruefungsdatum).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });

        doc.fontSize(20)
           .font('Helvetica-Bold')
           .fillColor('#8b5cf6')
           .text(pruefungsDatum, 0, 340, { align: 'center' });

        // Stil und Graduierung
        doc.fontSize(18)
           .font('Helvetica')
           .fillColor('#374151')
           .text('die Prüfung zum', 0, 380, { align: 'center' });

        // Graduierung mit Farbe
        const graduierung = pruefungData.graduierung_nachher || 'Graduierung';
        doc.fontSize(28)
           .font('Helvetica-Bold')
           .fillColor('#8b5cf6')
           .text(graduierung, 0, 415, { align: 'center' });

        // Stil
        if (pruefungData.stil_name) {
          doc.fontSize(16)
             .font('Helvetica')
             .fillColor('#6b7280')
             .text(`im Stil: ${pruefungData.stil_name}`, 0, 455, { align: 'center' });
        }

        // Bestanden-Status
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .fillColor('#10b981')
           .text('erfolgreich bestanden hat.', 0, 490, { align: 'center' });

        // Punktzahl (optional)
        if (pruefungData.punktzahl && pruefungData.max_punktzahl) {
          doc.fontSize(14)
             .font('Helvetica')
             .fillColor('#6b7280')
             .text(
               `Erreichte Punktzahl: ${pruefungData.punktzahl} von ${pruefungData.max_punktzahl} Punkten`,
               0,
               520,
               { align: 'center' }
             );
        }

        // Unterschriftenbereich
        const signatureY = doc.page.height - 120;
        const leftX = 100;
        const rightX = doc.page.width - 250;

        // Ort und Datum
        doc.fontSize(12)
           .font('Helvetica')
           .fillColor('#374151')
           .text(`${dojoData.ort || ''}, ${pruefungsDatum}`, leftX, signatureY);

        // Unterschriftenlinie links
        doc.moveTo(leftX, signatureY + 35)
           .lineTo(leftX + 150, signatureY + 35)
           .stroke();

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#6b7280')
           .text('Prüfer/in', leftX, signatureY + 40, { width: 150, align: 'center' });

        // Unterschriftenlinie rechts
        doc.moveTo(rightX, signatureY + 35)
           .lineTo(rightX + 150, signatureY + 35)
           .stroke();

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#6b7280')
           .text('Schulleitung', rightX, signatureY + 40, { width: 150, align: 'center' });

        // Urkunden-Nummer unten
        if (pruefungData.urkunde_nr) {
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor('#9ca3af')
             .text(
               `Urkunden-Nr.: ${pruefungData.urkunde_nr}`,
               0,
               doc.page.height - 30,
               { align: 'center' }
             );
        }

        // Finalisiere PDF
        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generiert Urkunden-Nummer
   * @param {number} pruefung_id
   * @param {number} dojo_id
   * @param {string} datum
   * @returns {string} - Urkunden-Nummer
   */
  generateUrkundenNr(pruefung_id, dojo_id, datum) {
    const jahr = new Date(datum).getFullYear();
    return `URK-${dojo_id}-${jahr}-${String(pruefung_id).padStart(6, '0')}`;
  }

  /**
   * Speichert PDF-Datei im Dateisystem
   * @param {Buffer} pdfBuffer
   * @param {string} filename
   * @returns {Promise<string>} - Dateipfad
   */
  async savePDFToFile(pdfBuffer, filename) {
    return new Promise((resolve, reject) => {
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'urkunden');

      // Stelle sicher, dass das Verzeichnis existiert
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filepath = path.join(uploadsDir, filename);

      fs.writeFile(filepath, pdfBuffer, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(filepath);
        }
      });
    });
  }
}

module.exports = UrkundePdfGenerator;
