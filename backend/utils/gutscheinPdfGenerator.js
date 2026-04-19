/**
 * gutscheinPdfGenerator.js
 * Erstellt ein PDF für einen Gutschein (PDFKit)
 */
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const GOLD    = '#C9A227';
const BLACK   = '#111111';
const DARK    = '#1A1A2E';
const WHITE   = '#FFFFFF';
const MUTED   = '#666666';
const LIGHT   = '#F8F8F8';

const W       = 595.28;   // A4 portrait width
const H       = 841.89;
const MARGIN  = 48;
const CW      = W - MARGIN * 2;

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/**
 * Erzeugt den PDF-Buffer für einen Gutschein.
 * @param {object} gutschein  - Zeile aus gutscheine JOIN gutschein_vorlagen JOIN dojo
 * @returns {Promise<Buffer>}
 */
function generateGutscheinPdf(gutschein) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, left: 0, right: 0, bottom: 0 },
        info: {
          Title:   `Gutschein ${gutschein.code}`,
          Author:  gutschein.dojoname || 'Kampfkunstschule',
          Subject: `Gutschein ${gutschein.wert} EUR`,
        },
      });

      const chunks = [];
      doc.on('data',  c => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      _render(doc, gutschein);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function _render(doc, g) {
  const imageH = 240;

  // ── Bild-Header ────────────────────────────────────────────────────────────
  const imagePath = path.join(UPLOADS_DIR, g.bild_pfad);
  if (fs.existsSync(imagePath)) {
    doc.image(imagePath, 0, 0, { width: W, height: imageH, cover: [W, imageH] });
  } else {
    // Fallback: Gradient-Banner
    doc.rect(0, 0, W, imageH).fill(DARK);
    doc.fontSize(36).font('Helvetica-Bold').fillColor(GOLD)
      .text('GUTSCHEIN', 0, imageH / 2 - 20, { align: 'center', width: W });
  }

  // ── Gold-Overlay-Leiste ──────────────────────────────────────────────────
  doc.rect(0, imageH, W, 6).fill(GOLD);

  let y = imageH + 6 + 24;

  // ── Dojo-Name rechts ────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica').fillColor(MUTED)
    .text(g.dojoname || '', MARGIN, y, { align: 'right', width: CW });

  // ── GUTSCHEIN-Heading ───────────────────────────────────────────────────
  y += 14;
  doc.fontSize(9).font('Helvetica').fillColor(GOLD)
    .text('G U T S C H E I N', MARGIN, y, { align: 'left', width: CW, characterSpacing: 3 });

  y += 16;
  doc.fontSize(18).font('Helvetica-Bold').fillColor(BLACK)
    .text(g.titel || 'Gutschein', MARGIN, y, { width: CW });

  // ── Wert ────────────────────────────────────────────────────────────────
  y += 34;
  const wertStr = Number(g.wert).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2
  });
  doc.fontSize(52).font('Helvetica-Bold').fillColor(GOLD)
    .text(wertStr, MARGIN, y, { align: 'center', width: CW });

  // ── Trennlinie ──────────────────────────────────────────────────────────
  y += 68;
  doc.rect(MARGIN, y, CW, 1).fill('#E8E8E8');
  y += 14;

  // ── Code-Box ────────────────────────────────────────────────────────────
  const codeBoxH = 52;
  doc.rect(MARGIN, y, CW, codeBoxH)
    .fill(DARK);
  doc.rect(MARGIN, y, CW, codeBoxH)
    .stroke(GOLD);

  doc.fontSize(9).font('Helvetica').fillColor(GOLD)
    .text('GUTSCHEIN-CODE', 0, y + 8, { align: 'center', width: W, characterSpacing: 2 });
  doc.fontSize(22).font('Helvetica-Bold').fillColor(WHITE)
    .text(g.code, 0, y + 22, { align: 'center', width: W });

  y += codeBoxH + 20;

  // ── Nachricht / Persönlicher Text ───────────────────────────────────────
  if (g.nachricht) {
    doc.fontSize(11).font('Helvetica-Oblique').fillColor(BLACK)
      .text(`„${g.nachricht}"`, MARGIN, y, {
        width: CW, align: 'center', lineGap: 3
      });
    y += doc.heightOfString(`„${g.nachricht}"`, { width: CW }) + 14;
  }

  // ── Empfänger + Gültigkeit ──────────────────────────────────────────────
  const empfaengerLabel = g.empfaenger_name ? `Für: ${g.empfaenger_name}` : '';
  const gueltigLabel = g.gueltig_bis
    ? `Gültig bis: ${new Date(g.gueltig_bis).toLocaleDateString('de-DE')}`
    : 'Ohne Ablaufdatum';

  if (empfaengerLabel || gueltigLabel) {
    doc.fontSize(10).font('Helvetica').fillColor(MUTED);
    if (empfaengerLabel && gueltigLabel) {
      doc.text(empfaengerLabel, MARGIN, y, { continued: false, width: CW / 2 });
      doc.text(gueltigLabel, MARGIN + CW / 2, y, { width: CW / 2, align: 'right' });
    } else {
      doc.text(empfaengerLabel || gueltigLabel, MARGIN, y, { width: CW, align: 'center' });
    }
    y += 20;
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  const footerY = H - 60;
  doc.rect(0, footerY - 8, W, 1).fill('#E8E8E8');

  doc.fontSize(8).font('Helvetica').fillColor(MUTED)
    .text(
      `${g.dojoname || 'Kampfkunstschule'} · Einlösbar für alle Kurse, Trainings und Angebote`,
      MARGIN, footerY,
      { align: 'center', width: CW }
    );
  doc.fontSize(7).font('Helvetica').fillColor('#AAAAAA')
    .text(
      `Ausgestellt am ${new Date(g.erstellt_am).toLocaleDateString('de-DE')} · Code: ${g.code}`,
      MARGIN, footerY + 14,
      { align: 'center', width: CW }
    );
}

module.exports = { generateGutscheinPdf };
