// =====================================================================================
// BUSINESSPLAN ROUTES — Finanz-/Liquiditätsplanung, Businessplan-PDF & Ziele-Board
// =====================================================================================
// Orientiert an der Finanzplanungs-Systematik des Hans-Lindner-Instituts.
//
//   GET  /api/businessplan/plaene                 Liste der Pläne (Dojo)
//   POST /api/businessplan/plaene                 Plan anlegen
//   GET  /api/businessplan/plaene/:id             Plan + alle Positionen
//   PUT  /api/businessplan/plaene/:id             Plan-Stammdaten/Annahmen/Texte
//   DELETE /api/businessplan/plaene/:id
//   GET  /api/businessplan/plaene/:id/auswertung  Rentabilität + Liquidität + 3-Jahres + Bilanzcheck
//   GET  /api/businessplan/plaene/:id/pdf          Businessplan als PDF
//
//   Positionen (je Plan):  investitionen · finanzierung · umsatz · kosten · privatentnahmen
//     GET    /api/businessplan/plaene/:planId/:resource
//     POST   /api/businessplan/plaene/:planId/:resource
//     PUT    /api/businessplan/:resource/:id
//     DELETE /api/businessplan/:resource/:id
//
//   Ziele-Board:  GET/POST /ziele · PUT/DELETE /ziele/:id · Meilensteine
//   Ist-Kennzahlen:  GET /ist-kennzahlen (Vorbefüllung aus echten Dojo-Daten)
//   Dokument-Historie: GET /dokumente
//
// Mount in server.js: app.use('/api/businessplan', authenticateToken, businessplanRoutes)

const express = require('express');
const router = express.Router();
const db = require('../db');
const pool = db.promise();
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { requireFeature } = require('../middleware/featureAccess');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// Auth + Enterprise-Feature-Gate für alle Businessplan-Routen.
// Self-Auth, da der Auto-Route-Loader (server.js) ohne authenticateToken mountet.
router.use(authenticateToken);
router.use(requireFeature('businessplan'));

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────────
function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}
const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Ø monatliches Wachstum mit Median-Spike-Filter (analog zentraler Prognose-Engine).
function avgMitSpikeFilter(werte) {
  const nums = werte.map(v => Number(v) || 0);
  if (!nums.length) return 0;
  const sortiert = [...nums].sort((a, b) => a - b);
  const median = sortiert[Math.floor(sortiert.length / 2)];
  const gefiltert = nums.map(v => (median > 0 && v > median * 3) ? median : v);
  return gefiltert.reduce((a, b) => a + b, 0) / gefiltert.length;
}

// Lädt Plan + prüft Dojo-Zugehörigkeit (null bei Super-Admin ohne Dojo-Filter).
async function loadPlan(planId, dojoId) {
  if (dojoId) {
    const [rows] = await pool.query(
      'SELECT * FROM businessplan_plaene WHERE id = ? AND dojo_id = ?', [planId, dojoId]);
    return rows[0] || null;
  }
  const [rows] = await pool.query('SELECT * FROM businessplan_plaene WHERE id = ?', [planId]);
  return rows[0] || null;
}

// Lädt alle Positionen eines Plans gebündelt.
async function loadPositionen(planId) {
  const [[investitionen], [finanzierung], [umsatz], [kosten], [privatentnahmen]] = await Promise.all([
    pool.query('SELECT * FROM businessplan_investitionen WHERE plan_id = ? ORDER BY sort_order, id', [planId]),
    pool.query('SELECT * FROM businessplan_finanzierung WHERE plan_id = ? ORDER BY sort_order, id', [planId]),
    pool.query('SELECT * FROM businessplan_umsatz WHERE plan_id = ? ORDER BY sort_order, id', [planId]),
    pool.query('SELECT * FROM businessplan_kosten WHERE plan_id = ? ORDER BY sort_order, id', [planId]),
    pool.query('SELECT * FROM businessplan_privatentnahmen WHERE plan_id = ? ORDER BY sort_order, id', [planId]),
  ]);
  return { investitionen, finanzierung, umsatz, kosten, privatentnahmen };
}

