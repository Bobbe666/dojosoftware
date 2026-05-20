// ============================================================================
// KALENDER ZENTRALE — Unified Calendar Component
// Route: /dashboard/kalender
// Kombiniert Events, Prüfungen, Training, TDA-Events & externe iCal-Feeds
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import fetchWithAuth from '../utils/fetchWithAuth';
import config from '../config';
import '../styles/KalenderZentrale.css';

// ── Konstanten ────────────────────────────────────────────────────────────────

const TYP_FARBEN = {
  event:    '#10b981',
  pruefung: '#f59e0b',
  training: '#3b82f6',
  tda:      '#8b5cf6',
  extern:   '#6366f1'
};

const TYP_LABELS = {
  event:    'Event',
  pruefung: 'Prüfung',
  training: 'Training',
  tda:      'TDA Events',
  extern:   'Privat/Extern'
};

const VIEWS = ['Täglich', 'Wöchentlich', 'Monatlich', 'Quartal', 'Halbjährlich', 'Jährlich'];
const VIEW_KEYS = ['taeglich', 'woechentlich', 'monatlich', 'quartal', 'halbjahr', 'jaehrlich'];

const DE_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const DE_WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DE_WEEKDAYS_FULL  = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

// Stunden für die Zeitgitter-Ansichten (06:00–22:00)
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6,7,...,22

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(date) {
  const t = new Date();
  return date.getFullYear() === t.getFullYear() &&
         date.getMonth() === t.getMonth() &&
         date.getDate() === t.getDate();
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

/** Montag der Woche die `date` enthält */
function getMonday(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=So
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** ISO-Kalenderwoche */
function getKW(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateDE(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/**
 * Gibt alle Daten zwischen von und bis zurück (inkl. beide Enden)
 */
function getDateRange(von, bis) {
  const result = [];
  const cur = new Date(von);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(bis);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    result.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

/**
 * Gruppiert Events nach Datums-String "YYYY-MM-DD"
 * Ein Event kommt in alle Tage die es berührt
 */
function groupByDay(events) {
  const map = {};
  for (const ev of events) {
    const von = new Date(ev.datum_von);
    const bis = new Date(ev.datum_bis);
    const vonDay = new Date(von); vonDay.setHours(0, 0, 0, 0);
    const bisDay = new Date(bis); bisDay.setHours(23, 59, 59, 0);
    const cur = new Date(vonDay);
    while (cur <= bisDay) {
      const key = toDateStr(cur);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return map;
}

/**
 * Position und Höhe eines Events im Zeitgitter (px pro Stunde = 48px)
 * Gitter startet bei 06:00
 */
function getEventGridPosition(event) {
  const HOUR_HEIGHT = 48; // px
  const GRID_START = 6;   // 06:00
  const von = new Date(event.datum_von);
  const bis = new Date(event.datum_bis);

  const startMinutes = von.getHours() * 60 + von.getMinutes();
  const endMinutes   = bis.getHours() * 60 + bis.getMinutes();

  const gridStartMinutes = GRID_START * 60;
  const top  = ((startMinutes - gridStartMinutes) / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 20); // min 20px
  return { top: Math.max(0, top), height };
}

// ── Periode-Label ─────────────────────────────────────────────────────────────

function getPeriodLabel(view, date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (view) {
    case 'taeglich':
      return `${String(date.getDate()).padStart(2, '0')}. ${DE_MONTHS[m]} ${y}`;
    case 'woechentlich': {
      const mon = getMonday(date);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return `KW ${getKW(date)} · ${y}`;
    }
    case 'monatlich':
      return `${DE_MONTHS[m]} ${y}`;
    case 'quartal': {
      const q = Math.floor(m / 3) + 1;
      return `Q${q} ${y}`;
    }
    case 'halbjahr':
      return `${m < 6 ? 'H1' : 'H2'} ${y}`;
    case 'jaehrlich':
      return `${y}`;
    default:
      return '';
  }
}

// ── Datumsbereich für API-Abfrage ─────────────────────────────────────────────

function getQueryRange(view, date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (view) {
    case 'taeglich':
      return { von: toDateStr(date), bis: toDateStr(date) };
    case 'woechentlich': {
      const mon = getMonday(date);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { von: toDateStr(mon), bis: toDateStr(sun) };
    }
    case 'monatlich': {
      const first = new Date(y, m, 1);
      const last  = new Date(y, m + 1, 0);
      // Buffer: -7 / +7 für Anzeige-Überlauf
      const bufFirst = new Date(first); bufFirst.setDate(bufFirst.getDate() - 7);
      const bufLast  = new Date(last);  bufLast.setDate(bufLast.getDate() + 7);
      return { von: toDateStr(bufFirst), bis: toDateStr(bufLast) };
    }
    case 'quartal': {
      const qStart = Math.floor(m / 3) * 3;
      return { von: toDateStr(new Date(y, qStart, 1)), bis: toDateStr(new Date(y, qStart + 3, 0)) };
    }
    case 'halbjahr': {
      const hStart = m < 6 ? 0 : 6;
      return { von: toDateStr(new Date(y, hStart, 1)), bis: toDateStr(new Date(y, hStart + 6, 0)) };
    }
    case 'jaehrlich':
      return { von: `${y}-01-01`, bis: `${y}-12-31` };
    default:
      return { von: toDateStr(date), bis: toDateStr(date) };
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

function navigate(view, date, direction) {
  const d = new Date(date);
  switch (view) {
    case 'taeglich':
      d.setDate(d.getDate() + direction);
      break;
    case 'woechentlich':
      d.setDate(d.getDate() + direction * 7);
      break;
    case 'monatlich':
      d.setMonth(d.getMonth() + direction);
      break;
    case 'quartal':
      d.setMonth(d.getMonth() + direction * 3);
      break;
    case 'halbjahr':
      d.setMonth(d.getMonth() + direction * 6);
      break;
    case 'jaehrlich':
      d.setFullYear(d.getFullYear() + direction);
      break;
  }
  return d;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// ── Event Detail Modal ────────────────────────────────────────────────────────

function EventDetailModal({ event, onClose }) {
  if (!event) return null;
  const farbe = event.farbe || TYP_FARBEN[event.typ] || '#6366f1';
  const label = TYP_LABELS[event.typ] || event.typ;

  return createPortal(
    <div className="kz-modal-overlay" onClick={onClose}>
      <div className="kz-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="kz-detail-header">
          <div className="kz-detail-color-bar" style={{ background: farbe }} />
          <div className="kz-detail-title">{event.titel}</div>
          <button className="kz-detail-close" onClick={onClose}>✕</button>
        </div>
        <div className="kz-detail-meta">
          <div className="kz-detail-meta-row">
            <span className="kz-detail-meta-icon">📅</span>
            <span>
              {formatDateDE(event.datum_von)}
              {event.datum_bis && !isSameDay(new Date(event.datum_von), new Date(event.datum_bis))
                ? ` – ${formatDateDE(event.datum_bis)}`
                : ''}
            </span>
          </div>
          {(formatTime(event.datum_von) || formatTime(event.datum_bis)) && (
            <div className="kz-detail-meta-row">
              <span className="kz-detail-meta-icon">⏰</span>
              <span>
                {formatTime(event.datum_von)}
                {formatTime(event.datum_bis) ? ` – ${formatTime(event.datum_bis)}` : ''}
              </span>
            </div>
          )}
          {event.ort && (
            <div className="kz-detail-meta-row">
              <span className="kz-detail-meta-icon">📍</span>
              <span>{event.ort}</span>
            </div>
          )}
          {event.quelle_name && (
            <div className="kz-detail-meta-row">
              <span className="kz-detail-meta-icon">🔖</span>
              <span>{event.quelle_name}</span>
            </div>
          )}
        </div>
        <span className="kz-detail-typ-badge" style={{ background: farbe }}>
          {label}
        </span>
      </div>
    </div>,
    document.body
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({ icalUrls, onClose, onAdd, onDelete, addLoading }) {
  const [newName, setNewName] = useState('');
  const [newUrl,  setNewUrl]  = useState('');
  const [newFarbe, setNewFarbe] = useState('#6366f1');

  const handleAdd = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    onAdd({ name: newName.trim(), url: newUrl.trim(), farbe: newFarbe });
    setNewName(''); setNewUrl(''); setNewFarbe('#6366f1');
  };

  return createPortal(
    <div className="kz-modal-overlay" onClick={onClose}>
      <div className="kz-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="kz-settings-title">
          <span>⚙️ Kalender-Einstellungen</span>
          <button className="kz-detail-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--kz-text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          Externe Kalender (iCal-URLs)
        </div>

        {icalUrls.length === 0 ? (
          <p className="kz-empty-hint">Noch keine externen Kalender eingetragen.</p>
        ) : (
          <div className="kz-ical-list">
            {icalUrls.map(u => (
              <div key={u.id} className="kz-ical-row">
                <div className="kz-ical-color-dot" style={{ background: u.farbe || '#6366f1' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kz-ical-name">{u.name}</div>
                  <div className="kz-ical-url">{u.url}</div>
                </div>
                <button className="kz-ical-delete" onClick={() => onDelete(u.id)}>Löschen</button>
              </div>
            ))}
          </div>
        )}

        <div className="kz-ical-add-form">
          <div className="kz-ical-add-title">Neuen Kalender hinzufügen</div>
          <input
            className="kz-input"
            placeholder="Name (z.B. Privatkalender)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            className="kz-input"
            placeholder="iCal-URL (https:// oder webcal://)"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
          />
          <div className="kz-ical-add-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--kz-text2)' }}>Farbe:</label>
              <input
                type="color"
                value={newFarbe}
                onChange={e => setNewFarbe(e.target.value)}
                style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }}
              />
            </div>
            <button
              className="kz-btn-add"
              onClick={handleAdd}
              disabled={!newName.trim() || !newUrl.trim() || addLoading}
            >
              {addLoading ? 'Hinzufügen…' : '+ Hinzufügen'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Monthly View ──────────────────────────────────────────────────────────────

function MonthlyView({ date, byDay, onEventClick, onDayClick, showAddBtn }) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const firstDay = new Date(y, m, 1);
  const daysInMonth = getDaysInMonth(y, m);

  // Wochentag des 1. (0=So → shift to Mo=0)
  const startDow = firstDay.getDay(); // 0=So
  const blanks = startDow === 0 ? 6 : startDow - 1; // Mo-basiert

  const days = [];
  // Leer-Zellen vom Vormonat
  for (let i = 0; i < blanks; i++) {
    const prevDate = new Date(y, m, 1 - blanks + i);
    days.push({ date: prevDate, thisMonth: false });
  }
  // Tage dieses Monats
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(y, m, d), thisMonth: true });
  }
  // Leer-Zellen vom Folgemonat
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(y, m + 1, i), thisMonth: false });
  }

  return (
    <div className="kz-month-grid">
      {DE_WEEKDAYS_SHORT.map(wd => (
        <div key={wd} className="kz-weekday-header">{wd}</div>
      ))}
      {days.map(({ date: d, thisMonth }, idx) => {
        const key = toDateStr(d);
        const evs = byDay[key] || [];
        const visible = evs.slice(0, 3);
        const more = evs.length - 3;
        const todayClass = isToday(d) ? 'today' : '';
        const otherClass = !thisMonth ? 'other-month' : '';
        return (
          <div
            key={idx}
            className={`kz-day-cell ${todayClass} ${otherClass}`}
            onClick={() => onDayClick(d)}
          >
            <div className="kz-day-num">
              {isToday(d)
                ? <span className="kz-day-num-inner">{d.getDate()}</span>
                : d.getDate()
              }
              {showAddBtn && thisMonth && (
                <span className="kz-day-add-btn" title="Prüfungstermin anlegen">+</span>
              )}
            </div>
            {visible.map((ev, ei) => (
              <div
                key={ei}
                className="kz-event-bar"
                style={{ background: ev.farbe || TYP_FARBEN[ev.typ] || '#6366f1' }}
                title={ev.titel}
                onClick={e => { e.stopPropagation(); onEventClick(ev); }}
              >
                {ev.titel}
              </div>
            ))}
            {more > 0 && (
              <div className="kz-more-badge">+{more} mehr</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Weekly View ───────────────────────────────────────────────────────────────

function WeeklyView({ date, events, onEventClick }) {
  const mon = getMonday(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    return d;
  });

  const HOUR_HEIGHT = 48;

  return (
    <div className="kz-time-grid-wrap">
      <div className="kz-time-grid-header">
        <div className="kz-time-col-spacer" />
        {weekDays.map((d, i) => (
          <div key={i} className={`kz-day-col-header${isToday(d) ? ' today-col' : ''}`}>
            {DE_WEEKDAYS_SHORT[i]} {d.getDate()}.{d.getMonth() + 1}.
          </div>
        ))}
      </div>
      <div className="kz-time-grid-body">
        {/* Stunden-Labels */}
        <div className="kz-time-labels">
          {HOURS.map(h => (
            <div key={h} className="kz-time-label">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {/* Spalten */}
        <div className="kz-day-cols">
          {weekDays.map((d, di) => {
            const dayStr = toDateStr(d);
            const dayEvents = events.filter(ev => {
              const evDay = toDateStr(new Date(ev.datum_von));
              return evDay === dayStr;
            });
            return (
              <div key={di} className="kz-day-column">
                {HOURS.map(h => (
                  <div key={h} className="kz-hour-row" />
                ))}
                {dayEvents.map((ev, ei) => {
                  const { top, height } = getEventGridPosition(ev);
                  return (
                    <div
                      key={ei}
                      className="kz-event-block"
                      style={{ top, height, background: ev.farbe || TYP_FARBEN[ev.typ] || '#6366f1' }}
                      onClick={() => onEventClick(ev)}
                      title={ev.titel}
                    >
                      <div className="kz-event-block-title">{ev.titel}</div>
                      <div className="kz-event-block-time">
                        {formatTime(ev.datum_von)} – {formatTime(ev.datum_bis)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Daily View ────────────────────────────────────────────────────────────────

function DailyView({ date, events, onEventClick }) {
  const dayStr = toDateStr(date);
  const dayEvents = events.filter(ev => {
    const evDay = toDateStr(new Date(ev.datum_von));
    return evDay === dayStr;
  });

  return (
    <div className="kz-time-grid-wrap">
      <div className="kz-time-grid-header">
        <div className="kz-time-col-spacer" />
        <div className={`kz-day-col-header${isToday(date) ? ' today-col' : ''}`} style={{ flex: 1 }}>
          {DE_WEEKDAYS_FULL[date.getDay() === 0 ? 6 : date.getDay() - 1]}{' '}
          {date.getDate()}. {DE_MONTHS[date.getMonth()]} {date.getFullYear()}
        </div>
      </div>
      <div className="kz-time-grid-body">
        <div className="kz-time-labels">
          {HOURS.map(h => (
            <div key={h} className="kz-time-label">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        <div className="kz-day-cols">
          <div className="kz-day-column" style={{ flex: 1 }}>
            {HOURS.map(h => (
              <div key={h} className="kz-hour-row" />
            ))}
            {dayEvents.map((ev, ei) => {
              const { top, height } = getEventGridPosition(ev);
              return (
                <div
                  key={ei}
                  className="kz-event-block"
                  style={{ top, height, background: ev.farbe || TYP_FARBEN[ev.typ] || '#6366f1' }}
                  onClick={() => onEventClick(ev)}
                  title={ev.titel}
                >
                  <div className="kz-event-block-title">{ev.titel}</div>
                  <div className="kz-event-block-time">
                    {formatTime(ev.datum_von)} – {formatTime(ev.datum_bis)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mini-Month (für Quartal/Halbjahr/Jahr) ────────────────────────────────────

function MiniMonth({ year, month, byDay, onDayClick }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const blanks = startDow === 0 ? 6 : startDow - 1;

  const days = [];
  for (let i = 0; i < blanks; i++) {
    days.push({ date: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d) });
  }

  return (
    <div className="kz-mini-month">
      <div className="kz-mini-month-title">{DE_MONTHS[month]} {year}</div>
      <div className="kz-mini-grid">
        {DE_WEEKDAYS_SHORT.map(wd => (
          <div key={wd} className="kz-mini-weekday">{wd}</div>
        ))}
        {days.map((item, idx) => {
          if (!item.date) {
            return <div key={`b-${idx}`} />;
          }
          const key = toDateStr(item.date);
          const evCount = (byDay[key] || []).length;
          const todayClass = isToday(item.date) ? 'today' : '';
          const hasEvClass = evCount > 0 ? 'has-events' : '';
          return (
            <div
              key={idx}
              className={`kz-mini-day ${todayClass} ${hasEvClass}`}
              onClick={() => onDayClick(item.date)}
              title={evCount > 0 ? `${evCount} Termin${evCount > 1 ? 'e' : ''}` : undefined}
            >
              {item.date.getDate()}
              {evCount > 1 && (
                <span className="kz-mini-day-count">{evCount}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Overview View (Quartal / Halbjahr / Jahr) ─────────────────────────────────

function OverviewView({ view, date, byDay, onDayClick }) {
  const y = date.getFullYear();
  const m = date.getMonth();

  let months;
  let gridClass;
  if (view === 'quartal') {
    const qStart = Math.floor(m / 3) * 3;
    months = [qStart, qStart + 1, qStart + 2];
    gridClass = 'quartal';
  } else if (view === 'halbjahr') {
    const hStart = m < 6 ? 0 : 6;
    months = Array.from({ length: 6 }, (_, i) => hStart + i);
    gridClass = 'halbjahr';
  } else {
    months = Array.from({ length: 12 }, (_, i) => i);
    gridClass = 'jahr';
  }

  return (
    <div className={`kz-mini-months ${gridClass}`}>
      {months.map(mo => (
        <MiniMonth
          key={mo}
          year={y}
          month={mo}
          byDay={byDay}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function KalenderZentrale({ onDayClick: externalDayClick } = {}) {
  const [view, setView]               = useState('monatlich');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showSettings, setShowSettings]   = useState(false);
  const [icalUrls, setIcalUrls]           = useState([]);
  const [addLoading, setAddLoading]       = useState(false);

  // ── Fetch Events ────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async (v, d) => {
    setLoading(true);
    const { von, bis } = getQueryRange(v, d);
    try {
      const res = await fetchWithAuth(
        `${config.apiBaseUrl}/kalender/events?von=${von}&bis=${bis}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Kalender fetch error:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIcalUrls = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/kalender/ical-urls`);
      if (!res.ok) return;
      const data = await res.json();
      setIcalUrls(data.urls || []);
    } catch (err) {
      console.error('iCal URLs fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchEvents(view, currentDate);
  }, [view, currentDate, fetchEvents]);

  useEffect(() => {
    fetchIcalUrls();
  }, [fetchIcalUrls]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleNav = (direction) => {
    setCurrentDate(prev => navigate(view, prev, direction));
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (d) => {
    if (externalDayClick) {
      externalDayClick(d);
    } else {
      setCurrentDate(d);
      setView('taeglich');
    }
  };

  // ── iCal Management ─────────────────────────────────────────────────────────

  const handleIcalAdd = async ({ name, url, farbe }) => {
    setAddLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/kalender/ical-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, farbe })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchIcalUrls();
      await fetchEvents(view, currentDate);
    } catch (err) {
      console.error('iCal hinzufügen Fehler:', err);
    } finally {
      setAddLoading(false);
    }
  };

  const handleIcalDelete = async (id) => {
    if (!window.confirm('Diesen Kalender entfernen?')) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/kalender/ical-urls/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchIcalUrls();
      await fetchEvents(view, currentDate);
    } catch (err) {
      console.error('iCal löschen Fehler:', err);
    }
  };

  // ── Grouped events ──────────────────────────────────────────────────────────

  const byDay = groupByDay(events);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="kz-wrap">
      {/* Header */}
      <div className="kz-header">
        <div className="kz-nav-group">
          <button className="kz-nav-btn" onClick={() => handleNav(-1)}>‹</button>
          <button className="kz-nav-btn today" onClick={handleToday}>Heute</button>
          <button className="kz-nav-btn" onClick={() => handleNav(1)}>›</button>
        </div>
        <div className="kz-period-label">
          {getPeriodLabel(view, currentDate)}
        </div>
        <div className="kz-view-btns">
          {VIEWS.map((label, idx) => (
            <button
              key={idx}
              className={`kz-view-btn${view === VIEW_KEYS[idx] ? ' active' : ''}`}
              onClick={() => setView(VIEW_KEYS[idx])}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="kz-settings-btn" onClick={() => setShowSettings(true)} title="Kalender-Einstellungen">
          ⚙️
        </button>
      </div>

      {/* Legende */}
      <div className="kz-legend">
        {Object.entries(TYP_LABELS).map(([typ, label]) => (
          <div key={typ} className="kz-legend-item">
            <span className="kz-legend-dot" style={{ background: TYP_FARBEN[typ] }} />
            {label}
          </div>
        ))}
      </div>

      {/* Kalender-Inhalt */}
      {loading ? (
        <div className="kz-loading">
          <div className="kz-spinner" />
          Termine werden geladen…
        </div>
      ) : (
        <>
          {view === 'monatlich' && (
            <MonthlyView
              date={currentDate}
              byDay={byDay}
              onEventClick={setSelectedEvent}
              onDayClick={handleDayClick}
              showAddBtn={!!externalDayClick}
            />
          )}
          {view === 'woechentlich' && (
            <WeeklyView
              date={currentDate}
              events={events}
              onEventClick={setSelectedEvent}
            />
          )}
          {view === 'taeglich' && (
            <DailyView
              date={currentDate}
              events={events}
              onEventClick={setSelectedEvent}
            />
          )}
          {(view === 'quartal' || view === 'halbjahr' || view === 'jaehrlich') && (
            <OverviewView
              view={view}
              date={currentDate}
              byDay={byDay}
              onDayClick={handleDayClick}
            />
          )}
        </>
      )}

      {/* Event-Detail-Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Settings-Modal */}
      {showSettings && (
        <SettingsModal
          icalUrls={icalUrls}
          onClose={() => setShowSettings(false)}
          onAdd={handleIcalAdd}
          onDelete={handleIcalDelete}
          addLoading={addLoading}
        />
      )}
    </div>
  );
}
