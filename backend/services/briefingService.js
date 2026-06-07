// ============================================================================
// TÄGLICHES BRIEFING — "Dein Tag"
// Aggregiert für den Super-Admin:
//   🔥 überfällige To-Dos · ✅ diese Woche fällige To-Dos
//   📅 Termine heute + 7 Tage (alle Plattformen + Demos)
//   🔔 Neues (ungelesene Meldungen, neue Pilot-Bewerbungen)
//
// Außerdem: automatische Aufgaben-Checklisten für kommende Events/HoF-
// Veranstaltungen (einmalig pro Event — Log in briefing_event_checklisten,
// gelöschte Aufgaben werden NICHT neu angelegt).
//
// Cron (cron-jobs.js, täglich 07:00): syncEventChecklisten() + Briefing-Mail.
// Popup: GET /api/briefing (routes/briefing.js) beim ersten Dashboard-Besuch.
// ============================================================================
const db = require('../db');
const { sendEmail } = require('./emailService');
const { collectKalenderEintraege, toLocalDate } = require('./kalenderAggregation');

const pool = db.promise();

const BRIEFING_MAIL_TO = 'info@tda-intl.com';
const VORSCHAU_TAGE = 7;        // Termine + fällige To-Dos: heute + 7 Tage
const CHECKLIST_VORLAUF_TAGE = 60; // Checklisten für Events der nächsten 60 Tage

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLISTEN-VORLAGE — Aufgaben relativ zum Event-Datum (negativ = vorher)
// Gilt für typ 'event' (Events/Netzwerktreffen) und 'hof' (HoF-Veranstaltungen)
// ─────────────────────────────────────────────────────────────────────────────
const CHECKLISTE = [
  { offsetTage: -42, titel: 'Einladungen & Ankündigung veröffentlichen', prioritaet: 'normal' },
  { offsetTage: -28, titel: 'Anmeldungen prüfen & nachfassen',           prioritaet: 'normal' },
  { offsetTage: -14, titel: 'Ablaufplan & Material festlegen',           prioritaet: 'hoch' },
  { offsetTage: -7,  titel: 'Raum / Catering / Technik bestätigen',      prioritaet: 'hoch' },
  { offsetTage: -2,  titel: 'Unterlagen & Technik final checken',        prioritaet: 'dringend' },
  { offsetTage: 1,   titel: 'Nachbereitung: Danke-Mail, Fotos, Bericht', prioritaet: 'normal' },
];

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Event-Checklisten: für kommende Events/HoF einmalig To-Dos erzeugen
// ─────────────────────────────────────────────────────────────────────────────
async function syncEventChecklisten() {
  const heute = toLocalDate(new Date());
  const bis = addDays(heute, CHECKLIST_VORLAUF_TAGE);
  const { events } = await collectKalenderEintraege(heute, bis);

  const relevante = events.filter(e => ['event', 'hof'].includes(e.typ));
  let neueChecklisten = 0;
  let neueAufgaben = 0;

  for (const ev of relevante) {
    const datum = String(ev.datum).slice(0, 10);
    const eventKey = ev.id; // z.B. "event-12" / "hof-5" — stabil pro Plattform

    // Schon eine Checkliste erzeugt? (auch wenn Aufgaben gelöscht wurden → nicht erneut)
    const [vorhanden] = await pool.query(
      'SELECT event_key FROM briefing_event_checklisten WHERE event_key = ? LIMIT 1', [eventKey]
    );
    if (vorhanden.length > 0) continue;

    const kontext = `Event: ${String(ev.titel || '').slice(0, 80)}`;
    for (const aufgabe of CHECKLISTE) {
      const faellig = addDays(datum, aufgabe.offsetTage);
      if (faellig < heute) continue; // Frist schon vorbei → keine sinnlose Aufgabe
      await pool.query(`
        INSERT INTO todos (dojo_id, kontext, titel, beschreibung, prioritaet, status, faellig_am)
        VALUES (NULL, ?, ?, ?, ?, 'offen', ?)
      `, [
        kontext,
        `${aufgabe.titel} — ${ev.titel}`,
        `Automatische Checklisten-Aufgabe für „${ev.titel}" am ${datum}${ev.ort ? ` (${ev.ort})` : ''}.`,
        aufgabe.prioritaet,
        faellig,
      ]);
      neueAufgaben++;
    }

    await pool.query(
      'INSERT INTO briefing_event_checklisten (event_key, event_titel, event_datum) VALUES (?, ?, ?)',
      [eventKey, String(ev.titel || '').slice(0, 255), datum]
    );
    neueChecklisten++;
  }

  return { neueChecklisten, neueAufgaben };
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefing-Daten zusammenstellen
// ─────────────────────────────────────────────────────────────────────────────
async function buildBriefing() {
  const heute = toLocalDate(new Date());
  const bis = addDays(heute, VORSCHAU_TAGE);

  const [
    [ueberfaellig],
    [faellig],
    kalender,
    [[meldungen]],
    [[bewerbungen]],
    [[feedbackOffen]],
  ] = await Promise.all([
    pool.query(`
      SELECT id, titel, kontext, prioritaet, faellig_am
      FROM todos
      WHERE status != 'erledigt' AND faellig_am IS NOT NULL AND faellig_am < ?
      ORDER BY faellig_am ASC LIMIT 25
    `, [heute]),
    pool.query(`
      SELECT id, titel, kontext, prioritaet, faellig_am
      FROM todos
      WHERE status != 'erledigt' AND faellig_am BETWEEN ? AND ?
      ORDER BY faellig_am ASC LIMIT 25
    `, [heute, bis]),
    collectKalenderEintraege(heute, bis),
    pool.query(`SELECT COUNT(*) AS n FROM super_admin_notifications WHERE gelesen = FALSE AND archiviert = FALSE`),
    pool.query(`SELECT COUNT(*) AS n FROM pilot_bewerbungen WHERE status = 'neu'`),
    pool.query(`
      SELECT COUNT(*) AS n FROM pilot_feedback_umfragen
      WHERE beantwortet_am IS NOT NULL
        AND beantwortet_am > DATE_SUB(NOW(), INTERVAL 7 DAY)
    `),
  ]);

  const termine = kalender.events.map(e => ({
    ...e,
    datum: String(e.datum).slice(0, 10),
    heute: String(e.datum).slice(0, 10) === heute,
  }));

  return {
    datum: heute,
    ueberfaellige_todos: ueberfaellig,
    faellige_todos: faellig,
    termine_heute: termine.filter(t => t.heute),
    termine_demnaechst: termine.filter(t => !t.heute),
    neues: {
      ungelesene_meldungen: meldungen.n,
      neue_pilot_bewerbungen: bewerbungen.n,
      pilot_feedback_letzte_7_tage: feedbackOffen.n,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Morgen-Mail (07:00)
// ─────────────────────────────────────────────────────────────────────────────
const PRIO_ICON = { dringend: '🔴', hoch: '🟠', normal: '🟡', niedrig: '⚪' };

function fmtDatum(d) {
  return new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function renderBriefingHtml(b) {
  const todoZeile = (t) =>
    `<li style="margin:4px 0">${PRIO_ICON[t.prioritaet] || '🟡'} <strong>${t.titel}</strong>` +
    `${t.kontext ? ` <span style="color:#888">· ${t.kontext}</span>` : ''}` +
    ` <span style="color:#888">— fällig ${fmtDatum(t.faellig_am)}</span></li>`;

  const terminZeile = (t) =>
    `<li style="margin:4px 0">📅 <strong>${fmtDatum(t.datum)}</strong>${t.uhrzeit ? ` ${t.uhrzeit}` : ''} — ${t.titel}` +
    `${t.ort ? ` <span style="color:#888">(${t.ort})</span>` : ''}</li>`;

  const sektion = (titel, inhalt) =>
    inhalt ? `<h3 style="margin:18px 0 6px;color:#b8860b">${titel}</h3>${inhalt}` : '';

  const liste = (arr, renderer) =>
    arr.length ? `<ul style="margin:0;padding-left:18px">${arr.map(renderer).join('')}</ul>` : '';

  const neuesItems = [];
  if (b.neues.ungelesene_meldungen > 0) neuesItems.push(`🔔 ${b.neues.ungelesene_meldungen} ungelesene Meldung(en)`);
  if (b.neues.neue_pilot_bewerbungen > 0) neuesItems.push(`🏆 ${b.neues.neue_pilot_bewerbungen} neue Pilot-Bewerbung(en)`);
  if (b.neues.pilot_feedback_letzte_7_tage > 0) neuesItems.push(`📝 ${b.neues.pilot_feedback_letzte_7_tage} Pilot-Feedback(s) in den letzten 7 Tagen`);

  const leer = !b.ueberfaellige_todos.length && !b.faellige_todos.length &&
               !b.termine_heute.length && !b.termine_demnaechst.length && !neuesItems.length;

  return (
    `<div style="font-family:system-ui,sans-serif;max-width:640px">` +
    `<h2 style="margin:0 0 4px">☀️ Dein Tag — ${new Date(b.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h2>` +
    `<p style="color:#888;margin:0 0 12px">Tägliches Briefing · TDA Plattform</p>` +
    (leer ? `<p>🎉 Keine offenen Punkte — alles im grünen Bereich!</p>` : '') +
    sektion(`🔥 Überfällig (${b.ueberfaellige_todos.length})`, liste(b.ueberfaellige_todos, todoZeile)) +
    sektion(`✅ Zu tun — nächste ${VORSCHAU_TAGE} Tage (${b.faellige_todos.length})`, liste(b.faellige_todos, todoZeile)) +
    sektion(`📅 Heute (${b.termine_heute.length})`, liste(b.termine_heute, terminZeile)) +
    sektion(`🗓 Demnächst (${b.termine_demnaechst.length})`, liste(b.termine_demnaechst, terminZeile)) +
    sektion('🔔 Neues', neuesItems.length ? `<ul style="margin:0;padding-left:18px">${neuesItems.map(i => `<li style="margin:4px 0">${i}</li>`).join('')}</ul>` : '') +
    `<p style="margin-top:20px"><a href="https://dojo.tda-intl.org" style="color:#b8860b">→ Zum Dashboard</a> · <a href="https://todo.tda-intl.org" style="color:#b8860b">→ Zu den Aufgaben</a></p>` +
    `</div>`
  );
}

async function sendBriefingMail() {
  const briefing = await buildBriefing();
  const anzahl = briefing.ueberfaellige_todos.length + briefing.faellige_todos.length +
                 briefing.termine_heute.length + briefing.termine_demnaechst.length;

  await sendEmail({
    to: BRIEFING_MAIL_TO,
    subject: `☀️ Dein Tag — ${briefing.ueberfaellige_todos.length ? `🔥 ${briefing.ueberfaellige_todos.length} überfällig, ` : ''}${anzahl} Punkte heute & demnächst`,
    text: 'Dein tägliches Briefing — bitte HTML-Ansicht öffnen.',
    html: renderBriefingHtml(briefing),
  });

  return briefing;
}

module.exports = { buildBriefing, syncEventChecklisten, sendBriefingMail, renderBriefingHtml, CHECKLISTE };
