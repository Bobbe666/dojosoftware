// Backend/routes/dokumente.js
// API-Routen für Dokumenten-Management und PDF-Generierung

const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateMitgliedschaftsvertragPDF } = require('../services/vertragPdfGenerator');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// =====================================================
// GET /api/dokumente - Alle Dokumente abrufen
// =====================================================
router.get('/', authenticateToken, (req, res) => {
  const { typ, status } = req.query;
  const dojoId = req.dojo_id;

  // SECURITY: Multi-Tenancy - nur Dokumente des eigenen Dojos
  let query = 'SELECT * FROM dokumente WHERE dojo_id = ?';
  const params = [dojoId];

  if (typ && typ !== 'all') {
    query += ' AND typ = ?';
    params.push(typ);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  } else {
    query += ' AND status = "erstellt"';
  }

  query += ' ORDER BY erstellt_am DESC';

  req.db.query(query, params, (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen der Dokumente:', err);
      return res.status(500).json({ error: 'Datenbankfehler beim Laden der Dokumente' });
    }

    res.json(results);
  });
});

// =====================================================
// GET /api/dokumente/:id - Einzelnes Dokument abrufen
// =====================================================
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const query = 'SELECT * FROM dokumente WHERE id = ?';

  req.db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen des Dokuments:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    res.json(results[0]);
  });
});

// =====================================================
// POST /api/dokumente/generate - Neues Dokument generieren
// =====================================================
router.post('/generate', async (req, res) => {
  const { typ, name, parameter } = req.body;

  if (!typ || !name) {
    return res.status(400).json({ error: 'Typ und Name sind erforderlich' });
  }

  try {
    // Generiere eindeutigen Dateinamen
    const timestamp = Date.now();
    const dateiname = `${typ}_${timestamp}.pdf`;
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'dokumente');

    // Stelle sicher, dass der Ordner existiert
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const dateipfad = path.join(uploadsDir, dateiname);

    // Generiere PDF basierend auf Typ
    let pdfBuffer;
    switch (typ) {
      case 'mitgliederliste':
        pdfBuffer = await generateMitgliederlistePDF(req.db, parameter);
        break;
      case 'anwesenheit':
        pdfBuffer = await generateAnwesenheitPDF(req.db, parameter);
        break;
      case 'beitraege':
        pdfBuffer = await generateBeitraegePDF(req.db, parameter);
        break;
      case 'statistiken':
        pdfBuffer = await generateStatistikenPDF(req.db, parameter);
        break;
      case 'pruefungen':
        pdfBuffer = await generatePruefungsurkundePDF(req.db, parameter);
        break;
      case 'vertrag':
        pdfBuffer = await generateMitgliedschaftsvertragPDF(req.db, parameter);
        break;
      default:
        pdfBuffer = await generateCustomPDF(req.db, parameter);
    }

    // Speichere PDF-Datei
    fs.writeFileSync(dateipfad, pdfBuffer);
    const dateigroesse = fs.statSync(dateipfad).size;

    // Speichere Dokument-Metadaten in Datenbank
    const insertQuery = `
      INSERT INTO dokumente
      (name, typ, dateiname, dateipfad, dateigroesse, parameter, erstellt_von, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'erstellt')
    `;

    const parameterJson = JSON.stringify(parameter || {});
    const erstellt_von = req.user?.id || null; // Falls Auth-Middleware vorhanden

    req.db.query(
      insertQuery,
      [name, typ, dateiname, dateipfad, dateigroesse, parameterJson, erstellt_von],
      (err, result) => {
        if (err) {
          console.error('Fehler beim Speichern des Dokuments:', err);
          // Lösche die Datei, wenn DB-Insert fehlschlägt
          fs.unlinkSync(dateipfad);
          return res.status(500).json({ error: 'Fehler beim Speichern des Dokuments' });
        }

        res.status(201).json({
          id: result.insertId,
          name,
          typ,
          dateiname,
          dateigroesse,
          message: 'Dokument erfolgreich erstellt'
        });
      }
    );

  } catch (error) {
    console.error('Fehler bei der PDF-Generierung:', error);
    res.status(500).json({ error: 'Fehler bei der PDF-Generierung: ' + error.message });
  }
});

