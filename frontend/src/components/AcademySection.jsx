// ── TDA-Academy-Sektion (ausgelagert aus SuperAdminDashboard.jsx) ────────────
import React, { useState, useEffect } from 'react';

export default function AcademySection() {
  const [subTab, setSubTab] = useState('uebersicht');
  const [stats, setStats] = useState(null);
  const [kurse, setKurse] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('https://academy.tda-intl.org/api/admin/public-stats').then(r => r.json()).catch(() => null),
      fetch('https://academy.tda-intl.org/api/kurse').then(r => r.json()).catch(() => null),
    ]).then(([s, k]) => {
      if (s?.success) setStats(s.stats);
      if (k?.success) {
        const heute = new Date(); heute.setHours(0, 0, 0, 0);
        const upcoming = (k.kurse || [])
          .filter(c => new Date(c.start_datum) >= heute)
          .sort((a, b) => new Date(a.start_datum) - new Date(b.start_datum))
          .slice(0, 5);
        setKurse(upcoming);
      }
    }).finally(() => setLoading(false));
  }, []);

  const SCHNELLZUGRIFF = [
    { icon: '🏠', label: 'Dashboard',    url: 'https://academy.tda-intl.org/admin' },
    { icon: '📚', label: 'Kurse',        url: 'https://academy.tda-intl.org/admin' },
    { icon: '📋', label: 'Buchungen',    url: 'https://academy.tda-intl.org/admin' },
    { icon: '👥', label: 'Teilnehmer',   url: 'https://academy.tda-intl.org/admin' },
    { icon: '🎓', label: 'Zertifikate',  url: 'https://academy.tda-intl.org/admin' },
    { icon: '↗',  label: 'Zur Academy',  url: 'https://academy.tda-intl.org' },
  ];

  return (
    <div>
      <div className="sad-hof-header">
        <h2 className="sad-hof-title">🎓 TDA Academy — academy.tda-intl.org</h2>
        <div className="sad-hof-btn-row">
          <a href="https://academy.tda-intl.org/admin" target="_blank" rel="noreferrer" className="sad-hof-admin-link">
            🔐 Academy Admin
          </a>
          <a href="https://academy.tda-intl.org" target="_blank" rel="noreferrer" className="sad-hof-public-link">
            ↗ academy.tda-intl.org
          </a>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="sad-sw-tabs">
        {[
          { id: 'uebersicht', label: '📊 Übersicht' },
          { id: 'kurse',      label: '📚 Bevorstehende Kurse' },
          { id: 'vorschau',   label: '👁 Vorschau' },
        ].map(t => (
          <button key={t.id} className={`sad-sw-tab${subTab === t.id ? ' active' : ''}`} onClick={() => setSubTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'uebersicht' && (
        <div>
          {loading ? <div className="sad-hof-loading">Lade…</div> : stats ? (
            <>
              {/* Stat-Karten */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Kurse aktiv',     val: stats.kurse_aktiv,     icon: '📚', color: '#22c55e' },
                  { label: 'Bevorstehend',    val: stats.kurse_upcoming,  icon: '🗓️', color: '#3b82f6' },
                  { label: 'Buchungen ges.',  val: stats.buchungen_gesamt,icon: '📋', color: '#f59e0b' },
                  { label: 'Buchungen offen', val: stats.buchungen_offen, icon: '⏳', color: '#ef4444' },
                  { label: 'Teilnehmer',      val: stats.teilnehmer_gesamt,icon:'👥', color: '#8b5cf6' },
                  { label: 'Zertifikate',     val: stats.zertifikate,     icon: '🎓', color: '#06b6d4' },
                  { label: 'Umsatz gesamt',   val: `${parseFloat(stats.umsatz_gesamt || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`, icon: '💶', color: '#f97316', wide: true },
                ].map(s => (
                  <div key={s.label} style={{
                    background: `linear-gradient(145deg, ${s.color}22, ${s.color}0d)`,
                    border: `1px solid ${s.color}44`,
                    borderTop: `3px solid ${s.color}`,
                    borderRadius: 12,
                    padding: '16px 18px',
                    gridColumn: s.wide ? 'span 2' : undefined,
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.val ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Schnellzugriff */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Schnellzugriff</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SCHNELLZUGRIFF.map(item => (
                    <a key={item.label} href={item.url} target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 8,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      color: 'var(--text)', fontSize: 13, fontWeight: 500,
                      textDecoration: 'none', transition: 'border-color .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#22c55e'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <span>{item.icon}</span>{item.label}
                    </a>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="sad-hof-loading">Keine Daten verfügbar</div>
          )}
        </div>
      )}

      {subTab === 'kurse' && (
        <div>
          {loading ? <div className="sad-hof-loading">Lade…</div> : kurse.length === 0 ? (
            <div className="sad2-empty-center"><p className="sad2-text-secondary-maxw">Keine bevorstehenden Kurse</p></div>
          ) : (
            <div className="sad-sw-turnier-cards">
              {kurse.map(k => {
                const d = new Date(k.start_datum);
                return (
                  <div key={k.id} className="sad-sw-turnier-card">
                    <div className="sad-sw-tc-date">
                      <div className="sad-sw-tc-month">{d.toLocaleDateString('de-DE', { month: 'short' })}</div>
                      <div className="sad-sw-tc-day">{d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
                      <div className="sad-sw-tc-year">{d.getFullYear()}</div>
                    </div>
                    <div className="sad-sw-tc-body">
                      <div className="sad-sw-tc-name">{k.titel}</div>
                      <div className="sad-sw-tc-meta">
                        {k.ort && <span>📍 {k.ort}</span>}
                        {k.max_teilnehmer > 0 && <span>👥 max. {k.max_teilnehmer} TN</span>}
                        {k.preis > 0 && <span>💶 {parseFloat(k.preis).toFixed(2)} €</span>}
                        {k.buchungen_count !== undefined && <span>📋 {k.buchungen_count} Buchungen</span>}
                      </div>
                    </div>
                    <div className="sad-sw-tc-right">
                      <span className="sad-sw-badge sad-sw-badge--upcoming">{k.typ || 'Kurs'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'vorschau' && (
        <div className="sad-hof-preview-wrapper">
          <div className="sad-hof-preview-bar">
            <span className="sad-hof-live-dot" />
            Live-Vorschau — academy.tda-intl.org
          </div>
          <iframe
            src="https://academy.tda-intl.org"
            title="TDA Academy"
            className="sad-hof-iframe"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
