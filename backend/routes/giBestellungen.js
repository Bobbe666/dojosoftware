const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

router.use(authenticateToken);

// GET / — alle Bestellungen (optional ?vorlage_id=X)
router.get('/', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const vorId = req.query.vorlage_id;
  const params = vorId ? [dojoId, vorId] : [dojoId];
  // WICHTIG: formdata (enthält Base64-Bilder, mehrere MB) NICHT in der Liste laden
  // → sonst lädt die Übersicht über langsame Leitungen ewig. Detail via GET /:id.
  const sql = `
    SELECT b.bestellung_id, b.dojo_id, b.vorlage_id, b.lieferant_id, b.lieferant_name,
           b.bestelldatum, b.lieferdatum, b.status, b.erstellt_am,
           l.firmenname AS lieferant_firmenname
    FROM gi_bestellungen b
    LEFT JOIN lieferanten l ON b.lieferant_id = l.lieferant_id
    WHERE b.dojo_id = ?
    ${vorId ? 'AND b.vorlage_id = ?' : ''}
    ORDER BY b.erstellt_am DESC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });
    res.json({ success: true, data: rows });
  });
});

// GET /:id — eine einzelne Bestellung MIT formdata (für Öffnen/Preview)
// POST /html-pdf — Bestell-HTML serverseitig zu echtem PDF rendern (Download-Button)
// MUSS vor den /:id-Routen stehen. Nutzt dasselbe Puppeteer-Muster wie vorlagenPdfGenerator.
router.post('/html-pdf', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) {
    console.warn('⚠️ html-pdf 400 (Dojo): user.rolle=', req.user?.rolle, 'user.dojo_id=', req.user?.dojo_id, 'query.dojo_id=', req.query.dojo_id);
    return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });
  }
  // Feld MUSS „pdfHtml" heißen: securityMonitor nimmt genau dieses Feld vom
  // XSS-/SQLi-Scan aus (PDF-HTML enthält legitime Script-/Style-Tags → False-Positive 400)
  const { pdfHtml, filename } = req.body || {};
  const html = pdfHtml;
  if (!html || typeof html !== 'string') {
    console.warn('⚠️ html-pdf 400 (HTML): typeof pdfHtml=', typeof pdfHtml,
      '| body-keys=', Object.keys(req.body || {}).join(','),
      '| content-type=', req.headers['content-type'],
      '| content-length=', req.headers['content-length']);
    return res.status(400).json({ success: false, message: 'HTML fehlt (Feld pdfHtml)' });
  }
  try {
    const puppeteer = require('puppeteer');
    // Script-Tags entfernen: print-helper.js löst window.print() aus → hängt in
    // Headless-Chrome (Navigation timeout). Fürs PDF-Rendern sind Scripts unnötig.
    const cleanHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(60000);
      await page.setContent(cleanHtml, { waitUntil: 'load', timeout: 60000 });
      // Auf Webfonts warten (falls eingebunden), dann kurz settlen lassen
      try { await page.evaluateHandle('document.fonts.ready'); } catch (_) {}
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      const safe = String(filename || 'bestellung').replace(/[^a-zA-Z0-9_\-]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safe}.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('❌ Gi-Bestellung PDF-Render fehlgeschlagen:', err);
    res.status(500).json({ success: false, message: 'PDF-Erstellung fehlgeschlagen', error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  db.query(
    `SELECT b.*, l.firmenname AS lieferant_firmenname
     FROM gi_bestellungen b
     LEFT JOIN lieferanten l ON b.lieferant_id = l.lieferant_id
     WHERE b.bestellung_id = ? AND b.dojo_id = ?`,
    [req.params.id, dojoId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });
      if (!rows.length) return res.status(404).json({ success: false, message: 'Bestellung nicht gefunden' });
      res.json({ success: true, data: rows[0] });
    }
  );
});

// POST / — neue Bestellung speichern
router.post('/', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const { vorlage_id, lieferant_id, lieferant_name, bestelldatum, lieferdatum, formdata } = req.body;

  db.query(
    `INSERT INTO gi_bestellungen (dojo_id, vorlage_id, lieferant_id, lieferant_name, bestelldatum, lieferdatum, formdata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [dojoId, vorlage_id || null, lieferant_id || null, lieferant_name || null, bestelldatum || null, lieferdatum || null,
     formdata ? JSON.stringify(formdata) : null],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });
      res.json({ success: true, bestellung_id: result.insertId });
    }
  );
});

// PUT /:id — Bestellung überschreiben (gleiche ID, neues formdata)
router.put('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const { lieferant_id, lieferant_name, bestelldatum, lieferdatum, status, formdata } = req.body;

  db.query(
    `UPDATE gi_bestellungen
     SET lieferant_id=?, lieferant_name=?, bestelldatum=?, lieferdatum=?,
         ${status ? 'status=?,' : ''} formdata=?
     WHERE bestellung_id=? AND dojo_id=?`,
    [
      lieferant_id || null, lieferant_name || null,
      bestelldatum || null, lieferdatum || null,
      ...(status ? [status] : []),
      formdata ? JSON.stringify(formdata) : null,
      req.params.id, dojoId,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Bestellung nicht gefunden' });
      res.json({ success: true });
    }
  );
});

// PATCH /:id/status — Status aktualisieren
router.patch('/:id/status', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const STATI = ['bestellt', 'bestaetigt', 'geliefert', 'storniert'];
  const { status } = req.body;
  if (!STATI.includes(status)) return res.status(400).json({ success: false, message: 'Ungültiger Status' });

  db.query(
    'UPDATE gi_bestellungen SET status = ? WHERE bestellung_id = ? AND dojo_id = ?',
    [status, req.params.id, dojoId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Bestellung nicht gefunden' });
      res.json({ success: true });
    }
  );
});

// DELETE /:id
router.delete('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  db.query(
    'DELETE FROM gi_bestellungen WHERE bestellung_id = ? AND dojo_id = ?',
    [req.params.id, dojoId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Bestellung nicht gefunden' });
      res.json({ success: true });
    }
  );
});

module.exports = router;
