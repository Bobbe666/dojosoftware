import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/PlattformZentrale.css';

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

const fmt = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

const PLATFORM_COLORS = {
  dojo:    { bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.4)',  text: '#a5b4fc', dot: '#6366f1'  },
  events:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)', text: '#fcd34d', dot: '#f59e0b'  },
  hof:     { bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)',  text: '#fde047', dot: '#eab308'  },
  pruefung:{ bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   text: '#86efac', dot: '#22c55e'  },
};

const PLATFORM_LABELS = {
  dojo:    'DojoSoftware',
  events:  'EventSoftware',
  hof:     'Hall of Fame',
  pruefung:'Prüfungen',
};

// ─── Kalender Hilfsfunktionen ────────────────────────────────────────────────

const getEvtDate = (ev) => new Date(ev.datum || ev.date || '');
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const getWeekStart = (d) => { const c = new Date(d); c.setDate(c.getDate() - ((c.getDay() + 6) % 7)); c.setHours(0,0,0,0); return c; };

function EvRow({ ev }) {
  const col = PLATFORM_COLORS[ev.platform] || PLATFORM_COLORS.dojo;
  return (
    <div className="pz-event-row" style={{ borderLeft: `3px solid ${col.dot}` }}>
      <div className="pz-event-date">{fmt(ev.datum || ev.date)}</div>
      <div className="pz-event-body">
        <span className="pz-event-title">{ev.titel || ev.title || ev.name}</span>
        {ev.ort && <span className="pz-event-meta">📍 {ev.ort}</span>}
      </div>
      <span className="pz-platform-badge" style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}>
        {PLATFORM_LABELS[ev.platform] || ev.platform}
      </span>
    </div>
  );
}

function CalDayCell({ date, evs, onClick, compact }) {
  const today = new Date();
  const isToday = sameDay(date, today);
  return (
    <div className={`pz-cal-cell ${isToday ? 'pz-cal-today' : ''} ${compact ? 'pz-cal-cell--compact' : ''}`}
      onClick={() => onClick && onClick(date)} style={onClick ? { cursor: 'pointer' } : {}}>
      <span className="pz-cal-day-num">{date.getDate()}</span>
      {evs.slice(0, compact ? 2 : 3).map((ev, j) => {
        const col = PLATFORM_COLORS[ev.platform] || PLATFORM_COLORS.dojo;
        return (
          <div key={j} className="pz-cal-event" style={{ background: col.bg, color: col.text, borderLeft: `2px solid ${col.dot}` }}
            title={`${ev.titel || ev.title || ev.name} (${PLATFORM_LABELS[ev.platform]})`}>
            {(ev.titel || ev.title || ev.name || '').substring(0, compact ? 12 : 18)}
          </div>
        );
      })}
      {evs.length > (compact ? 2 : 3) && (
        <div className="pz-cal-more">+{evs.length - (compact ? 2 : 3)}</div>
      )}
    </div>
  );
}

// ─── Kalender ───────────────────────────────────────────────────────────────

