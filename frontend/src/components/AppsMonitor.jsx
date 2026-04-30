import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/AppsMonitor.css';

const CATEGORY_LABELS = {
  all: 'Alle',
  saas: 'SaaS',
  platform: 'Plattform',
  pwa: 'PWA',
  website: 'Website',
};

function formatUptime(ms) {
  if (!ms) return '—';
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function Pm2Block({ pm2 }) {
  if (!pm2) return null;
  const status = pm2.status || '?';
  const cls = status === 'online' ? 'am-pm2-online' : status === 'stopped' ? 'am-pm2-stopped' : 'am-pm2-error';
  return (
    <div className="am-pm2">
      <div className="am-pm2-title">PM2</div>
      <div className="am-pm2-row">
        <span className={`am-pm2-status ${cls}`}>{status}</span>
        <span className="am-pm2-val">↑ {formatUptime(pm2.uptime)}</span>
        <span className="am-pm2-val">↻ {pm2.restarts ?? '—'}</span>
        <span className="am-pm2-val">RAM {formatBytes(pm2.memory)}</span>
      </div>
    </div>
  );
}

function AppCard({ app, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  const loading = app.httpStatus === undefined;
  const statusCls = loading ? 'loading' : app.online ? 'online' : 'offline';
  const statusLabel = loading ? '…' : app.online ? `Online · ${app.httpStatus}` : `Offline · ${app.httpStatus || 'Keine Antwort'}`;
  const respMs = app.responseMs;
  const respCls = !respMs ? '' : respMs < 500 ? 'fast' : respMs < 1500 ? 'medium' : 'slow';

  return (
    <div className={`am-card am-card--${statusCls}`}>
      <div className="am-card-top" onClick={() => setExpanded(e => !e)}>
        <span className="am-icon">{app.icon}</span>
        <div className="am-meta">
          <div className="am-name">
            {app.name}
            <span className={`am-cat am-cat--${app.category}`}>{CATEGORY_LABELS[app.category] || app.category}</span>
          </div>
          <div className="am-short">{app.short}</div>
        </div>
        <div className="am-status-group">
          <span className={`am-badge am-badge--${statusCls}`}>
            <span className={`am-dot am-dot--${statusCls}`} />
            {statusLabel}
          </span>
          {!loading && respMs && (
            <span className={`am-resp ${respCls}`}>{respMs}ms</span>
          )}
        </div>
        <span className="am-expand">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="am-details">
          <a href={app.url} target="_blank" rel="noopener noreferrer" className="am-url">{app.url}</a>

          <div className="am-info-grid">
            {app.tech && (
              <div className="am-info-row">
                <span className="am-info-label">Tech</span>
                <span className="am-info-val">
                  {app.tech.frontend}
                  {app.tech.backend && app.tech.backend !== '—' && ` · ${app.tech.backend}`}
                  {app.tech.db && ` · ${app.tech.db}`}
                </span>
              </div>
            )}
            {app.port && (
              <div className="am-info-row">
                <span className="am-info-label">Port</span>
                <span className="am-info-val"><code>{app.port}</code></span>
              </div>
            )}
            {app.pm2Name && (
              <div className="am-info-row">
                <span className="am-info-label">PM2</span>
                <span className="am-info-val"><code>{app.pm2Name}</code></span>
              </div>
            )}
            {app.localPath && (
              <div className="am-info-row">
                <span className="am-info-label">Pfad</span>
                <span className="am-info-val"><code>{app.localPath}</code></span>
              </div>
            )}
            {app.deploy && (
              <div className="am-info-row">
                <span className="am-info-label">Deploy</span>
                <span className="am-info-val"><code>{app.deploy}</code></span>
              </div>
            )}
          </div>

          {app.notes && <div className="am-notes">{app.notes}</div>}
          {app.pm2 && <Pm2Block pm2={app.pm2} />}

          <div className="am-actions">
            <a href={app.url} target="_blank" rel="noopener noreferrer" className="am-btn am-btn--primary">↗ Öffnen</a>
            {app.adminUrl && app.adminUrl !== app.url && (
              <a href={app.adminUrl} target="_blank" rel="noopener noreferrer" className="am-btn">⚙ Admin</a>
            )}
            <button className="am-btn" onClick={() => onCopy(app.url)}>📋 URL</button>
            {app.localPath && (
              <button className="am-btn" onClick={() => onCopy(`cd ${app.localPath}`)}>📁 Pfad</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppsMonitor() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [copyFlash, setCopyFlash] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/admin/apps');
      if (res.data?.success) {
        setApps(res.data.apps);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('AppsMonitor load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopyFlash(text.length > 40 ? text.slice(0, 37) + '…' : text);
    setTimeout(() => setCopyFlash(null), 2000);
  };

  const onlineCount  = apps.filter(a => a.online).length;
  const offlineCount = apps.filter(a => a.httpStatus !== undefined && !a.online).length;
  const pm2Count     = apps.filter(a => a.pm2?.status === 'online').length;
  const categories   = ['all', ...new Set(apps.map(a => a.category))];
  const filtered     = activeCategory === 'all' ? apps : apps.filter(a => a.category === activeCategory);

  return (
    <div className="am-root">
      {/* Header */}
      <div className="am-header">
        <div>
          <h2 className="am-title">🖥 Apps & Dienste</h2>
          <p className="am-subtitle">Live-Status aller TDA-Anwendungen</p>
        </div>
        <div className="am-header-right">
          {lastUpdate && (
            <span className="am-updated">
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button className="am-refresh-btn" onClick={load} disabled={loading}>
            {loading ? '…' : '↻'} Aktualisieren
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && apps.length > 0 && (
        <div className="am-summary">
          <div className="am-stat"><span className="am-stat-num">{apps.length}</span><span className="am-stat-label">Gesamt</span></div>
          <div className="am-stat"><span className="am-stat-num am-green">{onlineCount}</span><span className="am-stat-label">Online</span></div>
          <div className="am-stat"><span className="am-stat-num am-red">{offlineCount}</span><span className="am-stat-label">Offline</span></div>
          <div className="am-stat"><span className="am-stat-num am-gold">{pm2Count}</span><span className="am-stat-label">PM2 aktiv</span></div>
          <div className="am-stat"><span className="am-stat-num">{apps.filter(a => a.category === 'pwa').length}</span><span className="am-stat-label">PWAs</span></div>
        </div>
      )}

      {/* Category filter */}
      {!loading && (
        <div className="am-cats">
          {categories.map(cat => (
            <button
              key={cat}
              className={`am-cat-btn${activeCategory === cat ? ' active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat] || cat}
              {cat !== 'all' && <span className="am-cat-count">{apps.filter(a => a.category === cat).length}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="am-loading">
          <div className="am-spinner" />
          Pinge alle Dienste…
        </div>
      )}

      {/* App list */}
      {!loading && (
        <div className="am-list">
          {filtered.map(app => (
            <AppCard key={app.id} app={app} onCopy={handleCopy} />
          ))}
        </div>
      )}

      {copyFlash && (
        <div className="am-copy-flash">✓ Kopiert: {copyFlash}</div>
      )}
    </div>
  );
}
