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

// Alle Vorkommen eines Wochentags in einem Zeitraum
function alleVorkommen(wochentag, wochen, startDatum) {
  const result = [];
  let d = naechsterWochentag(startDatum || new Date(), wochentag);
  for (let i = 0; i < wochen; i++) {
    result.push(new Date(d));
    d = new Date(d);
    d.setDate(d.getDate() + 7);
  }
  return result;
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

  // ── Buchungs-Detail ───────────────────────────────────────────────────────
  const [selectedBuchung, setSelectedBuchung] = useState(null);
  const [buchungNotiz, setBuchungNotiz] = useState('');
  const [buchungSaving, setBuchungSaving] = useState(false);

  const bookingUrl = `${window.location.origin}/demo-buchen`;

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

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
    let count = 0;
    Object.entries(selectedDays).forEach(([dayId, times]) => {
      count += alleVorkommen(parseInt(dayId), parseInt(wochenplanWochen)).length * times.size;
    });
    return count;
  };

  // ── Wochenplan anlegen ────────────────────────────────────────────────────
  const handleWochenplanCreate = async (e) => {
    e.preventDefault();
    const preview = wochenplanPreview();
    if (preview === 0) { showMsg('error', 'Wähle mindestens einen Wochentag mit einer Uhrzeit.'); return; }

    setWochenplanSaving(true);
    const slotsToCreate = [];
    const dur = parseInt(wochenplanDur);
    const wochen = parseInt(wochenplanWochen);

    Object.entries(selectedDays).forEach(([dayId, times]) => {
      const vorkommen = alleVorkommen(parseInt(dayId), wochen);
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

      {/* Header */}
      <div className="dt-header">
        <div className="dt-header-left">
          <h2 className="dt-title">Demo-Termine</h2>
          <p className="dt-subtitle">Zeitfenster freigeben und Interessenten-Buchungen verwalten</p>
        </div>
        <div className="dt-header-right">
          <div className="dt-booking-link">
            <span className="dt-booking-label">Buchungs-Link</span>
            <code className="dt-booking-url">{bookingUrl}</code>
            <button className="dt-btn dt-btn-sm" onClick={() => { navigator.clipboard.writeText(bookingUrl); showMsg('success', 'Link kopiert!'); }}>
              Kopieren
            </button>
          </div>
        </div>
      </div>

      {msg.text && <div className={`dt-alert dt-alert-${msg.type}`}>{msg.text}</div>}

      {/* Stats */}
      {stats && (
        <div className="dt-stats">
          <div className="dt-stat-card">
            <div className="dt-stat-num">{stats.freie_slots}</div>
            <div className="dt-stat-label">Freie Slots</div>
          </div>
          <div className="dt-stat-card">
            <div className="dt-stat-num dt-stat-orange">{stats.offene_buchungen}</div>
            <div className="dt-stat-label">Offene Buchungen</div>
          </div>
          <div className="dt-stat-card">
            <div className="dt-stat-num">{stats.gesamt_buchungen}</div>
            <div className="dt-stat-label">Buchungen gesamt</div>
          </div>
          <div className="dt-stat-card">
            <div className="dt-stat-num dt-stat-muted">{stats.gesamt_slots}</div>
            <div className="dt-stat-label">Slots gesamt</div>
          </div>
        </div>
      )}

      {/* View-Tabs */}
      <div className="dt-tabs">
        <button className={`dt-tab ${view === 'slots' ? 'active' : ''}`} onClick={() => setView('slots')}>
          Zeitfenster
        </button>
        <button className={`dt-tab ${view === 'buchungen' ? 'active' : ''}`} onClick={() => setView('buchungen')}>
          Buchungen
          {stats?.offene_buchungen > 0 && <span className="dt-badge">{stats.offene_buchungen}</span>}
        </button>
      </div>

      {/* ══════════════ SLOTS VIEW ══════════════ */}
      {view === 'slots' && (
        <div className="dt-section">

          {/* Aktions-Buttons */}
          <div className="dt-section-actions">
            <button
              className={`dt-btn dt-btn-primary ${openForm === 'wochenplan' ? 'dt-btn-active-border' : ''}`}
              onClick={() => setOpenForm(openForm === 'wochenplan' ? null : 'wochenplan')}
            >
              🗓 Wochenplan anlegen
            </button>
            <button
              className={`dt-btn ${openForm === 'einzeln' ? 'dt-btn-active-border' : ''}`}
              onClick={() => setOpenForm(openForm === 'einzeln' ? null : 'einzeln')}
            >
              + Einzelner Termin
            </button>
          </div>

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
              <div className="dt-form-row" style={{ marginTop: '1.25rem' }}>
                <div className="dt-form-group dt-form-group-sm">
                  <label>Dauer pro Termin (Min)</label>
                  <select value={wochenplanDur} onChange={e => setWochenplanDur(e.target.value)}>
                    <option value="30">30 Minuten</option>
                    <option value="45">45 Minuten</option>
                    <option value="60">60 Minuten</option>
                    <option value="90">90 Minuten</option>
                    <option value="120">2 Stunden</option>
                  </select>
                </div>
                <div className="dt-form-group dt-form-group-sm">
                  <label>Für wie viele Wochen?</label>
                  <select value={wochenplanWochen} onChange={e => setWochenplanWochen(e.target.value)}>
                    <option value="2">2 Wochen</option>
                    <option value="4">4 Wochen</option>
                    <option value="6">6 Wochen</option>
                    <option value="8">8 Wochen</option>
                    <option value="12">12 Wochen</option>
                    <option value="16">16 Wochen</option>
                  </select>
                </div>
                <div className="dt-form-group dt-form-group-sm dt-preview-box">
                  <label>Vorschau</label>
                  <div className="dt-preview-count">
                    {wochenplanPreview()} Slots
                  </div>
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

          {/* ── SLOT-LISTE ── */}
          {loading && <div className="dt-loading">Lade...</div>}
          {!loading && slots.length === 0 && (
            <div className="dt-empty">
              <div className="dt-empty-icon">📅</div>
              <p>Noch keine Zeitfenster angelegt.</p>
              <p className="dt-muted">Nutze den Wochenplan, um mehrere Termine auf einen Schlag freizugeben.</p>
            </div>
          )}
          {!loading && slots.length > 0 && (
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
