const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

class MitgliedsausweisGenerator {
  constructor() {
    this.logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  }

  /**
   * Generiert einen Mitgliedsausweis als PDF
   * @param {Object} mitglied - Mitgliedsdaten
   * @param {Object} dojo - Dojo-Daten
   * @returns {Promise<PDFDocument>} PDF-Dokument
   */
  async generateMitgliedsausweis(mitglied, dojo) {
    return new Promise((resolve, reject) => {
      try {
        // PDF-Dokument erstellen (Scheckkartenformat: 85.6mm x 53.98mm)
        const doc = new PDFDocument({
          size: [242.65, 153], // 85.6mm x 53.98mm in Punkten
          margins: { top: 10, bottom: 10, left: 10, right: 10 }
        });

        // Header mit Logo und Dojo-Name
        this._addHeader(doc, dojo);

        // Mitgliedsinformationen
        this._addMemberInfo(doc, mitglied);

        // Gültigkeitsdatum und QR-Code
        this._addValidityAndQR(doc, mitglied);

        // Finalisiere das PDF
        doc.end();

        resolve(doc);
      } catch (error) {
        console.error('[MitgliedsausweisGenerator] Fehler bei PDF-Generierung:', error);
        reject(error);
      }
    });
  }

  /**
   * Fügt den Header mit Logo und Dojo-Name hinzu
   */
  _addHeader(doc, dojo) {
    // Logo (falls vorhanden)
    if (fs.existsSync(this.logoPath)) {
      doc.image(this.logoPath, 15, 15, { width: 40 });
    }

    // Dojo-Name
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(dojo.name || 'Dojo', 60, 20);

    doc.fontSize(8)
       .font('Helvetica')
       .text(dojo.adresse || '', 60, 35);

    // Trennlinie
    doc.moveTo(15, 55)
       .lineTo(227, 55)
       .stroke();
  }

  /**
   * Fügt Mitgliedsinformationen hinzu
   */
  _addMemberInfo(doc, mitglied) {
    const startY = 65;

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('MITGLIEDSAUSWEIS', 15, startY, { align: 'center' });

    doc.fontSize(8)
       .font('Helvetica');

    // Name
    doc.font('Helvetica-Bold')
       .text('Name:', 15, startY + 15);
    doc.font('Helvetica')
       .text(`${mitglied.vorname} ${mitglied.nachname}`, 60, startY + 15);

    // Mitgliedsnummer
    doc.font('Helvetica-Bold')
       .text('Mitgl.-Nr:', 15, startY + 27);
    doc.font('Helvetica')
       .text(mitglied.mitglied_id.toString().padStart(6, '0'), 60, startY + 27);

    // Geburtsdatum
    if (mitglied.geburtsdatum) {
      doc.font('Helvetica-Bold')
         .text('Geboren:', 15, startY + 39);
      doc.font('Helvetica')
         .text(this._formatDate(mitglied.geburtsdatum), 60, startY + 39);
    }

    // Stil und Graduierung
    if (mitglied.stil) {
      doc.font('Helvetica-Bold')
         .text('Stil:', 15, startY + 51);
      doc.font('Helvetica')
         .text(mitglied.stil, 60, startY + 51);
    }

    if (mitglied.graduierung) {
      doc.font('Helvetica-Bold')
         .text('Grad:', 130, startY + 51);
      doc.font('Helvetica')
         .text(mitglied.graduierung, 155, startY + 51);
    }
  }

  /**
   * Fügt Gültigkeitsdatum hinzu
   */
  _addValidityAndQR(doc, mitglied) {
    // Gültig bis
    const gueltigBis = new Date();
    gueltigBis.setFullYear(gueltigBis.getFullYear() + 1);

    doc.fontSize(7)
       .font('Helvetica')
       .text(`Gültig bis: ${this._formatDate(gueltigBis)}`, 15, 130);

    // Unterschrift/Stempel Bereich
    doc.fontSize(6)
       .text('_____________________', 130, 125)
       .text('Unterschrift', 145, 135, { align: 'left' });
  }

  /**
   * Formatiert ein Datum
   */
  _formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }
}

module.exports = MitgliedsausweisGenerator;
