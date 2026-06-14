// Self-Service-Quittungen für Mitglieder: bezahlte Beiträge/Posten als PDF ziehen.
// WICHTIG: Wird NICHT gespeichert — nur on-the-fly erzeugt und zum Download gestreamt.
// Mitglied entscheidet: Jahr, Umfang (nur Monatsbeiträge | alle bezahlten Posten),
// Einzel- oder Gesamtquittung. Auto-gemountet unter /api/quittungen.
const express = require('express');
const router = express.Router();
const db = require('../db');
const pool = db.promise();
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

const euro = (n) => Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const dmy = (d) => {
  if (!d) return '';
  const s = (d instanceof Date) ? d.toISOString() : String(d);
  const [y, m, day] = s.split('T')[0].split('-');
  return day && m && y ? `${day}.${m}.${y}` : s;
};
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Bezahlte Posten des eingeloggten Mitglieds (eigene Daten erzwungen via Token-mitglied_id)
async function ladePosten(mitgliedId, jahr, umfang, einzel) {
  const nurBeitraege = umfang !== 'alle';
  const [beitraege] = await pool.query(
    `SELECT 'beitrag' AS typ, beitrag_id AS id, betrag, DATE_FORMAT(zahlungsdatum, '%Y-%m-%d') AS datum, zahlungsart, beschreibung, art
       FROM beitraege
      WHERE mitglied_id = ? AND bezahlt = 1 AND zahlungsdatum IS NOT NULL
        ${jahr ? 'AND YEAR(zahlungsdatum) = ?' : ''}
        ${nurBeitraege ? "AND art = 'mitgliedsbeitrag'" : ''}
        ${einzel && einzel.typ === 'beitrag' ? 'AND beitrag_id = ?' : ''}
      ORDER BY zahlungsdatum ASC`,
    [mitgliedId, ...(jahr ? [jahr] : []), ...(einzel && einzel.typ === 'beitrag' ? [einzel.id] : [])]
  );
  let rechnungen = [];
  if (!nurBeitraege) {
    [rechnungen] = await pool.query(
      `SELECT 'rechnung' AS typ, rechnung_id AS id, COALESCE(gesamtsumme, betrag) AS betrag,
              DATE_FORMAT(bezahlt_am, '%Y-%m-%d') AS datum, zahlungsart, beschreibung, art
         FROM rechnungen
        WHERE mitglied_id = ? AND status = 'bezahlt' AND bezahlt_am IS NOT NULL
          ${jahr ? 'AND YEAR(bezahlt_am) = ?' : ''}
          ${einzel && einzel.typ === 'rechnung' ? 'AND rechnung_id = ?' : ''}
        ORDER BY bezahlt_am ASC`,
      [mitgliedId, ...(jahr ? [jahr] : []), ...(einzel && einzel.typ === 'rechnung' ? [einzel.id] : [])]
    );
  }
  if (einzel) {
    return [...beitraege, ...rechnungen].filter(p => p.typ === einzel.typ && String(p.id) === String(einzel.id));
  }
  return [...beitraege, ...rechnungen].sort((a, b) => new Date(a.datum) - new Date(b.datum));
}

function bezeichnung(p) {
  if (p.beschreibung) return p.beschreibung;
  if (p.art === 'mitgliedsbeitrag') return 'Mitgliedsbeitrag';
  if (p.art === 'pruefungsgebuehr') return 'Prüfungsgebühr';
  if (p.typ === 'rechnung') return 'Rechnung';
  return 'Beitrag';
}

// GET /api/quittungen/posten?jahr=&umfang=  → Liste + verfügbare Jahre + Summe
router.get('/posten', async (req, res) => {
  const mitgliedId = req.user?.mitglied_id;
  if (!mitgliedId) return res.status(403).json({ success: false, error: 'Kein Mitglied im Token' });
  const jahr = parseInt(req.query.jahr, 10) || new Date().getFullYear();
  const umfang = req.query.umfang === 'alle' ? 'alle' : 'beitraege';
  try {
    const [jb] = await pool.query("SELECT DISTINCT YEAR(zahlungsdatum) j FROM beitraege WHERE mitglied_id=? AND bezahlt=1 AND zahlungsdatum IS NOT NULL", [mitgliedId]);
    const [jr] = await pool.query("SELECT DISTINCT YEAR(bezahlt_am) j FROM rechnungen WHERE mitglied_id=? AND status='bezahlt' AND bezahlt_am IS NOT NULL", [mitgliedId]);
    const jahre = [...new Set([...jb, ...jr].map(x => x.j).filter(Boolean))].sort((a, b) => b - a);
    const posten = await ladePosten(mitgliedId, jahr, umfang, null);
    const summe = posten.reduce((s, p) => s + parseFloat(p.betrag || 0), 0);
    res.json({
      success: true, jahre, jahr, umfang, summe,
      posten: posten.map(p => ({ typ: p.typ, id: p.id, datum: dmy(p.datum), betrag: parseFloat(p.betrag || 0), zahlungsart: p.zahlungsart || null, bezeichnung: bezeichnung(p) })),
    });
  } catch (e) {
    logger.error('Quittung /posten Fehler:', { error: e.message });
    res.status(500).json({ success: false, error: 'Fehler beim Laden der bezahlten Posten' });
  }
});

