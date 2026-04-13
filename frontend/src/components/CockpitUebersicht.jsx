import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';

function withDojoParam(url, activeDojo) {
  if (!activeDojo || activeDojo === 'super-admin') return url;
  const id = activeDojo?.id;
  if (!id) return url;
  return `${url}${url.includes('?') ? '&' : '?'}dojo_id=${id}`;
}

// ─── Geburtstags-Popup ───────────────────────────────────────────────────────

function GeburtstagePopup({ typ, onClose, activeDojo }) {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef(null);

  useEffect(() => {
    const base = `/dashboard/geburtstage-details?typ=${typ}`;
    const url = withDojoParam(base, activeDojo);
    axios.get(url)
      .then(r => setList(r.data))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [typ, activeDojo]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const titel = typ === 'heute' ? '🎂 Geburtstage heute' : '🎁 Geburtstage diese Woche';

  const popup = (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div style={{
        background: '#1a1a2e',
        border: '1px solid rgba(255,215,0,.2)',
        borderRadius: '12px', padding: '20px 24px',
        minWidth: '320px', maxWidth: '480px', width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--text-primary, #fff)' }}>{titel}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted, #888)', fontSize: '1.1rem', lineHeight: 1, padding: '2px 6px', borderRadius: '4px',
          }}>×</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #888)', fontSize: '.85rem' }}>Wird geladen…</div>
        ) : !list || list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #888)', fontSize: '.85rem' }}>
            {typ === 'heute' ? 'Heute hat niemand Geburtstag.' : 'Keine Geburtstage in den nächsten 7 Tagen.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {list.map((p, i) => {
              const istHeute = Number(p.tage_bis) === 0;
              const datum = new Date(p.geburtstag_dieses_jahr);
              const datumStr = datum.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' });
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: istHeute ? 'rgba(255,215,0,.08)' : 'var(--bg-secondary, rgba(255,255,255,.04))',
                  border: `1px solid ${istHeute ? 'rgba(255,215,0,.3)' : 'rgba(255,255,255,.07)'}`,
                  borderRadius: '8px', padding: '10px 12px',
                }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{istHeute ? '🎂' : '🎁'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: '.88rem',
                      color: istHeute ? '#ffd700' : 'var(--text-primary, #fff)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {p.vorname} {p.nachname}
                    </div>
                    <div style={{ fontSize: '.76rem', color: 'var(--text-muted, #888)', marginTop: '2px' }}>
                      {datumStr} · wird {p.wird_jahre} Jahre alt
                    </div>
                  </div>
                  <div style={{
                    fontSize: '.7rem', fontWeight: 700, textAlign: 'right', flexShrink: 0,
                    color: istHeute ? '#ffd700' : 'var(--text-muted, #888)',
                  }}>
                    {istHeute ? 'heute' : `in ${p.tage_bis} Tag${Number(p.tage_bis) === 1 ? '' : 'en'}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}

// ─── Neue-Verträge-Popup ─────────────────────────────────────────────────────

function NeueVertraegePopup({ onClose, onAcknowledged, activeDojo }) {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const overlayRef = useRef(null);

  const load = useCallback(() => {
    if (!activeDojo?.id) return;
    const url = `/dashboard/neue-vertraege-details?dojo_id=${activeDojo.id}`;
    axios.get(url)
      .then(r => setList(r.data))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [activeDojo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAcknowledge = async () => {
    setConfirming(true);
    try {
      const url = activeDojo?.id
        ? `/dashboard/neue-vertraege-acknowledge?dojo_id=${activeDojo.id}`
        : '/dashboard/neue-vertraege-acknowledge';
      await axios.post(url);
      onAcknowledged(); // Zähler in Elternkomponente zurücksetzen
      onClose();
    } catch (err) {
      console.error('Acknowledge fehlgeschlagen', err);
    } finally {
      setConfirming(false);
    }
  };

  const fmt = (val) => val != null ? val : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '—';
  const fmtBetrag = (b) => b != null ? `${Number(b).toFixed(2)} €/Monat` : '—';

  const popup = (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div style={{
        background: '#1a1a2e',
        border: '1px solid rgba(34,197,94,.2)',
        borderRadius: '12px', padding: '20px 24px',
        minWidth: '360px', maxWidth: '560px', width: '100%',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--text-primary, #fff)' }}>
            📝 Neue Verträge
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted, #888)', fontSize: '1.1rem', lineHeight: 1, padding: '2px 6px', borderRadius: '4px',
          }}>×</button>
        </div>

        {/* Liste */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #888)', fontSize: '.85rem' }}>Wird geladen…</div>
          ) : !list || list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #888)', fontSize: '.85rem' }}>
              Alle Verträge wurden zur Kenntnis genommen.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {list.map((v, i) => {
                const angelegtVon = v.angelegt_von_name?.trim() || v.angelegt_von_username || '—';
                const laufzeit = v.mindestlaufzeit_monate
                  ? `${v.mindestlaufzeit_monate} Monate`
                  : (v.vertragsbeginn && v.vertragsende ? `${fmtDate(v.vertragsbeginn)} – ${fmtDate(v.vertragsende)}` : 'unbefristet');
                return (
                  <div key={i} style={{
                    background: 'var(--bg-secondary, rgba(255,255,255,.04))',
                    border: '1px solid rgba(34,197,94,.15)',
                    borderRadius: '8px', padding: '12px 14px',
                  }}>
                    {/* Name + Datum */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--text-primary, #fff)' }}>
                        {v.vorname} {v.nachname}
                      </span>
                      <span style={{ fontSize: '.68rem', color: 'var(--text-muted, #888)', flexShrink: 0, marginLeft: '8px' }}>
                        {v.created_at ? new Date(v.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                    {/* Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
                      <div style={{ fontSize: '.73rem', color: 'var(--text-muted, #888)' }}>
                        <span style={{ color: 'var(--text-secondary, #aaa)' }}>Beginn: </span>
                        {fmtDate(v.vertragsbeginn)}
                      </div>
                      <div style={{ fontSize: '.73rem', color: 'var(--text-muted, #888)' }}>
                        <span style={{ color: 'var(--text-secondary, #aaa)' }}>Ende: </span>
                        {v.vertragsende ? fmtDate(v.vertragsende) : 'unbefristet'}
                      </div>
                      <div style={{ fontSize: '.73rem', color: 'var(--text-muted, #888)' }}>
                        <span style={{ color: 'var(--text-secondary, #aaa)' }}>Laufzeit: </span>
                        {laufzeit}
                      </div>
                      <div style={{ fontSize: '.73rem', color: 'var(--text-muted, #888)' }}>
                        <span style={{ color: 'var(--text-secondary, #aaa)' }}>Beitrag: </span>
                        {fmtBetrag(v.beitrag_monatlich)}
                      </div>
                      <div style={{ fontSize: '.73rem', color: 'var(--text-muted, #888)', gridColumn: '1/-1' }}>
                        <span style={{ color: 'var(--text-secondary, #aaa)' }}>Angelegt von: </span>
                        {angelegtVon}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Zur Kenntnis nehmen */}
        {list && list.length > 0 && (
          <div style={{ marginTop: '16px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: '14px' }}>
            <button
              onClick={handleAcknowledge}
              disabled={confirming}
              style={{
                width: '100%', background: 'rgba(34,197,94,.15)',
                border: '1px solid rgba(34,197,94,.4)',
                borderRadius: '8px', padding: '9px 16px',
                color: '#22c55e', fontWeight: 700, fontSize: '.82rem',
                cursor: confirming ? 'not-allowed' : 'pointer',
                transition: 'all .15s',
                opacity: confirming ? .6 : 1,
              }}
            >
              {confirming ? '⏳ Wird gespeichert…' : `✓ Alle ${list.length} Vertrag${list.length === 1 ? '' : 'verträge'} zur Kenntnis nehmen`}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

const CARDS = [
  {
    key: 'geburtstage_heute',
    icon: '🎂',
    label: 'Geburtstage heute',
    path: null,
    popup: 'geburtstage_heute',
    urgent: false,
    color: '#ffd700',
  },
  {
    key: 'geburtstage_woche',
    icon: '🎁',
    label: 'Geburtstage diese Woche',
    path: null,
    popup: 'geburtstage_woche',
    urgent: false,
    color: '#fbbf24',
  },
  {
    key: 'ablaufende_vertraege',
    icon: '📋',
    label: 'Verträge laufen ab (30 Tage)',
    path: '/dashboard/beitraege',
    popup: null,
    urgent: true,
    color: '#f97316',
  },
  {
    key: 'offene_mahnungen',
    icon: '⚠️',
    label: 'Offene Mahnungen',
    path: '/dashboard/rechnungen',
    popup: null,
    urgent: true,
    color: '#ef4444',
  },
  {
    key: 'anstehende_lastschriften',
    icon: '💳',
    label: 'Lastschriften (7 Tage)',
    path: '/dashboard/beitraege',
    popup: null,
    urgent: false,
    color: '#3b82f6',
  },
  {
    key: 'neue_vertraege_unbestaetigt',
    icon: '📝',
    label: 'Neue Verträge',
    path: null,
    popup: 'neue_vertraege',
    urgent: false,
    color: '#22c55e',
  },
];

const CockpitUebersicht = () => {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activePopup, setActivePopup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const isSuperAdmin = !activeDojo?.id || activeDojo === 'super-admin';
      const url = isSuperAdmin
        ? '/dashboard/cockpit-uebersicht'
        : withDojoParam('/dashboard/cockpit-uebersicht', activeDojo);
      const res = await axios.get(url);
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('[CockpitUebersicht]', err.message);
      setData({
        geburtstage_heute: 0, geburtstage_woche: 0,
        ablaufende_vertraege: 0, offene_mahnungen: 0,
        anstehende_lastschriften: 0, neue_vertraege_unbestaetigt: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [activeDojo]);

  useEffect(() => { load(); }, [load]);

  const handleCardClick = (card) => {
    if (card.popup) {
      setActivePopup(card.popup);
    } else if (card.path) {
      navigate(card.path);
    }
  };

  // Nach Kenntnisnahme: Zähler sofort auf 0 setzen + neu laden
  const handleAcknowledged = () => {
    setData(prev => prev ? { ...prev, neue_vertraege_unbestaetigt: 0 } : prev);
    load();
  };

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
            {lastUpdated && (
              <span>Stand: {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
            )}
            <button className="cu-refresh" onClick={load} title="Aktualisieren">↺ Aktualisieren</button>
          </div>
        </div>

        <div className="cu-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
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
                    onClick={() => handleCardClick(card)}
                    title={card.popup
                      ? `${card.label}: ${count} — Klicken für Details`
                      : `${card.label}: ${count} — Details ansehen`}
                  >
                    <span className="cu-card-icon">{card.icon}</span>
                    <span className="cu-card-label">{card.label}</span>
                    <span className="cu-card-count">{loading ? '…' : count}</span>
                    {card.popup && isActive && (
                      <span style={{ fontSize: '.55rem', color: 'var(--text-muted,#888)', flexShrink: 0 }}>▼</span>
                    )}
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* Popups */}
      {activePopup === 'geburtstage_heute' && (
        <GeburtstagePopup typ="heute" activeDojo={activeDojo} onClose={() => setActivePopup(null)} />
      )}
      {activePopup === 'geburtstage_woche' && (
        <GeburtstagePopup typ="woche" activeDojo={activeDojo} onClose={() => setActivePopup(null)} />
      )}
      {activePopup === 'neue_vertraege' && (
        <NeueVertraegePopup
          activeDojo={activeDojo}
          onClose={() => setActivePopup(null)}
          onAcknowledged={handleAcknowledged}
        />
      )}
    </>
  );
};

export default CockpitUebersicht;