// ════════════════════════════════════════════════════════════════════════════════
// AUSWERTUNGS-ENGINE — Rentabilität, Liquidität, 3-Jahres-Plan, Mittelbilanz
// ════════════════════════════════════════════════════════════════════════════════
function computeAuswertung(plan, pos) {
  const a = parseJson(plan.annahmen, {});
  const sozialP   = num(a.sozialkostenProzent) || 24;     // Aufschlag auf AN-Brutto
  const steuerP   = num(a.steuersatzProzent) || 30;       // ergebnisabh. Steuern
  const erlSchmP  = num(a.erloesschmaelerungProzent) || 0;
  const startLiq  = num(a.startLiquiditaet);
  const wachsUmsatz = [0, num(a.umsatzWachstumJ2), num(a.umsatzWachstumJ3)];   // %
  const wachsKosten = [0, num(a.kostenWachstumJ2), num(a.kostenWachstumJ3)];   // %
  // Hans-Lindner: weitere Erträge/Aufwendungen + Liquiditäts-Parameter
  const sonstErtragMon    = num(a.sonstigeErtraegeMonat);   // sonstige betriebl. Erträge / Monat
  const zinsertraegeJahr  = num(a.zinsertraegeJahr);        // Zinserträge / Jahr
  const neutralErtragJahr = num(a.neutraleErtraegeJahr);    // sonstige neutrale Erträge / Jahr
  const neutralAufwJahr   = num(a.neutraleAufwendungenJahr);// sonstige neutrale Aufwendungen / Jahr
  const privateinlMon     = num(a.privateinlagenMonat);     // Privat-/Kapitaleinlagen / Monat
  const ustSatz           = (a.umsatzsteuerProzent != null ? num(a.umsatzsteuerProzent) : 19) / 100;
  const zahlungsziel      = Math.max(0, Math.min(6, num(a.zahlungszielMonate))); // Umsatz-Eingang nach n Monaten

  // --- Umsatz (Monat & Jahr) ---
  const umsatzMonat = pos.umsatz.reduce((s, u) => s + num(u.menge_monatlich) * num(u.preis_einheit), 0);

  // --- Kosten je Kategorie (monatlich) ---
  const katSumme = (kat) => pos.kosten
    .filter(k => k.kategorie === kat)
    .reduce((s, k) => {
      let betrag = num(k.betrag_monatlich);
      if (kat === 'personal' && (k.ist_brutto_personal === 1 || k.ist_brutto_personal === true)) {
        betrag = betrag * (1 + sozialP / 100);
      }
      return s + betrag;
    }, 0);

  const kostenMonat = {
    material:        katSumme('material'),
    fremdleistung:   katSumme('fremdleistung'),
    personal:        katSumme('personal'),
    raumkosten:      katSumme('raumkosten'),
    versicherungen:  katSumme('versicherungen'),
    kfz:             katSumme('kfz'),
    werbung:         katSumme('werbung'),
    reparatur:       katSumme('reparatur'),
    warenabgabe:     katSumme('warenabgabe'),
    sonstige_steuern: katSumme('sonstige_steuern'),
    sonstige:        katSumme('sonstige'),
  };

  // --- Abschreibungen (AfA, jährlich) ---
  const afaJahr = pos.investitionen.reduce((s, i) => {
    const dauer = num(i.nutzungsdauer_jahre);
    return dauer > 0 ? s + num(i.betrag) / dauer : s;
  }, 0);
  const investitionGesamt = pos.investitionen.reduce((s, i) => s + num(i.betrag), 0);

  // --- Finanzierung & Kapitaldienst ---
  const finanzierungGesamt = pos.finanzierung.reduce((s, f) => s + num(f.betrag), 0);
  const eigenkapital = pos.finanzierung
    .filter(f => ['eigenkapital', 'sacheinlage', 'beteiligung'].includes(f.art))
    .reduce((s, f) => s + num(f.betrag), 0);
  const darlehen = pos.finanzierung.filter(f => ['darlehen', 'betriebsmittelkredit', 'kontokorrent'].includes(f.art));
  const zinsenJahr = darlehen.reduce((s, f) => s + num(f.betrag) * num(f.zinssatz_prozent) / 100, 0);
  const tilgungJahr = darlehen.reduce((s, f) => {
    const jahre = num(f.laufzeit_monate) / 12;
    return jahre > 0 ? s + num(f.betrag) / jahre : s;
  }, 0);

  // --- Privatentnahmen (jährlich) ---
  const privatJahr = pos.privatentnahmen.reduce((s, p) => s + num(p.betrag_monatlich), 0) * 12;

  // --- Rentabilitätsrechnung für ein Jahr (mit Wachstumsfaktoren) ---
  function rentabilitaet(jahrIdx) {
    // Kumulierte Wachstumsfaktoren bis zum jeweiligen Planjahr
    let umsatzFaktor = 1, kostenFaktor = 1;
    for (let j = 1; j <= jahrIdx; j++) { umsatzFaktor *= (1 + wachsUmsatz[j] / 100); kostenFaktor *= (1 + wachsKosten[j] / 100); }

    const umsatzJahr   = umsatzMonat * 12 * umsatzFaktor;
    const erloesSchm   = umsatzJahr * erlSchmP / 100;
    const gesamtleistung = umsatzJahr - erloesSchm;
    const material     = kostenMonat.material * 12 * kostenFaktor;
    const fremdl       = kostenMonat.fremdleistung * 12 * kostenFaktor;
    const rohertrag    = gesamtleistung - material - fremdl;
    const sonstErtraege = sonstErtragMon * 12 * umsatzFaktor;        // sonstige betriebl. Erträge
    const betrieblicherRohertrag = rohertrag + sonstErtraege;

    const personal     = kostenMonat.personal * 12 * kostenFaktor;
    const raumkosten   = kostenMonat.raumkosten * 12 * kostenFaktor;
    const versicherungen = kostenMonat.versicherungen * 12 * kostenFaktor;
    const kfz          = kostenMonat.kfz * 12 * kostenFaktor;
    const werbung      = kostenMonat.werbung * 12 * kostenFaktor;
    const warenabgabe  = kostenMonat.warenabgabe * 12 * kostenFaktor;
    const reparatur    = kostenMonat.reparatur * 12 * kostenFaktor;
    const sonstSteuern = kostenMonat.sonstige_steuern * 12 * kostenFaktor;
    const sonstige     = kostenMonat.sonstige * 12 * kostenFaktor;
    const abschreibung = afaJahr; // AfA wächst nicht mit Umsatz

    const betriebskosten = personal + raumkosten + versicherungen + kfz + werbung + warenabgabe + reparatur + sonstSteuern + sonstige + abschreibung;
    const betriebsergebnisVorZins = betrieblicherRohertrag - betriebskosten;
    // + Zinserträge − Zinsaufwendungen + sonstige neutrale Erträge − sonstige neutrale Aufwendungen
    const ergebnisVorSteuern = betriebsergebnisVorZins + zinsertraegeJahr - zinsenJahr + neutralErtragJahr - neutralAufwJahr;
    const steuern = Math.max(0, ergebnisVorSteuern) * steuerP / 100;
    const jahresergebnis = ergebnisVorSteuern - steuern;
    const cashflow = jahresergebnis + abschreibung;
    const privateinlagenJahr = privateinlMon * 12;
    const liquiditaetsergebnis = cashflow - privatJahr - tilgungJahr + privateinlagenJahr;

    return {
      jahr: plan.planungsjahr + jahrIdx,
      umsatzerloese: round2(umsatzJahr),
      erloesschmaelerung: round2(erloesSchm),
      gesamtleistung: round2(gesamtleistung),
      material: round2(material),
      fremdleistungen: round2(fremdl),
      rohertrag: round2(rohertrag),
      sonstigeErtraege: round2(sonstErtraege),
      betrieblicherRohertrag: round2(betrieblicherRohertrag),
      personalaufwand: round2(personal),
      raumkosten: round2(raumkosten),
      versicherungen: round2(versicherungen),
      kfzKosten: round2(kfz),
      werbekosten: round2(werbung),
      kostenWarenabgabe: round2(warenabgabe),
      reparaturkosten: round2(reparatur),
      sonstigeSteuern: round2(sonstSteuern),
      sonstigeAufwendungen: round2(sonstige),
      abschreibungen: round2(abschreibung),
      zinsertraege: round2(zinsertraegeJahr),
      zinsaufwendungen: round2(zinsenJahr),
      neutraleErtraege: round2(neutralErtragJahr),
      neutraleAufwendungen: round2(neutralAufwJahr),
      ergebnisVorSteuern: round2(ergebnisVorSteuern),
      steuern: round2(steuern),
      betriebsergebnis: round2(jahresergebnis),
      cashflow: round2(cashflow),
      privatentnahmen: round2(privatJahr),
      privateinlagen: round2(privateinlagenJahr),
      tilgung: round2(tilgungJahr),
      liquiditaetsergebnis: round2(liquiditaetsergebnis),
    };
  }

  const dreiJahre = [0, 1, 2].map(rentabilitaet);
  const j1 = dreiJahre[0];

  // --- Monatliche Liquiditätsplanung (Jahr 1) ---
  // Modelliert nach Hans-Lindner inkl. Umsatzsteuer-Zahllast (Folgemonat) und
  // Zahlungsziel (Umsatz-Eingang verzögert). Beträge brutto, Vorsteuer separat.
  const monateLiq = [];
  const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const monBetriebskosten = (kostenMonat.material + kostenMonat.fremdleistung + kostenMonat.personal +
    kostenMonat.raumkosten + kostenMonat.versicherungen + kostenMonat.kfz + kostenMonat.werbung +
    kostenMonat.warenabgabe + kostenMonat.reparatur + kostenMonat.sonstige_steuern + kostenMonat.sonstige);
  // Vorsteuer-fähige (USt-belastete) Kostenarten
  const monVatableKosten = kostenMonat.material + kostenMonat.fremdleistung + kostenMonat.warenabgabe +
    kostenMonat.kfz + kostenMonat.werbung + kostenMonat.reparatur + kostenMonat.sonstige;
  const monZins = zinsenJahr / 12;
  const monTilgung = tilgungJahr / 12;
  const monPrivat = privatJahr / 12;
  const monSteuern = j1.steuern / 12;

  // Investitionen fallen im jeweiligen Anschaffungsmonat an
  const investNachMonat = {};
  pos.investitionen.forEach(i => {
    const m = Math.min(12, Math.max(1, num(i.anschaffung_monat) || 1));
    investNachMonat[m] = (investNachMonat[m] || 0) + num(i.betrag);
  });

  // Startsaldo: vorhandene Liquidität + komplette Mittelherkunft (EK + Darlehen) zu Beginn;
  // Investitionen fließen im jeweiligen Anschaffungsmonat ab.
  let saldo = startLiq + finanzierungGesamt;
  let ustZahllastVormonat = 0;  // USt-Zahllast wird im Folgemonat ans Finanzamt abgeführt
  for (let i = 0; i < 12; i++) {
    const investMonat  = investNachMonat[i + 1] || 0;
    // Umsatz-Eingang erst nach Zahlungsziel (vorher 0)
    const umsatzEingang = (i >= zahlungsziel) ? umsatzMonat : 0;
    const ustEingang    = umsatzEingang * ustSatz;                 // vereinnahmte USt
    const vorsteuer     = (monVatableKosten + investMonat) * ustSatz; // gezahlte Vorsteuer
    const ustZahllast   = ustEingang - vorsteuer;                  // USt - VSt (kann negativ sein)

    const einzahlungen = umsatzEingang + ustEingang + sonstErtragMon + privateinlMon;
    const auszahlungen = monBetriebskosten + vorsteuer + monZins + monTilgung + monPrivat +
      monSteuern + investMonat + Math.max(0, ustZahllastVormonat);
    const ueberschuss = einzahlungen - auszahlungen;
    saldo += ueberschuss;
    ustZahllastVormonat = ustZahllast;
    monateLiq.push({
      monat: i + 1, label: MONATE_KURZ[i],
      einzahlungen: round2(einzahlungen),
      auszahlungen: round2(auszahlungen),
      umsatzsteuer: round2(Math.max(0, ustZahllast)),
      ueberschuss: round2(ueberschuss),
      saldo: round2(saldo),
    });
  }

  // --- Mittelverwendung / Mittelherkunft (Bilanzcheck) ---
  const mittelbilanz = {
    mittelverwendung: round2(investitionGesamt),
    mittelherkunft: round2(finanzierungGesamt),
    differenz: round2(finanzierungGesamt - investitionGesamt),
    eigenkapital: round2(eigenkapital),
    eigenkapitalquote: finanzierungGesamt > 0 ? round2(eigenkapital / finanzierungGesamt * 100) : 0,
  };

  return {
    kennzahlen: {
      umsatzMonat: round2(umsatzMonat),
      umsatzJahr: j1.umsatzerloese,
      betriebsergebnisJahr: j1.betriebsergebnis,
      cashflowJahr: j1.cashflow,
      afaJahr: round2(afaJahr),
      zinsenJahr: round2(zinsenJahr),
      tilgungJahr: round2(tilgungJahr),
      privatentnahmenJahr: round2(privatJahr),
      liquiditaetsergebnisJahr: j1.liquiditaetsergebnis,
      breakEvenMonat: monateLiq.findIndex(m => m.saldo >= 0) + 1 || null,
      tiefsterSaldo: round2(Math.min(...monateLiq.map(m => m.saldo))),
    },
    rentabilitaet: j1,
    dreiJahresPlan: dreiJahre,
    liquiditaet: monateLiq,
    mittelbilanz,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// IST-KENNZAHLEN — echte Dojo-Daten zur Vorbefüllung
// ════════════════════════════════════════════════════════════════════════════════
async function getIstKennzahlen(dojoId) {
  const [[{ aktuell }]] = await pool.query(
    'SELECT COUNT(*) AS aktuell FROM mitglieder WHERE dojo_id = ? AND aktiv = 1', [dojoId]);

  const [verlauf] = await pool.query(
    `SELECT DATE_FORMAT(eintrittsdatum, '%Y-%m') AS monat, COUNT(*) AS neu
     FROM mitglieder WHERE dojo_id = ? AND eintrittsdatum >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY monat ORDER BY monat`, [dojoId]);
  const wachstumProMonat = Math.round(avgMitSpikeFilter(verlauf.map(r => r.neu)) * 10) / 10;

  const [[{ beitragSumme, monateMitUmsatz }]] = await pool.query(
    `SELECT COALESCE(SUM(betrag),0) AS beitragSumme,
            COUNT(DISTINCT DATE_FORMAT(zahlungsdatum, '%Y-%m')) AS monateMitUmsatz
     FROM beitraege WHERE dojo_id = ? AND bezahlt = 1
       AND zahlungsdatum >= DATE_SUB(NOW(), INTERVAL 12 MONTH)`, [dojoId]);
  const monatsumsatz = monateMitUmsatz > 0 ? Number(beitragSumme) / monateMitUmsatz : 0;
  const durchschnittsbeitrag = aktuell > 0 ? round2(monatsumsatz / aktuell) : 0;

  return {
    aktuelleMitglieder: aktuell,
    wachstumProMonat,
    durchschnittsbeitrag,
    monatsumsatzBeitraege: round2(monatsumsatz),
    verlauf,
  };
}

router.get('/ist-kennzahlen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    res.json(await getIstKennzahlen(dojoId));
  } catch (err) {
    logger.error('[Businessplan] Ist-Kennzahlen Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden der Ist-Kennzahlen' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// PLÄNE (CRUD)
// ════════════════════════════════════════════════════════════════════════════════
router.get('/plaene', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const where = dojoId ? 'WHERE dojo_id = ?' : '';
    const [rows] = await pool.query(
      `SELECT id, dojo_id, titel, firmenname, rechtsform, planungsjahr, status, created_at, updated_at
       FROM businessplan_plaene ${where} ORDER BY planungsjahr DESC, updated_at DESC`,
      dojoId ? [dojoId] : []);
    res.json(rows);
  } catch (err) {
    logger.error('[Businessplan] Pläne laden Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden der Pläne' });
  }
});

router.get('/plaene/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const plan = await loadPlan(req.params.id, dojoId);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });
    const positionen = await loadPositionen(plan.id);
    plan.annahmen = parseJson(plan.annahmen, {});
    plan.dokument_texte = parseJson(plan.dokument_texte, {});
    res.json({ ...plan, ...positionen });
  } catch (err) {
    logger.error('[Businessplan] Plan laden Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden des Plans' });
  }
});

