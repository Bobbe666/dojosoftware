// ── EventSoftware-Sektion (ausgelagert aus SuperAdminDashboard.jsx) ─────────
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function EventSoftwareSection({ token, preloadedTurniere }) {
  const [subTab, setSubTab] = useState('uebersicht');
  const [turniere, setTurniere] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suchbegriff, setSuchbegriff] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);

  const openEventsSSO = async () => {
    setSsoLoading(true);
    try {
      const res = await axios.post('/auth/generate-events-token', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.token) {
        window.open(`https://events.tda-intl.org/sso?dojo_token=${res.data.token}`, '_blank');
      }
    } catch (e) {
      console.error('SSO fehlgeschlagen', e);
      window.open('https://events.tda-intl.org/login', '_blank');
    } finally {
      setSsoLoading(false);
    }
  };

  useEffect(() => {
    // Turniere kommen bereits vom Dashboard-Load (loadAllData) — kein zweiter API-Call
    if (preloadedTurniere) {
      setTurniere(preloadedTurniere);
      setLoading(false);
      return;
    }
    if (!token) return;
    axios.get('/plattform-zentrale/turniere', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setTurniere(r.data.turniere || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, preloadedTurniere]);

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  const upcoming = turniere
    .filter(t => new Date(t.start_datum || t.datum) >= heute)
    .sort((a, b) => new Date(a.start_datum || a.datum) - new Date(b.start_datum || b.datum));
  const vergangen = turniere
    .filter(t => new Date(t.start_datum || t.datum) < heute)
    .sort((a, b) => new Date(b.start_datum || b.datum) - new Date(a.start_datum || a.datum));
  const mitOffenemAnmeldung = turniere.filter(t => t.anmeldeschluss && new Date(t.anmeldeschluss) >= heute);
  const naechstes = upcoming[0];

  const gefiltert = [...upcoming, ...vergangen].filter(t =>
    !suchbegriff || t.name?.toLowerCase().includes(suchbegriff.toLowerCase()) || t.ort?.toLowerCase().includes(suchbegriff.toLowerCase())
  );

  const SCHNELLZUGRIFF = [
    { icon: '🏠', label: 'Dashboard',    url: 'https://events.tda-intl.org/dashboard' },
    { icon: '🥊', label: 'Turniere',     url: 'https://events.tda-intl.org/dashboard' },
    { icon: '🎓', label: 'Lehrgänge',    url: 'https://events.tda-intl.org/dashboard' },
    { icon: '📊', label: 'Ranglisten',   url: 'https://events.tda-intl.org/dashboard' },
    { icon: '⚖️', label: 'Einwaage',     url: 'https://events.tda-intl.org/dashboard' },
    { icon: '👥', label: 'Teilnehmer',   url: 'https://events.tda-intl.org/dashboard' },
    { icon: '📈', label: 'Statistiken',  url: 'https://events.tda-intl.org/dashboard' },
    { icon: '🏆', label: 'Ergebnisse',   url: 'https://events.tda-intl.org/dashboard' },
  ];

  return (
    <div>
      {/* Header + Links */}
      <div className="sad-hof-header">
        <h2 className="sad-hof-title">🗓️ EventSoftware — events.tda-intl.org</h2>
        <div className="sad-hof-btn-row">
          <button
            onClick={openEventsSSO}
            disabled={ssoLoading}
            className="sad-hof-admin-link"
            style={{ cursor: ssoLoading ? 'wait' : 'pointer', border: 'none' }}
            title="Automatisch mit deinem DojoSoftware-Account einloggen"
          >
            {ssoLoading ? '…' : '🔗 Direkt öffnen'}
          </button>
          <a href="https://events.tda-intl.org/login" target="_blank" rel="noreferrer" className="sad-hof-admin-link">
            🔐 Login
          </a>
          <a href="https://events.tda-intl.org" target="_blank" rel="noreferrer" className="sad-hof-public-link">
            ↗ Öffentlich
          </a>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="sub-tabs-horizontal sad2-mb-15">
        {[
          { id: 'uebersicht', icon: '📊', label: 'Übersicht' },
          { id: 'turniere',   icon: '🥊', label: 'Turniere & Events' },
          { id: 'vorschau',   icon: '🌐', label: 'Live-Vorschau' },
        ].map(t => (
          <button key={t.id} className={`sub-tab-btn ${subTab === t.id ? 'active' : ''}`} onClick={() => setSubTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Übersicht ─────────────────────────────────────────────── */}
      {subTab === 'uebersicht' && (
        <div>
          {/* KPI-Karten */}
          <div className="sad-sw-kpi-grid">
            {[
              { label: 'Events gesamt',       val: loading ? '…' : turniere.length,           color: '#6366f1', icon: '🗓️' },
              { label: 'Bevorstehend',         val: loading ? '…' : upcoming.length,           color: '#22c55e', icon: '⏳' },
              { label: 'Anmeldung offen',      val: loading ? '…' : mitOffenemAnmeldung.length, color: '#f59e0b', icon: '📋' },
              { label: 'Abgeschlossen',        val: loading ? '…' : vergangen.length,           color: '#64748b', icon: '✅' },
            ].map(k => (
              <div key={k.label} className="sad-sw-kpi-card" style={{ borderLeftColor: k.color }}>
                <div className="sad-sw-kpi-icon">{k.icon}</div>
                <div>
                  <div className="sad-sw-kpi-val" style={{ color: k.color }}>{k.val}</div>
                  <div className="sad-sw-kpi-label">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="sad-sw-cols">
            {/* Nächste Events */}
            <div className="sad-sw-panel">
              <div className="sad-sw-panel-header">
                <span>⏳ Nächste Events</span>
                <button className="sad-sw-panel-btn" onClick={() => setSubTab('turniere')}>Alle ansehen →</button>
              </div>
              {loading ? (
                <div className="sad-sw-loading">Lade Events…</div>
              ) : upcoming.length === 0 ? (
                <div className="sad-sw-empty">Keine bevorstehenden Events</div>
              ) : (
                upcoming.slice(0, 7).map(t => {
                  const d = new Date(t.start_datum || t.datum);
                  const isOpen = t.anmeldeschluss && new Date(t.anmeldeschluss) >= heute;
                  return (
                    <div key={t.turnier_id || t.id} className="sad-sw-event-row">
                      <div className="sad-sw-event-date">
                        <span className="sad-sw-ev-day">{d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
                        <span className="sad-sw-ev-year">{d.getFullYear()}</span>
                      </div>
                      <div className="sad-sw-event-info">
                        <div className="sad-sw-event-name">{t.name}</div>
                        {t.ort && <div className="sad-sw-event-ort">📍 {t.ort}</div>}
                      </div>
                      {isOpen && <span className="sad-sw-badge sad-sw-badge--open">Offen</span>}
                    </div>
                  );
                })
              )}
            </div>

            {/* Schnellzugriff + Nächstes Highlight */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="sad-sw-panel">
                <div className="sad-sw-panel-header"><span>⚡ Schnellzugriff</span></div>
                <div className="sad-sw-links-grid">
                  {SCHNELLZUGRIFF.map(link => (
                    <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="sad-sw-link">
                      <span>{link.icon}</span> {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {naechstes && (
                <div className="sad-sw-highlight">
                  <div className="sad-sw-highlight-label">Nächstes Event</div>
                  <div className="sad-sw-highlight-name">{naechstes.name}</div>
                  <div className="sad-sw-highlight-date">
                    {new Date(naechstes.start_datum || naechstes.datum).toLocaleDateString('de-DE', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </div>
                  {naechstes.ort && <div className="sad-sw-highlight-ort">📍 {naechstes.ort}</div>}
                  {naechstes.anmeldeschluss && (
                    <div className="sad-sw-highlight-meta">
                      Anmeldeschluss: {new Date(naechstes.anmeldeschluss).toLocaleDateString('de-DE')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Turniere & Events ──────────────────────────────────────── */}
      {subTab === 'turniere' && (
        <div>
          <div className="sad-sw-turniere-header">
            <input
              className="sad-sw-search"
              placeholder="Suche nach Name oder Ort…"
              value={suchbegriff}
              onChange={e => setSuchbegriff(e.target.value)}
            />
            <a href="https://events.tda-intl.org/dashboard" target="_blank" rel="noreferrer" className="sad-hof-admin-link">
              + Neu auf events.tda-intl.org
            </a>
          </div>

          {loading ? (
            <div className="sad-sw-loading">Lade Turniere…</div>
          ) : gefiltert.length === 0 ? (
            <div className="sad2-empty-center">
              <span className="sad2-big-icon">🗓️</span>
              <p className="sad2-text-secondary-maxw">Keine Events gefunden.</p>
            </div>
          ) : (
            <div className="sad-sw-turniere-list">
              {gefiltert.map(t => {
                const d = new Date(t.start_datum || t.datum);
                const isPast = d < heute;
                const isOpen = !isPast && t.anmeldeschluss && new Date(t.anmeldeschluss) >= heute;
                const isClosed = !isPast && t.anmeldeschluss && new Date(t.anmeldeschluss) < heute;
                return (
                  <div key={t.turnier_id || t.id} className={`sad-sw-turnier-card ${isPast ? 'sad-sw-tc--past' : ''}`}>
                    <div className="sad-sw-tc-datum">
                      <div className="sad-sw-tc-day">{d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
                      <div className="sad-sw-tc-year">{d.getFullYear()}</div>
                    </div>
                    <div className="sad-sw-tc-body">
                      <div className="sad-sw-tc-name">{t.name}</div>
                      <div className="sad-sw-tc-meta">
                        {t.ort && <span>📍 {t.ort}</span>}
                        {t.datum_ende && t.datum_ende !== t.start_datum && (
                          <span>bis {new Date(t.datum_ende).toLocaleDateString('de-DE')}</span>
                        )}
                        {t.max_teilnehmer > 0 && <span>👥 max. {t.max_teilnehmer} TN</span>}
                        {t.anmeldegebuehr > 0 && <span>💶 {t.anmeldegebuehr} €</span>}
                        {t.anmeldeschluss && (
                          <span>Anmeldeschluss: {new Date(t.anmeldeschluss).toLocaleDateString('de-DE')}</span>
                        )}
                      </div>
                    </div>
                    <div className="sad-sw-tc-right">
                      {isPast  && <span className="sad-sw-badge sad-sw-badge--past">Abgeschlossen</span>}
                      {isOpen  && <span className="sad-sw-badge sad-sw-badge--open">Anmeldung offen</span>}
                      {isClosed && <span className="sad-sw-badge sad-sw-badge--closed">Anmeldung geschlossen</span>}
                      {!isPast && !t.anmeldeschluss && <span className="sad-sw-badge sad-sw-badge--upcoming">Bevorstehend</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Live-Vorschau ─────────────────────────────────────────── */}
      {subTab === 'vorschau' && (
        <div className="sad-hof-preview-wrapper">
          <div className="sad-hof-preview-bar">
            <span className="sad-hof-live-dot" />
            Live-Vorschau — events.tda-intl.org
          </div>
          <iframe
            src="https://events.tda-intl.org"
            title="EventSoftware"
            className="sad-hof-iframe"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
