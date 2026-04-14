const PDFDocument = require('pdfkit');

const COLORS = {
  primary:   '#CC0000',   // Rot (statt Gold)
  text:      '#1A1A1A',
  muted:     '#555555',
  lightGray: '#F5F5F5',
  border:    '#CCCCCC',
  white:     '#FFFFFF',
};

const PAGE_W    = 595.28;  // A4 Breite in pt
const MARGIN    = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

class SepaPdfGenerator {
  constructor() {
    this.doc = null;
  }

  async generateSepaMandatePDF(mandateData) {
    return new Promise((resolve, reject) => {
      try {
        this.doc = new PDFDocument({
          size: 'A4',
          margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN },
          info: {
            Title:   'SEPA-Lastschriftmandat',
            Author:  'Dojo Software',
            Subject: `SEPA-Mandat für ${mandateData.vorname} ${mandateData.nachname}`,
          },
        });

        const chunks = [];
        this.doc.on('data',  c => chunks.push(c));
        this.doc.on('end',   () => resolve(Buffer.concat(chunks)));
        this.doc.on('error', reject);

        let y = this._header(mandateData);
        y = this._mandateInfo(mandateData, y);
        y = this._section('Zahlungsempfänger / Creditor', y, d => this._creditorBody(mandateData, d));
        y = this._section('Zahlungspflichtiger / Debtor',  y, d => this._debtorBody(mandateData, d));
        y = this._section('Konto-Information / Account Information', y, d => this._bankingBody(mandateData, d));
        y = this._legalText(y);
        y = this._signatureSection(mandateData, y);
        this._footer();

        this.doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ── Hilfsmethoden ────────────────────────────────────────────────────────────

  /** Gibt sicher y zurück und bricht ggf. auf neue Seite um */
  _ensureSpace(y, needed) {
    const pageH = this.doc.page.height - MARGIN;
    if (y + needed > pageH) {
      this.doc.addPage();
      return MARGIN + 20;
    }
    return y;
  }

  /** Zeichnet eine rote horizontale Linie */
  _rule(y, width = CONTENT_W, x = MARGIN) {
    this.doc.strokeColor(COLORS.primary).lineWidth(1.5)
      .moveTo(x, y).lineTo(x + width, y).stroke();
    return y + 6;
  }

  /** Zweispaltige Label/Wert Zeile */
  _row(label, value, x, y, labelW = 140) {
    this.doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.muted)
      .text(label, x, y, { width: labelW });
    this.doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text)
      .text(value || '–', x + labelW, y, { width: CONTENT_W - labelW - (x - MARGIN) });
    return y + 16;
  }

  // ── Header ───────────────────────────────────────────────────────────────────

  _header(mandateData) {
    const doc = this.doc;

    // Roter Header-Balken
    doc.rect(0, 0, PAGE_W, 90).fill(COLORS.primary);

    doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.white)
      .text('SEPA-LASTSCHRIFTMANDAT', MARGIN, 22, { align: 'center', width: CONTENT_W });

    doc.fontSize(11).font('Helvetica').fillColor('#FFCCCC')
      .text('SEPA Direct Debit Mandate', MARGIN, 52, { align: 'center', width: CONTENT_W });

    // Dojo-Name rechts unten im Header
    const dojoName = mandateData.dojoname || '';
    if (dojoName) {
      doc.fontSize(9).fillColor('#FFDDDD')
        .text(dojoName, MARGIN, 72, { align: 'right', width: CONTENT_W });
    }

    doc.fillColor(COLORS.text);
    return 105;
  }

  // ── Mandat-Info Box ──────────────────────────────────────────────────────────

  _mandateInfo(mandateData, y) {
    const doc = this.doc;
    y = this._ensureSpace(y, 70);

    // Hintergrundfläche
    doc.rect(MARGIN, y, CONTENT_W, 60).fillAndStroke(COLORS.lightGray, COLORS.border);

    const erstellungsdatum = mandateData.erstellungsdatum
      ? new Date(mandateData.erstellungsdatum).toLocaleDateString('de-DE')
      : '–';

    const col1x = MARGIN + 10;
    const col2x = MARGIN + CONTENT_W / 2;

    // Gläubiger-ID
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted)
      .text('Gläubiger-Identifikationsnummer', col1x, y + 8);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(mandateData.glaeubiger_id || '–', col1x, y + 20);