router.post('/plaene', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const { titel, firmenname, rechtsform, planungsjahr, annahmen, dokument_texte, status, ausIst } = req.body;
    const jahr = parseInt(planungsjahr, 10) || new Date().getFullYear();

    // Vorbefüllung aus Ist-Daten (so viel wie möglich übernehmen)
    let initialAnnahmen = annahmen || null;
    let ist = null;
    if (ausIst) {
      ist = await getIstKennzahlen(dojoId);
      initialAnnahmen = {
        sozialkostenProzent: 24, steuersatzProzent: 30, erloesschmaelerungProzent: 0,
        startLiquiditaet: 0,
        umsatzWachstumJ2: 5, umsatzWachstumJ3: 5, kostenWachstumJ2: 3, kostenWachstumJ3: 3,
        ...(annahmen || {}),
      };
    }

    const [r] = await pool.query(
      `INSERT INTO businessplan_plaene (dojo_id, titel, firmenname, rechtsform, planungsjahr, status, annahmen, dokument_texte)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, titel || `Businessplan ${jahr}`, firmenname || null, rechtsform || null, jahr,
       ['entwurf', 'aktiv', 'archiviert'].includes(status) ? status : 'entwurf',
       initialAnnahmen ? JSON.stringify(initialAnnahmen) : null,
       dokument_texte ? JSON.stringify(dokument_texte) : null]);

    const planId = r.insertId;

    // Aus Ist: Umsatzposition Mitgliedsbeiträge (Menge = aktive Mitglieder × Ø-Beitrag)
    if (ausIst && ist && ist.aktuelleMitglieder > 0) {
      await pool.query(
        `INSERT INTO businessplan_umsatz (dojo_id, plan_id, bezeichnung, einheit, menge_monatlich, preis_einheit, sort_order)
         VALUES (?, ?, 'Mitgliedsbeiträge', 'Mitglied', ?, ?, 0)`,
        [dojoId, planId, ist.aktuelleMitglieder, ist.durchschnittsbeitrag]);
    }

    res.status(201).json({ id: planId, uebernommen: ausIst ? ist : null });
  } catch (err) {
    logger.error('[Businessplan] Plan anlegen Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Anlegen des Plans' });
  }
});

router.put('/plaene/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const plan = await loadPlan(req.params.id, dojoId);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });
    const { titel, firmenname, rechtsform, planungsjahr, annahmen, dokument_texte, status } = req.body;
    await pool.query(
      `UPDATE businessplan_plaene
       SET titel=?, firmenname=?, rechtsform=?, planungsjahr=?, status=?, annahmen=?, dokument_texte=?
       WHERE id=? AND dojo_id=?`,
      [titel ?? plan.titel,
       firmenname !== undefined ? firmenname : plan.firmenname,
       rechtsform !== undefined ? rechtsform : plan.rechtsform,
       parseInt(planungsjahr, 10) || plan.planungsjahr,
       ['entwurf', 'aktiv', 'archiviert'].includes(status) ? status : plan.status,
       annahmen !== undefined ? JSON.stringify(annahmen) : plan.annahmen,
       dokument_texte !== undefined ? JSON.stringify(dokument_texte) : plan.dokument_texte,
       plan.id, dojoId]);
    res.json({ success: true });
  } catch (err) {
    logger.error('[Businessplan] Plan aktualisieren Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Plans' });
  }
});

router.delete('/plaene/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const [r] = await pool.query('DELETE FROM businessplan_plaene WHERE id=? AND dojo_id=?', [req.params.id, dojoId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Plan nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('[Businessplan] Plan löschen Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Löschen des Plans' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// AUSWERTUNG
// ════════════════════════════════════════════════════════════════════════════════
router.get('/plaene/:id/auswertung', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const plan = await loadPlan(req.params.id, dojoId);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });
    const positionen = await loadPositionen(plan.id);
    res.json({ planId: plan.id, planungsjahr: plan.planungsjahr, ...computeAuswertung(plan, positionen) });
  } catch (err) {
    logger.error('[Businessplan] Auswertung Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler bei der Auswertung' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GENERISCHES CRUD für Positions-Tabellen
// ════════════════════════════════════════════════════════════════════════════════
const RESOURCES = {
  investitionen: {
    table: 'businessplan_investitionen',
    fields: ['kategorie', 'bezeichnung', 'betrag', 'nutzungsdauer_jahre', 'anschaffung_monat', 'sort_order'],
    nums: ['betrag', 'nutzungsdauer_jahre', 'anschaffung_monat', 'sort_order'],
  },
  finanzierung: {
    table: 'businessplan_finanzierung',
    fields: ['art', 'bezeichnung', 'betrag', 'zinssatz_prozent', 'laufzeit_monate', 'tilgungsfrei_monate', 'sort_order'],
    nums: ['betrag', 'zinssatz_prozent', 'laufzeit_monate', 'tilgungsfrei_monate', 'sort_order'],
  },
  umsatz: {
    table: 'businessplan_umsatz',
    fields: ['bezeichnung', 'einheit', 'menge_monatlich', 'preis_einheit', 'sort_order'],
    nums: ['menge_monatlich', 'preis_einheit', 'sort_order'],
  },
  kosten: {
    table: 'businessplan_kosten',
    fields: ['kategorie', 'bezeichnung', 'betrag_monatlich', 'ist_brutto_personal', 'sort_order'],
    nums: ['betrag_monatlich', 'sort_order'],
    bools: ['ist_brutto_personal'],
  },
  privatentnahmen: {
    table: 'businessplan_privatentnahmen',
    fields: ['kategorie', 'bezeichnung', 'betrag_monatlich', 'sort_order'],
    nums: ['betrag_monatlich', 'sort_order'],
  },
};

function coerce(cfg, body) {
  const out = {};
  for (const f of cfg.fields) {
    let v = body[f];
    if (cfg.nums && cfg.nums.includes(f)) v = (v === '' || v == null) ? 0 : Number(v) || 0;
    else if (cfg.bools && cfg.bools.includes(f)) v = (v === true || v === 1 || v === '1') ? 1 : 0;
    else v = v ?? null;
    out[f] = v;
  }
  return out;
}

// LIST + CREATE (über Plan)
// Hinweis: Bei unbekannter Ressource per next() durchfallen lassen, damit spezifische
// Routen wie /plaene/:id/pdf oder /plaene/:id/auswertung nicht abgefangen werden.
router.get('/plaene/:planId/:resource', async (req, res, next) => {
  const cfg = RESOURCES[req.params.resource];
  if (!cfg) return next();
  try {
    const dojoId = getSecureDojoId(req);
    const plan = await loadPlan(req.params.planId, dojoId);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });
    const [rows] = await pool.query(
      `SELECT * FROM ${cfg.table} WHERE plan_id = ? ORDER BY sort_order, id`, [plan.id]);
    res.json(rows);
  } catch (err) {
    logger.error('[Businessplan] Positionen laden Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden der Positionen' });
  }
});

router.post('/plaene/:planId/:resource', async (req, res, next) => {
  const cfg = RESOURCES[req.params.resource];
  if (!cfg) return next();
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const plan = await loadPlan(req.params.planId, dojoId);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });
    if (!req.body.bezeichnung) return res.status(400).json({ error: 'Bezeichnung fehlt' });

    const data = coerce(cfg, req.body);
    const cols = ['dojo_id', 'plan_id', ...cfg.fields];
    const vals = [dojoId, plan.id, ...cfg.fields.map(f => data[f])];
    const [r] = await pool.query(
      `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    logger.error('[Businessplan] Position anlegen Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Anlegen der Position' });
  }
});