// Puppeteer warm halten (Launch dauert 1–3s) — Lazy-Init, bei Crash neu.
// Launch ist serialisiert (_pdfLaunching), damit nicht mehrere gleichzeitige
// Requests parallel je einen Browser-Kaltstart anstoßen (CPU-Spike → Event-Loop-Freeze).
let _pdfBrowser = null;
let _pdfLaunching = null;
async function getPdfBrowser() {
  if (_pdfBrowser && _pdfBrowser.connected) return _pdfBrowser;
  if (_pdfLaunching) return _pdfLaunching;          // bereits ein Launch unterwegs → mitnutzen
  const puppeteer = require('puppeteer');
  _pdfLaunching = puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] })
    .then(b => { _pdfBrowser = b; _pdfLaunching = null; return b; })
    .catch(e => { _pdfLaunching = null; throw e; });
  return _pdfLaunching;
}

// Concurrency-Begrenzung: max. 2 PDFs gleichzeitig rendern, Rest wartet in Queue.
// Verhindert, dass viele parallele Quittungs-Downloads den Server überlasten.
let _pdfActive = 0;
const _pdfQueue = [];
const MAX_PDF_CONCURRENT = 2;
function acquirePdfSlot() {
  if (_pdfActive < MAX_PDF_CONCURRENT) { _pdfActive++; return Promise.resolve(); }
  return new Promise(resolve => _pdfQueue.push(resolve));
}
function releasePdfSlot() {
  const next = _pdfQueue.shift();
  if (next) next(); else _pdfActive--;
}

// Browser nach Serverstart vorwärmen (non-blocking, nach dem kritischen Start-Burst),
// damit das ERSTE PDF nach einem (Neu-)Start nicht den 1–3s-Kaltstart trägt.
setTimeout(() => { getPdfBrowser().catch(() => {}); }, 12000);