    // Mandatsreferenz
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted)
      .text('Mandatsreferenz', col2x, y + 8);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(mandateData.mandatsreferenz || '–', col2x, y + 20);

    // Erstellungsdatum
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
      .text(`Erstellt am: ${erstellungsdatum}`, col1x, y + 42);

    return y + 72;
  }

  // ── Generische Section mit Rahmen ────────────────────────────────────────────

  /**
   * Zeichnet eine benannte Sektion.
   * bodyFn(doc) gibt die Höhe des Inhalts zurück.
   */
  _section(title, y, bodyFn) {
    const doc = this.doc;
    y = this._ensureSpace(y, 40) + 8;

    // Sektion-Titel
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text)
      .text(title, MARGIN, y);
    y += 4;
    y = this._rule(y);
    y += 6;

    // bodyFn bekommt start-y, zeichnet, gibt end-y zurück
    const startY = y;
    const contentH = bodyFn(y);
    y = contentH + 12;

    // Linker roter Akzentstreifen
    doc.rect(MARGIN, startY - 2, 3, y - startY).fill(COLORS.primary);

    return y;
  }

  // ── Creditor Body ────────────────────────────────────────────────────────────

  _creditorBody(mandateData, y) {
    const x = MARGIN + 12;
    const dojoName = mandateData.dojoname || 'Dojo Software';

    this.doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text)
      .text(dojoName, x, y);
    y += 18;

    const adresse = [
      mandateData.dojo_strasse && mandateData.dojo_hausnummer
        ? `${mandateData.dojo_strasse} ${mandateData.dojo_hausnummer}`
        : null,
      mandateData.dojo_plz && mandateData.dojo_ort
        ? `${mandateData.dojo_plz} ${mandateData.dojo_ort}`
        : null,
      'Deutschland',
    ].filter(Boolean);

    adresse.forEach(line => {
      this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted).text(line, x, y);
      y += 14;
    });

    if (mandateData.inhaber) {
      y += 4;
      this.doc.fontSize(9).fillColor(COLORS.muted).text(`Inhaber: ${mandateData.inhaber}`, x, y);
      y += 14;
    }

    if (mandateData.sepa_glaeubiger_id) {
      this.doc.fontSize(9).fillColor(COLORS.muted)
        .text(`Gläubiger-ID: ${mandateData.sepa_glaeubiger_id}`, x, y);
      y += 14;
    }

    return y;
  }

  // ── Debtor Body ──────────────────────────────────────────────────────────────

  _debtorBody(mandateData, y) {
    const x = MARGIN + 12;

    this.doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text)
      .text(`${mandateData.vorname} ${mandateData.nachname}`, x, y);
    y += 18;

    const adresse = [
      mandateData.strasse && mandateData.hausnummer
        ? `${mandateData.strasse} ${mandateData.hausnummer}`
        : null,
      mandateData.plz && mandateData.ort
        ? `${mandateData.plz} ${mandateData.ort}`
        : null,
      'Deutschland',
    ].filter(Boolean);

    adresse.forEach(line => {
      this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted).text(line, x, y);
      y += 14;
    });

    return y;
  }

  // ── Banking Body ─────────────────────────────────────────────────────────────

  _bankingBody(mandateData, y) {
    const x   = MARGIN + 12;
    const col2 = MARGIN + CONTENT_W / 2;

    // IBAN / BIC nebeneinander
    this.doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted).text('IBAN', x, y);
    this.doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted).text('BIC', col2, y);
    y += 10;

    this.doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(mandateData.iban || '–', x, y, { width: CONTENT_W / 2 - 10, characterSpacing: 1 });
    this.doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(mandateData.bic || '–', col2, y);
    y += 20;

    // Kontoinhaber / Bank
    y = this._row('Kontoinhaber:', mandateData.kontoinhaber || '–', x, y);
    if (mandateData.bankname) {
      y = this._row('Bank:', mandateData.bankname, x, y);
    }

    return y;
  }

  // ── Mandat-Text ──────────────────────────────────────────────────────────────

  _legalText(y) {
    y = this._ensureSpace(y, 100) + 8;

    this.doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text)
      .text('Mandatstext / Mandate Text', MARGIN, y);
    y += 4;
    y = this._rule(y);
    y += 8;

    // Box
    const boxX = MARGIN + 3;
    const boxW = CONTENT_W - 3;

    const text =
      'Ich ermächtige (A) den oben genannten Zahlungsempfänger, Zahlungen von meinem Konto ' +
      'mittels Lastschrift einzuziehen. Zugleich (B) weise ich mein Kreditinstitut an, die vom ' +
      'Zahlungsempfänger auf mein Konto gezogenen Lastschriften einzulösen.\n\n' +
      'Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die ' +
      'Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut ' +
      'vereinbarten Bedingungen.';

    // Höhe messen
    const textH = this.doc.heightOfString(text, { width: boxW - 20, lineGap: 3 });
    const boxH  = textH + 24;

    this.doc.rect(boxX, y, boxW, boxH).fillAndStroke('#FAFAFA', COLORS.border);
    this.doc.rect(boxX, y, 3, boxH).fill(COLORS.primary);

    this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.text)
      .text(text, boxX + 14, y + 12, { width: boxW - 24, align: 'justify', lineGap: 3 });

    return y + boxH + 16;
  }

  // ── Unterschrift ─────────────────────────────────────────────────────────────

  _signatureSection(mandateData, y) {
    y = this._ensureSpace(y, 180) + 8;

    this.doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text)
      .text('Unterschrift / Signature', MARGIN, y);
    y += 4;
    y = this._rule(y);
    y += 12;

    if (mandateData && mandateData.unterschrift_digital) {
      // Digitale Unterschrift
      this.doc.rect(MARGIN, y, CONTENT_W, 150)
        .fillAndStroke('#f0fff0', '#10b981');

      this.doc.fontSize(11).font('Helvetica-Bold').fillColor('#10b981')
        .text('✓ Digital unterschrieben', MARGIN + 10, y + 12);

      try {
        const b64  = mandateData.unterschrift_digital.split(',')[1] || mandateData.unterschrift_digital;
        const buf  = Buffer.from(b64, 'base64');
        this.doc.image(buf, MARGIN + 10, y + 35, { width: 280, height: 70, fit: [280, 70] });
      } catch (_) {
        this.doc.fontSize(9).fillColor('#ef4444')
          .text('(Unterschrift konnte nicht geladen werden)', MARGIN + 10, y + 40);
      }

      let metaY = y + 115;
      if (mandateData.unterschrift_datum) {
        const d = new Date(mandateData.unterschrift_datum).toLocaleString('de-DE');
        this.doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
          .text(`Unterzeichnet am: ${d}`, MARGIN + 10, metaY);
        metaY += 12;
      }
      if (mandateData.unterschrift_ip) {
        this.doc.text(`IP-Adresse: ${mandateData.unterschrift_ip}`, MARGIN + 10, metaY);
        metaY += 12;
      }
      if (mandateData.unterschrift_hash) {
        this.doc.fontSize(7).fillColor('#9ca3af')
          .text(`Prüfsumme: ${mandateData.unterschrift_hash.substring(0, 16)}…`, MARGIN + 10, metaY);
      }
      y += 162;

    } else {
      // Manuelle Unterschrift — Felder
      this.doc.rect(MARGIN, y, CONTENT_W, 130).stroke(COLORS.border);

      const lineY = y + 70;
      // Datum-Linie
      this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
        .text('Ort, Datum', MARGIN + 10, y + 20);
      this.doc.strokeColor(COLORS.border).lineWidth(0.8)
        .moveTo(MARGIN + 10, lineY).lineTo(MARGIN + 180, lineY).stroke();

      // Unterschrifts-Linie
      this.doc.fontSize(10).fillColor(COLORS.muted)
        .text('Unterschrift des Zahlungspflichtigen', MARGIN + 220, y + 20);
      this.doc.moveTo(MARGIN + 220, lineY)
        .lineTo(MARGIN + CONTENT_W - 10, lineY).stroke();

      // Minderjährige
      this.doc.fontSize(8).fillColor(COLORS.muted)
        .text('Bei Minderjährigen: Unterschrift des gesetzlichen Vertreters', MARGIN + 10, y + 90);
      this.doc.moveTo(MARGIN + 10, y + 120)
        .lineTo(MARGIN + CONTENT_W - 10, y + 120).stroke();

      y += 142;
    }

    return y;
  }

  // ── Footer ───────────────────────────────────────────────────────────────────

  _footer() {
    const pageH = this.doc.page.height;
    const y     = pageH - 55;

    this.doc.strokeColor(COLORS.primary).lineWidth(1.5)
      .moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();

    this.doc.fontSize(7.5).font('Helvetica').fillColor('#999999')
      .text('Dieses Dokument wurde automatisch generiert von Dojo Software', MARGIN, y + 8,
        { align: 'center', width: CONTENT_W });

    const gen = new Date().toLocaleString('de-DE');
    this.doc.text(`Erstellt am: ${gen}`, MARGIN, y + 19,
      { align: 'center', width: CONTENT_W });

    this.doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text('Bitte ausdrucken, unterschreiben und zurücksenden.', MARGIN, y + 33,
        { align: 'center', width: CONTENT_W });
  }
}

module.exports = SepaPdfGenerator;
