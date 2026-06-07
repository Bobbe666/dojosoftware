// ============================================================================
// KALENDER-AGGREGATION — plattformübergreifende Termine
// Quelle für: PlattformZentrale-Kalender (/api/plattform-zentrale/kalender),
//             ICS-Feed und das tägliche Briefing (briefingService.js)
// Extrahiert aus routes/plattform-zentrale.js (GET /kalender)
// ============================================================================
const axios = require('axios');
const db = require('../db');
const pool = db.promise();

const EVENTS_BASE = 'http://localhost:5002/api';
const HOF_BASE    = 'http://localhost:5003/api';

// Lokales Datum als YYYY-MM-DD (kein UTC-Shift)
const toLocalDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Liefert { events: [...], meta: {...} } — Turniere, Events, HoF,
// Prüfungstermine und gebuchte Demo-Termine im Zeitraum [von, bis]
async function collectKalenderEintraege(von, bis) {
  const sources = await Promise.allSettled([
    // 1. Events-Plattform: Turniere
    axios.get(`${EVENTS_BASE}/turniere/public`, { timeout: 6000 }),
    // 2. Events-Plattform: Events
    axios.get(`${EVENTS_BASE}/events/public`, { timeout: 6000 }),
    // 3. HOF: Veranstaltungen
    axios.get(`${HOF_BASE}/veranstaltungen`, { timeout: 6000 }),
    // 4. Dojo: Prüfungstermine (geplante Termine mit Titel)
    pool.query(`
      SELECT MIN(p.pruefung_id) as id, CONCAT('Gürtelprüfung - ', d.dojoname) as titel,
             p.pruefungsdatum as datum, MIN(p.pruefungszeit) as pruefungszeit,
             COALESCE(NULLIF(p.pruefungsort,'Nicht festgelegt'), d.dojoname, 'Dojo') as ort,
             'geplant' as status, p.dojo_id, d.dojoname as dojo_name, COUNT(*) as teilnehmer
      FROM pruefungen p
      LEFT JOIN dojo d ON d.id = p.dojo_id
      WHERE p.pruefungsdatum BETWEEN ? AND ?
        AND p.status IN ('geplant','durchgefuehrt','bestanden','nicht_bestanden') AND d.dojoname != 'demo'
      GROUP BY p.pruefungsdatum, p.dojo_id
      ORDER BY p.pruefungsdatum
    `, [von, bis]),
    // 5. Demo-Termine (gebuchte Slots)
    pool.query(`
      SELECT s.id, s.slot_start, s.slot_end, s.duration_minutes,
             b.vorname, b.nachname, b.vereinsname, b.email
      FROM demo_termine_slots s
      LEFT JOIN demo_buchungen b ON b.slot_id = s.id AND b.status != 'abgesagt'
      WHERE s.slot_start BETWEEN ? AND ?
        AND s.is_booked = 1
      ORDER BY s.slot_start
    `, [von, bis])
  ]);

  const all = [];

  // Turniere
  if (sources[0].status === 'fulfilled') {
    const data = sources[0].value.data;
    const list = data.data || data.turniere || (Array.isArray(data) ? data : []);
    list.forEach(t => {
      all.push({
        id: `turnier-${t.turnier_id || t.id}`,
        typ: 'turnier', platform: 'events',
        titel: t.name || t.titel,
        datum: t.datum || t.start_datum,
        datum_bis: t.end_datum,
        ort: t.ort, status: t.status,
        farbe: '#818cf8',
        url: `https://events.tda-intl.org`,
        raw_id: t.turnier_id || t.id
      });
    });
  }

  // Events
  if (sources[1].status === 'fulfilled') {
    const data = sources[1].value.data;
    const list = data.data || data.events || (Array.isArray(data) ? data : []);
    list.forEach(e => {
      all.push({
        id: `event-${e.event_id || e.id}`,
        typ: 'event', platform: 'events',
        titel: e.name || e.titel,
        datum: e.datum,
        datum_bis: e.end_datum,
        ort: e.ort, status: e.status,
        typ_label: e.typ,
        farbe: '#38bdf8',
        url: `https://events.tda-intl.org`,
        raw_id: e.event_id || e.id
      });
    });
  }

  // HOF
  if (sources[2].status === 'fulfilled') {
    const list = sources[2].value.data || [];
    (Array.isArray(list) ? list : []).forEach(v => {
      if (v.datum) {
        all.push({
          id: `hof-${v.id}`,
          typ: 'hof', platform: 'hof',
          titel: v.titel,
          datum: v.datum,
          datum_bis: null,
          ort: v.veranstaltungsort,
          farbe: '#fbbf24',
          url: `https://hof.tda-intl.org`,
          raw_id: v.id
        });
      }
    });
  }

  // Prüfungstermine
  if (sources[3].status === 'fulfilled') {
    const rows = sources[3].value[0] || [];
    rows.forEach(p => {
      const d = p.datum instanceof Date ? toLocalDate(p.datum) : p.datum;
      all.push({
        id: `pruefungstermin-${p.id}`,
        typ: 'pruefung', platform: 'pruefung',
        titel: p.titel || `Prüfung – ${p.dojo_name || 'Dojo'}`,
        datum: d,
        ort: p.ort,
        status: p.status,
        dojo_name: p.dojo_name,
        farbe: '#4ade80',
        url: '/dashboard/stile/pruefungen'
      });
    });
  }

  // Demo-Buchungen
  if (sources[4].status === 'fulfilled') {
    const rows = sources[4].value[0] || [];
    rows.forEach(d => {
      const start = d.slot_start instanceof Date ? d.slot_start : new Date(d.slot_start);
      const datum = toLocalDate(start);
      const uhrzeit = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const name = (d.vorname && d.nachname) ? `${d.vorname} ${d.nachname}` : 'Interessent';
      const verein = d.vereinsname ? ` – ${d.vereinsname}` : '';
      all.push({
        id: `demo-${d.id}`,
        typ: 'demo', platform: 'demo',
        titel: `Demo: ${name}${verein}`,
        datum,
        uhrzeit,
        ort: null,
        farbe: '#f472b6',
        url: null,
        raw_id: d.id
      });
    });
  }

  // Externe Quellen liefern ALLE Einträge — auf den Zeitraum filtern
  const inRange = all.filter(e => {
    const d = e.datum instanceof Date ? toLocalDate(e.datum) : String(e.datum || '').slice(0, 10);
    return d >= von && d <= bis;
  });

  inRange.sort((a, b) => new Date(a.datum) - new Date(b.datum));

  const meta = {
    turniere: inRange.filter(e => e.typ === 'turnier').length,
    events: inRange.filter(e => e.typ === 'event').length,
    hof: inRange.filter(e => e.typ === 'hof').length,
    pruefungen: inRange.filter(e => e.typ === 'pruefung').length,
    demo: inRange.filter(e => e.typ === 'demo').length,
    gesamt: inRange.length,
    quellen: {
      events_turniere: sources[0].status,
      events_events: sources[1].status,
      hof: sources[2].status,
      dojo_pruefungen: sources[3].status,
      demo: sources[4].status
    }
  };

  return { events: inRange, meta };
}

module.exports = { collectKalenderEintraege, toLocalDate };
