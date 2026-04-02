import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import DOMPurify from 'dompurify';
import { DatenContext } from '@shared/DatenContext.jsx';

// ─── Konstanten ──────────────────────────────────────────────────────────────
const TYPE_ICONS  = { video: '🎥', pdf: '📄', bild: '🖼️', link: '🔗', text: '📝' };
const TYPE_LABELS = { video: 'Video', pdf: 'PDF', bild: 'Bild', link: 'Link', text: 'Text' };
const TYPE_COLORS = { video: '#ef4444', pdf: '#3b82f6', bild: '#8b5cf6', link: '#06b6d4', text: '#f59e0b' };
const KAT_TYP_LABELS = { guertel: 'Gürtel', sonstiges: 'Sonstiges' };
const TYPES = ['video', 'pdf', 'bild', 'link', 'text'];

// Kategorie-Icons für Prüfungsinhalte
const PRUEF_KAT_ICONS = {
  // Kickboxen-spezifisch
  warmup:         '🔥',
  kraft:          '💪',
  kampfstellung:  '👣',
  handtechniken:  '👊',
  fusstechniken:  '🦵',
  kombinationen:  '🔄',
  abwehr:         '🛡️',
  sandsack:       '🏋️',
  sparring:       '🥊',
  kampfrichter:   '🏅',
  anatomie:       '🫀',
  ernaehrung:     '🥗',
  erstehilfe:     '🚑',
  pruefungsfragen:'❓',
  // Allgemein (Karate, Judo, etc.)
  grundtechniken: '🥋',
  theorie:        '📚',
  kata:           '🎭',
  kumite:         '⚔️',
  waffen:         '🗡️',
  positionen:     '🧍',
  escapes:        '🏃',
  submissions:    '🤜',
  takedowns:      '🎯',
  glossar:        '📖',
  sonstiges:      '📋',
};

// Deutsche Bezeichnungen für Kategorien
const PRUEF_KAT_LABELS = {
  warmup:         'Warm Up',
  kraft:          'Kraft & Fitness',
  kampfstellung:  'Kampfstellung',
  handtechniken:  'Handtechniken',
  fusstechniken:  'Fußtechniken',
  kombinationen:  'Kombinationen',
  abwehr:         'Abwehrtechniken',
  sandsack:       'Sandsack & Pratzen',
  sparring:       'Sparring',
  kampfrichter:   'Kampfrichterwissen',
  anatomie:       'Anatomie',
  ernaehrung:     'Ernährung',
  erstehilfe:     'Erste Hilfe',
  pruefungsfragen:'Prüfungsfragen',
  grundtechniken: 'Grundtechniken',
  theorie:        'Theorie',
  kata:           'Kata',
  kumite:         'Kumite',
  waffen:         'Waffen',
  positionen:     'Positionen',
  escapes:        'Escapes',
  submissions:    'Submissions',
  takedowns:      'Takedowns',
  glossar:        'Glossar',
  sonstiges:      'Sonstiges',
};

