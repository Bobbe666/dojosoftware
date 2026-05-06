/**
 * Lohnabrechnung Routes — Payroll
 * ================================
 * Monatliche Gehaltsabrechnungen für Mitarbeiter (personal-Tabelle).
 * Berechnung nach deutschen Steuer- und Sozialversicherungsregeln (2025).
 *
 * Routen:
 *   GET    /api/lohnabrechnung              — Liste aller Abrechnungen
 *   GET    /api/lohnabrechnung/mitarbeiter  — Mitarbeiter mit Payroll-Feldern
 *   PUT    /api/lohnabrechnung/mitarbeiter/:id — Payroll-Felder aktualisieren
 *   POST   /api/lohnabrechnung/berechnen    — Monatsabrechnung berechnen (nicht speichern)
 *   POST   /api/lohnabrechnung              — Abrechnung speichern
 *   GET    /api/lohnabrechnung/uebersicht/:jahr — Jahresübersicht pro Mitarbeiter
 *   GET    /api/lohnabrechnung/:id/pdf      — Gehaltsabrechnung als PDF
 *   DELETE /api/lohnabrechnung/:id          — Abrechnung löschen
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');
const logger  = require('../utils/logger');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Lohnsteuer-Jahresbetrag (vereinfachtes Verfahren, Tarif 2025).
 * Gibt den Jahres-Lohnsteuerbetrag zurück (vor Soli/Kirchensteuer).
 */
function berechneLohnsteuer(jahresBrutto, steuerklasse) {
  const freibetraege = { 1: 12096, 2: 16033, 3: 24192, 4: 12096, 5: 0, 6: 0 };
  const freibetrag = freibetraege[steuerklasse] || 12096;
  const zve = Math.max(0, jahresBrutto - freibetrag);

  if (zve === 0) return 0;
  if (zve <= 17443) {
    // Zone 1
    const y = (zve - 12096) / 10000;
    return Math.round((979.18 * y + 1400) * y);
  }
  if (zve <= 68480) {
    // Zone 2
    const z = (zve - 17443) / 10000;
    return Math.round((192.59 * z + 2397) * z + 1025.38);
  }
  if (zve <= 277825) {
    // Zone 3: 42%
    return Math.round(zve * 0.42 - 10602.13);
  }
  // Zone 4: 45%
  return Math.round(zve * 0.45 - 18936.88);
}

/**
 * Kernberechnung der Lohnabrechnung für einen Monat.
 * @param {object} personalRow - Zeile aus der personal-Tabelle (mit Payroll-Feldern)
 * @param {number} brutto - Grundbruttolohn
 * @param {number} sonderzahlung - Einmalige Sonderzahlung (0 wenn keine)
 * @returns {object} Berechnetes Ergebnis
 */