// =====================================================
// POST /api/dokumente/generate-all-dojos - Dokument für alle Dojos erstellen
// =====================================================
router.post('/generate-all-dojos', authenticateToken, async (req, res) => {
  const { typ, name, parameter, target_dojo_ids } = req.body;

  if (!typ || !name) {
    return res.status(400).json({ error: 'Typ und Name sind erforderlich' });
  }

  try {
    // Hole alle aktiven Dojos oder die angegebenen
    let dojoQuery = 'SELECT id, dojoname FROM dojo WHERE ist_aktiv = TRUE';
    let dojoParams = [];

    if (target_dojo_ids && target_dojo_ids.length > 0) {
      const placeholders = target_dojo_ids.map(() => '?').join(',');
      dojoQuery += ` AND id IN (${placeholders})`;
      dojoParams = target_dojo_ids;
    }

    const [dojos] = await req.db.promise().query(dojoQuery, dojoParams);

    if (dojos.length === 0) {
      return res.status(400).json({ error: 'Keine aktiven Dojos gefunden' });
    }

    const results = [];
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'dokumente');

    // Stelle sicher, dass der Ordner existiert
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generiere Dokument für jedes Dojo
    for (const dojo of dojos) {
      try {
        const timestamp = Date.now();
        const dateiname = `${typ}_dojo${dojo.id}_${timestamp}.pdf`;
        const dateipfad = path.join(uploadsDir, dateiname);

        // Parameter mit Dojo-Info erweitern
        const dojoParameter = {
          ...parameter,
          dojo_id: dojo.id,
          dojoname: dojo.dojoname
        };

        // Generiere PDF basierend auf Typ
        let pdfBuffer;
        switch (typ) {
          case 'mitgliederliste':
            pdfBuffer = await generateMitgliederlistePDFForDojo(req.db, dojo.id, dojoParameter);
            break;
          default:
            pdfBuffer = await generatePlaceholderPDF(`${name} - ${dojo.dojoname}`);
        }

        // Speichere PDF-Datei
        fs.writeFileSync(dateipfad, pdfBuffer);
        const dateigroesse = fs.statSync(dateipfad).size;

        // Speichere Dokument-Metadaten in Datenbank
        const insertQuery = `
          INSERT INTO dokumente
          (name, typ, dateiname, dateipfad, dateigroesse, parameter, dojo_id, erstellt_von, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'erstellt')
        `;

        const parameterJson = JSON.stringify(dojoParameter);
        const erstellt_von = req.user?.id || null;

        const [insertResult] = await req.db.promise().query(
          insertQuery,
          [`${name} - ${dojo.dojoname}`, typ, dateiname, dateipfad, dateigroesse, parameterJson, dojo.id, erstellt_von]
        );

        results.push({
          dojo_id: dojo.id,
          dojoname: dojo.dojoname,
          dokument_id: insertResult.insertId,
          status: 'success'
        });
      } catch (dojoErr) {
        console.error(`Fehler bei Dojo ${dojo.id}:`, dojoErr);
        results.push({
          dojo_id: dojo.id,
          dojoname: dojo.dojoname,
          status: 'error',
          error: dojoErr.message
        });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    res.status(201).json({
      message: `Dokumente erstellt: ${successful} erfolgreich, ${failed} fehlgeschlagen`,
      total: dojos.length,
      successful,
      failed,
      results
    });

  } catch (error) {
    console.error('Fehler bei Massen-PDF-Generierung:', error);
    res.status(500).json({ error: 'Fehler bei der Massen-PDF-Generierung: ' + error.message });
  }
});

// Mitgliederliste PDF für spezifisches Dojo
async function generateMitgliederlistePDFForDojo(db, dojoId, parameter = {}) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT m.*
      FROM mitglieder m
      WHERE m.status = 'aktiv'
      AND EXISTS (
        SELECT 1 FROM vertraege v
        WHERE v.mitglied_id = m.mitglied_id
        AND v.dojo_id = ?
        AND v.status = 'aktiv'
      )
      ORDER BY m.nachname, m.vorname
    `;

    db.query(query, [dojoId], (err, mitglieder) => {
      if (err) {
        return reject(err);
      }

      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Header mit Dojo-Name
        doc.fontSize(20).text(`Mitgliederliste - ${parameter.dojoname || 'Dojo'}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, { align: 'right' });
        doc.moveDown(2);

        // Tabellen-Header
        const startY = doc.y;
        const colWidths = { nr: 60, name: 150, vorname: 120, geburt: 100, email: 180, telefon: 120 };
        let x = 50;

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Nr.', x, startY, { width: colWidths.nr });
        x += colWidths.nr;
        doc.text('Nachname', x, startY, { width: colWidths.name });
        x += colWidths.name;
        doc.text('Vorname', x, startY, { width: colWidths.vorname });
        x += colWidths.vorname;
        doc.text('Geburtsdatum', x, startY, { width: colWidths.geburt });
        x += colWidths.geburt;
        doc.text('E-Mail', x, startY, { width: colWidths.email });
        x += colWidths.email;
        doc.text('Telefon', x, startY, { width: colWidths.telefon });

        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(750, doc.y).stroke();
        doc.moveDown(0.5);

        // Tabellen-Daten
        doc.font('Helvetica');
        mitglieder.forEach((mitglied, index) => {
          if (doc.y > 520) {
            doc.addPage({ layout: 'landscape' });
            doc.y = 50;
          }

          const y = doc.y;
          x = 50;

          doc.text(mitglied.mitgliedsnummer || (index + 1), x, y, { width: colWidths.nr });
          x += colWidths.nr;
          doc.text(mitglied.nachname || '', x, y, { width: colWidths.name });
          x += colWidths.name;
          doc.text(mitglied.vorname || '', x, y, { width: colWidths.vorname });
          x += colWidths.vorname;
          doc.text(mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : '', x, y, { width: colWidths.geburt });
          x += colWidths.geburt;
          doc.text(mitglied.email || '', x, y, { width: colWidths.email });
          x += colWidths.email;
          doc.text(mitglied.telefon || '', x, y, { width: colWidths.telefon });

          doc.moveDown();
        });

        // Footer
        doc.fontSize(8).text(`Gesamt: ${mitglieder.length} Mitglieder`, 50, doc.page.height - 50);

        doc.end();
      } catch (pdfError) {
        reject(pdfError);
      }
    });
  });
}

