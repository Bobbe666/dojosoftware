import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/PilotBewerbungen.css';

// ─── Konstanten ───────────────────────────────────────────────────────────────
const STATUS_META = {
  neu:         { label: 'Neu',         color: '#3b82f6', icon: '🆕' },
  in_pruefung: { label: 'In Prüfung',  color: '#f59e0b', icon: '🔍' },
  gewonnen:    { label: 'Gewonnen',    color: '#22c55e', icon: '🏆' },
  abgelehnt:   { label: 'Abgelehnt',   color: '#ef4444', icon: '✖' },
};

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function umfrageStatus(u) {
  if (u.beantwortet_am) return { icon: '✅', label: `Beantwortet ${fmtDate(u.beantwortet_am)}`, color: '#22c55e' };
  if (u.gesendet_am)    return { icon: '📤', label: `Gesendet ${fmtDate(u.gesendet_am)}${u.erinnert_am ? ' · erinnert' : ''}`, color: '#f59e0b' };
  return { icon: '📅', label: `Geplant für ${fmtDate(u.faellig_am)}`, color: '#94a3b8' };
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function PilotBewerbungen() {
  const { token } = useAuth();
  const authHeader = { Authorization: `Bearer ${token}` };

  const [bewerbungen, setBewerbungen] = useState([]);
  const [stats, setStats] = useState({ neu: 0, in_pruefung: 0, gewonnen: 0, abgelehnt: 0 });
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [notizDrafts, setNotizDrafts] = useState({});
  const [feedback, setFeedback] = useState({});         // { [bewerbungId]: umfragen[] }
  const [feedbackOpen, setFeedbackOpen] = useState(null); // geöffnete Antworten (umfrage.id)
  const [startDrafts, setStartDrafts] = useState({});
  const [auswertung, setAuswertung] = useState(null);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        axios.get(`/pilot-bewerbungen/admin${filter ? `?status=${filter}` : ''}`, { headers: authHeader }),
        axios.get('/pilot-bewerbungen/admin/stats', { headers: authHeader }),
      ]);
      setBewerbungen(bRes.data.bewerbungen || []);
      setStats(sRes.data.stats || {});
    } catch (err) {
      const m = err.response?.data?.error || err.message;
      showMsg('error', typeof m === 'string' ? m : JSON.stringify(m));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    axios.get('/pilot-feedback/admin/auswertung', { headers: authHeader })
      .then(r => setAuswertung(r.data.auswertung))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`/pilot-bewerbungen/admin/${id}`, { status }, { headers: authHeader });
      showMsg('success', `Status auf „${STATUS_META[status].label}" gesetzt`);
      load();
    } catch (err) {
      const m = err.response?.data?.error || err.message;
      showMsg('error', typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  const saveNotiz = async (id) => {
    try {
      await axios.put(`/pilot-bewerbungen/admin/${id}`, { notiz_intern: notizDrafts[id] ?? '' }, { headers: authHeader });
      showMsg('success', 'Notiz gespeichert');
      load();
    } catch (err) {
      const m = err.response?.data?.error || err.message;
      showMsg('error', typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  const loadFeedback = async (bewerbungId) => {
    try {
      const r = await axios.get(`/pilot-feedback/admin/${bewerbungId}`, { headers: authHeader });
      setFeedback(f => ({ ...f, [bewerbungId]: r.data.umfragen || [] }));
    } catch (err) {
      const m = err.response?.data?.error || err.message;
      showMsg('error', typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  const saveProgrammStart = async (bewerbungId) => {
    try {
      await axios.put(`/pilot-feedback/admin/programm-start/${bewerbungId}`,
        { programm_start: startDrafts[bewerbungId] }, { headers: authHeader });
      showMsg('success', 'Programm-Start gespeichert — Umfragen neu geplant');
      load();
      loadFeedback(bewerbungId);
    } catch (err) {
      const m = err.response?.data?.error || err.message;
      showMsg('error', typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  const sendeUmfrage = async (umfrageId, bewerbungId) => {
    try {
      await axios.post(`/pilot-feedback/admin/${umfrageId}/senden`, {}, { headers: authHeader });
      showMsg('success', 'Umfrage versendet');
      loadFeedback(bewerbungId);
    } catch (err) {
      const m = err.response?.data?.error || err.message;
      showMsg('error', typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Bewerbung wirklich löschen?')) return;
    try {
      await axios.delete(`/pilot-bewerbungen/admin/${id}`, { headers: authHeader });
      showMsg('success', 'Bewerbung gelöscht');
      load();
    } catch (err) {
      const m = err.response?.data?.error || err.message;
      showMsg('error', typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  const gesamt = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="pilot-bewerbungen">
      <div className="pb-header">
        <div>
          <h2>🏆 Pilot-Partner-Programm</h2>
          <p className="pb-sub">Bewerbungen von tda-intl.com/pilot-partner — jeden Monat gewinnt eine Schule 12 Monate kostenlose Nutzung.</p>
        </div>
        <button className="pb-refresh" onClick={load} disabled={loading}>{loading ? '⏳' : '🔄'} Aktualisieren</button>
      </div>

      {msg.text && <div className={`pb-msg pb-msg--${msg.type}`}>{msg.text}</div>}

      {/* Feedback-Auswertung — Zufriedenheit der Pilot-Partner */}
      {auswertung && auswertung.beantwortet > 0 && (
        <div className="pb-auswertung">
          <div className="pb-ausw-kpis">
            <div className="pb-ausw-kpi">
              <span className="pb-ausw-zahl">{auswertung.gesamt_schnitt ?? '–'}<small>/5</small></span>
              <span className="pb-ausw-label">⭐ Ø Zufriedenheit</span>
            </div>
            <div className="pb-ausw-kpi">
              <span className="pb-ausw-zahl">{auswertung.quote}<small>%</small></span>
              <span className="pb-ausw-label">Antwortquote</span>
            </div>
            <div className="pb-ausw-kpi">
              <span className="pb-ausw-zahl">{auswertung.beantwortet}<small>/{auswertung.gesendet}</small></span>
              <span className="pb-ausw-label">Fragebögen beantwortet</span>
            </div>
          </div>
          {auswertung.fragen.length > 0 && (
            <div className="pb-ausw-fragen">
              {auswertung.fragen.map(f => (
                <div className="pb-ausw-frage" key={f.key}>
                  <span className="pb-ausw-frage-text">{f.text}</span>
                  <span className="pb-ausw-bar">
                    <span className="pb-ausw-bar-fill" style={{ width: `${(f.schnitt / 5) * 100}%` }} />
                  </span>
                  <span className="pb-ausw-frage-wert">{f.schnitt} <em>({f.anzahl})</em></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status-Filter-Chips */}
      <div className="pb-chips">
        <button className={`pb-chip ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>
          Alle <span className="pb-chip-count">{gesamt}</span>
        </button>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <button
            key={key}
            className={`pb-chip ${filter === key ? 'active' : ''}`}
            style={{ '--chip-color': meta.color }}
            onClick={() => setFilter(filter === key ? '' : key)}
          >
            {meta.icon} {meta.label} <span className="pb-chip-count">{stats[key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Liste */}
      {bewerbungen.length === 0 && !loading && (
        <div className="pb-empty">Noch keine Bewerbungen{filter ? ' mit diesem Status' : ''}.</div>
      )}

      <div className="pb-list">
        {bewerbungen.map(b => {
          const meta = STATUS_META[b.status] || STATUS_META.neu;
          const isOpen = expanded === b.id;
          return (
            <div key={b.id} className={`pb-card ${isOpen ? 'open' : ''}`} style={{ borderLeft: `3px solid ${meta.color}` }}>
              <div
                className="pb-card-head"
                onClick={() => {
                  setExpanded(isOpen ? null : b.id);
                  if (!isOpen && b.status === 'gewonnen' && !feedback[b.id]) loadFeedback(b.id);
                }}
              >
                <div className="pb-card-main">
                  <span className="pb-school">{b.schulname}</span>
                  <span className="pb-meta">
                    {b.ansprechpartner} · {b.ort || 'Ort unbekannt'} · {b.mitglieder_anzahl ? `${b.mitglieder_anzahl} Mitglieder` : 'Mitgliederzahl unbekannt'}
                  </span>
                </div>
                <div className="pb-card-side">
                  <span className="pb-badge" style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55` }}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="pb-date">{fmt(b.created_at)}</span>
                  <span className="pb-toggle">{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {isOpen && (
                <div className="pb-card-body">
                  <div className="pb-grid">
                    <div><span className="pb-label">📧 E-Mail</span><a href={`mailto:${b.email}`}>{b.email}</a></div>
                    <div><span className="pb-label">📞 Telefon</span>{b.telefon || '—'}</div>
                    <div><span className="pb-label">🌐 Website</span>{b.website ? <a href={b.website.startsWith('http') ? b.website : `https://${b.website}`} target="_blank" rel="noreferrer">{b.website}</a> : '—'}</div>
                    <div><span className="pb-label">🥋 Stilrichtungen</span>{b.stilrichtungen || '—'}</div>
                    <div><span className="pb-label">💻 Aktuelle Software</span>{b.aktuelle_software || '—'}</div>
                    <div><span className="pb-label">👥 Mitglieder</span>{b.mitglieder_anzahl || '—'}</div>
                  </div>

                  <div className="pb-text-block">
                    <span className="pb-label">Größte Herausforderung</span>
                    <p>{b.herausforderung || '—'}</p>
                  </div>
                  <div className="pb-text-block">
                    <span className="pb-label">Warum Pilot-Partner werden?</span>
                    <p>{b.begruendung || '—'}</p>
                  </div>

                  <div className="pb-notiz">
                    <span className="pb-label">🗒 Interne Notiz</span>
                    <textarea
                      rows={2}
                      value={notizDrafts[b.id] ?? b.notiz_intern ?? ''}
                      onChange={e => setNotizDrafts(d => ({ ...d, [b.id]: e.target.value }))}
                      placeholder="Notiz für die Auswahl…"
                    />
                    <button className="pb-btn pb-btn--ghost" onClick={() => saveNotiz(b.id)}>Notiz speichern</button>
                  </div>

                  {b.status === 'gewonnen' && (
                    <div className="pb-feedback">
                      <div className="pb-feedback-head">
                        <span className="pb-label">📝 Feedback-Umfragen</span>
                        <div className="pb-start-row">
                          <span>Programm-Start:</span>
                          <input
                            type="date"
                            value={startDrafts[b.id] ?? (b.programm_start ? String(b.programm_start).slice(0, 10) : '')}
                            onChange={e => setStartDrafts(d => ({ ...d, [b.id]: e.target.value }))}
                          />
                          <button className="pb-btn pb-btn--ghost" onClick={() => saveProgrammStart(b.id)}>Speichern</button>
                        </div>
                      </div>

                      {!feedback[b.id] && <div className="pb-feedback-empty">⏳ Lade Umfragen…</div>}
                      {feedback[b.id]?.length === 0 && (
                        <div className="pb-feedback-empty">
                          Noch keine Umfragen geplant — Zeitplan: Tag 14 Einrichtung · Tag 28 Erfahrungen · danach alle 28 Tage.
                          Umfragen erscheinen hier, sobald sie (in den nächsten 7 Tagen) fällig werden.
                        </div>
                      )}

                      {(feedback[b.id] || []).map(u => {
                        const st = umfrageStatus(u);
                        const antwortenOffen = feedbackOpen === u.id;
                        return (
                          <div className="pb-umfrage" key={u.id}>
                            <div className="pb-umfrage-row">
                              <span className="pb-umfrage-status" style={{ color: st.color }}>{st.icon}</span>
                              <span className="pb-umfrage-titel">{u.titel}</span>
                              <span className="pb-umfrage-meta">{st.label}</span>
                              {!u.beantwortet_am && (
                                <button className="pb-btn pb-btn--ghost" onClick={() => sendeUmfrage(u.id, b.id)}>
                                  {u.gesendet_am ? '↺ Erneut senden' : '📤 Jetzt senden'}
                                </button>
                              )}
                              {u.beantwortet_am && (
                                <button className="pb-btn" onClick={() => setFeedbackOpen(antwortenOffen ? null : u.id)}>
                                  {antwortenOffen ? 'Antworten ▲' : 'Antworten ▼'}
                                </button>
                              )}
                            </div>
                            {antwortenOffen && u.antworten && (
                              <div className="pb-antworten">
                                {u.fragen.map(f => {
                                  const w = u.antworten[f.key];
                                  return (
                                    <div className="pb-antwort" key={f.key}>
                                      <span className="pb-label">{f.text}</span>
                                      {f.typ === 'rating' && (
                                        <span className="pb-sterne">{'★'.repeat(w)}{'☆'.repeat(5 - w)} <em>({w}/5)</em></span>
                                      )}
                                      {f.typ === 'choice' && <span>{Array.isArray(w) && w.length ? w.join(', ') : '—'}</span>}
                                      {f.typ === 'text' && <p className="pb-antwort-text">{w || '—'}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pb-actions">
                    {Object.entries(STATUS_META).filter(([k]) => k !== b.status).map(([key, m]) => (
                      <button key={key} className="pb-btn" style={{ '--btn-color': m.color }} onClick={() => updateStatus(b.id, key)}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                    <button className="pb-btn pb-btn--danger" onClick={() => remove(b.id)}>🗑 Löschen</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
