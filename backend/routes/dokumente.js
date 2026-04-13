// Backend/routes/dokumente.js
// API-Routen für Dokumenten-Management und PDF-Generierung

const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateMitgliedschaftsvertragPDF } = require('../services/vertragPdfGenerator');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const logger = require('../utils/logger');

// =====================================================
// GET /api/dokumente - Alle Dokumente abrufen
// =====================================================
router.get('/', authenticateToken, (req, res) => {
  const { typ, status } = req.query;
  const dojoId = getSecureDojoId(req);

  // SECURITY: Multi-Tenancy - nur Dokumente des eigenen Dojos
  let query = dojoId
    ? 'SELECT * FROM dokumente WHERE dojo_id = ?'
    : 'SELECT * FROM dokumente WHERE 1=1';
  const params = dojoId ? [dojoId] : [];

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
      logger.error('Fehler beim Abrufen der Dokumente:', { error: err });
      return res.status(500).json({ error: 'Datenbankfehler beim Laden der Dokumente' });
    }

    res.json(results);
  });
});

// =====================================================
// GET /api/dokumente/zentrale/stats - Statistiken für DokumentenZentrale
// =====================================================
router.get('/zentrale/stats', authenticateToken, async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const pool = req.db.promise();

    const dojoFilter = dojoId ? ' WHERE dojo_id = ?' : '';
    const dojoParams = dojoId ? [dojoId] : [];

    // Alle Zähler parallel abfragen
    const [
      [vorlagenResult],
      [vertragsvorlagenResult],
      [absenderResult]
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM dokument_vorlagen${dojoFilter}`, dojoParams),
      pool.query(`SELECT COUNT(*) as count FROM vertragsvorlagen${dojoFilter}`, dojoParams),
      pool.query(`SELECT COUNT(*) as count FROM absender_profile${dojoFilter}`, dojoParams)
    ]);

    res.json({
      vorlagen: vorlagenResult[0]?.count || 0,
      vertragsvorlagen: vertragsvorlagenResult[0]?.count || 0,
      absenderProfile: absenderResult[0]?.count || 0
    });
  } catch (error) {
    logger.error('Fehler beim Laden der DokumentenZentrale-Stats', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

// =====================================================
// GET /api/dokumente/:id - Einzelnes Dokument abrufen
// =====================================================
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const query = 'SELECT * FROM dokumente WHERE id = ?';

  req.db.query(query, [id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Dokuments:', { error: err });
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
router.post('/generate', authenticateToken, async (req, res) => {
  const { typ, name, parameter } = req.body;

  if (!typ || !name) {
    return res.status(400).json({ error: 'Typ und Name sind erforderlich' });
  }

  try {
    const dojoId = getSecureDojoId(req);

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
        pdfBuffer = await generateMitgliederlistePDF(req.db, { ...parameter, dojoId });
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
      (name, typ, dateiname, dateipfad, dateigroesse, parameter, dojo_id, erstellt_von, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'erstellt')
    `;

    const parameterJson = JSON.stringify(parameter || {});
    const erstellt_von = req.user?.id || null;

    req.db.query(
      insertQuery,
      [name, typ, dateiname, dateipfad, dateigroesse, parameterJson, dojoId, erstellt_von],
      (err, result) => {
        if (err) {
          logger.error('Fehler beim Speichern des Dokuments:', { error: err });
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
    logger.error('Fehler bei der PDF-Generierung:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Interner Serverfehler' });
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
        logger.error('Fehler bei Dojo ${dojo.id}:', { error: dojoErr });
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
    logger.error('Fehler bei Massen-PDF-Generierung:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Interner Serverfehler' });
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
          logger.error('Fehler beim Aktualisieren des Download-Counters:', { error: updateErr });
        }
      }
    );

    // Sende Datei
    res.download(dokument.dateipfad, dokument.dateiname, (downloadErr) => {
      if (downloadErr) {
        logger.error('Fehler beim Download:', { error: downloadErr });
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
      logger.error('Fehler beim Abrufen des Dokuments:', { error: err });
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
        logger.error('Fehler beim Löschen des Dokuments:', { error: updateErr });
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
    const { dojoId } = parameter;
    const dojoFilter = dojoId ? ' AND dojo_id = ?' : '';
    const dojoParams = dojoId ? [dojoId] : [];
    const query = `SELECT * FROM mitglieder WHERE aktiv = 1${dojoFilter} ORDER BY nachname, vorname`;

    db.query(query, dojoParams, (err, mitglieder) => {
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

async function generateAnwesenheitPDF(db, parameter) {
  return new Promise((resolve, reject) => {
    const dojoId = parameter && parameter.dojo_id;
    const vonDatum = parameter && parameter.von ? parameter.von : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const bisDatum = parameter && parameter.bis ? parameter.bis : new Date().toISOString().slice(0, 10);
    const where = dojoId ? 'WHERE DATE(c.checkin_time) BETWEEN ? AND ? AND m.dojo_id = ?' : 'WHERE DATE(c.checkin_time) BETWEEN ? AND ?';
    const params = dojoId ? [vonDatum, bisDatum, dojoId] : [vonDatum, bisDatum];
    db.query(
      'SELECT m.nachname, m.vorname, DATE(c.checkin_time) as datum, TIME(c.checkin_time) as uhrzeit ' +
      'FROM checkins c JOIN mitglieder m ON c.mitglied_id = m.mitglied_id ' + where +
      ' ORDER BY c.checkin_time DESC LIMIT 500',
      params,
      (err, rows) => {
        if (err) return reject(err);
        try {
          const doc = new PDFDocument({ margin: 50, size: 'A4' });
          const chunks = [];
          doc.on('data', c => chunks.push(c));
          doc.on('end', () => resolve(Buffer.concat(chunks)));

          doc.fontSize(18).font('Helvetica-Bold').text('Anwesenheitsbericht', { align: 'center' });
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica').text(`Zeitraum: ${vonDatum} bis ${bisDatum}`, { align: 'center' });
          doc.moveDown(1.5);

          const headers = ['Nachname', 'Vorname', 'Datum', 'Uhrzeit'];
          const widths = [150, 130, 110, 100];
          let x = 50; const y = doc.y;
          doc.font('Helvetica-Bold').fontSize(10);
          headers.forEach((h, i) => { doc.text(h, x, y, { width: widths[i] }); x += widths[i]; });
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
          doc.moveDown(0.3);

          doc.font('Helvetica').fontSize(9);
          rows.forEach(row => {
            if (doc.y > 750) { doc.addPage(); }
            const ry = doc.y; x = 50;
            doc.text(row.nachname || '', x, ry, { width: widths[0] }); x += widths[0];
            doc.text(row.vorname || '', x, ry, { width: widths[1] }); x += widths[1];
            doc.text(row.datum ? new Date(row.datum).toLocaleDateString('de-DE') : '', x, ry, { width: widths[2] }); x += widths[2];
            doc.text(row.uhrzeit ? String(row.uhrzeit).slice(0, 5) : '', x, ry, { width: widths[3] });
            doc.moveDown(0.5);
          });

          doc.fontSize(8).text('Gesamt: ' + rows.length + ' Eintraege', 50, doc.page.height - 40);
          doc.end();
        } catch (e) { reject(e); }
      }
    );
  });
}

async function generateBeitraegePDF(db, parameter) {
  return new Promise((resolve, reject) => {
    const dojoId = parameter && parameter.dojo_id;
    const nurOffene = parameter && parameter.nur_offene;
    let where = nurOffene ? 'WHERE b.bezahlt = 0' : 'WHERE 1=1';
    const params = [];
    if (dojoId) { where += ' AND b.dojo_id = ?'; params.push(dojoId); }
    db.query(
      'SELECT m.nachname, m.vorname, b.betrag, b.zahlungsdatum, b.zahlungsart, b.bezahlt ' +
      'FROM beitraege b JOIN mitglieder m ON b.mitglied_id = m.mitglied_id ' + where +
      ' ORDER BY b.bezahlt ASC, b.zahlungsdatum ASC LIMIT 1000',
      params,
      (err, rows) => {
        if (err) return reject(err);
        try {
          const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
          const chunks = [];
          doc.on('data', c => chunks.push(c));
          doc.on('end', () => resolve(Buffer.concat(chunks)));

          const titel = nurOffene ? 'Offene Beitraege' : 'Beitragsübersicht';
          doc.fontSize(18).font('Helvetica-Bold').text(titel, { align: 'center' });
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica').text('Stand: ' + new Date().toLocaleDateString('de-DE'), { align: 'center' });
          doc.moveDown(1.5);

          const headers = ['Nachname', 'Vorname', 'Betrag', 'Faellig am', 'Zahlungsart', 'Status'];
          const widths = [140, 120, 80, 110, 120, 80];
          let x = 50; const y = doc.y;
          doc.font('Helvetica-Bold').fontSize(10);
          headers.forEach((h, i) => { doc.text(h, x, y, { width: widths[i] }); x += widths[i]; });
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(750, doc.y).stroke();
          doc.moveDown(0.3);

          let summe = 0;
          doc.font('Helvetica').fontSize(9);
          rows.forEach(row => {
            if (doc.y > 540) { doc.addPage({ layout: 'landscape' }); }
            const ry = doc.y; x = 50;
            doc.text(row.nachname || '', x, ry, { width: widths[0] }); x += widths[0];
            doc.text(row.vorname || '', x, ry, { width: widths[1] }); x += widths[1];
            const betrag = parseFloat(row.betrag) || 0;
            summe += betrag;
            doc.text(betrag.toFixed(2) + ' EUR', x, ry, { width: widths[2] }); x += widths[2];
            doc.text(row.zahlungsdatum ? new Date(row.zahlungsdatum).toLocaleDateString('de-DE') : '–', x, ry, { width: widths[3] }); x += widths[3];
            doc.text(row.zahlungsart || '–', x, ry, { width: widths[4] }); x += widths[4];
            doc.text(row.bezahlt ? 'bezahlt' : 'offen', x, ry, { width: widths[5] });
            doc.moveDown(0.5);
          });

          doc.moveDown(0.5);
          doc.moveTo(50, doc.y).lineTo(750, doc.y).stroke();
          doc.moveDown(0.3);
          doc.font('Helvetica-Bold').fontSize(10).text('Gesamt: ' + rows.length + ' Posten | Summe: ' + summe.toFixed(2) + ' EUR', 50);
          doc.end();
        } catch (e) { reject(e); }
      }
    );
  });
}

async function generateStatistikenPDF(db, parameter) {
  return new Promise((resolve, reject) => {
    const dojoId = parameter && parameter.dojo_id;
    const cond = dojoId ? ' WHERE dojo_id = ?' : '';
    const p = dojoId ? [dojoId] : [];
    Promise.all([
      new Promise((res, rej) => db.query('SELECT COUNT(*) as n FROM mitglieder' + cond, p, (e, r) => e ? rej(e) : res(r[0].n))),
      new Promise((res, rej) => db.query('SELECT COUNT(*) as n FROM mitglieder' + (dojoId ? ' WHERE dojo_id = ? AND aktiv = 1' : ' WHERE aktiv = 1'), p, (e, r) => e ? rej(e) : res(r[0].n))),
      new Promise((res, rej) => db.query('SELECT COUNT(*) as n FROM checkins' + (dojoId ? ' WHERE mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)' : ''), p, (e, r) => e ? rej(e) : res(r[0].n))),
      new Promise((res, rej) => db.query('SELECT COUNT(*) as n FROM beitraege' + (dojoId ? ' WHERE dojo_id = ? AND bezahlt = 0' : ' WHERE bezahlt = 0'), p, (e, r) => e ? rej(e) : res(r[0].n))),
    ]).then(([gesamt, aktiv, checkins, offeneBeitraege]) => {
      try {
        const doc = new PDFDocument({ margin: 60, size: 'A4' });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        doc.fontSize(22).font('Helvetica-Bold').text('Dojo-Statistiken', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text('Stand: ' + new Date().toLocaleDateString('de-DE'), { align: 'center' });
        doc.moveDown(2);

        const stats = [
          ['Mitglieder gesamt', String(gesamt)],
          ['Aktive Mitglieder', String(aktiv)],
          ['Inaktive Mitglieder', String(gesamt - aktiv)],
          ['Check-ins gesamt', String(checkins)],
          ['Offene Beitraege', String(offeneBeitraege)],
        ];

        doc.font('Helvetica-Bold').fontSize(12);
        stats.forEach(([label, wert]) => {
          const y = doc.y;
          doc.text(label, 60, y, { width: 280 });
          doc.text(wert, 340, y, { width: 100 });
          doc.moveDown(0.8);
        });

        doc.end();
      } catch (e) { reject(e); }
    }).catch(reject);
  });
}

async function generatePruefungsurkundePDF(db, parameter) {
  return new Promise((resolve, reject) => {
    const mitgliedId = parameter && parameter.mitglied_id;
    if (!mitgliedId) return resolve(generatePlaceholderPDF('Pruefungsurkunde (keine mitglied_id angegeben)'));
    db.query(
      'SELECT m.vorname, m.nachname, m.geburtsdatum, g.name as guertel, g.farbe_hex, ' +
      'p.datum as pruefungsdatum, p.bestanden ' +
      'FROM mitglieder m ' +
      'LEFT JOIN guertelgrade g ON m.guertel_id = g.id ' +
      'LEFT JOIN pruefungen p ON p.mitglied_id = m.mitglied_id ' +
      'WHERE m.mitglied_id = ? ORDER BY p.datum DESC LIMIT 1',
      [mitgliedId],
      (err, rows) => {
        if (err) return reject(err);
        if (!rows || rows.length === 0) return resolve(generatePlaceholderPDF('Mitglied nicht gefunden'));
        const m = rows[0];
        try {
          const doc = new PDFDocument({ margin: 70, size: 'A4' });
          const chunks = [];
          doc.on('data', c => chunks.push(c));
          doc.on('end', () => resolve(Buffer.concat(chunks)));

          // Rahmen
          doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke();
          doc.rect(35, 35, doc.page.width - 70, doc.page.height - 70).stroke();

          doc.moveDown(2);
          doc.fontSize(28).font('Helvetica-Bold').text('Pruefungsurkunde', { align: 'center' });
          doc.moveDown(1.5);
          doc.fontSize(14).font('Helvetica').text('Diese Urkunde wird verliehen an', { align: 'center' });
          doc.moveDown(0.8);
          doc.fontSize(22).font('Helvetica-Bold').text((m.vorname || '') + ' ' + (m.nachname || ''), { align: 'center' });
          doc.moveDown(1);
          doc.fontSize(13).font('Helvetica').text('fuer das erfolgreiche Bestehen der Pruefung zum', { align: 'center' });
          doc.moveDown(0.8);
          doc.fontSize(18).font('Helvetica-Bold').text(m.guertel || 'Guertelgrad', { align: 'center' });
          doc.moveDown(1.5);
          if (m.pruefungsdatum) {
            doc.fontSize(11).font('Helvetica').text('Datum: ' + new Date(m.pruefungsdatum).toLocaleDateString('de-DE'), { align: 'center' });
          }
          doc.moveDown(3);
          doc.fontSize(10).text('_______________________________', { align: 'center' });
          doc.moveDown(0.3);
          doc.fontSize(10).text('Unterschrift Pruefer', { align: 'center' });

          doc.end();
        } catch (e) { reject(e); }
      }
    );
  });
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
