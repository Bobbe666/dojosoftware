/**
 * Automatische AG-Abrechnung (z. B. Karate AG an Schulen)
 * Variante A: Unterrichtstage = fester Wochentag minus Schulferien (Bayern) minus Feiertage
 * Variante B: Monatsend-Entwurf zur Bestätigung, bevor die Rechnung erzeugt wird
 */

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function deDate(ds) {
  const d = new Date(ds);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// Ostersonntag (Gauß) → für bewegliche Feiertage
function ostersonntag(jahr) {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

// Gesetzliche Feiertage in Bayern (für die meisten Schulen unterrichtsfrei)
function feiertageBayern(jahr) {
  const f = new Set();
  [[1, 1], [1, 6], [5, 1], [8, 15], [10, 3], [11, 1], [12, 25], [12, 26]]
    .forEach(([m, t]) => f.add(ymd(new Date(jahr, m - 1, t))));
  const o = ostersonntag(jahr);
  [-2, 1, 39, 50, 60].forEach(off => { const d = new Date(o); d.setDate(o.getDate() + off); f.add(ymd(d)); });
  return f; // Karfreitag, Ostermontag, Christi Himmelfahrt, Pfingstmontag, Fronleichnam
}

// Unterrichtstage eines Monats: konfigurierter Wochentag, ohne Ferien/Feiertage, innerhalb Gültigkeit
async function berechneUnterrichtstage(pool, config, jahr, monat) {
  const [ferien] = await pool.query('SELECT von, bis FROM schulferien WHERE bundesland = ?', [config.bundesland || 'BY']);
  const feiertage = feiertageBayern(jahr);
  const wt = parseInt(config.wochentag) || 2; // ISO: Mo=1 … So=7
  const letzter = new Date(jahr, monat, 0).getDate();
  const abStr = config.gueltig_ab ? ymd(new Date(config.gueltig_ab)) : null;
  const bisStr = config.gueltig_bis ? ymd(new Date(config.gueltig_bis)) : null;
  const ferienR = ferien.map(f => [ymd(new Date(f.von)), ymd(new Date(f.bis))]);
  const tage = [];
  for (let t = 1; t <= letzter; t++) {
    const d = new Date(jahr, monat - 1, t);
    const iso = d.getDay() === 0 ? 7 : d.getDay();
    if (iso !== wt) continue;
    const ds = ymd(d);
    if (abStr && ds < abStr) continue;
    if (bisStr && ds > bisStr) continue;
    if (feiertage.has(ds)) continue;
    if (ferienR.some(([v, b]) => ds >= v && ds <= b)) continue;
    tage.push(ds);
  }
  return tage;
}

// Entwurf (Variante B) anlegen/aktualisieren – ohne Rechnung
async function erstelleEntwurf(pool, config, jahr, monat) {
  const tage = await berechneUnterrichtstage(pool, config, jahr, monat);
  const [[ex]] = await pool.query(
    'SELECT id, status FROM ag_abrechnung_lauf WHERE config_id = ? AND jahr = ? AND monat = ?',
    [config.id, jahr, monat]);
  if (ex && ex.status !== 'entwurf') return { id: ex.id, config_id: config.id, jahr, monat, tage, anzahl_tage: tage.length, status: ex.status, skipped: true };
  if (ex) {
    await pool.query('UPDATE ag_abrechnung_lauf SET tage = ?, anzahl_tage = ? WHERE id = ?', [JSON.stringify(tage), tage.length, ex.id]);
    return { id: ex.id, config_id: config.id, jahr, monat, tage, anzahl_tage: tage.length, status: 'entwurf' };
  }
  const [r] = await pool.query(
    "INSERT INTO ag_abrechnung_lauf (config_id, jahr, monat, status, tage, anzahl_tage) VALUES (?, ?, ?, 'entwurf', ?, ?)",
    [config.id, jahr, monat, JSON.stringify(tage), tage.length]);
  return { id: r.insertId, config_id: config.id, jahr, monat, tage, anzahl_tage: tage.length, status: 'entwurf' };
}

// Rechnung aus einem (bestätigten) Lauf erzeugen – eine Position pro Unterrichtstag
async function erzeugeRechnung(pool, laufId) {
  const [[lauf]] = await pool.query('SELECT * FROM ag_abrechnung_lauf WHERE id = ?', [laufId]);
  if (!lauf) throw new Error('Lauf nicht gefunden');
  if (lauf.rechnung_id) return { rechnung_id: lauf.rechnung_id, schon: true };
  const [[config]] = await pool.query('SELECT * FROM ag_abrechnung_config WHERE id = ?', [lauf.config_id]);
  if (!config) throw new Error('Konfiguration nicht gefunden');
  const tage = Array.isArray(lauf.tage) ? lauf.tage : JSON.parse(lauf.tage || '[]');
  if (!tage.length) throw new Error('Keine Unterrichtstage im Lauf');

  const stunden = Number(config.stunden_pro_tag), preis = Number(config.preis_pro_stunde), satz = Number(config.mwst_satz);
  const positionen = tage.map((ds, i) => ({
    position_nr: i + 1,
    bezeichnung: config.bezeichnung,
    artikelnummer: config.artikelnummer || null,
    menge: stunden,
    einzelpreis: preis,
    gesamtpreis: +(stunden * preis).toFixed(2),
    mwst_satz: satz,
    beschreibung: `Leistungsdatum: ${deDate(ds)}`
  }));
  const netto = +positionen.reduce((s, p) => s + p.gesamtpreis, 0).toFixed(2);
  const mwst = +(netto * satz / 100).toFixed(2);
  const brutto = +(netto + mwst).toFixed(2);

  const heute = new Date();
  const datum = ymd(heute);
  const prefix = `${heute.getFullYear()}/${String(heute.getMonth() + 1).padStart(2, '0')}/${String(heute.getDate()).padStart(2, '0')}`;
  const [[cnt]] = await pool.query(
    `SELECT COUNT(*) AS c FROM rechnungen r LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
     WHERE YEAR(r.datum) = ? AND (m.dojo_id = ? OR (r.mitglied_id IS NULL AND r.dojo_id = ?))`,
    [heute.getFullYear(), config.dojo_id, config.dojo_id]);
  const rechnungsnummer = `${prefix}-${1000 + cnt.c}`;
  const monatsName = new Date(lauf.jahr, lauf.monat - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const faellig = ymd(new Date(Date.now() + 14 * 864e5));

  const [r] = await pool.query(
    `INSERT INTO rechnungen (rechnungsnummer, mitglied_id, dojo_id, datum, faelligkeitsdatum,
       betrag, netto_betrag, brutto_betrag, mwst_satz, mwst_betrag, art, beschreibung, notizen, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'kursgebuehr', ?, ?, 'offen')`,
    [rechnungsnummer, config.mitglied_id || null, config.dojo_id, datum, faellig,
     brutto, netto, brutto, satz, mwst, `${config.bezeichnung} – ${monatsName}`,
     `Automatische AG-Abrechnung (${monatsName}), ${tage.length} Unterrichtstage à ${stunden} Std.`]);
  const rid = r.insertId;
  for (const p of positionen) {
    await pool.query(
      `INSERT INTO rechnungspositionen (rechnung_id, position_nr, bezeichnung, artikelnummer, menge, einzelpreis, gesamtpreis, mwst_satz, beschreibung)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rid, p.position_nr, p.bezeichnung, p.artikelnummer, p.menge, p.einzelpreis, p.gesamtpreis, p.mwst_satz, p.beschreibung]);
  }
  await pool.query("UPDATE ag_abrechnung_lauf SET rechnung_id = ?, status = 'berechnet', bestaetigt_am = NOW() WHERE id = ?", [rid, laufId]);
  return { rechnung_id: rid, rechnungsnummer, netto, brutto, tage: tage.length };
}

// Monatsabschluss (Cron): für alle aktiven Konfigs Entwürfe anlegen; bei auto_versand direkt Rechnung
async function processMonatsabschluss(pool, opts = {}) {
  let { jahr, monat } = opts;
  if (!jahr || !monat) { // Standard: Vormonat
    const n = new Date(); n.setDate(1); n.setMonth(n.getMonth() - 1);
    jahr = n.getFullYear(); monat = n.getMonth() + 1;
  }
  const [configs] = await pool.query('SELECT * FROM ag_abrechnung_config WHERE aktiv = 1');
  const ergebnis = [];
  for (const c of configs) {
    try {
      const lauf = await erstelleEntwurf(pool, c, jahr, monat);
      let rechnung = null;
      if (c.auto_versand && lauf.status === 'entwurf' && lauf.anzahl_tage > 0) {
        rechnung = await erzeugeRechnung(pool, lauf.id);
      }
      ergebnis.push({ config_id: c.id, lauf_id: lauf.id, tage: lauf.anzahl_tage, rechnung });
    } catch (e) {
      ergebnis.push({ config_id: c.id, error: e.message });
    }
  }
  return { jahr, monat, configs: configs.length, entwuerfe: ergebnis.filter(e => !e.error).length, ergebnis };
}

module.exports = { feiertageBayern, berechneUnterrichtstage, erstelleEntwurf, erzeugeRechnung, processMonatsabschluss, ymd, deDate };