function buildQuittungHtml({ dojo, mitglied, posten, jahr, umfang, einzel, summe }) {
  const heute = dmy(new Date());
  const titel = einzel ? 'Quittung' : `Quittung ${jahr}`;
  const untertitel = einzel
    ? 'Zahlungsbestätigung'
    : `Bezahlte ${umfang === 'alle' ? 'Posten' : 'Monatsbeiträge'} ${jahr}`;
  const adresseDojo = [dojo.strasse, [dojo.plz, dojo.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const adresseM = [[mitglied.strasse, mitglied.hausnummer].filter(Boolean).join(' '), [mitglied.plz, mitglied.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const rows = posten.map(p => `
    <tr>
      <td>${esc(dmy(p.datum))}</td>
      <td>${esc(bezeichnung(p))}</td>
      <td>${esc(p.zahlungsart || '–')}</td>
      <td style="text-align:right;white-space:nowrap">${esc(euro(p.betrag))}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;color:#1a1a2e;font-size:11pt;padding:18mm}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #c9a227;padding-bottom:6mm;margin-bottom:8mm}
  .dojo{font-size:13pt;font-weight:800}
  .dojo .sub{font-size:8.5pt;color:#666;font-weight:400;margin-top:2px;line-height:1.5}
  .doc{text-align:right}
  .doc h1{font-size:18pt;font-weight:900;letter-spacing:1px}
  .doc .sub{font-size:8.5pt;color:#888;margin-top:2px}
  .meta{display:flex;justify-content:space-between;margin-bottom:8mm;font-size:9.5pt}
  .meta .lbl{color:#888;font-size:8pt;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:6mm}
  th{background:#1a1a2e;color:#fff;text-align:left;padding:5px 8px;font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em}
  th:last-child{text-align:right}
  td{padding:5px 8px;border-bottom:1px solid #eee}
  .total{display:flex;justify-content:flex-end;gap:10mm;align-items:baseline;border-top:2px solid #1a1a2e;padding-top:4mm}
  .total .lbl{font-weight:700}
  .total .val{font-size:14pt;font-weight:900;color:#c9a227}
  .note{margin-top:10mm;padding:5mm;background:#f8fafc;border-left:3px solid #c9a227;border-radius:4px;font-size:9.5pt;color:#444}
  .foot{margin-top:12mm;font-size:8pt;color:#999;border-top:1px solid #eee;padding-top:4mm;line-height:1.6}
  </style></head><body>
  <div class="head">
    <div class="dojo">${esc(dojo.dojoname || 'Dojo')}
      <div class="sub">${esc(dojo.inhaber || '')}${adresseDojo ? '<br>' + esc(adresseDojo) : ''}${dojo.telefon ? '<br>Tel. ' + esc(dojo.telefon) : ''}${dojo.email ? '<br>' + esc(dojo.email) : ''}${dojo.ust_id ? '<br>USt-IdNr.: ' + esc(dojo.ust_id) : ''}</div>
    </div>
    <div class="doc"><h1>${esc(titel)}</h1><div class="sub">${esc(untertitel)}</div></div>
  </div>
  <div class="meta">
    <div><div class="lbl">Mitglied</div><strong>${esc((mitglied.vorname || '') + ' ' + (mitglied.nachname || ''))}</strong>${adresseM ? '<br>' + esc(adresseM) : ''}</div>
    <div style="text-align:right"><div class="lbl">Ausgestellt am</div>${esc(heute)}</div>
  </div>
  <table>
    <thead><tr><th>Datum</th><th>Bezeichnung</th><th>Zahlungsart</th><th>Betrag</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999;padding:10mm">Keine bezahlten Posten im gewählten Zeitraum.</td></tr>'}</tbody>
  </table>
  <div class="total"><span class="lbl">Gesamtbetrag (bezahlt):</span><span class="val">${esc(euro(summe))}</span></div>
  <div class="note">Der oben aufgeführte Betrag wurde dankend erhalten. Diese Quittung bestätigt bereits geleistete Zahlungen.</div>
  <div class="foot">${esc(dojo.dojoname || '')}${dojo.inhaber ? ' · ' + esc(dojo.inhaber) : ''}${adresseDojo ? ' · ' + esc(adresseDojo) : ''}<br>Automatisch erstellt am ${esc(heute)} — keine Unterschrift erforderlich.</div>
  </body></html>`;
}

// GET /api/quittungen/pdf?jahr=&umfang=&typ=&id=  → PDF on-the-fly (NICHT gespeichert)
router.get('/pdf', async (req, res) => {
  const mitgliedId = req.user?.mitglied_id;
  if (!mitgliedId) return res.status(403).json({ success: false, error: 'Kein Mitglied im Token' });
  const jahr = parseInt(req.query.jahr, 10) || new Date().getFullYear();
  const umfang = req.query.umfang === 'alle' ? 'alle' : 'beitraege';
  const einzel = (req.query.typ && req.query.id) ? { typ: req.query.typ === 'rechnung' ? 'rechnung' : 'beitrag', id: req.query.id } : null;
  try {
    const [[mitglied]] = await pool.query('SELECT mitglied_id, vorname, nachname, strasse, hausnummer, plz, ort, dojo_id FROM mitglieder WHERE mitglied_id = ? LIMIT 1', [mitgliedId]);
    if (!mitglied) return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });
    const [[dojo]] = await pool.query('SELECT dojoname, inhaber, strasse, plz, ort, telefon, email, ust_id, logo_url FROM dojo WHERE id = ? LIMIT 1', [mitglied.dojo_id]);
    const posten = await ladePosten(mitgliedId, einzel ? null : jahr, umfang, einzel);
    if (!posten.length) return res.status(404).json({ success: false, error: 'Keine bezahlten Posten gefunden' });
    const summe = posten.reduce((s, p) => s + parseFloat(p.betrag || 0), 0);

    const html = buildQuittungHtml({ dojo: dojo || {}, mitglied, posten, jahr, umfang, einzel, summe });
    await acquirePdfSlot();                 // max. 2 PDFs gleichzeitig (Überlast-Schutz)
    const browser = await getPdfBrowser();
    const page = await browser.newPage();
    try {
      // data:-URL goto = zuverlässiger UTF-8-Fix für Puppeteer (Umlaute).
      // domcontentloaded statt load: reines HTML ohne externe Assets → schneller fertig.
      await page.goto('data:text/html;charset=UTF-8,' + encodeURIComponent(html), { waitUntil: 'domcontentloaded', timeout: 30000 });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
      const fname = einzel ? `Quittung_${dmy(posten[0].datum).replace(/\./g, '-')}` : `Quittung_${jahr}`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(Buffer.from(pdf));
    } finally {
      await page.close().catch(() => {});
      releasePdfSlot();
    }
  } catch (e) {
    logger.error('Quittung /pdf Fehler:', { error: e.message });
    _pdfBrowser = null; // bei Fehler Browser-Neustart erzwingen
    res.status(500).json({ success: false, error: 'Quittung konnte nicht erstellt werden' });
  }
});

module.exports = router;
