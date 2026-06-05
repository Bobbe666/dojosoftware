import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Building2, Users, Target, Award, ArrowRight } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config';

// ============================================================================
// Cmd+K Command-Palette — globale Suche im Super-Admin-Dashboard.
// Durchsucht Dojos, Mitglieder, Akquise-Kontakte, Verbandsmitglieder
// (/api/admin/global-search) + Schnell-Aktionen (Tab-Sprünge).
// Öffnen: Cmd+K (Mac) / Ctrl+K — Schließen: Esc.
// ============================================================================

const QUICK_ACTIONS = [
  { label: '🗂️ Kontakte öffnen',            tab: 'kontakte',      keywords: 'kontakte akquise crm' },
  { label: '🏆 Verband öffnen',              tab: 'verband',       keywords: 'verband mitgliedschaften registrierungen' },
  { label: '💻 Software / Lizenzen öffnen',  tab: 'software',      keywords: 'software lizenzen dojos trial' },
  { label: '💰 Finanzen öffnen',             tab: 'finanzen',      keywords: 'finanzen umsatz lastschrift buchhaltung bestellungen' },
  { label: '📣 Kommunikation öffnen',        tab: 'kommunikation', keywords: 'kommunikation push chat support tickets' },
  { label: '🎯 Entwicklung / Prognose öffnen', tab: 'entwicklung', keywords: 'entwicklung ziele prognose wachstum statistik' },
  { label: '⚙️ System öffnen',               tab: 'system',        keywords: 'system benutzer backup ssl security' },
];

const GROUP_CONFIG = [
  { key: 'dojos',     label: 'Dojos',            icon: Building2, tab: 'software',
    render: d => `${d.dojoname}${d.inhaber ? ` — ${d.inhaber}` : ''}${d.ort ? ` (${d.ort})` : ''}` },
  { key: 'kontakte',  label: 'Akquise-Kontakte', icon: Target,    tab: 'kontakte',
    render: k => `${k.organisation}${k.ansprechpartner ? ` — ${k.ansprechpartner}` : ''}${k.ort ? ` (${k.ort})` : ''}` },
  { key: 'verband',   label: 'Verbandsmitglieder', icon: Award,   tab: 'verband',
    render: v => `${v.name}${v.mitgliedsnummer ? ` · ${v.mitgliedsnummer}` : ''} — ${v.status}` },
  { key: 'mitglieder', label: 'Dojo-Mitglieder',  icon: Users,    tab: null, // kein Sprungziel im Super-Admin
    render: m => `${m.vorname} ${m.nachname} — ${m.dojoname}${m.email ? ` (${m.email})` : ''}` },
];

const CommandPalette = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Cmd+K / Ctrl+K global
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery(''); setResults(null); setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced Suche
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults(null); setSelectedIdx(0); return; }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetchWithAuth(`${config.apiBaseUrl}/admin/global-search?q=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(d => { if (d.success) { setResults(d.results); setSelectedIdx(0); } })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  // Flache Liste aller anwählbaren Einträge (Aktionen + Treffer) für Tastatur-Navigation
  const buildItems = useCallback(() => {
    const items = [];
    const ql = query.trim().toLowerCase();
    QUICK_ACTIONS
      .filter(a => !ql || a.label.toLowerCase().includes(ql) || a.keywords.includes(ql))
      .forEach(a => items.push({ type: 'action', label: a.label, tab: a.tab }));
    if (results) {
      GROUP_CONFIG.forEach(g => {
        (results[g.key] || []).forEach(row => {
          items.push({ type: g.key, label: g.render(row), tab: g.tab, group: g.label, icon: g.icon });
        });
      });
    }
    return items;
  }, [query, results]);

  const items = buildItems();

  const selectItem = (item) => {
    if (!item) return;
    setOpen(false);
    if (item.tab) onNavigate?.(item.tab);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); selectItem(items[selectedIdx]); }
  };

  if (!open) return null;

  let renderedGroup = null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(640px, 92vw)', maxHeight: '60vh', display: 'flex', flexDirection: 'column',
          background: 'rgba(26,26,46,0.99)', // opak — niemals var(--bg-card) für Modals
          border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden'
        }}
      >
        {/* Suchfeld */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Search size={18} style={{ color: '#888', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Dojo, Mitglied, Kontakt, Verbandsmitglied suchen — oder Aktion wählen…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#fff', fontSize: 15 }}
          />
          <kbd style={{ fontSize: 11, color: '#888', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 5, padding: '2px 6px' }}>Esc</kbd>
        </div>

        {/* Ergebnisliste */}
        <div style={{ overflowY: 'auto', padding: '6px 0' }}>
          {loading && <div style={{ padding: '10px 16px', color: '#888', fontSize: 13 }}>Suche…</div>}
          {items.length === 0 && !loading && (
            <div style={{ padding: '18px 16px', color: '#888', fontSize: 13, textAlign: 'center' }}>
              {query.trim().length >= 2 ? 'Keine Treffer' : 'Tippen zum Suchen — mind. 2 Zeichen'}
            </div>
          )}
          {items.map((item, idx) => {
            const showGroupHeader = item.group && item.group !== renderedGroup;
            if (item.group) renderedGroup = item.group;
            const Icon = item.icon;
            return (
              <React.Fragment key={idx}>
                {idx === 0 && item.type === 'action' && (
                  <div style={{ padding: '4px 16px', fontSize: 10, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: '#777' }}>Aktionen</div>
                )}
                {showGroupHeader && (
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: '#777' }}>{item.group}</div>
                )}
                <div
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
                    cursor: item.tab ? 'pointer' : 'default', fontSize: 14, color: '#eee',
                    background: idx === selectedIdx ? 'rgba(99,102,241,0.18)' : 'transparent',
                    borderLeft: idx === selectedIdx ? '3px solid #6366f1' : '3px solid transparent'
                  }}
                >
                  {Icon ? <Icon size={15} style={{ color: '#999', flexShrink: 0 }} /> : null}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                  {item.tab && idx === selectedIdx && <ArrowRight size={14} style={{ color: '#6366f1' }} />}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.1)',
          fontSize: 11, color: '#777', display: 'flex', gap: 14 }}>
          <span>↑↓ Navigieren</span><span>↵ Öffnen</span><span>Esc Schließen</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
