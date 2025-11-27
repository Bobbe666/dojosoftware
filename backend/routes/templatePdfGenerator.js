// Backend/services/templatePdfGenerator.js
// PDF-Generierung aus GrapesJS HTML-Templates mit Puppeteer

const puppeteer = require('puppeteer');
const db = require('../db');

// Promise-Wrapper für Datenbankabfragen
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

/**
 * Rendert ein HTML-Template mit Daten
 */
const renderTemplate = (html, data) => {
  let rendered = html;

  // Platzhalter ersetzen
  Object.entries(data).forEach(([category, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${category}\\.${key}}}`, 'g');
      rendered = rendered.replace(placeholder, value || '');
    });
  });

  return rendered;
};

/**
 * Generiert PDF aus Vertragsvorlage
 */
async function generatePDFFromTemplate(templateId, mitglied, vertrag, dojo) {
  let browser;

  try {
    // 1. Template aus Datenbank laden
    const templates = await queryAsync('SELECT * FROM vertragsvorlagen WHERE id = ?', [templateId]);

    if (templates.length === 0) {
      throw new Error(`Template ${templateId} nicht gefunden`);
    }

    const template = templates[0];

    // 2. Daten vorbereiten
    const data = {
      mitglied: {
        vorname: mitglied.vorname || '',
        nachname: mitglied.nachname || '',
        email: mitglied.email || '',
        telefon: mitglied.telefon || '',
        strasse: mitglied.strasse || '',
        hausnummer: mitglied.hausnummer || '',
        plz: mitglied.plz || '',
        ort: mitglied.ort || '',
        geburtsdatum: mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : '',
        anrede: mitglied.anrede || '',
        mitgliedsnummer: mitglied.mitgliedsnummer || ''
      },
      vertrag: {
        vertragsnummer: vertrag.vertragsnummer || '',
        vertragsbeginn: vertrag.vertragsbeginn ? new Date(vertrag.vertragsbeginn).toLocaleDateString('de-DE') : '',
        vertragsende: vertrag.vertragsende ? new Date(vertrag.vertragsende).toLocaleDateString('de-DE') : '',
        monatsbeitrag: vertrag.monatsbeitrag || '',
        billing_cycle: vertrag.billing_cycle || '',
        mindestlaufzeit_monate: vertrag.mindestlaufzeit_monate || '',
        kuendigungsfrist_monate: vertrag.kuendigungsfrist_monate || '',
        tarifname: vertrag.tarifname || ''
      },
      dojo: {
        dojoname: dojo.dojoname || '',
        strasse: dojo.strasse || '',
        hausnummer: dojo.hausnummer || '',
        plz: dojo.plz || '',
        ort: dojo.ort || '',
        telefon: dojo.telefon || '',
        email: dojo.email || '',
        internet: dojo.internet || '',
        untertitel: dojo.untertitel || ''
      },
      system: {
        datum: new Date().toLocaleDateString('de-DE'),
        jahr: new Date().getFullYear(),
        monat: new Date().toLocaleDateString('de-DE', { month: 'long' })
      }
    };

    // 3. Template rendern
    const renderedHtml = renderTemplate(template.grapesjs_html, data);

    // 4. Vollständiges HTML-Dokument erstellen
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 40px;
            color: #333;
          }
          * {
            box-sizing: border-box;
          }
          ${template.grapesjs_css || ''}
        </style>
      </head>
      <body>
        ${renderedHtml}
      </body>
      </html>
    `;

    // 5. Puppeteer starten und PDF generieren
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: true
    });
    return pdfBuffer;

  } catch (error) {
    console.error('❌ Fehler bei PDF-Generierung:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Findet und verwendet Standard-Template für einen Typ
 */
async function generatePDFWithDefaultTemplate(dojoId, templateType, mitglied, vertrag) {
  try {
    // Standard-Template für Dojo und Typ finden
    const templates = await queryAsync(`
      SELECT id
      FROM vertragsvorlagen
      WHERE dojo_id = ?
        AND template_type = ?
        AND is_default = TRUE
        AND aktiv = TRUE
      LIMIT 1
    `, [dojoId, templateType]);

    if (templates.length === 0) {
      throw new Error(`Keine Standard-Vorlage für Typ "${templateType}" gefunden`);
    }

    const templateId = templates[0].id;

    // Dojo-Daten laden
    const dojos = await queryAsync('SELECT * FROM dojo WHERE id = ?', [dojoId]);
    const dojo = dojos[0] || {};

    return await generatePDFFromTemplate(templateId, mitglied, vertrag, dojo);
  } catch (error) {
    console.error('❌ Fehler bei Standard-Template:', error);
    throw error;
  }
}

module.exports = {
  generatePDFFromTemplate,
  generatePDFWithDefaultTemplate,
  renderTemplate
};
