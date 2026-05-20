import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const KAT_ICON = {
  MITGLIED: '👤', FINANZEN: '💰', VERTRAG: '📄', PRUEFUNG: '🥋',
  ADMIN: '⚙️', SEPA: '🏦', DOKUMENT: '📁', SYSTEM: '🖥️', AUTH: '🔐', SECURITY: '🛡️', IMPORT: '📥'
};
const KAT_COLOR = {
  MITGLIED: '#4ea8de', FINANZEN: '#d4af37', VERTRAG: '#74c0fc', PRUEFUNG: '#e36209',
  ADMIN: '#9b59b6', SEPA: '#27ae60', DOKUMENT: '#7f8c8d', SYSTEM: '#e74c3c',
  AUTH: '#f39c12', SECURITY: '#e74c3c', IMPORT: '#2ecc71'
};

const KATEGORIEN = [
  { value: '', label: 'Alle Kategorien' },
  { value: 'MITGLIED',  label: '👤 Mitglieder' },
  { value: 'FINANZEN',  label: '💰 Finanzen' },
  { value: 'VERTRAG',   label: '📄 Verträge' },
  { value: 'PRUEFUNG',  label: '🥋 Prüfungen' },
  { value: 'ADMIN',     label: '⚙️ Administration' },
  { value: 'SEPA',      label: '🏦 SEPA' },
  { value: 'DOKUMENT',  label: '📁 Dokumente' },
  { value: 'SYSTEM',    label: '🖥️ System' },
  { value: 'AUTH',      label: '🔐 Auth' },
  { value: 'SECURITY',  label: '🛡️ Security' },
  { value: 'IMPORT',    label: '📥 Import' },
];

