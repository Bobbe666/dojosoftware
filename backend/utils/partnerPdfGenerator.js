/**
 * partnerPdfGenerator.js
 * Erzeugt A4-PDFs für Partner-Dokumente via Puppeteer.
 * Briefkopf-Balken in der Designfarbe, TDA-Footer, konfigurierbare Farbe.
 */

const puppeteer = require('puppeteer');

const TDA_ORG    = 'Tiger & Dragon Association e.V.';
const TDA_ADRESSE = 'Deutschland · www.tda-intl.com';
const TDA_KONTAKT = 'info@tda-intl.com';

function formatDateLong() {
  return new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildHtml({ title, contentHtml, primaryColor }) {
  const color = primaryColor || '#c9a227';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    line-height: 1.6;
  }
  .header-bar  { background: ${color}; height: 6mm; width: 100%; }
  .header-content {
    padding: 6mm 20mm 4mm 25mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 0.5pt solid #e0e0e0;
  }
  .org-name  { font-size: 9pt; font-weight: bold; color: ${color}; letter-spacing: 0.04em; }
  .org-sub   { font-size: 7.5pt; color: #888; margin-top: 1pt; }
  .datum     { font-size: 8.5pt; color: #555; text-align: right; margin-top: 2pt; }
  .body-wrap { padding: 10mm 20mm 15mm 25mm; }
  .doc-title {
    font-size: 13pt;
    font-weight: bold;
    color: ${color};
    margin-bottom: 7mm;
    padding-bottom: 2mm;
    border-bottom: 1pt solid ${color}44;
  }
  .content h1 { font-size: 12pt; font-weight: bold; color: ${color}; margin: 5mm 0 2mm; }
  .content h2 { font-size: 11pt; font-weight: bold; color: ${color}; margin: 4mm 0 2mm; }
  .content h3 { font-size: 10.5pt; font-weight: bold; margin: 3mm 0 1mm; }
  .content p  { margin: 0 0 3mm; }
  .content ul, .content ol { margin: 0 0 3mm 5mm; }
  .content li { margin-bottom: 1mm; }
  .content a  { color: ${color}; }
  .content strong { font-weight: bold; }
  .content em     { font-style: italic; }
  .content u      { text-decoration: underline; }
  .content table  { width: 100%; border-collapse: collapse; margin: 3mm 0; }
  .content td, .content th { border: 0.5pt solid #ccc; padding: 2mm 3mm; font-size: 9pt; }
  .content th { background: ${color}22; font-weight: bold; }
  .content [style*="text-align: center"] { text-align: center; }
  .content [style*="text-align: right"]  { text-align: right; }
</style>
</head>
<body>
  <div class="header-bar"></div>
  <div class="header-content">
    <div>
      <div class="org-name">${TDA_ORG}</div>
      <div class="org-sub">${TDA_ADRESSE}</div>
    </div>
    <div class="datum">${formatDateLong()}</div>
  </div>
  <div class="body-wrap">
    ${title ? `<div class="doc-title">${title}</div>` : ''}
    <div class="content">${contentHtml || ''}</div>
  </div>
</body>
</html>`;
}

function buildFooterTemplate(primaryColor) {
  const color = primaryColor || '#c9a227';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Helvetica, Arial, sans-serif; font-size: 7pt; color: #888; width: 100%; }
  .footer-bar { background: ${color}; height: 3mm; width: 100%; }
  .footer-content {
    padding: 2mm 20mm 1mm 25mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 0.5pt solid #ddd;
  }
  .footer-org { font-weight: bold; color: #555; }
  .page-num   { font-size: 7pt; }
</style>
</head>
<body>
  <div class="footer-content">
    <span class="footer-org">${TDA_ORG} · ${TDA_KONTAKT}</span>
    <span class="page-num">Seite <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>
  <div class="footer-bar"></div>
</body>
</html>`;
}

async function generatePartnerPdf({ title, contentHtml, primaryColor }) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml({ title, contentHtml, primaryColor }), { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '27mm', bottom: '26mm', left: '0', right: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: buildFooterTemplate(primaryColor),
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePartnerPdf };
