const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Farbschema passend zur Software (Gold/Schwarz/Weiß)
const COLORS = {
  primary: '#FFD700',      // Gold
  secondary: '#FFA500',    // Orange-Gold
  text: '#1A1A1A',         // Dunkelgrau/Schwarz
  lightGray: '#F5F5F5',    // Hellgrau
  border: '#CCCCCC',       // Grau für Rahmen
  accent: '#000000'        // Schwarz für Akzente
};

class SepaPdfGenerator {
  constructor() {
    this.doc = null;
  }

  async generateSepaMandatePDF(mandateData) {
    return new Promise((resolve, reject) => {
      try {
        // Neues PDF-Dokument erstellen
        this.doc = new PDFDocument({ 
          size: 'A4', 
          margins: { top: 50, left: 50, right: 50, bottom: 50 },
          info: {
            Title: 'SEPA-Lastschriftmandat',
            Author: 'Dojo Software',
            Subject: `SEPA-Mandat für ${mandateData.vorname} ${mandateData.nachname}`,
            Keywords: 'SEPA, Lastschrift, Mandat, Dojo'
          }
        });

        const chunks = [];
        
        // PDF-Chunks sammeln
        this.doc.on('data', chunk => chunks.push(chunk));
        this.doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        this.doc.on('error', reject);

        // PDF-Inhalt generieren
        this.generateHeader();
        this.generateMandateInfo(mandateData);
        this.generateCreditorInfo();
        this.generateDebtorInfo(mandateData);
        this.generateBankingInfo(mandateData);
        this.generateLegalText();
        this.generateSignatureSection();
        this.generateFooter();

        // PDF finalisieren
        this.doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  generateHeader() {
    const y = 50;
    
    // Hintergrund-Rechteck für Header
    this.doc.rect(0, 0, this.doc.page.width, 120)
      .fill(COLORS.primary)
      .fill(COLORS.text);

    // Haupttitel
    this.doc.fontSize(24)
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .text('SEPA-LASTSCHRIFTMANDAT', 50, y, { 
        align: 'center',
        width: this.doc.page.width - 100
      });

    // Untertitel
    this.doc.fontSize(12)
      .font('Helvetica')
      .fillColor(COLORS.text)
      .text('SEPA Direct Debit Mandate', 50, y + 35, { 
        align: 'center',
        width: this.doc.page.width - 100
      });

    // Goldene Trennlinie
    this.doc.strokeColor(COLORS.primary)
      .lineWidth(3)
      .moveTo(50, y + 60)
      .lineTo(this.doc.page.width - 50, y + 60)
      .stroke();

    // Reset für nachfolgende Inhalte
    this.doc.fillColor(COLORS.text);
    return y + 80;
  }

  generateMandateInfo(mandateData) {
    let y = 150;

    // Info-Box mit Mandat-Details
    this.doc.rect(50, y, this.doc.page.width - 100, 80)
      .fillAndStroke(COLORS.lightGray, COLORS.border);

    y += 15;

    // Gläubiger-Identifikationsnummer
    this.doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('Gläubiger-Identifikationsnummer / Creditor Identifier:', 60, y);
    
    this.doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(COLORS.primary)
      .text(mandateData.glaeubiger_id, 60, y + 12);

    // Mandatsreferenz
    this.doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('Mandatsreferenz / Mandate Reference:', 300, y);
    
    this.doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(COLORS.primary)
      .text(mandateData.mandatsreferenz, 300, y + 12);

    y += 50;

    // Erstellungsdatum
    const erstellungsdatum = new Date(mandateData.erstellungsdatum).toLocaleDateString('de-DE');
    this.doc.fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.text)
      .text(`Erstellt am: ${erstellungsdatum}`, 60, y);

    return y + 30;
  }

  generateCreditorInfo(mandateData) {
    let y = 260;

    // Überschrift
    this.doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('Zahlungsempfänger / Creditor:', 50, y);

    y += 25;

    // Rahmen für Zahlungsempfänger
    this.doc.rect(50, y, this.doc.page.width - 100, 100)
      .stroke(COLORS.border);

    y += 15;

    // Firmeninformationen aus Dojo-Daten
    const dojoName = mandateData.dojoname || 'Kampfkunstschule Dojo Software';
    this.doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text(dojoName, 60, y);

    y += 20;
    
    // Adresse aus Dojo-Daten
    if (mandateData.dojo_strasse && mandateData.dojo_hausnummer) {
      this.doc.fontSize(11)
        .font('Helvetica')
        .text(`${mandateData.dojo_strasse} ${mandateData.dojo_hausnummer}`, 60, y);
      y += 15;
    }

    if (mandateData.dojo_plz && mandateData.dojo_ort) {
      this.doc.text(`${mandateData.dojo_plz} ${mandateData.dojo_ort}`, 60, y);
      y += 15;
    }

    this.doc.text('Deutschland', 60, y);

    // Inhaber/Ansprechpartner falls vorhanden
    if (mandateData.inhaber) {
      y += 20;
      this.doc.fontSize(10)
        .fillColor('#666666')
        .text(`Inhaber: ${mandateData.inhaber}`, 60, y);
    }

    return y + 40;
  }

  generateDebtorInfo(mandateData) {
    let y = 410;

    // Überschrift
    this.doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('Zahlungspflichtiger / Debtor:', 50, y);

    y += 25;

    // Rahmen für Zahlungspflichtigen
    this.doc.rect(50, y, this.doc.page.width - 100, 100)
      .stroke(COLORS.border);

    y += 15;

    // Name
    this.doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text(`${mandateData.vorname} ${mandateData.nachname}`, 60, y);

    y += 20;

    // Adresse
    const adresse = `${mandateData.strasse || ''} ${mandateData.hausnummer || ''}`.trim();
    if (adresse) {
      this.doc.fontSize(11)
        .font('Helvetica')
        .text(adresse, 60, y);
      y += 15;
    }

    // PLZ und Ort
    const plzOrt = `${mandateData.plz || ''} ${mandateData.ort || ''}`.trim();
    if (plzOrt) {
      this.doc.text(plzOrt, 60, y);
      y += 15;
    }

    this.doc.text('Deutschland', 60, y);

    return y + 40;
  }

  generateBankingInfo(mandateData) {
    let y = 560;

    // Überschrift
    this.doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('Konto-Information / Account Information:', 50, y);

    y += 25;

    // Rahmen für Kontoinformationen
    this.doc.rect(50, y, this.doc.page.width - 100, 80)
      .fillAndStroke(COLORS.lightGray, COLORS.border);

    y += 15;

    // IBAN
    this.doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('IBAN:', 60, y);
    
    this.doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(COLORS.primary)
      .text(mandateData.iban || '', 60, y + 12);

    // BIC
    this.doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('BIC:', 350, y);
    
    this.doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(COLORS.primary)
      .text(mandateData.bic || '', 350, y + 12);

    y += 40;

    // Kontoinhaber und Bank
    this.doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('Kontoinhaber:', 60, y);
    
    this.doc.fontSize(11)
      .font('Helvetica')
      .text(mandateData.kontoinhaber || '', 60, y + 12);

    if (mandateData.bankname) {
      this.doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(COLORS.text)
        .text('Bank:', 350, y);
      
      this.doc.fontSize(11)
        .font('Helvetica')
        .text(mandateData.bankname, 350, y + 12);
    }

    return y + 50;
  }

  generateLegalText() {
    let y = 700;

    // Überschrift
    this.doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('Mandatstext / Mandate Text:', 50, y);

    y += 20;

    // Rahmen für rechtlichen Text
    this.doc.rect(50, y, this.doc.page.width - 100, 120)
      .fillAndStroke('#FAFAFA', COLORS.border);

    y += 10;

    // Haupttext des Mandats
    const mandatText = `Ich ermächtige (A) den oben genannten Zahlungsempfänger, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich (B) weise ich mein Kreditinstitut an, die vom Zahlungsempfänger auf mein Konto gezogenen Lastschriften einzulösen.

Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.`;

    this.doc.fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.text)
      .text(mandatText, 60, y, {
        width: this.doc.page.width - 120,
        align: 'justify',
        lineGap: 3
      });

    // Neue Seite für Unterschrift
    this.doc.addPage();
  }

  generateSignatureSection() {
    let y = 100;

    // Überschrift
    this.doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(COLORS.text)
      .text('Unterschrift / Signature:', 50, y);

    y += 40;

    // Rahmen für Unterschriften
    this.doc.rect(50, y, this.doc.page.width - 100, 200)
      .stroke(COLORS.border);

    y += 20;

    // Datum
    this.doc.fontSize(11)
      .font('Helvetica')
      .fillColor(COLORS.text)
      .text('Ort, Datum / Place, Date:', 60, y);

    // Linie für Datum
    this.doc.strokeColor(COLORS.border)
      .lineWidth(1)
      .moveTo(60, y + 40)
      .lineTo(250, y + 40)
      .stroke();

    // Unterschrift Zahlungspflichtiger
    this.doc.text('Unterschrift des Zahlungspflichtigen / Signature of Debtor:', 300, y);

    // Linie für Unterschrift
    this.doc.moveTo(300, y + 40)
      .lineTo(this.doc.page.width - 60, y + 40)
      .stroke();

    y += 80;

    // Zusätzliche Unterschrift (z.B. für Minderjährige)
    this.doc.fontSize(10)
      .fillColor('#666666')
      .text('Bei Minderjährigen: Unterschrift des gesetzlichen Vertreters:', 60, y);

    // Linie für zusätzliche Unterschrift
    this.doc.strokeColor(COLORS.border)
      .moveTo(60, y + 30)
      .lineTo(this.doc.page.width - 60, y + 30)
      .stroke();

    return y + 60;
  }

  generateFooter() {
    const y = this.doc.page.height - 80;

    // Trennlinie
    this.doc.strokeColor(COLORS.primary)
      .lineWidth(2)
      .moveTo(50, y)
      .lineTo(this.doc.page.width - 50, y)
      .stroke();

    // Footer-Text
    this.doc.fontSize(8)
      .font('Helvetica')
      .fillColor('#888888')
      .text('Dieses Dokument wurde automatisch generiert von Dojo Software', 50, y + 10, {
        align: 'center',
        width: this.doc.page.width - 100
      });

    // Generierungszeitpunkt
    const generatedAt = new Date().toLocaleString('de-DE');
    this.doc.text(`Erstellt am: ${generatedAt}`, 50, y + 25, {
      align: 'center',
      width: this.doc.page.width - 100
    });

    // Wichtiger Hinweis
    this.doc.fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(COLORS.primary)
      .text('⚠️ Wichtig: Bitte drucken Sie dieses Dokument aus, unterschreiben Sie es und senden Sie es zurück.', 50, y + 45, {
        align: 'center',
        width: this.doc.page.width - 100
      });
  }
}

module.exports = SepaPdfGenerator;