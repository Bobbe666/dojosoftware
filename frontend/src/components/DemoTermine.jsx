import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/DemoTermine.css';

// ─── Konstanten ───────────────────────────────────────────────────────────────
const WOCHENTAGE = [
  { id: 1, kurz: 'Mo', lang: 'Montag' },
  { id: 2, kurz: 'Di', lang: 'Dienstag' },
  { id: 3, kurz: 'Mi', lang: 'Mittwoch' },
  { id: 4, kurz: 'Do', lang: 'Donnerstag' },
  { id: 5, kurz: 'Fr', lang: 'Freitag' },
  { id: 6, kurz: 'Sa', lang: 'Samstag' },
  { id: 0, kurz: 'So', lang: 'Sonntag' },
];

const STATUS_LABELS = { ausstehend: 'Ausstehend', bestaetigt: 'Bestätigt', abgesagt: 'Abgesagt' };
const STATUS_COLORS = { ausstehend: '#f59e0b', bestaetigt: '#22c55e', abgesagt: '#ef4444' };

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Nächsten Wochentag (0=So…6=Sa) ab einem Datum berechnen
function naechsterWochentag(vonDatum, wochentag) {
  const d = new Date(vonDatum);
  d.setHours(0, 0, 0, 0);
  const diff = (wochentag - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff)); // gleicher Tag → nächste Woche
  return d;
}

