// Backend/services/templatePdfGenerator.js
// PDF-Generierung aus GrapesJS HTML-Templates mit Puppeteer

const puppeteer = require('puppeteer');
const db = require('../db');
const fs = require('fs');
const path = require('path');

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
 * Lädt das Haupt-Logo des Dojos als base64
 */
const loadDojoLogo = async (dojoId) => {
  try {
    const logos = await queryAsync(
      'SELECT file_path, mime_type FROM dojo_logos WHERE dojo_id = ? AND logo_type = ? LIMIT 1',
      [dojoId, 'haupt']
    );

    if (logos.length > 0 && fs.existsSync(logos[0].file_path)) {
      const imageBuffer = fs.readFileSync(logos[0].file_path);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = logos[0].mime_type || 'image/png';
      return `data:${mimeType};base64,${base64Image}`;
    }

    return null;
  } catch (error) {
    logger.error('Fehler beim Laden des Logos:', { error: error });
    return null;
  }
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

    // 2. Logo laden
    const logoBase64 = await loadDojoLogo(dojo.id);

    // 3. Daten vorbereiten
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

    // 4. Template rendern
    let renderedHtml = renderTemplate(template.grapesjs_html, data);

    // 5. Logo-Platzhalter durch tatsächliches Logo ersetzen
    if (logoBase64) {
      const logoHtml = `<img src="${logoBase64}" alt="Dojo Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" />`;
      // Robustere Regex die auch GrapesJS-generierte divs mit zusätzlichen Attributen matcht
      renderedHtml = renderedHtml.replace(
        /<div[^>]*class="[^"]*logo-placeholder[^"]*"[^>]*>[\s\S]*?<\/div>/g,
        (match) => {
          // Behalte die ursprünglichen Attribute, aber ersetze den Inhalt
          return match.replace(/>[\s\S]*?<\/div>/, `>${logoHtml}</div>`);
        }
      );
    }

    // 6. Vollständiges HTML-Dokument erstellen
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
    logger.error('Fehler bei PDF-Generierung:', error);
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
    logger.error('Fehler bei Standard-Template:', error);
    throw error;
  }
}

module.exports = {
  generatePDFFromTemplate,
  generatePDFWithDefaultTemplate,
  renderTemplate
};