function berechneLohn(personalRow, brutto, sonderzahlung = 0) {
  // 2025 SV-Beitragssätze
  const KV_SATZ = 0.073;        // AN-Anteil allg. Beitragssatz (ohne Zusatzbeitrag)
  const KV_ZB   = Number(personalRow.krankenkasse_zusatz || 1.70) / 200; // halber Zusatzbeitrag AN
  const PV_SATZ = 0.0170;       // 1,70% Basis-PV-Satz (mit Kindern)
  const RV_SATZ = 0.093;        // 9,3% AN
  const AV_SATZ = 0.013;        // 1,3% AN

  const BBG_KV = 5512.50;       // Beitragsbemessungsgrenze KV/PV 2025
  const BBG_RV = 8050.00;       // Beitragsbemessungsgrenze RV/AV 2025 (West)

  const bruttoGesamt = round2(Number(brutto) + Number(sonderzahlung));
  const basisKV = Math.min(bruttoGesamt, BBG_KV);
  const basisRV = Math.min(bruttoGesamt, BBG_RV);

  const kv_an = round2(basisKV * (KV_SATZ + KV_ZB));
  // Kinderloser Zuschlag: +0,6% wenn kein Kinderfreibetrag (§55 SGB XI)
  const pv_an_satz = PV_SATZ + (Number(personalRow.kinderfreibetrag || 0) === 0 ? 0.006 : 0);
  const pv_an = round2(basisKV * pv_an_satz);
  const rv_an = round2(basisRV * RV_SATZ);
  const av_an = round2(basisRV * AV_SATZ);

  // AG zahlt nur den Basisbeitragssatz (ohne Zusatzbeitrag)
  const kv_ag = round2(basisKV * KV_SATZ);
  const pv_ag = round2(basisKV * PV_SATZ);
  const rv_ag = round2(basisRV * RV_SATZ);
  const av_ag = round2(basisRV * AV_SATZ);

  // Lohnsteuer: jährliche Projektion
  const steuerklasse = parseInt(personalRow.steuerklasse) || 1;
  const jahresBrutto = bruttoGesamt * 12;
  const lohnsteuerJahr = berechneLohnsteuer(jahresBrutto, steuerklasse);
  const lohnsteuerMonat = round2(lohnsteuerJahr / 12);

  // Solidaritätszuschlag (ab 127,50 € monatlicher Lohnsteuer)
  const soli = lohnsteuerMonat > 127.5 ? round2(lohnsteuerMonat * 0.055) : 0;

  // Kirchensteuer (Bayern: 8%, andere Bundesländer: 9%, keine: 0%)
  let kirchensteuersatz = 0;
  const kl = personalRow.kirchensteuer_land || 'andere';
  if (kl === 'Bayern') kirchensteuersatz = 0.08;
  else if (kl === 'andere') kirchensteuersatz = 0.09;
  const kirchensteuer = lohnsteuerMonat > 0 ? round2(lohnsteuerMonat * kirchensteuersatz) : 0;

  const sv_an = round2(kv_an + pv_an + rv_an + av_an);
  const sv_ag = round2(kv_ag + pv_ag + rv_ag + av_ag);
  const netto = round2(bruttoGesamt - sv_an - lohnsteuerMonat - soli - kirchensteuer);
  const ag_gesamtkosten = round2(bruttoGesamt + sv_ag);

  return {
    brutto: round2(Number(brutto)),
    sonderzahlung: round2(Number(sonderzahlung)),
    brutto_gesamt: bruttoGesamt,
    // AN-Anteile
    rv_an, av_an, kv_an, pv_an,
    // AG-Anteile
    rv_ag, av_ag, kv_ag, pv_ag,
    // Steuern
    lohnsteuer: lohnsteuerMonat,
    soli,
    kirchensteuer,
    // Ergebnisse
    sv_an, sv_ag,
    netto,
    ag_gesamtkosten,
    // Berechnungsdetails
    _details: {
      steuerklasse,
      jahresBrutto,
      lohnsteuerJahr,
      pv_an_satz: round2(pv_an_satz * 100),
      kv_zusatzbeitrag: round2(Number(personalRow.krankenkasse_zusatz || 1.70)),
      kirchensteuersatz: round2(kirchensteuersatz * 100),
      basisKV,
      basisRV
    }
  };
}

