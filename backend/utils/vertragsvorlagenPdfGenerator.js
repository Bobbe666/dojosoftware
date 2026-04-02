/**
 * vertragsvorlagenPdfGenerator.js
 * =================================
 * Erzeugt professionelle A4-Vertrags-PDFs aus TipTap-HTML.
 * Nutzt Puppeteer für pixelgenaues Rendering.
 *
 * Layout: Vertrags-Stil — Titel, Dojo-Info, Inhalt, Signaturblock, Seitenzahl.
 */

const puppeteer = require('puppeteer');

// ── Platzhalter-Ersetzung ──────────────────────────────────────────────────────

/**
 * Ersetzt {{kategorie.feld}} und {{feld}} Platzhalter in HTML.
 * @param {string} html
 * @param {object} data  — { mitglied: {...}, vertrag: {...}, dojo: {...}, system: {...} }
 */
function replacePlaceholders(html, data) {
  if (!html) return '';
  let result = html;

  // Format: {{kategorie.feld}}
  Object.entries(data).forEach(([category, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      const re = new RegExp(`\\{\\{${category}\\.${key}\\}\\}`, 'g');
      result = result.replace(re, value ?? '');
    });
  });

  // Format: {{feld}} (ohne Kategorie, Fallback-Kompatibilität)
  Object.entries(data).forEach(([, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(re, value ?? '');
    });
  });

  // Übrig gebliebene Platzhalter entfernen
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result;
}

// ── Voll-HTML-Template ────────────────────────────────────────────────────────

function buildVertragsHtml({ tiptapHtml, templateName, dojo, mitglied, vertrag, logoBase64 }) {
  const dojoName = dojo?.dojoname || dojo?.name || '';
  const dojoAdresse = [dojo?.strasse, dojo?.hausnummer].filter(Boolean).join(' ');
  const dojoOrt = [dojo?.plz, dojo?.ort].filter(Boolean).join(' ');
  const dojoKontakt = [dojo?.telefon, dojo?.email].filter(Boolean).join(' | ');
  const datumHeute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" class="header-logo" />`
    : '';

  const mitgliedName = mitglied
    ? `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim()
    : '';

  const vertragNr = vertrag?.vertragsnummer || '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 20mm 18mm 25mm 20mm;
    @bottom-right {
      content: "Seite " counter(page) " von " counter(pages);
      font-size: 8pt;
      color: #888;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.55;
  }

  /* ── KOPFZEILE ── */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8mm;
    padding-bottom: 4mm;
    border-bottom: 2pt solid #1a1a1a;
  }
  .header-logo {
    max-width: 40mm;
    max-height: 20mm;
    object-fit: contain;
  }
  .header-org {
    text-align: right;
  }
  .header-org-name {
    font-size: 13pt;
    font-weight: 700;
    color: #1a1a1a;
  }
  .header-org-detail {
    font-size: 8pt;
    color: #555;
    margin-top: 2pt;
    line-height: 1.4;
  }

  /* ── DOKUMENT-TITEL ── */
  .doc-title {
    font-size: 16pt;
    font-weight: 700;
    text-align: center;
    margin: 6mm 0 4mm;
    color: #1a1a1a;
    letter-spacing: 0.02em;
  }
  .doc-meta {
    display: flex;
    justify-content: space-between;
    font-size: 8.5pt;
    color: #444;
    margin-bottom: 6mm;
    padding-bottom: 3mm;
    border-bottom: 0.5pt solid #ccc;
  }

  /* ── INHALT ── */
  .doc-body {
    font-size: 10pt;
    line-height: 1.6;
  }
  .doc-body p { margin-bottom: 6pt; orphans: 3; widows: 3; }
  .doc-body h1 {
    font-size: 13pt; font-weight: 700;
    margin: 8pt 0 4pt; color: #1a1a1a;
    page-break-after: avoid;
  }
  .doc-body h2 {
    font-size: 11pt; font-weight: 700;
    margin: 6pt 0 4pt;
    page-break-after: avoid;
  }
  .doc-body h3 {
    font-size: 10pt; font-weight: 700;
    margin: 5pt 0 3pt;
    page-break-after: avoid;
  }
  .doc-body ul, .doc-body ol {
    padding-left: 14pt; margin-bottom: 6pt;
  }
  .doc-body li { margin-bottom: 2pt; }
  .doc-body strong { font-weight: 700; }
  .doc-body em { font-style: italic; }
  .doc-body u { text-decoration: underline; }
  .doc-body table {
    width: 100%; border-collapse: collapse;
    margin-bottom: 6pt; font-size: 9pt;
  }
  .doc-body td, .doc-body th {
    border: 0.5pt solid #999;
    padding: 3pt 5pt;
  }
  .doc-body th {
    background: #f0f0f0; font-weight: 700;
  }
  .doc-body [style*="text-align: center"] { text-align: center; }
  .doc-body [style*="text-align: right"] { text-align: right; }

  /* ── SIGNATURBLOCK ── */
  .signature-block {
    margin-top: 14mm;
    display: flex;
    gap: 20mm;
    page-break-inside: avoid;
  }
  .signature-col {
    flex: 1;
  }
  .signature-line {
    border-top: 0.75pt solid #1a1a1a;
    margin-bottom: 3pt;
  }
  .signature-label {
    font-size: 8pt;
    color: #555;
  }
</style>
</head>
<body>

  <!-- Kopfzeile -->
  <div class="doc-header">
    <div>${logoHtml}</div>
    <div class="header-org">
      <div class="header-org-name">${dojoName}</div>
      <div class="header-org-detail">
        ${dojoAdresse}${dojoOrt ? ', ' + dojoOrt : ''}<br>
        ${dojoKontakt}
      </div>
    </div>
  </div>

  <!-- Dokumenttitel -->
  <div class="doc-title">${templateName || 'Vertragsvorlage'}</div>

  <!-- Meta-Zeile -->
  <div class="doc-meta">
    <span>${mitgliedName ? 'Mitglied: ' + mitgliedName : ''}</span>
    <span>${vertragNr ? 'Vertrags-Nr.: ' + vertragNr + ' | ' : ''}Datum: ${datumHeute}</span>
  </div>

  <!-- Brief-Körper (TipTap HTML) -->
  <div class="doc-body">
    ${tiptapHtml || '<p></p>'}
  </div>

  <!-- Signaturblock -->
  <div class="signature-block">
    <div class="signature-col">
      <div class="signature-line"></div>
      <div class="signature-label">Ort, Datum</div>
    </div>
    <div class="signature-col">
      <div class="signature-line"></div>
      <div class="signature-label">Unterschrift Mitglied</div>
    </div>
    <div class="signature-col">
      <div class="signature-line"></div>
      <div class="signature-label">Unterschrift ${dojoName || 'Dojo'}</div>
    </div>
  </div>

</body>
</html>`;
}

