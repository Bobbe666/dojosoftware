import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const AUTO_REFRESH_INTERVAL = 30; // Sekunden

function fmtUptime(s) {
  if (!s) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function fmtMem(bytes) {
  if (!bytes) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function fmtUptimeMs(ms) {
  if (!ms) return '—';
  return fmtUptime(Math.floor((Date.now() - ms) / 1000));
}

function StatusDot({ status }) {
  const colors = {
    ok: '#27ae60', online: '#27ae60', stopped: '#e74c3c', errored: '#e74c3c',
    warning: '#f39c12', unknown: '#7f8c8d', offline: '#e74c3c',
    launching: '#3498db', one_launch: '#f39c12'
  };
  const color = colors[status] || colors.unknown;
  return (
    <span style={{
      display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
      background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0
    }} />
  );
}

function SslBadge({ daysLeft, status }) {
  if (status === 'ok') return <span style={{ color: '#27ae60', fontWeight: 700, fontSize: '0.78rem' }}>✓ {daysLeft}d</span>;
  if (status === 'warning') return <span style={{ color: '#f39c12', fontWeight: 700, fontSize: '0.78rem' }}>⚠ {daysLeft}d</span>;
  if (status === 'critical') return <span style={{ color: '#e74c3c', fontWeight: 700, fontSize: '0.78rem' }}>🔴 {daysLeft}d</span>;
  if (status === 'expired') return <span style={{ color: '#e74c3c', fontWeight: 700, fontSize: '0.78rem' }}>ABGELAUFEN</span>;
  return <span style={{ color: '#7f8c8d', fontSize: '0.78rem' }}>—</span>;
}

function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div className="section-card" style={{ padding: '0.85rem' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon && <span style={{ marginRight: '0.3rem' }}>{icon}</span>}{label}
      </div>
      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: color || 'inherit' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
}

function DiskBar({ usedGB, totalGB, percent }) {
  const color = percent >= 90 ? '#e74c3c' : percent >= 75 ? '#f39c12' : '#27ae60';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '12px' }}>
        <span style={{ color: 'var(--text-2)' }}>{usedGB} GB belegt von {totalGB} GB</span>
        <span style={{ color, fontWeight: 700 }}>{percent}%</span>
      </div>
      <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export default function PlatformStatusTab({ token }) {
  const [metrics, setMetrics]   = useState(null);
  const [infra, setInfra]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [infraLoading, setInfraLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL);
  const countdownRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/admin/platform-metrics', { headers });
      setMetrics(res.data);
      setLastFetch(new Date());
    } catch (e) {
      console.error('Platform-Metrics Fehler:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadInfra = useCallback(async () => {
    setInfraLoading(true);
    try {
      const res = await axios.get('/admin/infra-checks', { headers });
      setInfra(res.data);
    } catch (e) {
      console.error('Infra-Checks Fehler:', e);
    } finally {
      setInfraLoading(false);
    }
  }, [token]);

  const loadAll = useCallback(() => {
    loadMetrics();
    loadInfra();
    setCountdown(AUTO_REFRESH_INTERVAL);
  }, [loadMetrics, loadInfra]);

  useEffect(() => {
    loadAll();
  }, []);

  // Auto-refresh countdown
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          loadAll();
          return AUTO_REFRESH_INTERVAL;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [loadAll]);

  const planMap = {};
  (metrics?.dojos_by_plan || []).forEach(row => {
    const plan = row.subscription_plan || 'trial';
    if (!planMap[plan]) planMap[plan] = 0;
    planMap[plan] += parseInt(row.anzahl);
  });
  const totalDojos = Object.values(planMap).reduce((a, b) => a + b, 0);
  const totalToday = metrics?.total_actions_today || 0;
  const isLoading = loading || infraLoading;

  const dbColor = metrics?.db_latency_ms != null
    ? (metrics.db_latency_ms < 50 ? '#27ae60' : metrics.db_latency_ms < 200 ? '#f39c12' : '#e74c3c')
    : undefined;

  const heapMB = metrics?.memory_mb;
  const ramColor = heapMB != null ? (heapMB < 400 ? '#27ae60' : heapMB < 700 ? '#f39c12' : '#e74c3c') : undefined;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>🖥️ System-Status</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastFetch && (
            <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>
              {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {' · '}
              <span style={{ color: countdown <= 10 ? '#f39c12' : 'var(--text-3)' }}>
                Aktualisierung in {countdown}s
              </span>
            </span>
          )}
          <button className="btn-secondary" onClick={loadAll} disabled={isLoading} style={{ padding: '0.3rem 0.75rem', fontSize: '12px' }}>
            {isLoading ? '⏳' : '↺'} Jetzt
          </button>
        </div>
      </div>

      {/* System-Metriken */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
        <MetricCard
          icon="💚" label="Backend"
          value={metrics ? 'Online' : '—'}
          color={metrics ? '#27ae60' : '#e74c3c'}
          sub={metrics?.uptime_s != null ? `↑ ${fmtUptime(metrics.uptime_s)}` : undefined}
        />
        <MetricCard
          icon="🗄️" label="Datenbank"
          value={metrics?.db_latency_ms != null ? `${metrics.db_latency_ms} ms` : '—'}
          color={dbColor}
          sub="Latenz"
        />
        <MetricCard
          icon="🧠" label="Node RAM"
          value={heapMB != null ? `${heapMB} MB` : '—'}
          color={ramColor}
          sub="Heap-Speicher"
        />
        {infra?.disk && (
          <MetricCard
            icon="💾" label="Festplatte"
            value={`${infra.disk.percentUsed}%`}
            color={infra.disk.percentUsed >= 90 ? '#e74c3c' : infra.disk.percentUsed >= 75 ? '#f39c12' : '#27ae60'}
            sub={`${infra.disk.usedGB}/${infra.disk.totalGB} GB`}
          />
        )}
        <MetricCard icon="👥" label="Mitglieder" value={metrics?.members?.aktiv ?? '—'} sub={`von ${metrics?.members?.gesamt ?? '—'} gesamt`} />
        <MetricCard icon="📊" label="Aktionen heute" value={totalToday} sub="Audit-Log" />
      </div>

      {/* PM2 Prozesse */}
      {infra?.processes && infra.processes.length > 0 && (
        <div className="section-card" style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>
            ⚙️ PM2 Prozesse
            {infraLoading && <span style={{ color: 'var(--text-3)', fontSize: '11px', marginLeft: '0.5rem' }}>lädt…</span>}
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: 'var(--text-3)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '0 0.5rem 0.4rem 0', whiteSpace: 'nowrap' }}>Name</th>
                  <th style={{ textAlign: 'center', padding: '0 0.5rem 0.4rem', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '0 0.5rem 0.4rem', whiteSpace: 'nowrap' }}>Uptime</th>
                  <th style={{ textAlign: 'right', padding: '0 0.5rem 0.4rem', whiteSpace: 'nowrap' }}>RAM</th>
                  <th style={{ textAlign: 'right', padding: '0 0.5rem 0.4rem', whiteSpace: 'nowrap' }}>CPU</th>
                  <th style={{ textAlign: 'right', padding: '0 0 0.4rem 0.5rem', whiteSpace: 'nowrap' }}>Restarts</th>
                </tr>
              </thead>
              <tbody>
                {infra.processes.map((p, i) => {
                  const statusColor = p.status === 'online' ? '#27ae60' : p.status === 'stopped' ? '#e74c3c' : '#f39c12';
                  const restartWarning = p.restarts > 5;
                  return (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '0.45rem 0.5rem 0.45rem 0', color: 'var(--text-1)', fontWeight: 500 }}>
                        <StatusDot status={p.status} />
                        <span style={{ marginLeft: '0.4rem' }}>{p.name}</span>
                        {p.pid && <span style={{ color: 'var(--text-3)', fontSize: '11px', marginLeft: '0.3rem' }}>#{p.pid}</span>}
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ color: statusColor, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>{p.status}</span>
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: 'var(--text-2)' }}>
                        {fmtUptimeMs(p.uptime)}
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: 'var(--text-2)' }}>
                        {fmtMem(p.memory)}
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: p.cpu > 50 ? '#f39c12' : 'var(--text-2)' }}>
                        {p.cpu}%
                      </td>
                      <td style={{ padding: '0.45rem 0 0.45rem 0.5rem', textAlign: 'right', color: restartWarning ? '#e74c3c' : 'var(--text-2)' }}>
                        {restartWarning ? `⚠ ${p.restarts}` : p.restarts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Services + SSL nebeneinander */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Service Health */}
        <div className="section-card">
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>
            🌐 Services
            {infraLoading && <span style={{ color: 'var(--text-3)', fontSize: '11px', marginLeft: '0.5rem' }}>prüft…</span>}
          </h4>
          {!infra?.services ? (
            <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Lade…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {infra.services.map((s, i) => {
                const msColor = !s.ok ? '#e74c3c' : s.ms > 1000 ? '#f39c12' : '#27ae60';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px' }}>
                    <StatusDot status={s.ok ? 'online' : 'offline'} />
                    <span style={{ fontSize: '13px' }}>{s.icon}</span>
                    <span style={{ flex: 1, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </span>
                    <span style={{ color: msColor, fontWeight: 600, flexShrink: 0 }}>
                      {s.ok ? `${s.ms}ms` : (s.error || `${s.status || 'ERR'}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {infra?.checkedAt && (
            <div style={{ marginTop: '0.6rem', fontSize: '11px', color: 'var(--text-3)' }}>
              Geprüft: {new Date(infra.checkedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>

        {/* SSL Zertifikate */}
        <div className="section-card">
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>🔒 SSL-Zertifikate</h4>
          {!infra?.sslCerts ? (
            <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Lade…</div>
          ) : infra.sslCerts.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Keine Zertifikate gefunden</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {infra.sslCerts.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px' }}>
                  <StatusDot status={c.status === 'ok' ? 'online' : c.status === 'warning' ? 'warning' : 'offline'} />
                  <span style={{ flex: 1, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.domains}>
                    {c.name}
                    {c.renewalType === 'manual' && <span style={{ color: '#f39c12', fontSize: '10px', marginLeft: '0.3rem' }}>manuell</span>}
                  </span>
                  <SslBadge daysLeft={c.daysLeft} status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Festplatten-Balken falls vorhanden */}
      {infra?.disk && (
        <div className="section-card" style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>💾 Speicherplatz (Root-Filesystem)</h4>
          <DiskBar
            usedGB={infra.disk.usedGB}
            totalGB={infra.disk.totalGB}
            percent={infra.disk.percentUsed}
          />
        </div>
      )}

      {/* Platform-Statistiken */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="section-card">
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>Dojos nach Plan</h4>
          {Object.keys(planMap).length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Keine Daten</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(planMap).sort((a, b) => b[1] - a[1]).map(([plan, count]) => {
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

        <div className="section-card">
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>Aktivität heute (Kategorie)</h4>
          {(metrics?.today_activity || []).length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Noch keine Aktivität heute</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {(metrics.today_activity || []).map(row => {
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

      {(metrics?.top_dojos_today || []).length > 0 && (
        <div className="section-card" style={{ marginTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>Top aktive Dojos heute</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
            {metrics.top_dojos_today.map((d, i) => (
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