// =====================================================
// GET /api/dokumente/:id/download - Dokument herunterladen
// =====================================================
router.get('/:id/download', authenticateToken, (req, res) => {
  const { id } = req.params;
  const dojoId = req.dojo_id;

  // SECURITY: Multi-Tenancy Check - nur Dokumente des eigenen Dojos
  const query = 'SELECT * FROM dokumente WHERE id = ? AND dojo_id = ?';

  req.db.query(query, [id, dojoId], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Dokuments', {
        error: err.message,
        dokumentId: id,
        dojoId,
      });
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (results.length === 0) {
      logger.warn('Dokument nicht gefunden oder Zugriff verweigert', {
        dokumentId: id,
        dojoId,
        userId: req.user?.id,
      });
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    const dokument = results[0];

    // Prüfe ob Datei existiert
    if (!fs.existsSync(dokument.dateipfad)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    // Erhöhe Download-Counter
    req.db.query(
      'UPDATE dokumente SET downloads = downloads + 1 WHERE id = ?',
      [id],
      (updateErr) => {
        if (updateErr) {
          console.error('Fehler beim Aktualisieren des Download-Counters:', updateErr);
        }
      }
    );

    // Sende Datei
    res.download(dokument.dateipfad, dokument.dateiname, (downloadErr) => {
      if (downloadErr) {
        console.error('Fehler beim Download:', downloadErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Fehler beim Download' });
        }
      }
    });
  });
});

// =====================================================
// DELETE /api/dokumente/:id - Dokument löschen
// =====================================================
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // Hole Dokument-Info für Dateipfad
  const selectQuery = 'SELECT * FROM dokumente WHERE id = ?';

  req.db.query(selectQuery, [id], (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen des Dokuments:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    const dokument = results[0];

    // Soft-Delete: Status auf 'geloescht' setzen
    const updateQuery = 'UPDATE dokumente SET status = "geloescht" WHERE id = ?';

    req.db.query(updateQuery, [id], (updateErr) => {
      if (updateErr) {
        console.error('Fehler beim Löschen des Dokuments:', updateErr);
        return res.status(500).json({ error: 'Fehler beim Löschen' });
      }

      // Optional: Physische Datei löschen
      // if (fs.existsSync(dokument.dateipfad)) {
      //   fs.unlinkSync(dokument.dateipfad);
      // }

      res.json({ message: 'Dokument erfolgreich gelöscht' });
    });
  });
});

