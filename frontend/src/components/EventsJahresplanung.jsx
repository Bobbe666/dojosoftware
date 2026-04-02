import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/EventsJahresplanung.css';

const TYPE_COLORS = {
  'Turnier':   '#ef4444',
  'Lehrgang':  '#3b82f6',
  'Prüfung':   '#d4af37',
  'Seminar':   '#8b5cf6',
  'Workshop':  '#10b981',
  'Feier':     '#f59e0b',
  'Sonstiges': '#6b7280',
};

const MONATE = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
];
const WOCHENTAGE = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const WOCHENTAGE_KURZ = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const TAGE_DE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

// ── Zeitgitter-Konstanten ──
const VIEW_START_H = 7;
const VIEW_END_H   = 22;
const TOTAL_H      = VIEW_END_H - VIEW_START_H;
const HOUR_PX      = 64; // px pro Stunde

const timeToMins  = (t) => { if (!t) return 0; const p = String(t).split(':'); return +p[0]*60+(+p[1]||0); };
const topPx       = (t) => Math.max(0, (timeToMins(t) - VIEW_START_H*60) / 60 * HOUR_PX);
const heightPx    = (s, e) => Math.max(22, (timeToMins(e) - timeToMins(s)) / 60 * HOUR_PX);
const getMondayOf = (d) => { const r=new Date(d); r.setDate(r.getDate()-((r.getDay()+6)%7)); r.setHours(0,0,0,0); return r; };
const addDays     = (d, n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const sameDay     = (a, b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const timeAdd60   = (t) => { const m=timeToMins(t)+60; return `${pad2(Math.floor(m/60))}:${pad2(m%60)}`; };

const pad2 = (n) => String(n).padStart(2,'0');

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;
};

const formatWeekdayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const wd = ['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()];
  return `${wd}, ${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.`;
};

const toIsoDate = (year, month, day) =>
  `${year}-${pad2(month+1)}-${pad2(day)}`;

const statusLabel = (s) => ({
  'geplant':        'geplant',
  'anmeldung_offen':'offen',
  'ausgebucht':     'ausgebucht',
  'abgeschlossen':  'abgeschlossen',
  'abgesagt':       'abgesagt',
}[s] || s);

const statusClass = (s) => ({
  'geplant':        'ejp-status-badge--geplant',
  'anmeldung_offen':'ejp-status-badge--offen',
  'ausgebucht':     'ejp-status-badge--ausgebucht',
  'abgeschlossen':  'ejp-status-badge--abgeschlossen',
  'abgesagt':       'ejp-status-badge--abgesagt',
}[s] || 'ejp-status-badge--geplant');

// Gibt Array mit null (Leerfeld) oder Tag-Zahl zurück
const getCalendarCells = (year, month) => {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
};

export default function EventsJahresplanung({ token, activeDojo, onCreateEvent }) {
  const jetzt = new Date();
  const aktuellesJahr = jetzt.getFullYear();
  const aktuellerMonat = jetzt.getMonth();

  const [ansicht, setAnsicht] = useState('kalender');
  const [jahr, setJahr] = useState(aktuellesJahr);
  const [monat, setMonat] = useState(aktuellerMonat);
  const [events, setEvents] = useState([]);
  const [turniere, setTurniere] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailEvent, setDetailEvent] = useState(null);
  const [filterTyp, setFilterTyp] = useState(null); // null = alle
  const [stundenplan, setStundenplan] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date()); // Anker für Wochen-/Tagesansicht
  const gridBodyRef = useRef(null);

  // Aufgeklappte Monate in der Listen-Ansicht
  const [offeneMonate, setOffeneMonate] = useState(() => {
    const offen = new Set();
    for (let m = aktuellerMonat; m < 12; m++) offen.add(m);
    return offen;
  });

  useEffect(() => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const dojoFilter = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';

    Promise.all([
      axios.get(`/events${dojoFilter}`, { headers }).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
      axios.get('/tda-turniere?limit=200', { headers }).then(r => Array.isArray(r.data.turniere) ? r.data.turniere : []).catch(() => []),
      axios.get(`/stundenplan${dojoFilter}`, { headers }).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    ]).then(([eventsData, turniereData, stundenplanData]) => {
      setEvents(eventsData);
      setTurniere(turniereData);
      setStundenplan(stundenplanData);
    }).finally(() => setLoading(false));
  }, [activeDojo?.id, token]);

  // Auto-Scroll zur aktuellen Zeit wenn Wochen-/Tagesansicht aktiv
  useEffect(() => {
    if ((ansicht === 'woche' || ansicht === 'tag') && gridBodyRef.current) {
      const nowMins = jetzt.getHours() * 60 + jetzt.getMinutes();
      const px = Math.max(0, (nowMins - VIEW_START_H * 60) / 60 * HOUR_PX - 80);
      setTimeout(() => { if (gridBodyRef.current) gridBodyRef.current.scrollTop = px; }, 50);
    }
  }, [ansicht]); // eslint-disable-line

  // TDA Turniere als Events normalisieren
  const turniereAlsEvents = turniere.map(t => ({
    event_id: `turnier-${t.id}`,
    titel: t.name,
    datum: t.datum,
    event_typ: 'Turnier',
    ort: t.ort || null,
    status: t.status === 'Aktiv' ? 'anmeldung_offen' : 'geplant',
    max_teilnehmer: t.max_teilnehmer || 0,
    anmeldungen: 0,
    uhrzeit_beginn: null,
    _isTurnier: true,
  }));

  // Alle Events des gewählten Jahres (inkl. TDA Turniere), noch OHNE Typ-Filter
  const jahresEventsAlle = [...events, ...turniereAlsEvents].filter(e => {
    const d = new Date(e.datum);
    return d.getFullYear() === jahr;
  });

  // Jahres-Statistik: Anzahl pro Typ
  const jahresStats = Object.keys(TYPE_COLORS).map(typ => ({
    typ,
    count: jahresEventsAlle.filter(e => (e.event_typ || 'Sonstiges') === typ).length,
  }));

  // Gefilterter Jahressatz
  const jahresEvents = filterTyp
    ? jahresEventsAlle.filter(e => (e.event_typ || 'Sonstiges') === filterTyp)
    : jahresEventsAlle;

  // Events für einen bestimmten Monat
  const eventsForMonth = (m) =>
    jahresEvents.filter(e => new Date(e.datum).getMonth() === m);

  // Events für einen bestimmten Tag
  const eventsForDay = (year, month, day) =>
    jahresEvents.filter(e => {
      const d = new Date(e.datum);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  // Monat-Navigation (Kalender)
  const prevMonat = () => {
    if (monat === 0) { setJahr(j => j - 1); setMonat(11); }
    else setMonat(m => m - 1);
  };
  const nextMonat = () => {
    if (monat === 11) { setJahr(j => j + 1); setMonat(0); }
    else setMonat(m => m + 1);
  };

  const toggleMonat = (m) => {
    setOffeneMonate(prev => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  };

  if (loading) return <div className="ejp-loading">Lade Events…</div>;

  return (
    <div className="ejp-container">
      {/* ── Gemeinsamer Header ── */}
      <div className="ejp-header">
        <div className="ejp-jahr-nav">
          <button
            className="ejp-jahr-btn"
            onClick={() => setJahr(j => j - 1)}
          >‹</button>
          <span className="ejp-jahr-text">{jahr}</span>
          <button
            className="ejp-jahr-btn"
            onClick={() => setJahr(j => j + 1)}
            disabled={jahr >= aktuellesJahr + 2}
          >›</button>
        </div>

        <div className="ejp-view-toggle">
          <button className={`ejp-view-btn${ansicht==='tag'     ? ' ejp-view-btn--aktiv':''}`} onClick={() => setAnsicht('tag')}>Tag</button>
          <button className={`ejp-view-btn${ansicht==='woche'   ? ' ejp-view-btn--aktiv':''}`} onClick={() => setAnsicht('woche')}>Woche</button>
          <button className={`ejp-view-btn${ansicht==='kalender'? ' ejp-view-btn--aktiv':''}`} onClick={() => setAnsicht('kalender')}>Monat</button>
          <button className={`ejp-view-btn${ansicht==='jahr'    ? ' ejp-view-btn--aktiv':''}`} onClick={() => setAnsicht('jahr')}>Jahr</button>
          <button className={`ejp-view-btn${ansicht==='liste'   ? ' ejp-view-btn--aktiv':''}`} onClick={() => setAnsicht('liste')}>Liste</button>
        </div>
      </div>

      {/* ── Jahresübersicht / Typ-Filter ── */}
      <div className="ejp-stats-bar">
        <button
          className={`ejp-stat-chip${!filterTyp ? ' ejp-stat-chip--aktiv' : ''}`}
          style={!filterTyp ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}
          onClick={() => setFilterTyp(null)}
        >
          <span className="ejp-stat-count">{jahresEventsAlle.length}</span>
          <span className="ejp-stat-label">Alle</span>
        </button>
        {jahresStats.filter(s => s.count > 0 || filterTyp === s.typ).map(({ typ, count }) => (
          <button
            key={typ}
            className={`ejp-stat-chip${filterTyp === typ ? ' ejp-stat-chip--aktiv' : ''}`}
            style={filterTyp === typ
              ? { borderColor: TYPE_COLORS[typ], background: `${TYPE_COLORS[typ]}22`, color: TYPE_COLORS[typ] }
              : { borderColor: `${TYPE_COLORS[typ]}55` }
            }
            onClick={() => setFilterTyp(prev => prev === typ ? null : typ)}
          >
            <span className="ejp-stat-dot" style={{ background: TYPE_COLORS[typ] }} />
            <span className="ejp-stat-count">{count}</span>
            <span className="ejp-stat-label">{typ}</span>
          </button>
        ))}
      </div>

      {/* ════════════════════════════════
          KALENDER-ANSICHT
          ════════════════════════════════ */}
      {ansicht === 'kalender' && (
        <>
          {/* Monats-Navigation */}
          <div className="ejp-monat-nav">
            <button className="ejp-monat-btn" onClick={prevMonat}>‹</button>
            <span className="ejp-monat-text">{MONATE[monat]} {jahr}</span>
            <button className="ejp-monat-btn" onClick={nextMonat}>›</button>
          </div>

          <div className="ejp-cal-grid">
            {/* Wochentag-Header */}
            {WOCHENTAGE.map(wd => (
              <div key={wd} className="ejp-cal-weekday">{wd}</div>
            ))}

            {/* Tag-Zellen */}
            {getCalendarCells(jahr, monat).map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="ejp-cal-cell ejp-cal-cell--empty" />;
              }

              const heute = jetzt.getDate() === day &&
                            jetzt.getMonth() === monat &&
                            jetzt.getFullYear() === jahr;
              const dayEvents = eventsForDay(jahr, monat, day);
              const isoDate = toIsoDate(jahr, monat, day);

              return (
                <div
                  key={day}
                  className={`ejp-cal-cell ejp-cal-cell--clickable${heute ? ' ejp-cal-cell--today' : ''}`}
                  onClick={() => dayEvents.length === 0 && onCreateEvent && onCreateEvent(isoDate)}
                >
                  <div className="ejp-day-number">{day}</div>

                  {dayEvents.slice(0, 2).map(ev => (
                    <div
                      key={ev.event_id}
                      className="ejp-event-pill"
                      style={{ background: TYPE_COLORS[ev.event_typ] || TYPE_COLORS.Sonstiges }}
                      onClick={e => { e.stopPropagation(); setDetailEvent(ev); }}
                      title={ev.titel}
                    >
                      <span className="ejp-event-pill-dot" />
                      {ev.titel}
                    </div>
                  ))}

                  {dayEvents.length > 2 && (
                    <div
                      className="ejp-event-pill ejp-event-pill--more"
                      onClick={e => { e.stopPropagation(); setDetailEvent(dayEvents[2]); }}
                    >
                      +{dayEvents.length - 2} mehr
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ════════════════════════════════
          LISTEN-ANSICHT
          ════════════════════════════════ */}
      {ansicht === 'liste' && (
        <div className="ejp-list-sections">
          {MONATE.map((monatName, m) => {
            const monthEvents = eventsForMonth(m);
            const istVergangen = jahr < aktuellesJahr ||
                                 (jahr === aktuellesJahr && m < aktuellerMonat);
            const istAktuell   = jahr === aktuellesJahr && m === aktuellerMonat;
            const istOffen     = offeneMonate.has(m);

            let headerClass = 'ejp-month-header';
            if (istAktuell)   headerClass += ' ejp-month-header--aktuell';
            if (istVergangen) headerClass += ' ejp-month-header--vergangen';

            const ersterDesMonats = toIsoDate(jahr, m, 1);

            return (
              <div key={m} className="ejp-month-section">
                <div
                  className={headerClass}
                  onClick={() => toggleMonat(m)}
                >
                  <span className="ejp-month-toggle-icon">{istOffen ? '▼' : '▶'}</span>
                  <span className="ejp-month-name">{monatName} {jahr}</span>
                  <span className="ejp-month-count">
                    {monthEvents.length === 0
                      ? 'keine Events'
                      : `${monthEvents.length} Event${monthEvents.length !== 1 ? 's' : ''}`}
                  </span>
                  {onCreateEvent && (
                    <button
                      className="ejp-month-add-btn"
                      onClick={e => { e.stopPropagation(); onCreateEvent(ersterDesMonats); }}
                    >+ Event anlegen</button>
                  )}
                </div>

                {istOffen && monthEvents.length > 0 && (
                  <div className="ejp-month-body">
                    {monthEvents
                      .sort((a, b) => new Date(a.datum) - new Date(b.datum))
                      .map(ev => (
                        <div
                          key={ev.event_id}
                          className="ejp-event-row"
                          onClick={() => setDetailEvent(ev)}
                        >
                          <span
                            className="ejp-event-dot"
                            style={{ background: TYPE_COLORS[ev.event_typ] || TYPE_COLORS.Sonstiges }}
                          />
                          <span className="ejp-event-date-cell">
                            {formatWeekdayDate(ev.datum)}
                          </span>
                          <span className="ejp-event-title-cell">{ev.titel}</span>
                          <span
                            className="ejp-type-badge"
                            style={{ background: `${TYPE_COLORS[ev.event_typ] || TYPE_COLORS.Sonstiges}33` }}
                          >
                            {ev.event_typ || 'Sonstiges'}
                          </span>
                          {ev.max_teilnehmer > 0 && (
                            <span className="ejp-tn-count">
                              {ev.anmeldungen ?? 0}/{ev.max_teilnehmer} TN
                            </span>
                          )}
                          <span className={`ejp-status-badge ${statusClass(ev.status)}`}>
                            {statusLabel(ev.status)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════
          WOCHEN- & TAGESANSICHT (Zeitgitter)
          ════════════════════════════════ */}
      {(ansicht === 'woche' || ansicht === 'tag') && (() => {
        const monday   = getMondayOf(viewDate);
        const days     = ansicht === 'woche'
          ? Array.from({ length: 7 }, (_, i) => addDays(monday, i))
          : [viewDate];
        const nowMins  = jetzt.getHours() * 60 + jetzt.getMinutes();
        const nowPx    = (nowMins - VIEW_START_H * 60) / 60 * HOUR_PX;
        const nowValid = nowMins >= VIEW_START_H * 60 && nowMins <= VIEW_END_H * 60;

        // Kurse nach Tag (Wochentag-Name)
        const kurseForDay = (day) => stundenplan.filter(k => k.tag === TAGE_DE[day.getDay()]);

        // Events für einen exakten Tag (aus jahresEvents + alle Jahre)
        const allEvents = [...events, ...turniereAlsEvents];
        const eventsForExact = (day) => allEvents.filter(e => {
          const d = new Date(e.datum);
          return sameDay(d, day);
        });

        // Navigations-Label
        const navLabel = ansicht === 'woche'
          ? `KW ${(() => { const d=new Date(monday); d.setDate(d.getDate()+3); const j=d.getFullYear(); const w1=new Date(j,0,4); return Math.ceil(((d-w1)/86400000+((w1.getDay()||7)-1))/7)+1; })()} · ${pad2(monday.getDate())}.${pad2(monday.getMonth()+1)}. – ${pad2(addDays(monday,6).getDate())}.${pad2(addDays(monday,6).getMonth()+1)}.`
          : `${TAGE_DE[viewDate.getDay()]}, ${pad2(viewDate.getDate())}.${pad2(viewDate.getMonth()+1)}.${viewDate.getFullYear()}`;

        const goBack = () => setViewDate(d => addDays(d, ansicht === 'woche' ? -7 : -1));
        const goFwd  = () => setViewDate(d => addDays(d, ansicht === 'woche' ?  7 :  1));
        const goToday = () => setViewDate(new Date());

        return (
          <div className="ejp-tg-wrap">
            {/* Navigation */}
            <div className="ejp-tg-nav">
              <button className="ejp-monat-btn" onClick={goBack}>‹</button>
              <span className="ejp-tg-nav-label">{navLabel}</span>
              <button className="ejp-monat-btn" onClick={goFwd}>›</button>
              <button className="ejp-tg-today-btn" onClick={goToday}>Heute</button>
            </div>

            {/* Gitter */}
            <div className="ejp-tg-outer">
              {/* Spalten-Header */}
              <div className="ejp-tg-header-row">
                <div className="ejp-tg-corner" />
                {days.map((day, i) => {
                  const isToday = sameDay(day, jetzt);
                  return (
                    <div
                      key={i}
                      className={`ejp-tg-col-header${isToday ? ' ejp-tg-col-header--heute' : ''}`}
                      onClick={() => { setViewDate(day); setAnsicht('tag'); }}
                    >
                      <span className="ejp-tg-col-wd">{WOCHENTAGE[i % 7]}</span>
                      <span className={`ejp-tg-col-day${isToday ? ' ejp-tg-col-day--heute' : ''}`}>
                        {pad2(day.getDate())}.{pad2(day.getMonth()+1)}.
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Scrollbarer Körper */}
              <div className="ejp-tg-body" ref={gridBodyRef}>
                <div className="ejp-tg-inner" style={{ height: TOTAL_H * HOUR_PX }}>
                  {/* Stunden-Labels links */}
                  <div className="ejp-tg-time-col">
                    {Array.from({ length: TOTAL_H }, (_, i) => (
                      <div key={i} className="ejp-tg-hour-label" style={{ top: i * HOUR_PX }}>
                        {pad2(VIEW_START_H + i)}:00
                      </div>
                    ))}
                  </div>

                  {/* Tag-Spalten */}
                  {days.map((day, colIdx) => {
                    const isToday = sameDay(day, jetzt);
                    const dayKurse = kurseForDay(day);
                    const dayEvents = eventsForExact(day).filter(e => filterTyp ? (e.event_typ||'Sonstiges')===filterTyp : true);

                    return (
                      <div key={colIdx} className={`ejp-tg-day-col${isToday ? ' ejp-tg-day-col--heute' : ''}`}>
                        {/* Stunden-Linien */}
                        {Array.from({ length: TOTAL_H }, (_, i) => (
                          <div key={i} className="ejp-tg-hour-line" style={{ top: i * HOUR_PX }} />
                        ))}

                        {/* Jetzt-Linie */}
                        {isToday && nowValid && (
                          <div className="ejp-tg-now-line" style={{ top: nowPx }} />
                        )}

                        {/* Kurse */}
                        {dayKurse.map((k, ki) => (
                          <div
                            key={`k${ki}`}
                            className="ejp-tg-kurs"
                            style={{
                              top: topPx(k.uhrzeit_start),
                              height: heightPx(k.uhrzeit_start, k.uhrzeit_ende),
                              borderLeftColor: k.standort_farbe || '#3b82f6',
                              background: k.standort_farbe ? `${k.standort_farbe}20` : 'rgba(59,130,246,0.12)',
                            }}
                            title={`${k.kursname} · ${k.uhrzeit_start?.slice(0,5)}–${k.uhrzeit_ende?.slice(0,5)}`}
                          >
                            <div className="ejp-tg-block-title">{k.kursname}</div>
                            <div className="ejp-tg-block-meta">{k.uhrzeit_start?.slice(0,5)}–{k.uhrzeit_ende?.slice(0,5)}{k.trainer_nachname ? ` · ${k.trainer_nachname}` : ''}</div>
                          </div>
                        ))}

                        {/* Events mit Zeit */}
                        {dayEvents.filter(e => e.uhrzeit_beginn).map((ev, ei) => (
                          <div
                            key={`e${ei}`}
                            className="ejp-tg-event"
                            style={{
                              top: topPx(ev.uhrzeit_beginn),
                              height: heightPx(ev.uhrzeit_beginn, ev.uhrzeit_ende || timeAdd60(ev.uhrzeit_beginn)),
                              background: TYPE_COLORS[ev.event_typ] || TYPE_COLORS.Sonstiges,
                            }}
                            onClick={() => setDetailEvent(ev)}
                            title={ev.titel}
                          >
                            <div className="ejp-tg-block-title">{ev.titel}</div>
                            <div className="ejp-tg-block-meta">{ev.uhrzeit_beginn?.slice(0,5)} Uhr{ev.ort ? ` · ${ev.ort}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Ganztags-Events (ohne Uhrzeit) */}
                {days.some(day => eventsForExact(day).some(e => !e.uhrzeit_beginn)) && (
                  <div className="ejp-tg-allday-row">
                    <div className="ejp-tg-corner ejp-tg-allday-label">Ganztags</div>
                    {days.map((day, ci) => (
                      <div key={ci} className="ejp-tg-allday-col">
                        {eventsForExact(day).filter(e => !e.uhrzeit_beginn && (filterTyp ? (e.event_typ||'Sonstiges')===filterTyp : true)).map((ev, ei) => (
                          <div
                            key={ei}
                            className="ejp-tg-allday-event"
                            style={{ background: TYPE_COLORS[ev.event_typ] || TYPE_COLORS.Sonstiges }}
                            onClick={() => setDetailEvent(ev)}
                          >{ev.titel}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════
          JAHRES-ANSICHT (12 Mini-Monate)
          ════════════════════════════════ */}
      {ansicht === 'jahr' && (
        <div className="ejp-year-grid">
          {MONATE.map((monatName, m) => {
            const cells = getCalendarCells(jahr, m);
            const istAktuell = jahr === aktuellesJahr && m === aktuellerMonat;

            return (
              <div key={m} className={`ejp-mini-month${istAktuell ? ' ejp-mini-month--aktuell' : ''}`}>
                {/* Monats-Header — Klick wechselt zur Monatsansicht */}
                <div
                  className="ejp-mini-month-title"
                  onClick={() => { setMonat(m); setAnsicht('kalender'); }}
                >
                  {monatName}
                </div>

                {/* Wochentage */}
                <div className="ejp-mini-cal-grid">
                  {['Mo','Di','Mi','Do','Fr','Sa','So'].map(wd => (
                    <div key={wd} className="ejp-mini-weekday">{wd}</div>
                  ))}

                  {cells.map((day, idx) => {
                    if (day === null) {
                      return <div key={`e-${idx}`} className="ejp-mini-cell ejp-mini-cell--empty" />;
                    }

                    const heute = day === jetzt.getDate() && m === aktuellerMonat && jahr === aktuellesJahr;
                    const dayEvents = jahresEvents.filter(e => {
                      const d = new Date(e.datum);
                      return d.getFullYear() === jahr && d.getMonth() === m && d.getDate() === day;
                    });

                    return (
                      <div
                        key={day}
                        className={`ejp-mini-cell${heute ? ' ejp-mini-cell--today' : ''}${dayEvents.length > 0 ? ' ejp-mini-cell--has-events' : ''}`}
                        onClick={() => {
                          if (dayEvents.length === 1) setDetailEvent(dayEvents[0]);
                          else if (dayEvents.length > 1) { setMonat(m); setAnsicht('kalender'); }
                          else if (onCreateEvent) onCreateEvent(toIsoDate(jahr, m, day));
                        }}
                        title={dayEvents.map(e => e.titel).join(', ') || ''}
                      >
                        <span className="ejp-mini-day-nr">{day}</span>
                        {dayEvents.length > 0 && (
                          <div className="ejp-mini-dots">
                            {dayEvents.slice(0, 3).map((ev, i) => (
                              <span
                                key={i}
                                className="ejp-mini-dot"
                                style={{ background: TYPE_COLORS[ev.event_typ] || TYPE_COLORS.Sonstiges }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detail-Popup ── */}
      {detailEvent && (
        <div className="ejp-popup-overlay" onClick={() => setDetailEvent(null)}>
          <div className="ejp-popup" onClick={e => e.stopPropagation()}>
            <button className="ejp-popup-close" onClick={() => setDetailEvent(null)}>✕</button>

            <div className="ejp-popup-header">
              <div
                className="ejp-popup-type-dot"
                style={{ background: TYPE_COLORS[detailEvent.event_typ] || TYPE_COLORS.Sonstiges }}
              />
              <div className="ejp-popup-title">{detailEvent.titel}</div>
            </div>

            <div className="ejp-popup-meta">
              <div className="ejp-popup-row">
                📅 <strong>{formatDate(detailEvent.datum)}</strong>
                {detailEvent.uhrzeit_beginn && ` · ${detailEvent.uhrzeit_beginn.slice(0,5)} Uhr`}
              </div>
              {detailEvent.ort && (
                <div className="ejp-popup-row">📍 <strong>{detailEvent.ort}</strong></div>
              )}
              {detailEvent.max_teilnehmer > 0 && (
                <div className="ejp-popup-row">
                  👥 <strong>{detailEvent.anmeldungen ?? 0} / {detailEvent.max_teilnehmer} TN</strong>
                </div>
              )}
              <div className="ejp-popup-row">
                <span
                  className={`ejp-status-badge ${statusClass(detailEvent.status)}`}
                  style={{ marginTop: '4px' }}
                >
                  {statusLabel(detailEvent.status)}
                </span>
                <span
                  className="ejp-type-badge"
                  style={{
                    background: `${TYPE_COLORS[detailEvent.event_typ] || TYPE_COLORS.Sonstiges}33`,
                    marginTop: '4px'
                  }}
                >
                  {detailEvent.event_typ || 'Sonstiges'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