// UPDATE + DELETE (über Positions-ID, Dojo-gesichert)
// Unbekannte Ressource → next(), damit /ziele/:id und /meilensteine/:id greifen.
router.put('/:resource/:id', async (req, res, next) => {
  const cfg = RESOURCES[req.params.resource];
  if (!cfg) return next();
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const data = coerce(cfg, req.body);
    const setClause = cfg.fields.map(f => `${f} = ?`).join(', ');
    const [r] = await pool.query(
      `UPDATE ${cfg.table} SET ${setClause} WHERE id = ? AND dojo_id = ?`,
      [...cfg.fields.map(f => data[f]), req.params.id, dojoId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Position nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('[Businessplan] Position aktualisieren Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Position' });
  }
});

router.delete('/:resource/:id', async (req, res, next) => {
  const cfg = RESOURCES[req.params.resource];
  if (!cfg) return next();
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const [r] = await pool.query(`DELETE FROM ${cfg.table} WHERE id = ? AND dojo_id = ?`, [req.params.id, dojoId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Position nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('[Businessplan] Position löschen Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Löschen der Position' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// ZIELE-BOARD + MEILENSTEINE
// ════════════════════════════════════════════════════════════════════════════════
router.get('/ziele', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const jahr = parseInt(req.query.jahr, 10) || new Date().getFullYear();
    const [ziele] = await pool.query(
      'SELECT * FROM businessplan_ziele WHERE dojo_id = ? AND jahr = ? ORDER BY sort_order, id', [dojoId, jahr]);
    if (ziele.length) {
      const [ms] = await pool.query(
        'SELECT * FROM businessplan_meilensteine WHERE ziel_id IN (?) ORDER BY faellig_am, sort_order, id',
        [ziele.map(z => z.id)]);
      const byZiel = {};
      ms.forEach(m => { (byZiel[m.ziel_id] = byZiel[m.ziel_id] || []).push(m); });
      ziele.forEach(z => { z.meilensteine = byZiel[z.id] || []; });
    }
    res.json(ziele);
  } catch (err) {
    logger.error('[Businessplan] Ziele laden Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden der Ziele' });
  }
});

router.post('/ziele', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const { jahr, titel, beschreibung, kpi_name, zielwert, istwert, einheit, status, faellig_am, sort_order } = req.body;
    if (!titel) return res.status(400).json({ error: 'Titel fehlt' });
    const [r] = await pool.query(
      `INSERT INTO businessplan_ziele
        (dojo_id, jahr, titel, beschreibung, kpi_name, zielwert, istwert, einheit, status, faellig_am, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, parseInt(jahr, 10) || new Date().getFullYear(), titel, beschreibung || null, kpi_name || null,
       zielwert !== '' && zielwert != null ? Number(zielwert) : null,
       istwert !== '' && istwert != null ? Number(istwert) : 0, einheit || null,
       ['offen', 'laeuft', 'erreicht', 'verfehlt'].includes(status) ? status : 'offen',
       faellig_am || null, parseInt(sort_order, 10) || 0]);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    logger.error('[Businessplan] Ziel anlegen Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Anlegen des Ziels' });
  }
});

router.put('/ziele/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const [rows] = await pool.query('SELECT * FROM businessplan_ziele WHERE id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    const z = rows[0];
    if (!z) return res.status(404).json({ error: 'Ziel nicht gefunden' });
    const b = req.body;
    await pool.query(
      `UPDATE businessplan_ziele SET jahr=?, titel=?, beschreibung=?, kpi_name=?, zielwert=?, istwert=?,
         einheit=?, status=?, faellig_am=?, sort_order=? WHERE id=? AND dojo_id=?`,
      [parseInt(b.jahr, 10) || z.jahr, b.titel ?? z.titel,
       b.beschreibung !== undefined ? b.beschreibung : z.beschreibung,
       b.kpi_name !== undefined ? b.kpi_name : z.kpi_name,
       b.zielwert !== undefined ? (b.zielwert === '' ? null : Number(b.zielwert)) : z.zielwert,
       b.istwert !== undefined ? (b.istwert === '' ? 0 : Number(b.istwert)) : z.istwert,
       b.einheit !== undefined ? b.einheit : z.einheit,
       ['offen', 'laeuft', 'erreicht', 'verfehlt'].includes(b.status) ? b.status : z.status,
       b.faellig_am !== undefined ? (b.faellig_am || null) : z.faellig_am,
       b.sort_order !== undefined ? (parseInt(b.sort_order, 10) || 0) : z.sort_order,
       z.id, dojoId]);
    res.json({ success: true });
  } catch (err) {
    logger.error('[Businessplan] Ziel aktualisieren Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Ziels' });
  }
});

router.delete('/ziele/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const [r] = await pool.query('DELETE FROM businessplan_ziele WHERE id=? AND dojo_id=?', [req.params.id, dojoId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Ziel nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('[Businessplan] Ziel löschen Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Löschen des Ziels' });
  }
});

router.post('/ziele/:id/meilensteine', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const [rows] = await pool.query('SELECT id FROM businessplan_ziele WHERE id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    if (!rows.length) return res.status(404).json({ error: 'Ziel nicht gefunden' });
    const { titel, faellig_am, sort_order } = req.body;
    if (!titel) return res.status(400).json({ error: 'Titel fehlt' });
    const [r] = await pool.query(
      `INSERT INTO businessplan_meilensteine (dojo_id, ziel_id, titel, faellig_am, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [dojoId, req.params.id, titel, faellig_am || null, parseInt(sort_order, 10) || 0]);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    logger.error('[Businessplan] Meilenstein anlegen Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Anlegen des Meilensteins' });
  }
});