// =====================================================
// PDF-Generierungs-Funktionen
// =====================================================

// Mitgliederliste PDF
async function generateMitgliederlistePDF(db, parameter = {}) {
  return new Promise((resolve, reject) => {
    // Hole Mitglieder aus DB
    const query = 'SELECT * FROM mitglieder WHERE status = "aktiv" ORDER BY nachname, vorname';

    db.query(query, (err, mitglieder) => {
      if (err) {
        return reject(err);
      }

      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Header
        doc.fontSize(20).text('Mitgliederliste', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, { align: 'right' });
        doc.moveDown(2);

        // Tabellen-Header
        const startY = doc.y;
        const colWidths = { nr: 60, name: 150, vorname: 120, geburt: 100, email: 180, telefon: 120 };
        let x = 50;

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Nr.', x, startY, { width: colWidths.nr });
        x += colWidths.nr;
        doc.text('Nachname', x, startY, { width: colWidths.name });
        x += colWidths.name;
        doc.text('Vorname', x, startY, { width: colWidths.vorname });
        x += colWidths.vorname;
        doc.text('Geburtsdatum', x, startY, { width: colWidths.geburt });
        x += colWidths.geburt;
        doc.text('E-Mail', x, startY, { width: colWidths.email });
        x += colWidths.email;
        doc.text('Telefon', x, startY, { width: colWidths.telefon });

        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(750, doc.y).stroke();
        doc.moveDown(0.5);

        // Tabellen-Daten
        doc.font('Helvetica');
        mitglieder.forEach((mitglied, index) => {
          if (doc.y > 520) { // Neue Seite wenn nötig
            doc.addPage({ layout: 'landscape' });
            doc.y = 50;
          }

          const y = doc.y;
          x = 50;

          doc.text(mitglied.mitgliedsnummer || (index + 1), x, y, { width: colWidths.nr });
          x += colWidths.nr;
          doc.text(mitglied.nachname || '', x, y, { width: colWidths.name });
          x += colWidths.name;
          doc.text(mitglied.vorname || '', x, y, { width: colWidths.vorname });
          x += colWidths.vorname;
          doc.text(mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : '', x, y, { width: colWidths.geburt });
          x += colWidths.geburt;
          doc.text(mitglied.email || '', x, y, { width: colWidths.email });
          x += colWidths.email;
          doc.text(mitglied.telefon || '', x, y, { width: colWidths.telefon });

          doc.moveDown();
        });

        // Footer
        doc.fontSize(8).text(`Gesamt: ${mitglieder.length} Mitglieder`, 50, doc.page.height - 50);

        doc.end();
      } catch (pdfError) {
        reject(pdfError);
      }
    });
  });
}

// Placeholder-Funktionen für andere PDF-Typen
async function generateAnwesenheitPDF(db, parameter) {
  // TODO: Implementierung
  return generatePlaceholderPDF('Anwesenheitsbericht');
}

async function generateBeitraegePDF(db, parameter) {
  // TODO: Implementierung
  return generatePlaceholderPDF('Beitragsübersicht');
}

async function generateStatistikenPDF(db, parameter) {
  // TODO: Implementierung
  return generatePlaceholderPDF('Statistiken');
}

async function generatePruefungsurkundePDF(db, parameter) {
  // TODO: Implementierung
  return generatePlaceholderPDF('Prüfungsurkunde');
}

async function generateCustomPDF(db, parameter) {
  return generatePlaceholderPDF('Benutzerdefiniertes Dokument');
}

// Generische Placeholder PDF
async function generatePlaceholderPDF(title) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(25).text(title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Diese Funktion wird in Kürze verfügbar sein.', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' });

    doc.end();
  });
}

module.exports = router;