// ---------------------------------------------------------------------------
// GET / — Liste aller Lohnabrechnungen für ein Dojo/Jahr
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });
    const { jahr } = req.query;
    const currentYear = parseInt(jahr) || new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT la.*, p.vorname, p.nachname, p.position AS mitarbeiter_position
       FROM lohnabrechnung la
       JOIN personal p ON la.personal_id = p.id
       WHERE la.dojo_id = ? AND la.jahr = ?
       ORDER BY la.monat DESC, p.nachname ASC`,
      [dojoId, currentYear]
    );

    res.json({ jahr: currentYear, abrechnungen: rows });
  } catch (err) {
    logger.error('Lohnabrechnung GET / Fehler', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /mitarbeiter — Mitarbeiter mit Payroll-relevanten Feldern
// ---------------------------------------------------------------------------
router.get('/mitarbeiter', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });

    const [rows] = await pool.query(
      `SELECT id, vorname, nachname, position, email, telefon, einstellungsdatum,
              gehalt, beschaeftigungsart,
              steuerklasse, sv_nummer, krankenkasse, krankenkasse_zusatz,
              kinderfreibetrag, kirchensteuer_land, steueridentnummer
       FROM personal
       WHERE dojo_id = ? AND aktiv = 1
       ORDER BY nachname ASC, vorname ASC`,
      [dojoId]
    );

    res.json({ mitarbeiter: rows });
  } catch (err) {
    logger.error('Lohnabrechnung GET /mitarbeiter Fehler', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /mitarbeiter/:id — Payroll-Felder eines Mitarbeiters aktualisieren
// ---------------------------------------------------------------------------
router.put('/mitarbeiter/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });

    const personalId = parseInt(req.params.id);
    const {
      steuerklasse,
      sv_nummer,
      krankenkasse,
      krankenkasse_zusatz,
      kinderfreibetrag,
      kirchensteuer_land,
      steueridentnummer
    } = req.body;

    // Sicherheitscheck: Mitarbeiter gehört zum Dojo
    const [[ma]] = await pool.query(
      'SELECT id FROM personal WHERE id = ? AND dojo_id = ?',
      [personalId, dojoId]
    );
    if (!ma) return res.status(404).json({ error: 'Mitarbeiter nicht gefunden.' });

    await pool.query(
      `UPDATE personal SET
         steuerklasse = ?,
         sv_nummer = ?,
         krankenkasse = ?,
         krankenkasse_zusatz = ?,
         kinderfreibetrag = ?,
         kirchensteuer_land = ?,
         steueridentnummer = ?
       WHERE id = ? AND dojo_id = ?`,
      [
        steuerklasse || 1,
        sv_nummer || null,
        krankenkasse || null,
        krankenkasse_zusatz != null ? krankenkasse_zusatz : 1.70,
        kinderfreibetrag != null ? kinderfreibetrag : 0.0,
        kirchensteuer_land || 'andere',
        steueridentnummer || null,
        personalId,
        dojoId
      ]
    );

    res.json({ message: 'Lohndaten aktualisiert.' });
  } catch (err) {
    logger.error('Lohnabrechnung PUT /mitarbeiter/:id Fehler', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /berechnen — Monatsabrechnung berechnen (nur Vorschau, nicht speichern)
// ---------------------------------------------------------------------------
router.post('/berechnen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });

    const { personal_id, monat, jahr, brutto, sonderzahlung = 0 } = req.body;
    if (!personal_id || !monat || !jahr || brutto == null) {
      return res.status(400).json({ error: 'personal_id, monat, jahr und brutto sind erforderlich.' });
    }

    const [[personalRow]] = await pool.query(
      `SELECT id, vorname, nachname, position,
              steuerklasse, sv_nummer, krankenkasse, krankenkasse_zusatz,
              kinderfreibetrag, kirchensteuer_land, steueridentnummer
       FROM personal WHERE id = ? AND dojo_id = ?`,
      [parseInt(personal_id), dojoId]
    );
    if (!personalRow) return res.status(404).json({ error: 'Mitarbeiter nicht gefunden.' });

    const ergebnis = berechneLohn(personalRow, brutto, sonderzahlung);

    res.json({
      personal: {
        id: personalRow.id,
        name: `${personalRow.vorname} ${personalRow.nachname}`,
        position: personalRow.position
      },
      monat: parseInt(monat),
      jahr: parseInt(jahr),
      ...ergebnis
    });
  } catch (err) {
    logger.error('Lohnabrechnung POST /berechnen Fehler', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST / — Lohnabrechnung speichern
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });

    const {
      personal_id, monat, jahr, brutto, sonderzahlung = 0,
      sonderzahlung_typ = null, notizen = null
    } = req.body;

    if (!personal_id || !monat || !jahr || brutto == null) {
      return res.status(400).json({ error: 'personal_id, monat, jahr und brutto sind erforderlich.' });
    }

    const [[personalRow]] = await pool.query(
      `SELECT id, vorname, nachname,
              steuerklasse, krankenkasse_zusatz, kinderfreibetrag, kirchensteuer_land
       FROM personal WHERE id = ? AND dojo_id = ?`,
      [parseInt(personal_id), dojoId]
    );
    if (!personalRow) return res.status(404).json({ error: 'Mitarbeiter nicht gefunden.' });

    const [[d]] = await pool.query('SELECT organisation_name FROM dojo WHERE id = ?', [dojoId]);
    const calc = berechneLohn(personalRow, brutto, sonderzahlung);

    const [result] = await pool.query(
      `INSERT INTO lohnabrechnung
         (dojo_id, organisation_name, personal_id, monat, jahr,
          brutto, rv_an, av_an, kv_an, pv_an, rv_ag, av_ag, kv_ag, pv_ag,
          lohnsteuer, kirchensteuer, soli, netto, ag_gesamtkosten,
          sonderzahlung, sonderzahlung_typ, notizen, erstellt_von)
       VALUES (?,?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?,?,?, ?,?,?,?)`,
      [
        dojoId, d?.organisation_name || '', parseInt(personal_id),
        parseInt(monat), parseInt(jahr),
        calc.brutto,
        calc.rv_an, calc.av_an, calc.kv_an, calc.pv_an,
        calc.rv_ag, calc.av_ag, calc.kv_ag, calc.pv_ag,
        calc.lohnsteuer, calc.kirchensteuer, calc.soli,
        calc.netto, calc.ag_gesamtkosten,
        calc.sonderzahlung, sonderzahlung_typ || null,
        notizen || null,
        req.user?.id || null
      ]
    );

    res.status(201).json({
      abrechnung_id: result.insertId,
      message: 'Lohnabrechnung gespeichert.',
      ...calc
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Für diesen Mitarbeiter und Monat existiert bereits eine Abrechnung.' });
    }
    logger.error('Lohnabrechnung POST / Fehler', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /uebersicht/:jahr — Jahresübersicht pro Mitarbeiter
// ---------------------------------------------------------------------------
router.get('/uebersicht/:jahr', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });
    const jahr = parseInt(req.params.jahr) || new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT la.personal_id,
              p.vorname, p.nachname, p.position AS mitarbeiter_position,
              COUNT(*) AS anzahl_monate,
              ROUND(SUM(la.brutto + la.sonderzahlung), 2) AS gesamt_brutto,
              ROUND(SUM(la.netto), 2) AS gesamt_netto,
              ROUND(SUM(la.ag_gesamtkosten), 2) AS gesamt_ag_kosten,
              ROUND(SUM(la.lohnsteuer), 2) AS gesamt_lohnsteuer,
              ROUND(SUM(la.rv_an + la.rv_ag), 2) AS gesamt_rv,
              ROUND(SUM(la.kv_an + la.kv_ag), 2) AS gesamt_kv,
              ROUND(SUM(la.sonderzahlung), 2) AS gesamt_sonderzahlungen
       FROM lohnabrechnung la
       JOIN personal p ON la.personal_id = p.id
       WHERE la.dojo_id = ? AND la.jahr = ?
       GROUP BY la.personal_id, p.vorname, p.nachname, p.position
       ORDER BY p.nachname ASC`,
      [dojoId, jahr]
    );

    const [summe] = await pool.query(
      `SELECT ROUND(SUM(brutto + sonderzahlung), 2) AS gesamt_brutto,
              ROUND(SUM(netto), 2) AS gesamt_netto,
              ROUND(SUM(ag_gesamtkosten), 2) AS gesamt_ag_kosten,
              ROUND(SUM(lohnsteuer), 2) AS gesamt_lohnsteuer
       FROM lohnabrechnung WHERE dojo_id = ? AND jahr = ?`,
      [dojoId, jahr]
    );

    res.json({ jahr, mitarbeiter: rows, summe: summe[0] });
  } catch (err) {
    logger.error('Lohnabrechnung GET /uebersicht/:jahr Fehler', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/pdf — Gehaltsabrechnung als PDF
// ---------------------------------------------------------------------------
router.get('/:id/pdf', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });

    const [[la]] = await pool.query(
      `SELECT la.*,
              p.vorname, p.nachname, p.position AS mitarbeiter_position,
              p.sv_nummer, p.steuerklasse, p.krankenkasse, p.krankenkasse_zusatz,
              p.kinderfreibetrag, p.kirchensteuer_land, p.steueridentnummer,
              p.einstellungsdatum,
              d.organisation_name AS dojo_name,
              d.strasse AS dojo_strasse, d.plz AS dojo_plz, d.ort AS dojo_ort,
              d.email AS dojo_email, d.telefon AS dojo_telefon,
              d.iban AS dojo_iban, d.bic AS dojo_bic
       FROM lohnabrechnung la
       JOIN personal p ON la.personal_id = p.id
       LEFT JOIN dojo d ON la.dojo_id = d.id
       WHERE la.abrechnung_id = ? AND la.dojo_id = ?`,
      [parseInt(req.params.id), dojoId]
    );
    if (!la) return res.status(404).json({ error: 'Abrechnung nicht gefunden.' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 55, size: 'A4' });

    const monatNamen = ['Januar','Februar','März','April','Mai','Juni',
                        'Juli','August','September','Oktober','November','Dezember'];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="Gehaltsabrechnung_${la.nachname}_${String(la.monat).padStart(2,'0')}_${la.jahr}.pdf"`);
    doc.pipe(res);

    const fmtEur = (n) =>
      Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '—';

    const W = 485; // usable width
    const COL2 = 390; // right column x for amounts

    // ── Header: Arbeitgeber ──────────────────────────────────────────────────
    doc.rect(55, 40, W, 50).fill('#1a1a2e');
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
       .text(la.dojo_name || '', 65, 52);
    doc.fontSize(9).font('Helvetica')
       .text(`${la.dojo_strasse || ''} · ${la.dojo_plz || ''} ${la.dojo_ort || ''}`, 65, 70);

    // ── Titel ────────────────────────────────────────────────────────────────
    doc.fillColor('#1a1a2e').fontSize(16).font('Helvetica-Bold')
       .text(`Gehaltsabrechnung ${monatNamen[la.monat - 1]} ${la.jahr}`, 55, 108);
    doc.moveTo(55, 128).lineTo(55 + W, 128).strokeColor('#1a1a2e').lineWidth(1.5).stroke();

    // ── Mitarbeiter-Stammdaten (2-spaltig) ───────────────────────────────────
    const col1x = 55, col2x = 295;
    let y = 140;
    const printRow = (label, value, x, yy) => {
      doc.fontSize(8).fillColor('#666').font('Helvetica').text(label, x, yy);
      doc.fontSize(10).fillColor('#000').font('Helvetica')
         .text(value || '—', x, yy + 10);
    };

    printRow('Mitarbeiter', `${la.vorname} ${la.nachname}`, col1x, y);
    printRow('Position', la.mitarbeiter_position || '', col2x, y);
    y += 35;
    printRow('Steuerklasse', String(la.steuerklasse || 1), col1x, y);
    printRow('SV-Nummer', la.sv_nummer || '—', col2x, y);
    y += 35;
    printRow('Krankenkasse', la.krankenkasse || '—', col1x, y);
    printRow('Zusatzbeitrag', `${Number(la.krankenkasse_zusatz || 1.70).toFixed(2)} %`, col2x, y);
    y += 35;
    printRow('Kinderfreibetrag', String(Number(la.kinderfreibetrag || 0).toFixed(1)), col1x, y);
    printRow('Kirchensteuer', la.kirchensteuer_land || '—', col2x, y);
    y += 35;
    if (la.steueridentnummer) {
      printRow('Steuer-ID', la.steueridentnummer, col1x, y);
      y += 35;
    }

    // Trennlinie
    y += 5;
    doc.moveTo(55, y).lineTo(55 + W, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    y += 12;

    // ── Abrechnungstabelle ────────────────────────────────────────────────────
    const drawTableHeader = (yy, label) => {
      doc.rect(55, yy, W, 20).fill('#f0f0f5');
      doc.fontSize(9).fillColor('#1a1a2e').font('Helvetica-Bold')
         .text(label, 60, yy + 6);
      doc.text('Betrag', COL2, yy + 6, { width: 100, align: 'right' });
    };

    const drawRow = (yy, label, value, bold = false, color = '#000000') => {
      doc.fontSize(10).fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(label, 60, yy);
      doc.text(fmtEur(value), COL2, yy, { width: 100, align: 'right' });
      return yy + 18;
    };

    // Bruttolohn
    drawTableHeader(y, 'Bruttoverdienst');
    y += 24;
    y = drawRow(y, 'Grundgehalt', la.brutto);
    if (Number(la.sonderzahlung) > 0) {
      y = drawRow(y, `Sonderzahlung${la.sonderzahlung_typ ? ' (' + la.sonderzahlung_typ + ')' : ''}`, la.sonderzahlung);
    }
    const bruttoGesamt = round2(Number(la.brutto) + Number(la.sonderzahlung));
    doc.moveTo(55, y).lineTo(55 + W, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    y += 4;
    y = drawRow(y, 'Brutto gesamt', bruttoGesamt, true);
    y += 6;

    // SV Arbeitnehmer
    drawTableHeader(y, 'Sozialversicherung Arbeitnehmer-Anteil');
    y += 24;
    y = drawRow(y, 'Rentenversicherung (9,30 %)', la.rv_an, false, '#cc0000');
    y = drawRow(y, 'Arbeitslosenversicherung (1,30 %)', la.av_an, false, '#cc0000');
    const kvANPct = round2((Number(la.kv_an) / Math.min(bruttoGesamt, 5512.50)) * 100);
    y = drawRow(y, `Krankenversicherung (${kvANPct.toFixed(2)} %)`, la.kv_an, false, '#cc0000');
    const pvANPct = round2((Number(la.pv_an) / Math.min(bruttoGesamt, 5512.50)) * 100);
    y = drawRow(y, `Pflegeversicherung (${pvANPct.toFixed(2)} %)`, la.pv_an, false, '#cc0000');
    const sv_an = round2(Number(la.rv_an) + Number(la.av_an) + Number(la.kv_an) + Number(la.pv_an));
    doc.moveTo(55, y).lineTo(55 + W, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    y += 4;
    y = drawRow(y, 'SV-Abzüge gesamt', sv_an, true, '#cc0000');
    y += 6;

    // Steuern
    drawTableHeader(y, 'Steuern');
    y += 24;
    y = drawRow(y, 'Lohnsteuer', la.lohnsteuer, false, '#cc0000');
    if (Number(la.soli) > 0) y = drawRow(y, 'Solidaritätszuschlag (5,5 %)', la.soli, false, '#cc0000');
    if (Number(la.kirchensteuer) > 0) y = drawRow(y, `Kirchensteuer (${la.kirchensteuer_land === 'Bayern' ? '8' : '9'} %)`, la.kirchensteuer, false, '#cc0000');
    y += 6;

    // Netto
    doc.rect(55, y, W, 26).fill('#1a1a2e');
    doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
       .text('Auszahlungsbetrag (Netto)', 60, y + 7);
    doc.text(fmtEur(la.netto), COL2, y + 7, { width: 100, align: 'right' });
    y += 34;

    // AG-Kosten (kleiner Block)
    y += 8;
    drawTableHeader(y, 'Arbeitgeberkosten (Information)');
    y += 24;
    y = drawRow(y, 'Brutto gesamt', bruttoGesamt);
    const sv_ag = round2(Number(la.rv_ag) + Number(la.av_ag) + Number(la.kv_ag) + Number(la.pv_ag));
    y = drawRow(y, 'SV Arbeitgeber-Anteil', sv_ag);
    doc.moveTo(55, y).lineTo(55 + W, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    y += 4;
    y = drawRow(y, 'AG-Gesamtkosten', la.ag_gesamtkosten, true);

    // Bankverbindung
    if (la.dojo_iban) {
      y += 16;
      doc.fontSize(8).fillColor('#666').font('Helvetica')
         .text(`Überweisung auf: IBAN ${la.dojo_iban}${la.dojo_bic ? '  BIC ' + la.dojo_bic : ''}`, 55, y);
    }

    // Footer
    const footerY = doc.page.height - 50;
    doc.moveTo(55, footerY - 10).lineTo(55 + W, footerY - 10)
       .strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor('#999').font('Helvetica')
       .text(
         `Erstellt am: ${fmtDate(la.erstellt_am)}  ·  ${la.dojo_name || ''}  ·  ${la.dojo_email || ''}  ·  ${la.dojo_telefon || ''}`,
         55, footerY, { width: W, align: 'center' }
       );

    doc.end();
  } catch (err) {
    logger.error('Lohnabrechnung GET /:id/pdf Fehler', { error: err.message });
    res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Lohnabrechnung löschen
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });

    const [result] = await pool.query(
      'DELETE FROM lohnabrechnung WHERE abrechnung_id = ? AND dojo_id = ?',
      [parseInt(req.params.id), dojoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Abrechnung nicht gefunden.' });
    }

    res.json({ message: 'Abrechnung gelöscht.' });
  } catch (err) {
    logger.error('Lohnabrechnung DELETE /:id Fehler', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