// ── Haupt-Export ──────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string}  opts.tiptapHtml       — TipTap-HTML (Rohinhalt)
 * @param {string}  opts.templateName     — Vorlagenname (Dokumenttitel)
 * @param {object}  opts.dojo             — { dojoname, strasse, ... }
 * @param {object}  [opts.mitglied]       — { vorname, nachname, ... } | null
 * @param {object}  [opts.vertrag]        — { vertragsnummer, ... } | null
 * @param {string}  [opts.logoBase64]     — data:image/..;base64,... | null
 * @returns {Buffer} PDF-Buffer
 */
async function generateVertragsvorlagePdf({ tiptapHtml, templateName, dojo, mitglied, vertrag, logoBase64 }) {
  // Platzhalter aufbauen
  const data = {
    mitglied: {
      vorname: mitglied?.vorname || '',
      nachname: mitglied?.nachname || '',
      email: mitglied?.email || '',
      telefon: mitglied?.telefon || '',
      strasse: mitglied?.strasse || '',
      hausnummer: mitglied?.hausnummer || '',
      plz: mitglied?.plz || '',
      ort: mitglied?.ort || '',
      geburtsdatum: mitglied?.geburtsdatum || '',
      mitgliedsnummer: mitglied?.mitgliedsnummer || '',
      anrede: mitglied?.anrede || '',
    },
    vertrag: {
      vertragsnummer: vertrag?.vertragsnummer || '',
      vertragsbeginn: vertrag?.vertragsbeginn || '',
      vertragsende: vertrag?.vertragsende || '',
      monatsbeitrag: vertrag?.monatsbeitrag || '',
      mindestlaufzeit_monate: vertrag?.mindestlaufzeit_monate || '',
      kuendigungsfrist_monate: vertrag?.kuendigungsfrist_monate || '',
      tarifname: vertrag?.tarifname || '',
    },
    dojo: {
      dojoname: dojo?.dojoname || dojo?.name || '',
      strasse: dojo?.strasse || '',
      hausnummer: dojo?.hausnummer || '',
      plz: dojo?.plz || '',
      ort: dojo?.ort || '',
      telefon: dojo?.telefon || '',
      email: dojo?.email || '',
      internet: dojo?.internet || '',
    },
    system: {
      datum: new Date().toLocaleDateString('de-DE'),
      datum_lang: new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }),
      jahr: String(new Date().getFullYear()),
      monat: new Date().toLocaleDateString('de-DE', { month: 'long' }),
    },
  };

  const resolvedHtml = replacePlaceholders(tiptapHtml, data);

  const fullHtml = buildVertragsHtml({
    tiptapHtml: resolvedHtml,
    templateName,
    dojo: data.dojo,
    mitglied: data.mitglied,
    vertrag: data.vertrag,
    logoBase64,
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `
      <div style="font-size:8pt;color:#888;width:100%;text-align:right;padding-right:18mm;">
        Seite <span class="pageNumber"></span> von <span class="totalPages"></span>
      </div>`,
    margin: { top: '20mm', right: '18mm', bottom: '25mm', left: '20mm' },
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = { generateVertragsvorlagePdf, replacePlaceholders };
