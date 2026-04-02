const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const pool = db.promise();
let puppeteer;
try { puppeteer = require('puppeteer'); } catch(e) { puppeteer = null; }

// Auto-create PDF config table
pool.query(`CREATE TABLE IF NOT EXISTS stil_pdf_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stil_id INT NOT NULL UNIQUE,
  titel VARCHAR(200) DEFAULT NULL,
  organisation VARCHAR(200) DEFAULT NULL,
  organisation_sub VARCHAR(300) DEFAULT NULL,
  akzent_farbe VARCHAR(20) DEFAULT '#c0392b',
  deck_zeigen TINYINT(1) DEFAULT 1,
  allgemein_zeigen TINYINT(1) DEFAULT 1,
  guertel_zeigen TINYINT(1) DEFAULT 1,
  fusszeile TEXT DEFAULT NULL,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`).catch(e => console.error('stil_pdf_config:', e.message));

// ─── LERNKATEGORIEN CRUD ─────────────────────────────────────────────────────
// WICHTIG: Statische Routen vor /:id registrieren!

// GET /lernmaterialien/kategorien
router.get('/kategorien', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoWhere = secureDojoId ? 'WHERE k.dojo_id = ?' : '';
    const params = secureDojoId ? [secureDojoId] : [];
    const [rows] = await pool.query(
      `SELECT k.*, COUNT(m.id) as anzahl
       FROM lernkategorien k
       LEFT JOIN lernmaterialien m ON m.kategorie_id = k.kategorie_id AND m.aktiv = 1
       ${dojoWhere}
       GROUP BY k.kategorie_id
       ORDER BY FIELD(k.typ,'stil','guertel','sonstiges'), k.sort_order, k.name`, params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// POST /lernmaterialien/kategorien
router.post('/kategorien', async (req, res) => {
  const { name, typ, stil_id, icon, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });
  const secureDojoId = getSecureDojoId(req);
  try {
    const [r] = await pool.query(
      'INSERT INTO lernkategorien (name, typ, stil_id, icon, sort_order, dojo_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, typ || 'sonstiges', stil_id || null, icon || null, sort_order || 0, secureDojoId || null]
    );
    res.json({ success: true, kategorie_id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// PUT /lernmaterialien/kategorien/:id
router.put('/kategorien/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, typ, stil_id, icon, sort_order } = req.body;
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(
      `UPDATE lernkategorien SET name=?, typ=?, stil_id=?, icon=?, sort_order=? WHERE kategorie_id=?${dojoClause}`,
      [name, typ || 'sonstiges', stil_id || null, icon || null, sort_order || 0, id, ...(secureDojoId ? [secureDojoId] : [])]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// DELETE /lernmaterialien/kategorien/:id
router.delete('/kategorien/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(`UPDATE lernmaterialien SET kategorie_id = NULL WHERE kategorie_id = ?${secureDojoId ? ' AND dojo_id = ?' : ''}`,
      [id, ...(secureDojoId ? [secureDojoId] : [])]);
    await pool.query(`DELETE FROM lernkategorien WHERE kategorie_id=?${dojoClause}`,
      [id, ...(secureDojoId ? [secureDojoId] : [])]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// ─── IMPORT ──────────────────────────────────────────────────────────────────
// POST /lernmaterialien/import
router.post('/import', async (req, res) => {
  const { material_ids, target_kategorie_id, target_stil_id } = req.body;
  if (!Array.isArray(material_ids) || material_ids.length === 0) {
    return res.status(400).json({ error: 'Keine Materialien ausgewählt' });
  }
  const secureDojoId = getSecureDojoId(req);
  try {
    const placeholders = material_ids.map(() => '?').join(',');
    const [sources] = await pool.query(
      `SELECT titel, typ, url, beschreibung, inhalt, sichtbar_ab_reihenfolge FROM lernmaterialien WHERE id IN (${placeholders})`,
      material_ids.map(Number)
    );
    let imported = 0;
    for (const m of sources) {
      await pool.query(
        'INSERT INTO lernmaterialien (dojo_id, stil_id, kategorie_id, titel, typ, url, beschreibung, inhalt, sichtbar_ab_reihenfolge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [secureDojoId || null, target_stil_id || null, target_kategorie_id || null, m.titel, m.typ, m.url || null, m.beschreibung || null, m.inhalt || null, m.sichtbar_ab_reihenfolge || 0]
      );
      imported++;
    }
    res.json({ success: true, imported });
  } catch (err) {
    console.error('Import-Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler: ' + err.message });
  }
});

// ─── PRÜFUNGSINHALTE ─────────────────────────────────────────────────────────
// GET /lernmaterialien/pruefungsinhalte?stil_id=X
router.get('/pruefungsinhalte', async (req, res) => {
  const { stil_id } = req.query;
  try {
    let conds = ['pi.aktiv = 1', 'g.aktiv = 1'];
    let params = [];
    if (stil_id) { conds.push('g.stil_id = ?'); params.push(parseInt(stil_id)); }
    const [rows] = await pool.query(
      `SELECT pi.inhalt_id AS id, pi.graduierung_id, pi.kategorie, pi.titel, pi.beschreibung,
              pi.pflicht, pi.reihenfolge, pi.ohne_punkte, pi.ist_gesprungen,
              g.name AS gürtel_name, g.farbe_hex, g.reihenfolge AS gürtel_reihenfolge, g.stil_id,
              s.name AS stil_name
       FROM pruefungsinhalte pi
       JOIN graduierungen g ON pi.graduierung_id = g.graduierung_id
       JOIN stile s ON g.stil_id = s.stil_id
       WHERE ${conds.join(' AND ')}
       ORDER BY g.reihenfolge, pi.kategorie, pi.reihenfolge`, params
    );
    res.json({ success: true, inhalte: rows });
  } catch (err) {
    console.error('Pruefungsinhalte-Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /lernmaterialien/pruefungsinhalte
router.post('/pruefungsinhalte', async (req, res) => {
  const { graduierung_id, titel, beschreibung, pflicht, kategorie } = req.body;
  if (!graduierung_id || !titel) return res.status(400).json({ error: 'graduierung_id und titel erforderlich' });
  try {
    const [result] = await pool.query(
      'INSERT INTO pruefungsinhalte (graduierung_id, titel, beschreibung, pflicht, kategorie, aktiv) VALUES (?, ?, ?, ?, ?, 1)',
      [parseInt(graduierung_id), titel, beschreibung || null, pflicht ? 1 : 0, kategorie || 'sonstiges']
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Pruefungsinhalt-Insert-Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /lernmaterialien/pruefungsinhalte/:id
router.put('/pruefungsinhalte/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).end();
  const { titel, beschreibung, pflicht, kategorie } = req.body;
  if (!titel) return res.status(400).json({ error: 'Titel erforderlich' });
  try {
    await pool.query(
      'UPDATE pruefungsinhalte SET titel=?, beschreibung=?, pflicht=?, kategorie=? WHERE inhalt_id=?',
      [titel, beschreibung || null, pflicht ? 1 : 0, kategorie || 'sonstiges', id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Pruefungsinhalt-Update-Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /lernmaterialien/pruefungsinhalte/:id  (Soft-Delete)
router.delete('/pruefungsinhalte/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).end();
  try {
    await pool.query('UPDATE pruefungsinhalte SET aktiv = 0 WHERE inhalt_id = ?', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// ─── PDF KONFIGURATION ───────────────────────────────────────────────────────
// GET /lernmaterialien/pdf-config/:stil_id
router.get('/pdf-config/:stil_id', async (req, res) => {
  const stilId = parseInt(req.params.stil_id);
  if (isNaN(stilId)) return res.status(400).end();
  try {
    const [[cfg]] = await pool.query('SELECT * FROM stil_pdf_config WHERE stil_id = ?', [stilId]);
    res.json({ success: true, config: cfg || {} });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// PUT /lernmaterialien/pdf-config/:stil_id
router.put('/pdf-config/:stil_id', async (req, res) => {
  const stilId = parseInt(req.params.stil_id);
  if (isNaN(stilId)) return res.status(400).end();
  const { titel, organisation, organisation_sub, akzent_farbe, deck_zeigen, allgemein_zeigen, guertel_zeigen, fusszeile } = req.body;
  try {
    await pool.query(
      `INSERT INTO stil_pdf_config (stil_id, titel, organisation, organisation_sub, akzent_farbe, deck_zeigen, allgemein_zeigen, guertel_zeigen, fusszeile)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         titel=VALUES(titel), organisation=VALUES(organisation), organisation_sub=VALUES(organisation_sub),
         akzent_farbe=VALUES(akzent_farbe), deck_zeigen=VALUES(deck_zeigen), allgemein_zeigen=VALUES(allgemein_zeigen),
         guertel_zeigen=VALUES(guertel_zeigen), fusszeile=VALUES(fusszeile)`,
      [stilId, titel || null, organisation || null, organisation_sub || null,
       akzent_farbe || '#c0392b', deck_zeigen ? 1 : 0, allgemein_zeigen ? 1 : 0, guertel_zeigen ? 1 : 0, fusszeile || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PDF-Config-Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ─── PDF EXPORT (Einzelmaterial) ─────────────────────────────────────────────
// GET /lernmaterialien/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  if (!puppeteer) return res.status(503).json({ error: 'PDF-Export nicht verfügbar' });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).end();
  try {
    const [[m]] = await pool.query('SELECT * FROM lernmaterialien WHERE id = ?', [id]);
    if (!m) return res.status(404).end();
    const safeTitle = (m.titel || 'Dokument').replace(/[<>]/g, '');
    const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 2cm; max-width: 800px; color: #1a1a2e; line-height: 1.6; }
  h1 { color: #1a1a2e; border-bottom: 2px solid #d4af37; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
  h2 { color: #2d2d4e; margin-top: 1.5rem; }
  h3 { color: #3d3d5e; }
  ul, ol { padding-left: 1.5rem; }
  li { margin-bottom: 0.25rem; }
  p { margin: 0.75rem 0; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  a { color: #d4af37; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; }
  th { background: #f0f0f0; font-weight: 600; }
</style>
</head><body>
<h1>${safeTitle}</h1>
${m.inhalt || '<p><em>Kein Inhalt vorhanden.</em></p>'}
</body></html>`;
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' }, printBackground: true });
    await browser.close();
    const filename = encodeURIComponent(m.titel || 'Dokument') + '.pdf';
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename*=UTF-8''${filename}` });
    res.send(Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf));
  } catch (err) {
    console.error('PDF-Fehler:', err);
    res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen' });
  }
});

// ─── PDF EXPORT (Vollständige Prüfungsordnung) ───────────────────────────────
// GET /lernmaterialien/pruefungsordnung-pdf?stil_id=X
router.get('/pruefungsordnung-pdf', async (req, res) => {
  if (!puppeteer) return res.status(503).json({ error: 'PDF-Export nicht verfügbar' });
  const { stil_id } = req.query;
  if (!stil_id) return res.status(400).json({ error: 'stil_id erforderlich' });

  try {
    // 1. Stil-Info + PDF-Config
    const [[stil]] = await pool.query('SELECT * FROM stile WHERE stil_id = ?', [parseInt(stil_id)]);
    if (!stil) return res.status(404).json({ error: 'Stil nicht gefunden' });

    const [[cfgRow]] = await pool.query('SELECT * FROM stil_pdf_config WHERE stil_id = ?', [parseInt(stil_id)]);
    const cfg = cfgRow || {};

    // Config-Werte mit Defaults
    const akzent = cfg.akzent_farbe || '#c0392b';
    const safeName = (stil.name || 'Prüfungsordnung').replace(/[<>]/g, '');
    const orgName = (cfg.organisation || "TDA Int'l").replace(/[<>]/g, '');
    const orgSub = (cfg.organisation_sub || 'Tiger &amp; Dragon Association \u2013 International').replace(/[<>]/g, '');
    const pdfTitel = (cfg.titel || `Prüfungsprogramm ${safeName}`).replace(/[<>]/g, '');
    const showDeck = cfg.deck_zeigen !== 0;
    const showAllgemein = cfg.allgemein_zeigen !== 0;
    const showGuertel = cfg.guertel_zeigen !== 0;
    const fusszeile = (cfg.fusszeile || '').replace(/[<>]/g, '');
    const today = new Date().toLocaleDateString('de-DE');

    // 2. Text-Lernmaterialien
    const [textMaterials] = showAllgemein ? await pool.query(
      `SELECT lm.*, k.name AS kat_name
       FROM lernmaterialien lm
       LEFT JOIN lernkategorien k ON lm.kategorie_id = k.kategorie_id
       WHERE lm.stil_id = ? AND lm.aktiv = 1 AND lm.typ = 'text' AND lm.inhalt IS NOT NULL
       ORDER BY lm.sichtbar_ab_reihenfolge ASC, lm.erstellt_am ASC`,
      [parseInt(stil_id)]
    ) : [[]];

    // 3. Prüfungsinhalte nach Gürtel
    const [inhalte] = showGuertel ? await pool.query(
      `SELECT pi.inhalt_id AS id, pi.graduierung_id, pi.kategorie, pi.titel, pi.beschreibung,
              pi.pflicht, g.name AS guertel_name, g.farbe_hex, g.reihenfolge AS guertel_reihenfolge
       FROM pruefungsinhalte pi
       JOIN graduierungen g ON pi.graduierung_id = g.graduierung_id
       WHERE g.stil_id = ? AND pi.aktiv = 1 AND g.aktiv = 1
       ORDER BY g.reihenfolge, pi.kategorie, pi.reihenfolge`,
      [parseInt(stil_id)]
    ) : [[]];

    // Gruppieren nach Gürtel
    const guertelMap = {};
    inhalte.forEach(p => {
      if (!guertelMap[p.graduierung_id]) {
        guertelMap[p.graduierung_id] = {
          name: p.guertel_name, farbe: p.farbe_hex || '#888',
          reihenfolge: p.guertel_reihenfolge, kategorien: {}
        };
      }
      const kat = p.kategorie || 'sonstiges';
      if (!guertelMap[p.graduierung_id].kategorien[kat]) guertelMap[p.graduierung_id].kategorien[kat] = [];
      guertelMap[p.graduierung_id].kategorien[kat].push(p);
    });
    const guertelListe = Object.values(guertelMap).sort((a, b) => a.reihenfolge - b.reihenfolge);

    const KAT_LABELS = {
      warmup:'Warm Up', kraft:'Kraft & Fitness', kampfstellung:'Kampfstellung & Fortbewegung',
      handtechniken:'Handtechniken', fusstechniken:'Fußtechniken', kombinationen:'Kombinationen',
      abwehr:'Abwehrkombinationen', sandsack:'Sandsack & Pratzentraining', sparring:'Sparring',
      kampfrichter:'Kampfrichterwissen', anatomie:'Anatomie', ernaehrung:'Ernährung',
      erstehilfe:'Erste Hilfe', pruefungsfragen:'Prüfungsfragen',
      grundtechniken:'Grundtechniken', theorie:'Theorie', kata:'Kata', kumite:'Kumite',
      waffen:'Waffen', positionen:'Positionen', escapes:'Escapes', submissions:'Submissions',
      takedowns:'Takedowns', glossar:'Glossar', sonstiges:'Sonstiges',
    };

    // Deckblatt
    const titlePage = showDeck ? `
      <div class="title-page">
        <div class="title-org">${orgName}<br><span class="title-org-sub">${orgSub}</span></div>
        <div class="title-banner">${pdfTitel}</div>
        <div class="title-date">Stand: ${today}</div>
      </div>` : '';

    // Allgemeine Abschnitte
    const generalHtml = showAllgemein && textMaterials.length > 0 ? `
      <div class="chapter">
        <h1>Allgemeines</h1>
        ${textMaterials.map(m => `
          <div class="gen-section">
            <h2>${(m.titel || '').replace(/[<>]/g, '')}</h2>
            ${m.beschreibung ? `<p class="desc">${m.beschreibung.replace(/[<>]/g, '')}</p>` : ''}
            <div class="content">${m.inhalt}</div>
          </div>`).join('')}
      </div>` : '';

    // Gürtel-Programme
    const beltsHtml = showGuertel && guertelListe.length > 0 ? `
      <div class="chapter">
        <h1>${pdfTitel}</h1>
        ${guertelListe.map(g => {
          const color = (g.farbe || '#888').startsWith('#') ? g.farbe : '#' + g.farbe;
          const katBlocks = Object.entries(g.kategorien)
            .sort(([a], [b]) => {
              const ORDER = ['warmup','kraft','kampfstellung','handtechniken','kombinationen','fusstechniken','abwehr','sandsack','sparring','theorie','kampfrichter','anatomie','ernaehrung','erstehilfe','pruefungsfragen'];
              const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
              if (ia >= 0 && ib >= 0) return ia - ib;
              if (ia >= 0) return -1; if (ib >= 0) return 1;
              return a.localeCompare(b);
            })
            .map(([kat, items]) => {
              const katLabel = KAT_LABELS[kat] || kat.charAt(0).toUpperCase() + kat.slice(1);
              const rows = items.map(item => `
                <tr>
                  <td class="pflicht">${item.pflicht ? '★' : ''}</td>
                  <td class="ititel">${(item.titel || '').replace(/[<>]/g, '')}</td>
                  <td class="idesc">${(item.beschreibung || '').replace(/[<>]/g, '')}</td>
                </tr>`).join('');
              return `<div class="kat-block">
                <div class="kat-label">${katLabel}</div>
                <table class="items-table"><tbody>${rows}</tbody></table>
              </div>`;
            }).join('');
          return `
            <div class="belt-block">
              <div class="belt-head" style="border-left:5px solid ${color};background:${color}22;">
                <span class="belt-swatch" style="background:${color};"></span>
                <span class="belt-name">${g.name.replace(/[<>]/g, '')}</span>
              </div>
              <div class="belt-body">${katBlocks}</div>
            </div>`;
        }).join('')}
      </div>` : '';

    const footerEl = fusszeile
      ? `<div style="position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:7.5pt;color:#999;padding:0.4rem 2cm;border-top:1px solid #eee;">${fusszeile}</div>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 2cm 2cm ${fusszeile ? '2.5cm' : '2cm'} 2cm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 9.5pt; line-height: 1.5; }
  /* Deckblatt */
  .title-page { display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 240mm; text-align: center; page-break-after: always; }
  .title-org { font-size: 2rem; font-weight: 900; color: ${akzent}; line-height: 1.2; margin-bottom: 3rem; }
  .title-org-sub { font-size: 1rem; font-weight: 400; display: block; margin-top: 0.2rem; }
  .title-banner { font-size: 1.6rem; font-weight: 800; background: ${akzent}; color: white;
    padding: 0.6rem 2rem; margin-bottom: 2rem; border-radius: 3px; }
  .title-date { font-size: 0.85rem; color: #777; }
  /* Kapitel */
  .chapter { page-break-before: always; }
  h1 { font-size: 1.2rem; color: #1a1a1a; border-bottom: 2px solid ${akzent};
    padding-bottom: 0.35rem; margin: 0 0 1.2rem; }
  h2 { font-size: 1rem; color: ${akzent}; margin: 1.2rem 0 0.2rem; }
  .desc { font-style: italic; color: #555; font-size: 0.9em; margin: 0 0 0.5rem; }
  .content { font-size: 0.93em; }
  .content p { margin: 0.3rem 0; }
  .content ul, .content ol { padding-left: 1.4rem; margin: 0.3rem 0; }
  .content li { margin-bottom: 0.15rem; }
  .gen-section { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
  .gen-section:last-child { border-bottom: none; }
  /* Gürtel */
  .belt-block { margin-bottom: 1.2rem; page-break-inside: avoid; }
  .belt-head { display: flex; align-items: center; gap: 0.6rem;
    padding: 0.4rem 0.7rem; margin-bottom: 0.4rem; }
  .belt-swatch { display: inline-block; width: 28px; height: 9px; border-radius: 3px; flex-shrink: 0; }
  .belt-name { font-size: 0.95rem; font-weight: 700; }
  .belt-body { padding-left: 0.5rem; }
  .kat-block { margin-bottom: 0.6rem; }
  .kat-label { font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; color: #555; margin-bottom: 0.2rem; border-bottom: 1px solid #eee; padding-bottom: 0.1rem; }
  .items-table { width: 100%; border-collapse: collapse; font-size: 0.88em; }
  .items-table tr:nth-child(even) td { background: #fafafa; }
  .items-table td { padding: 0.18rem 0.35rem; vertical-align: top; }
  .pflicht { width: 16px; color: ${akzent}; font-weight: 800; text-align: center; }
  .ititel { font-weight: 500; width: 45%; }
  .idesc { color: #666; font-size: 0.9em; }
</style>
</head><body>${titlePage}${generalHtml}${beltsHtml}${footerEl}</body></html>`;

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    const filename = encodeURIComponent(`Pruefungsordnung_${stil.name}`) + '.pdf';
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename*=UTF-8''${filename}` });
    res.send(Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf));
  } catch (err) {
    console.error('Pruefungsordnung-PDF-Fehler:', err);
    res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen' });
  }
});

// ─── PDF EXPORT (Stil / Kategorie — Bulk) ────────────────────────────────────
// GET /lernmaterialien/export-pdf?stil_id=X&kategorie_id=Y
router.get('/export-pdf', async (req, res) => {
  if (!puppeteer) return res.status(503).json({ error: 'PDF-Export nicht verfügbar' });
  const { stil_id, kategorie_id } = req.query;
  const secureDojoId = getSecureDojoId(req);
  try {
    let conds = ["lm.aktiv = 1", "lm.typ = 'text'", 'lm.inhalt IS NOT NULL'];
    let params = [];
    if (secureDojoId) { conds.push('(lm.dojo_id = ? OR lm.dojo_id IS NULL)'); params.push(secureDojoId); }
    if (stil_id) { conds.push('lm.stil_id = ?'); params.push(parseInt(stil_id)); }
    if (kategorie_id) { conds.push('lm.kategorie_id = ?'); params.push(parseInt(kategorie_id)); }
    const [rows] = await pool.query(
      `SELECT lm.*, s.name AS stil_name, k.name AS kat_name
       FROM lernmaterialien lm
       LEFT JOIN stile s ON lm.stil_id = s.stil_id
       LEFT JOIN lernkategorien k ON lm.kategorie_id = k.kategorie_id
       WHERE ${conds.join(' AND ')}
       ORDER BY lm.sichtbar_ab_reihenfolge ASC, lm.erstellt_am ASC`, params
    );
    if (!rows.length) return res.status(404).json({ error: 'Keine Text-Materialien gefunden' });

    const titlePart = rows[0].stil_name || rows[0].kat_name || 'Alle Stile';
    const docTitle = `Lernmaterialien — ${titlePart}`;

    const sections = rows.map((m, i) => `
      <div class="section${i > 0 ? ' new-page' : ''}">
        <h2>${(m.titel || '').replace(/[<>]/g, '')}</h2>
        ${m.beschreibung ? `<p class="desc">${m.beschreibung.replace(/[<>]/g, '')}</p>` : ''}
        <div class="content">${m.inhalt}</div>
      </div>`).join('\n');

    const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 2cm; color: #1a1a2e; line-height: 1.6; }
  h1 { color: #1a1a2e; border-bottom: 3px solid #d4af37; padding-bottom: 0.5rem; margin-bottom: 2rem; font-size: 1.8rem; }
  h2 { color: #2d2d4e; border-bottom: 1px solid #d4af7777; padding-bottom: 0.3rem; margin-top: 1.5rem; font-size: 1.3rem; }
  h3 { color: #3d3d5e; font-size: 1.1rem; }
  .desc { font-style: italic; color: #555; margin: 0.25rem 0 0.75rem; }
  .section { margin-bottom: 2.5rem; }
  .new-page { page-break-before: always; }
  ul, ol { padding-left: 1.5rem; }
  li { margin-bottom: 0.25rem; }
  p { margin: 0.5rem 0; }
  a { color: #d4af37; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; }
  th { background: #f5f5f5; font-weight: 600; }
</style></head><body>
<h1>${docTitle}</h1>
${sections}
</body></html>`;

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' }, printBackground: true });
    await browser.close();
    const filename = encodeURIComponent(docTitle) + '.pdf';
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename*=UTF-8''${filename}` });
    res.send(Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf));
  } catch (err) {
    console.error('Bulk-PDF-Fehler:', err);
    res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen' });
  }
});

// ─── LERNMATERIALIEN CRUD ────────────────────────────────────────────────────

// GET /lernmaterialien?stil_id=&graduierung_id=&kategorie_id=&typ=
router.get('/', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const { stil_id, graduierung_id, kategorie_id, typ } = req.query;
  try {
    let conds = secureDojoId ? ['(lm.dojo_id = ? OR lm.dojo_id IS NULL)'] : [];
    let params = secureDojoId ? [secureDojoId] : [];
    if (stil_id) { conds.push('lm.stil_id = ?'); params.push(parseInt(stil_id)); }
    if (graduierung_id) { conds.push('lm.graduierung_id = ?'); params.push(parseInt(graduierung_id)); }
    if (kategorie_id) { conds.push('lm.kategorie_id = ?'); params.push(parseInt(kategorie_id)); }
    if (typ) { conds.push('lm.typ = ?'); params.push(typ); }
    conds.push('lm.aktiv = 1');
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const [rows] = await pool.query(
      `SELECT lm.*, s.name AS stil_name, g.name AS graduierung_name, k.name AS kategorie_name
       FROM lernmaterialien lm
       LEFT JOIN stile s ON lm.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON lm.graduierung_id = g.graduierung_id
       LEFT JOIN lernkategorien k ON lm.kategorie_id = k.kategorie_id
       ${where}
       ORDER BY lm.sichtbar_ab_reihenfolge ASC, lm.erstellt_am DESC`, params
    );
    res.json({ success: true, materialien: rows });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// POST /lernmaterialien
router.post('/', async (req, res) => {
  const { stil_id, graduierung_id, kategorie_id, titel, typ, url, beschreibung, inhalt, sichtbar_ab_reihenfolge } = req.body;
  if (!titel || !typ) return res.status(400).json({ error: 'Titel und Typ erforderlich' });
  const secureDojoId = getSecureDojoId(req);
  try {
    const [r] = await pool.query(
      'INSERT INTO lernmaterialien (dojo_id, stil_id, graduierung_id, kategorie_id, titel, typ, url, beschreibung, inhalt, sichtbar_ab_reihenfolge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [secureDojoId || null, stil_id || null, graduierung_id || null, kategorie_id || null, titel, typ, url || null, beschreibung || null, inhalt || null, sichtbar_ab_reihenfolge || 0]
    );
    res.json({ success: true, id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// PUT /lernmaterialien/:id
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { titel, typ, url, beschreibung, inhalt, sichtbar_ab_reihenfolge, aktiv, kategorie_id, stil_id } = req.body;
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(
      `UPDATE lernmaterialien SET titel=?, typ=?, url=?, beschreibung=?, inhalt=?, sichtbar_ab_reihenfolge=?, aktiv=?, kategorie_id=?, stil_id=? WHERE id=?${dojoClause}`,
      [titel, typ, url || null, beschreibung || null, inhalt || null, sichtbar_ab_reihenfolge || 0, aktiv !== false ? 1 : 0, kategorie_id || null, stil_id || null, id, ...(secureDojoId ? [secureDojoId] : [])]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// DELETE /lernmaterialien/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(`DELETE FROM lernmaterialien WHERE id=?${dojoClause}`, [id, ...(secureDojoId ? [secureDojoId] : [])]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

module.exports = router;
