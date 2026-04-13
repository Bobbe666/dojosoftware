import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';

function withDojoParam(url, activeDojo) {
  if (!activeDojo || activeDojo === 'super-admin') return url;
  const id = activeDojo?.id;
  if (!id) return url;
  return `${url}${url.includes('?') ? '&' : '?'}dojo_id=${id}`;
}

const CARDS = [
  {
    key: 'geburtstage_heute',
    icon: '🎂',
    label: 'Geburtstage heute',
    path: '/dashboard/mitglieder?geburtstag=heute',
    urgent: false,
    color: '#ffd700',
  },
  {
    key: 'geburtstage_woche',
    icon: '🎁',
    label: 'Geburtstage diese Woche',
    path: '/dashboard/mitglieder?geburtstag=7tage',
    urgent: false,
    color: '#fbbf24',
  },
  {
    key: 'ablaufende_vertraege',
    icon: '📋',
    label: 'Verträge laufen ab (30 Tage)',
    path: '/dashboard/beitraege',
    urgent: true,
    color: '#f97316',
  },
  {
    key: 'offene_mahnungen',
    icon: '⚠️',
    label: 'Offene Mahnungen',
    path: '/dashboard/rechnungen',
    urgent: true,
    color: '#ef4444',
  },
  {
    key: 'anstehende_lastschriften',
    icon: '💳',
    label: 'Lastschriften (7 Tage)',
    path: '/dashboard/beitraege',
    urgent: false,
    color: '#3b82f6',
  },
];

const CockpitUebersicht = () => {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Super-Admin sieht immer alle Dojos aggregiert (kein dojo_id-Filter)
      const isSuperAdmin = !activeDojo?.id || activeDojo === 'super-admin';
      const url = isSuperAdmin
        ? '/dashboard/cockpit-uebersicht'
        : withDojoParam('/dashboard/cockpit-uebersicht', activeDojo);
      const res = await axios.get(url);
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('[CockpitUebersicht]', err.message);
      // Fallback: zeige Nullen
      setData({ geburtstage_heute: 0, geburtstage_woche: 0, ablaufende_vertraege: 0, offene_mahnungen: 0, anstehende_lastschriften: 0 });
    } finally {
      setLoading(false);
    }
  }, [activeDojo]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n) => (loading ? '…' : (n ?? 0));

  return (
    <>
      <style>{`
        @keyframes cu-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .cu-wrap {
          margin-bottom: 1rem;
          background: var(--bg-card, #1a1a2e);
          border: 1px solid rgba(255,215,0,.1);
          border-radius: 10px;
          padding: 8px 12px;
        }
        .cu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .cu-title {
          font-size: .65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .07em;
          color: var(--text-muted, #888);
        }
        .cu-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: .62rem;
          color: var(--text-muted, #888);
        }
        .cu-refresh {
          background: none;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 4px;
          color: var(--text-muted, #888);
          cursor: pointer;
          padding: 1px 6px;
          font-size: .62rem;
          transition: all .15s;
        }
        .cu-refresh:hover { border-color: rgba(255,215,0,.4); color: #ffd700; }
        .cu-grid {
          display: flex;
          flex-wrap: nowrap;
          gap: 6px;
        }
        @media(max-width:700px){ .cu-grid { flex-wrap: wrap; } }
        .cu-card {
          background: var(--bg-secondary, #111);
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
          transition: all .15s;
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }
        .cu-card:hover { background: var(--bg-hover); border-color: rgba(255,255,255,.13); }
        .cu-card.cu-active { border-color: var(--cu-color); }
        .cu-card.cu-urgent.cu-active { background: rgba(239,68,68,.05); }
        .cu-card-icon { font-size: .85rem; flex-shrink: 0; line-height: 1; }
        .cu-card-label {
          font-size: .72rem;
          color: var(--text-muted, #888);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        .cu-card-count {
          font-size: .85rem;
          font-weight: 800;
          line-height: 1;
          color: var(--text-muted, #555);
          flex-shrink: 0;
          transition: color .2s;
          background: rgba(255,255,255,.08);
          border-radius: 4px;
          padding: 2px 6px;
        }
        .cu-card.cu-active .cu-card-count {
          color: var(--bg-primary, #0d0d1a);
          background: var(--cu-color);
        }
        .cu-skeleton { animation: cu-pulse 1.4s ease-in-out infinite; background: rgba(255,255,255,.06); border-radius:4px; }
      `}</style>

      <div className="cu-wrap">
        <div className="cu-header">
          <span className="cu-title">Heute &amp; diese Woche</span>
          <div className="cu-meta">
            {lastUpdated && <span>Stand: {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>}
            <button className="cu-refresh" onClick={load} title="Aktualisieren">↺ Aktualisieren</button>
          </div>
        </div>

        <div className="cu-grid">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="cu-card" style={{ flex: 1 }}>
                  <div className="cu-skeleton" style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }} />
                  <div className="cu-skeleton" style={{ flex: 1, height: 10 }} />
                  <div className="cu-skeleton" style={{ width: 24, height: 20, borderRadius: 4 }} />
                </div>
              ))
            : CARDS.map((card) => {
                const count = data ? (data[card.key] ?? 0) : 0;
                const isActive = count > 0;
                return (
                  <div
                    key={card.key}
                    className={`cu-card${isActive ? ' cu-active' : ''}${card.urgent && isActive ? ' cu-urgent' : ''}`}
                    style={{ '--cu-color': card.color }}
                    onClick={() => navigate(card.path)}
                    title={`${card.label}: ${count} — Details ansehen`}
                  >
                    <span className="cu-card-icon">{card.icon}</span>
                    <span className="cu-card-label">{card.label}</span>
                    <span className="cu-card-count">{count}</span>
                  </div>
                );
              })}
        </div>
      </div>
    </>
  );
};

export default CockpitUebersicht;
