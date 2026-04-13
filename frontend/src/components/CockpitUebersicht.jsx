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

function GeburtstagePopup({ onClose, activeDojo }) {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef(null);

  useEffect(() => {
    const url = withDojoParam('/dashboard/geburtstage-details', activeDojo);
    axios.get(url)
      .then(r => setList(r.data))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [activeDojo]);

  // Schließen bei Klick außerhalb
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Schließen bei ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const today = new Date();

  const popup = (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--bg-card, #1a1a2e)',
        border: '1px solid rgba(255,215,0,.2)',
        borderRadius: '12px',
        padding: '20px 24px',
        minWidth: '320px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--text-primary, #fff)' }}>
            🎁 Geburtstage diese Woche
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted, #888)', fontSize: '1.1rem', lineHeight: 1,
              padding: '2px 6px', borderRadius: '4px',
            }}
            title="Schließen"
          >×</button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #888)', fontSize: '.85rem' }}>
            Wird geladen…
          </div>
        ) : !list || list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #888)', fontSize: '.85rem' }}>
            Keine Geburtstage in den nächsten 7 Tagen.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {list.map((p, i) => {
              const istHeute = p.tage_bis === 0;
              const datum = new Date(p.geburtstag_dieses_jahr);
              const datumStr = datum.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' });
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: istHeute ? 'rgba(255,215,0,.08)' : 'var(--bg-secondary, rgba(255,255,255,.04))',
                  border: `1px solid ${istHeute ? 'rgba(255,215,0,.3)' : 'rgba(255,255,255,.07)'}`,
                  borderRadius: '8px',
                  padding: '10px 12px',
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
                    {istHeute ? 'heute' : `in ${p.tage_bis} Tag${p.tage_bis === 1 ? '' : 'en'}`}
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

// ─── Neue-Verträge-Karte ─────────────────────────────────────────────────────

function NeueVertraegeCard({ data, loading, activeDojo }) {
  const [zeitraum, setZeitraum] = useState('heute'); // 'heute' | 'woche'
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null); // null | 'ok' | 'err'
  const [errMsg, setErrMsg] = useState('');

  const count = loading ? null : (zeitraum === 'heute' ? (data?.neue_vertraege_heute ?? 0) : (data?.neue_vertraege_woche ?? 0));
  const isActive = count != null && count > 0;

  const sendEmail = async (e) => {
    e.stopPropagation();
    setSending(true);
    setSent(null);
    setErrMsg('');
    try {
      const url = activeDojo?.id
        ? `/dashboard/neue-vertraege-email?dojo_id=${activeDojo.id}`
        : '/dashboard/neue-vertraege-email';
      const res = await axios.post(url, { zeitraum });
      if (res.data.success) {
        setSent('ok');
        setTimeout(() => setSent(null), 4000);
      } else {
        setSent('err');
        setErrMsg(res.data.message || 'Keine Verträge gefunden.');
        setTimeout(() => setSent(null), 5000);
      }
    } catch (err) {
      setSent('err');
      setErrMsg(err.response?.data?.error || 'E-Mail-Versand fehlgeschlagen.');
      setTimeout(() => setSent(null), 5000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`cu-card cu-vertraege${isActive ? ' cu-active' : ''}`}
      style={{ '--cu-color': '#22c55e', flexDirection: 'column', alignItems: 'stretch', gap: '6px', cursor: 'default' }}
    >
      {/* Zeile 1: Icon + Label + Count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span className="cu-card-icon">📝</span>
        <span className="cu-card-label" style={{ flex: 1 }}>Neue Verträge</span>
        <span className="cu-card-count">
          {loading ? '…' : count}
        </span>
      </div>

      {/* Zeile 2: Toggle + E-Mail-Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Toggle Heute | Woche */}
        <div style={{
          display: 'flex', borderRadius: '4px', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,.1)', flexShrink: 0,
        }}>
          {['heute', 'woche'].map(z => (
            <button
              key={z}
              onClick={(e) => { e.stopPropagation(); setZeitraum(z); }}
              style={{
                background: zeitraum === z ? 'rgba(34,197,94,.25)' : 'transparent',
                border: 'none', cursor: 'pointer',
                color: zeitraum === z ? '#22c55e' : 'var(--text-muted, #888)',
                fontSize: '.6rem', fontWeight: zeitraum === z ? 700 : 400,
                padding: '2px 7px', lineHeight: '1.4',
                transition: 'all .15s',
                textTransform: 'capitalize',
              }}
            >
              {z === 'heute' ? 'Heute' : '7 Tage'}
            </button>
          ))}
        </div>

        {/* E-Mail-Button */}
        <button
          onClick={sendEmail}
          disabled={sending || count === 0}
          title={count === 0 ? 'Keine neuen Verträge' : `E-Mail-Übersicht (${zeitraum === 'heute' ? 'heute' : '7 Tage'}) senden`}
          style={{
            marginLeft: 'auto',
            background: sent === 'ok' ? 'rgba(34,197,94,.15)' : sent === 'err' ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.06)',
            border: `1px solid ${sent === 'ok' ? 'rgba(34,197,94,.4)' : sent === 'err' ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.1)'}`,
            borderRadius: '4px', cursor: count === 0 ? 'not-allowed' : 'pointer',
            color: sent === 'ok' ? '#22c55e' : sent === 'err' ? '#ef4444' : 'var(--text-muted, #888)',
            fontSize: '.62rem', padding: '2px 7px', lineHeight: '1.4',
            opacity: count === 0 ? .4 : 1,
            transition: 'all .15s',
            whiteSpace: 'nowrap',
          }}
        >
          {sending ? '⏳' : sent === 'ok' ? '✓ Gesendet' : sent === 'err' ? '✗ Fehler' : '✉ E-Mail'}
        </button>
      </div>

      {/* Fehlermeldung */}
      {sent === 'err' && errMsg && (
        <div style={{ fontSize: '.6rem', color: '#ef4444', marginTop: '2px' }}>
          {errMsg}
        </div>
      )}
    </div>
  );
}

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

const CARDS = [
  {
    key: 'geburtstage_heute',
    icon: '🎂',
    label: 'Geburtstage heute',
    path: '/dashboard/mitglieder?geburtstag=heute',
    urgent: false,
    color: '#ffd700',
    popup: null,
  },
  {
    key: 'geburtstage_woche',
    icon: '🎁',
    label: 'Geburtstage diese Woche',
    path: null, // Popup statt Navigation
    urgent: false,
    color: '#fbbf24',
    popup: 'geburtstage',
  },
  {
    key: 'ablaufende_vertraege',
    icon: '📋',
    label: 'Verträge laufen ab (30 Tage)',
    path: '/dashboard/beitraege',
    urgent: true,
    color: '#f97316',
    popup: null,
  },
  {
    key: 'offene_mahnungen',
    icon: '⚠️',
    label: 'Offene Mahnungen',
    path: '/dashboard/rechnungen',
    urgent: true,
    color: '#ef4444',
    popup: null,
  },
  {
    key: 'anstehende_lastschriften',
    icon: '💳',
    label: 'Lastschriften (7 Tage)',
    path: '/dashboard/beitraege',
    urgent: false,
    color: '#3b82f6',
    popup: null,
  },
];

const CockpitUebersicht = () => {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activePopup, setActivePopup] = useState(null); // 'geburtstage' | null

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
        anstehende_lastschriften: 0,
        neue_vertraege_heute: 0, neue_vertraege_woche: 0,
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
        .cu-card.cu-vertraege { cursor: default; }
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
            : <>
                {CARDS.map((card) => {
                  const count = data ? (data[card.key] ?? 0) : 0;
                  const isActive = count > 0;
                  const isPopup = !!card.popup;
                  return (
                    <div
                      key={card.key}
                      className={`cu-card${isActive ? ' cu-active' : ''}${card.urgent && isActive ? ' cu-urgent' : ''}`}
                      style={{ '--cu-color': card.color }}
                      onClick={() => handleCardClick(card)}
                      title={isPopup
                        ? `${card.label}: ${count} — Klicken für Details`
                        : `${card.label}: ${count} — Details ansehen`}
                    >
                      <span className="cu-card-icon">{card.icon}</span>
                      <span className="cu-card-label">{card.label}</span>
                      <span className="cu-card-count">{count}</span>
                      {isPopup && isActive && (
                        <span style={{ fontSize: '.55rem', color: 'var(--text-muted,#888)', flexShrink: 0 }}>▼</span>
                      )}
                    </div>
                  );
                })}

                {/* Neue Verträge Karte */}
                <NeueVertraegeCard data={data} loading={loading} activeDojo={activeDojo} />
              </>
          }
        </div>
      </div>

      {/* Popups */}
      {activePopup === 'geburtstage' && (
        <GeburtstagePopup
          activeDojo={activeDojo}
          onClose={() => setActivePopup(null)}
        />
      )}
    </>
  );
};

export default CockpitUebersicht;
