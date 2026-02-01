/**
 * Prüfungen Routes - Index
 * Kombiniert alle Prüfungs-Sub-Router
 *
 * Struktur:
 * - termine.js    : Prüfungstermine Verwaltung
 * - kandidaten.js : Prüfungskandidaten und Zulassungen
 * - historie.js   : Prüfungshistorie und historische Prüfungen
 * - stats.js      : Prüfungsstatistiken
 * - crud.js       : Basis CRUD-Operationen und Aktionen
 */

const express = require('express');
const router = express.Router();

// Sub-Router importieren
const termineRoutes = require('./termine');
const kandidatenRoutes = require('./kandidaten');
const historieRoutes = require('./historie');
const statsRoutes = require('./stats');
const crudRoutes = require('./crud');

// Zusätzliche Dependencies für PDF-Generierung
const db = require('../../db');
const logger = require('../../utils/logger');
const { ERROR_MESSAGES, HTTP_STATUS } = require('../../utils/constants');

// ============================================================================
// Sub-Router einbinden (WICHTIG: Reihenfolge beachten!)
// Spezifische Routen müssen VOR generischen /:id Routen kommen!
// ============================================================================

// Termine-Routes: /api/pruefungen/termine/*
router.use('/termine', termineRoutes);

// Kandidaten-Routes: /api/pruefungen/kandidaten/*
router.use('/kandidaten', kandidatenRoutes);

// Historie-Routes: /api/pruefungen/mitglied/:id/historie, /api/pruefungen/historisch/*
router.use('/', historieRoutes);

// Stats-Routes: /api/pruefungen/stats/*
router.use('/stats', statsRoutes);

// CRUD und Aktions-Routes: /api/pruefungen/, /api/pruefungen/:id, etc.
// Diese kommen zuletzt, da sie generische /:id Parameter haben
router.use('/', crudRoutes);

// ============================================================================
// ZUSÄTZLICHE ROUTES (Termine-PDF)
// ============================================================================

/**
 * GET /api/pruefungen/termine/:datum/pdf
 * Generiert eine PDF mit allen Prüfungsteilnehmern für einen bestimmten Termin
 */
router.get('/termine/:datum/pdf', (req, res) => {
  const { datum } = req.params;
  const { stil_id, dojo_id } = req.query;

  logger.debug('PDF-Anfrage:', { datum, stil_id, dojo_id });

  const query = `
    SELECT
      p.pruefung_id,
      p.mitglied_id,
      m.vorname,
      m.nachname,
      m.geburtsdatum,
      g_vorher.name AS aktuelle_graduierung,
      g_nachher.name AS ziel_graduierung,
      p.pruefungsdatum,
      s.name AS stil_name,
      pt.pruefungszeit,
      pt.pruefungsort,
      pt.pruefungsgebuehr,
      d.dojoname AS dojo_name,
      p.gebuehr_bezahlt
    FROM pruefungen p
    INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
    LEFT JOIN graduierungen g_vorher ON p.graduierung_vorher_id = g_vorher.graduierung_id
    LEFT JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
    INNER JOIN stile s ON p.stil_id = s.stil_id
    LEFT JOIN pruefungstermin_vorlagen pt ON DATE(p.pruefungsdatum) = DATE(pt.pruefungsdatum) AND p.stil_id = pt.stil_id
    LEFT JOIN dojo d ON p.dojo_id = d.id
    WHERE DATE(p.pruefungsdatum) = ?
      AND p.stil_id = ?
      AND p.dojo_id = ?
      AND p.status IN ('geplant', 'durchgefuehrt', 'bestanden', 'nicht_bestanden')
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, [datum, stil_id, dojo_id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Prüfungsteilnehmer:', { error: err });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERAL.LOADING_ERROR,
        details: err.message
      });
    }

    if (results.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Keine Teilnehmer für diesen Termin gefunden'
      });
    }

    // Generiere PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Pruefungsliste_${datum}_${results[0].stil_name}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // PDF Inhalt
    const teilnehmer = results[0];

    // Header
    doc.fontSize(20).text('Prüfungsteilnehmerliste', { align: 'center' });
    doc.moveDown(0.5);

    // Termin-Infos
    doc.fontSize(12);
    doc.text(`Datum: ${new Date(datum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    doc.text(`Uhrzeit: ${teilnehmer.pruefungszeit || 'Nicht angegeben'}`);
    doc.text(`Ort: ${teilnehmer.pruefungsort || 'Nicht angegeben'}`);
    doc.text(`Stil: ${teilnehmer.stil_name}`);
    doc.text(`Dojo: ${teilnehmer.dojo_name}`);
    if (teilnehmer.pruefungsgebuehr) {
      doc.text(`Prüfungsgebühr: ${teilnehmer.pruefungsgebuehr}€`);
    }
    doc.text(`Anzahl Teilnehmer: ${results.length}`);
    doc.moveDown(1);

    // Tabellen-Header
    const tableTop = doc.y;
    const col1X = 50;   // Nr.
    const col2X = 80;   // Name
    const col3X = 230;  // Geburtsdatum
    const col4X = 320;  // Aktuell
    const col5X = 410;  // Ziel
    const col6X = 500;  // Bezahlt

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Nr.', col1X, tableTop);
    doc.text('Name', col2X, tableTop);
    doc.text('Geb.', col3X, tableTop);
    doc.text('Aktuell', col4X, tableTop);
    doc.text('Ziel', col5X, tableTop);
    doc.text('Bezahlt', col6X, tableTop);

    doc.moveTo(col1X, tableTop + 15).lineTo(560, tableTop + 15).stroke();
    doc.moveDown(0.5);

    // Teilnehmer-Liste
    doc.font('Helvetica');
    results.forEach((teilnehmer, index) => {
      const y = doc.y;

      // Neue Seite wenn nötig
      if (y > 700) {
        doc.addPage();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Nr.', col1X, 50);
        doc.text('Name', col2X, 50);
        doc.text('Geb.', col3X, 50);
        doc.text('Aktuell', col4X, 50);
        doc.text('Ziel', col5X, 50);
        doc.text('Bezahlt', col6X, 50);
        doc.moveTo(col1X, 65).lineTo(560, 65).stroke();
        doc.font('Helvetica').moveDown(0.5);
      }

      const currentY = doc.y;
      doc.text(index + 1, col1X, currentY);
      doc.text(`${teilnehmer.nachname}, ${teilnehmer.vorname}`, col2X, currentY, { width: 140 });
      doc.text(teilnehmer.geburtsdatum ? new Date(teilnehmer.geburtsdatum).toLocaleDateString('de-DE') : '-', col3X, currentY);
      doc.text(teilnehmer.aktuelle_graduierung || '-', col4X, currentY, { width: 80 });
      doc.text(teilnehmer.ziel_graduierung || '-', col5X, currentY, { width: 80 });
      doc.text(teilnehmer.gebuehr_bezahlt ? 'Ja' : 'Nein', col6X, currentY);

      doc.moveDown(0.8);
    });

    // Unterschriften-Bereich
    doc.moveDown(3);
    doc.fontSize(10);
    doc.text('_'.repeat(40), 50, doc.y);
    doc.moveDown(0.3);
    doc.text('Prüfer / Datum / Unterschrift', 50, doc.y);

    // Finalize PDF
    doc.end();
  });
});

module.exports = router;
