/**
 * TextbausteinSidebar.jsx
 * ========================
 * Seitenleiste im Vorlagen-Editor für wiederverwendbare Textbausteine.
 * Funktionen: Anlegen, Bearbeiten, Löschen, Einfügen in Brief- oder E-Mail-Editor.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import axios from 'axios';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import '../styles/TextbausteinSidebar.css';

// ── Kategorien (identisch mit VorlagenEditor.jsx) ─────────────────────────────
const KATEGORIEN_GRUPPEN = [
  { gruppe: 'Mitgliedschaft', items: [
    { value: 'begruessung', label: 'Begrüßungsschreiben' },
    { value: 'geburtstag', label: 'Geburtstagsgratulation' },
    { value: 'kuendigung_bestaetigung', label: 'Kündigung Bestätigung' },
    { value: 'ruhezeit', label: 'Ruhezeit Bestätigung' },
    { value: 'kursanmeldung', label: 'Kursanmeldung' },
    { value: 'info_brief', label: 'Allgemeiner Infobrief' },
    { value: 'rundschreiben', label: 'Rundschreiben' },
  ]},
  { gruppe: 'Finanzen', items: [
    { value: 'zahlungserinnerung', label: 'Zahlungserinnerung' },
    { value: 'mahnung', label: 'Mahnung' },
    { value: 'mahnbescheid', label: 'Mahnbescheid' },
    { value: 'ruecklastschrift_info', label: 'Rücklastschrift-Info' },
  ]},
  { gruppe: 'Prüfungen', items: [
    { value: 'pruefung_einladung', label: 'Prüfungs-Einladung' },
    { value: 'pruefung_ergebnis', label: 'Prüfungsergebnis' },
    { value: 'guertelvergabe', label: 'Gürtelvergabe' },
  ]},
  { gruppe: 'Verband & Lizenzen', items: [
    { value: 'lizenz_ausstellung', label: 'Lizenz Ausstellung' },
    { value: 'lizenz_verlaengerung', label: 'Lizenz Verlängerung' },
    { value: 'verband_info', label: 'Verband Info' },
  ]},
  { gruppe: 'Sonstiges', items: [
    { value: 'sonstiges', label: 'Sonstiges' },
  ]},
];

const ALLE_KATEGORIEN = KATEGORIEN_GRUPPEN.flatMap(g => g.items);

function KategorieLabel({ value }) {
  const kat = ALLE_KATEGORIEN.find(k => k.value === value);
  return kat ? <span className="tb-kat-badge">{kat.label}</span> : null;
}

// ── Mini-Toolbar für den Inline-Editor ────────────────────────────────────────
function TbToolbar({ editor }) {
  if (!editor) return null;
  const btn = (active, onClick, title, children) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`tb-tool-btn${active ? ' tb-tool-btn--active' : ''}`}
    >{children}</button>
  );
  return (
    <div className="tb-toolbar">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Fett', <strong>B</strong>)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Kursiv', <em>I</em>)}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Unterstrichen', <u>U</u>)}
      <span className="tb-tool-sep" />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Aufzählung', '≡')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Nummeriert', '1.')}
    </div>
  );
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function TextbausteinSidebar({ briefEditor, emailEditor, withDojo, onClose }) {
  const [bausteine, setBausteine] = useState([]);
  const [filterKategorie, setFilterKategorie] = useState('');
  const [formState, setFormState] = useState(null); // null | { mode, id?, name, kategorie }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Gemeinsamer TipTap-Editor für Neu/Bearbeiten
  const formEditor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content: '<p></p>',
  });

  const ladeBausteine = useCallback(async () => {
    try {
      const res = await axios.get(withDojo('/textbausteine'));
      setBausteine(res.data.textbausteine || []);
    } catch { /* silent */ }
  }, [withDojo]);

  useEffect(() => { ladeBausteine(); }, [ladeBausteine]);

  // Editor-Inhalt synchronisieren wenn Form sich öffnet
  useEffect(() => {
    if (!formEditor || !formState) return;
    formEditor.commands.setContent(formState.inhalt_html || '<p></p>');
  }, [formState?.mode, formState?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function openNew() {
    setFormState({ mode: 'new', name: '', kategorie: 'sonstiges', inhalt_html: '' });
    setFormError('');
  }

  function openEdit(b) {
    setFormState({ mode: 'edit', id: b.id, name: b.name, kategorie: b.kategorie || 'sonstiges', inhalt_html: b.inhalt_html || '' });
    setFormError('');
  }

  function closeForm() {
    setFormState(null);
    setFormError('');
  }

  async function handleSave() {
    if (!formState?.name?.trim()) { setFormError('Name ist Pflichtfeld'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: formState.name.trim(),
        kategorie: formState.kategorie || null,
        inhalt_html: formEditor?.getHTML() || '',
      };
      if (formState.mode === 'new') {
        await axios.post(withDojo('/textbausteine'), payload);
      } else {
        await axios.put(withDojo(`/textbausteine/${formState.id}`), payload);
      }
      await ladeBausteine();
      closeForm();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(b) {
    if (!window.confirm(`Textbaustein "${b.name}" wirklich löschen?`)) return;
    try {
      await axios.delete(withDojo(`/textbausteine/${b.id}`));
      setBausteine(prev => prev.filter(x => x.id !== b.id));
      if (formState?.id === b.id) closeForm();
    } catch (err) {
      alert(err.response?.data?.error || 'Löschen fehlgeschlagen');
    }
  }

  function insertInto(editor, html) {
    if (!editor || !html) return;
    editor.chain().focus().insertContent(html).run();
  }

  const filtered = filterKategorie
    ? bausteine.filter(b => b.kategorie === filterKategorie)
    : bausteine;

  return (
    <div className="tb-sidebar">
      {/* Header */}
      <div className="tb-sidebar-header">
        <span className="tb-sidebar-title">Textbausteine</span>
        <button className="tb-close-btn" onClick={onClose} title="Schließen"><X size={16} /></button>
      </div>

      {/* Steuerleiste: Filter + Neu-Button */}
      <div className="tb-controls">
        <select className="tb-filter-select" value={filterKategorie} onChange={e => setFilterKategorie(e.target.value)}>
          <option value="">Alle Kategorien</option>
          {KATEGORIEN_GRUPPEN.map(({ gruppe, items }) => (
            <optgroup key={gruppe} label={gruppe}>
              {items.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="tb-add-btn" onClick={openNew} title="Neuer Textbaustein">
          <Plus size={14} /> Neu
        </button>
      </div>

      {/* Inline-Formular (Anlegen / Bearbeiten) */}
      {formState && (
        <div className="tb-edit-form">
          <div className="tb-form-title">
            {formState.mode === 'new' ? '+ Neuer Textbaustein' : '✎ Textbaustein bearbeiten'}
          </div>
          <input
            className="tb-form-input"
            placeholder="Name des Textbausteins *"
            value={formState.name}
            onChange={e => setFormState(s => ({ ...s, name: e.target.value }))}
          />
          <select
            className="tb-form-input"
            value={formState.kategorie}
            onChange={e => setFormState(s => ({ ...s, kategorie: e.target.value }))}
          >
            {KATEGORIEN_GRUPPEN.map(({ gruppe, items }) => (
              <optgroup key={gruppe} label={gruppe}>
                {items.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="tb-tiptap-wrap">
            <TbToolbar editor={formEditor} />
            <EditorContent editor={formEditor} className="tb-tiptap-content" />
          </div>
          {formError && <div className="tb-form-error">{formError}</div>}
          <div className="tb-form-actions">
            <button className="tb-btn tb-btn--ghost" onClick={closeForm}>Abbrechen</button>
            <button className="tb-btn tb-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="tb-list">
        {filtered.length === 0 && (
          <div className="tb-empty">
            {filterKategorie ? 'Keine Bausteine in dieser Kategorie.' : 'Noch keine Textbausteine angelegt.'}
          </div>
        )}
        {filtered.map(b => (
          <div key={b.id} className={`tb-item${formState?.id === b.id ? ' tb-item--editing' : ''}${b.system_vorlage ? ' tb-item--system' : ''}`}>
            <div className="tb-item-top">
              <span className="tb-item-name" title={b.name}>{b.name}</span>
              {b.system_vorlage ? (
                <span className="tb-system-badge">System</span>
              ) : (
                <div className="tb-item-icon-actions">
                  <button className="tb-icon-btn" onClick={() => openEdit(b)} title="Bearbeiten">
                    <Edit2 size={13} />
                  </button>
                  <button className="tb-icon-btn tb-icon-btn--danger" onClick={() => handleDelete(b)} title="Löschen">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
            {b.kategorie && <KategorieLabel value={b.kategorie} />}
            <div className="tb-item-actions">
              <button className="tb-insert-btn" onClick={() => insertInto(briefEditor, b.inhalt_html)} title="In Brief-Editor einfügen">
                ← Brief
              </button>
              <button className="tb-insert-btn" onClick={() => insertInto(emailEditor, b.inhalt_html)} title="In E-Mail-Editor einfügen">
                ← E-Mail
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ProseMirror-Styles für den Inline-Editor */}
      <style>{`
        .tb-sidebar .ProseMirror {
          outline: none;
          min-height: 80px;
          color: var(--text-primary, #eee);
          font-size: 0.85rem;
          line-height: 1.5;
          padding: 6px 8px;
        }
        .tb-sidebar .ProseMirror p { margin-bottom: 0.3rem; }
        .tb-sidebar .ProseMirror ul, .tb-sidebar .ProseMirror ol { padding-left: 1.2rem; }
      `}</style>
    </div>
  );
}
