const express = require("express");
const db = require("../db");
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Helper: Create documents directory if it doesn't exist
async function ensureDocumentsDir() {
  const docsDir = path.join(__dirname, '..', 'generated_documents');
  try {
    await fs.access(docsDir);
  } catch {
    await fs.mkdir(docsDir, { recursive: true });
  }
  return docsDir;
}

// Helper: Get member data
async function getMemberData(mitgliedId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        m.*,
        d.dojoname, d.inhaber, d.strasse AS dojo_strasse,
        d.hausnummer AS dojo_hausnummer, d.plz AS dojo_plz,
        d.ort AS dojo_ort, d.telefon AS dojo_telefon,
        d.email AS dojo_email
      FROM mitglieder m
      LEFT JOIN dojo d ON m.dojo_id = d.id
      WHERE m.mitglied_id = ?
    `;

    db.query(query, [mitgliedId], (err, results) => {
      if (err) return reject(err);
      if (results.length === 0) return reject(new Error('Mitglied nicht gefunden'));
      resolve(results[0]);
    });
  });
}

// Helper: Get contract data
async function getContractData(vertragId) {
  if (!vertragId) return null;

  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM vertraege WHERE id = ?';
    db.query(query, [vertragId], (err, results) => {
      if (err) return reject(err);
      resolve(results.length > 0 ? results[0] : null);
    });
  });
}

// Helper: Replace placeholders in HTML
function replacePlaceholders(html, data) {
  let result = html;

  // System placeholders
  result = result.replace(/\{\{system\.datum\}\}/g, new Date().toLocaleDateString('de-DE'));
  result = result.replace(/\{\{system\.uhrzeit\}\}/g, new Date().toLocaleTimeString('de-DE'));

  // Member placeholders
  if (data.mitglied) {
    Object.keys(data.mitglied).forEach(key => {
      const value = data.mitglied[key] || '';
      const regex = new RegExp(`\\{\\{mitglied\\.${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
  }

  // Dojo placeholders
  if (data.dojo) {
    Object.keys(data.dojo).forEach(key => {
      const value = data.dojo[key] || '';
      const regex = new RegExp(`\\{\\{dojo\\.${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
  }

  // Contract placeholders
  if (data.vertrag) {
    Object.keys(data.vertrag).forEach(key => {
      const value = data.vertrag[key] || '';
      const regex = new RegExp(`\\{\\{vertrag\\.${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
  }

  return result;
}

// POST /api/mitglieder/:id/dokumente/generate
// Generate PDF from template and save it
router.post('/:id/dokumente/generate', async (req, res) => {
  const mitgliedId = req.params.id;
  const { vorlage_id, vertrag_id } = req.body;
  try {
    // Load template
    const [vorlagen] = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM vertragsvorlagen WHERE id = ?', [vorlage_id], (err, results) => {
        if (err) return reject(err);
        resolve([results]);
      });
    });

    if (vorlagen.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }

    const vorlage = vorlagen[0];

    // Load member and related data
    const mitgliedData = await getMemberData(mitgliedId);
    const vertragData = await getContractData(vertrag_id);

    // Prepare data for placeholder replacement
    const placeholderData = {
      mitglied: mitgliedData,
      dojo: {
        dojoname: mitgliedData.dojoname,
        inhaber: mitgliedData.inhaber,
        strasse: mitgliedData.dojo_strasse,
        hausnummer: mitgliedData.dojo_hausnummer,
        plz: mitgliedData.dojo_plz,
        ort: mitgliedData.dojo_ort,
        telefon: mitgliedData.dojo_telefon,
        email: mitgliedData.dojo_email
      },
      vertrag: vertragData,
      system: {
        datum: new Date().toLocaleDateString('de-DE'),
        uhrzeit: new Date().toLocaleTimeString('de-DE')
      }
    };

    // Replace placeholders in HTML and CSS
    let htmlContent = replacePlaceholders(vorlage.grapesjs_html, placeholderData);
    let cssContent = replacePlaceholders(vorlage.grapesjs_css || '', placeholderData);

    // Build complete HTML
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            ${cssContent}
            body { font-family: Arial, sans-serif; padding: 20px; }
            @page { margin: 2cm; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    // Generate PDF with Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    // Create documents directory
    const docsDir = await ensureDocumentsDir();

    // Generate filename
    const timestamp = Date.now();
    const filename = `${vorlage.name.replace(/[^a-zA-Z0-9]/g, '_')}_${mitgliedId}_${timestamp}.pdf`;
    const filepath = path.join(docsDir, filename);

    // Save PDF
    await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    });

    await browser.close();
    // Save document record to database
    const dokumentname = `${vorlage.name} - ${mitgliedData.vorname} ${mitgliedData.nachname}`;
    const relativePath = `generated_documents/${filename}`;

    await new Promise((resolve, reject) => {
      const insertQuery = `
        INSERT INTO mitglied_dokumente
        (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;

      db.query(
        insertQuery,
        [mitgliedId, mitgliedData.dojo_id, vorlage_id, dokumentname, relativePath],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });
    res.json({
      success: true,
      message: 'Dokument erfolgreich generiert',
      dokumentname: dokumentname
    });

  } catch (error) {
    logger.error('Fehler bei Dokumentgenerierung:', { error: error });
    res.status(500).json({
      error: 'Fehler bei Dokumentgenerierung',
      details: error.message
    });
  }
});

// GET /api/mitglieder/:id/dokumente
// List all documents for a member (including invoices)
router.get('/:id/dokumente', async (req, res) => {
  const mitgliedId = req.params.id;
  try {
    // Query für normale Dokumente
    const dokumenteQuery = `
      SELECT
        md.id,
        md.mitglied_id,
        md.dokumentname,
        md.dateipfad,
        md.erstellt_am,
        vv.name AS vorlage_name,
        vv.template_type,
        'dokument' AS typ
      FROM mitglied_dokumente md
      LEFT JOIN vertragsvorlagen vv ON md.vorlage_id = vv.id
      WHERE md.mitglied_id = ?
    `;

    // Query für Rechnungen
    const rechnungenQuery = `
      SELECT
        r.rechnung_id AS id,
        r.mitglied_id,
        CONCAT('Rechnung ', r.rechnungsnummer) AS dokumentname,
        NULL AS dateipfad,
        r.datum AS erstellt_am,
        NULL AS vorlage_name,
        NULL AS template_type,
        'rechnung' AS typ,
        r.rechnungsnummer,
        r.betrag,
        r.status
      FROM rechnungen r
      WHERE r.mitglied_id = ?
    `;

    // Beide Queries parallel ausführen
    db.query(dokumenteQuery, [mitgliedId], (err1, dokumente) => {
      if (err1) {
        logger.error('Fehler beim Laden der Dokumente:', { error: err1 });
        return res.status(500).json({ error: 'Fehler beim Laden der Dokumente' });
      }

      db.query(rechnungenQuery, [mitgliedId], (err2, rechnungen) => {
        if (err2) {
          logger.error('Fehler beim Laden der Rechnungen:', { error: err2 });
          return res.status(500).json({ error: 'Fehler beim Laden der Rechnungen' });
        }

        // Kombiniere beide Arrays und sortiere nach Datum
        const alleDokumente = [...dokumente, ...rechnungen]
          .sort((a, b) => new Date(b.erstellt_am) - new Date(a.erstellt_am));

        res.json({ success: true, data: alleDokumente });
      });
    });

  } catch (error) {
    logger.error('Fehler:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/mitglieder/:id/dokumente/:dokumentId/download
// Download a document
router.get('/:id/dokumente/:dokumentId/download', async (req, res) => {
  const { id: mitgliedId, dokumentId } = req.params;
  try {
    // Get document info from database
    const query = `
      SELECT * FROM mitglied_dokumente
      WHERE id = ? AND mitglied_id = ?
    `;

    db.query(query, [dokumentId, mitgliedId], async (err, results) => {
      if (err) {
        logger.error('Fehler beim Laden des Dokuments:', { error: err });
        return res.status(500).json({ error: 'Fehler beim Laden des Dokuments' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Dokument nicht gefunden' });
      }

      const dokument = results[0];
      const filepath = path.join(__dirname, '..', dokument.dateipfad);

      try {
        // Check if file exists
        await fs.access(filepath);

        // Send file
        res.download(filepath, `${dokument.dokumentname}.pdf`, (err) => {
          if (err) {
            logger.error('Fehler beim Download:', { error: err });
            if (!res.headersSent) {
              res.status(500).json({ error: 'Fehler beim Download' });
            }
          } else {
          }
        });

      } catch (fileErr) {
        logger.error('Datei nicht gefunden:', { error: filepath });
        res.status(404).json({ error: 'Datei nicht gefunden' });
      }
    });

  } catch (error) {
    logger.error('Fehler:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/mitglieder/:id/dokumente/:dokumentId
// Delete a document (admin only)
router.delete('/:id/dokumente/:dokumentId', async (req, res) => {
  const { id: mitgliedId, dokumentId } = req.params;
  try {
    // Get document info
    const selectQuery = `
      SELECT * FROM mitglied_dokumente
      WHERE id = ? AND mitglied_id = ?
    `;

    db.query(selectQuery, [dokumentId, mitgliedId], async (err, results) => {
      if (err) {
        logger.error('Fehler beim Laden des Dokuments:', { error: err });
        return res.status(500).json({ error: 'Fehler beim Laden des Dokuments' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Dokument nicht gefunden' });
      }

      const dokument = results[0];
      const filepath = path.join(__dirname, '..', dokument.dateipfad);

      try {
        // Delete file
        await fs.unlink(filepath);
      } catch (fileErr) {
      }

      // Delete database record
      const deleteQuery = 'DELETE FROM mitglied_dokumente WHERE id = ?';
      db.query(deleteQuery, [dokumentId], (err, result) => {
        if (err) {
          logger.error('Fehler beim Löschen aus Datenbank:', { error: err });
          return res.status(500).json({ error: 'Fehler beim Löschen' });
        }
        res.json({ success: true, message: 'Dokument erfolgreich gelöscht' });
      });
    });

  } catch (error) {
    logger.error('Fehler:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
