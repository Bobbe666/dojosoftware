import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const PLAN_CFG = {
  enterprise: { label: 'Enterprise', color: '#d4af37', icon: '👑' },
  pro:        { label: 'Pro',        color: '#8b5cf6', icon: '⭐' },
  basic:      { label: 'Basic',      color: '#4ea8de', icon: '📦' },
  free:       { label: 'Free',       color: '#27ae60', icon: '🆓' },
  custom:     { label: 'Custom',     color: '#e36209', icon: '🔧' },
  trial:      { label: 'Trial',      color: '#7f8c8d', icon: '🕐' },
};

const KAT_ICON = {
  MITGLIED: '👤', FINANZEN: '💰', VERTRAG: '📄', PRUEFUNG: '🥋',
  ADMIN: '⚙️', SEPA: '🏦', DOKUMENT: '📁', SYSTEM: '🖥️',
  AUTH: '🔐', SECURITY: '🛡️', IMPORT: '📥'
};

function fmtUptime(s) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function HealthDot({ ok }) {
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: ok ? '#27ae60' : '#e74c3c',
      boxShadow: ok ? '0 0 6px #27ae60' : '0 0 6px #e74c3c',
      marginRight: 6
    }} />
  );
}

export default function PlatformStatusTab({ token }) {
  const [data, setData]       = useState(null);
  const [health, setHealth]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, healthRes] = await Promise.allSettled([
        axios.get('/admin/platform-metrics', { headers }),
        axios.get('/health', { headers })
      ]);
      if (metricsRes.status === 'fulfilled') setData(metricsRes.value.data);
      if (healthRes.status === 'fulfilled')  setHealth(healthRes.value.data);
      setLastFetch(new Date());
    } catch (e) {
      console.error('Platform-Metrics Fehler:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, []);

  // Dojos nach Plan gruppieren
  const planMap = {};
  (data?.dojos_by_plan || []).forEach(row => {
    const plan = row.subscription_plan || 'trial';
    if (!planMap[plan]) planMap[plan] = 0;
    planMap[plan] += parseInt(row.anzahl);
  });

  const totalDojos = Object.values(planMap).reduce((a, b) => a + b, 0);
  const totalToday = data?.total_actions_today || 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>🖥️ Platform-Status</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastFetch && (
            <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>
              Stand: {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button className="btn-secondary" onClick={load} disabled={loading} style={{ padding: '0.3rem 0.75rem', fontSize: '12px' }}>
            {loading ? '⏳ Lade…' : '↺ Aktualisieren'}
          </button>
        </div>
      </div>

      {/* System-Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="section-card" style={{ padding: '0.9rem' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Backend</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>
            <HealthDot ok={health?.status === 'ok' || !!data} />
            {health?.status === 'ok' ? 'Online' : data ? 'Teilweise' : '—'}
          </div>
          {data?.uptime_s != null && (
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.2rem' }}>↑ {fmtUptime(data.uptime_s)}</div>
          )}
        </div>

        <div className="section-card" style={{ padding: '0.9rem' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datenbank</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>
            <HealthDot ok={(data?.db_latency_ms ?? 999) < 200} />
            {data?.db_latency_ms != null ? `${data.db_latency_ms} ms` : '—'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.2rem' }}>Latenz</div>
        </div>

        <div className="section-card" style={{ padding: '0.9rem' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Speicher</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{data?.memory_mb != null ? `${data.memory_mb} MB` : '—'}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.2rem' }}>Heap (Node.js)</div>
        </div>

        <div className="section-card" style={{ padding: '0.9rem' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aktionen heute</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{totalToday}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.2rem' }}>Audit-Log Einträge</div>
        </div>

        <div className="section-card" style={{ padding: '0.9rem' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mitglieder</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{data?.members?.aktiv ?? '—'}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.2rem' }}>aktiv / {data?.members?.gesamt ?? '—'} gesamt</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Dojos nach Plan */}
        <div className="section-card">
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>Dojos nach Plan</h4>
          {Object.keys(planMap).length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Keine Daten</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(planMap)
                .sort((a, b) => b[1] - a[1])
                .map(([plan, count]) => {
                  const cfg = PLAN_CFG[plan] || { label: plan, color: '#888', icon: '📋' };
                  const pct = totalDojos > 0 ? Math.round(count / totalDojos * 100) : 0;
                  return (
                    <div key={plan}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '13px' }}>
                        <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.icon} {cfg.label}</span>
                        <span style={{ color: 'var(--text-2)' }}>{count} <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 3, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Heutige Aktivität nach Kategorie */}
        <div className="section-card">
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>Aktivität heute (nach Kategorie)</h4>
          {(data?.today_activity || []).length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Noch keine Aktivität heute</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {(data.today_activity || []).map(row => {
                const pct = totalToday > 0 ? Math.round(row.anzahl / totalToday * 100) : 0;
                return (
                  <div key={row.kategorie} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>
                    <span style={{ width: 22, textAlign: 'center', fontSize: '14px' }}>{KAT_ICON[row.kategorie] || '📋'}</span>
                    <span style={{ flex: 1, color: 'var(--text-2)' }}>{row.kategorie}</span>
                    <span style={{ color: 'var(--text-2)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{row.anzahl}</span>
                    <div style={{ width: 60, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary, #d4af37)', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top aktive Dojos heute */}
      {(data?.top_dojos_today || []).length > 0 && (
        <div className="section-card" style={{ marginTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>Top aktive Dojos heute</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
            {data.top_dojos_today.map((d, i) => (
              <div key={d.dojo_id || i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.04)',
                borderRadius: 6, fontSize: '13px'
              }}>
                <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                  {d.dojo_name || `Dojo #${d.dojo_id}`}
                </span>
                <span style={{ color: 'var(--text-3)', fontWeight: 600, marginLeft: '0.5rem', flexShrink: 0 }}>
                  {d.aktionen}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
