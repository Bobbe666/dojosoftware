// =====================================================================================
// BUSINESSPLAN ROUTES — Finanz-/Liquiditätsplanung, Businessplan-PDF & Ziele-Board
// =====================================================================================
// Klassische Gründer-/Unternehmens-Finanzplanung (Investition, Rentabilität, Liquidität).
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
const { getSecureDojoId, isSuperAdmin } = require('../middleware/tenantSecurity');

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
  // Weitere Erträge/Aufwendungen + Liquiditäts-Parameter
  const sonstErtragMon    = num(a.sonstigeErtraegeMonat);   // sonstige betriebl. Erträge / Monat
  const zinsertraegeJahr  = num(a.zinsertraegeJahr);        // Zinserträge / Jahr
  const neutralErtragJahr = num(a.neutraleErtraegeJahr);    // sonstige neutrale Erträge / Jahr
  const neutralAufwJahr   = num(a.neutraleAufwendungenJahr);// sonstige neutrale Aufwendungen / Jahr
  const privateinlMon     = num(a.privateinlagenMonat);     // Privat-/Kapitaleinlagen / Monat
  const ustSatz           = (a.umsatzsteuerProzent != null ? num(a.umsatzsteuerProzent) : 19) / 100;
  const zahlungsziel      = Math.max(0, Math.min(6, num(a.zahlungszielMonate))); // Umsatz-Eingang nach n Monaten

  // Sozialkosten-Satz je Personalart (Aufschlag auf AN-Brutto)
  const sozialFor = (art) => {
    if (art === 'geringfuegig') return (a.sozialGeringfuegigProzent != null ? num(a.sozialGeringfuegigProzent) : 28);
    if (art === 'sv_befreit')   return (a.sozialBefreitProzent != null ? num(a.sozialBefreitProzent) : 0);
    return (a.sozialSvPflichtigProzent != null ? num(a.sozialSvPflichtigProzent) : sozialP);
  };
  // Monatswerte einer Position: JSON-Array[12] überschreibt den Konstantwert
  const monatsArr = (row, constField, arrField) => {
    const arr = Array.isArray(row[arrField]) ? row[arrField] : null;
    const out = [];
    for (let m = 0; m < 12; m++) out.push(arr && arr[m] != null && arr[m] !== '' ? num(arr[m]) : num(row[constField]));
    return out;
  };
  const leer12 = () => Array(12).fill(0);
  const sumArr = (arr) => arr.reduce((s, v) => s + v, 0);

  // --- Umsatz je Monat (Menge × Preis, Menge ggf. monatsgenau) ---
  // Zusätzlich Mitgliederentwicklung aus Positionen mit Einheit „Mitglied" (zentrale Planungsgröße).
  const umsatzArr = leer12();
  const mitgliederArr = leer12();
  pos.umsatz.forEach(u => {
    const mengen = monatsArr(u, 'menge_monatlich', 'mengen_monate');
    for (let m = 0; m < 12; m++) umsatzArr[m] += mengen[m] * num(u.preis_einheit);
    if (String(u.einheit || '').toLowerCase().startsWith('mitglied')) {
      for (let m = 0; m < 12; m++) mitgliederArr[m] += mengen[m];
    }
  });
  const umsatzJahrBasis = sumArr(umsatzArr);
  const hatMitglieder = mitgliederArr.some(v => v > 0);
  // Mitgliederentwicklung je Tarifgruppe (Positionen mit Einheit „Mitglied" und Monatswerten)
  const mitgliederGruppen = pos.umsatz
    .filter(u => String(u.einheit || '').toLowerCase().startsWith('mitglied') && Array.isArray(u.mengen_monate))
    .map(u => ({ bezeichnung: u.bezeichnung, verlauf: u.mengen_monate.map(v => Math.round(num(v))) }))
    .filter(g => g.verlauf.some(v => v > 0));

  // --- Kosten je Kategorie je Monat (Beträge ggf. monatsgenau, Personal mit Sozialaufschlag) ---
  const KOSTEN_KATS = ['material', 'fremdleistung', 'personal', 'raumkosten', 'versicherungen',
    'kfz', 'werbung', 'warenabgabe', 'reparatur', 'sonstige_steuern', 'sonstige'];
  const kostenArr = {}; KOSTEN_KATS.forEach(k => { kostenArr[k] = leer12(); });
  pos.kosten.forEach(k => {
    const kat = KOSTEN_KATS.includes(k.kategorie) ? k.kategorie : 'sonstige';
    const betr = monatsArr(k, 'betrag_monatlich', 'betraege_monate');
    const istBrutto = (k.ist_brutto_personal === 1 || k.ist_brutto_personal === true);
    const faktor = (kat === 'personal' && istBrutto) ? (1 + sozialFor(k.personalart) / 100) : 1;
    for (let m = 0; m < 12; m++) kostenArr[kat][m] += betr[m] * faktor;
  });
  const kostenJahr = {}; KOSTEN_KATS.forEach(k => { kostenJahr[k] = sumArr(kostenArr[k]); });

  // --- Privatentnahmen je Monat ---
  const privatArr = leer12();
  pos.privatentnahmen.forEach(p => {
    const betr = monatsArr(p, 'betrag_monatlich', 'betraege_monate');
    for (let m = 0; m < 12; m++) privatArr[m] += betr[m];
  });
  const privatJahr = sumArr(privatArr);

  // --- Abschreibungen (AfA, jährlich): AfA-Satz % bevorzugt, sonst Nutzungsdauer ---
  const afaJahr = pos.investitionen.reduce((s, i) => {
    const satz = num(i.afa_satz_prozent), nd = num(i.nutzungsdauer_jahre);
    if (satz > 0) return s + num(i.betrag) * satz / 100;
    return nd > 0 ? s + num(i.betrag) / nd : s;
  }, 0);
  const investitionGesamt = pos.investitionen.reduce((s, i) => s + num(i.betrag), 0);

  // --- Finanzierung & Kapitaldienst ---
  const finanzierungGesamt = pos.finanzierung.reduce((s, f) => s + num(f.betrag), 0);
  const istDarlehen = (f) => ['darlehen', 'betriebsmittelkredit', 'kontokorrent'].includes(f.art);
  const eigenkapital = pos.finanzierung
    .filter(f => ['eigenkapital', 'sacheinlage', 'beteiligung'].includes(f.art))
    .reduce((s, f) => s + num(f.betrag), 0);
  const darlehen = pos.finanzierung.filter(istDarlehen);
  const startFinanzierung = pos.finanzierung.filter(f => !istDarlehen(f)).reduce((s, f) => s + num(f.betrag), 0);
  const zinsenJahr = darlehen.reduce((s, f) => s + num(f.betrag) * num(f.zinssatz_prozent) / 100, 0);
  const tilgungJahr = darlehen.reduce((s, f) => {
    const tilgMonate = Math.max(1, num(f.laufzeit_monate) - num(f.tilgungsfrei_monate));
    return num(f.laufzeit_monate) > 0 ? s + num(f.betrag) / (tilgMonate / 12) : s;
  }, 0);

  // --- Rentabilitätsrechnung für ein Jahr (mit Wachstumsfaktoren) ---
  function rentabilitaet(jahrIdx) {
    // Kumulierte Wachstumsfaktoren bis zum jeweiligen Planjahr
    let umsatzFaktor = 1, kostenFaktor = 1;
    for (let j = 1; j <= jahrIdx; j++) { umsatzFaktor *= (1 + wachsUmsatz[j] / 100); kostenFaktor *= (1 + wachsKosten[j] / 100); }

    const umsatzJahr   = umsatzJahrBasis * umsatzFaktor;
    const erloesSchm   = umsatzJahr * erlSchmP / 100;
    const gesamtleistung = umsatzJahr - erloesSchm;
    const material     = kostenJahr.material * kostenFaktor;
    const fremdl       = kostenJahr.fremdleistung * kostenFaktor;
    const rohertrag    = gesamtleistung - material - fremdl;
    const sonstErtraege = sonstErtragMon * 12 * umsatzFaktor;        // sonstige betriebl. Erträge
    const betrieblicherRohertrag = rohertrag + sonstErtraege;

    const personal     = kostenJahr.personal * kostenFaktor;
    const raumkosten   = kostenJahr.raumkosten * kostenFaktor;
    const versicherungen = kostenJahr.versicherungen * kostenFaktor;
    const kfz          = kostenJahr.kfz * kostenFaktor;
    const werbung      = kostenJahr.werbung * kostenFaktor;
    const warenabgabe  = kostenJahr.warenabgabe * kostenFaktor;
    const reparatur    = kostenJahr.reparatur * kostenFaktor;
    const sonstSteuern = kostenJahr.sonstige_steuern * kostenFaktor;
    const sonstige     = kostenJahr.sonstige * kostenFaktor;
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
  // Modelliert inkl. Umsatzsteuer-Zahllast (Folgemonat) und
  // Zahlungsziel (Umsatz-Eingang verzögert). Beträge brutto, Vorsteuer separat.
  const monateLiq = [];
  const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  // Vorsteuer-fähige (USt-belastete) Kostenarten
  const VATABLE = ['material', 'fremdleistung', 'warenabgabe', 'kfz', 'werbung', 'reparatur', 'sonstige'];
  const monSteuern = j1.steuern / 12;   // ergebnisabh. Steuern gleichmäßig verteilt

  // Investitionen je Anschaffungsmonat
  const investNachMonat = leer12();
  pos.investitionen.forEach(i => {
    const m = Math.min(12, Math.max(1, num(i.anschaffung_monat) || 1));
    investNachMonat[m - 1] += num(i.betrag);
  });
  // Darlehensauszahlung, Zins & Tilgung je Monat (mit Auszahlmonat + tilgungsfreier Zeit)
  const darlehenEinzahlung = leer12(), zinsArr = leer12(), tilgArr = leer12();
  darlehen.forEach(f => {
    const betrag = num(f.betrag), zMon = num(f.zinssatz_prozent) / 100 / 12;
    const ausz = Math.min(12, Math.max(1, num(f.auszahlung_monat) || 1));
    const lf = num(f.laufzeit_monate), tf = num(f.tilgungsfrei_monate);
    const tilgMonate = Math.max(1, lf - tf);
    const tilgRate = lf > 0 ? betrag / tilgMonate : 0;
    darlehenEinzahlung[ausz - 1] += betrag;
    for (let m = 0; m < 12; m++) {
      const monNr = m + 1;
      if (monNr >= ausz) zinsArr[m] += betrag * zMon;                 // Zinsen ab Auszahlung
      if (lf > 0 && monNr >= ausz + tf && monNr < ausz + tf + tilgMonate) tilgArr[m] += tilgRate;
    }
  });

  // Startsaldo: vorhandene Liquidität + Eigenmittel/Förderung (Darlehen fließen im Auszahlmonat zu)
  let saldo = startLiq + startFinanzierung;
  let ustZahllastVormonat = 0;  // USt-Zahllast wird im Folgemonat ans Finanzamt abgeführt
  for (let m = 0; m < 12; m++) {
    const investMonat  = investNachMonat[m];
    const betriebskostenMonat = KOSTEN_KATS.reduce((s, k) => s + kostenArr[k][m], 0);
    const vatableMonat = VATABLE.reduce((s, k) => s + kostenArr[k][m], 0);
    // Umsatz-Eingang nach Zahlungsziel verzögert
    const umsatzEingang = (m - zahlungsziel >= 0) ? umsatzArr[m - zahlungsziel] : 0;
    const ustEingang    = umsatzEingang * ustSatz;
    const vorsteuer     = (vatableMonat + investMonat) * ustSatz;
    const ustZahllast   = ustEingang - vorsteuer;

    const einzahlungen = umsatzEingang + ustEingang + sonstErtragMon + privateinlMon + darlehenEinzahlung[m];
    const auszahlungen = betriebskostenMonat + vorsteuer + zinsArr[m] + tilgArr[m] + privatArr[m] +
      monSteuern + investMonat + Math.max(0, ustZahllastVormonat);
    const ueberschuss = einzahlungen - auszahlungen;
    saldo += ueberschuss;
    ustZahllastVormonat = ustZahllast;
    monateLiq.push({
      monat: m + 1, label: MONATE_KURZ[m],
      einzahlungen: round2(einzahlungen),
      auszahlungen: round2(auszahlungen),
      umsatzsteuer: round2(Math.max(0, ustZahllast)),
      ueberschuss: round2(ueberschuss),
      saldo: round2(saldo),
    });
  }

  // --- Mittelverwendung / Mittelherkunft (Bilanzcheck) ---
  // Mittelverwendung = Investitionen + Betriebsmittelbedarf (Working Capital bis Break-Even).
  // Empfehlung für den Betriebsmittelbedarf = tiefster Liquiditätsengpass im Jahr.
  const betriebsmittel = num(a.betriebsmittelbedarf);
  const tiefsterSaldoLiq = monateLiq.length ? Math.min(...monateLiq.map(m => m.saldo)) : 0;
  const mittelverwendung = investitionGesamt + betriebsmittel;
  const mittelbilanz = {
    investitionen: round2(investitionGesamt),
    betriebsmittel: round2(betriebsmittel),
    mittelverwendung: round2(mittelverwendung),
    mittelherkunft: round2(finanzierungGesamt),
    differenz: round2(finanzierungGesamt - mittelverwendung),
    eigenkapital: round2(eigenkapital),
    eigenkapitalquote: finanzierungGesamt > 0 ? round2(eigenkapital / finanzierungGesamt * 100) : 0,
    betriebsmittelEmpfehlung: round2(Math.max(0, -tiefsterSaldoLiq)),
  };

  return {
    kennzahlen: {
      umsatzMonat: round2(umsatzJahrBasis / 12),
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
      mitgliederStart: hatMitglieder ? Math.round(mitgliederArr[0]) : null,
      mitgliederEnde: hatMitglieder ? Math.round(mitgliederArr[11]) : null,
      mitgliederMax: hatMitglieder ? Math.round(Math.max(...mitgliederArr)) : null,
    },
    rentabilitaet: j1,
    dreiJahresPlan: dreiJahre,
    liquiditaet: monateLiq,
    mitgliederVerlauf: hatMitglieder ? mitgliederArr.map(v => Math.round(v)) : null,
    mitgliederGruppen: mitgliederGruppen.length ? mitgliederGruppen : null,
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
// BUCHHALTUNGS-IMPORT (EÜR/BWA) — Vorbefüllung & Aktualisieren
// ════════════════════════════════════════════════════════════════════════════════
const EINNAHME_LABEL = {
  Beitrag: 'Mitgliedsbeiträge', Rechnung: 'Rechnungen', Verkauf: 'Verkäufe',
  Beleg: 'sonstige Einnahmen', Bank: 'Bank-Einnahmen', Kasse: 'Kasseneinnahmen',
};
const KOSTEN_LABEL = {
  material: 'Material/Wareneinsatz', fremdleistung: 'Fremdleistungen', personal: 'Personal',
  raumkosten: 'Raumkosten', versicherungen: 'Versicherungen/Beiträge', kfz: 'Kfz-Kosten',
  werbung: 'Werbe-/Reisekosten', warenabgabe: 'Kosten der Warenabgabe', reparatur: 'Reparatur/Instandhaltung',
  sonstige_steuern: 'sonstige Steuern', sonstige: 'sonstige Aufwendungen',
};
// EÜR/BWA-Ausgabenkategorie → Businessplan-Kostenart
function mapAusgabeKat(k) {
  const s = String(k || '').toLowerCase();
  if (/waren|material|rhb/.test(s)) return 'material';
  if (/fremdleist/.test(s)) return 'fremdleistung';
  if (/personal|lohn|gehalt|sozial/.test(s)) return 'personal';
  if (/raum|miete|pacht|nebenkost/.test(s)) return 'raumkosten';
  if (/versicher|beitrag|beitr/.test(s)) return 'versicherungen';
  if (/kfz|fahrzeug|auto/.test(s)) return 'kfz';
  if (/werb|marketing|reise/.test(s)) return 'werbung';
  if (/reparatur|instandhalt|wartung/.test(s)) return 'reparatur';
  if (/steuer/.test(s)) return 'sonstige_steuern';
  return 'sonstige';
}

// Kalendermonats-Indizes (0–11) für jeden Monat im Zeitraum [von, bis].
function monateImZeitraum(von, bis) {
  const out = [];
  let y = von.getFullYear(), m = von.getMonth();
  const ey = bis.getFullYear(), em = bis.getMonth();
  while ((y < ey) || (y === ey && m <= em)) {
    out.push(m); m++; if (m > 11) { m = 0; y++; }
    if (out.length > 120) break;
  }
  return out;
}

// BWA-Kosten je Kategorie als 12-Monats-Profil, periodengerecht abgegrenzt:
// Belege mit Leistungszeitraum werden pro rata über die Monate verteilt (sonst Belegdatum);
// Bank-/Kassen-Ausgaben (ohne Zeitraum) nach Buchungsmonat. Spiegelt die EÜR-Ausgabenzweige.
async function pullBwaKostenByKat(dojoId) {
  const kostenByKat = {};
  const add = (rawKat, monatIdx, betrag) => {
    const kat = mapAusgabeKat(rawKat);
    const arr = kostenByKat[kat] || (kostenByKat[kat] = Array(12).fill(0));
    arr[monatIdx] += betrag;
  };
  const [belege] = await pool.query(
    `SELECT kategorie, ROUND(betrag_brutto * (1 - COALESCE(privatanteil_prozent,0)/100), 2) AS betrag,
            beleg_datum, leistung_von, leistung_bis
     FROM buchhaltung_belege
     WHERE dojo_id = ? AND buchungsart = 'ausgabe' AND COALESCE(storniert,0) = 0 AND COALESCE(privat,0) = 0
       AND kategorie NOT IN ('privateinlage','privatentnahme','anlagevermögen')
       AND COALESCE(leistung_bis, beleg_datum) >= DATE_SUB(NOW(), INTERVAL 12 MONTH)`, [dojoId]);
  belege.forEach(b => {
    const betrag = Number(b.betrag) || 0; if (!betrag) return;
    const von = b.leistung_von ? new Date(b.leistung_von) : null;
    const bis = b.leistung_bis ? new Date(b.leistung_bis) : null;
    if (von && bis && bis >= von) {
      const monate = monateImZeitraum(von, bis);
      const per = betrag / monate.length;
      monate.forEach(mi => add(b.kategorie, mi, per));
    } else {
      add(b.kategorie, new Date(b.beleg_datum).getMonth(), betrag);
    }
  });
  const [bank] = await pool.query(
    `SELECT COALESCE(kategorie,'sonstige_kosten') AS kategorie, ABS(betrag) AS betrag, buchungsdatum
     FROM bank_transaktionen
     WHERE dojo_id = ? AND betrag < 0 AND status = 'zugeordnet' AND beleg_id IS NULL
       AND (match_typ IS NULL OR match_typ NOT IN ('rechnung','beitrag','verkauf'))
       AND kategorie NOT IN ('privateinlage','privatentnahme','betriebseinnahmen')
       AND buchungsdatum >= DATE_SUB(NOW(), INTERVAL 12 MONTH)`, [dojoId]);
  bank.forEach(b => add(b.kategorie, new Date(b.buchungsdatum).getMonth(), Number(b.betrag) || 0));
  const [kasse] = await pool.query(
    `SELECT betrag_cent/100 AS betrag, geschaeft_datum
     FROM kassenbuch WHERE COALESCE(dojo_id,1) = ? AND bewegungsart = 'ausgabe'
       AND geschaeft_datum >= DATE_SUB(NOW(), INTERVAL 12 MONTH)`, [dojoId]);
  kasse.forEach(k => add('sonstige_kosten', new Date(k.geschaeft_datum).getMonth(), Number(k.betrag) || 0));
  return kostenByKat;
}

// Holt Einnahmen/Ausgaben der letzten 12 Monate und baut monatsgenaue Positionen
// (Profil nach Kalendermonat Jan–Dez). EÜR = Zufluss/Zahlung; BWA = periodengerechte Abgrenzung.
async function pullBuchhaltung(quelleDojoId, quelle = 'euer') {
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const [einn] = await pool.query(
    `SELECT quelle, monat, COUNT(*) AS anzahl, SUM(betrag_brutto) AS summe FROM v_euer_einnahmen
     WHERE dojo_id = ? AND datum >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY quelle, monat`, [quelleDojoId]);
  const [ausg] = await pool.query(
    `SELECT kategorie, monat, SUM(betrag_brutto) AS summe FROM v_euer_ausgaben
     WHERE dojo_id = ? AND datum >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       AND kategorie NOT IN ('privateinlage','privatentnahme','anlagevermögen','abschreibungen')
     GROUP BY kategorie, monat`, [quelleDojoId]);
  const umsatzLines = [];

  // Referenz-Monatsenden der letzten 12 Monate (für Bestandsentwicklung); Array-Index = Kalendermonat
  const heute = new Date();
  const refDates = [], refIdx = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(heute.getFullYear(), heute.getMonth() - i + 1, 0);
    refDates.push(d); refIdx.push(d.getMonth());
  }

  if (quelle === 'bwa') {
    // ── BWA (periodengerecht / Abgrenzung): Mitgliedsbeiträge je Tarifgruppe × Laufzeit.
    //    Monatlicher Mitgliederbestand aus Vertragslaufzeiten (Soll, unabhängig vom Zahlungseingang).
    const [contracts] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(t.altersgruppe), ''), 'Mitglieder') AS gruppe,
              COALESCE(t.duration_months, 0) AS laufzeit, v.vertragsbeginn AS beginn,
              COALESCE(v.vertragsende, v.kuendigungsdatum) AS ende,
              COALESCE(NULLIF(v.monatsbeitrag,0), NULLIF(v.monatlicher_beitrag,0), t.price_cents/100) AS beitrag
       FROM vertraege v JOIN tarife t ON t.id = v.tarif_id
       WHERE v.dojo_id = ? AND v.vertragsbeginn IS NOT NULL`, [quelleDojoId]);
    const groups = {};
    contracts.forEach(c => {
      const lf = Number(c.laufzeit) > 0 ? ` ${c.laufzeit}M` : '';
      const name = `Beitrag ${c.gruppe}${lf}`;
      const g = groups[name] || (groups[name] = { mengen: Array(12).fill(0), bSum: 0, bCnt: 0 });
      const beginn = c.beginn ? new Date(c.beginn) : null;
      const ende = c.ende ? new Date(c.ende) : null;
      refDates.forEach((rd, i) => {
        if (beginn && beginn <= rd && (!ende || ende >= rd)) g.mengen[refIdx[i]] += 1;
      });
      const b = Number(c.beitrag) || 0;
      if (b > 0) { g.bSum += b; g.bCnt += 1; }
    });
    Object.entries(groups)
      .sort((a, b) => Math.max(...b[1].mengen) - Math.max(...a[1].mengen))
      .forEach(([name, g]) => {
        if (g.mengen.some(v => v > 0)) {
          umsatzLines.push({
            bezeichnung: name, einheit: 'Mitglied',
            preis_einheit: g.bCnt > 0 ? round2(g.bSum / g.bCnt) : 0,
            menge_monatlich: Math.round(g.mengen.reduce((s, v) => s + v, 0) / 12),
            mengen_monate: g.mengen.map(v => Math.round(v)),
          });
        }
      });
  } else {
    // ── EÜR (Zufluss / Ist): tatsächlich gezahlte Mitgliedsbeiträge je Zahlungsmonat (Kasse).
    const [beit] = await pool.query(
      `SELECT MONTH(zahlungsdatum) AS monat, COUNT(DISTINCT mitglied_id) AS mitglieder, SUM(betrag) AS summe
       FROM beitraege WHERE dojo_id = ? AND bezahlt = 1 AND art = 'mitgliedsbeitrag'
         AND zahlungsdatum >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY MONTH(zahlungsdatum)`, [quelleDojoId]);
    if (beit.length) {
      const mengen = Array(12).fill(0); let sum = 0, mm = 0;
      beit.forEach(r => { mengen[(r.monat || 1) - 1] = Number(r.mitglieder) || 0; sum += Number(r.summe) || 0; mm += Number(r.mitglieder) || 0; });
      umsatzLines.push({
        bezeichnung: 'Mitgliedsbeiträge (Zufluss)', einheit: 'Mitglied',
        preis_einheit: mm > 0 ? round2(sum / mm) : 0,
        menge_monatlich: Math.round(mm / (beit.length || 1)), mengen_monate: mengen,
      });
    }
  }

  // Aufnahmegebühr aus Verträgen der letzten 12 Monate (monatsgenau, Menge = neue Verträge)
  const [aufn] = await pool.query(
    `SELECT MONTH(vertragsbeginn) AS monat, COUNT(*) AS anzahl, SUM(aufnahmegebuehr_cents)/100 AS summe
     FROM vertraege WHERE dojo_id = ? AND aufnahmegebuehr_cents > 0
       AND vertragsbeginn >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY MONTH(vertragsbeginn)`, [quelleDojoId]);
  if (aufn.length) {
    const cnt = Array(12).fill(0); let sum = 0, total = 0;
    aufn.forEach(r => { cnt[(r.monat || 1) - 1] = Number(r.anzahl) || 0; sum += Number(r.summe) || 0; total += Number(r.anzahl) || 0; });
    umsatzLines.push({
      bezeichnung: 'Aufnahmegebühr', einheit: 'Aufnahme',
      preis_einheit: total > 0 ? round2(sum / total) : 0, menge_monatlich: Math.round(total / 12), mengen_monate: cnt,
    });
  }

  // 2) Übrige Einnahmequellen als Anzahl/Monat × Ø-Wert (statt Pauschalpreis 1)
  const EINHEIT = { Rechnung: 'Rechnung', Verkauf: 'Verkauf', Beleg: 'Beleg', Bank: 'Buchung', Kasse: 'Buchung' };
  const byQ = {};
  einn.forEach(r => {
    if (r.quelle === 'Beitrag') return;
    const o = byQ[r.quelle] || (byQ[r.quelle] = { count: Array(12).fill(0), sum: 0, total: 0 });
    o.count[(r.monat || 1) - 1] += Number(r.anzahl) || 0;
    o.sum += Number(r.summe) || 0;
    o.total += Number(r.anzahl) || 0;
  });
  Object.entries(byQ).forEach(([q, o]) => {
    umsatzLines.push({
      bezeichnung: EINNAHME_LABEL[q] || q,
      einheit: EINHEIT[q] || 'Stück',
      preis_einheit: o.total > 0 ? round2(o.sum / o.total) : 0,   // Ø-Wert je Buchung
      menge_monatlich: Math.round(o.total / 12),
      mengen_monate: o.count.map(v => Math.round(v)),
    });
  });

  // Kostenquelle je Modus:
  //  EÜR = Ausgaben wie bezahlt (Zahlungsmonat, aus EÜR-Views).
  //  BWA = periodengerecht abgegrenzt (Belege pro rata über Leistungszeitraum, beleg-genau).
  let kostenByKat;
  if (quelle === 'bwa') {
    kostenByKat = await pullBwaKostenByKat(quelleDojoId);
  } else {
    kostenByKat = {};
    ausg.forEach(r => {
      const kat = mapAusgabeKat(r.kategorie);
      const arr = kostenByKat[kat] || (kostenByKat[kat] = Array(12).fill(0));
      arr[(r.monat || 1) - 1] += Number(r.summe) || 0;
    });
  }
  const kostenLines = Object.entries(kostenByKat).map(([kat, arr]) => ({
    kategorie: kat, bezeichnung: KOSTEN_LABEL[kat] || 'aus Buchhaltung',
    betrag_monatlich: round2(arr.reduce((s, v) => s + v, 0) / 12),
    betraege_monate: arr.map(round2),
  }));

  return { umsatzLines, kostenLines };
}

// Ersetzt die importierten (aus_buchhaltung=1) Positionen eines Plans frisch aus der Buchhaltung.
async function importBuchhaltung(planDojoId, planId, quelleDojoId, quelle = 'euer') {
  const { umsatzLines, kostenLines } = await pullBuchhaltung(quelleDojoId, quelle);
  await pool.query('DELETE FROM businessplan_umsatz WHERE plan_id = ? AND aus_buchhaltung = 1', [planId]);
  await pool.query('DELETE FROM businessplan_kosten WHERE plan_id = ? AND aus_buchhaltung = 1', [planId]);
  for (const u of umsatzLines) {
    await pool.query(
      `INSERT INTO businessplan_umsatz (dojo_id, plan_id, bezeichnung, einheit, menge_monatlich, preis_einheit, mengen_monate, aus_buchhaltung)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [planDojoId, planId, u.bezeichnung, u.einheit, u.menge_monatlich, u.preis_einheit,
       Array.isArray(u.mengen_monate) ? JSON.stringify(u.mengen_monate) : null]);
  }
  for (const k of kostenLines) {
    await pool.query(
      `INSERT INTO businessplan_kosten (dojo_id, plan_id, kategorie, bezeichnung, betrag_monatlich, betraege_monate, aus_buchhaltung)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [planDojoId, planId, k.kategorie, k.bezeichnung, k.betrag_monatlich,
       Array.isArray(k.betraege_monate) ? JSON.stringify(k.betraege_monate) : null]);
  }
  return { umsatz: umsatzLines.length, kosten: kostenLines.length };
}

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
    const { titel, firmenname, rechtsform, planungsjahr, annahmen, dokument_texte, status, quelle, quelleDojoId } = req.body;
    const jahr = parseInt(planungsjahr, 10) || new Date().getFullYear();

    // Datenquelle: 'euer' | 'bwa' = aus Buchhaltung vorbefüllen, sonst leerer Plan.
    // Quell-Dojo: Super-Admin darf eine andere Organisation wählen, sonst eigenes Dojo.
    const ausBuchhaltung = (quelle === 'euer' || quelle === 'bwa');
    const srcDojo = (isSuperAdmin(req) && quelleDojoId) ? parseInt(quelleDojoId, 10) : dojoId;

    let initialAnnahmen = annahmen || null;
    if (ausBuchhaltung) {
      initialAnnahmen = {
        sozialSvPflichtigProzent: 24, sozialGeringfuegigProzent: 28, sozialBefreitProzent: 0,
        steuersatzProzent: 30, erloesschmaelerungProzent: 0, umsatzsteuerProzent: 19, startLiquiditaet: 0,
        umsatzWachstumJ2: 5, umsatzWachstumJ3: 5, kostenWachstumJ2: 3, kostenWachstumJ3: 3,
        ...(annahmen || {}),
        datenquelle: { typ: quelle, dojoId: srcDojo },   // für späteres „Aktualisieren"
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

    let importiert = null;
    if (ausBuchhaltung) {
      try { importiert = await importBuchhaltung(dojoId, planId, srcDojo, quelle); }
      catch (e) { logger.error('[Businessplan] Buchhaltungs-Import Fehler:', { error: e }); }
      // Startpaket ist nicht als Buchung erfasst → leere manuelle Zeile zum Ausfüllen
      // (aus_buchhaltung=0 → bleibt beim „Aktualisieren" erhalten)
      try {
        await pool.query(
          `INSERT INTO businessplan_umsatz (dojo_id, plan_id, bezeichnung, einheit, menge_monatlich, preis_einheit, sort_order, aus_buchhaltung)
           VALUES (?, ?, 'Startpaket', 'Paket', 0, 0, 99, 0)`, [dojoId, planId]);
      } catch (e) { /* optional */ }
    }

    res.status(201).json({ id: planId, importiert });
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
// Aktualisiert die aus der Buchhaltung importierten Positionen (Daten nachholen).
router.post('/plaene/:id/sync', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Bitte ein Dojo auswählen (dojo_id fehlt)' });
    const plan = await loadPlan(req.params.id, dojoId);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });
    const ann = parseJson(plan.annahmen, {});
    const q = ann.datenquelle;
    if (!q || !q.dojoId) return res.status(400).json({ error: 'Für diesen Plan ist keine Buchhaltungs-Quelle hinterlegt.' });
    const importiert = await importBuchhaltung(plan.dojo_id, plan.id, q.dojoId, q.typ || 'euer');
    res.json({ success: true, ...importiert });
  } catch (err) {
    logger.error('[Businessplan] Sync Fehler:', { error: err });
    res.status(500).json({ error: 'Fehler beim Aktualisieren aus der Buchhaltung' });
  }
});

const RESOURCES = {
  investitionen: {
    table: 'businessplan_investitionen',
    fields: ['kategorie', 'bezeichnung', 'betrag', 'nutzungsdauer_jahre', 'afa_satz_prozent', 'restbuchwert', 'anschaffung_monat', 'sort_order'],
    nums: ['betrag', 'nutzungsdauer_jahre', 'afa_satz_prozent', 'restbuchwert', 'anschaffung_monat', 'sort_order'],
  },
  finanzierung: {
    table: 'businessplan_finanzierung',
    fields: ['art', 'bezeichnung', 'betrag', 'zinssatz_prozent', 'laufzeit_monate', 'tilgungsfrei_monate', 'auszahlung_monat', 'sort_order'],
    nums: ['betrag', 'zinssatz_prozent', 'laufzeit_monate', 'tilgungsfrei_monate', 'auszahlung_monat', 'sort_order'],
  },
  umsatz: {
    table: 'businessplan_umsatz',
    fields: ['bezeichnung', 'einheit', 'menge_monatlich', 'preis_einheit', 'mengen_monate', 'sort_order'],
    nums: ['menge_monatlich', 'preis_einheit', 'sort_order'],
    jsons: ['mengen_monate'],
  },
  kosten: {
    table: 'businessplan_kosten',
    fields: ['kategorie', 'bezeichnung', 'betrag_monatlich', 'betraege_monate', 'ist_brutto_personal', 'personalart', 'funktion', 'sort_order'],
    nums: ['betrag_monatlich', 'sort_order'],
    bools: ['ist_brutto_personal'],
    jsons: ['betraege_monate'],
  },
  privatentnahmen: {
    table: 'businessplan_privatentnahmen',
    fields: ['kategorie', 'bezeichnung', 'betrag_monatlich', 'betraege_monate', 'sort_order'],
    nums: ['betrag_monatlich', 'sort_order'],
    jsons: ['betraege_monate'],
  },
};

function coerce(cfg, body) {
  const out = {};
  for (const f of cfg.fields) {
    let v = body[f];
    if (cfg.nums && cfg.nums.includes(f)) v = (v === '' || v == null) ? 0 : Number(v) || 0;
    else if (cfg.bools && cfg.bools.includes(f)) v = (v === true || v === 1 || v === '1') ? 1 : 0;
    else if (cfg.jsons && cfg.jsons.includes(f)) v = (v == null) ? null : JSON.stringify(v);
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