const EMPTY_FORM = {
  titel: '', typ: 'video', stil_id: '', kategorie_id: '',
  url: '', beschreibung: '', inhalt: '', sichtbar_ab_reihenfolge: ''
};
const EMPTY_KAT = { name: '', typ: 'sonstiges', stil_id: '', icon: '' };

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  page: { padding: '1.5rem', color: 'var(--text-primary)', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.65rem', flexShrink: 0 },
  h1: { fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
  headerBtns: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  layout: { display: 'flex', gap: '1.1rem', flex: 1, minHeight: 0 },

  // Sidebar
  sidebar: { width: '205px', flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '0.55rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  sbSection: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.5rem 0.5rem 0.12rem', marginTop: '0.2rem' },
  sbItem: (active) => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.35rem 0.55rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.84rem',
    background: active ? '#FFD70022' : 'transparent',
    color: active ? '#FFD700' : 'var(--text-primary)',
    border: active ? '1px solid #FFD70033' : '1px solid transparent',
    transition: 'all 0.12s'
  }),
  sbCount: { fontSize: '0.68rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', borderRadius: '999px', padding: '0.08rem 0.38rem', flexShrink: 0 },
  sbAddBtn: { marginTop: '0.4rem', padding: '0.35rem 0.55rem', background: 'transparent', border: '1px dashed var(--border-default)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem', width: '100%', textAlign: 'left' },
  katForm: { background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.15rem' },
  katInput: { background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-default)', borderRadius: '5px', padding: '0.35rem 0.5rem', color: 'var(--text-primary)', fontSize: '0.79rem', outline: 'none', width: '100%', boxSizing: 'border-box' },

  // Main
  mainArea: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.7rem', overflow: 'hidden', minWidth: 0 },
  filterBar: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 },
  fChip: (active) => ({
    padding: '0.25rem 0.58rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 500,
    border: `1px solid ${active ? '#FFD700' : 'var(--border-default)'}`,
    background: active ? '#FFD70022' : 'transparent',
    color: active ? '#FFD700' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.12s'
  }),
  scrollArea: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingRight: '0.2rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 1fr))', gap: '0.8rem', alignContent: 'start' },
  card: { background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' },
  cardTitle: { fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', flex: 1 },
  typeBadge: (type) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.22rem', padding: '0.17rem 0.45rem',
    borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600, flexShrink: 0,
    background: (TYPE_COLORS[type] || '#6b7280') + '22', color: TYPE_COLORS[type] || '#6b7280',
    border: `1px solid ${(TYPE_COLORS[type] || '#6b7280')}44`
  }),
  katBadge: { display: 'inline-block', fontSize: '0.68rem', color: '#FFD700', background: '#FFD70011', border: '1px solid #FFD70033', borderRadius: '4px', padding: '0.1rem 0.35rem' },
  desc: { fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  htmlPreview: { fontSize: '0.79rem', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '0.5rem', maxHeight: '85px', overflow: 'hidden' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.4rem', gap: '0.35rem', flexWrap: 'wrap' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.77rem', padding: '0.18rem 0.35rem', borderRadius: '4px' },
  emptyState: { textAlign: 'center', color: 'var(--text-secondary)', padding: '2.5rem 1rem', fontSize: '0.92rem', gridColumn: '1 / -1' },

  // Prüfungsinhalte Sektion
  pruefSection: { background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1.1rem 1.1rem 0.8rem', flexShrink: 0 },
  pruefSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  pruefSectionTitle: { fontWeight: 700, fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  pruefCount: { fontSize: '0.72rem', color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.06)', padding: '0.18rem 0.55rem', borderRadius: '999px', fontWeight: 500 },
  pruefGuertelBlock: { marginBottom: '0.5rem', borderRadius: '9px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' },
  pruefGuertelHeader: (color, open) => ({
    display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.9rem',
    cursor: 'pointer',
    background: open
      ? `linear-gradient(90deg, ${color || '#888'}1a 0%, rgba(0,0,0,0.12) 70%)`
      : 'rgba(255,255,255,0.02)',
    borderLeft: `3px solid ${color || '#888'}`,
    borderBottom: open ? '1px solid rgba(255,255,255,0.07)' : 'none',
    transition: 'background 0.18s',
  }),
  pruefGuertelDot: (color) => ({
    width: 38, height: 12, borderRadius: 6,
    background: color || '#888',
    flexShrink: 0,
    border: '1.5px solid rgba(255,255,255,0.15)',
    boxShadow: `0 0 6px ${color || '#888'}55`,
  }),
  pruefGuertelName: { fontWeight: 700, fontSize: '0.88rem', flex: 1, color: 'rgba(255,255,255,0.88)' },
  pruefKatSection: { padding: '0 0 0.15rem' },
  pruefKatTitle: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)',
    textTransform: 'uppercase', letterSpacing: '0.09em',
    padding: '0.55rem 0.9rem 0.3rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    marginBottom: '0.05rem',
  },
  pruefRow: {
    display: 'grid', gridTemplateColumns: '28px 1fr auto',
    gap: '0 0.55rem', padding: '0.38rem 0.9rem',
    alignItems: 'start', borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  pruefPflichtDot: (pflicht) => ({
    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: '0.08rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.6rem', fontWeight: 700,
    background: pflicht ? 'rgba(255,215,0,0.11)' : 'rgba(255,255,255,0.04)',
    border: pflicht ? '1.5px solid rgba(255,215,0,0.3)' : '1.5px solid rgba(255,255,255,0.1)',
    color: pflicht ? '#FFD700' : 'rgba(255,255,255,0.18)',
  }),
  pruefTitel: { fontSize: '0.84rem', fontWeight: 500, lineHeight: 1.45, color: 'rgba(255,255,255,0.82)' },
  pruefDesc: { fontSize: '0.74rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.08rem', lineHeight: 1.35 },
  pruefDelBtn:  { border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.78rem', padding: '0.22rem 0.3rem', borderRadius: '5px', background: 'rgba(239,68,68,0.1)', flexShrink: 0, transition: 'background 0.15s, color 0.15s', lineHeight: 1 },
  pruefEditBtn: { border: 'none', color: '#fde68a', cursor: 'pointer', fontSize: '0.78rem', padding: '0.22rem 0.3rem', borderRadius: '5px', background: 'rgba(255,215,0,0.1)', flexShrink: 0, transition: 'background 0.15s, color 0.15s', lineHeight: 1 },

  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal: { background: 'var(--modal-bg-dark, #1a1a2e)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' },
  modalTitle: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(205px, 1fr))', gap: '0.65rem', marginBottom: '0.9rem' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  label: { fontSize: '0.77rem', color: 'var(--text-secondary)', fontWeight: 500 },
  input: { background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '0.45rem 0.65rem', color: 'var(--text-primary)', fontSize: '0.87rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  select: { background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '0.45rem 0.65rem', color: 'var(--text-primary)', fontSize: '0.87rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  textarea: { background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '0.45rem 0.65rem', color: 'var(--text-primary)', fontSize: '0.87rem', outline: 'none', width: '100%', boxSizing: 'border-box', minHeight: '72px', resize: 'vertical' },
  formRow: { gridColumn: '1 / -1' },
  toolbar: { display: 'flex', gap: '0.18rem', flexWrap: 'wrap', padding: '0.4rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px 6px 0 0', borderBottom: '1px solid var(--border-default)' },
  toolBtn: (active) => ({ padding: '0.2rem 0.45rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.79rem', fontWeight: active ? 700 : 400, background: active ? '#FFD70033' : 'transparent', color: active ? '#FFD700' : 'var(--text-secondary)' }),
  toolSep: { width: '1px', background: 'var(--border-default)', margin: '0 0.12rem', alignSelf: 'stretch' },
  editorWrap: { border: '1px solid var(--border-default)', borderTop: 'none', borderRadius: '0 0 6px 6px', background: 'rgba(0,0,0,0.1)', minHeight: '200px' },
  alert: (type) => ({ padding: '0.55rem 0.9rem', borderRadius: '7px', marginBottom: '0.65rem', fontSize: '0.86rem', background: type === 'error' ? '#dc262622' : '#22c55e22', color: type === 'error' ? '#f87171' : '#4ade80', border: `1px solid ${type === 'error' ? '#dc262644' : '#22c55e44'}` }),
  importList: { display: 'flex', flexDirection: 'column', gap: '0.28rem', maxHeight: '270px', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '0.4rem' },
  importRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.45rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.845rem' },
};

// ─── TipTap Toolbar ──────────────────────────────────────────────────────────
function TipTapToolbar({ editor }) {
  if (!editor) return null;
  const b = (label, fn, active, title) => (
    <button key={label + (title || '')} style={s.toolBtn(active)} onMouseDown={e => { e.preventDefault(); fn(); }} title={title || label}>
      {label}
    </button>
  );
  return (
    <div style={s.toolbar}>
      {b('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {b('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {b('U', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
      <span style={s.toolSep} />
      {b('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
      {b('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
      {b('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
      <span style={s.toolSep} />
      {b('≡', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Aufzählung')}
      {b('1.', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Nummeriert')}
      <span style={s.toolSep} />
      {b('◀', () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }), 'Links')}
      {b('◉', () => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }), 'Mitte')}
      {b('▶', () => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }), 'Rechts')}
      <span style={s.toolSep} />
      {b('🔗', () => {
        const url = window.prompt('URL:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else if (url === '') editor.chain().focus().unsetLink().run();
      }, editor.isActive('link'), 'Link')}
    </div>
  );
}

// ─── Prüfungsinhalte Sektion ──────────────────────────────────────────────────
function PruefSection({ pruefungsinhalte, onDelete, onEdit, onAdd }) {
  const [offeneGuertel, setOffeneGuertel] = useState(() => new Set());

  useEffect(() => {
    // Beim Laden: alle Gürtel aufklappen
    const ids = new Set(pruefungsinhalte.map(p => p.graduierung_id));
    setOffeneGuertel(ids);
  }, [pruefungsinhalte.length > 0 ? pruefungsinhalte[0]?.stil_id : null]);

  // Gruppieren: Gürtel → Kategorie → Items
  const guertelMap = {};
  pruefungsinhalte.forEach(p => {
    const key = p.graduierung_id;
    if (!guertelMap[key]) {
      guertelMap[key] = {
        graduierung_id: p.graduierung_id,
        name: p.gürtel_name,
        farbe: p.farbe_hex,
        reihenfolge: p.gürtel_reihenfolge,
        kategorien: {}
      };
    }
    const kat = p.kategorie || 'sonstiges';
    if (!guertelMap[key].kategorien[kat]) guertelMap[key].kategorien[kat] = [];
    guertelMap[key].kategorien[kat].push(p);
  });

  const guertelListe = Object.values(guertelMap).sort((a, b) => a.reihenfolge - b.reihenfolge);

  const toggleGuertel = (id) => {
    setOffeneGuertel(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!guertelListe.length) return null;

  return (
    <div style={s.pruefSection}>
      <div style={s.pruefSectionHeader}>
        <span style={s.pruefSectionTitle}>
          <span style={{ fontSize: '1rem' }}>🎯</span>
          Prüfungsinhalte
        </span>
        <span style={s.pruefCount}>{pruefungsinhalte.length} Einträge · {guertelListe.length} Gürtel</span>
      </div>

      {guertelListe.map(g => {
        const isOpen = offeneGuertel.has(g.graduierung_id);
        const totalItems = Object.values(g.kategorien).reduce((a, k) => a + k.length, 0);
        return (
          <div key={g.graduierung_id} style={s.pruefGuertelBlock}>

            {/* Belt Header */}
            <div style={s.pruefGuertelHeader(g.farbe, isOpen)} onClick={() => toggleGuertel(g.graduierung_id)}>
              <div style={s.pruefGuertelDot(g.farbe)} title={g.name} />
              <span style={s.pruefGuertelName}>{g.name}</span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 600,
                padding: '0.12rem 0.42rem', borderRadius: '999px',
                background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)',
              }}>{totalItems}</span>
              <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.28)', marginLeft: '0.1rem', userSelect: 'none' }}>
                {isOpen ? '▾' : '▸'}
              </span>
              {onAdd && (
                <button
                  style={{
                    marginLeft: 'auto', border: 'none', borderRadius: '5px',
                    background: 'rgba(255,215,0,0.12)', color: '#FFD700',
                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                    padding: '0.18rem 0.45rem', lineHeight: 1, flexShrink: 0,
                  }}
                  onClick={(e) => { e.stopPropagation(); onAdd(g.graduierung_id, g.name); }}
                  title="Prüfungsinhalt hinzufügen"
                >+ Inhalt</button>
              )}
            </div>

            {/* Belt Content — Kategorien in 2 Spalten */}
            {isOpen && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
              }}>
                {Object.entries(g.kategorien).sort(([a], [b]) => a.localeCompare(b)).map(([kat, items]) => (
                  <div key={kat} style={{
                    ...s.pruefKatSection,
                    borderRight: '1px solid rgba(255,255,255,0.045)',
                  }}>
                    {/* Category Label */}
                    <div style={s.pruefKatTitle}>
                      <span>{PRUEF_KAT_ICONS[kat] || '📋'}</span>
                      <span>{PRUEF_KAT_LABELS[kat] || kat.charAt(0).toUpperCase() + kat.slice(1)}</span>
                      <span style={{ marginLeft: 'auto', opacity: 0.5 }}>{items.length}</span>
                    </div>

                    {/* Items */}
                    {items.map((item, idx) => (
                      <div key={item.id} className="lp-pruef-row" style={{
                        ...s.pruefRow,
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                      }}>
                        <div
                          style={s.pruefPflichtDot(item.pflicht)}
                          title={item.pflicht ? 'Pflicht' : 'Optional'}
                        >
                          {item.pflicht ? '★' : ''}
                        </div>
                        <div>
                          <div style={s.pruefTitel}>{item.titel}</div>
                          {item.beschreibung && (
                            <div style={s.pruefDesc}>{item.beschreibung}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.05rem' }}>
                          <button
                            className="lp-pruef-edit"
                            style={s.pruefEditBtn}
                            onClick={() => onEdit(item)}
                            title="Bearbeiten"
                          >✎</button>
                          <button
                            className="lp-pruef-del"
                            style={s.pruefDelBtn}
                            onClick={() => onDelete(item)}
                            title="Löschen"
                          >✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.7rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.28)' }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, background: 'rgba(255,215,0,0.11)', border: '1.5px solid rgba(255,215,0,0.3)', color: '#FFD700' }}>★</span>
          Pflichtinhalt
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.28)' }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)' }} />
          Optional
        </span>
      </div>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Lernplattform() {
  const { stile, ladeAlleDaten } = useContext(DatenContext);

  // Materialien
  const [kategorien, setKategorien] = useState([]);
  const [materialien, setMaterialien] = useState([]);
  const [pruefungsinhalte, setPruefungsinhalte] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter
  const [activeFilter, setActiveFilter] = useState(null);
  const [filterTyp, setFilterTyp] = useState('');

  // Material-Formular
  const [showForm, setShowForm] = useState(false);
  const [editMaterial, setEditMaterial] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);

  // Kategorie-Formular
  const [showKatForm, setShowKatForm] = useState(false);
  const [katForm, setKatForm] = useState(EMPTY_KAT);
  const [katLoading, setKatLoading] = useState(false);

  // Prüfungsinhalt bearbeiten
  const [editPruefItem, setEditPruefItem] = useState(null);
  const [editPruefForm, setEditPruefForm] = useState({ titel: '', beschreibung: '', pflicht: false, kategorie: 'sonstiges' });
  const [editPruefLoading, setEditPruefLoading] = useState(false);

  // Prüfungsinhalt hinzufügen
  const [addPruefGuertelId, setAddPruefGuertelId] = useState(null);
  const [addPruefGuertelName, setAddPruefGuertelName] = useState('');
  const [addPruefForm, setAddPruefForm] = useState({ titel: '', beschreibung: '', pflicht: false, kategorie: 'grundtechniken' });
  const [addPruefLoading, setAddPruefLoading] = useState(false);

  // Kategorie bearbeiten
  const [editKat, setEditKat] = useState(null);
  const [editKatForm, setEditKatForm] = useState({ name: '', typ: 'sonstiges', icon: '', sort_order: 0 });
  const [editKatLoading, setEditKatLoading] = useState(false);

  // Import
  const [showImport, setShowImport] = useState(false);
  const [importStilId, setImportStilId] = useState('');
  const [importKatId, setImportKatId] = useState('');
  const [importMaterials, setImportMaterials] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [selectedImport, setSelectedImport] = useState(new Set());
  const [targetKatId, setTargetKatId] = useState('');

  // TipTap
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content: '',
    onUpdate: ({ editor }) => setForm(p => ({ ...p, inhalt: editor.getHTML() })),
    editorProps: { attributes: { class: 'lp-tiptap-content' } }
  });

  useEffect(() => {
    if (editor && showForm) {
      const html = editMaterial?.inhalt || '';
      setTimeout(() => editor.commands.setContent(html), 30);
      setForm(prev => ({ ...prev, inhalt: html }));
    }
  }, [showForm, editMaterial?.id]);

  // Daten laden
  useEffect(() => {
    if (!stile || stile.length === 0) ladeAlleDaten();
    loadKategorien();
    loadMaterialien();
  }, []);

  useEffect(() => {
    loadMaterialien();
    if (activeFilter?.type === 'stil') {
      loadPruefungsinhalte(activeFilter.id);
      loadPdfConfig(activeFilter.id);
    } else {
      setPruefungsinhalte([]);
    }
  }, [activeFilter, filterTyp]);

  const loadKategorien = async () => {
    try {
      const res = await axios.get('/lernmaterialien/kategorien');
      setKategorien(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const loadMaterialien = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (activeFilter?.type === 'stil') params.append('stil_id', activeFilter.id);
      if (activeFilter?.type === 'kat') params.append('kategorie_id', activeFilter.id);
      if (filterTyp) params.append('typ', filterTyp);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await axios.get(`/lernmaterialien${q}`);
      const d = res.data;
      setMaterialien(Array.isArray(d) ? d : Array.isArray(d?.materialien) ? d.materialien : []);
    } catch {
      setError('Fehler beim Laden der Lernmaterialien.');
    } finally {
      setLoading(false);
    }
  };

  const loadPruefungsinhalte = async (stil_id) => {
    try {
      const res = await axios.get(`/lernmaterialien/pruefungsinhalte?stil_id=${stil_id}`);
      setPruefungsinhalte(res.data?.inhalte || []);
    } catch {
      setPruefungsinhalte([]);
    }
  };

  // ─── Filter ──────────────────────────────────────────────────────────────────
  const selectFilter = (f) => setActiveFilter(prev =>
    prev?.type === f.type && prev?.id === f.id ? null : f
  );

  const hasTextMaterials = materialien.some(m => m.typ === 'text' && m.inhalt);
  const exportPdfUrl = activeFilter && hasTextMaterials
    ? activeFilter.type === 'stil'
      ? `/api/lernmaterialien/export-pdf?stil_id=${activeFilter.id}`
      : `/api/lernmaterialien/export-pdf?kategorie_id=${activeFilter.id}`
    : null;

  const pruefPdfUrl = activeFilter?.type === 'stil' && pruefungsinhalte.length > 0
    ? `/api/lernmaterialien/pruefungsordnung-pdf?stil_id=${activeFilter.id}`
    : null;

  const [pdfLoading, setPdfLoading] = useState(false);

  // PDF-Einstellungen
  const [showPdfConfig, setShowPdfConfig] = useState(false);
  const [pdfConfigLoading, setPdfConfigLoading] = useState(false);
  const [pdfConfigForm, setPdfConfigForm] = useState({
    titel: '', organisation: '', organisation_sub: '',
    akzent_farbe: '#c0392b', deck_zeigen: true, allgemein_zeigen: true,
    guertel_zeigen: true, fusszeile: ''
  });

  const downloadPdf = async (url, filename) => {
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'PDF-Download fehlgeschlagen');
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError('PDF-Download fehlgeschlagen');
    } finally {
      setPdfLoading(false);
    }
  };

  const loadPdfConfig = async (stilId) => {
    try {
      const res = await axios.get(`/lernmaterialien/pdf-config/${stilId}`);
      const c = res.data.config || {};
      setPdfConfigForm({
        titel: c.titel || '',
        organisation: c.organisation || '',
        organisation_sub: c.organisation_sub || '',
        akzent_farbe: c.akzent_farbe || '#c0392b',
        deck_zeigen: c.deck_zeigen !== 0,
        allgemein_zeigen: c.allgemein_zeigen !== 0,
        guertel_zeigen: c.guertel_zeigen !== 0,
        fusszeile: c.fusszeile || '',
      });
    } catch { /* use defaults */ }
  };

  const handleSavePdfConfig = async (e) => {
    e.preventDefault();
    setPdfConfigLoading(true);
    try {
      await axios.put(`/lernmaterialien/pdf-config/${activeFilter.id}`, pdfConfigForm);
      showSuccess('PDF-Einstellungen gespeichert.');
      setShowPdfConfig(false);
    } catch { setError('Fehler beim Speichern der PDF-Einstellungen.'); }
    finally { setPdfConfigLoading(false); }
  };

  // ─── Kategorie CRUD ──────────────────────────────────────────────────────────
  const handleKatSubmit = async (e) => {
    e.preventDefault();
    if (!katForm.name.trim()) return;
    setKatLoading(true);
    try {
      await axios.post('/lernmaterialien/kategorien', {
        name: katForm.name, typ: katForm.typ,
        stil_id: katForm.stil_id || null, icon: katForm.icon || null
      });
      setKatForm(EMPTY_KAT);
      setShowKatForm(false);
      await loadKategorien();
      showSuccess('Kategorie angelegt.');
    } catch { setError('Fehler beim Anlegen der Kategorie.'); }
    finally { setKatLoading(false); }
  };

  const handleKatDelete = async (kat, e) => {
    e.stopPropagation();
    if (!window.confirm(`Kategorie "${kat.name}" löschen?`)) return;
    try {
      await axios.delete(`/lernmaterialien/kategorien/${kat.kategorie_id}`);
      if (activeFilter?.type === 'kat' && activeFilter.id === kat.kategorie_id) setActiveFilter(null);
      await loadKategorien();
    } catch { setError('Fehler beim Löschen.'); }
  };

  // ─── Material CRUD ───────────────────────────────────────────────────────────
  const openForm = (material = null) => {
    setEditMaterial(material);
    if (material) {
      setForm({
        titel: material.titel || '', typ: material.typ || 'video',
        stil_id: material.stil_id || '', kategorie_id: material.kategorie_id || '',
        url: material.url || '', beschreibung: material.beschreibung || '',
        inhalt: material.inhalt || '', sichtbar_ab_reihenfolge: material.sichtbar_ab_reihenfolge ?? ''
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        kategorie_id: activeFilter?.type === 'kat' ? activeFilter.id : '',
        stil_id: activeFilter?.type === 'stil' ? activeFilter.id : ''
      });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        stil_id: form.stil_id || null,
        kategorie_id: form.kategorie_id || null,
        sichtbar_ab_reihenfolge: form.sichtbar_ab_reihenfolge !== '' ? parseInt(form.sichtbar_ab_reihenfolge) : null,
        inhalt: form.typ === 'text' ? form.inhalt : null,
        url: ['video', 'pdf', 'link', 'bild'].includes(form.typ) ? form.url : null,
      };
      if (editMaterial) {
        await axios.put(`/lernmaterialien/${editMaterial.id}`, payload);
        showSuccess('Material aktualisiert.');
      } else {
        await axios.post('/lernmaterialien', payload);
        showSuccess('Material hinzugefügt.');
      }
      setShowForm(false);
      setEditMaterial(null);
      await loadMaterialien();
      await loadKategorien();
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : (msg?.error || 'Fehler beim Speichern.'));
    } finally { setFormLoading(false); }
  };

  const handleDelete = async (material) => {
    if (!window.confirm(`"${material.titel}" wirklich löschen?`)) return;
    try {
      await axios.delete(`/lernmaterialien/${material.id}`);
      setMaterialien(prev => prev.filter(m => m.id !== material.id));
      await loadKategorien();
      showSuccess('Material gelöscht.');
    } catch { setError('Fehler beim Löschen.'); }
  };

  const handleDeletePruef = async (item) => {
    if (!window.confirm(`Prüfungsinhalt "${item.titel}" löschen?`)) return;
    try {
      await axios.delete(`/lernmaterialien/pruefungsinhalte/${item.id}`);
      setPruefungsinhalte(prev => prev.filter(p => p.id !== item.id));
      showSuccess('Prüfungsinhalt gelöscht.');
    } catch { setError('Fehler beim Löschen des Prüfungsinhalts.'); }
  };

  // ─── Prüfungsinhalt bearbeiten ────────────────────────────────────────────────
  const openEditPruef = (item) => {
    setEditPruefItem(item);
    setEditPruefForm({
      titel: item.titel || '',
      beschreibung: item.beschreibung || '',
      pflicht: !!item.pflicht,
      kategorie: item.kategorie || 'sonstiges',
    });
  };

  const handleEditPruefSubmit = async (e) => {
    e.preventDefault();
    setEditPruefLoading(true);
    try {
      await axios.put(`/lernmaterialien/pruefungsinhalte/${editPruefItem.id}`, editPruefForm);
      setPruefungsinhalte(prev => prev.map(p =>
        p.id === editPruefItem.id
          ? { ...p, ...editPruefForm, pflicht: editPruefForm.pflicht ? 1 : 0 }
          : p
      ));
      setEditPruefItem(null);
      showSuccess('Prüfungsinhalt aktualisiert.');
    } catch { setError('Fehler beim Aktualisieren.'); }
    finally { setEditPruefLoading(false); }
  };

  const openAddPruef = (graduierung_id, guertelName) => {
    setAddPruefGuertelId(graduierung_id);
    setAddPruefGuertelName(guertelName);
    setAddPruefForm({ titel: '', beschreibung: '', pflicht: false, kategorie: 'grundtechniken' });
  };

  const handleAddPruefSubmit = async (e) => {
    e.preventDefault();
    setAddPruefLoading(true);
    try {
      const res = await axios.post('/lernmaterialien/pruefungsinhalte', {
        ...addPruefForm,
        graduierung_id: addPruefGuertelId,
      });
      // Reload pruefungsinhalte for current stil
      const stilId = pruefungsinhalte.find(p => p.graduierung_id === addPruefGuertelId)?.stil_id
        || pruefungsinhalte[0]?.stil_id;
      if (stilId) {
        const refreshRes = await axios.get(`/lernmaterialien/pruefungsinhalte?stil_id=${stilId}`);
        setPruefungsinhalte(refreshRes.data.inhalte || []);
      }
      setAddPruefGuertelId(null);
      showSuccess('Prüfungsinhalt hinzugefügt.');
    } catch { setError('Fehler beim Hinzufügen.'); }
    finally { setAddPruefLoading(false); }
  };

  // ─── Kategorie bearbeiten ─────────────────────────────────────────────────────
  const openEditKat = (kat, e) => {
    e.stopPropagation();
    setEditKat(kat);
    setEditKatForm({ name: kat.name, typ: kat.typ, icon: kat.icon || '', sort_order: kat.sort_order || 0 });
  };

  const handleEditKatSubmit = async (e) => {
    e.preventDefault();
    setEditKatLoading(true);
    try {
      await axios.put(`/lernmaterialien/kategorien/${editKat.kategorie_id}`, editKatForm);
      await loadKategorien();
      setEditKat(null);
      showSuccess('Kategorie aktualisiert.');
    } catch { setError('Fehler beim Aktualisieren der Kategorie.'); }
    finally { setEditKatLoading(false); }
  };

  // ─── Import ──────────────────────────────────────────────────────────────────
  const loadImportMaterials = async () => {
    setImportLoading(true);
    setImportError('');
    try {
      const params = new URLSearchParams();
      if (importStilId) params.append('stil_id', importStilId);
      if (importKatId) params.append('kategorie_id', importKatId);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await axios.get(`/lernmaterialien${q}`);
      const d = res.data;
      const list = Array.isArray(d) ? d : Array.isArray(d?.materialien) ? d.materialien : [];
      setImportMaterials(list);
      setSelectedImport(new Set());
      if (!list.length) setImportError('Keine Materialien gefunden.');
    } catch { setImportError('Fehler beim Laden.'); }
    finally { setImportLoading(false); }
  };

  const toggleImportSelect = (id) => {
    const key = String(id);
    setSelectedImport(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleImportAll = () => {
    setSelectedImport(selectedImport.size === importMaterials.length
      ? new Set()
      : new Set(importMaterials.map(m => String(m.id))));
  };

  const handleImport = async () => {
    if (selectedImport.size === 0) return;
    setImportLoading(true);
    setImportError('');
    try {
      const res = await axios.post('/lernmaterialien/import', {
        material_ids: [...selectedImport].map(Number),
        target_kategorie_id: targetKatId ? Number(targetKatId) : null,
        target_stil_id: null
      });
      showSuccess(`${res.data.imported || selectedImport.size} Material(ien) importiert.`);
      setShowImport(false);
      setSelectedImport(new Set());
      setImportMaterials([]);
      await loadMaterialien();
      await loadKategorien();
    } catch (err) {
      const msg = err.response?.data;
      setImportError(typeof msg === 'string' ? msg : (msg?.error || 'Fehler beim Import.'));
    } finally { setImportLoading(false); }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const showUrlField = ['video', 'pdf', 'link', 'bild'].includes(form.typ);
  const stileListe = stile || [];
  const nonStilKats = kategorien.filter(k => k.typ !== 'stil');
  const katGruppen = ['guertel', 'sonstiges'].map(typ => ({
    typ, label: KAT_TYP_LABELS[typ],
    kats: nonStilKats.filter(k => k.typ === typ)
  })).filter(g => g.kats.length > 0);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <style>{`
        .lp-tiptap-content { outline: none; min-height: 200px; padding: 0.75rem; color: var(--text-primary); }
        .lp-tiptap-content h1 { font-size: 1.4rem; font-weight: 700; margin: 0.55rem 0 0.35rem; }
        .lp-tiptap-content h2 { font-size: 1.15rem; font-weight: 700; margin: 0.45rem 0 0.25rem; }
        .lp-tiptap-content h3 { font-size: 1rem; font-weight: 600; margin: 0.35rem 0 0.2rem; }
        .lp-tiptap-content ul, .lp-tiptap-content ol { padding-left: 1.5rem; margin: 0.25rem 0; }
        .lp-tiptap-content li { margin-bottom: 0.12rem; }
        .lp-tiptap-content p { margin: 0.2rem 0; }
        .lp-tiptap-content a { color: #FFD700; text-decoration: underline; }
        .lp-tiptap-content strong { font-weight: 700; }
        .lp-tiptap-content em { font-style: italic; }
        .lp-html-preview h1,.lp-html-preview h2,.lp-html-preview h3 { font-weight: 700; margin: 0.1rem 0; font-size: inherit; }
        .lp-html-preview ul,.lp-html-preview ol { padding-left: 1.2rem; margin: 0; }
        .lp-html-preview p { margin: 0.1rem 0; }
        .lp-html-preview a { color: #FFD700; }
        .lp-sb-row:hover .lp-del { opacity: 1 !important; }
        .lp-pruef-row:hover { background: rgba(255,255,255,0.028) !important; }
        .lp-pruef-del:hover  { background: rgba(239,68,68,0.22) !important; color: #f87171 !important; }
        .lp-pruef-edit:hover { background: rgba(255,215,0,0.18) !important; color: #FFD700 !important; }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <h1 style={s.h1}>Lernplattform</h1>
        <div style={s.headerBtns}>
          {pruefPdfUrl && (
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.8rem' }}
              disabled={pdfLoading}
              onClick={() => downloadPdf(pruefPdfUrl, `Pruefungsordnung_${activeFilter?.name || 'Stil'}.pdf`)}
            >
              {pdfLoading ? '⏳ PDF…' : '📄 Prüfungsordnung PDF'}
            </button>
          )}
          {activeFilter?.type === 'stil' && (
            <button
              className="btn btn-neutral btn-sm"
              style={{ fontSize: '0.8rem' }}
              onClick={() => setShowPdfConfig(true)}
              title="PDF-Layout konfigurieren"
            >
              ⚙️ PDF-Einstellungen
            </button>
          )}
          {exportPdfUrl && (
            <button
              className="btn btn-neutral btn-sm"
              style={{ fontSize: '0.8rem' }}
              disabled={pdfLoading}
              onClick={() => downloadPdf(exportPdfUrl, `Lernmaterialien_${activeFilter?.name || 'Stil'}.pdf`)}
            >
              {pdfLoading ? '⏳ PDF…' : '⬇ Stil als PDF'}
            </button>
          )}
          <button className="btn btn-neutral btn-sm"
            onClick={() => { setImportMaterials([]); setSelectedImport(new Set()); setImportStilId(''); setImportKatId(''); setTargetKatId(''); setImportError(''); setShowImport(true); }}>
            ↓ Import
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openForm()}>+ Material</button>
        </div>
      </div>

      {error && <div style={{ ...s.alert('error'), flexShrink: 0 }}>{error}</div>}
      {success && <div style={{ ...s.alert('success'), flexShrink: 0 }}>{success}</div>}

      {/* Layout */}
      <div style={s.layout}>

        {/* ─── Sidebar ─── */}
        <div style={s.sidebar}>
          <div style={s.sbItem(!activeFilter)} onClick={() => setActiveFilter(null)}>
            <span>Alle Materialien</span>
            <span style={s.sbCount}>{materialien.length}</span>
          </div>

          {/* Stile (automatisch) */}
          {stileListe.length > 0 && (
            <>
              <div style={s.sbSection}>Stile</div>
              {stileListe.map(st => {
                const isActive = activeFilter?.type === 'stil' && activeFilter.id === st.stil_id;
                return (
                  <div key={st.stil_id} style={s.sbItem(isActive)}
                    onClick={() => selectFilter({ type: 'stil', id: st.stil_id, name: st.name })}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      🥋 {st.name}
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {/* Gürtel + Sonstiges Kategorien */}
          {katGruppen.map(({ typ, label, kats }) => (
            <React.Fragment key={typ}>
              <div style={s.sbSection}>{label}</div>
              {kats.map(kat => {
                const isActive = activeFilter?.type === 'kat' && activeFilter.id === kat.kategorie_id;
                return (
                  <div key={kat.kategorie_id} className="lp-sb-row"
                    style={{ ...s.sbItem(isActive), position: 'relative' }}
                    onClick={() => selectFilter({ type: 'kat', id: kat.kategorie_id, name: kat.name })}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {kat.icon ? `${kat.icon} ` : ''}{kat.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexShrink: 0 }}>
                      <span style={s.sbCount}>{kat.anzahl || 0}</span>
                      <span className="lp-del" onClick={(e) => openEditKat(kat, e)}
                        style={{ fontSize: '0.7rem', color: '#FFD700', opacity: 0, cursor: 'pointer', padding: '0 0.1rem' }}>✎</span>
                      <span className="lp-del" onClick={(e) => handleKatDelete(kat, e)}
                        style={{ fontSize: '0.68rem', color: '#ef4444', opacity: 0, cursor: 'pointer', padding: '0 0.1rem' }}>✕</span>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          {/* Kategorie hinzufügen */}
          <button style={s.sbAddBtn} onClick={() => setShowKatForm(v => !v)}>
            {showKatForm ? '✕ Abbrechen' : '+ Kategorie hinzufügen'}
          </button>
          {showKatForm && (
            <form style={s.katForm} onSubmit={handleKatSubmit}>
              <input style={s.katInput} placeholder="Name *" value={katForm.name}
                onChange={e => setKatForm(p => ({ ...p, name: e.target.value }))} required autoFocus />
              <select style={s.katInput} value={katForm.typ}
                onChange={e => setKatForm(p => ({ ...p, typ: e.target.value }))}>
                <option value="guertel">Gürtel / Grad</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
              <input style={s.katInput} placeholder="Icon (🥊 optional)" value={katForm.icon}
                onChange={e => setKatForm(p => ({ ...p, icon: e.target.value }))} />
              <button type="submit" className="btn btn-primary btn-sm" disabled={katLoading}
                style={{ fontSize: '0.77rem' }}>{katLoading ? '...' : 'Anlegen'}</button>
            </form>
          )}
        </div>

        {/* ─── Hauptbereich ─── */}
        <div style={s.mainArea}>

          {/* Filter Chips */}
          <div style={s.filterBar}>
            {activeFilter && (
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFD700' }}>
                {activeFilter.name}
              </span>
            )}
            <button style={s.fChip(!filterTyp)} onClick={() => setFilterTyp('')}>Alle</button>
            {TYPES.map(t => (
              <button key={t} style={s.fChip(filterTyp === t)} onClick={() => setFilterTyp(filterTyp === t ? '' : t)}>
                {TYPE_ICONS[t]} {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Scrollbarer Bereich */}
          <div style={s.scrollArea}>

            {/* Lernmaterialien Grid */}
            <div style={s.grid}>
              {loading ? (
                <div style={s.emptyState}>Lade Materialien...</div>
              ) : materialien.length === 0 ? (
                <div style={s.emptyState}>
                  Keine Materialien gefunden.
                  <br />
                  <button className="btn btn-primary btn-sm" style={{ marginTop: '0.875rem' }} onClick={() => openForm()}>
                    + Material anlegen
                  </button>
                </div>
              ) : (
                materialien.map(m => (
                  <div key={m.id} style={s.card}>
                    <div style={s.cardHeader}>
                      <div style={s.cardTitle}>{m.titel}</div>
                      <span style={s.typeBadge(m.typ)}>{TYPE_ICONS[m.typ]} {TYPE_LABELS[m.typ] || m.typ}</span>
                    </div>
                    {(m.kategorie_name || m.stil_name) && (
                      <span style={s.katBadge}>{m.stil_name || m.kategorie_name}</span>
                    )}
                    {m.beschreibung && <div style={s.desc}>{m.beschreibung}</div>}
                    {m.typ === 'text' && m.inhalt && (
                      <div className="lp-html-preview" style={s.htmlPreview}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.inhalt) }} />
                    )}
                    {m.sichtbar_ab_reihenfolge > 0 && (
                      <div style={{ fontSize: '0.71rem', color: 'var(--text-secondary)' }}>
                        Ab Gürtel {m.sichtbar_ab_reihenfolge}
                      </div>
                    )}
                    <div style={s.cardFooter}>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {m.url && (
                          <a href={m.url} target="_blank" rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                            style={{ textDecoration: 'none', fontSize: '0.76rem' }}>
                            {TYPE_ICONS[m.typ]} Öffnen
                          </a>
                        )}
                        {m.typ === 'text' && m.inhalt && (
                          <a href={`/api/lernmaterialien/${m.id}/pdf`} target="_blank" rel="noopener noreferrer"
                            className="btn btn-neutral btn-sm"
                            style={{ textDecoration: 'none', fontSize: '0.76rem' }}>
                            ⬇ PDF
                          </a>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.18rem' }}>
                        <button style={{ ...s.actionBtn, color: '#FFD700' }} onClick={() => openForm(m)} title="Bearbeiten">✎</button>
                        <button style={{ ...s.actionBtn, color: '#ef4444' }} onClick={() => handleDelete(m)} title="Löschen">✕</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Prüfungsinhalte Sektion */}
            {pruefungsinhalte.length > 0 && (
              <PruefSection pruefungsinhalte={pruefungsinhalte} onDelete={handleDeletePruef} onEdit={openEditPruef} onAdd={openAddPruef} />
            )}
          </div>
        </div>
      </div>

      {/* ─── Material-Formular Modal ─── */}
      {showForm && (
        <div style={s.overlay} onClick={() => setShowForm(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editMaterial ? 'Material bearbeiten' : 'Neues Lernmaterial'}</h2>
              <button style={s.closeBtn} onClick={() => { setShowForm(false); setEditMaterial(null); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={s.formGrid}>
                <div style={{ ...s.formGroup, ...s.formRow }}>
                  <label style={s.label}>Titel *</label>
                  <input style={s.input} value={form.titel}
                    onChange={e => setForm(p => ({ ...p, titel: e.target.value }))} required placeholder="Titel" />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Typ *</label>
                  <select style={s.select} value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))}>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Kampfkunst-Stil</label>
                  <select style={s.select} value={form.stil_id} onChange={e => setForm(p => ({ ...p, stil_id: e.target.value }))}>
                    <option value="">-- Alle --</option>
                    {stileListe.map(st => <option key={st.stil_id} value={st.stil_id}>{st.name}</option>)}
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Kategorie</label>
                  <select style={s.select} value={form.kategorie_id} onChange={e => setForm(p => ({ ...p, kategorie_id: e.target.value }))}>
                    <option value="">-- Keine --</option>
                    {['guertel', 'sonstiges'].map(typ => {
                      const kats = kategorien.filter(k => k.typ === typ);
                      if (!kats.length) return null;
                      return <optgroup key={typ} label={KAT_TYP_LABELS[typ]}>
                        {kats.map(k => <option key={k.kategorie_id} value={k.kategorie_id}>{k.icon ? `${k.icon} ` : ''}{k.name}</option>)}
                      </optgroup>;
                    })}
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Sichtbar ab Reihenfolge</label>
                  <input style={s.input} type="number" value={form.sichtbar_ab_reihenfolge}
                    onChange={e => setForm(p => ({ ...p, sichtbar_ab_reihenfolge: e.target.value }))}
                    placeholder="optional" min="0" />
                </div>
                {showUrlField && (
                  <div style={{ ...s.formGroup, ...s.formRow }}>
                    <label style={s.label}>URL / Link *</label>
                    <input style={s.input} value={form.url}
                      onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                      placeholder="https://..." required={showUrlField} />
                  </div>
                )}
                <div style={{ ...s.formGroup, ...s.formRow }}>
                  <label style={s.label}>Beschreibung</label>
                  <textarea style={s.textarea} value={form.beschreibung}
                    onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
                    placeholder="Kurze Beschreibung..." />
                </div>
                {form.typ === 'text' && (
                  <div style={{ ...s.formGroup, ...s.formRow }}>
                    <label style={s.label}>Inhalt</label>
                    <TipTapToolbar editor={editor} />
                    <div style={s.editorWrap}><EditorContent editor={editor} /></div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={formLoading}>
                  {formLoading ? 'Speichern...' : (editMaterial ? 'Aktualisieren' : 'Speichern')}
                </button>
                <button type="button" className="btn btn-neutral btn-sm"
                  onClick={() => { setShowForm(false); setEditMaterial(null); }}>Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Prüfungsinhalt bearbeiten Modal ─── */}
      {editPruefItem && (
        <div style={s.overlay} onClick={() => setEditPruefItem(null)}>
          <div style={{ ...s.modal, maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Prüfungsinhalt bearbeiten</h2>
              <button style={s.closeBtn} onClick={() => setEditPruefItem(null)}>✕</button>
            </div>
            <form onSubmit={handleEditPruefSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
                <div style={s.formGroup}>
                  <label style={s.label}>Titel *</label>
                  <input style={s.input} value={editPruefForm.titel} required autoFocus
                    onChange={e => setEditPruefForm(p => ({ ...p, titel: e.target.value }))} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Kategorie</label>
                  <select style={s.select} value={editPruefForm.kategorie}
                    onChange={e => setEditPruefForm(p => ({ ...p, kategorie: e.target.value }))}>
                    {Object.entries(PRUEF_KAT_ICONS).map(([k, icon]) => (
                      <option key={k} value={k}>{icon} {PRUEF_KAT_LABELS[k] || k}</option>
                    ))}
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Beschreibung</label>
                  <textarea style={s.textarea} value={editPruefForm.beschreibung} rows={2}
                    onChange={e => setEditPruefForm(p => ({ ...p, beschreibung: e.target.value }))}
                    placeholder="Kurze Erläuterung (optional)" />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={editPruefForm.pflicht}
                    onChange={e => setEditPruefForm(p => ({ ...p, pflicht: e.target.checked }))} />
                  Pflichtinhalt (wird mit ★ markiert)
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={editPruefLoading}>
                  {editPruefLoading ? 'Speichern...' : 'Übernehmen'}
                </button>
                <button type="button" className="btn btn-neutral btn-sm" onClick={() => setEditPruefItem(null)}>Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Prüfungsinhalt hinzufügen Modal ─── */}
      {addPruefGuertelId && (
        <div style={s.overlay} onClick={() => setAddPruefGuertelId(null)}>
          <div style={{ ...s.modal, maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>+ Prüfungsinhalt — {addPruefGuertelName}</h2>
              <button style={s.closeBtn} onClick={() => setAddPruefGuertelId(null)}>✕</button>
            </div>
            <form onSubmit={handleAddPruefSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
                <div style={s.formGroup}>
                  <label style={s.label}>Titel *</label>
                  <input style={s.input} value={addPruefForm.titel} required autoFocus
                    placeholder="z.B. Frontkick vorderes Bein"
                    onChange={e => setAddPruefForm(p => ({ ...p, titel: e.target.value }))} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Kategorie</label>
                  <select style={s.select} value={addPruefForm.kategorie}
                    onChange={e => setAddPruefForm(p => ({ ...p, kategorie: e.target.value }))}>
                    {Object.entries(PRUEF_KAT_ICONS).map(([k, icon]) => (
                      <option key={k} value={k}>{icon} {PRUEF_KAT_LABELS[k] || k}</option>
                    ))}
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Beschreibung</label>
                  <textarea style={s.textarea} value={addPruefForm.beschreibung} rows={2}
                    onChange={e => setAddPruefForm(p => ({ ...p, beschreibung: e.target.value }))}
                    placeholder="Kurze Erläuterung (optional)" />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={addPruefForm.pflicht}
                    onChange={e => setAddPruefForm(p => ({ ...p, pflicht: e.target.checked }))} />
                  Pflichtinhalt (wird mit ★ markiert)
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={addPruefLoading}>
                  {addPruefLoading ? 'Speichern...' : 'Hinzufügen'}
                </button>
                <button type="button" className="btn btn-neutral btn-sm" onClick={() => setAddPruefGuertelId(null)}>Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Kategorie bearbeiten Modal ─── */}
      {editKat && (
        <div style={s.overlay} onClick={() => setEditKat(null)}>
          <div style={{ ...s.modal, maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Kategorie bearbeiten</h2>
              <button style={s.closeBtn} onClick={() => setEditKat(null)}>✕</button>
            </div>
            <form onSubmit={handleEditKatSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
                <div style={s.formGroup}>
                  <label style={s.label}>Name *</label>
                  <input style={s.input} value={editKatForm.name} required autoFocus
                    onChange={e => setEditKatForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Typ</label>
                  <select style={s.select} value={editKatForm.typ}
                    onChange={e => setEditKatForm(p => ({ ...p, typ: e.target.value }))}>
                    <option value="guertel">Gürtel / Grad</option>
                    <option value="sonstiges">Sonstiges</option>
                  </select>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Icon (Emoji, optional)</label>
                  <input style={s.input} value={editKatForm.icon} placeholder="z.B. 🥊"
                    onChange={e => setEditKatForm(p => ({ ...p, icon: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={editKatLoading}>
                  {editKatLoading ? 'Speichern...' : 'Übernehmen'}
                </button>
                <button type="button" className="btn btn-neutral btn-sm" onClick={() => setEditKat(null)}>Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── PDF-Einstellungen Modal ─── */}
      {showPdfConfig && (
        <div style={s.overlay} onClick={() => setShowPdfConfig(false)}>
          <div style={{ ...s.modal, maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>⚙️ PDF-Einstellungen — {activeFilter?.name}</h2>
              <button style={s.closeBtn} onClick={() => setShowPdfConfig(false)}>✕</button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Gilt für das Prüfungsordnung-PDF dieses Stils.
            </p>
            <form onSubmit={handleSavePdfConfig}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.1rem' }}>
                <div style={s.formGroup}>
                  <label style={s.label}>Dokumenttitel (leer = automatisch)</label>
                  <input style={s.input} value={pdfConfigForm.titel}
                    placeholder={`Prüfungsprogramm ${activeFilter?.name || ''}`}
                    onChange={e => setPdfConfigForm(p => ({ ...p, titel: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div style={s.formGroup}>
                    <label style={s.label}>Organisation</label>
                    <input style={s.input} value={pdfConfigForm.organisation}
                      placeholder="TDA Int'l"
                      onChange={e => setPdfConfigForm(p => ({ ...p, organisation: e.target.value }))} />
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>Akzentfarbe</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="color" value={pdfConfigForm.akzent_farbe}
                        onChange={e => setPdfConfigForm(p => ({ ...p, akzent_farbe: e.target.value }))}
                        style={{ width: 36, height: 32, padding: '2px', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: 'pointer', background: 'rgba(0,0,0,0.2)' }} />
                      <input style={{ ...s.input, flex: 1 }} value={pdfConfigForm.akzent_farbe}
                        placeholder="#c0392b"
                        onChange={e => setPdfConfigForm(p => ({ ...p, akzent_farbe: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Organisation Untertitel</label>
                  <input style={s.input} value={pdfConfigForm.organisation_sub}
                    placeholder="Tiger & Dragon Association – International"
                    onChange={e => setPdfConfigForm(p => ({ ...p, organisation_sub: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={s.label}>Sichtbare Abschnitte</label>
                  {[
                    { key: 'deck_zeigen', label: 'Deckblatt anzeigen' },
                    { key: 'allgemein_zeigen', label: 'Allgemeiner Teil anzeigen' },
                    { key: 'guertel_zeigen', label: 'Gürtel-Programme anzeigen' },
                  ].map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <input type="checkbox" checked={pdfConfigForm[key]}
                        onChange={e => setPdfConfigForm(p => ({ ...p, [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Fußzeile / Notiz (erscheint unten auf jeder Seite)</label>
                  <textarea style={s.textarea} value={pdfConfigForm.fusszeile} rows={2}
                    placeholder="z.B. Gültig ab 01/2025 · © TDA Int'l"
                    onChange={e => setPdfConfigForm(p => ({ ...p, fusszeile: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={pdfConfigLoading}>
                  {pdfConfigLoading ? 'Speichern...' : 'Einstellungen speichern'}
                </button>
                <button type="button" className="btn btn-neutral btn-sm" onClick={() => setShowPdfConfig(false)}>Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Import Modal ─── */}
      {showImport && (
        <div style={s.overlay} onClick={() => setShowImport(false)}>
          <div style={{ ...s.modal, maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>↓ Materialien importieren</h2>
              <button style={s.closeBtn} onClick={() => setShowImport(false)}>✕</button>
            </div>
            {importError && <div style={s.alert('error')}>{importError}</div>}
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
              Kopiert Materialien aus einem anderen Stil oder einer Kategorie.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
              <div style={s.formGroup}>
                <label style={s.label}>Quell-Stil</label>
                <select style={s.select} value={importStilId} onChange={e => setImportStilId(e.target.value)}>
                  <option value="">-- Alle Stile --</option>
                  {stileListe.map(st => <option key={st.stil_id} value={st.stil_id}>{st.name}</option>)}
                </select>
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Quell-Kategorie</label>
                <select style={s.select} value={importKatId} onChange={e => setImportKatId(e.target.value)}>
                  <option value="">-- Alle --</option>
                  {kategorien.map(k => <option key={k.kategorie_id} value={k.kategorie_id}>{k.name}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-neutral btn-sm" onClick={loadImportMaterials}
              disabled={importLoading} style={{ marginBottom: '0.75rem' }}>
              {importLoading ? 'Lade...' : 'Materialien anzeigen'}
            </button>
            {importMaterials.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{importMaterials.length} gefunden</span>
                  <button style={{ ...s.actionBtn, color: '#FFD700', fontSize: '0.77rem' }} onClick={toggleImportAll}>
                    {selectedImport.size === importMaterials.length ? 'Alle abwählen' : 'Alle auswählen'}
                  </button>
                </div>
                <div style={s.importList}>
                  {importMaterials.map(m => (
                    <label key={m.id} style={{ ...s.importRow, background: selectedImport.has(String(m.id)) ? '#FFD70011' : 'transparent' }}>
                      <input type="checkbox" checked={selectedImport.has(String(m.id))} onChange={() => toggleImportSelect(m.id)} />
                      <span style={s.typeBadge(m.typ)}>{TYPE_ICONS[m.typ]}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titel}</span>
                      {m.stil_name && <span style={s.katBadge}>{m.stil_name}</span>}
                    </label>
                  ))}
                </div>
                <div style={{ ...s.formGroup, marginTop: '0.75rem' }}>
                  <label style={s.label}>Ziel-Kategorie (optional)</label>
                  <select style={s.select} value={targetKatId} onChange={e => setTargetKatId(e.target.value)}>
                    <option value="">-- Keine Kategorie --</option>
                    {kategorien.map(k => <option key={k.kategorie_id} value={k.kategorie_id}>{k.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleImport}
                    disabled={selectedImport.size === 0 || importLoading}>
                    {importLoading ? 'Importiere...' : `${selectedImport.size} Material(ien) importieren`}
                  </button>
                  <button className="btn btn-neutral btn-sm"
                    onClick={() => { setSelectedImport(new Set()); setImportMaterials([]); }}>
                    Zurücksetzen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