router.put('/meilensteine/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const { titel, faellig_am, erledigt, sort_order } = req.body;
    const istErledigt = erledigt === true || erledigt === 1;
    const [r] = await pool.query(
      `UPDATE businessplan_meilensteine
       SET titel = COALESCE(?, titel), faellig_am = ?, erledigt = ?,
           erledigt_am = ${istErledigt ? 'COALESCE(erledigt_am, NOW())' : 'NULL'}, sort_order = ?
       WHERE id = ? AND dojo_id = ?`,
      [titel ?? null, faellig_am || null, istErledigt ? 1 : 0, parseInt(sort_order, 10) || 0, req.params.id, dojoId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Meilenstein nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('[Businessplan] Meilenstein aktualisieren Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Meilensteins' });
  }
});

router.delete('/meilensteine/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const [r] = await pool.query('DELETE FROM businessplan_meilensteine WHERE id=? AND dojo_id=?', [req.params.id, dojoId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Meilenstein nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('[Businessplan] Meilenstein löschen Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Löschen des Meilensteins' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// DOKUMENTE + PDF
// ════════════════════════════════════════════════════════════════════════════════
router.get('/dokumente', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const where = dojoId ? 'WHERE dojo_id = ?' : '';
    const [rows] = await pool.query(
      `SELECT id, dojo_id, plan_id, titel, created_at FROM businessplan_dokumente ${where}
       ORDER BY created_at DESC LIMIT 100`, dojoId ? [dojoId] : []);
    res.json(rows);
  } catch (err) {
    logger.error('[Businessplan] Dokumente laden Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden der Dokumente' });
  }
});

