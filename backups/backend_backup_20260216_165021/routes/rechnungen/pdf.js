/**
 * Rechnungen PDF Routes
 * Vorschau und PDF-Download
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../../utils/logger');
const { queryAsync } = require('./shared');

// GET /:id/vorschau - HTML-Vorschau für Rechnung (zum Anzeigen/Drucken)
router.get('/:id/vorschau', (req, res) => {
  const { id } = req.params;

  // Lade Rechnung mit allen Details
  const rechnungQuery = `
    SELECT
      r.*,
      CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
      m.email,
      m.strasse,
      m.hausnummer,
      m.plz,
      m.ort,
      d.dojoname,
      d.strasse AS dojo_strasse,
      d.hausnummer AS dojo_hausnummer,
      d.plz AS dojo_plz,
      d.ort AS dojo_ort,
      d.telefon AS dojo_telefon,
      d.email AS dojo_email
    FROM rechnungen r
    JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    LEFT JOIN dojo d ON m.dojo_id = d.id
    WHERE r.rechnung_id = ?
  `;

  db.query(rechnungQuery, [id], (err, rechnungResults) => {
    if (err) {
      logger.error('Fehler beim Laden der Rechnung:', { error: err });
      return res.status(500).send('Fehler beim Laden der Rechnung');
    }

    if (rechnungResults.length === 0) {
      return res.status(404).send('Rechnung nicht gefunden');
    }

    const rechnung = rechnungResults[0];

    // Lade Positionen
    const positionenQuery = `SELECT * FROM rechnungspositionen WHERE rechnung_id = ? ORDER BY position_nr`;

    db.query(positionenQuery, [id], (posErr, positionen) => {
      if (posErr) {
        logger.error('Fehler beim Laden der Positionen:', { error: posErr });
        return res.status(500).send('Fehler beim Laden der Positionen');
      }

      // Erstelle HTML für Rechnung
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${rechnung.rechnungsnummer}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
      padding: 20mm;
      max-width: 210mm;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3rem;
    }
    .company-small {
      font-size: 8pt;
      color: #666;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #000;
    }
    .recipient {
      margin-top: 1rem;
      line-height: 1.6;
    }
    .meta {
      text-align: right;
      font-size: 9pt;
      line-height: 1.8;
    }
    h1 {
      font-size: 18pt;
      margin: 2rem 0 1rem 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
      font-size: 9pt;
    }
    thead {
      background: #f3f4f6;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    th {
      padding: 0.5rem 0.25rem;
      text-align: left;
      font-weight: bold;
      font-size: 8pt;
    }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) {
      text-align: right;
    }
    td {
      padding: 0.5rem 0.25rem;
      border-bottom: 1px solid #e5e7eb;
    }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) {
      text-align: right;
    }
    .totals {
      margin-left: auto;
      width: 50%;
      font-size: 10pt;
      margin-top: 2rem;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.final {
      font-weight: bold;
      font-size: 11pt;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
    }
    .payment-terms {
      margin-top: 2rem;
      font-size: 9pt;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 20mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-small">
        ${rechnung.dojoname || ''} | ${rechnung.dojo_strasse || ''} ${rechnung.dojo_hausnummer || ''} | ${rechnung.dojo_plz || ''} ${rechnung.dojo_ort || ''}
      </div>
      <div class="recipient">
        <div>Herrn/Frau</div>
        <div>${rechnung.mitglied_name}</div>
        <div>${rechnung.strasse || ''} ${rechnung.hausnummer || ''}</div>
        <div>${rechnung.plz || ''} ${rechnung.ort || ''}</div>
      </div>
    </div>
    <div class="meta">
      <div>Rechnungs-Nr.: ${rechnung.rechnungsnummer}</div>
      <div>Kundennummer: ${rechnung.mitglied_id}</div>
      <div>Belegdatum: ${new Date(rechnung.datum).toLocaleDateString('de-DE')}</div>
      <div>Fälligkeit: ${rechnung.faelligkeitsdatum ? new Date(rechnung.faelligkeitsdatum).toLocaleDateString('de-DE') : '-'}</div>
    </div>
  </div>

  <h1>Rechnung</h1>

  <table>
    <thead>
      <tr>
        <th>Pos.</th>
        <th>Bezeichnung</th>
        <th>Menge</th>
        <th>Preis</th>
        <th>Betrag EUR</th>
      </tr>
    </thead>
    <tbody>
      ${positionen.map(pos => `
        <tr>
          <td>${pos.position_nr}</td>
          <td>${pos.bezeichnung}</td>
          <td>${pos.menge}</td>
          <td>${parseFloat(pos.einzelpreis || 0).toFixed(2)}</td>
          <td>${parseFloat(pos.gesamtpreis || 0).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Nettobetrag:</span>
      <span>${parseFloat(rechnung.netto_betrag || 0).toFixed(2)} €</span>
    </div>
    <div class="totals-row">
      <span>${rechnung.mwst_satz || 19}% MwSt.:</span>
      <span>${parseFloat(rechnung.mwst_betrag || 0).toFixed(2)} €</span>
    </div>
    <div class="totals-row final">
      <span>Endbetrag:</span>
      <span>${parseFloat(rechnung.brutto_betrag || rechnung.betrag || 0).toFixed(2)} €</span>
    </div>
  </div>

  <div class="payment-terms">
    <p>Bitte beachten Sie unsere Zahlungsbedingung:</p>
    <p>Ohne Abzug bis zum ${rechnung.faelligkeitsdatum ? new Date(rechnung.faelligkeitsdatum).toLocaleDateString('de-DE') : '___________'}.</p>
  </div>
</body>
</html>
      `;

      res.send(html);
    });
  });
});

// GET /:id/pdf - PDF-Download für Rechnung (aus gespeichertem Dokument)
router.get('/:id/pdf', async (req, res) => {
  const { id } = req.params;

  try {
    // Hole Rechnungsnummer für Suche
    const rechnungResults = await queryAsync(
      'SELECT rechnungsnummer, mitglied_id FROM rechnungen WHERE rechnung_id = ?',
      [id]
    );

    if (rechnungResults.length === 0) {
      return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    }
    const rechnung = rechnungResults[0];

    // Suche nach gespeichertem PDF in mitglied_dokumente
    const dokumentResults = await queryAsync(
      `SELECT dateipfad, dokumentname
       FROM mitglied_dokumente
       WHERE mitglied_id = ?
         AND dokumentname LIKE ?
       ORDER BY erstellt_am DESC
       LIMIT 1`,
      [rechnung.mitglied_id, `Rechnung ${rechnung.rechnungsnummer}%`]
    );

    const dokument = dokumentResults.length > 0 ? dokumentResults[0] : null;

    if (!dokument) {
      return res.status(404).json({
        error: 'PDF nicht gefunden',
        message: 'Für diese Rechnung wurde noch kein PDF gespeichert. Bitte erstellen Sie die Rechnung neu.'
      });
    }

    // Erstelle vollständigen Dateipfad
    const filepath = path.join(__dirname, '..', '..', dokument.dateipfad);

    // Prüfe ob Datei existiert
    const fileExists = await fs.access(filepath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(404).json({
        error: 'PDF-Datei nicht gefunden',
        message: 'Die PDF-Datei existiert nicht mehr auf dem Server.'
      });
    }

    // Lese PDF-Datei
    const pdfBuffer = await fs.readFile(filepath);

    // Sende PDF mit korrekten Headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Rechnung_${rechnung.rechnungsnummer.replace(/[\/\\]/g, '_')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(pdfBuffer);

    logger.info(`PDF für Rechnung ${rechnung.rechnungsnummer} erfolgreich gesendet`);

  } catch (error) {
    logger.error('Fehler beim PDF-Abruf:', { error: error });
    res.status(500).json({ error: 'Fehler beim PDF-Abruf', details: error.message });
  }
});

module.exports = router;
