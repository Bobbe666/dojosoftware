import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Cpu, HardDrive, Activity } from 'lucide-react';
import './InfraChecks.css';

const fmt = (ms) => ms < 0 ? '—' : ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`;

const fmtUptime = (ts) => {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}min`;
  if (s < 86400) return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}min`;
  return `${Math.floor(s/86400)}d ${Math.floor((s%86400)/3600)}h`;
};

const fmtMem = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(0)}KB`;
  return `${(bytes/1024/1024).toFixed(0)}MB`;
};

const sslBadge = (status) => {
  if (status === 'ok') return <span className="ic-badge ic-badge--ok">✓ OK</span>;
  if (status === 'warning') return <span className="ic-badge ic-badge--warn">⚠ bald</span>;
  if (status === 'critical') return <span className="ic-badge ic-badge--crit">🔴 kritisch</span>;
  if (status === 'expired') return <span className="ic-badge ic-badge--crit">✗ abgelaufen</span>;
  return <span className="ic-badge">—</span>;
};

const pm2Badge = (status) => {
  if (status === 'online') return <span className="ic-badge ic-badge--ok">online</span>;
  if (status === 'stopped') return <span className="ic-badge ic-badge--neutral">gestoppt</span>;
  if (status === 'errored') return <span className="ic-badge ic-badge--crit">Fehler</span>;
  if (status === 'stopping') return <span className="ic-badge ic-badge--warn">stoppt…</span>;
  return <span className="ic-badge">{status}</span>;
};

export default function InfraChecks() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const res = await axios.get('/admin/infra-checks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setData(res.data);
        setCheckedAt(new Date(res.data.checkedAt));
      }
    } catch (e) {
      console.error('InfraChecks Fehler:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const okServices = data?.services?.filter(s => s.ok).length ?? 0;
  const totalServices = data?.services?.length ?? 0;
  const okSsl = data?.sslCerts?.filter(c => c.status === 'ok').length ?? 0;
  const warnSsl = data?.sslCerts?.filter(c => ['warning','critical','expired'].includes(c.status)).length ?? 0;
  const onlineProcesses = data?.processes?.filter(p => p.status === 'online').length ?? 0;

  return (
    <div className="ic-wrap">
      {/* Header */}
      <div className="ic-header">
        <div className="ic-header-left">
          <Activity size={20} />
          <span>Infrastruktur-Checks</span>
          {checkedAt && (
            <span className="ic-ts">geprüft: {checkedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          )}
        </div>
        <button className="ic-refresh" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'ic-spin' : ''} />
          {loading ? 'Prüft…' : 'Aktualisieren'}
        </button>
      </div>

      {/* Summary pills */}
      {data && (
        <div className="ic-summary">
          <div className={`ic-pill ${okServices < totalServices ? 'ic-pill--warn' : 'ic-pill--ok'}`}>
            <Activity size={14} />
            <span>{okServices}/{totalServices} Dienste erreichbar</span>
          </div>
          <div className={`ic-pill ${warnSsl > 0 ? 'ic-pill--warn' : 'ic-pill--ok'}`}>
            <CheckCircle size={14} />
            <span>{okSsl} SSL OK{warnSsl > 0 ? `, ${warnSsl} Handlungsbedarf` : ''}</span>
          </div>
          <div className={`ic-pill ${onlineProcesses < (data.processes?.length ?? 0) ? 'ic-pill--warn' : 'ic-pill--ok'}`}>
            <Cpu size={14} />
            <span>{onlineProcesses}/{data.processes?.length ?? 0} PM2-Prozesse online</span>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="ic-loading">
          <RefreshCw size={24} className="ic-spin" />
          <span>Prüfe alle Dienste… (kann bis zu 10s dauern)</span>
        </div>
      )}

      {data && (
        <>
          {/* Services */}
          <section className="ic-section">
            <h3 className="ic-section-title">🌐 Dienste (HTTP Health)</h3>
            <div className="ic-service-grid">
              {data.services.map((s) => (
                <div key={s.name} className={`ic-service-card ${s.ok ? 'ic-service-card--ok' : 'ic-service-card--err'}`}>
                  <div className="ic-service-icon">{s.icon}</div>
                  <div className="ic-service-info">
                    <span className="ic-service-name">{s.name}</span>
                    <span className="ic-service-meta">
                      {s.ok
                        ? <><span className="ic-ok-dot" />{s.status} · {fmt(s.ms)}</>
                        : <><span className="ic-err-dot" />{s.error || `HTTP ${s.status}`}</>
                      }
                    </span>
                  </div>
                  {s.ok
                    ? <CheckCircle size={16} className="ic-status-icon ic-status-icon--ok" />
                    : <XCircle size={16} className="ic-status-icon ic-status-icon--err" />
                  }
                </div>
              ))}
            </div>
          </section>

          {/* SSL Certs */}
          <section className="ic-section">
            <h3 className="ic-section-title">🔒 SSL-Zertifikate</h3>
            {data.sslCerts.length === 0 ? (
              <p className="ic-empty">Keine Zertifikate gefunden (certbot nicht erreichbar?)</p>
            ) : (
              <div className="ic-table-wrap">
                <table className="ic-table">
                  <thead>
                    <tr>
                      <th>Zertifikat</th>
                      <th>Domains</th>
                      <th>Ablauf</th>
                      <th>Verbleibend</th>
                      <th>Erneuerung</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sslCerts.map((c) => (
                      <tr key={c.name} className={c.status !== 'ok' ? 'ic-tr--warn' : ''}>
                        <td className="ic-td-name">{c.name}</td>
                        <td className="ic-td-domains">{c.domains}</td>
                        <td className="ic-td-mono">{c.expiryDate ? c.expiryDate.split(' ')[0] : '—'}</td>
                        <td className="ic-td-days">
                          {c.daysLeft !== null
                            ? <span className={c.daysLeft <= 7 ? 'ic-days--crit' : c.daysLeft <= 30 ? 'ic-days--warn' : 'ic-days--ok'}>{c.daysLeft}d</span>
                            : '—'
                          }
                        </td>
                        <td><span className="ic-renew-badge">{c.renewalType === 'auto' ? '🤖 auto' : '✋ manuell'}</span></td>
                        <td>{sslBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* PM2 Processes */}
          <section className="ic-section">
            <h3 className="ic-section-title">⚙️ PM2-Prozesse</h3>
            {data.processes.length === 0 ? (
              <p className="ic-empty">Keine PM2-Prozesse gefunden</p>
            ) : (
              <div className="ic-table-wrap">
                <table className="ic-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Laufzeit</th>
                      <th>Neustarts</th>
                      <th><HardDrive size={12} /> Memory</th>
                      <th><Cpu size={12} /> CPU</th>
                      <th>PID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.processes.map((p) => (
                      <tr key={p.id} className={p.status !== 'online' ? 'ic-tr--warn' : ''}>
                        <td className="ic-td-mono">{p.id}</td>
                        <td className="ic-td-name">{p.name}</td>
                        <td>{pm2Badge(p.status)}</td>
                        <td><Clock size={11} style={{ marginRight: 4, opacity: 0.6 }} />{fmtUptime(p.uptime)}</td>
                        <td className={p.restarts > 5 ? 'ic-warn-text' : ''}>{p.restarts}</td>
                        <td>{fmtMem(p.memory)}</td>
                        <td>{p.cpu}%</td>
                        <td className="ic-td-mono">{p.pid || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
