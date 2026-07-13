import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const STATUS = {
  ok:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  label: 'OK',      icon: '✓' },
  warn:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'WARNUNG', icon: '!' },
  fail:  { color: '#ef4444', bg: 'rgba(239,68,68,0.14)',  label: 'FEHLER',  icon: '✕' },
  error: { color: '#a855f7', bg: 'rgba(168,85,247,0.14)', label: 'CHECK-FEHLER', icon: '⚠' },
};

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.error;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
      background: s.bg, color: s.color, border: `1px solid ${s.color}`,
      borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
    }}>{s.icon} {s.label}</span>
  );
}

export default function SicherheitsChecksTab({ token }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.get('/admin/security-checks', { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const overall = data?.summary?.overall;
  const overallStyle = STATUS[overall] || STATUS.ok;

  return (
    <div className="section-card" style={{ background: 'rgba(20,25,35,0.6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>🔒 Mandanten-Sicherheit &amp; Integrität</h3>
        <button onClick={load} disabled={loading}
          style={{ marginLeft: 'auto', background: '#f5c518', color: '#1a1a2e', border: 'none',
            borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? 'Prüfe…' : '↻ Jetzt prüfen'}
        </button>
      </div>
      <p style={{ color: 'var(--text-3, #93a0b2)', fontSize: 13, margin: '4px 0 16px' }}>
        Read-only Selbst-Diagnose: Cross-Tenant-Lecks, Subdomain-Integrität, Modul-Health und Config-Vollständigkeit.
      </p>

      {error && (
        <div style={{ background: STATUS.fail.bg, color: STATUS.fail.color, border: `1px solid ${STATUS.fail.color}`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>Fehler: {error}</div>
      )}

      {data && (
        <>
          {/* Gesamt-Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            background: overallStyle.bg, border: `1px solid ${overallStyle.color}`, borderRadius: 10,
            padding: '14px 16px', marginBottom: 18 }}>
            <span style={{ fontSize: 26 }}>{overall === 'ok' ? '🟢' : overall === 'warn' ? '🟡' : '🔴'}</span>
            <div>
              <div style={{ fontWeight: 750, fontSize: 16, color: overallStyle.color }}>
                {overall === 'ok' ? 'Alles sauber' : overall === 'warn' ? 'Warnungen — prüfen' : 'Handlungsbedarf'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3, #93a0b2)', marginTop: 2 }}>
                {data.summary.ok} OK · {data.summary.warn} Warnung(en) · {data.summary.fail} Fehler
                {data.summary.error > 0 ? ` · ${data.summary.error} Check-Fehler` : ''}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3, #93a0b2)' }}>
              zuletzt: {new Date(data.generated_at).toLocaleString('de-DE')}
            </div>
          </div>

          {/* Kategorien */}
          {data.categories.map(cat => {
            const worst = cat.checks.some(c => c.status === 'fail' || c.status === 'error') ? 'fail'
              : cat.checks.some(c => c.status === 'warn') ? 'warn' : 'ok';
            return (
              <div key={cat.key} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 14 }}>{cat.title}</h4>
                  <StatusPill status={worst} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cat.checks.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                      borderLeft: `3px solid ${(STATUS[c.status] || STATUS.error).color}`,
                      borderRadius: 8, padding: '9px 12px' }}>
                      <StatusPill status={c.status} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                          {c.label}{c.value !== null && c.value !== undefined ? ` — ${c.value}` : ''}
                        </div>
                        {c.detail && (
                          <div style={{ fontSize: 12, color: 'var(--text-3, #93a0b2)', marginTop: 3, wordBreak: 'break-word' }}>
                            {c.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {!data && loading && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-3, #93a0b2)' }}>Prüfe…</div>
      )}
    </div>
  );
}