function KalenderView({ token }) {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [view, setView]           = useState('monat'); // 'tag'|'woche'|'monat'|'jahr'|'liste'
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [icsUrl, setIcsUrl]       = useState(null);
  const [showSync, setShowSync]   = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get('/plattform-zentrale/kalender', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(res.data.events || []);
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Fehler beim Laden der Ereignisse';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadIcsUrl = useCallback(async () => {
    if (icsUrl) { setShowSync(true); return; }
    try {
      const res = await axios.get('/plattform-zentrale/kalender-token', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIcsUrl(`${res.data.base_url}?token=${res.data.token}`);
      setShowSync(true);
    } catch (e) {
      setError('ICS-Token konnte nicht geladen werden');
    }
  }, [token, icsUrl]);

  const copyUrl = () => {
    if (!icsUrl) return;
    navigator.clipboard.writeText(icsUrl).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  useEffect(() => { load(); }, [load]);

  // 'dojo' filter includes pruefungen (both come from DojoSoftware)
  const filtered = filterPlatform === 'all'
    ? events
    : filterPlatform === 'dojo'
      ? events.filter(e => e.platform === 'dojo' || e.platform === 'pruefung')
      : events.filter(e => e.platform === filterPlatform);

  const getEventsForDate = (d) => filtered.filter(ev => sameDay(getEvtDate(ev), d));

  // Navigation
  const navigate = (dir) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (view === 'tag')   d.setDate(d.getDate() + dir);
      if (view === 'woche') d.setDate(d.getDate() + dir * 7);
      if (view === 'monat') d.setMonth(d.getMonth() + dir);
      if (view === 'jahr')  d.setFullYear(d.getFullYear() + dir);
      return d;
    });
  };

  const navLabel = () => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    if (view === 'tag')   return currentDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (view === 'woche') {
      const ws = getWeekStart(currentDate);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      return `${ws.toLocaleDateString('de-DE',{day:'numeric',month:'short'})} – ${we.toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'})}`;
    }
    if (view === 'monat') return currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (view === 'jahr')  return String(y);
    return '';
  };

  const goToday = () => setCurrentDate(new Date());

  // ── Tag-Ansicht ────────────────────────────────────────────────────────────
  const renderTag = () => {
    const dayEvs = getEventsForDate(currentDate);
    return (
      <div className="pz-day-view">
        {dayEvs.length === 0
          ? <div className="pz-empty" style={{ padding: '2.5rem 1rem' }}>Keine Ereignisse an diesem Tag.</div>
          : dayEvs.map((ev, i) => <EvRow key={i} ev={ev} />)
        }
      </div>
    );
  };

  // ── Woche-Ansicht ──────────────────────────────────────────────────────────
  const renderWoche = () => {
    const ws = getWeekStart(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
    return (
      <div className="pz-week-view">
        {days.map((d, i) => {
          const dayEvs = getEventsForDate(d);
          const isToday = sameDay(d, new Date());
          return (
            <div key={i} className={`pz-week-col ${isToday ? 'pz-week-col--today' : ''}`}>
              <div className="pz-week-col-header">
                <span className="pz-week-dow">{d.toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                <span className={`pz-week-day ${isToday ? 'pz-week-day--today' : ''}`}>{d.getDate()}</span>
              </div>
              <div className="pz-week-events">
                {dayEvs.length === 0
                  ? <div className="pz-week-empty" />
                  : dayEvs.map((ev, j) => {
                      const col = PLATFORM_COLORS[ev.platform] || PLATFORM_COLORS.dojo;
                      return (
                        <div key={j} className="pz-week-event" style={{ background: col.bg, borderLeft: `2px solid ${col.dot}`, color: col.text }}
                          title={`${ev.titel || ev.title || ev.name}`}>
                          {(ev.titel || ev.title || ev.name || '').substring(0, 20)}
                        </div>
                      );
                    })
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Monat-Ansicht ──────────────────────────────────────────────────────────
  const renderMonat = () => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const startDow = (firstDay.getDay() + 6) % 7;
    return (
      <div className="pz-calendar-grid">
        {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
          <div key={d} className="pz-cal-header">{d}</div>
        ))}
        {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} className="pz-cal-cell pz-cal-empty" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = new Date(y, m, i + 1);
          return <CalDayCell key={i} date={d} evs={getEventsForDate(d)}
            onClick={(date) => { setCurrentDate(date); setView('tag'); }} />;
        })}
      </div>
    );
  };

  // ── Jahr-Ansicht ───────────────────────────────────────────────────────────
  const renderJahr = () => {
    const y = currentDate.getFullYear();
    return (
      <div className="pz-year-grid">
        {Array.from({ length: 12 }, (_, mi) => {
          const firstDay = new Date(y, mi, 1);
          const daysInMonth = new Date(y, mi + 1, 0).getDate();
          const startDow = (firstDay.getDay() + 6) % 7;
          const monthName = firstDay.toLocaleDateString('de-DE', { month: 'long' });
          return (
            <div key={mi} className="pz-year-month" onClick={() => { setCurrentDate(new Date(y, mi, 1)); setView('monat'); }}>
              <div className="pz-year-month-title">{monthName}</div>
              <div className="pz-year-mini-grid">
                {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
                  <div key={d} className="pz-year-mini-header">{d[0]}</div>
                ))}
                {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} className="pz-year-mini-cell" />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = new Date(y, mi, i + 1);
                  const dayEvs = getEventsForDate(d);
                  const isToday = sameDay(d, new Date());
                  return (
                    <div key={i} className={`pz-year-mini-cell ${isToday ? 'pz-year-mini-today' : ''} ${dayEvs.length > 0 ? 'pz-year-mini-has-events' : ''}`}>
                      <span>{i + 1}</span>
                      {dayEvs.length > 0 && (
                        <div className="pz-year-mini-dots">
                          {dayEvs.slice(0, 3).map((ev, j) => (
                            <span key={j} className="pz-year-dot" style={{ background: (PLATFORM_COLORS[ev.platform] || PLATFORM_COLORS.dojo).dot }} />
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
    );
  };

  // ── Liste-Ansicht ──────────────────────────────────────────────────────────
  const renderListe = () => {
    const grouped = filtered.reduce((acc, ev) => {
      const d = getEvtDate(ev);
      const key = isNaN(d) ? 'Datum unbekannt' : d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      if (!acc[key]) acc[key] = [];
      acc[key].push(ev);
      return acc;
    }, {});
    return Object.keys(grouped).length === 0
      ? <div className="pz-empty">Keine Ereignisse gefunden.</div>
      : Object.entries(grouped).reverse().map(([label, evs]) => (
          <div key={label} className="pz-month-group">
            <div className="pz-month-label">{label}</div>
            {evs.map((ev, i) => <EvRow key={i} ev={ev} />)}
          </div>
        ));
  };

  const hasNav = view !== 'liste';

  const FILTER_OPTS = [
    { key: 'all',      label: 'Alle' },
    { key: 'dojo',     label: 'Dojo' },
    { key: 'events',   label: 'Events' },
    { key: 'hof',      label: 'HoF' },
    { key: 'pruefung', label: 'Prüfungen' },
  ];

  return (
    <div className="pz-section">
      {/* Einzeilige Kalender-Toolbar */}
      <div className="pz-kal-bar">
        {/* Ansicht */}
        <div className="pz-kal-group">
          {[['tag','Tag'],['woche','Woche'],['monat','Monat'],['jahr','Jahr'],['liste','Liste']].map(([id, label]) => (
            <button key={id} className={`pz-view-btn ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>

        {/* Trennlinie */}
        <div className="pz-kal-sep" />

        {/* Navigation */}
        {hasNav ? (
          <div className="pz-kal-group">
            <button className="pz-icon-btn" onClick={() => navigate(-1)}>‹</button>
            <span className="pz-cal-nav-label">{navLabel()}</span>
            <button className="pz-icon-btn" onClick={() => navigate(1)}>›</button>
            <button className="pz-today-btn" onClick={goToday}>Heute</button>
          </div>
        ) : <div />}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Filter */}
        <div className="pz-kal-group">
          {FILTER_OPTS.map(({ key, label }) => (
            <button key={key}
              className={`pz-filter-btn ${filterPlatform === key ? 'active' : ''}`}
              style={filterPlatform === key && key !== 'all' ? {
                background: PLATFORM_COLORS[key]?.bg,
                borderColor: PLATFORM_COLORS[key]?.border,
                color: PLATFORM_COLORS[key]?.text,
              } : {}}
              onClick={() => setFilterPlatform(key)}>
              {label}
            </button>
          ))}
        </div>

        <button className="pz-icon-btn" onClick={load} title="Aktualisieren">↻</button>
        <button className="pz-sync-btn" onClick={loadIcsUrl} title="Kalender abonnieren">📅 Sync</button>
      </div>

      {showSync && icsUrl && (
        <div className="pz-sync-panel">
          <div className="pz-sync-panel-header">
            <span className="pz-sync-panel-title">Kalender abonnieren (iOS / Android / Google)</span>
            <button className="pz-sync-close" onClick={() => setShowSync(false)}>✕</button>
          </div>
          <p className="pz-sync-hint">Abonniere den TDA Plattform-Kalender in deiner Kalender-App. Neue Termine erscheinen automatisch.</p>
          <div className="pz-sync-url-row">
            <code className="pz-sync-url">{icsUrl}</code>
            <button className="pz-sync-copy" onClick={copyUrl}>{copiedUrl ? '✓ Kopiert' : 'Kopieren'}</button>
          </div>
          <div className="pz-sync-actions">
            <a className="pz-sync-link pz-sync-link--ios" href={icsUrl.replace('https://', 'webcal://')}>
              iOS / macOS öffnen
            </a>
            <a className="pz-sync-link pz-sync-link--google"
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icsUrl)}`}
              target="_blank" rel="noopener noreferrer">
              Google Calendar
            </a>
          </div>
        </div>
      )}

      {error && <div className="pz-error">{error}</div>}

      {loading ? (
        <div className="pz-loading">Lade Ereignisse…</div>
      ) : (
        <div className="pz-cal-content">
          {view === 'tag'   && renderTag()}
          {view === 'woche' && renderWoche()}
          {view === 'monat' && renderMonat()}
          {view === 'jahr'  && renderJahr()}
          {view === 'liste' && renderListe()}
        </div>
      )}
    </div>
  );
}

// ─── News ────────────────────────────────────────────────────────────────────

function NewsView({ token }) {
  const [newsList, setNewsList]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState(null);
  const [sending, setSending]     = useState(false);
  const [bildPreview, setBildPreview] = useState(null);
  const [bildFile, setBildFile]       = useState(null);
  const [existingBildUrl, setExistingBildUrl] = useState(null);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    titel: '',
    inhalt: '',
    platforms: { dojo: true, events: false, hof: false },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/plattform-zentrale/news', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewsList(res.data.news || []);
    } catch (e) {
      const m = e.response?.data?.error || e.message || 'Fehler beim Laden';
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleBildChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBildFile(file);
    const reader = new FileReader();
    reader.onload = ev => setBildPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeBild = () => {
    setBildFile(null);
    setBildPreview(null);
    setExistingBildUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ titel: '', inhalt: '', platforms: { dojo: true, events: false, hof: false } });
    setBildFile(null); setBildPreview(null); setExistingBildUrl(null);
    setError(''); setSuccess('');
    setShowForm(true);
  };

  const openEdit = (n) => {
    setEditId(n.id);
    setForm({ titel: n.titel || '', inhalt: n.inhalt || '', platforms: { dojo: true, events: false, hof: false } });
    setBildFile(null); setBildPreview(null);
    setExistingBildUrl(n.bild_url || null);
    setError(''); setSuccess('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setBildFile(null); setBildPreview(null); setExistingBildUrl(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('News wirklich löschen?')) return;
    try {
      await axios.delete(`/plattform-zentrale/news/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('News gelöscht.');
      load();
    } catch (e) {
      const m = e.response?.data?.error || e.message;
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titel.trim() || !form.inhalt.trim()) return;
    setSending(true); setError(''); setSuccess('');
    try {
      let bild_url = existingBildUrl;
      if (bildFile) {
        const fd = new FormData();
        fd.append('bild', bildFile);
        const up = await axios.post('/news/upload-bild', fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        bild_url = up.data.bild_url || null;
      }
      if (editId) {
        await axios.put(`/plattform-zentrale/news/${editId}`, { ...form, bild_url }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('News erfolgreich aktualisiert!');
      } else {
        await axios.post('/plattform-zentrale/news', { ...form, bild_url }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('News erfolgreich veröffentlicht!');
      }
      closeForm();
      load();
    } catch (e) {
      const m = e.response?.data?.error || e.message || 'Fehler beim Senden';
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    } finally { setSending(false); }
  };

  return (
    <div className="pz-section">
      <div className="pz-toolbar">
        <div />
        {!showForm && (
          <button className="pz-btn-primary" onClick={openCreate}>+ News erstellen</button>
        )}
      </div>

      {error   && <div className="pz-error">{error}</div>}
      {success && <div className="pz-success">{success}</div>}

      {/* News-Formular */}
      {showForm && (
        <div className="pz-form-card">
          <h3 className="pz-form-title">{editId ? '✏️ News bearbeiten' : '📰 Neue News erstellen'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="pz-form-group">
              <label className="pz-label">Titel</label>
              <input
                className="pz-input"
                value={form.titel}
                onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                placeholder="News-Titel"
                required
              />
            </div>
            <div className="pz-form-group">
              <label className="pz-label">Inhalt</label>
              <textarea
                className="pz-textarea"
                value={form.inhalt}
                onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))}
                placeholder="News-Text…"
                rows={5}
                required
              />
            </div>
            <div className="pz-form-group">
              <label className="pz-label">Bild / Plakat</label>
              {(bildPreview || existingBildUrl) ? (
                <div className="pz-news-upload-preview">
                  <img src={bildPreview || existingBildUrl} alt="Vorschau" />
                  <button type="button" className="pz-news-upload-remove" onClick={removeBild}>✕ Entfernen</button>
                </div>
              ) : (
                <label className="pz-news-upload-area">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleBildChange}
                    style={{ display: 'none' }}
                  />
                  <span className="pz-news-upload-icon">🖼️</span>
                  <span className="pz-news-upload-text">Bild auswählen</span>
                  <span className="pz-news-upload-hint">JPG, PNG, WebP — max. 5 MB</span>
                </label>
              )}
            </div>
            <div className="pz-form-group">
              <label className="pz-label">Veröffentlichen auf</label>
              <div className="pz-platform-checks">
                {[
                  { key: 'dojo',   label: 'DojoSoftware',  icon: '🥋' },
                  { key: 'events', label: 'EventSoftware',  icon: '🗓️' },
                  { key: 'hof',    label: 'Hall of Fame',   icon: '🌟' },
                ].map(p => (
                  <label key={p.key} className={`pz-platform-check ${form.platforms[p.key] ? 'checked' : ''}`}
                    style={form.platforms[p.key] ? { borderColor: PLATFORM_COLORS[p.key].border, background: PLATFORM_COLORS[p.key].bg } : {}}>
                    <input
                      type="checkbox"
                      checked={form.platforms[p.key]}
                      onChange={e => setForm(f => ({ ...f, platforms: { ...f.platforms, [p.key]: e.target.checked } }))}
                    />
                    <span>{p.icon} {p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="pz-form-actions">
              <button type="button" className="pz-btn-secondary" onClick={closeForm}>Abbrechen</button>
              <button type="submit" className="pz-btn-primary" disabled={sending}>
                {sending ? 'Wird gespeichert…' : (editId ? '💾 Speichern' : '📤 Veröffentlichen')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* News-Liste */}
      {loading ? (
        <div className="pz-loading">Lade News…</div>
      ) : newsList.length === 0 ? (
        <div className="pz-empty">Noch keine News erstellt.</div>
      ) : (
        newsList.map((n, i) => (
          <div key={i} className="pz-news-card">
            <div className="pz-news-header">
              <span className="pz-news-title">{n.titel}</span>
              <span className="pz-news-date">{fmt(n.erstellt_am || n.created_at)}</span>
            </div>
            {n.bild_url && (
              <div className="pz-news-bild">
                <img src={n.bild_url} alt={n.titel} />
              </div>
            )}
            <p className="pz-news-body">{n.inhalt?.substring(0, 180)}{n.inhalt?.length > 180 ? '…' : ''}</p>
            <div className="pz-news-footer">
              <button className="pz-btn-icon" onClick={() => openEdit(n)} title="Bearbeiten">✏️</button>
              <button className="pz-btn-icon pz-btn-danger" onClick={() => handleDelete(n.id)} title="Löschen">🗑️</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Turnier Erstellen ───────────────────────────────────────────────────────

// Alle bekannten Vereine (vereins_id, name)
const VEREINE = [
  { id: 1, name: 'TDA Admin' },
  { id: 2, name: 'Kampfkunstschule Schreiner' },
  { id: 3, name: 'Kampfkunst Akademie Berlin' },
  { id: 4, name: 'Martial Arts Center Hamburg' },
  { id: 5, name: 'Dojo München Süd' },
  { id: 6, name: 'Karate Club Köln' },
  { id: 7, name: 'TDA Schule Frankfurt' },
  { id: 8, name: 'Budo Sport Stuttgart' },
  { id: 9, name: 'Kampfsport Düsseldorf' },
  { id: 10, name: 'Taekwondo Verein Nürnberg' },
  { id: 11, name: 'Kickbox Team Dresden' },
  { id: 12, name: 'Kampfkunst Leipzig West' },
];

function TurnierView({ token }) {
  const [turniere, setTurniere]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState(null);
  const [sending, setSending]       = useState(false);
  const [formTab, setFormTab]       = useState('basis');

  const emptyForm = {
    // Basis
    name: '', start_datum: '', end_datum: '', ort: '', adresse: '', plz: '', stadt: '', land: 'Deutschland',
    sportart: '', disziplin: '', beschreibung: '', veroeffentlicht: false,
    // Anmeldung
    anmeldeschluss: '', max_teilnehmer: '', anmeldegebuehr: '', preis_einzel: '', preis_team: '',
    fruehbucher_bis: '', fruehbucher_rabatt: '', rabatt_zweite_kategorie: '', rabatt_weitere_kategorien: '',
    nachmeldegebuehr: '', nachmeldung_von_datum: '', nachmeldung_bis_datum: '',
    anmeldung_gewicht_pflicht: false, anmeldung_graduierung_pflicht: false, min_graduierung: '',
    // Zugang
    anmeldung_beschraenkung: 'alle', erlaubte_vereine: [],
    // Turniermodus
    default_tournament_mode: 'single_elimination_bronze',
    altersberechnung_stichtag: 'turniertag',
    // Kontakt
    kontakt_email: '', kontakt_telefon: '', website: '',
    // Bank
    bank_kontoinhaber: '', bank_iban: '', bank_bic: '', bank_name: '', bank_verwendungszweck: '',
    // Texte
    regeln: '', hinweise: '',
  };
  const [form, setForm] = useState(emptyForm);

  const f = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const toggleVerein = (id) => {
    setForm(prev => ({
      ...prev,
      erlaubte_vereine: prev.erlaubte_vereine.includes(id)
        ? prev.erlaubte_vereine.filter(v => v !== id)
        : [...prev.erlaubte_vereine, id]
    }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/plattform-zentrale/turniere', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTurniere(res.data.turniere || []);
    } catch (e) {
      const m = e.response?.data?.error || e.message || 'Fehler beim Laden';
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setFormTab('basis');
    setError(''); setSuccess('');
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditId(t.turnier_id || t.id);
    setForm({
      ...emptyForm,
      name: t.name || '',
      start_datum: t.datum || t.start_datum || '',
      end_datum: t.datum_ende || t.end_datum || '',
      ort: t.ort || '',
      beschreibung: t.beschreibung || '',
      veroeffentlicht: t.veroeffentlicht || false,
      anmeldeschluss: t.anmeldeschluss || '',
      max_teilnehmer: t.max_teilnehmer || '',
      anmeldegebuehr: t.anmeldegebuehr || '',
      kontakt_email: t.kontakt_email || '',
      kontakt_telefon: t.kontakt_telefon || '',
      website: t.website || '',
    });
    setFormTab('basis');
    setError(''); setSuccess('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setFormTab('basis');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Turnier wirklich löschen?')) return;
    try {
      await axios.delete(`/plattform-zentrale/turnier/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Turnier gelöscht.');
      load();
    } catch (e) {
      const m = e.response?.data?.error || e.message;
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.start_datum || !form.ort.trim()) return;
    setSending(true); setError(''); setSuccess('');
    try {
      const payload = {
        ...form,
        datum: form.start_datum,
        erlaubte_vereine: form.anmeldung_beschraenkung === 'nur_spezifische' ? form.erlaubte_vereine : [],
      };
      if (editId) {
        await axios.put(`/plattform-zentrale/turnier/${editId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Turnier erfolgreich aktualisiert!');
      } else {
        await axios.post('/plattform-zentrale/turnier', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Turnier erfolgreich auf EventSoftware erstellt!');
      }
      closeForm();
      load();
    } catch (e) {
      const m = e.response?.data?.error || e.message || 'Fehler beim Speichern';
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    } finally { setSending(false); }
  };

  const FORM_TABS = [
    { id: 'basis',     label: 'Basis' },
    { id: 'anmeldung', label: 'Anmeldung & Gebühren' },
    { id: 'zugang',    label: '🔒 Zugang' },
    { id: 'kontakt',   label: 'Kontakt & Bank' },
    { id: 'texte',     label: 'Regeln & Hinweise' },
  ];

  return (
    <div className="pz-section">
      <div className="pz-toolbar">
        <div className="pz-platform-info">
          <span className="pz-platform-badge" style={{ background: PLATFORM_COLORS.events.bg, border: `1px solid ${PLATFORM_COLORS.events.border}`, color: PLATFORM_COLORS.events.text }}>
            🗓️ events.tda-intl.org
          </span>
        </div>
        {!showForm && (
          <button className="pz-btn-primary pz-btn--events" onClick={openCreate}>+ Turnier erstellen</button>
        )}
      </div>

      {error   && <div className="pz-error">{error}</div>}
      {success && <div className="pz-success">{success}</div>}

      {showForm && (
        <div className="pz-form-card">
          <h3 className="pz-form-title">{editId ? '✏️ Turnier bearbeiten' : '🥊 Neues Turnier erstellen'}</h3>

          {/* Form-Tabs */}
          <div className="pz-form-tabs">
            {FORM_TABS.map(t => (
              <button key={t.id} type="button"
                className={`pz-form-tab ${formTab === t.id ? 'active' : ''}`}
                onClick={() => setFormTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* ── Basis ── */}
            {formTab === 'basis' && (
              <>
                <div className="pz-form-grid-2">
                  <div className="pz-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="pz-label">Turniername *</label>
                    <input className="pz-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="z.B. TDA Open 2026" required />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Startdatum *</label>
                    <input type="date" className="pz-input" value={form.start_datum} onChange={e => f('start_datum', e.target.value)} required />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Enddatum</label>
                    <input type="date" className="pz-input" value={form.end_datum} onChange={e => f('end_datum', e.target.value)} />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Halle / Venue *</label>
                    <input className="pz-input" value={form.ort} onChange={e => f('ort', e.target.value)} placeholder="Hallennname" required />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Straße</label>
                    <input className="pz-input" value={form.adresse} onChange={e => f('adresse', e.target.value)} placeholder="Musterstraße 1" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">PLZ</label>
                    <input className="pz-input" value={form.plz} onChange={e => f('plz', e.target.value)} placeholder="12345" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Stadt</label>
                    <input className="pz-input" value={form.stadt} onChange={e => f('stadt', e.target.value)} placeholder="München" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Land</label>
                    <input className="pz-input" value={form.land} onChange={e => f('land', e.target.value)} />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Sportart</label>
                    <input className="pz-input" value={form.sportart} onChange={e => f('sportart', e.target.value)} placeholder="z.B. Karate, Kickboxen" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Disziplin</label>
                    <input className="pz-input" value={form.disziplin} onChange={e => f('disziplin', e.target.value)} placeholder="z.B. Kata, Kumite" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Turniermodus</label>
                    <select className="pz-select" value={form.default_tournament_mode} onChange={e => f('default_tournament_mode', e.target.value)}>
                      <option value="single_elimination_bronze">K.O. mit Bronze</option>
                      <option value="single_elimination">K.O. ohne Bronze</option>
                      <option value="double_elimination">Doppel-K.O.</option>
                      <option value="round_robin">Jeder gegen Jeden</option>
                      <option value="pool_elimination">Pool + K.O.</option>
                    </select>
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Altersberechnung</label>
                    <select className="pz-select" value={form.altersberechnung_stichtag} onChange={e => f('altersberechnung_stichtag', e.target.value)}>
                      <option value="turniertag">Am Turniertag</option>
                      <option value="jahresbeginn">01. Januar des Turnierjahres</option>
                      <option value="manuel">Manuell festlegen</option>
                    </select>
                  </div>
                </div>
                <div className="pz-form-group">
                  <label className="pz-label">Beschreibung</label>
                  <textarea className="pz-textarea" value={form.beschreibung} onChange={e => f('beschreibung', e.target.value)} rows={3} placeholder="Beschreibung des Turniers…" />
                </div>
                <div className="pz-form-group">
                  <label className="pz-check-row">
                    <input type="checkbox" checked={form.veroeffentlicht} onChange={e => f('veroeffentlicht', e.target.checked)} />
                    <span>Turnier sofort veröffentlichen (auf events.tda-intl.org sichtbar)</span>
                  </label>
                </div>
              </>
            )}

            {/* ── Anmeldung & Gebühren ── */}
            {formTab === 'anmeldung' && (
              <>
                <div className="pz-form-grid-2">
                  <div className="pz-form-group">
                    <label className="pz-label">Anmeldeschluss</label>
                    <input type="date" className="pz-input" value={form.anmeldeschluss} onChange={e => f('anmeldeschluss', e.target.value)} />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Max. Teilnehmer</label>
                    <input type="number" className="pz-input" value={form.max_teilnehmer} onChange={e => f('max_teilnehmer', e.target.value)} placeholder="unbegrenzt" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Anmeldegebühr Einzel (€)</label>
                    <input type="number" step="0.01" className="pz-input" value={form.preis_einzel} onChange={e => f('preis_einzel', e.target.value)} placeholder="25.00" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Anmeldegebühr Team (€)</label>
                    <input type="number" step="0.01" className="pz-input" value={form.preis_team} onChange={e => f('preis_team', e.target.value)} placeholder="40.00" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Rabatt 2. Kategorie (%)</label>
                    <input type="number" step="0.01" className="pz-input" value={form.rabatt_zweite_kategorie} onChange={e => f('rabatt_zweite_kategorie', e.target.value)} placeholder="20" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Rabatt weitere Kategorien (%)</label>
                    <input type="number" step="0.01" className="pz-input" value={form.rabatt_weitere_kategorien} onChange={e => f('rabatt_weitere_kategorien', e.target.value)} placeholder="30" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Frühbucherrabatt bis</label>
                    <input type="date" className="pz-input" value={form.fruehbucher_bis} onChange={e => f('fruehbucher_bis', e.target.value)} />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Frühbucherrabatt (%)</label>
                    <input type="number" step="0.01" className="pz-input" value={form.fruehbucher_rabatt} onChange={e => f('fruehbucher_rabatt', e.target.value)} placeholder="0" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Nachmeldegebühr (€)</label>
                    <input type="number" step="0.01" className="pz-input" value={form.nachmeldegebuehr} onChange={e => f('nachmeldegebuehr', e.target.value)} placeholder="0" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Nachmeldung von</label>
                    <input type="date" className="pz-input" value={form.nachmeldung_von_datum} onChange={e => f('nachmeldung_von_datum', e.target.value)} />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Nachmeldung bis</label>
                    <input type="date" className="pz-input" value={form.nachmeldung_bis_datum} onChange={e => f('nachmeldung_bis_datum', e.target.value)} />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Min. Graduierung</label>
                    <input className="pz-input" value={form.min_graduierung} onChange={e => f('min_graduierung', e.target.value)} placeholder="z.B. 9. Kyu" />
                  </div>
                </div>
                <div className="pz-form-group">
                  <label className="pz-check-row">
                    <input type="checkbox" checked={form.anmeldung_gewicht_pflicht} onChange={e => f('anmeldung_gewicht_pflicht', e.target.checked)} />
                    <span>Gewicht bei Anmeldung pflicht</span>
                  </label>
                </div>
                <div className="pz-form-group">
                  <label className="pz-check-row">
                    <input type="checkbox" checked={form.anmeldung_graduierung_pflicht} onChange={e => f('anmeldung_graduierung_pflicht', e.target.checked)} />
                    <span>Graduierung bei Anmeldung pflicht</span>
                  </label>
                </div>
              </>
            )}

            {/* ── Zugang ── */}
            {formTab === 'zugang' && (
              <>
                <div className="pz-form-group">
                  <label className="pz-label">Wer darf sich anmelden?</label>
                  <div className="pz-radio-group">
                    <label className={`pz-radio-option ${form.anmeldung_beschraenkung === 'alle' ? 'active' : ''}`}>
                      <input type="radio" name="beschraenkung" value="alle"
                        checked={form.anmeldung_beschraenkung === 'alle'}
                        onChange={() => f('anmeldung_beschraenkung', 'alle')} />
                      <div>
                        <span className="pz-radio-title">🌐 Alle Vereine</span>
                        <span className="pz-radio-sub">Öffentliches Turnier — jeder angemeldete Verein kann teilnehmen</span>
                      </div>
                    </label>
                    <label className={`pz-radio-option ${form.anmeldung_beschraenkung === 'nur_spezifische' ? 'active' : ''}`}>
                      <input type="radio" name="beschraenkung" value="nur_spezifische"
                        checked={form.anmeldung_beschraenkung === 'nur_spezifische'}
                        onChange={() => f('anmeldung_beschraenkung', 'nur_spezifische')} />
                      <div>
                        <span className="pz-radio-title">🔒 Nur ausgewählte Vereine</span>
                        <span className="pz-radio-sub">Internes Turnier — nur markierte Vereine können sich anmelden</span>
                      </div>
                    </label>
                  </div>
                </div>

                {form.anmeldung_beschraenkung === 'nur_spezifische' && (
                  <div className="pz-form-group">
                    <label className="pz-label">Berechtigte Vereine</label>
                    <div className="pz-vereine-list">
                      {VEREINE.map(v => (
                        <label key={v.id} className={`pz-verein-check ${form.erlaubte_vereine.includes(v.id) ? 'checked' : ''}`}>
                          <input type="checkbox" checked={form.erlaubte_vereine.includes(v.id)} onChange={() => toggleVerein(v.id)} />
                          <span>{v.name}</span>
                        </label>
                      ))}
                    </div>
                    {form.erlaubte_vereine.length > 0 && (
                      <p className="pz-access-note">
                        {form.erlaubte_vereine.length} Verein{form.erlaubte_vereine.length !== 1 ? 'e' : ''} berechtigt. Andere sehen das Turnier, können sich aber nicht anmelden.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Kontakt & Bank ── */}
            {formTab === 'kontakt' && (
              <>
                <div className="pz-form-section-title">Kontakt</div>
                <div className="pz-form-grid-2">
                  <div className="pz-form-group">
                    <label className="pz-label">E-Mail</label>
                    <input type="email" className="pz-input" value={form.kontakt_email} onChange={e => f('kontakt_email', e.target.value)} placeholder="turnier@example.de" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Telefon</label>
                    <input className="pz-input" value={form.kontakt_telefon} onChange={e => f('kontakt_telefon', e.target.value)} placeholder="+49 123 456789" />
                  </div>
                  <div className="pz-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="pz-label">Website</label>
                    <input className="pz-input" value={form.website} onChange={e => f('website', e.target.value)} placeholder="https://…" />
                  </div>
                </div>
                <div className="pz-form-section-title">Bankverbindung</div>
                <div className="pz-form-grid-2">
                  <div className="pz-form-group">
                    <label className="pz-label">Kontoinhaber</label>
                    <input className="pz-input" value={form.bank_kontoinhaber} onChange={e => f('bank_kontoinhaber', e.target.value)} />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">Bank</label>
                    <input className="pz-input" value={form.bank_name} onChange={e => f('bank_name', e.target.value)} placeholder="Sparkasse…" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">IBAN</label>
                    <input className="pz-input" value={form.bank_iban} onChange={e => f('bank_iban', e.target.value)} placeholder="DE00 0000 0000 0000 0000 00" />
                  </div>
                  <div className="pz-form-group">
                    <label className="pz-label">BIC</label>
                    <input className="pz-input" value={form.bank_bic} onChange={e => f('bank_bic', e.target.value)} />
                  </div>
                  <div className="pz-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="pz-label">Verwendungszweck</label>
                    <input className="pz-input" value={form.bank_verwendungszweck} onChange={e => f('bank_verwendungszweck', e.target.value)} placeholder="z.B. Startgebühr TDA Open 2026" />
                  </div>
                </div>
              </>
            )}

            {/* ── Regeln & Hinweise ── */}
            {formTab === 'texte' && (
              <>
                <div className="pz-form-group">
                  <label className="pz-label">Regeln</label>
                  <textarea className="pz-textarea" value={form.regeln} onChange={e => f('regeln', e.target.value)} rows={5} placeholder="Turnierregeln…" />
                </div>
                <div className="pz-form-group">
                  <label className="pz-label">Hinweise</label>
                  <textarea className="pz-textarea" value={form.hinweise} onChange={e => f('hinweise', e.target.value)} rows={4} placeholder="Allgemeine Hinweise für Teilnehmer…" />
                </div>
              </>
            )}

            <div className="pz-form-actions">
              <div className="pz-form-nav-btns">
                {formTab !== 'basis'  && <button type="button" className="pz-btn-secondary" onClick={() => setFormTab(FORM_TABS[FORM_TABS.findIndex(t=>t.id===formTab)-1].id)}>← Zurück</button>}
                {formTab !== 'texte' && <button type="button" className="pz-btn-secondary" onClick={() => setFormTab(FORM_TABS[FORM_TABS.findIndex(t=>t.id===formTab)+1].id)}>Weiter →</button>}
              </div>
              {formTab === 'texte' && (
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button type="button" className="pz-btn-secondary" onClick={closeForm}>Abbrechen</button>
                  <button type="submit" className="pz-btn-primary pz-btn--events" disabled={sending}>
                    {sending ? 'Wird gespeichert…' : (editId ? '💾 Speichern' : '🗓️ Turnier erstellen')}
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Turnier-Liste */}
      {loading ? (
        <div className="pz-loading">Lade Turniere…</div>
      ) : turniere.length === 0 ? (
        <div className="pz-empty">Keine Turniere gefunden.</div>
      ) : (
        <div className="pz-card-grid">
          {turniere.map((t, i) => (
            <div key={i} className="pz-event-card" style={{ borderLeft: `3px solid ${PLATFORM_COLORS.events.dot}` }}>
              <div className="pz-event-card-header">
                <span className="pz-event-card-name">{t.name}</span>
                <span className="pz-status-badge" data-status={t.status}>{t.status}</span>
              </div>
              <div className="pz-event-card-meta">
                {t.datum && <span>📅 {fmt(t.datum)}{t.datum_ende ? ` – ${fmt(t.datum_ende)}` : ''}</span>}
                {t.ort && <span>📍 {t.ort}</span>}
                {t.max_teilnehmer && <span>👥 max. {t.max_teilnehmer}</span>}
              </div>
              <div className="pz-news-footer">
                <button className="pz-btn-icon" onClick={() => openEdit(t)} title="Bearbeiten">✏️</button>
                <button className="pz-btn-icon pz-btn-danger" onClick={() => handleDelete(t.turnier_id || t.id)} title="Löschen">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HOF Veranstaltung ────────────────────────────────────────────────────────

function HofView({ token }) {
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [sending, setSending]   = useState(false);

  const emptyForm = {
    titel: '', datum: '', veranstaltungsort: '',
    beschreibung: '', max_nominierungen: '',
    anmeldeschluss: '',
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/plattform-zentrale/hof-veranstaltungen', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVeranstaltungen(res.data.veranstaltungen || []);
    } catch (e) {
      const m = e.response?.data?.error || e.message || 'Fehler beim Laden';
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setError(''); setSuccess('');
    setShowForm(true);
  };

  const openEdit = (v) => {
    setEditId(v.id);
    setForm({
      titel: v.titel || '',
      datum: v.datum ? v.datum.substring(0, 10) : '',
      veranstaltungsort: v.veranstaltungsort || '',
      beschreibung: v.beschreibung || '',
      max_nominierungen: v.max_nominierungen || '',
      anmeldeschluss: v.anmeldeschluss ? v.anmeldeschluss.substring(0, 10) : '',
    });
    setError(''); setSuccess('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titel.trim()) return;
    setSending(true); setError(''); setSuccess('');
    try {
      if (editId) {
        await axios.put(`/plattform-zentrale/hof-veranstaltung/${editId}`, form, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Veranstaltung aktualisiert.');
      } else {
        await axios.post('/plattform-zentrale/hof-veranstaltung', form, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Veranstaltung erfolgreich erstellt auf Hall of Fame!');
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditId(null);
      load();
    } catch (e) {
      const m = e.response?.data?.error || e.message || 'Fehler';
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    } finally { setSending(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Veranstaltung löschen?')) return;
    try {
      await axios.delete(`/plattform-zentrale/hof-veranstaltung/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      load();
    } catch (e) {
      const m = e.response?.data?.error || e.message;
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  return (
    <div className="pz-section">
      <div className="pz-toolbar">
        <div className="pz-platform-info">
          <span className="pz-platform-badge" style={{ background: PLATFORM_COLORS.hof.bg, border: `1px solid ${PLATFORM_COLORS.hof.border}`, color: PLATFORM_COLORS.hof.text }}>
            🌟 hof.tda-intl.org
          </span>
        </div>
        <button className="pz-btn-primary pz-btn--hof" onClick={openCreate}>
          + Veranstaltung erstellen
        </button>
      </div>

      {error   && <div className="pz-error">{error}</div>}
      {success && <div className="pz-success">{success}</div>}

      {showForm && (
        <div className="pz-form-card">
          <h3 className="pz-form-title">{editId ? '✏️ Veranstaltung bearbeiten' : '🌟 Neue HoF-Veranstaltung'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="pz-form-grid-2">
              <div className="pz-form-group">
                <label className="pz-label">Titel *</label>
                <input className="pz-input" value={form.titel}
                  onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                  placeholder="z.B. TDA Hall of Fame Gala 2026" required />
              </div>
              <div className="pz-form-group">
                <label className="pz-label">Veranstaltungsort</label>
                <input className="pz-input" value={form.veranstaltungsort}
                  onChange={e => setForm(f => ({ ...f, veranstaltungsort: e.target.value }))}
                  placeholder="Stadt / Venue" />
              </div>
              <div className="pz-form-group">
                <label className="pz-label">Datum</label>
                <input type="date" className="pz-input" value={form.datum}
                  onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
              </div>
              <div className="pz-form-group">
                <label className="pz-label">Anmeldeschluss</label>
                <input type="date" className="pz-input" value={form.anmeldeschluss}
                  onChange={e => setForm(f => ({ ...f, anmeldeschluss: e.target.value }))} />
              </div>
              <div className="pz-form-group">
                <label className="pz-label">Max. Nominierungen</label>
                <input type="number" className="pz-input" value={form.max_nominierungen}
                  onChange={e => setForm(f => ({ ...f, max_nominierungen: e.target.value }))}
                  placeholder="z.B. 50" />
              </div>
            </div>
            <div className="pz-form-group">
              <label className="pz-label">Beschreibung</label>
              <textarea className="pz-textarea" value={form.beschreibung}
                onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
                rows={3} placeholder="Beschreibung der Veranstaltung…" />
            </div>
            <div className="pz-form-actions">
              <button type="button" className="pz-btn-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Abbrechen</button>
              <button type="submit" className="pz-btn-primary pz-btn--hof" disabled={sending}>
                {sending ? 'Wird gespeichert…' : (editId ? 'Speichern' : '🌟 Erstellen')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="pz-loading">Lade Veranstaltungen…</div>
      ) : veranstaltungen.length === 0 ? (
        <div className="pz-empty">Keine Veranstaltungen gefunden.</div>
      ) : (
        <div className="pz-card-grid">
          {veranstaltungen.map((v, i) => (
            <div key={i} className="pz-event-card" style={{ borderLeft: `3px solid ${PLATFORM_COLORS.hof.dot}` }}>
              <div className="pz-event-card-header">
                <span className="pz-event-card-name">{v.titel}</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="pz-btn-icon" onClick={() => openEdit(v)} title="Bearbeiten">✏️</button>
                  <button className="pz-btn-icon pz-btn-danger" onClick={() => handleDelete(v.id)} title="Löschen">🗑️</button>
                </div>
              </div>
              <div className="pz-event-card-meta">
                {v.datum && <span>📅 {fmt(v.datum)}</span>}
                {v.veranstaltungsort && <span>📍 {v.veranstaltungsort}</span>}
                {v.max_nominierungen && <span>🏅 max. {v.max_nominierungen} Nominierungen</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Übersicht ────────────────────────────────────────────────────────────────

function UebersichtView({ token }) {
  const [data, setData] = useState({
    events: [], news: [], umfragen: [], hof: [], loading: true, error: ''
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const [rKal, rNews, rUmfragen, rHof] = await Promise.allSettled([
          axios.get('/plattform-zentrale/kalender', { headers }),
          axios.get('/plattform-zentrale/news', { headers }),
          axios.get('/umfragen', { headers }),
          axios.get('/plattform-zentrale/hof-veranstaltungen', { headers }),
        ]);
        const today = new Date(); today.setHours(0,0,0,0);
        const in60 = new Date(today); in60.setDate(today.getDate() + 60);

        const allEvents = rKal.status === 'fulfilled' ? (rKal.value.data.events || []) : [];
        const upcoming = allEvents
          .filter(ev => { const d = getEvtDate(ev); return d >= today && d <= in60; })
          .sort((a, b) => getEvtDate(a) - getEvtDate(b));

        const allNews = rNews.status === 'fulfilled' ? (rNews.value.data.news || []) : [];
        const allUmfragen = rUmfragen.status === 'fulfilled' ? (rUmfragen.value.data.umfragen || []) : [];
        const allHof = rHof.status === 'fulfilled' ? (rHof.value.data.veranstaltungen || []) : [];
        const upcomingHof = allHof
          .filter(v => v.datum && new Date(v.datum) >= today)
          .sort((a, b) => new Date(a.datum) - new Date(b.datum));

        setData({ events: upcoming, news: allNews.slice(0, 5), umfragen: allUmfragen, hof: upcomingHof, loading: false, error: '' });
      } catch (e) {
        setData(d => ({ ...d, loading: false, error: e.message }));
      }
    };
    load();
  }, [token]);

  if (data.loading) return <div className="pz-loading">Lade Übersicht…</div>;

  const aktiveUmfragen = data.umfragen.filter(u => u.status === 'aktiv');
  const entwuerfe = data.umfragen.filter(u => u.status === 'entwurf');
  const pruefungen = data.events.filter(ev => ev.platform === 'pruefung');

  // Plattform-Aufschlüsselung der Termine (ohne pruefung separat)
  const evByPlatform = data.events.filter(ev => ev.platform !== 'pruefung').reduce((acc, ev) => {
    acc[ev.platform] = (acc[ev.platform] || 0) + 1; return acc;
  }, {});

  return (
    <div className="pz-uebersicht">
      {/* ── Stat-Karten ─────────────────────────────────────────────── */}
      <div className="pz-stat-grid">
        <div className="pz-stat-card" style={{ borderColor: '#6366f1' }}>
          <div className="pz-stat-icon">📅</div>
          <div className="pz-stat-text"><div className="pz-stat-val">{data.events.length}</div><div className="pz-stat-label">Termine (60 Tage)</div></div>
        </div>
        <div className="pz-stat-card" style={{ borderColor: '#22c55e' }}>
          <div className="pz-stat-icon">🥋</div>
          <div className="pz-stat-text"><div className="pz-stat-val">{pruefungen.length}</div><div className="pz-stat-label">Gürtelprüfungen</div></div>
        </div>
        <div className="pz-stat-card" style={{ borderColor: '#a855f7' }}>
          <div className="pz-stat-icon">📋</div>
          <div className="pz-stat-text"><div className="pz-stat-val">{aktiveUmfragen.length}</div><div className="pz-stat-label">Aktive Umfragen</div></div>
        </div>
        <div className="pz-stat-card" style={{ borderColor: '#f59e0b' }}>
          <div className="pz-stat-icon">📰</div>
          <div className="pz-stat-text"><div className="pz-stat-val">{data.news.length || '—'}</div><div className="pz-stat-label">News-Beiträge</div></div>
        </div>
        <div className="pz-stat-card" style={{ borderColor: '#eab308' }}>
          <div className="pz-stat-icon">🌟</div>
          <div className="pz-stat-text"><div className="pz-stat-val">{data.hof.length}</div><div className="pz-stat-label">HoF Events</div></div>
        </div>
      </div>

      <div className="pz-uebersicht-cols">
        {/* ── Linke Spalte ──────────────────────────────────────────── */}
        <div className="pz-uebersicht-col">

          {/* Nächste Termine */}
          <div className="pz-ub-section">
            <div className="pz-ub-section-header">
              <span className="pz-ub-section-icon">📅</span>
              <span className="pz-ub-section-title">Nächste Termine</span>
              {Object.keys(evByPlatform).length > 0 && (
                <div className="pz-ub-badges">
                  {Object.entries(evByPlatform).map(([p, n]) => {
                    const col = PLATFORM_COLORS[p] || PLATFORM_COLORS.dojo;
                    return (
                      <span key={p} className="pz-platform-badge" style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}>
                        {PLATFORM_LABELS[p] || p}: {n}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            {(() => {
              const ohneP = data.events.filter(ev => ev.platform !== 'pruefung');
              return ohneP.length === 0 ? (
                <div className="pz-ub-empty">Keine Termine in den nächsten 60 Tagen.</div>
              ) : (
                <div className="pz-ub-list">
                  {ohneP.slice(0, 10).map((ev, i) => <EvRow key={i} ev={ev} />)}
                  {ohneP.length > 10 && (
                    <div className="pz-ub-more">+{ohneP.length - 10} weitere Termine</div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Gürtelprüfungen */}
          <div className="pz-ub-section">
            <div className="pz-ub-section-header">
              <span className="pz-ub-section-icon">🥋</span>
              <span className="pz-ub-section-title">Gürtelprüfungen (nächste 60 Tage)</span>
            </div>
            {pruefungen.length === 0 ? (
              <div className="pz-ub-empty">Keine Gürtelprüfungen geplant.</div>
            ) : (
              <div className="pz-ub-list">
                {pruefungen.map((ev, i) => (
                  <div key={i} className="pz-event-row" style={{ borderLeft: `3px solid ${PLATFORM_COLORS.pruefung.dot}` }}>
                    <div className="pz-event-date">{fmt(ev.datum || ev.date)}</div>
                    <div className="pz-event-body">
                      <span className="pz-event-title">{ev.titel || ev.title || ev.name}</span>
                      {ev.ort && <span className="pz-event-meta">📍 {ev.ort}</span>}
                      {ev.uhrzeit && <span className="pz-event-meta">🕐 {ev.uhrzeit}</span>}
                    </div>
                    <span className="pz-platform-badge" style={{ background: PLATFORM_COLORS.pruefung.bg, border: `1px solid ${PLATFORM_COLORS.pruefung.border}`, color: PLATFORM_COLORS.pruefung.text }}>
                      {ev.dojo || 'Prüfung'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HoF Events */}
          {data.hof.length > 0 && (
            <div className="pz-ub-section">
              <div className="pz-ub-section-header">
                <span className="pz-ub-section-icon">🌟</span>
                <span className="pz-ub-section-title">Hall of Fame — Kommende Events</span>
              </div>
              <div className="pz-ub-list">
                {data.hof.slice(0, 5).map((v, i) => (
                  <div key={i} className="pz-event-row" style={{ borderLeft: `3px solid ${PLATFORM_COLORS.hof.dot}` }}>
                    <div className="pz-event-date">{fmt(v.datum)}</div>
                    <div className="pz-event-body">
                      <span className="pz-event-title">{v.titel}</span>
                      {v.veranstaltungsort && <span className="pz-event-meta">📍 {v.veranstaltungsort}</span>}
                    </div>
                    {v.anmeldeschluss && (
                      <span className="pz-ub-deadline">Anmeldeschluss: {fmt(v.anmeldeschluss)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Rechte Spalte ─────────────────────────────────────────── */}
        <div className="pz-uebersicht-col">

          {/* Aktive Umfragen */}
          <div className="pz-ub-section">
            <div className="pz-ub-section-header">
              <span className="pz-ub-section-icon">📋</span>
              <span className="pz-ub-section-title">Umfragen</span>
            </div>
            {aktiveUmfragen.length === 0 && entwuerfe.length === 0 ? (
              <div className="pz-ub-empty">Keine Umfragen vorhanden.</div>
            ) : (
              <div className="pz-ub-list">
                {aktiveUmfragen.map((u, i) => (
                  <div key={i} className="pz-ub-umfrage-row pz-ub-umfrage--aktiv">
                    <div className="pz-ub-umfrage-head">
                      <span className="pz-ub-umfrage-badge pz-ub-badge--aktiv">Aktiv</span>
                      <span className="pz-ub-umfrage-titel">{u.titel}</span>
                    </div>
                    <div className="pz-ub-umfrage-stats">
                      <span className="pz-stat-ja">✓ {u.antworten_ja || 0}</span>
                      <span className="pz-stat-nein">✗ {u.antworten_nein || 0}</span>
                      <span className="pz-ub-umfrage-total">{u.antworten_gesamt || 0} Antworten</span>
                    </div>
                    {u.gueltig_bis && (
                      <div className="pz-ub-umfrage-bis">Gültig bis: {fmt(u.gueltig_bis)}</div>
                    )}
                  </div>
                ))}
                {entwuerfe.length > 0 && (
                  <div className="pz-ub-entwuerfe">
                    <span className="pz-ub-umfrage-badge pz-ub-badge--entwurf">{entwuerfe.length} Entwurf{entwuerfe.length > 1 ? 'e' : ''}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Neueste News */}
          <div className="pz-ub-section">
            <div className="pz-ub-section-header">
              <span className="pz-ub-section-icon">📰</span>
              <span className="pz-ub-section-title">Neueste News</span>
            </div>
            {data.news.length === 0 ? (
              <div className="pz-ub-empty">Keine News vorhanden.</div>
            ) : (
              <div className="pz-ub-list">
                {data.news.map((n, i) => (
                  <div key={i} className="pz-ub-news-row">
                    <div className="pz-ub-news-date">{fmt(n.veroeffentlicht_am || n.created_at)}</div>
                    <div className="pz-ub-news-titel">{n.titel}</div>
                    {n.platforms && (
                      <div className="pz-ub-news-platforms">
                        {Object.entries(typeof n.platforms === 'string' ? JSON.parse(n.platforms) : n.platforms)
                          .filter(([, v]) => v)
                          .map(([k]) => {
                            const col = PLATFORM_COLORS[k] || PLATFORM_COLORS.dojo;
                            return (
                              <span key={k} className="pz-platform-badge" style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text, fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                                {PLATFORM_LABELS[k] || k}
                              </span>
                            );
                          })
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Umfragen ────────────────────────────────────────────────────────────────

const PLATTFORMEN_OPTS = [
  { key: 'dojo',   label: 'DojoSoftware' },
  { key: 'events', label: 'Events' },
  { key: 'hof',    label: 'Hall of Fame' },
];

function UmfragenView({ token }) {
  const [list, setList]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState(null);
  const [detailId, setDetailId]   = useState(null);
  const [detail, setDetail]       = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [sending, setSending]     = useState(false);

  const [form, setForm] = useState({
    titel: '', beschreibung: '', typ: 'ja_nein', status: 'entwurf',
    gueltig_bis: '', ziel_platformen: ['dojo'],
  });

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/umfragen', { headers });
      setList(r.data.umfragen || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const togglePlatform = (key) => {
    setForm(f => ({
      ...f,
      ziel_platformen: f.ziel_platformen.includes(key)
        ? f.ziel_platformen.filter(k => k !== key)
        : [...f.ziel_platformen, key],
    }));
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ titel: '', beschreibung: '', typ: 'ja_nein', status: 'entwurf', gueltig_bis: '', ziel_platformen: ['dojo'] });
    setError(''); setSuccess(''); setShowForm(true);
  };

  const openEdit = (u) => {
    setEditId(u.id);
    let plattformen = [];
    try { plattformen = typeof u.ziel_platformen === 'string' ? JSON.parse(u.ziel_platformen) : (u.ziel_platformen || []); } catch {}
    setForm({ titel: u.titel, beschreibung: u.beschreibung || '', typ: u.typ, status: u.status, gueltig_bis: u.gueltig_bis ? u.gueltig_bis.substring(0,10) : '', ziel_platformen: plattformen });
    setError(''); setSuccess(''); setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.titel.trim()) { setError('Titel erforderlich'); return; }
    setSending(true); setError('');
    try {
      if (editId) {
        await axios.put(`/umfragen/${editId}`, form, { headers });
      } else {
        await axios.post('/umfragen', form, { headers });
      }
      setSuccess(editId ? 'Gespeichert.' : 'Umfrage erstellt.');
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally { setSending(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Umfrage löschen?')) return;
    try {
      await axios.delete(`/umfragen/${id}`, { headers });
      load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const loadDetail = async (id) => {
    setDetailId(id); setDetailLoading(true); setDetail(null);
    try {
      const r = await axios.get(`/umfragen/${id}/antworten`, { headers });
      setDetail(r.data.antworten || []);
    } catch {} finally { setDetailLoading(false); }
  };

  const STATUS_LABELS = { entwurf: 'Entwurf', aktiv: 'Aktiv', beendet: 'Beendet' };
  const STATUS_COLORS = { entwurf: '#94a3b8', aktiv: '#4ade80', beendet: '#f87171' };
  const TYP_LABELS = { ja_nein: 'Ja / Nein', kommentar: 'Kommentar', beides: 'Ja/Nein + Kommentar' };

  return (
    <div className="pz-section">
      <div className="pz-section-header">
        <h2 className="pz-section-title">Umfragen</h2>
        <button className="pz-btn-primary" onClick={openCreate}>+ Neue Umfrage</button>
      </div>

      {error   && <div className="pz-error">{error}</div>}
      {success && <div className="pz-success">{success}</div>}

      {showForm && (
        <div className="pz-form-box">
          <h3 className="pz-form-title">{editId ? 'Umfrage bearbeiten' : 'Neue Umfrage'}</h3>
          <div className="pz-form-grid">
            <label className="pz-label">Titel *
              <input className="pz-input" value={form.titel} onChange={e => setForm(f => ({...f, titel: e.target.value}))} placeholder="Umfragetitel" />
            </label>
            <label className="pz-label">Status
              <select className="pz-input" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                <option value="entwurf">Entwurf</option>
                <option value="aktiv">Aktiv</option>
                <option value="beendet">Beendet</option>
              </select>
            </label>
            <label className="pz-label" style={{ gridColumn: '1 / -1' }}>Beschreibung
              <textarea className="pz-input" rows={3} value={form.beschreibung} onChange={e => setForm(f => ({...f, beschreibung: e.target.value}))} placeholder="Kurze Erklärung der Umfrage…" />
            </label>
            <label className="pz-label">Antwort-Typ
              <select className="pz-input" value={form.typ} onChange={e => setForm(f => ({...f, typ: e.target.value}))}>
                <option value="ja_nein">Ja / Nein</option>
                <option value="kommentar">Kommentar</option>
                <option value="beides">Ja/Nein + Kommentar</option>
              </select>
            </label>
            <label className="pz-label">Gültig bis
              <input className="pz-input" type="date" value={form.gueltig_bis} onChange={e => setForm(f => ({...f, gueltig_bis: e.target.value}))} />
            </label>
            <div className="pz-label" style={{ gridColumn: '1 / -1' }}>
              <span>Zielplattformen</span>
              <div className="pz-checkbox-group">
                {PLATTFORMEN_OPTS.map(p => (
                  <label key={p.key} className="pz-checkbox-label">
                    <input type="checkbox" checked={form.ziel_platformen.includes(p.key)} onChange={() => togglePlatform(p.key)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="pz-form-footer">
            <button className="pz-btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
            <button className="pz-btn-primary" onClick={handleSubmit} disabled={sending}>
              {sending ? 'Speichere…' : (editId ? 'Speichern' : 'Erstellen')}
            </button>
          </div>
        </div>
      )}

      {loading ? <div className="pz-loading">Lade Umfragen…</div> : (
        <div className="pz-umfragen-list">
          {list.length === 0 && <div className="pz-empty">Noch keine Umfragen vorhanden.</div>}
          {list.map(u => {
            const plattformen = (() => { try { return typeof u.ziel_platformen === 'string' ? JSON.parse(u.ziel_platformen) : (u.ziel_platformen || []); } catch { return []; } })();
            const isOpen = detailId === u.id;
            return (
              <div key={u.id} className="pz-umfrage-card">
                <div className="pz-umfrage-card-header">
                  <div className="pz-umfrage-info">
                    <span className="pz-umfrage-status" style={{ color: STATUS_COLORS[u.status] }}>● {STATUS_LABELS[u.status]}</span>
                    <h3 className="pz-umfrage-titel">{u.titel}</h3>
                    {u.beschreibung && <p className="pz-umfrage-desc">{u.beschreibung}</p>}
                    <div className="pz-umfrage-meta">
                      <span>{TYP_LABELS[u.typ]}</span>
                      {plattformen.length > 0 && <span>→ {plattformen.join(', ')}</span>}
                      {u.gueltig_bis && <span>bis {fmt(u.gueltig_bis)}</span>}
                    </div>
                  </div>
                  <div className="pz-umfrage-actions">
                    <div className="pz-umfrage-stats">
                      <span className="pz-stat-total">{u.antworten_gesamt || 0} Antworten</span>
                      {u.typ !== 'kommentar' && (
                        <>
                          <span className="pz-stat-ja">✓ {u.antworten_ja || 0}</span>
                          <span className="pz-stat-nein">✗ {u.antworten_nein || 0}</span>
                        </>
                      )}
                    </div>
                    <button className="pz-btn-icon" onClick={() => isOpen ? setDetailId(null) : loadDetail(u.id)} title="Antworten">
                      {isOpen ? '▲' : '▼'}
                    </button>
                    <button className="pz-btn-icon" onClick={() => openEdit(u)} title="Bearbeiten">✏️</button>
                    <button className="pz-btn-icon pz-btn-danger" onClick={() => handleDelete(u.id)} title="Löschen">🗑️</button>
                  </div>
                </div>

                {isOpen && (
                  <div className="pz-umfrage-detail">
                    {detailLoading ? <div className="pz-loading">Lade Antworten…</div> : (
                      detail?.length === 0 ? <div className="pz-empty">Noch keine Antworten.</div> : (
                        <table className="pz-antworten-table">
                          <thead><tr><th>Name</th><th>Dojo</th><th>Antwort</th><th>Kommentar</th><th>Datum</th></tr></thead>
                          <tbody>
                            {detail?.map((a, i) => (
                              <tr key={i}>
                                <td>{a.vorname} {a.nachname}</td>
                                <td>{a.dojoname || '—'}</td>
                                <td>{a.antwort ? (a.antwort === 'ja' ? '✓ Ja' : '✗ Nein') : '—'}</td>
                                <td>{a.kommentar || '—'}</td>
                                <td>{fmt(a.beantwortet_am)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

const TABS = [
  { id: 'uebersicht', icon: '🏠', label: 'Übersicht' },
  { id: 'kalender',   icon: '📅', label: 'Kalender' },
  { id: 'news',       icon: '📰', label: 'News' },
  { id: 'turniere',   icon: '🥊', label: 'Turniere' },
  { id: 'hof',        icon: '🌟', label: 'HoF Events' },
  { id: 'umfragen',   icon: '📋', label: 'Umfragen' },
];

export default function PlattformZentrale() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('uebersicht');

  return (
    <div className="pz-root">
      {/* Header + Tabs in einer Zeile */}
      <div className="pz-topbar">
        <div className="pz-topbar-left">
          <div className="pz-header-title-row">
            <span className="pz-header-icon">🌐</span>
            <span className="pz-header-title">Plattform-Zentrale</span>
          </div>
          <div className="pz-platform-badges">
            <a href="https://dojo.tda-intl.org" target="_blank" rel="noreferrer" className="pz-platform-link" style={{ color: PLATFORM_COLORS.dojo.text }}>🥋 Dojo</a>
            <a href="https://events.tda-intl.org" target="_blank" rel="noreferrer" className="pz-platform-link" style={{ color: PLATFORM_COLORS.events.text }}>🗓️ Events</a>
            <a href="https://hof.tda-intl.org" target="_blank" rel="noreferrer" className="pz-platform-link" style={{ color: PLATFORM_COLORS.hof.text }}>🌟 HoF</a>
          </div>
        </div>

        <div className="pz-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`pz-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab-Inhalt */}
      {activeTab === 'uebersicht' && <UebersichtView token={token} />}
      {activeTab === 'kalender'   && <KalenderView   token={token} />}
      {activeTab === 'news'       && <NewsView        token={token} />}
      {activeTab === 'turniere'   && <TurnierView     token={token} />}
      {activeTab === 'hof'        && <HofView         token={token} />}
      {activeTab === 'umfragen'   && <UmfragenView    token={token} />}
    </div>
  );
}
