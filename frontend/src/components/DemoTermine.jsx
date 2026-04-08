import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/DemoTermine.css';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(dt) {
  if (!dt) return '';
  return new Date(dt).toISOString().slice(0, 16); // für datetime-local input
}

const STATUS_LABELS = { ausstehend: 'Ausstehend', bestaetigt: 'Bestätigt', abgesagt: 'Abgesagt' };
const STATUS_COLORS = { ausstehend: '#f59e0b', bestaetigt: '#22c55e', abgesagt: '#ef4444' };

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function DemoTermine() {
  const { token } = useAuth();
  const authHeader = { Authorization: `Bearer ${token}` };

  const [view, setView] = useState('slots'); // 'slots' | 'buchungen'
  const [slots, setSlots] = useState([]);
  const [buchungen, setBuchungen] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Slot-Formular
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({ slot_start: '', duration_minutes: '60', notes: '' });
  const [slotSaving, setSlotSaving] = useState(false);

  // Bulk-Slot Wizard
  const [showBulk, setShowBulk] = useState(false);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkTimes, setBulkTimes] = useState('09:00\n10:30\n14:00\n15:30');
  const [bulkDur, setBulkDur] = useState('60');
  const [bulkSaving, setBulkSaving] = useState(false);

  // iCloud Konflikt-Check
  const [conflictCheck, setConflictCheck] = useState(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  // Buchungs-Detail
  const [selectedBuchung, setSelectedBuchung] = useState(null);
  const [buchungNotiz, setBuchungNotiz] = useState('');
  const [buchungSaving, setBuchungSaving] = useState(false);

  // Buchungs-Link
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
    } catch (e) {
      showMsg('error', 'Fehler beim Laden der Slots');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadBuchungen = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/demo-termine/admin/buchungen', { headers: authHeader });
      setBuchungen(r.data.buchungen || []);
    } catch (e) {
      showMsg('error', 'Fehler beim Laden der Buchungen');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadStats = useCallback(async () => {
    try {
      const r = await axios.get('/demo-termine/admin/stats', { headers: authHeader });
      setStats(r.data.stats);
    } catch {}
  }, [token]);

  useEffect(() => {
    loadSlots();
    loadStats();
  }, [loadSlots, loadStats]);

  useEffect(() => {
    if (view === 'buchungen') loadBuchungen();
  }, [view, loadBuchungen]);

  // iCloud Konflikt-Check beim Tippen
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

  // ── Slot anlegen ──────────────────────────────────────────────────────────
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
      setShowSlotForm(false);
      setSlotForm({ slot_start: '', duration_minutes: '60', notes: '' });
      loadSlots(); loadStats();
    } catch (e) {
      const err = e.response?.data?.error || 'Fehler';
      showMsg('error', err);
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
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Fehler');
    }
  };

  // ── Slot löschen ──────────────────────────────────────────────────────────
  const deleteSlot = async (id) => {
    if (!window.confirm('Slot wirklich löschen?')) return;
    try {
      await axios.delete(`/demo-termine/admin/slots/${id}`, { headers: authHeader });
      showMsg('success', 'Slot gelöscht');
      loadSlots(); loadStats();
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Fehler');
    }
  };

  // ── Bulk Slots ────────────────────────────────────────────────────────────
  const handleBulkCreate = async (e) => {
    e.preventDefault();
    setBulkSaving(true);
    const times = bulkTimes.split('\n').map(t => t.trim()).filter(Boolean);
    const slotsToCreate = times.map(t => ({
      slot_start: `${bulkDate}T${t}:00`,
      duration_minutes: parseInt(bulkDur)
    }));
    try {
      const r = await axios.post('/demo-termine/admin/slots/bulk', { slots: slotsToCreate }, { headers: authHeader });
      showMsg('success', `${r.data.created} Slots angelegt, ${r.data.skipped} übersprungen`);
      setShowBulk(false);
      loadSlots(); loadStats();
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Fehler');
    } finally {
      setBulkSaving(false);
    }
  };

  // ── Buchungsstatus ändern ─────────────────────────────────────────────────
  const updateBuchung = async (id, updates) => {
    setBuchungSaving(true);
    try {
      await axios.put(`/demo-termine/admin/buchungen/${id}`, updates, { headers: authHeader });
      showMsg('success', 'Gespeichert');
      // Lokales Update
      setBuchungen(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      if (selectedBuchung?.id === id) setSelectedBuchung(prev => ({ ...prev, ...updates }));
      loadStats();
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Fehler');
    } finally {
      setBuchungSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
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

      {/* Meldung */}
      {msg.text && (
        <div className={`dt-alert dt-alert-${msg.type}`}>{msg.text}</div>
      )}

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
            <div className="dt-stat-label">Slots gesamt (Zukunft)</div>
          </div>
        </div>
      )}

      {/* View-Umschalter */}
      <div className="dt-tabs">
        <button className={`dt-tab ${view === 'slots' ? 'active' : ''}`} onClick={() => setView('slots')}>
          Zeitfenster
        </button>
        <button className={`dt-tab ${view === 'buchungen' ? 'active' : ''}`} onClick={() => setView('buchungen')}>
          Buchungen
          {stats?.offene_buchungen > 0 && <span className="dt-badge">{stats.offene_buchungen}</span>}
        </button>
      </div>

      {/* ── SLOTS VIEW ── */}
      {view === 'slots' && (
        <div className="dt-section">
          <div className="dt-section-actions">
            <button className="dt-btn dt-btn-primary" onClick={() => { setShowSlotForm(!showSlotForm); setShowBulk(false); }}>
              + Einzelner Slot
            </button>
            <button className="dt-btn" onClick={() => { setShowBulk(!showBulk); setShowSlotForm(false); }}>
              Mehrere Slots anlegen
            </button>
          </div>

          {/* Einzelner Slot anlegen */}
          {showSlotForm && (
            <form className="dt-form" onSubmit={handleCreateSlot}>
              <h3 className="dt-form-title">Neuen Zeitfenster anlegen</h3>
              <div className="dt-form-row">
                <div className="dt-form-group">
                  <label>Datum & Uhrzeit *</label>
                  <input
                    type="datetime-local"
                    value={slotForm.slot_start}
                    onChange={e => setSlotForm(f => ({ ...f, slot_start: e.target.value }))}
                    required
                    min={new Date().toISOString().slice(0,16)}
                  />
                </div>
                <div className="dt-form-group dt-form-group-sm">
                  <label>Dauer (Min)</label>
                  <input
                    type="number"
                    value={slotForm.duration_minutes}
                    onChange={e => setSlotForm(f => ({ ...f, duration_minutes: e.target.value }))}
                    min="15" max="180" step="15"
                  />
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

              {/* Konflikt-Check Ergebnis */}
              {slotForm.slot_start && (
                <div className={`dt-conflict-check ${conflictCheck?.length > 0 ? 'dt-conflict-warn' : conflictCheck !== null ? 'dt-conflict-ok' : ''}`}>
                  {checkingConflict && <span>Prüfe iCloud-Kalender...</span>}
                  {!checkingConflict && conflictCheck === null && slotForm.slot_start && <span className="dt-muted">Kein iCloud-Kalender verbunden</span>}
                  {!checkingConflict && conflictCheck?.length === 0 && <span>Kein Konflikt im Kalender</span>}
                  {!checkingConflict && conflictCheck?.length > 0 && (
                    <span>Achtung: Kalenderkonflikt mit "{conflictCheck[0].summary}"</span>
                  )}
                </div>
              )}

              <div className="dt-form-actions">
                <button type="submit" className="dt-btn dt-btn-primary" disabled={slotSaving}>
                  {slotSaving ? 'Speichere...' : 'Slot anlegen'}
                </button>
                <button type="button" className="dt-btn" onClick={() => setShowSlotForm(false)}>Abbrechen</button>
              </div>
            </form>
          )}

          {/* Bulk Slots */}
          {showBulk && (
            <form className="dt-form" onSubmit={handleBulkCreate}>
              <h3 className="dt-form-title">Mehrere Zeitfenster an einem Tag anlegen</h3>
              <div className="dt-form-row">
                <div className="dt-form-group">
                  <label>Datum *</label>
                  <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} required min={new Date().toISOString().slice(0,10)} />
                </div>
                <div className="dt-form-group dt-form-group-sm">
                  <label>Dauer (Min)</label>
                  <input type="number" value={bulkDur} onChange={e => setBulkDur(e.target.value)} min="15" max="180" step="15" />
                </div>
              </div>
              <div className="dt-form-group">
                <label>Uhrzeiten (eine pro Zeile, Format HH:MM)</label>
                <textarea
                  value={bulkTimes}
                  onChange={e => setBulkTimes(e.target.value)}
                  rows={6}
                  placeholder="09:00&#10;10:30&#10;14:00&#10;15:30"
                />
              </div>
              <div className="dt-form-actions">
                <button type="submit" className="dt-btn dt-btn-primary" disabled={bulkSaving}>
                  {bulkSaving ? 'Anlege...' : `${bulkTimes.split('\n').filter(t=>t.trim()).length} Slots anlegen`}
                </button>
                <button type="button" className="dt-btn" onClick={() => setShowBulk(false)}>Abbrechen</button>
              </div>
            </form>
          )}

          {/* Slots-Liste */}
          {loading && <div className="dt-loading">Lade...</div>}
          {!loading && slots.length === 0 && (
            <div className="dt-empty">
              <div className="dt-empty-icon">📅</div>
              <p>Noch keine Zeitfenster angelegt.</p>
              <p className="dt-muted">Lege Slots an und gib sie frei, damit Interessenten Termine buchen können.</p>
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
                      <span className="dt-pill dt-pill-booked">Gebucht von {slot.vorname} {slot.nachname}</span>
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
                          title={slot.is_available ? 'Slot sperren' : 'Slot freigeben'}
                        >
                          {slot.is_available ? 'Sperren' : 'Freigeben'}
                        </button>
                        <button className="dt-btn dt-btn-sm dt-btn-danger" onClick={() => deleteSlot(slot.id)}>Löschen</button>
                      </>
                    )}
                    {slot.is_booked && (
                      <button className="dt-btn dt-btn-sm" onClick={() => { setView('buchungen'); loadBuchungen(); }}>
                        Buchung ansehen
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BUCHUNGEN VIEW ── */}
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
              {/* Liste */}
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
                    <span
                      className="dt-pill"
                      style={{ backgroundColor: STATUS_COLORS[b.status] + '33', color: STATUS_COLORS[b.status] }}
                    >
                      {STATUS_LABELS[b.status]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Detail */}
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

                  {/* Status */}
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

                  {/* Admin-Notiz */}
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
