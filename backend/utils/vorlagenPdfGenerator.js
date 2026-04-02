/**
 * vorlagenPdfGenerator.js
 * ========================
 * Erzeugt professionelle A4-PDFs aus TipTap-HTML + Absender-Profil.
 * Nutzt Puppeteer für pixelgenaues WYSIWYG-Rendering.
 *
 * Footer erscheint auf JEDER Seite via Puppeteer footerTemplate.
 * Einstellungen (DIN 5008 A/B, Schrift, Ränder, Farbe, Logo-Position) aus brief_einstellungen.
 * Mehrere Bankverbindungen aus dojo_bankverbindungen via banken[]-Array.
 * Logo-Position: 'links' | 'mitte' | 'rechts' (default: rechts)
 */

const puppeteer = require('puppeteer');

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_EINSTELLUNGEN = {
  margin_top_mm: 27.00,
  margin_bottom_mm: 26.46,
  margin_left_mm: 25.00,
  margin_right_mm: 20.00,
  font_family: 'Helvetica',
  font_size_pt: 10.0,
  line_height: 1.60,
  footer_show_bank: 1,
  footer_show_contact: 1,
  footer_show_inhaber: 1,
  footer_custom_html: null,
  farbe_primaer: null,
  footer_bank_ids: null,
  footer_inhaber_aus_stammdaten: 0,
  logo_position: 'rechts',
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function formatDate(date) {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateLong(date) {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Liefert die Primärfarbe für Briefkopf/Fußzeile.
 * Priorität: einstellungen.farbe_primaer > Profilfarbe > Default
 * Spezialwert 'none' → null (keine Farbbalken)
 */
function getColor(absenderProfil, einstellungen) {
  const farbePrimaer = einstellungen?.farbe_primaer;
  if (farbePrimaer === 'none') return null;
  if (farbePrimaer) return farbePrimaer;
  if (!absenderProfil) return '#8B0000';
  if (absenderProfil.farbe_primaer) return absenderProfil.farbe_primaer;
  if (absenderProfil.typ === 'verband' || absenderProfil.typ === 'lizenzen') return '#c9a227';
  return '#8B0000';
}

function getCfg(einstellungen) {
  return { ...DEFAULT_EINSTELLUNGEN, ...(einstellungen || {}) };
}

/**
 * Erzeugt den Header-HTML-Block abhängig von Logo-Position.
 * @param {object} p - Parameter
 */
function buildHeaderBlock(p) {
  const {
    absenderZeile, empfAnrede, empfName, empfStrasse, empfOrt,
    datumStr, absenderOrt, logoUrl, logoPos,
  } = p;

  const logoTag = logoUrl
    ? `<img src="${logoUrl}" class="header-logo" alt="Logo">`
    : '';

  const empfBlock = `
    ${empfAnrede ? `<div class="anrede">${empfAnrede}</div>` : ''}
    <div>${empfName}</div>
    ${empfStrasse ? `<div>${empfStrasse}</div>` : ''}
    ${empfOrt     ? `<div>${empfOrt}</div>` : ''}`;

  const datumBlock = `<div class="datum-ort">${absenderOrt}, ${datumStr}</div>`;

  if (logoPos === 'mitte') {
    return `
  ${logoUrl ? `<div class="logo-center-area">${logoTag}</div>` : ''}
  <div class="header-content">
    <div>
      <div class="absender-klein">${absenderZeile}</div>
      <div class="empfaenger-block">${empfBlock}</div>
    </div>
    <div class="datum-block"><div>${datumBlock}</div></div>
  </div>`;
  }

  if (logoPos === 'links') {
    return `
  <div class="header-content">
    <div>
      ${logoUrl ? `<div class="logo-area-left">${logoTag}</div>` : ''}
      <div class="absender-klein">${absenderZeile}</div>
      <div class="empfaenger-block">${empfBlock}</div>
    </div>
    <div class="datum-block"><div>${datumBlock}</div></div>
  </div>`;
  }

  // rechts (default)
  return `
  <div class="header-content">
    <div>
      <div class="absender-klein">${absenderZeile}</div>
      <div class="empfaenger-block">${empfBlock}</div>
    </div>
    <div class="header-right-col">
      ${logoUrl ? `<div class="logo-area-right">${logoTag}</div>` : ''}
      <div class="datum-block${logoUrl ? ' datum-block--notop' : ''}">
        <div>${datumBlock}</div>
      </div>
    </div>
  </div>`;
}

// ── Puppeteer footerTemplate ──────────────────────────────────────────────────
/**
 * @param {object} absenderProfil
 * @param {object} cfg
 * @param {string|null} color - null = keine Farbbalken
 * @param {Array} banken - ausgewählte Bankverbindungen aus dojo_bankverbindungen
 */
function buildPuppeteerFooterTemplate(absenderProfil, cfg, color, banken = []) {
  const absName     = absenderProfil?.organisation || absenderProfil?.name || '';
  const absAdresse  = [absenderProfil?.strasse, absenderProfil?.hausnummer, absenderProfil?.plz, absenderProfil?.ort].filter(Boolean).join(' ');
  const absInhaber  = absenderProfil?.inhaber || '';
  const absTelefon  = absenderProfil?.telefon || '';
  const absEmail    = absenderProfil?.email || '';
  const absInternet = absenderProfil?.internet || '';
  const bankName    = absenderProfil?.bank_name || '';
  const bankIban    = absenderProfil?.bank_iban || '';
  const bankBic     = absenderProfil?.bank_bic  || '';

  const showContact = cfg.footer_show_contact !== 0;
  const showInhaber = cfg.footer_show_inhaber !== 0;
  const showBank    = cfg.footer_show_bank    !== 0;
  const customHtml  = cfg.footer_custom_html || '';

  const cols = [];

  if (showInhaber && (absName || absInhaber || absAdresse)) {
    cols.push(`
      <div class="fc">
        <span class="fl">${absName}</span>
        ${absInhaber ? `${absInhaber}<br>` : ''}
        ${absAdresse ? `${absAdresse}<br>` : ''}
        ${absTelefon && showContact ? `Tel.: ${absTelefon}` : ''}
      </div>`);
  }

  if (showContact && (absEmail || absInternet)) {
    cols.push(`
      <div class="fc">
        <span class="fl">Kontakt</span>
        ${absEmail ? `${absEmail}<br>` : ''}
        ${absInternet || ''}
      </div>`);
  }

  // Bankverbindungen: explizit ausgewählte aus dojo_bankverbindungen zuerst
  if (banken && banken.length > 0) {
    banken.forEach(bank => {
      cols.push(`
        <div class="fc">
          <span class="fl">${bank.bezeichnung || 'Bankverbindung'}</span>
          ${bank.bank_name ? `${bank.bank_name}<br>` : ''}
          ${bank.bank_iban ? `IBAN: ${bank.bank_iban}<br>` : ''}
          ${bank.bank_bic  ? `BIC: ${bank.bank_bic}`  : ''}
        </div>`);
    });
  } else if (showBank && (bankIban || bankName)) {
    // Fallback: Bank aus Absender-Profil
    cols.push(`
      <div class="fc">
        <span class="fl">Bankverbindung</span>
        ${bankName ? `${bankName}<br>` : ''}
        ${bankIban ? `IBAN: ${bankIban}<br>` : ''}
        ${bankBic  ? `BIC: ${bankBic}` : ''}
      </div>`);
  }

  if (customHtml) {
    cols.push(`<div class="fc custom-text">${customHtml}</div>`);
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Helvetica, Arial, sans-serif; font-size: 7pt; color: #666; width: 100%; }
  .footer-content {
    border-top: 0.5pt solid #ccc;
    padding: 2mm ${cfg.margin_right_mm || 20}mm 2mm ${cfg.margin_left_mm || 25}mm;
    display: flex;
    justify-content: space-between;
    gap: 8mm;
    width: 100%;
  }
  .fc { flex: 1; line-height: 1.4; }
  .fl { font-weight: bold; color: #333; display: block; margin-bottom: 1pt; }
  .custom-text { font-size: 7pt; }
  ${color ? `.footer-bar { background: ${color}; height: 4mm; width: 100%; }` : ''}
</style>
</head>
<body>
<div class="footer-content">${cols.join('')}</div>
${color ? '<div class="footer-bar"></div>' : ''}
</body>
</html>`;
}

// ── HTML-Letterhead-Template (für Browser-Vorschau) ───────────────────────────
/**
 * @param {object} params
 * @param {Array}  params.banken    - ausgewählte Bankverbindungen
 * @param {string} params.logoUrl   - Data-URI oder null
 */
function buildLetterheadHtml({ briefHtml, absenderProfil, empfaenger, briefTitel, datumStr, einstellungen, banken = [], logoUrl = null }) {
  const cfg = getCfg(einstellungen);
  const logoPos = cfg.logo_position || 'rechts';
  const color = getColor(absenderProfil, einstellungen);
  const absName     = absenderProfil?.organisation || absenderProfil?.name || '';
  const absAdresse  = [absenderProfil?.strasse, absenderProfil?.hausnummer, absenderProfil?.plz, absenderProfil?.ort].filter(Boolean).join(' ');
  const absInhaber2 = absenderProfil?.inhaber || '';
  const absTelefon  = absenderProfil?.telefon || '';
  const absEmail    = absenderProfil?.email || '';
  const absInternet = absenderProfil?.internet || '';
  const bankName    = absenderProfil?.bank_name || '';
  const bankIban    = absenderProfil?.bank_iban || '';
  const bankBic     = absenderProfil?.bank_bic  || '';

  const empfAnrede  = empfaenger?.anrede || '';
  const empfName    = [empfaenger?.vorname, empfaenger?.nachname].filter(Boolean).join(' ');
  const empfStrasse = [empfaenger?.strasse, empfaenger?.hausnummer].filter(Boolean).join(' ');
  const empfOrt     = [empfaenger?.plz, empfaenger?.ort].filter(Boolean).join(' ');
  const absenderZeile = [absName, absAdresse].filter(Boolean).join(' · ');

  const showBank    = cfg.footer_show_bank    !== 0;
  const showContact = cfg.footer_show_contact !== 0;
  const showInhaber = cfg.footer_show_inhaber !== 0;
  const customHtml  = cfg.footer_custom_html || '';

  const footerCols = [];
  if (showInhaber && (absName || absInhaber2 || absAdresse)) {
    footerCols.push(`
      <div class="footer-col">
        <span class="footer-label">${absName}</span>
        ${absInhaber2 ? `${absInhaber2}<br>` : ''}
        ${absAdresse ? `${absAdresse}<br>` : ''}
        ${absTelefon && showContact ? `Tel.: ${absTelefon}` : ''}
      </div>`);
  }
  if (showContact && (absEmail || absInternet)) {
    footerCols.push(`
      <div class="footer-col">
        <span class="footer-label">Kontakt</span>
        ${absEmail ? `${absEmail}<br>` : ''}
        ${absInternet || ''}
      </div>`);
  }

  // Bankverbindungen: explizit ausgewählte aus dojo_bankverbindungen zuerst
  if (banken && banken.length > 0) {
    banken.forEach(bank => {
      footerCols.push(`
        <div class="footer-col">
          <span class="footer-label">${bank.bezeichnung || 'Bankverbindung'}</span>
          ${bank.bank_name ? `${bank.bank_name}<br>` : ''}
          ${bank.bank_iban ? `IBAN: ${bank.bank_iban}<br>` : ''}
          ${bank.bank_bic  ? `BIC: ${bank.bank_bic}`  : ''}
        </div>`);
    });
  } else if (showBank && (bankIban || bankName)) {
    footerCols.push(`
      <div class="footer-col">
        <span class="footer-label">Bankverbindung</span>
        ${bankName ? `${bankName}<br>` : ''}
        ${bankIban ? `IBAN: ${bankIban}<br>` : ''}
        ${bankBic  ? `BIC: ${bankBic}` : ''}
      </div>`);
  }
  if (customHtml) {
    footerCols.push(`<div class="footer-col">${customHtml}</div>`);
  }

  const textColor = color || '#1a1a1a';

  const headerBlock = buildHeaderBlock({
    absenderZeile, empfAnrede, empfName, empfStrasse, empfOrt,
    datumStr, absenderOrt: absenderProfil?.ort || '',
    logoUrl, logoPos,
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: '${cfg.font_family}', Helvetica, Arial, sans-serif;
    font-size: ${cfg.font_size_pt}pt;
    color: #1a1a1a;
    background: #fff;
    width: 210mm;
    min-height: 297mm;
  }

  /* Briefkopf-Balken */
  ${color ? `.header-bar { background: ${color}; height: 8mm; width: 100%; }` : '.header-bar { display: none; }'}

  /* Briefkopf-Inhalt */
  .header-content {
    padding: 4mm ${cfg.margin_right_mm}mm 0 ${cfg.margin_left_mm}mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .header-right-col { display: flex; flex-direction: column; align-items: flex-end; }

  /* Logo */
  .header-logo { max-height: 18mm; max-width: 55mm; object-fit: contain; display: block; }
  .logo-area-left { margin-bottom: 4mm; }
  .logo-area-right { text-align: right; margin-bottom: 2mm; }
  .logo-center-area { text-align: center; padding: 3mm ${cfg.margin_right_mm}mm 3mm ${cfg.margin_left_mm}mm; }

  .absender-klein {
    font-size: 7pt; color: #555;
    border-bottom: 0.5pt solid #ccc;
    padding-bottom: 3pt; margin-bottom: 10mm;
    white-space: nowrap;
  }
  .empfaenger-block { font-size: ${cfg.font_size_pt}pt; line-height: 1.5; min-height: 30mm; }
  .empfaenger-block .anrede { font-size: 9pt; color: #444; }
  .datum-block { text-align: right; font-size: 9pt; color: #333; padding-top: 14mm; min-width: 55mm; }
  .datum-block--notop { padding-top: 0; }
  .datum-ort { font-weight: bold; margin-bottom: 2pt; }

  /* Betreff */
  .betreff-zeile {
    padding: 6mm ${cfg.margin_right_mm}mm 0 ${cfg.margin_left_mm}mm;
    font-size: 11pt; font-weight: bold; color: ${textColor}; margin-bottom: 5mm;
  }

  /* Body */
  .brief-body {
    padding: 0 ${cfg.margin_right_mm}mm 0 ${cfg.margin_left_mm}mm;
    font-size: ${cfg.font_size_pt}pt;
    line-height: ${cfg.line_height};
    flex: 1;
  }
  .brief-body p { margin-bottom: 8pt; }
  .brief-body h1 { font-size: 14pt; font-weight: bold; margin-bottom: 8pt; color: ${textColor}; }
  .brief-body h2 { font-size: 12pt; font-weight: bold; margin-bottom: 6pt; }
  .brief-body ul { margin-left: 16pt; margin-bottom: 8pt; }
  .brief-body ol { margin-left: 16pt; margin-bottom: 8pt; }
  .brief-body li { margin-bottom: 3pt; }
  .brief-body strong { font-weight: bold; }
  .brief-body em { font-style: italic; }
  .brief-body u { text-decoration: underline; }
  .brief-body a { color: ${textColor}; }
  .brief-body [style*="text-align: center"] { text-align: center; }
  .brief-body [style*="text-align: right"]  { text-align: right; }
  .brief-body table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
  .brief-body td, .brief-body th { border: 0.5pt solid #ccc; padding: 3pt 5pt; }
  .brief-body th { background: #f0f0f0; font-weight: bold; }

  /* Seiten-Wrapper */
  .page-wrapper { display: flex; flex-direction: column; min-height: 297mm; }

  /* Footer */
  .footer { margin-top: auto; width: 100%; }
  .footer-content {
    border-top: 0.5pt solid #ccc;
    padding: 3mm ${cfg.margin_right_mm}mm 3mm ${cfg.margin_left_mm}mm;
    font-size: 7pt; color: #666;
    display: flex;
    justify-content: space-between;
    gap: 10mm;
  }
  .footer-col { flex: 1; }
  .footer-label { font-weight: bold; color: #333; display: block; margin-bottom: 1pt; }
  ${color ? `.footer-bar { background: ${color}; height: 4mm; }` : '.footer-bar { display: none; }'}
</style>
</head>
<body>
<div class="page-wrapper">
  <!-- Briefkopf-Balken -->
  <div class="header-bar"></div>

  <!-- Absender / Logo / Empfänger / Datum -->
  ${headerBlock}

  <!-- Betreffzeile -->
  ${briefTitel ? `<div class="betreff-zeile">${briefTitel}</div>` : ''}

  <!-- Brief-Körper (TipTap HTML) -->
  <div class="brief-body">
    ${briefHtml || '<p></p>'}
  </div>

  <!-- Fußzeile (bleibt via flex: 1 am Seitenende) -->
  <div class="footer">
    <div class="footer-content">
      ${footerCols.join('')}
    </div>
    <div class="footer-bar"></div>
  </div>
</div>
</body>
</html>`;
}

// ── PDF-Generierung (Puppeteer) ───────────────────────────────────────────────

async function generateVorlagePdf({ briefHtml, absenderProfil, empfaenger = {}, briefTitel = '', datum = null, einstellungen = null, banken = [], logoUrl = null }) {
  const cfg   = getCfg(einstellungen);
  const color = getColor(absenderProfil, einstellungen);
  const datumStr = formatDate(datum);

  // HTML für Puppeteer (OHNE Footer in der Seite — Footer kommt via footerTemplate)
  const html = buildLetterheadHtmlForPdf({ briefHtml, absenderProfil, empfaenger, briefTitel, datumStr, cfg, color, logoUrl });

  // Footer-Template für Puppeteer (jede Seite)
  const footerTpl = buildPuppeteerFooterTemplate(absenderProfil, cfg, color, banken);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: footerTpl,
      margin: {
        top: '0mm',
        bottom: '22mm',   // Platz für Footer-Template
        left: '0mm',
        right: '0mm'
      }
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

// HTML für Puppeteer-PDF (ohne Footer im Body — footer kommt via footerTemplate)
function buildLetterheadHtmlForPdf({ briefHtml, absenderProfil, empfaenger, briefTitel, datumStr, cfg, color, logoUrl = null }) {
  const logoPos = cfg.logo_position || 'rechts';
  const absName     = absenderProfil?.organisation || absenderProfil?.name || '';
  const absAdresse  = [absenderProfil?.strasse, absenderProfil?.hausnummer, absenderProfil?.plz, absenderProfil?.ort].filter(Boolean).join(' ');
  const empfAnrede  = empfaenger?.anrede || '';
  const empfName    = [empfaenger?.vorname, empfaenger?.nachname].filter(Boolean).join(' ');
  const empfStrasse = [empfaenger?.strasse, empfaenger?.hausnummer].filter(Boolean).join(' ');
  const empfOrt     = [empfaenger?.plz, empfaenger?.ort].filter(Boolean).join(' ');
  const absenderZeile = [absName, absAdresse].filter(Boolean).join(' · ');
  const textColor = color || '#1a1a1a';

  const headerBlock = buildHeaderBlock({
    absenderZeile, empfAnrede, empfName, empfStrasse, empfOrt,
    datumStr, absenderOrt: absenderProfil?.ort || '',
    logoUrl, logoPos,
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: '${cfg.font_family}', Helvetica, Arial, sans-serif;
    font-size: ${cfg.font_size_pt}pt;
    color: #1a1a1a; background: #fff;
    width: 210mm;
  }
  ${color ? `.header-bar { background: ${color}; height: 8mm; width: 100%; }` : '.header-bar { display: none; }'}
  .header-content {
    padding: 4mm ${cfg.margin_right_mm}mm 0 ${cfg.margin_left_mm}mm;
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .header-right-col { display: flex; flex-direction: column; align-items: flex-end; }
  .header-logo { max-height: 18mm; max-width: 55mm; object-fit: contain; display: block; }
  .logo-area-left { margin-bottom: 4mm; }
  .logo-area-right { text-align: right; margin-bottom: 2mm; }
  .logo-center-area { text-align: center; padding: 3mm ${cfg.margin_right_mm}mm 3mm ${cfg.margin_left_mm}mm; }
  .absender-klein {
    font-size: 7pt; color: #555;
    border-bottom: 0.5pt solid #ccc;
    padding-bottom: 3pt; margin-bottom: 10mm; white-space: nowrap;
  }
  .empfaenger-block { font-size: ${cfg.font_size_pt}pt; line-height: 1.5; min-height: 30mm; }
  .empfaenger-block .anrede { font-size: 9pt; color: #444; }
  .datum-block { text-align: right; font-size: 9pt; color: #333; padding-top: 14mm; min-width: 55mm; }
  .datum-block--notop { padding-top: 0; }
  .datum-ort { font-weight: bold; margin-bottom: 2pt; }
  .betreff-zeile {
    padding: 6mm ${cfg.margin_right_mm}mm 0 ${cfg.margin_left_mm}mm;
    font-size: 11pt; font-weight: bold; color: ${textColor}; margin-bottom: 5mm;
  }
  .brief-body {
    padding: 0 ${cfg.margin_right_mm}mm 8mm ${cfg.margin_left_mm}mm;
    font-size: ${cfg.font_size_pt}pt; line-height: ${cfg.line_height};
  }
  .brief-body p { margin-bottom: 8pt; }
  .brief-body h1 { font-size: 14pt; font-weight: bold; margin-bottom: 8pt; color: ${textColor}; }
  .brief-body h2 { font-size: 12pt; font-weight: bold; margin-bottom: 6pt; }
  .brief-body ul { margin-left: 16pt; margin-bottom: 8pt; }
  .brief-body ol { margin-left: 16pt; margin-bottom: 8pt; }
  .brief-body li { margin-bottom: 3pt; }
  .brief-body strong { font-weight: bold; }
  .brief-body em { font-style: italic; }
  .brief-body u { text-decoration: underline; }
  .brief-body a { color: ${textColor}; }
  .brief-body table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
  .brief-body td, .brief-body th { border: 0.5pt solid #ccc; padding: 3pt 5pt; }
  .brief-body th { background: #f0f0f0; font-weight: bold; }
</style>
</head>
<body>
  <div class="header-bar"></div>
  ${headerBlock}
  ${briefTitel ? `<div class="betreff-zeile">${briefTitel}</div>` : ''}
  <div class="brief-body">${briefHtml || '<p></p>'}</div>
</body>
</html>`;
}

module.exports = { generateVorlagePdf, buildLetterheadHtml, formatDate, formatDateLong };
