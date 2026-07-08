import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';

const BASE = 'https://app.tda-vib.de';
const toAbs = (url) => url ? (url.startsWith('http') ? url : `${BASE}${url}`) : null;
const LS_KEY = 'news_popup_dismissed';

function getDismissed() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function markDismissed(id) {
  const d = getDismissed();
  if (!d.includes(id)) { d.push(id); localStorage.setItem(LS_KEY, JSON.stringify(d)); }
}

export default function NewsPopup() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios.get('/news/public', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const dismissed = getDismissed();
        const popups = (r.data.news || []).filter(n => n.als_popup && !dismissed.includes(n.id));
        setItems(popups);
      })
      .catch(() => {});
  }, [token]);

  if (!items.length) return null;
  const item = items[idx];

  const dismiss = () => {
    markDismissed(item.id);
    if (idx < items.length - 1) { setIdx(idx + 1); setExpanded(false); }
    else setItems([]);
  };

  const isHtml = /<[a-z][\s\S]*>/i.test(item.inhalt || '');
  let bilder = [];
  if (item.bilder_json) { try { bilder = JSON.parse(item.bilder_json).map(toAbs).filter(Boolean); } catch {} }
  if (!bilder.length && item.bild_url) bilder = [toAbs(item.bild_url)];

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={dismiss}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(26,26,46,0.99) 0%, rgba(12,12,28,1) 100%)',
        border: '1px solid rgba(239,68,68,0.4)',
        borderRadius: '14px',
        width: '100%', maxWidth: '520px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        position: 'relative',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(239,68,68,0.12)',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span style={{ fontSize: '1.1rem' }}>🔔</span>
          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Wichtige Information
          </span>
          {items.length > 1 && (
            <span style={{ marginLeft: 'auto', color: 'var(--ds-text-muted)', fontSize: '0.8rem' }}>
              {idx + 1} / {items.length}
            </span>
          )}
          <button onClick={dismiss} style={{
            marginLeft: items.length > 1 ? 0 : 'auto',
            background: 'none', border: 'none', color: 'var(--ds-text-muted)',
            cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '0 0.2rem',
          }}>✕</button>
        </div>

        {/* Bild */}
        {bilder.length > 0 && (
          <img src={bilder[0]} alt={item.titel} style={{
            width: '100%', maxHeight: '200px', objectFit: 'cover',
          }} />
        )}

        {/* Content */}
        <div style={{ padding: '1.25rem 1.25rem 0.75rem', overflowY: 'auto', flex: 1 }}>
          <h2 style={{ margin: '0 0 0.5rem', color: 'var(--ds-text)', fontSize: '1.15rem', lineHeight: 1.3 }}>
            {item.titel}
          </h2>
          {item.kurzbeschreibung && (
            <p style={{ margin: '0 0 0.75rem', color: 'var(--ds-text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {item.kurzbeschreibung.replace(/<[^>]*>/g, '')}
            </p>
          )}

          {expanded && (
            <div style={{ color: 'var(--ds-text)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
              {isHtml
                ? <div dangerouslySetInnerHTML={{ __html: item.inhalt }} />
                : <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{item.inhalt}</p>
              }
            </div>
          )}

          {!expanded && item.inhalt && item.inhalt.replace(/<[^>]*>/g, '').trim() && (
            <button onClick={() => setExpanded(true)} style={{
              background: 'none', border: 'none', color: 'rgba(255,215,0,0.8)',
              cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '0.75rem',
            }}>
              Vollständig lesen ↓
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', gap: '0.75rem', justifyContent: 'flex-end',
        }}>
          <button onClick={dismiss} style={{
            padding: '0.5rem 1.25rem',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px', color: '#ef4444',
            cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
          }}>
            {items.length > 1 && idx < items.length - 1 ? 'Weiter →' : 'Verstanden'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
