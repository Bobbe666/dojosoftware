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
const { bannerUrlFor, renderEmail, getDojoMailTheme } = require('../../services/emailLayout');
const QRCode = require('qrcode');

// EPC/GiroCode-Payload für SEPA-Überweisung (in Banking-Apps scannbar)
function epcPayload({ name, iban, bic, amount, ref }) {
  return [
    'BCD', '002', '1', 'SCT',
    bic || '',
    (name || '').slice(0, 70),
    (iban || '').replace(/\s+/g, ''),
    'EUR' + Number(amount || 0).toFixed(2),
    '', '',
    (ref || '').slice(0, 140)
  ].join('\n');
}

// Erzeugt einen gehosteten GiroCode-QR (URL) – funktioniert in E-Mail UND PDF; null bei Lastschrift/ohne Bank.
const QR_PUBLIC_URL = process.env.PUBLIC_URL || 'https://dojo.tda-intl.org';
const QR_DIR = path.join(__dirname, '..', '..', 'uploads', 'rechnung-qr');
async function giroQr(rechnung) {
  try {
    if (rechnung.zahlungsart === 'lastschrift') return null;
    const dojoId = rechnung.resolved_dojo_id || rechnung.dojo_id;
    if (!dojoId) return null;
    const banks = await queryAsync(
      "SELECT iban, bic FROM dojo_banken WHERE dojo_id = ? AND iban IS NOT NULL AND iban <> '' AND ist_aktiv = 1 ORDER BY ist_standard DESC LIMIT 1",
      [dojoId]
    );
    const bank = banks[0];
    if (!bank || !bank.iban) return null;
    const amount = rechnung.brutto_betrag || rechnung.gesamtsumme || rechnung.betrag || 0;
    const payload = epcPayload({ name: rechnung.dojoname, iban: bank.iban, bic: bank.bic, amount, ref: rechnung.rechnungsnummer });
    await fs.mkdir(QR_DIR, { recursive: true });
    const safe = String(rechnung.rechnungsnummer || rechnung.rechnung_id || 'qr').replace(/[^a-zA-Z0-9_-]/g, '_');
    const datei = `giro-${safe}.png`;
    await QRCode.toFile(path.join(QR_DIR, datei), payload, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
    return { url: `${QR_PUBLIC_URL}/uploads/rechnung-qr/${datei}`, iban: bank.iban.replace(/(.{4})/g, '$1 ').trim(), bic: bank.bic || '' };
  } catch { return null; }
}

// Rechnung als Inline-HTML für den E-Mail-Body (sichtbar ohne Download), Mail-Layout-konform
function buildRechnungEmailBody(rechnung, positionen, theme, qr) {
  const fmt = (n) => parseFloat(n || 0).toFixed(2).replace('.', ',');
  const dfmt = (d) => { if (!d) return '-'; const t = new Date(d); return `${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}.${t.getFullYear()}`; };
  const perRate = {};
  positionen.forEach(p => { const r = parseFloat(p.mwst_satz ?? 19); perRate[r] = (perRate[r] || 0) + parseFloat(p.gesamtpreis || 0); });
  const netto = Object.values(perRate).reduce((s, v) => s + v, 0);
  let mwst = 0; Object.entries(perRate).forEach(([r, n]) => { mwst += n * (parseFloat(r) / 100); });
  const brutto = netto + mwst;
  const istKlein = rechnung.steuer_status === 'kleinunternehmer';
  const posRows = positionen.map(p => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #eef2f7;color:#334155;">${p.bezeichnung || ''}${p.beschreibung ? `<br><span style="color:#94a3b8;font-size:12px;">${p.beschreibung}</span>` : ''}</td>
      <td align="right" style="padding:8px 6px;border-bottom:1px solid #eef2f7;color:#334155;white-space:nowrap;">${p.menge}</td>
      <td align="right" style="padding:8px 6px;border-bottom:1px solid #eef2f7;color:#334155;white-space:nowrap;">${fmt(p.einzelpreis)} €</td>
      <td align="right" style="padding:8px 6px;border-bottom:1px solid #eef2f7;color:#334155;white-space:nowrap;">${fmt(p.gesamtpreis)} €</td>
    </tr>`).join('');
  let zahlteil;
  if (rechnung.zahlungsart === 'lastschrift') {
    zahlteil = `<div class="box"><p>Der Betrag wird per <strong style="color:#1e293b;">SEPA-Lastschrift</strong> eingezogen – du musst nichts weiter tun.</p></div>`;
  } else {
    zahlteil = `
      <div class="box">
        <p>Bitte überweise den Betrag bis zum <strong style="color:#1e293b;">${dfmt(rechnung.faelligkeitsdatum)}</strong>.</p>
        ${qr && qr.iban ? `<p style="margin:4px 0;"><strong style="color:#1e293b;">IBAN:</strong> ${qr.iban}${qr.bic ? ` &nbsp; <strong style="color:#1e293b;">BIC:</strong> ${qr.bic}` : ''}</p>` : ''}
        <p style="margin:4px 0;"><strong style="color:#1e293b;">Verwendungszweck:</strong> ${rechnung.rechnungsnummer}</p>
      </div>
      ${qr && qr.url ? `<table style="margin:6px 0;"><tr>
        <td style="vertical-align:middle;padding-right:12px;"><img src="${qr.url}" width="110" height="110" style="display:block;width:110px;height:110px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;" alt="QR-Code Überweisung" /></td>
        <td style="vertical-align:middle;font-size:13px;color:#475569;"><strong style="color:#1e293b;">Bequem per QR-Code zahlen</strong><br>Mit deiner Banking-App scannen – Betrag, IBAN und Verwendungszweck sind automatisch ausgefüllt.</td>
      </tr></table>` : ''}`;
  }
  return `
    <p style="font-size:16px;margin:0 0 14px;color:#1e293b;">Hallo ${rechnung.mitglied_name || ''},</p>
    <p style="margin:0 0 6px;">anbei deine Rechnung <strong style="color:#1e293b;">${rechnung.rechnungsnummer}</strong>. Die Rechnung findest du auch als PDF im Anhang.</p>
    <table class="data" style="width:100%;border-collapse:collapse;margin:12px 0;">
      <tr><td style="color:#64748b;">Rechnungsdatum</td><td align="right" style="color:#1e293b;">${dfmt(rechnung.datum)}</td></tr>
      <tr><td style="color:#64748b;">Liefer-/Leistungsdatum</td><td align="right" style="color:#1e293b;">${dfmt(rechnung.leistungsdatum || rechnung.datum)}</td></tr>
      <tr><td style="color:#64748b;">Fällig bis</td><td align="right" style="color:#1e293b;">${dfmt(rechnung.faelligkeitsdatum)}</td></tr>
    </table>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin:14px 0;font-size:13px;">
      <tr style="background:#1e293b;color:#fff;">
        <th align="left" style="padding:9px 6px;">Bezeichnung</th>
        <th align="right" style="padding:9px 6px;">Menge</th>
        <th align="right" style="padding:9px 6px;">Einzelpreis</th>
        <th align="right" style="padding:9px 6px;">Betrag</th>
      </tr>
      ${posRows}
    </table>
    <table role="presentation" width="100%" style="margin:8px 0 4px;font-size:13px;">
      <tr><td align="right" style="color:#64748b;padding:3px 6px;">Nettobetrag:</td><td align="right" style="width:120px;color:#334155;padding:3px 6px;">${fmt(netto)} €</td></tr>
      ${Object.entries(perRate).map(([r, n]) => `<tr><td align="right" style="color:#64748b;padding:3px 6px;">${r}% MwSt.:</td><td align="right" style="color:#334155;padding:3px 6px;">${fmt(n * (parseFloat(r) / 100))} €</td></tr>`).join('')}
      <tr><td align="right" style="font-weight:bold;color:#1e293b;border-top:2px solid ${theme.accent || '#DAA520'};padding:7px 6px;">Gesamtbetrag:</td><td align="right" style="font-weight:bold;font-size:16px;color:#1e293b;border-top:2px solid ${theme.accent || '#DAA520'};padding:7px 6px;">${fmt(brutto)} €</td></tr>
    </table>
    ${istKlein ? `<p style="font-size:12px;color:#64748b;">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</p>` : ''}
    ${zahlteil}
    <p style="margin:14px 0 0;">Bei Fragen stehen wir gerne zur Verfügung.</p>
    <p style="margin:12px 0 0;">Mit freundlichen Grüßen<br><strong style="color:#1e293b;">${rechnung.dojoname || ''}</strong></p>`;
}

function buildRechnungHTML(rechnung, positionen, qr = null) {
  // Header-Banner wie in der E-Mail-Rechnung (Anlass 'rechnung', pro Dojo); Fallback = Schiefer-Header
  const dojoIdForBanner = rechnung.resolved_dojo_id || rechnung.dojo_id || 0;
  const bannerUrl = bannerUrlFor('dojo', 'rechnung', dojoIdForBanner);
  const fmt = (n) => parseFloat(n || 0).toFixed(2).replace('.', ',');
  // DIN 5008: Datum mit führenden Nullen TT.MM.JJJJ
  const datumFmt = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
  };
  // Leistungszeitraum aus den Positions-Beschreibungen ableiten (z. B. Monate/Tage)
  const istKleinunternehmer = rechnung.steuer_status === 'kleinunternehmer';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>Rechnung ${rechnung.rechnungsnummer}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.5; color: #475569; background: #fff; }

    /* Banner-Bild wie in der E-Mail-Rechnung */
    .invoice-banner-img { display: block; width: 100%; height: auto; border: 0; }

    /* Marken-Header (Schiefer/Gold – Fallback wenn kein Banner) */
    .invoice-banner {
      background: #1e293b;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #fff;
      padding: 22px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #DAA520;
    }
    .invoice-banner .company-name { font-size: 15pt; font-weight: bold; letter-spacing: 0.3px; color: #fff; }
    .invoice-banner .company-addr { font-size: 8.5pt; color: rgba(255,255,255,0.72); margin-top: 4px; }
    .invoice-banner .invoice-label { font-size: 17pt; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; color: #DAA520; }

    /* Inhalt */
    .content { padding: 26px 32px; max-width: 210mm; margin: 0 auto; }

    .addr-meta { display: flex; justify-content: space-between; margin-bottom: 28px; }
    .addr-line { font-size: 7.5pt; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 10px; }
    .recipient { font-size: 10pt; line-height: 1.7; color: #1e293b; }
    .meta-block { text-align: right; font-size: 9pt; line-height: 1.85; }
    .meta-block .meta-label { color: #94a3b8; font-size: 8pt; }
    .meta-block strong { color: #1e293b; }

    h2.rechnung-title { font-size: 15pt; color: #1e293b; margin: 16px 0 14px; border-left: 4px solid #DAA520; padding-left: 12px; }

    table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 9pt; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    thead tr { background: #1e293b; color: #fff; }
    th { padding: 9px 8px; text-align: left; font-weight: 600; font-size: 8.5pt; letter-spacing: 0.03em; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    td { padding: 9px 8px; border-bottom: 1px solid #eef2f7; color: #334155; }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: right; }

    .totals { margin-left: auto; width: 50%; font-size: 9.5pt; margin-top: 6px; page-break-inside: avoid; break-inside: avoid; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eef2f7; color: #475569; }
    .totals-row.final { font-weight: bold; font-size: 12pt; border-top: 2px solid #DAA520; border-bottom: none; margin-top: 4px; padding-top: 8px; color: #1e293b; }

    .payment-terms { margin-top: 20px; padding: 13px 16px; background: #f0f9ff; border-left: 4px solid #DAA520; border-radius: 0 6px 6px 0; font-size: 9pt; color: #334155; page-break-inside: avoid; break-inside: avoid; }
    .payment-terms p + p { margin-top: 5px; }
    .payment-terms table { page-break-inside: avoid; break-inside: avoid; }
    .payment-terms strong { color: #1e293b; }

    .footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #eef2f7; font-size: 8pt; color: #94a3b8; text-align: center; line-height: 1.6; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 0; }
    }
  </style>
</head>
<body>
  ${bannerUrl
    ? `<img class="invoice-banner-img" src="${bannerUrl}" alt="${rechnung.dojoname || 'Rechnung'}" />`
    : `<div class="invoice-banner">
    <div>
      <div class="company-name">${rechnung.dojoname || ''}</div>
      <div class="company-addr">${rechnung.dojo_strasse || ''} ${rechnung.dojo_hausnummer || ''} &bull; ${rechnung.dojo_plz || ''} ${rechnung.dojo_ort || ''}</div>
    </div>
    <div class="invoice-label">Rechnung</div>
  </div>`}

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
        <div><span class="meta-label">Rechnungsdatum:</span> ${datumFmt(rechnung.datum)}</div>
        <div><span class="meta-label">Liefer-/Leistungsdatum:</span> ${datumFmt(rechnung.leistungsdatum || rechnung.datum)}</div>
        <div><span class="meta-label">Faellig bis:</span> ${datumFmt(rechnung.faelligkeitsdatum)}</div>
      </div>
    </div>

    <h2 class="rechnung-title">Rechnung ${rechnung.rechnungsnummer}</h2>

    ${(() => {
      // Gruppiere Positionen nach MwSt-Satz
      const rateLabels = {};
      let labelIdx = 0;
      const letters = ['A','B','C','D'];
      positionen.forEach(pos => {
        const rate = parseFloat(pos.mwst_satz ?? 19);
        if (rateLabels[rate] === undefined) {
          rateLabels[rate] = letters[labelIdx++] || String(labelIdx);
        }
      });
      const multiRate = Object.keys(rateLabels).length > 1;

      // Netto-Summen pro MwSt-Gruppe
      const nettoPerRate = {};
      positionen.forEach(pos => {
        const rate = parseFloat(pos.mwst_satz ?? 19);
        nettoPerRate[rate] = (nettoPerRate[rate] || 0) + parseFloat(pos.gesamtpreis || 0);
      });

      const totalNetto = Object.values(nettoPerRate).reduce((s, v) => s + v, 0);
      let totalMwst = 0;
      Object.entries(nettoPerRate).forEach(([rate, netto]) => {
        totalMwst += netto * (parseFloat(rate) / 100);
      });
      const totalBrutto = totalNetto + totalMwst;

      const posRows = positionen.map(pos => {
        const rate = parseFloat(pos.mwst_satz ?? 19);
        const label = rateLabels[rate];
        return `<tr>
          <td>${pos.position_nr}</td>
          <td>${pos.bezeichnung}${pos.beschreibung ? `<br><span style="font-size:0.85em;color:#555">${pos.beschreibung}</span>` : ''}</td>
          <td style="text-align:right">${pos.menge}</td>
          <td style="text-align:right">${fmt(pos.einzelpreis)}</td>
          ${multiRate ? `<td style="text-align:center">${label}</td>` : ''}
          <td style="text-align:right">${fmt(pos.gesamtpreis)}</td>
        </tr>`;
      }).join('');

      const mwstRows = Object.entries(nettoPerRate).map(([rate, netto]) => {
        const label = rateLabels[parseFloat(rate)];
        const mwstBetrag = netto * (parseFloat(rate) / 100);
        return `<div class="totals-row">
          <span>${multiRate ? `${label} ` : ''}${rate}% MwSt.:</span>
          <span>${fmt(mwstBetrag)} &euro;</span>
        </div>`;
      }).join('');

      return `
    <table>
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Bezeichnung</th>
          <th style="text-align:right">Menge</th>
          <th style="text-align:right">Einzelpreis</th>
          ${multiRate ? '<th style="text-align:center">St.</th>' : ''}
          <th style="text-align:right">Betrag EUR</th>
        </tr>
      </thead>
      <tbody>${posRows}</tbody>
    </table>
    ${multiRate ? `<div style="font-size:8pt;color:#666;margin-bottom:0.5rem">${Object.entries(rateLabels).map(([rate,lbl]) => `${lbl} = ${rate}% MwSt.`).join(' &nbsp;|&nbsp; ')}</div>` : ''}
    <div class="totals">
      <div class="totals-row">
        <span>Nettobetrag:</span>
        <span>${fmt(totalNetto)} &euro;</span>
      </div>
      ${mwstRows}
      <div class="totals-row final">
        <span>Gesamtbetrag:</span>
        <span>${fmt(totalBrutto)} &euro;</span>
      </div>
    </div>`;
    })()}

    <div class="payment-terms">
      <p><strong>Zahlungsbedingung:</strong> Ohne Abzug bis zum ${datumFmt(rechnung.faelligkeitsdatum)}.</p>
      ${istKleinunternehmer ? `<p>Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</p>` : ''}
      ${rechnung.dojo_email ? `<p>Kontakt: ${rechnung.dojo_email}</p>` : ''}
      ${qr && qr.url ? `
      <table style="margin-top:10px;"><tr>
        <td style="vertical-align:middle;padding-right:12px;"><img src="${qr.url}" width="96" height="96" style="display:block;width:96px;height:96px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;" alt="QR-Code Überweisung" /></td>
        <td style="vertical-align:middle;font-size:8.5pt;color:#475569;"><strong style="color:#1e293b;">Bequem per QR-Code zahlen</strong><br>Mit der Banking-App scannen – IBAN, Betrag und Verwendungszweck (${rechnung.rechnungsnummer}) sind dann automatisch ausgefüllt.</td>
      </tr></table>` : ''}
    </div>

    <div class="footer">
      ${rechnung.dojoname || ''} &bull; ${rechnung.dojo_strasse || ''} ${rechnung.dojo_hausnummer || ''}, ${rechnung.dojo_plz || ''} ${rechnung.dojo_ort || ''}
      ${(rechnung.steuernummer || rechnung.umsatzsteuer_id) ? `<br>${rechnung.steuernummer ? `Steuernummer: ${rechnung.steuernummer}` : ''}${(rechnung.steuernummer && rechnung.umsatzsteuer_id) ? ' &bull; ' : ''}${rechnung.umsatzsteuer_id ? `USt-IdNr.: ${rechnung.umsatzsteuer_id}` : ''}` : ''}
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
      d.email AS dojo_email,
      d.steuernummer, d.umsatzsteuer_id, d.steuer_status
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

      giroQr(rechnung).then((qr) => {
        const html = buildRechnungHTML(rechnung, positionen, qr);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      }).catch(() => {
        const html = buildRechnungHTML(rechnung, positionen, null);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      });
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
        d.plz AS dojo_plz, d.ort AS dojo_ort, d.email AS dojo_email,
        d.steuernummer, d.umsatzsteuer_id, d.steuer_status
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

    const dojoId = rechnung.resolved_dojo_id;
    const qr = await giroQr(rechnung);
    const html = buildRechnungHTML(rechnung, positionen, qr);

    // PDF mit Puppeteer generieren
    // Wichtig: goto mit data:-URL statt setContent — einziger zuverlässiger UTF-8-Fix für Puppeteer
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    await browser.close();

    // E-Mail-Body: Rechnung INLINE sichtbar (Mail-Layout) + PDF im Anhang
    const theme = await getDojoMailTheme({ dojoId, dojoname: rechnung.dojoname });
    const emailBody = renderEmail({
      theme, anlass: 'rechnung', titel: 'Rechnung',
      bodyHtml: buildRechnungEmailBody(rechnung, positionen, theme, qr)
    });

    await sendEmailForDojo({
      to: zielEmail,
      subject: `Rechnung ${rechnung.rechnungsnummer}`,
      html: emailBody,
      text: `Hallo ${rechnung.mitglied_name},\n\nanbei deine Rechnung ${rechnung.rechnungsnummer} über ${parseFloat(rechnung.betrag).toFixed(2)} €. Details siehe E-Mail und PDF im Anhang.\n\nMit freundlichen Grüßen\n${rechnung.dojoname || ''}`,
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

// PATCH /:id/empfaenger-email — E-Mail-Adresse am Empfänger hinterlegen
router.patch('/:id/empfaenger-email', async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  try {
    const rows = await queryAsync('SELECT mitglied_id FROM rechnungen WHERE rechnung_id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    if (rows[0].mitglied_id) {
      await queryAsync('UPDATE mitglieder SET email = ? WHERE mitglied_id = ?', [email, rows[0].mitglied_id]);
    } else {
      await queryAsync('UPDATE rechnungen SET extern_email = ? WHERE rechnung_id = ?', [email, id]);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /:id/positionen-kategorien — Buchungskategorie pro Position + globaler Default speichern
router.patch('/:id/positionen-kategorien', async (req, res) => {
  const { id } = req.params;
  const { buchungskategorie_default, positionen_kategorien } = req.body;
  try {
    await queryAsync(
      'UPDATE rechnungen SET buchungskategorie_default = ? WHERE rechnung_id = ?',
      [buchungskategorie_default || null, id]
    );
    if (Array.isArray(positionen_kategorien)) {
      for (const pos of positionen_kategorien) {
        await queryAsync(
          'UPDATE rechnungspositionen SET buchungskategorie = ? WHERE position_id = ?',
          [pos.buchungskategorie || null, pos.position_id]
        );
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.buildRechnungHTML = buildRechnungHTML;
module.exports.buildRechnungEmailBody = buildRechnungEmailBody;
module.exports.giroQr = giroQr;
