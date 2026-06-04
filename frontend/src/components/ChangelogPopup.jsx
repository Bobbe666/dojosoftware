import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { jwtDecode } from 'jwt-decode';
import { Sparkles, Zap, Shield, Bug, Star, Settings, X, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { CHANGELOG, CURRENT_VERSION } from './SystemChangelog';

const TYPE_ICON = {
  feature: <Sparkles size={14} />,
  major: <Star size={14} />,
  security: <Shield size={14} />,
  bugfix: <Bug size={14} />,
  improvement: <Zap size={14} />,
};

const TYPE_COLOR = {
  feature: '#ffd700',
  major: '#f59e0b',
  security: '#ef4444',
  bugfix: '#10b981',
  improvement: '#3b82f6',
};

const TYPE_LABEL = {
  feature: 'Neu',
  major: 'Major',
  security: 'Sicherheit',
  bugfix: 'Bugfix',
  improvement: 'Verbesserung',
};

// Liest userId + Zielgruppen-Scope aus dem JWT.
// Super-Admin (kein dojo_id im Token oder super-Rolle) sieht ALLE Einträge;
// Dojo-Admins der Subdomains sehen nur Einträge, die NICHT als 'intern' markiert sind.
const getAuth = () => {
  try {
    const token = localStorage.getItem('dojo_auth_token');
    if (!token) return { userId: null, isSuperAdmin: false };
    const d = jwtDecode(token);
    const userId = d.id || d.user_id || null;
    const role = (d.role || d.rolle || '').toString().toLowerCase();
    const isSuperAdmin = d.dojo_id === null || d.dojo_id === undefined || role.includes('super');
    return { userId, isSuperAdmin };
  } catch {
    return { userId: null, isSuperAdmin: false };
  }
};

// Sichtbarkeit eines Eintrags je nach Scope (intern = nur Super-Admin)
const istSichtbar = (eintrag, isSuperAdmin) => isSuperAdmin || eintrag.zielgruppe !== 'intern';

const seenKey = (userId, version) => `cl_seen_${userId}_v${version}`;
const laterKey = (userId, version) => `cl_later_${userId}_v${version}`;

// Einträge seit der zuletzt gesehenen Version (nach Zielgruppe gefiltert)
const getNewEntries = (userId, isSuperAdmin) => {
  // Letzte bestätigte Version finden
  let lastSeenIdx = CHANGELOG.length; // default: alle neu
  for (let i = 0; i < CHANGELOG.length; i++) {
    if (localStorage.getItem(seenKey(userId, CHANGELOG[i].version)) === '1') {
      lastSeenIdx = i;
      break;
    }
  }
  // Alles vor dem letzten gesehenen Eintrag ist neu — interne Einträge für Dojo-Admins ausblenden
  return CHANGELOG.slice(0, lastSeenIdx).filter(e => istSichtbar(e, isSuperAdmin));
};

const ChangelogPopup = () => {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const { userId, isSuperAdmin } = getAuth();

  useEffect(() => {
    if (!userId) return;

    // "Später lesen" in dieser Session gesetzt?
    if (sessionStorage.getItem(laterKey(userId, CURRENT_VERSION)) === '1') return;

    const newEntries = getNewEntries(userId, isSuperAdmin);
    if (newEntries.length === 0) return;

    setEntries(newEntries);
    setExpanded(newEntries[0]?.version ?? null); // neuesten Eintrag aufgeklappt
    setVisible(true);
  }, [userId, isSuperAdmin]);

  const confirm = () => {
    if (!userId) return;
    // Alle neuen Einträge als gelesen markieren
    entries.forEach(e => localStorage.setItem(seenKey(userId, e.version), '1'));
    setVisible(false);
  };

  const later = () => {
    if (!userId) return;
    sessionStorage.setItem(laterKey(userId, CURRENT_VERSION), '1');
    setVisible(false);
  };

  const toggle = (version) => setExpanded(v => v === version ? null : version);

  if (!visible) return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9990,
      background: 'rgba(0,0,0,0.65)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(22,22,40,0.99)',
        border: '1px solid rgba(255,215,0,0.25)',
        borderRadius: '14px',
        width: '520px', maxWidth: '96vw',
        maxHeight: '82vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.1rem 1.4rem 0.9rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: '0.7rem'
        }}>
          <div style={{
            background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)',
            borderRadius: '8px', padding: '0.4rem', display: 'flex', color: '#ffd700'
          }}>
            <Sparkles size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#ffd700', fontWeight: 700, fontSize: '1rem' }}>
              Was ist neu in v{CURRENT_VERSION}?
            </div>
            <div style={{ color: '#888', fontSize: '0.78rem', marginTop: '1px' }}>
              {entries.length === 1
                ? '1 neue Version seit deinem letzten Login'
                : `${entries.length} neue Versionen seit deinem letzten Login`}
            </div>
          </div>
          <button onClick={later} style={{
            background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px'
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Entries */}
        <div style={{ overflowY: 'auto', padding: '0.75rem 1.1rem', flex: 1 }}>
          {entries.map((e) => {
            const isOpen = expanded === e.version;
            const color = TYPE_COLOR[e.type] || '#888';
            return (
              <div key={e.version} style={{
                marginBottom: '0.5rem',
                border: `1px solid ${isOpen ? color + '40' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '9px',
                background: isOpen ? color + '08' : 'rgba(255,255,255,0.03)',
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}>
                {/* Entry Header */}
                <button onClick={() => toggle(e.version)} style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0.65rem 0.85rem',
                  display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'left'
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    background: color + '20', border: `1px solid ${color}40`,
                    borderRadius: '5px', padding: '0.15rem 0.45rem',
                    color, fontSize: '0.7rem', fontWeight: 700, flexShrink: 0
                  }}>
                    {TYPE_ICON[e.type]} {TYPE_LABEL[e.type] || e.type}
                  </span>
                  <span style={{ color: '#aaa', fontSize: '0.75rem', flexShrink: 0 }}>v{e.version}</span>
                  <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>
                    {e.title}
                  </span>
                  <span style={{ color: '#555', flexShrink: 0 }}>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {/* Entry Details */}
                {isOpen && (
                  <div style={{ padding: '0 0.85rem 0.75rem' }}>
                    {e.description && (
                      <p style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                        {e.description}
                      </p>
                    )}
                    {e.highlights && (
                      <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                        {e.highlights.map((h, i) => (
                          <li key={i} style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '0.25rem', lineHeight: 1.5 }}>
                            {h}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.85rem 1.4rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', alignItems: 'center'
        }}>
          <button onClick={later} style={{
            padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.85rem',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#aaa', cursor: 'pointer'
          }}>
            Später lesen
          </button>
          <button onClick={confirm} style={{
            padding: '0.45rem 1.2rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
            background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.35)',
            color: '#ffd700', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}>
            <BookOpen size={14} /> Gelesen ✓
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ChangelogPopup;