const thS = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  color: 'var(--text-3)', fontWeight: 600, fontSize: '11px',
  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
};
const tdS = { padding: '0.45rem 0.75rem', verticalAlign: 'middle' };

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function AuditTrailTab({ token }) {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [stats, setStats]       = useState(null);
  const [expanded, setExpanded] = useState(null);

  const [filter, setFilter] = useState({
    kategorie: '', suchbegriff: '', von_datum: '', bis_datum: '', limit: 50, offset: 0
  });

  const headers = { Authorization: `Bearer ${token}` };

  const loadLogs = useCallback(async (f) => {
    setLoading(true);
    try {
      const params = { limit: f.limit, offset: f.offset };
      if (f.kategorie)   params.kategorie   = f.kategorie;
      if (f.suchbegriff) params.suchbegriff = f.suchbegriff;
      if (f.von_datum)   params.von_datum   = f.von_datum;
      if (f.bis_datum)   params.bis_datum   = f.bis_datum;

      const res = await axios.get('/audit-log', { headers, params });
      setLogs(res.data.data || []);
    } catch (e) {
      console.error('Audit-Log Fehler:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadStats = useCallback(async () => {
    try {
      const res = await axios.get('/audit-log/stats', { headers, params: { tage: 30 } });
      setStats(res.data.data);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    loadLogs(filter);
    loadStats();
  }, []);

  const apply = () => {
    const f = { ...filter, offset: 0 };
    setFilter(f);
    loadLogs(f);
  };

  const reset = () => {
    const f = { kategorie: '', suchbegriff: '', von_datum: '', bis_datum: '', limit: 50, offset: 0 };
    setFilter(f);
    loadLogs(f);
  };

  const goNext = () => {
    if (logs.length < filter.limit) return;
    const f = { ...filter, offset: filter.offset + filter.limit };
    setFilter(f);
    loadLogs(f);
  };

  const goPrev = () => {
    if (filter.offset === 0) return;
    const f = { ...filter, offset: Math.max(0, filter.offset - filter.limit) };
    setFilter(f);
    loadLogs(f);
  };

  const page = Math.floor(filter.offset / filter.limit) + 1;

  return (
    <div>
      {/* Kategorie-Stats (letzte 30 Tage) */}
      {stats?.nach_kategorie?.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '0.6rem',
          marginBottom: '1rem'
        }}>
          {stats.nach_kategorie.slice(0, 8).map(s => (
            <div key={s.kategorie} className="section-card" style={{ padding: '0.65rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', lineHeight: 1.2 }}>{KAT_ICON[s.kategorie] || '📋'}</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '0.2rem' }}>{s.anzahl}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '0.1rem' }}>{s.kategorie}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="section-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 170 }}>
            <label>Kategorie</label>
            <select value={filter.kategorie} onChange={e => setFilter(p => ({ ...p, kategorie: e.target.value }))}>
              {KATEGORIEN.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
            <label>Suche (Benutzer, Aktion, Entity…)</label>
            <input
              type="text"
              value={filter.suchbegriff}
              onChange={e => setFilter(p => ({ ...p, suchbegriff: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && apply()}
              placeholder="Freitext suchen…"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Von</label>
            <input type="date" value={filter.von_datum} onChange={e => setFilter(p => ({ ...p, von_datum: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Bis</label>
            <input type="date" value={filter.bis_datum} onChange={e => setFilter(p => ({ ...p, bis_datum: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Zeilen</label>
            <select value={filter.limit} onChange={e => setFilter(p => ({ ...p, limit: parseInt(e.target.value) }))}>
              {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={apply}>Filtern</button>
          <button className="btn-secondary" onClick={reset}>Zurücksetzen</button>
        </div>
      </div>

      {/* Tabelle */}
      <div className="section-card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
          <span style={{ color: 'var(--text-3)', fontSize: '13px' }}>
            {loading ? 'Lade…' : `${logs.length} Einträge — Seite ${page}`}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn-secondary" onClick={goPrev} disabled={filter.offset === 0} style={{ padding: '0.25rem 0.65rem', fontSize: '12px' }}>← Zurück</button>
            <button className="btn-secondary" onClick={goNext} disabled={logs.length < filter.limit} style={{ padding: '0.25rem 0.65rem', fontSize: '12px' }}>Weiter →</button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thS}>Zeit</th>
              <th style={thS}>Benutzer</th>
              <th style={thS}>Dojo</th>
              <th style={thS}>Kategorie</th>
              <th style={thS}>Aktion</th>
              <th style={thS}>Entity</th>
              <th style={thS}>Beschreibung</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <React.Fragment key={log.id}>
                <tr
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    background: expanded === log.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                    transition: 'background 0.15s'
                  }}
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <td style={{ ...tdS, whiteSpace: 'nowrap', color: 'var(--text-3)', fontSize: '12px' }}>{formatDt(log.created_at)}</td>
                  <td style={tdS}>{log.user_name || log.user_email || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                  <td style={{ ...tdS, color: 'var(--text-3)', fontSize: '12px' }}>{log.dojo_name || '—'}</td>
                  <td style={tdS}>
                    {log.kategorie ? (
                      <span style={{
                        background: (KAT_COLOR[log.kategorie] || '#666') + '28',
                        color: KAT_COLOR[log.kategorie] || 'var(--text-2)',
                        padding: '2px 7px', borderRadius: '4px',
                        fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap'
                      }}>
                        {KAT_ICON[log.kategorie] || ''} {log.kategorie}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={tdS}>
                    <code style={{ fontSize: '11px', color: 'var(--text-2)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px' }}>
                      {log.aktion || '—'}
                    </code>
                  </td>
                  <td style={{ ...tdS, fontSize: '12px', color: 'var(--text-2)' }}>
                    {log.entity_name || (log.entity_id ? `#${log.entity_id}` : '—')}
                  </td>
                  <td style={{ ...tdS, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-3)', fontSize: '12px' }}>
                    {log.beschreibung || '—'}
                  </td>
                </tr>

                {expanded === log.id && (
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <td colSpan={7} style={{ padding: '0.7rem 1rem', fontSize: '12px', color: 'var(--text-3)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.4rem 1rem' }}>
                        {log.ip_adresse && <span><strong style={{ color: 'var(--text-2)' }}>IP:</strong> {log.ip_adresse}</span>}
                        {log.user_role  && <span><strong style={{ color: 'var(--text-2)' }}>Rolle:</strong> {log.user_role}</span>}
                        {log.user_email && <span><strong style={{ color: 'var(--text-2)' }}>E-Mail:</strong> {log.user_email}</span>}
                        {log.entity_type && <span><strong style={{ color: 'var(--text-2)' }}>Entity-Typ:</strong> {log.entity_type}</span>}
                        {log.request_method && (
                          <span><strong style={{ color: 'var(--text-2)' }}>HTTP:</strong> {log.request_method} {log.request_path}</span>
                        )}
                        {log.beschreibung && (
                          <span style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: 'var(--text-2)' }}>Beschreibung:</strong> {log.beschreibung}
                          </span>
                        )}
                        {log.alte_werte && (
                          <span style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: 'var(--text-2)' }}>Alt:</strong>{' '}
                            <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                              {typeof log.alte_werte === 'string' ? log.alte_werte : JSON.stringify(log.alte_werte)}
                            </code>
                          </span>
                        )}
                        {log.neue_werte && (
                          <span style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: 'var(--text-2)' }}>Neu:</strong>{' '}
                            <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                              {typeof log.neue_werte === 'string' ? log.neue_werte : JSON.stringify(log.neue_werte)}
                            </code>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-3)' }}>
                  Keine Einträge gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
