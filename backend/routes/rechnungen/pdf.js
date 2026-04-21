/**
 * Rechnungen PDF Routes
 * Vorschau, PDF-Download und E-Mail-Versand
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../../utils/logger');
const { queryAsync } = require('./shared');
const { sendEmailForDojo } = require('../../services/emailService');

function buildRechnungHTML(rechnung, positionen) {
  const fmt = (n) => parseFloat(n || 0).toFixed(2).replace('.', ',');
  const datumFmt = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>Rechnung ${rechnung.rechnungsnummer}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #1a1a1a; background: #fff; }

    /* Roter Header-Banner */
    .invoice-banner {
      background: #c0392b;
      color: #fff;
      padding: 1.2rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .invoice-banner .company-name {
      font-size: 14pt;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .invoice-banner .company-addr {
      font-size: 8.5pt;
      opacity: 0.9;
      margin-top: 3px;
    }
    .invoice-banner .invoice-label {
      font-size: 18pt;
      font-weight: bold;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    /* Inhalt */
    .content { padding: 1.5rem 2rem; max-width: 210mm; margin: 0 auto; }

    .addr-meta { display: flex; justify-content: space-between; margin-bottom: 2rem; }
    .addr-line { font-size: 7.5pt; color: #666; border-bottom: 1px solid #c0392b; padding-bottom: 3px; margin-bottom: 8px; }
    .recipient { font-size: 10pt; line-height: 1.7; }
    .meta-block { text-align: right; font-size: 9pt; line-height: 1.8; }
    .meta-block .meta-label { color: #666; font-size: 8pt; }

    h2.rechnung-title { font-size: 16pt; color: #c0392b; margin: 1.5rem 0 1rem; border-left: 4px solid #c0392b; padding-left: 0.75rem; }

    table { width: 100%; border-collapse: collapse; margin: 1rem 0 1.5rem; font-size: 9pt; }
    thead tr { background: #c0392b; color: #fff; }
    th { padding: 0.5rem 0.4rem; text-align: left; font-weight: 600; font-size: 8.5pt; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    tbody tr:nth-child(even) { background: #fafafa; }
    td { padding: 0.45rem 0.4rem; border-bottom: 1px solid #e5e7eb; }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: right; }

    .totals { margin-left: auto; width: 48%; font-size: 9.5pt; margin-top: 0.5rem; }
    .totals-row { display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid #e5e7eb; }
    .totals-row.final { font-weight: bold; font-size: 11pt; border-top: 2px solid #c0392b; border-bottom: 2px solid #c0392b; margin-top: 0.4rem; padding-top: 0.4rem; color: #c0392b; }

    .payment-terms { margin-top: 1.5rem; padding: 0.75rem 1rem; background: #fff5f5; border-left: 3px solid #c0392b; font-size: 9pt; }
    .payment-terms p + p { margin-top: 4px; }

    .footer { margin-top: 2rem; padding-top: 0.75rem; border-top: 1px solid #eee; font-size: 8pt; color: #888; text-align: center; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-banner">
    <div>
      <div class="company-name">${rechnung.dojoname || ''}</div>
      <div class="company-addr">${rechnung.dojo_strasse || ''} ${rechnung.dojo_hausnummer || ''} &bull; ${rechnung.dojo_plz || ''} ${rechnung.dojo_ort || ''}</div>
    </div>
    <div class="invoice-label">Rechnung</div>
  </div>

  <div class="content">
    <div class="addr-meta">
      <div>
        <div class="addr-line">${rechnung.dojoname || ''} &bull; ${rechnung.dojo_strasse || ''} ${rechnung.dojo_hausnummer || ''} &bull; ${rechnung.dojo_plz || ''} ${rechnung.dojo_ort || ''}</div>
        <div class="recipient">
          <div>${rechnung.mitglied_name || ''}</div>
          <div>${rechnung.strasse || ''} ${rechnung.hausnummer || ''}</div>
          <div>${rechnung.plz || ''} ${rechnung.ort || ''}</div>
        </div>
      </div>
      <div class="meta-block">
        <div><span class="meta-label">Rechnungs-Nr.:</span> <strong>${rechnung.rechnungsnummer}</strong></div>
        ${rechnung.mitglied_id ? `<div><span class="meta-label">Kundennummer:</span> ${rechnung.mitglied_id}</div>` : ''}
        <div><span class="meta-label">Datum:</span> ${datumFmt(rechnung.datum)}</div>
        <div><span class="meta-label">Faellig bis:</span> ${datumFmt(rechnung.faelligkeitsdatum)}</div>
      </div>
    </div>

    <h2 class="rechnung-title">Rechnung ${rechnung.rechnungsnummer}</h2>

    <table>
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Bezeichnung</th>
          <th>Menge</th>
          <th>Einzelpreis</th>
          <th>Betrag EUR</th>
        </tr>
      </thead>
      <tbody>
        ${positionen.map(pos => `
          <tr>
            <td>${pos.position_nr}</td>
            <td>${pos.bezeichnung}</td>
            <td>${pos.menge}</td>
            <td>${fmt(pos.einzelpreis)}</td>
            <td>${fmt(pos.gesamtpreis)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Nettobetrag:</span>
        <span>${fmt(rechnung.netto_betrag)} &euro;</span>
      </div>
      <div class="totals-row">
        <span>${rechnung.mwst_satz || 19}% MwSt.:</span>
        <span>${fmt(rechnung.mwst_betrag)} &euro;</span>
      </div>
      <div class="totals-row final">
        <span>Gesamtbetrag:</span>
        <span>${fmt(rechnung.brutto_betrag || rechnung.betrag)} &euro;</span>
      </div>
    </div>

    <div class="payment-terms">
      <p><strong>Zahlungsbedingung:</strong> Ohne Abzug bis zum ${datumFmt(rechnung.faelligkeitsdatum)}.</p>
      ${rechnung.dojo_email ? `<p>Kontakt: ${rechnung.dojo_email}</p>` : ''}
    </div>

    <div class="footer">
      ${rechnung.dojoname || ''} &bull; ${rechnung.dojo_strasse || ''} ${rechnung.dojo_hausnummer || ''}, ${rechnung.dojo_plz || ''} ${rechnung.dojo_ort || ''}
    </div>
  </div>
</body>
</html>`;
}

// GET /:id/vorschau - HTML-Vorschau für Rechnung (zum Anzeigen/Drucken)
router.get('/:id/vorschau', (req, res) => {
  const { id } = req.params;

  // Lade Rechnung mit allen Details
  const rechnungQuery = `
    SELECT
      r.*,
      COALESCE(CONCAT(m.vorname, ' ', m.nachname), r.extern_name) as mitglied_name,
      COALESCE(m.email, r.extern_email) as email,
      m.strasse,
      m.hausnummer,
      m.plz,
      m.ort,
      COALESCE(m.dojo_id, r.dojo_id) AS resolved_dojo_id,
      d.dojoname,
      d.strasse AS dojo_strasse,
      d.hausnummer AS dojo_hausnummer,
      d.plz AS dojo_plz,
      d.ort AS dojo_ort,
      d.telefon AS dojo_telefon,
      d.email AS dojo_email
    FROM rechnungen r
    LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    LEFT JOIN dojo d ON COALESCE(m.dojo_id, r.dojo_id) = d.id
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

      const html = buildRechnungHTML(rechnung, positionen);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
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

// POST /:id/email-senden - Rechnung als PDF per E-Mail versenden
router.post('/:id/email-senden', async (req, res) => {
  const { id } = req.params;
  const { an_email } = req.body; // optionale Override-Adresse

  try {
    const puppeteer = require('puppeteer');

    // Lade Rechnung
    const results = await queryAsync(`
      SELECT r.*,
        COALESCE(CONCAT(m.vorname, ' ', m.nachname), r.extern_name) as mitglied_name,
        COALESCE(m.email, r.extern_email) as empfaenger_email,
        m.strasse, m.hausnummer, m.plz, m.ort,
        COALESCE(m.dojo_id, r.dojo_id) AS resolved_dojo_id,
        d.dojoname, d.strasse AS dojo_strasse, d.hausnummer AS dojo_hausnummer,
        d.plz AS dojo_plz, d.ort AS dojo_ort, d.email AS dojo_email
      FROM rechnungen r
      LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      LEFT JOIN dojo d ON COALESCE(m.dojo_id, r.dojo_id) = d.id
      WHERE r.rechnung_id = ?
    `, [id]);

    if (results.length === 0) return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    const rechnung = results[0];

    const positionen = await queryAsync(
      'SELECT * FROM rechnungspositionen WHERE rechnung_id = ? ORDER BY position_nr', [id]
    );

    const zielEmail = an_email || rechnung.empfaenger_email;
    if (!zielEmail) return res.status(400).json({ error: 'Keine E-Mail-Adresse hinterlegt' });

    const html = buildRechnungHTML(rechnung, positionen);

    // PDF mit Puppeteer generieren
    // Wichtig: goto mit data:-URL statt setContent — einziger zuverlässiger UTF-8-Fix für Puppeteer
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    await browser.close();

    const dojoId = rechnung.resolved_dojo_id;
    const datumStr = new Date(rechnung.datum).toLocaleDateString('de-DE');

    await sendEmailForDojo({
      to: zielEmail,
      subject: `Rechnung ${rechnung.rechnungsnummer}`,
      html: `<p>Sehr geehrte/r ${rechnung.mitglied_name},</p>
<p>anbei erhalten Sie Ihre Rechnung <strong>${rechnung.rechnungsnummer}</strong> vom ${datumStr} über <strong>${parseFloat(rechnung.betrag).toFixed(2).replace('.', ',')} €</strong>.</p>
<p>Bitte überweisen Sie den Betrag bis zum ${rechnung.faelligkeitsdatum ? new Date(rechnung.faelligkeitsdatum).toLocaleDateString('de-DE') : '-'}.</p>
<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
<p>Mit freundlichen Grüßen<br>${rechnung.dojoname || ''}</p>`,
      text: `Sehr geehrte/r ${rechnung.mitglied_name},\n\nanbei Ihre Rechnung ${rechnung.rechnungsnummer} vom ${datumStr} über ${parseFloat(rechnung.betrag).toFixed(2)} €.\n\nMit freundlichen Grüßen\n${rechnung.dojoname || ''}`,
      attachments: [{
        filename: `Rechnung_${rechnung.rechnungsnummer.replace(/[\/\\]/g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    }, dojoId);

    // E-Mail-Versand protokollieren
    try {
      const pool = db.promise();
      await pool.execute(
        'INSERT INTO rechnung_aktionen (rechnung_id, aktion_typ, erstellt_von) VALUES (?, "email_gesendet", ?)',
        [id, req.user?.id || null]
      );
    } catch (logErr) {
      logger.warn('E-Mail-Aktion konnte nicht geloggt werden:', { error: logErr.message });
    }

    logger.info(`Rechnung ${rechnung.rechnungsnummer} per E-Mail an ${zielEmail} gesendet`);
    res.json({ success: true, message: `Rechnung erfolgreich an ${zielEmail} gesendet` });

  } catch (error) {
    logger.error('Fehler beim E-Mail-Versand der Rechnung:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim E-Mail-Versand', details: error.message });
  }
});

module.exports = router;