// Alle Vorkommen eines Wochentags innerhalb eines Datums-Bereichs
function alleVorkommenInRange(wochentag, startDate, endDate) {
  const result = [];
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  const diff = (wochentag - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  while (d <= endDate) {
    result.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return result;
}

const CURRENT_YEAR = new Date().getFullYear();

// ISO-Kalenderwoche berechnen
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// '2026-W15' → { monday, sunday }
function parseWeekStr(weekStr) {
  if (!weekStr) return null;
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr), week = parseInt(weekPart);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function DemoTermine() {
  const { token } = useAuth();
  const authHeader = { Authorization: `Bearer ${token}` };

  const [view, setView] = useState('slots');
  const [slots, setSlots] = useState([]);
  const [buchungen, setBuchungen] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // ── iCal Feed ────────────────────────────────────────────────────────────
  const [icalFeedUrl, setIcalFeedUrl] = useState('');

  // ── Kalender-Ansicht ──────────────────────────────────────────────────────
  const [calView, setCalView] = useState('liste'); // 'liste' | 'monat'
  const [calMonth, setCalMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [calSelectedDay, setCalSelectedDay] = useState(null); // 'YYYY-MM-DD' | null

  // Welches Formular ist offen: null | 'einzeln' | 'wochenplan'
  const [openForm, setOpenForm] = useState(null);

  // ── Einzelner Slot ────────────────────────────────────────────────────────
  const [slotForm, setSlotForm] = useState({ slot_start: '', duration_minutes: '60', notes: '' });
  const [slotSaving, setSlotSaving] = useState(false);
  const [conflictCheck, setConflictCheck] = useState(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  // ── Wochenplan ────────────────────────────────────────────────────────────
  // selectedDays: { [wochentag_id]: Set<'HH:MM'> }
  const [selectedDays, setSelectedDays] = useState({});
  const [wochenplanDur, setWochenplanDur] = useState('60');
  const [wochenplanWochen, setWochenplanWochen] = useState('8');
  const [wochenplanSaving, setWochenplanSaving] = useState(false);
  const [neueUhrzeitInputs, setNeueUhrzeitInputs] = useState({}); // pro Tag ein Input-Value

  // ── Wochenplan: Zeitraum-Modus ────────────────────────────────────────────
  const [zeitraumMode, setZeitraumMode] = useState('woche');
  const [zeitraumTag, setZeitraumTag] = useState(new Date().toISOString().slice(0, 10));
  const [zeitraumWoche, setZeitraumWoche] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, '0')}`;
  });
  const [zeitraumMonatJahr, setZeitraumMonatJahr] = useState(CURRENT_YEAR);
  const [zeitraumMonat, setZeitraumMonat] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [zeitraumQuartal, setZeitraumQuartal] = useState({
    q: Math.ceil((new Date().getMonth() + 1) / 3),
    year: new Date().getFullYear(),
  });
  const [zeitraumJahr, setZeitraumJahr] = useState(new Date().getFullYear());

  // ── Buchungs-Detail ───────────────────────────────────────────────────────
  const [selectedBuchung, setSelectedBuchung] = useState(null);
  const [buchungNotiz, setBuchungNotiz] = useState('');
  const [buchungSaving, setBuchungSaving] = useState(false);

  const bookingUrl = `${window.location.origin}/demo-buchen`;

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  // ── Zeitraum berechnen ────────────────────────────────────────────────────
  const getZeitraumRange = () => {
    switch (zeitraumMode) {
      case 'tag': {
        if (!zeitraumTag) return null;
        return { start: new Date(zeitraumTag + 'T00:00:00'), end: new Date(zeitraumTag + 'T23:59:59') };
      }
      case 'woche': {
        const parsed = parseWeekStr(zeitraumWoche);
        if (!parsed) return null;
        return { start: parsed.monday, end: parsed.sunday };
      }
      case 'monat': {
        const [y, m] = zeitraumMonat.split('-').map(Number);
        return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
      }
      case 'quartal': {
        const { q, year } = zeitraumQuartal;
        const sm = (q - 1) * 3;
        return { start: new Date(year, sm, 1), end: new Date(year, sm + 3, 0, 23, 59, 59) };
      }
      case 'jahr':
        return { start: new Date(zeitraumJahr, 0, 1), end: new Date(zeitraumJahr, 11, 31, 23, 59, 59) };
      default: return null;
    }
  };

  // Woche als lesbaren String formatieren
  const formatWoche = (weekStr) => {
    const parsed = parseWeekStr(weekStr);
    if (!parsed) return '';
    const { monday, sunday } = parsed;
    const fmt = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    return `KW ${parseInt(weekStr.split('-W')[1])} · ${fmt(monday)} – ${fmt(sunday)} ${sunday.getFullYear()}`;
  };

  // 12 Monate für ein Jahr als Chips
  const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const getMonthChips = (year) => MONTH_LABELS.map((label, i) => ({
    value: `${year}-${String(i + 1).padStart(2, '0')}`,
    label,
  }));

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/demo-termine/admin/slots', { headers: authHeader });
      setSlots(r.data.slots || []);
    } catch { showMsg('error', 'Fehler beim Laden der Slots'); }
    finally { setLoading(false); }
  }, [token]);

  const loadBuchungen = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/demo-termine/admin/buchungen', { headers: authHeader });
      setBuchungen(r.data.buchungen || []);
    } catch { showMsg('error', 'Fehler beim Laden der Buchungen'); }
    finally { setLoading(false); }
  }, [token]);

  const loadStats = useCallback(async () => {
    try {
      const r = await axios.get('/demo-termine/admin/stats', { headers: authHeader });
      setStats(r.data.stats);
    } catch {}
  }, [token]);

  useEffect(() => { loadSlots(); loadStats(); }, [loadSlots, loadStats]);
  useEffect(() => { if (view === 'buchungen') loadBuchungen(); }, [view, loadBuchungen]);

  // iCal-Feed-URL laden
  useEffect(() => {
    axios.get('/demo-termine/admin/ical-token', { headers: authHeader })
      .then(r => { if (r.data.feedUrl) setIcalFeedUrl(r.data.feedUrl); })
      .catch(() => {});
  }, [token]);

  // iCloud Konflikt-Check für Einzelslot
  useEffect(() => {
    if (!slotForm.slot_start) { setConflictCheck(null); return; }
    const timer = setTimeout(async () => {
      setCheckingConflict(true);
      try {
        const start = new Date(slotForm.slot_start);
        const end   = new Date(start.getTime() + parseInt(slotForm.duration_minutes || 60) * 60000);
        const r = await axios.post('/admin/calendar/check-conflict',
          { start: start.toISOString(), end: end.toISOString() },
          { headers: authHeader }
        );
        setConflictCheck(r.data.conflicts || []);
      } catch { setConflictCheck(null); }
      finally { setCheckingConflict(false); }
    }, 600);
    return () => clearTimeout(timer);
  }, [slotForm.slot_start, slotForm.duration_minutes]);

  // ── Wochenplan: Tag an/abwählen ───────────────────────────────────────────
  const toggleDay = (dayId) => {
    setSelectedDays(prev => {
      const next = { ...prev };
      if (next[dayId]) {
        delete next[dayId];
      } else {
        next[dayId] = new Set();
      }
      return next;
    });
  };

  // ── Wochenplan: Uhrzeit zu einem Tag hinzufügen ───────────────────────────
  const addTimeVal = (dayId, val) => {
    if (!val || !/^\d{2}:\d{2}$/.test(val)) return;
    setSelectedDays(prev => {
      const next = { ...prev };
      next[dayId] = new Set([...(next[dayId] || []), val]);
      return next;
    });
  };

  const addTime = (dayId) => {
    const val = (neueUhrzeitInputs[dayId] || '').trim();
    addTimeVal(dayId, val);
    setNeueUhrzeitInputs(prev => ({ ...prev, [dayId]: '' }));
  };

  const removeTime = (dayId, time) => {
    setSelectedDays(prev => {
      const next = { ...prev };
      const set = new Set(next[dayId]);
      set.delete(time);
      next[dayId] = set;
      return next;
    });
  };

  // ── Wochenplan-Vorschau: wie viele Slots werden erstellt? ─────────────────
  const wochenplanPreview = () => {
    const range = getZeitraumRange();
    if (!range) return 0;
    let count = 0;
    Object.entries(selectedDays).forEach(([dayId, times]) => {
      count += alleVorkommenInRange(parseInt(dayId), range.start, range.end).length * times.size;
    });
    return count;
  };

  // ── Wochenplan anlegen ────────────────────────────────────────────────────
  const handleWochenplanCreate = async (e) => {
    e.preventDefault();
    const range = getZeitraumRange();
    if (!range) { showMsg('error', 'Bitte einen gültigen Zeitraum auswählen.'); return; }
    const preview = wochenplanPreview();
    if (preview === 0) { showMsg('error', 'Wähle mindestens einen Wochentag mit einer Uhrzeit.'); return; }

    setWochenplanSaving(true);
    const slotsToCreate = [];
    const dur = parseInt(wochenplanDur);

    Object.entries(selectedDays).forEach(([dayId, times]) => {
      const vorkommen = alleVorkommenInRange(parseInt(dayId), range.start, range.end);
      vorkommen.forEach(datum => {
        [...times].forEach(time => {
          const [h, m] = time.split(':').map(Number);
          const start = new Date(datum);
          start.setHours(h, m, 0, 0);
          slotsToCreate.push({ slot_start: start.toISOString(), duration_minutes: dur });
        });
      });
    });

    // Zeitlich sortieren
    slotsToCreate.sort((a, b) => new Date(a.slot_start) - new Date(b.slot_start));

    try {
      const r = await axios.post('/demo-termine/admin/slots/bulk', { slots: slotsToCreate }, { headers: authHeader });
      showMsg('success', `${r.data.created} Slots angelegt${r.data.skipped > 0 ? `, ${r.data.skipped} übersprungen (Überschneidung)` : ''}`);
      setOpenForm(null);
      setSelectedDays({});
      loadSlots(); loadStats();
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Fehler');
    } finally {
      setWochenplanSaving(false);
    }
  };

  // ── Einzelslot anlegen ────────────────────────────────────────────────────
  const handleCreateSlot = async (e) => {
    e.preventDefault();
    setSlotSaving(true);
    try {
      await axios.post('/demo-termine/admin/slots', {
        slot_start: new Date(slotForm.slot_start).toISOString(),
        duration_minutes: parseInt(slotForm.duration_minutes),
        notes: slotForm.notes || null
      }, { headers: authHeader });
      showMsg('success', 'Slot angelegt!');
      setOpenForm(null);
      setSlotForm({ slot_start: '', duration_minutes: '60', notes: '' });
      loadSlots(); loadStats();
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Fehler');
    } finally {
      setSlotSaving(false);
    }
  };

  // ── Slot freigeben/sperren ────────────────────────────────────────────────
  const toggleSlot = async (slot) => {
    try {
      await axios.put(`/demo-termine/admin/slots/${slot.id}`,
        { is_available: slot.is_available ? 0 : 1 },
        { headers: authHeader }
      );
      loadSlots(); loadStats();
    } catch (e) { showMsg('error', e.response?.data?.error || 'Fehler'); }
  };

  // ── Slot löschen ──────────────────────────────────────────────────────────
  const deleteSlot = async (id) => {
    if (!window.confirm('Slot wirklich löschen?')) return;
    try {
      await axios.delete(`/demo-termine/admin/slots/${id}`, { headers: authHeader });
      showMsg('success', 'Slot gelöscht');
      loadSlots(); loadStats();
    } catch (e) { showMsg('error', e.response?.data?.error || 'Fehler'); }
  };

  // ── Kalender-Hilfsfunktionen ──────────────────────────────────────────────
  const calMonthLabel = () => {
    const d = new Date(calMonth.year, calMonth.month, 1);
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  const prevCalMonth = () => setCalMonth(m => {
    const month = m.month === 0 ? 11 : m.month - 1;
    const year  = m.month === 0 ? m.year - 1 : m.year;
    return { year, month };
  });

  const nextCalMonth = () => setCalMonth(m => {
    const month = m.month === 11 ? 0 : m.month + 1;
    const year  = m.month === 11 ? m.year + 1 : m.year;
    return { year, month };
  });

  // Slot-Map: 'YYYY-MM-DD' → { free, booked }
  const slotsByDay = (() => {
    const map = {};
    slots.forEach(s => {
      const d = new Date(s.slot_start);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!map[key]) map[key] = { free: 0, booked: 0 };
      if (s.is_booked) map[key].booked++; else if (s.is_available) map[key].free++;
    });
    return map;
  })();

  // Wochen-Arrays für den Kalender-Monat bauen (Mo–So, ISO)
  const buildCalendarWeeks = () => {
    const firstDay = new Date(calMonth.year, calMonth.month, 1);
    const lastDay  = new Date(calMonth.year, calMonth.month + 1, 0);
    // Erster Montag der Anzeige
    const startMon = new Date(firstDay);
    const dow = (firstDay.getDay() + 6) % 7; // 0=Mo
    startMon.setDate(firstDay.getDate() - dow);

    const weeks = [];
    const cur = new Date(startMon);
    while (cur <= lastDay || cur.getDay() !== 1) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
      if (cur > lastDay && weeks.length >= 4) break;
    }
    return weeks;
  };

  // ── Buchung aktualisieren ─────────────────────────────────────────────────
  const updateBuchung = async (id, updates) => {
    setBuchungSaving(true);
    try {
      await axios.put(`/demo-termine/admin/buchungen/${id}`, updates, { headers: authHeader });
      showMsg('success', 'Gespeichert');
      setBuchungen(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      if (selectedBuchung?.id === id) setSelectedBuchung(prev => ({ ...prev, ...updates }));
      loadStats();
    } catch (e) { showMsg('error', e.response?.data?.error || 'Fehler'); }
    finally { setBuchungSaving(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="dt-wrapper">

      {/* ── Kompakter Top-Bereich ── */}
      <div className="dt-topbar">
        <div className="dt-links-row">
          <div className="dt-link-chip">
            <span className="dt-link-lbl">🔗 Buchungs-Link</span>
            <code className="dt-link-url">{bookingUrl}</code>
            <button className="dt-btn dt-btn-xs" onClick={() => { navigator.clipboard.writeText(bookingUrl); showMsg('success', 'Link kopiert!'); }}>Kopieren</button>
          </div>
          {icalFeedUrl && (
            <div className="dt-link-chip">
              <span className="dt-link-lbl">📅 iCal-Abo</span>
              <code className="dt-link-url dt-link-ical">{icalFeedUrl}</code>
              <button className="dt-btn dt-btn-xs" onClick={() => { navigator.clipboard.writeText(icalFeedUrl); showMsg('success', 'iCal-URL kopiert!'); }}>Kopieren</button>
            </div>
          )}
        </div>

        <div className="dt-toolbar">
          <div className="dt-toolbar-left">
            <button className={`dt-btn dt-btn-primary dt-btn-sm ${openForm === 'wochenplan' ? 'dt-btn-active-border' : ''}`}
              onClick={() => setOpenForm(openForm === 'wochenplan' ? null : 'wochenplan')}>🗓 Wochenplan</button>
            <button className={`dt-btn dt-btn-sm ${openForm === 'einzeln' ? 'dt-btn-active-border' : ''}`}
              onClick={() => setOpenForm(openForm === 'einzeln' ? null : 'einzeln')}>+ Einzelner Termin</button>
          </div>
          <div className="dt-toolbar-sep" />
          {stats && (
            <div className="dt-stat-cards">
              <div className="dt-stat-mini" style={{'--c':'#6366f1'}}>
                <span className="dt-stat-mini-num">{stats.freie_slots}</span>
                <span className="dt-stat-mini-lbl">Freie Slots</span>
              </div>
              <div className="dt-stat-mini" style={{'--c':'#f59e0b'}}>
                <span className="dt-stat-mini-num">{stats.offene_buchungen}</span>
                <span className="dt-stat-mini-lbl">Offen</span>
              </div>
              <div className="dt-stat-mini" style={{'--c':'#6366f1'}}>
                <span className="dt-stat-mini-num">{stats.gesamt_buchungen}</span>
                <span className="dt-stat-mini-lbl">Buchungen</span>
              </div>
              <div className="dt-stat-mini" style={{'--c':'#475569'}}>
                <span className="dt-stat-mini-num">{stats.gesamt_slots}</span>
                <span className="dt-stat-mini-lbl">Slots gesamt</span>
              </div>
            </div>
          )}
          <div className="dt-toolbar-sep" />
          <div className="dt-toolbar-right">
            <button className={`dt-tab-pill ${view === 'slots' ? 'active' : ''}`} onClick={() => setView('slots')}>Zeitfenster</button>
            <button className={`dt-tab-pill ${view === 'buchungen' ? 'active' : ''}`} onClick={() => setView('buchungen')}>
              Buchungen{stats?.offene_buchungen > 0 && <span className="dt-badge">{stats.offene_buchungen}</span>}
            </button>
            <span className="dt-toolbar-divider" />
            <button className={`dt-view-btn ${calView === 'liste' ? 'active' : ''}`} onClick={() => { setCalView('liste'); setCalSelectedDay(null); }}>☰ Liste</button>
            <button className={`dt-view-btn ${calView === 'monat' ? 'active' : ''}`} onClick={() => setCalView('monat')}>📅 Monat</button>
          </div>
        </div>
      </div>

      {msg.text && <div className={`dt-alert dt-alert-${msg.type}`}>{msg.text}</div>}

      {/* ══════════════ SLOTS VIEW ══════════════ */}
      {view === 'slots' && (
        <div className="dt-section">

          {/* ── WOCHENPLAN WIZARD ── */}
          {openForm === 'wochenplan' && (
            <form className="dt-form dt-form-wide" onSubmit={handleWochenplanCreate}>
              <h3 className="dt-form-title">Wochenplan — wiederkehrende Termine anlegen</h3>
              <p className="dt-form-hint">
                Wähle Wochentage und trage die Uhrzeiten ein. Die Slots werden für die gewählte Anzahl an Wochen automatisch erstellt.
              </p>

              {/* Wochentag-Auswahl */}
              <div className="dt-weekday-row">
                {WOCHENTAGE.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`dt-weekday-btn ${selectedDays[tag.id] ? 'selected' : ''}`}
                    onClick={() => toggleDay(tag.id)}
                  >
                    <span className="dt-weekday-kurz">{tag.kurz}</span>
                    <span className="dt-weekday-lang">{tag.lang}</span>
                    {selectedDays[tag.id] && selectedDays[tag.id].size > 0 && (
                      <span className="dt-weekday-count">{selectedDays[tag.id].size}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Uhrzeiten pro gewähltem Tag */}
              {Object.keys(selectedDays).length === 0 && (
                <div className="dt-weekday-hint">
                  Klicke auf einen oder mehrere Wochentage oben, um Uhrzeiten festzulegen.
                </div>
              )}

              {WOCHENTAGE.filter(tag => selectedDays[tag.id]).map(tag => (
                <div key={tag.id} className="dt-day-times">
                  <div className="dt-day-times-header">
                    <span className="dt-day-times-label">{tag.lang}</span>
                    {selectedDays[tag.id].size > 0 && (
                      <span className="dt-day-times-count">{selectedDays[tag.id].size} Uhrzeit{selectedDays[tag.id].size !== 1 ? 'en' : ''}</span>
                    )}
                  </div>

                  {/* Schnellauswahl */}
                  <div className="dt-quick-times">
                    <span className="dt-quick-label">Schnellauswahl:</span>
                    {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','14:15',
                      '15:00','16:00','17:00','18:00','19:00','20:00','21:00'].map(t => {
                      const active = selectedDays[tag.id]?.has(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`dt-quick-btn ${active ? 'active' : ''}`}
                          onClick={() => active ? removeTime(tag.id, t) : addTimeVal(tag.id, t)}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>

                  {/* Gewählte Uhrzeiten als Chips */}
                  {selectedDays[tag.id].size > 0 && (
                    <div className="dt-day-chips-row">
                      {[...selectedDays[tag.id]].sort().map(time => (
                        <span key={time} className="dt-time-chip">
                          {time}
                          <button type="button" className="dt-time-chip-remove" onClick={() => removeTime(tag.id, time)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Manuelle Uhrzeit */}
                  <div className="dt-time-manual">
                    <span className="dt-quick-label">Eigene Uhrzeit:</span>
                    <input
                      type="time"
                      value={neueUhrzeitInputs[tag.id] || ''}
                      onChange={e => setNeueUhrzeitInputs(prev => ({ ...prev, [tag.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTime(tag.id); } }}
                    />
                    <button type="button" className="dt-btn dt-btn-sm dt-btn-success" onClick={() => addTime(tag.id)}>
                      + Hinzufügen
                    </button>
                  </div>
                </div>
              ))}

              {/* Einstellungen */}
              <div className="dt-einstellungen-row">
                <div className="dt-form-group dt-form-group-sm">
                  <label>Dauer pro Termin</label>
                  <select value={wochenplanDur} onChange={e => setWochenplanDur(e.target.value)}>
                    <option value="30">30 Minuten</option>
                    <option value="45">45 Minuten</option>
                    <option value="60">60 Minuten</option>
                    <option value="90">90 Minuten</option>
                    <option value="120">2 Stunden</option>
                  </select>
                </div>

                {/* Zeitraum-Auswahl */}
                <div className="dt-zeitraum-wrapper">
                  <label className="dt-zeitraum-lbl">Zeitraum</label>
                  <div className="dt-zeitraum-tabs">
                    {[
                      { id: 'tag',     label: 'Tag' },
                      { id: 'woche',   label: 'Woche' },
                      { id: 'monat',   label: 'Monat' },
                      { id: 'quartal', label: 'Quartal' },
                      { id: 'jahr',    label: 'Jahr' },
                    ].map(m => (
                      <button key={m.id} type="button"
                        className={`dt-zeitraum-tab ${zeitraumMode === m.id ? 'active' : ''}`}
                        onClick={() => setZeitraumMode(m.id)}
                      >{m.label}</button>
                    ))}
                  </div>

                  <div className="dt-zeitraum-content">
                    {/* Tag: einzelner Datepicker */}
                    {zeitraumMode === 'tag' && (
                      <div className="dt-tag-picker">
                        <input type="date" value={zeitraumTag}
                          onChange={e => setZeitraumTag(e.target.value)} />
                        {zeitraumTag && (
                          <span className="dt-zeitraum-info">
                            {new Date(zeitraumTag + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Woche: KW-Picker */}
                    {zeitraumMode === 'woche' && (
                      <div className="dt-woche-picker">
                        <input type="week" value={zeitraumWoche}
                          onChange={e => setZeitraumWoche(e.target.value)} />
                        {zeitraumWoche && (
                          <span className="dt-zeitraum-info">{formatWoche(zeitraumWoche)}</span>
                        )}
                      </div>
                    )}

                    {/* Monat: Jahres-Tabs + alle 12 Monate */}
                    {zeitraumMode === 'monat' && (
                      <div className="dt-monat-picker">
                        <div className="dt-chips-row">
                          {[CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2].map(y => (
                            <button key={y} type="button"
                              className={`dt-quick-btn ${zeitraumMonatJahr === y ? 'active' : ''}`}
                              onClick={() => setZeitraumMonatJahr(y)}
                            >{y}</button>
                          ))}
                        </div>
                        <div className="dt-chips-row dt-monat-chips">
                          {getMonthChips(zeitraumMonatJahr).map(({ value, label }) => (
                            <button key={value} type="button"
                              className={`dt-quick-btn dt-monat-btn ${zeitraumMonat === value ? 'active' : ''}`}
                              onClick={() => setZeitraumMonat(value)}
                            >{label}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quartal */}
                    {zeitraumMode === 'quartal' && (
                      <div className="dt-quartal-picker">
                        <div className="dt-chips-row">
                          {[CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2].map(y => (
                            <button key={y} type="button"
                              className={`dt-quick-btn ${zeitraumQuartal.year === y ? 'active' : ''}`}
                              onClick={() => setZeitraumQuartal(q => ({ ...q, year: y }))}
                            >{y}</button>
                          ))}
                        </div>
                        <div className="dt-chips-row">
                          {[1, 2, 3, 4].map(q => (
                            <button key={q} type="button"
                              className={`dt-quick-btn dt-quartal-btn ${zeitraumQuartal.q === q ? 'active' : ''}`}
                              onClick={() => setZeitraumQuartal(prev => ({ ...prev, q }))}
                            >
                              Q{q} <span className="dt-quartal-hint">
                                {['Jan–Mär', 'Apr–Jun', 'Jul–Sep', 'Okt–Dez'][q - 1]}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Jahr */}
                    {zeitraumMode === 'jahr' && (
                      <div className="dt-chips-row">
                        {[CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2].map(y => (
                          <button key={y} type="button"
                            className={`dt-quick-btn dt-jahr-btn ${zeitraumJahr === y ? 'active' : ''}`}
                            onClick={() => setZeitraumJahr(y)}
                          >{y}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="dt-form-group dt-form-group-sm dt-preview-box">
                  <label>Vorschau</label>
                  <div className="dt-preview-count">{wochenplanPreview()} Slots</div>
                </div>
              </div>

              <div className="dt-form-actions">
                <button
                  type="submit"
                  className="dt-btn dt-btn-primary"
                  disabled={wochenplanSaving || wochenplanPreview() === 0}
                >
                  {wochenplanSaving ? 'Erstelle Slots...' : `${wochenplanPreview()} Slots anlegen`}
                </button>
                <button type="button" className="dt-btn" onClick={() => setOpenForm(null)}>Abbrechen</button>
              </div>
            </form>
          )}

          {/* ── EINZELNER SLOT ── */}
          {openForm === 'einzeln' && (
            <form className="dt-form" onSubmit={handleCreateSlot}>
              <h3 className="dt-form-title">Einzelnen Termin anlegen</h3>
              <div className="dt-form-row">
                <div className="dt-form-group">
                  <label>Datum & Uhrzeit *</label>
                  <input
                    type="datetime-local"
                    value={slotForm.slot_start}
                    onChange={e => setSlotForm(f => ({ ...f, slot_start: e.target.value }))}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                <div className="dt-form-group dt-form-group-sm">
                  <label>Dauer (Min)</label>
                  <select value={slotForm.duration_minutes} onChange={e => setSlotForm(f => ({ ...f, duration_minutes: e.target.value }))}>
                    <option value="30">30 Min</option>
                    <option value="45">45 Min</option>
                    <option value="60">60 Min</option>
                    <option value="90">90 Min</option>
                    <option value="120">120 Min</option>
                  </select>
                </div>
              </div>
              <div className="dt-form-group">
                <label>Notiz (intern)</label>
                <input
                  type="text"
                  value={slotForm.notes}
                  onChange={e => setSlotForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="z.B. Zoom-Link, Raum ..."
                />
              </div>
              {slotForm.slot_start && (
                <div className={`dt-conflict-check ${conflictCheck?.length > 0 ? 'dt-conflict-warn' : conflictCheck !== null ? 'dt-conflict-ok' : ''}`}>
                  {checkingConflict ? 'Prüfe iCloud-Kalender...' :
                    conflictCheck === null ? <span className="dt-muted">Kein iCloud-Kalender verbunden</span> :
                    conflictCheck.length === 0 ? 'Kein Konflikt im Kalender' :
                    `Achtung: Kalenderkonflikt mit "${conflictCheck[0].summary}"`}
                </div>
              )}
              <div className="dt-form-actions">
                <button type="submit" className="dt-btn dt-btn-primary" disabled={slotSaving}>
                  {slotSaving ? 'Speichere...' : 'Termin anlegen'}
                </button>
                <button type="button" className="dt-btn" onClick={() => setOpenForm(null)}>Abbrechen</button>
              </div>
            </form>
          )}

          {/* ── MONATS-KALENDER ── */}
          {calView === 'monat' && (
            <div className="dt-calendar">
              <div className="dt-cal-nav">
                <button className="dt-btn dt-btn-sm" onClick={prevCalMonth}>‹</button>
                <span className="dt-cal-month-label">{calMonthLabel()}</span>
                <button className="dt-btn dt-btn-sm" onClick={nextCalMonth}>›</button>
              </div>
              <div className="dt-cal-grid">
                {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
                  <div key={d} className="dt-cal-hdr">{d}</div>
                ))}
                {buildCalendarWeeks().map((week, wi) =>
                  week.map((day, di) => {
                    const key = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
                    const info = slotsByDay[key];
                    const isCurrentMonth = day.getMonth() === calMonth.month;
                    const isToday = key === new Date().toISOString().slice(0,10);
                    const isSelected = calSelectedDay === key;
                    return (
                      <div
                        key={`${wi}-${di}`}
                        className={`dt-cal-cell ${!isCurrentMonth ? 'dt-cal-other-month' : ''} ${isToday ? 'dt-cal-today' : ''} ${isSelected ? 'dt-cal-selected' : ''} ${info ? 'dt-cal-has-slots' : ''}`}
                        onClick={() => {
                          if (!isCurrentMonth || !info) return;
                          setCalSelectedDay(isSelected ? null : key);
                        }}
                      >
                        <span className="dt-cal-day-num">{day.getDate()}</span>
                        {info && (
                          <div className="dt-cal-dots">
                            {info.free > 0 && <span className="dt-cal-dot dt-cal-dot-free" title={`${info.free} frei`}>{info.free}</span>}
                            {info.booked > 0 && <span className="dt-cal-dot dt-cal-dot-booked" title={`${info.booked} gebucht`}>{info.booked}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {calSelectedDay && (
                <div className="dt-cal-day-detail">
                  <div className="dt-cal-day-detail-hdr">
                    {new Date(calSelectedDay + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    <button className="dt-btn dt-btn-sm" onClick={() => setCalSelectedDay(null)}>✕</button>
                  </div>
                  {slots.filter(s => {
                    const d = new Date(s.slot_start);
                    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    return k === calSelectedDay;
                  }).sort((a, b) => new Date(a.slot_start) - new Date(b.slot_start)).map(slot => (
                    <div key={slot.id} className={`dt-slot-card dt-slot-compact ${slot.is_booked ? 'dt-slot-booked' : slot.is_available ? 'dt-slot-free' : 'dt-slot-locked'}`}>
                      <div className="dt-slot-main">
                        <div className="dt-slot-time">{new Date(slot.slot_start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · {slot.duration_minutes} Min</div>
                        {slot.notes && <div className="dt-slot-note">{slot.notes}</div>}
                      </div>
                      <div className="dt-slot-status">
                        {slot.is_booked ? (
                          <span className="dt-pill dt-pill-booked">Gebucht — {slot.vorname} {slot.nachname}</span>
                        ) : slot.is_available ? (
                          <span className="dt-pill dt-pill-free">Frei</span>
                        ) : (
                          <span className="dt-pill dt-pill-locked">Gesperrt</span>
                        )}
                      </div>
                      <div className="dt-slot-actions">
                        {!slot.is_booked && (
                          <>
                            <button className={`dt-btn dt-btn-sm ${slot.is_available ? 'dt-btn-warn' : 'dt-btn-success'}`} onClick={() => toggleSlot(slot)}>
                              {slot.is_available ? 'Sperren' : 'Freigeben'}
                            </button>
                            <button className="dt-btn dt-btn-sm dt-btn-danger" onClick={() => deleteSlot(slot.id)}>Löschen</button>
                          </>
                        )}
                        {slot.is_booked && (
                          <button className="dt-btn dt-btn-sm" onClick={() => { setView('buchungen'); loadBuchungen(); }}>Buchung →</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SLOT-LISTE ── */}
          {calView === 'liste' && loading && <div className="dt-loading">Lade...</div>}
          {calView === 'liste' && !loading && slots.length === 0 && (
            <div className="dt-empty">
              <div className="dt-empty-icon">📅</div>
              <p>Noch keine Zeitfenster angelegt.</p>
              <p className="dt-muted">Nutze den Wochenplan, um mehrere Termine auf einen Schlag freizugeben.</p>
            </div>
          )}
          {calView === 'liste' && !loading && slots.length > 0 && (
            <div className="dt-slots-list">
              {slots.map(slot => (
                <div key={slot.id} className={`dt-slot-card ${slot.is_booked ? 'dt-slot-booked' : slot.is_available ? 'dt-slot-free' : 'dt-slot-locked'}`}>
                  <div className="dt-slot-main">
                    <div className="dt-slot-time">{fmt(slot.slot_start)}</div>
                    <div className="dt-slot-meta">
                      <span className="dt-slot-dur">{slot.duration_minutes} Min</span>
                      {slot.notes && <span className="dt-slot-note">{slot.notes}</span>}
                    </div>
                  </div>
                  <div className="dt-slot-status">
                    {slot.is_booked ? (
                      <span className="dt-pill dt-pill-booked">Gebucht — {slot.vorname} {slot.nachname}</span>
                    ) : slot.is_available ? (
                      <span className="dt-pill dt-pill-free">Frei</span>
                    ) : (
                      <span className="dt-pill dt-pill-locked">Gesperrt</span>
                    )}
                  </div>
                  <div className="dt-slot-actions">
                    {!slot.is_booked && (
                      <>
                        <button
                          className={`dt-btn dt-btn-sm ${slot.is_available ? 'dt-btn-warn' : 'dt-btn-success'}`}
                          onClick={() => toggleSlot(slot)}
                        >
                          {slot.is_available ? 'Sperren' : 'Freigeben'}
                        </button>
                        <button className="dt-btn dt-btn-sm dt-btn-danger" onClick={() => deleteSlot(slot.id)}>
                          Löschen
                        </button>
                      </>
                    )}
                    {slot.is_booked && (
                      <button className="dt-btn dt-btn-sm" onClick={() => { setView('buchungen'); loadBuchungen(); }}>
                        Buchung →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ BUCHUNGEN VIEW ══════════════ */}
      {view === 'buchungen' && (
        <div className="dt-section">
          {loading && <div className="dt-loading">Lade...</div>}
          {!loading && buchungen.length === 0 && (
            <div className="dt-empty">
              <div className="dt-empty-icon">📋</div>
              <p>Noch keine Buchungen eingegangen.</p>
            </div>
          )}
          {!loading && buchungen.length > 0 && (
            <div className="dt-buchungen-layout">
              <div className="dt-buchungen-list">
                {buchungen.map(b => (
                  <div
                    key={b.id}
                    className={`dt-buchung-item ${selectedBuchung?.id === b.id ? 'active' : ''}`}
                    onClick={() => { setSelectedBuchung(b); setBuchungNotiz(b.admin_notiz || ''); }}
                  >
                    <div className="dt-buchung-name">{b.vorname} {b.nachname}</div>
                    <div className="dt-buchung-verein">{b.vereinsname || b.email}</div>
                    <div className="dt-buchung-time">{fmt(b.slot_start)}</div>
                    <span className="dt-pill" style={{ backgroundColor: STATUS_COLORS[b.status] + '33', color: STATUS_COLORS[b.status] }}>
                      {STATUS_LABELS[b.status]}
                    </span>
                  </div>
                ))}
              </div>

              {selectedBuchung && (
                <div className="dt-buchung-detail">
                  <h3 className="dt-detail-name">{selectedBuchung.vorname} {selectedBuchung.nachname}</h3>
                  <div className="dt-detail-grid">
                    <div className="dt-detail-row"><span>Termin</span><strong>{fmt(selectedBuchung.slot_start)}</strong></div>
                    <div className="dt-detail-row"><span>Dauer</span><strong>{selectedBuchung.duration_minutes} Minuten</strong></div>
                    <div className="dt-detail-row"><span>E-Mail</span><a href={`mailto:${selectedBuchung.email}`}>{selectedBuchung.email}</a></div>
                    {selectedBuchung.telefon && <div className="dt-detail-row"><span>Telefon</span><a href={`tel:${selectedBuchung.telefon}`}>{selectedBuchung.telefon}</a></div>}
                    {selectedBuchung.vereinsname && <div className="dt-detail-row"><span>Verein/Schule</span><strong>{selectedBuchung.vereinsname}</strong></div>}
                    {selectedBuchung.bundesland && <div className="dt-detail-row"><span>Bundesland</span><strong>{selectedBuchung.bundesland}</strong></div>}
                    {selectedBuchung.mitglieder_anzahl && <div className="dt-detail-row"><span>Mitglieder ca.</span><strong>{selectedBuchung.mitglieder_anzahl}</strong></div>}
                    {selectedBuchung.nachricht && (
                      <div className="dt-detail-row dt-detail-full">
                        <span>Nachricht</span>
                        <p className="dt-detail-msg">{selectedBuchung.nachricht}</p>
                      </div>
                    )}
                  </div>
                  <div className="dt-detail-status-row">
                    <span>Status:</span>
                    <div className="dt-status-btns">
                      {['ausstehend', 'bestaetigt', 'abgesagt'].map(s => (
                        <button
                          key={s}
                          className={`dt-btn dt-btn-sm ${selectedBuchung.status === s ? 'dt-btn-active' : ''}`}
                          style={selectedBuchung.status === s ? { backgroundColor: STATUS_COLORS[s], color: '#fff', border: 'none' } : {}}
                          onClick={() => updateBuchung(selectedBuchung.id, { status: s })}
                          disabled={buchungSaving}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="dt-detail-notiz">
                    <label>Interne Notiz</label>
                    <textarea
                      value={buchungNotiz}
                      onChange={e => setBuchungNotiz(e.target.value)}
                      rows={3}
                      placeholder="Nur für Admins sichtbar..."
                    />
                    <button
                      className="dt-btn dt-btn-sm dt-btn-primary"
                      onClick={() => updateBuchung(selectedBuchung.id, { admin_notiz: buchungNotiz })}
                      disabled={buchungSaving}
                    >
                      {buchungSaving ? 'Speichere...' : 'Notiz speichern'}
                    </button>
                  </div>
                  <div className="dt-detail-buchdat">
                    Buchung eingegangen: {fmt(selectedBuchung.buchung_created_at || selectedBuchung.created_at)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
