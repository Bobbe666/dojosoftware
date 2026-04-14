const PDFDocument = require('pdfkit');

const COLORS = {
  primary:   '#CC0000',
  text:      '#1A1A1A',
  muted:     '#555555',
  lightGray: '#F5F5F5',
  border:    '#CCCCCC',
  white:     '#FFFFFF',
};

const PAGE_W    = 595.28;
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
        y = this._section('Zahlungsempfänger / Creditor', y, sy => this._creditorBody(mandateData, sy));
        y = this._section('Zahlungspflichtiger / Debtor',  y, sy => this._debtorBody(mandateData, sy));
        y = this._section('Konto-Information / Account Information', y, sy => this._bankingBody(mandateData, sy));
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

  _ensureSpace(y, needed) {
    const pageH = this.doc.page.height - MARGIN;
    if (y + needed > pageH) {
      this.doc.addPage();
      return MARGIN + 20;
    }
    return y;
  }

  /** Rote horizontale Linie */
  _rule(y, width = CONTENT_W, x = MARGIN) {
    this.doc.strokeColor(COLORS.primary).lineWidth(1.5)
      .moveTo(x, y).lineTo(x + width, y).stroke();
    return y + 8;
  }

  /**
   * Zweispaltige Label/Wert-Zeile.
   * lineBreak:false beim Label verhindert, dass pdfkit den Cursor in y vorschiebt
   * bevor der Wert in derselben Zeile gesetzt wird.
   */
  _row(label, value, x, y, labelW = 140) {
    const valW = CONTENT_W - labelW - (x - MARGIN);
    this.doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.muted)
      .text(label, x, y, { width: labelW, lineBreak: false });
    this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.text)
      .text(value || '–', x + labelW, y, { width: valW, lineBreak: false });
    return y + 16;
  }

  // ── Header ───────────────────────────────────────────────────────────────────

  _header(mandateData) {
    const doc = this.doc;

    doc.rect(0, 0, PAGE_W, 90).fill(COLORS.primary);

    doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.white)
      .text('SEPA-LASTSCHRIFTMANDAT', MARGIN, 22, { align: 'center', width: CONTENT_W, lineBreak: false });

    doc.fontSize(11).font('Helvetica').fillColor('#FFCCCC')
      .text('SEPA Direct Debit Mandate', MARGIN, 50, { align: 'center', width: CONTENT_W, lineBreak: false });

    const dojoName = mandateData.dojoname || '';
    if (dojoName) {
      doc.fontSize(9).fillColor('#FFDDDD')
        .text(dojoName, MARGIN, 72, { align: 'right', width: CONTENT_W, lineBreak: false });
    }

    doc.fillColor(COLORS.text);
    return 105;
  }

  // ── Mandat-Info Box ──────────────────────────────────────────────────────────

  _mandateInfo(mandateData, y) {
    const doc = this.doc;
    y = this._ensureSpace(y, 75);

    doc.rect(MARGIN, y, CONTENT_W, 62).fillAndStroke(COLORS.lightGray, COLORS.border);

    const erstellungsdatum = mandateData.erstellungsdatum
      ? new Date(mandateData.erstellungsdatum).toLocaleDateString('de-DE')
      : '–';

    const col1x = MARGIN + 10;
    const col2x = MARGIN + CONTENT_W / 2;
    const colW  = CONTENT_W / 2 - 20;

    // Spalte 1 — komplett mit lineBreak:false → kein y-Vorschub durch pdfkit
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted)
      .text('Gläubiger-Identifikationsnummer', col1x, y + 8,  { width: colW, lineBreak: false });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(mandateData.glaeubiger_id || '–',   col1x, y + 20, { width: colW, lineBreak: false });

    // Spalte 2 — selbe y-Positionen, kein Rücksprung nötig weil col1 keinen y-Vorschub machte
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted)
      .text('Mandatsreferenz',                   col2x, y + 8,  { width: colW, lineBreak: false });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(mandateData.mandatsreferenz || '–',  col2x, y + 20, { width: colW, lineBreak: false });

    // Unterzeile
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
      .text(`Erstellt am: ${erstellungsdatum}`, col1x, y + 44, { width: colW * 2, lineBreak: false });

    return y + 76;
  }

  // ── Generische Sektion ───────────────────────────────────────────────────────

  _section(title, y, bodyFn) {
    const doc = this.doc;
    y = this._ensureSpace(y, 50) + 8;

    // Titel
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text)
      .text(title, MARGIN, y, { width: CONTENT_W, lineBreak: false });
    y += 18;                     // fontSize(11) ≈ 14pt + 4pt Abstand
    y = this._rule(y);

    const startY = y;
    y = bodyFn(y) + 12;

    // Linker roter Akzentstreifen
    const barH = y - startY;
    if (barH > 0) {
      doc.rect(MARGIN, startY - 2, 3, barH).fill(COLORS.primary);
    }

    return y;
  }

  // ── Creditor Body ────────────────────────────────────────────────────────────

  _creditorBody(mandateData, y) {
    const x = MARGIN + 12;
    const w = CONTENT_W - 12;

    this.doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text)
      .text(mandateData.dojoname || 'Dojo Software', x, y, { width: w, lineBreak: false });
    y += 18;

    const lines = [
      mandateData.dojo_strasse && mandateData.dojo_hausnummer
        ? `${mandateData.dojo_strasse} ${mandateData.dojo_hausnummer}` : null,
      mandateData.dojo_plz && mandateData.dojo_ort
        ? `${mandateData.dojo_plz} ${mandateData.dojo_ort}` : null,
      'Deutschland',
    ].filter(Boolean);

    for (const line of lines) {
      this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
        .text(line, x, y, { width: w, lineBreak: false });
      y += 14;
    }

    if (mandateData.inhaber) {
      y += 4;
      this.doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
        .text(`Inhaber: ${mandateData.inhaber}`, x, y, { width: w, lineBreak: false });
      y += 14;
    }

    if (mandateData.sepa_glaeubiger_id) {
      this.doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
        .text(`Gläubiger-ID: ${mandateData.sepa_glaeubiger_id}`, x, y, { width: w, lineBreak: false });
      y += 14;
    }

    return y;
  }

  // ── Debtor Body ──────────────────────────────────────────────────────────────

  _debtorBody(mandateData, y) {
    const x = MARGIN + 12;
    const w = CONTENT_W - 12;

    this.doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text)
      .text(`${mandateData.vorname} ${mandateData.nachname}`, x, y, { width: w, lineBreak: false });
    y += 18;

    const lines = [
      mandateData.strasse && mandateData.hausnummer
        ? `${mandateData.strasse} ${mandateData.hausnummer}` : null,
      mandateData.plz && mandateData.ort
        ? `${mandateData.plz} ${mandateData.ort}` : null,
      'Deutschland',
    ].filter(Boolean);

    for (const line of lines) {
      this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
        .text(line, x, y, { width: w, lineBreak: false });
      y += 14;
    }

    return y;
  }

  // ── Banking Body ─────────────────────────────────────────────────────────────

  _bankingBody(mandateData, y) {
    const x    = MARGIN + 12;
    const col2 = MARGIN + CONTENT_W / 2;
    const colW = CONTENT_W / 2 - 20;

    // Labels — lineBreak:false verhindert y-Vorschub
    this.doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted)
      .text('IBAN', x,    y, { width: colW, lineBreak: false });
    this.doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.muted)
      .text('BIC',  col2, y, { width: colW, lineBreak: false });
    y += 12;

    // Werte — lineBreak:false
    this.doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(mandateData.iban || '–', x,    y, { width: colW, lineBreak: false, characterSpacing: 1 });
    this.doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(mandateData.bic  || '–', col2, y, { width: colW, lineBreak: false });
    y += 22;

    y = this._row('Kontoinhaber:', mandateData.kontoinhaber || '–', x, y);
    if (mandateData.bankname) {
      y = this._row('Bank:', mandateData.bankname, x, y);
    }

    return y;
  }

  // ── Mandatstext ──────────────────────────────────────────────────────────────

  _legalText(y) {
    y = this._ensureSpace(y, 120) + 8;

    this.doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text)
      .text('Mandatstext / Mandate Text', MARGIN, y, { width: CONTENT_W, lineBreak: false });
    y += 18;
    y = this._rule(y);

    const boxX = MARGIN + 3;
    const boxW = CONTENT_W - 3;

    const text =
      'Ich ermächtige (A) den oben genannten Zahlungsempfänger, Zahlungen von meinem Konto ' +
      'mittels Lastschrift einzuziehen. Zugleich (B) weise ich mein Kreditinstitut an, die vom ' +
      'Zahlungsempfänger auf mein Konto gezogenen Lastschriften einzulösen.\n\n' +
      'Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die ' +
      'Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut ' +
      'vereinbarten Bedingungen.';

    // Höhe zuverlässig messen: Schrift setzen BEVOR heightOfString
    this.doc.fontSize(10).font('Helvetica');
    const textH = this.doc.heightOfString(text, { width: boxW - 24, lineGap: 2 });
    const boxH  = textH + 28;

    this.doc.rect(boxX, y, boxW, boxH).fillAndStroke('#FAFAFA', COLORS.border);
    this.doc.rect(boxX, y, 3, boxH).fill(COLORS.primary);

    this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.text)
      .text(text, boxX + 14, y + 14, { width: boxW - 28, align: 'justify', lineGap: 2 });

    return y + boxH + 16;
  }

  // ── Unterschrift ─────────────────────────────────────────────────────────────

  _signatureSection(mandateData, y) {
    y = this._ensureSpace(y, 190) + 8;

    this.doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text)
      .text('Unterschrift / Signature', MARGIN, y, { width: CONTENT_W, lineBreak: false });
    y += 18;
    y = this._rule(y);
    y += 8;

    if (mandateData && mandateData.unterschrift_digital) {
      this.doc.rect(MARGIN, y, CONTENT_W, 150).fillAndStroke('#f0fff0', '#10b981');

      this.doc.fontSize(11).font('Helvetica-Bold').fillColor('#10b981')
        .text('✓ Digital unterschrieben', MARGIN + 10, y + 12, { lineBreak: false });

      try {
        const b64 = mandateData.unterschrift_digital.split(',')[1] || mandateData.unterschrift_digital;
        const buf = Buffer.from(b64, 'base64');
        this.doc.image(buf, MARGIN + 10, y + 35, { width: 280, height: 70, fit: [280, 70] });
      } catch (_) {
        this.doc.fontSize(9).fillColor('#ef4444')
          .text('(Unterschrift konnte nicht geladen werden)', MARGIN + 10, y + 40, { lineBreak: false });
      }

      let metaY = y + 115;
      if (mandateData.unterschrift_datum) {
        const d = new Date(mandateData.unterschrift_datum).toLocaleString('de-DE');
        this.doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
          .text(`Unterzeichnet am: ${d}`, MARGIN + 10, metaY, { lineBreak: false });
        metaY += 12;
      }
      if (mandateData.unterschrift_ip) {
        this.doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
          .text(`IP-Adresse: ${mandateData.unterschrift_ip}`, MARGIN + 10, metaY, { lineBreak: false });
        metaY += 12;
      }
      if (mandateData.unterschrift_hash) {
        this.doc.fontSize(7).fillColor('#9ca3af')
          .text(`Prüfsumme: ${mandateData.unterschrift_hash.substring(0, 16)}…`, MARGIN + 10, metaY, { lineBreak: false });
      }
      y += 162;

    } else {
      this.doc.rect(MARGIN, y, CONTENT_W, 130).stroke(COLORS.border);

      const lineY = y + 72;

      this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
        .text('Ort, Datum', MARGIN + 10, y + 20, { lineBreak: false });
      this.doc.strokeColor(COLORS.border).lineWidth(0.8)
        .moveTo(MARGIN + 10, lineY).lineTo(MARGIN + 185, lineY).stroke();

      this.doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
        .text('Unterschrift des Zahlungspflichtigen', MARGIN + 225, y + 20, { lineBreak: false });
      this.doc.moveTo(MARGIN + 225, lineY)
        .lineTo(MARGIN + CONTENT_W - 10, lineY).stroke();

      this.doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
        .text('Bei Minderjährigen: Unterschrift des gesetzlichen Vertreters', MARGIN + 10, y + 92, { lineBreak: false });
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
      .text('Dieses Dokument wurde automatisch generiert von Dojo Software',
        MARGIN, y + 8, { align: 'center', width: CONTENT_W, lineBreak: false });

    const gen = new Date().toLocaleString('de-DE');
    this.doc.text(`Erstellt am: ${gen}`, MARGIN, y + 19,
      { align: 'center', width: CONTENT_W, lineBreak: false });

    this.doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text('Bitte ausdrucken, unterschreiben und zurücksenden.',
        MARGIN, y + 33, { align: 'center', width: CONTENT_W, lineBreak: false });
  }
}

module.exports = SepaPdfGenerator;
