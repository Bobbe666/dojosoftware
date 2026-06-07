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
              <div className="pb-card-head" onClick={() => setExpanded(isOpen ? null : b.id)}>
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