router.get('/plaene/:id/pdf', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const plan = await loadPlan(req.params.id, dojoId);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });

    const [[dojoInfo]] = await pool.query(
      'SELECT id, dojoname, inhaber, strasse, plz, ort FROM dojo WHERE id = ?', [plan.dojo_id]);
    const positionen = await loadPositionen(plan.id);
    const [ziele] = await pool.query(
      'SELECT * FROM businessplan_ziele WHERE dojo_id = ? AND jahr = ? ORDER BY sort_order, id',
      [plan.dojo_id, plan.planungsjahr]);

    const texte = parseJson(plan.dokument_texte, {});
    const auswertung = computeAuswertung(plan, positionen);

    const generateBusinessplanPdfHTML = require('../utils/businessplanPdfTemplate');
    const puppeteer = require('puppeteer');
    const html = generateBusinessplanPdfHTML({ plan, dojoInfo, texte, positionen, ziele, auswertung });

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4', printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' }
    });
    await browser.close();

    await pool.query(
      `INSERT INTO businessplan_dokumente (dojo_id, plan_id, titel, snapshot, erstellt_von) VALUES (?, ?, ?, ?, ?)`,
      [plan.dojo_id, plan.id, plan.titel,
       JSON.stringify({ texte, positionen, ziele, auswertung }),
       req.user?.id || req.user?.user_id || null]);

    const filename = `Businessplan_${(dojoInfo?.dojoname || 'Dojo').replace(/[^a-zA-Z0-9]/g, '_')}_${plan.planungsjahr}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(Buffer.from(pdfBuffer));
  } catch (err) {
    logger.error('[Businessplan] PDF Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler bei der PDF-Generierung', details: err.message });
  }
});

module.exports = router;
