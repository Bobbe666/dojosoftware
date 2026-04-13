/**
 * TextbausteinSidebar.jsx
 * ========================
 * Seitenleiste im Vorlagen-Editor für wiederverwendbare Textbausteine.
 * Jede Karte ist einzeln aus-/einklappbar und direkt inline bearbeitbar.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import axios from 'axios';
import { X, Plus, Edit2, Trash2, ChevronDown, Check, FileText } from 'lucide-react';
import '../styles/TextbausteinSidebar.css';

// ── Kategorien ────────────────────────────────────────────────────────────────
const KATEGORIEN_GRUPPEN = [
  { gruppe: 'Mitgliedschaft', items: [
    { value: 'begruessung',           label: 'Begrüßungsschreiben' },
    { value: 'geburtstag',            label: 'Geburtstagsgratulation' },
    { value: 'kuendigung_bestaetigung',label: 'Kündigung Bestätigung' },
    { value: 'ruhezeit',              label: 'Ruhezeit Bestätigung' },
    { value: 'kursanmeldung',         label: 'Kursanmeldung' },
    { value: 'info_brief',            label: 'Allgemeiner Infobrief' },
    { value: 'rundschreiben',         label: 'Rundschreiben' },
  ]},
  { gruppe: 'Finanzen', items: [
    { value: 'zahlungserinnerung', label: 'Zahlungserinnerung' },
    { value: 'mahnung',            label: 'Mahnung' },
    { value: 'mahnbescheid',       label: 'Mahnbescheid' },
    { value: 'ruecklastschrift_info', label: 'Rücklastschrift-Info' },
  ]},
  { gruppe: 'Prüfungen', items: [
    { value: 'pruefung_einladung', label: 'Prüfungs-Einladung' },
    { value: 'pruefung_ergebnis',  label: 'Prüfungsergebnis' },
    { value: 'guertelvergabe',     label: 'Gürtelvergabe' },
  ]},
  { gruppe: 'Verband & Lizenzen', items: [
    { value: 'lizenz_ausstellung',    label: 'Lizenz Ausstellung' },
    { value: 'lizenz_verlaengerung',  label: 'Lizenz Verlängerung' },
    { value: 'verband_info',          label: 'Verband Info' },
  ]},
  { gruppe: 'Sonstiges', items: [
    { value: 'sonstiges', label: 'Sonstiges' },
  ]},
];

const ALLE_KATEGORIEN = KATEGORIEN_GRUPPEN.flatMap(g => g.items);

function katLabel(value) {
  return ALLE_KATEGORIEN.find(k => k.value === value)?.label || value;
}

// ── Mini-Toolbar für Inline-Editor ───────────────────────────────────────────
function TbToolbar({ editor }) {
  if (!editor) return null;
  const btn = (active, onClick, title, children) => (
    <button type="button" onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title} className={`tb-tool-btn${active ? ' tb-tool-btn--active' : ''}`}>
      {children}
    </button>
  );
  return (
    <div className="tb-toolbar">
      {btn(editor.isActive('bold'),        () => editor.chain().focus().toggleBold().run(),        'Fett',        <strong>B</strong>)}
      {btn(editor.isActive('italic'),      () => editor.chain().focus().toggleItalic().run(),      'Kursiv',      <em>I</em>)}
      {btn(editor.isActive('underline'),   () => editor.chain().focus().toggleUnderline().run(),   'Unterstrichen', <u>U</u>)}
      <span className="tb-tool-sep" />
      {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  'Aufzählung',  '≡')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Nummeriert',  '1.')}
    </div>
  );
}

// ── Inline-Bearbeitungs-Karte ─────────────────────────────────────────────────
function BausteinEditForm({ bauststein, withDojo, onSaved, onCancel }) {
  const [name, setName] = useState(bauststein.name || '');
  const [kategorie, setKategorie] = useState(bauststein.kategorie || 'sonstiges');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content: bauststein.inhalt_html || '<p></p>',
  });

  // System-Bausteine können nicht per PUT überschrieben werden → als neue Kopie speichern
  const isSystemKopie = !!bauststein.system_vorlage;

  async function handleSave() {
    if (!name.trim()) { setError('Name ist Pflichtfeld'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { name: name.trim(), kategorie, inhalt_html: editor?.getHTML() || '' };
      if (bauststein.id && !isSystemKopie) {
        await axios.put(withDojo(`/textbausteine/${bauststein.id}`), payload);
      } else {
        await axios.post(withDojo('/textbausteine'), payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tb-inline-form">
      {isSystemKopie && (
        <div className="tb-system-hint">
          System-Vorlage — wird als eigene Kopie gespeichert
        </div>
      )}
      <input
        className="tb-form-input"
        placeholder="Name *"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
      />
      <select className="tb-form-input" value={kategorie} onChange={e => setKategorie(e.target.value)}>
        {KATEGORIEN_GRUPPEN.map(({ gruppe, items }) => (
          <optgroup key={gruppe} label={gruppe}>
            {items.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="tb-tiptap-wrap">
        <TbToolbar editor={editor} />
        <EditorContent editor={editor} className="tb-tiptap-content" />
      </div>
      {error && <div className="tb-form-error">{error}</div>}
      <div className="tb-form-actions">
        <button className="tb-btn tb-btn--ghost" onClick={onCancel}>Abbrechen</button>
        <button className="tb-btn tb-btn--primary" onClick={handleSave} disabled={saving}>
          <Check size={13} /> {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}

// ── Einzelne Karte ────────────────────────────────────────────────────────────
function BausteinKarte({ b, briefEditor, emailEditor, withDojo, onChanged }) {
  const [offen, setOffen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(false);

  function insertInto(editor, html) {
    if (!editor || !html) return;
    editor.chain().focus().insertContent(html).run();
  }

  async function handleDelete() {
    if (!window.confirm(`"${b.name}" wirklich löschen?`)) return;
    try {
      await axios.delete(withDojo(`/textbausteine/${b.id}`));
      onChanged();
    } catch (err) {
      alert(err.response?.data?.error || 'Löschen fehlgeschlagen');
    }
  }

  if (bearbeiten) {
    return (
      <div className="tb-item tb-item--editing">
        <BausteinEditForm
          bauststein={b}
          withDojo={withDojo}
          onSaved={() => { setBearbeiten(false); onChanged(); }}
          onCancel={() => setBearbeiten(false)}
        />
      </div>
    );
  }

  return (
    <div className={`tb-item${b.system_vorlage ? ' tb-item--system' : ''}`}>
      {/* Kopfzeile: Name + Toggle + Aktionen */}
      <div className="tb-item-header" onClick={() => setOffen(o => !o)}>
        <ChevronDown
          size={15}
          className={`tb-chevron${offen ? ' tb-chevron--open' : ''}`}
        />
        <span className="tb-item-name">{b.name}</span>
        <div className="tb-item-badges" onClick={e => e.stopPropagation()}>
          {b.system_vorlage ? (
            <>
              <span className="tb-system-badge">System</span>
              <button className="tb-icon-btn" onClick={() => setBearbeiten(true)} title="Als Kopie bearbeiten">
                <Edit2 size={13} />
              </button>
            </>
          ) : (
            <>
              <button className="tb-icon-btn" onClick={() => setBearbeiten(true)} title="Bearbeiten">
                <Edit2 size={13} />
              </button>
              <button className="tb-icon-btn tb-icon-btn--danger" onClick={handleDelete} title="Löschen">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Kategorie-Badge immer sichtbar */}
      {b.kategorie && (
        <div className="tb-item-kat" onClick={() => setOffen(o => !o)}>
          <span className="tb-kat-badge">{katLabel(b.kategorie)}</span>
        </div>
      )}

      {/* Aufgeklappt: Inhalt-Vorschau + Einfügen-Buttons */}
      {offen && (
        <div className="tb-item-expanded">
          {b.inhalt_html ? (
            <div
              className="tb-inhalt-preview"
              dangerouslySetInnerHTML={{ __html: b.inhalt_html }}
            />
          ) : (
            <div className="tb-inhalt-leer">Kein Inhalt hinterlegt</div>
          )}
          <div className="tb-item-actions">
            <button
              className="tb-insert-btn"
              onClick={() => insertInto(briefEditor, b.inhalt_html)}
              title="In Brief-Editor einfügen"
            >
              ← Brief
            </button>
            <button
              className="tb-insert-btn"
              onClick={() => insertInto(emailEditor, b.inhalt_html)}
              title="In E-Mail-Editor einfügen"
            >
              ← E-Mail
            </button>
          </div>
        </div>
      )}

      {/* Eingeklappt: nur Einfügen-Buttons (schneller Zugriff ohne aufzuklappen) */}
      {!offen && (
        <div className="tb-item-actions tb-item-actions--compact">
          <button
            className="tb-insert-btn"
            onClick={() => insertInto(briefEditor, b.inhalt_html)}
            title="In Brief einfügen"
          >
            ← Brief
          </button>
          <button
            className="tb-insert-btn"
            onClick={() => insertInto(emailEditor, b.inhalt_html)}
            title="In E-Mail einfügen"
          >
            ← E-Mail
          </button>
        </div>
      )}
    </div>
  );
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function TextbausteinSidebar({ briefEditor, emailEditor, withDojo, onClose }) {
  const [bausteine, setBausteine] = useState([]);
  const [filterKategorie, setFilterKategorie] = useState('');
  const [neuerBaustein, setNeuerBaustein] = useState(false);

  const ladeBausteine = useCallback(async () => {
    try {
      const res = await axios.get(withDojo('/textbausteine'));
      setBausteine(res.data.textbausteine || []);
    } catch { /* silent */ }
  }, [withDojo]);

  useEffect(() => { ladeBausteine(); }, [ladeBausteine]);

  const filtered = filterKategorie
    ? bausteine.filter(b => b.kategorie === filterKategorie)
    : bausteine;

  return (
    <div className="tb-sidebar">
      {/* Header */}
      <div className="tb-sidebar-header">
        <span className="tb-sidebar-title">
          <FileText size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Textbausteine
        </span>
        <button className="tb-close-btn" onClick={onClose} title="Schließen">
          <X size={16} />
        </button>
      </div>

      {/* Steuerleiste */}
      <div className="tb-controls">
        <select
          className="tb-filter-select"
          value={filterKategorie}
          onChange={e => setFilterKategorie(e.target.value)}
        >
          <option value="">Alle Kategorien</option>
          {KATEGORIEN_GRUPPEN.map(({ gruppe, items }) => (
            <optgroup key={gruppe} label={gruppe}>
              {items.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          className="tb-add-btn"
          onClick={() => setNeuerBaustein(true)}
          title="Neuer Textbaustein"
          disabled={neuerBaustein}
        >
          <Plus size={14} /> Neu
        </button>
      </div>

      {/* Neuer Baustein Form (oben, eingeklappt nach Speichern) */}
      {neuerBaustein && (
        <div className="tb-item tb-item--new">
          <BausteinEditForm
            bauststein={{ name: '', kategorie: 'sonstiges', inhalt_html: '' }}
            withDojo={withDojo}
            onSaved={() => { setNeuerBaustein(false); ladeBausteine(); }}
            onCancel={() => setNeuerBaustein(false)}
          />
        </div>
      )}

      {/* Karten-Liste */}
      <div className="tb-list">
        {filtered.length === 0 && (
          <div className="tb-empty">
            {filterKategorie
              ? 'Keine Bausteine in dieser Kategorie.'
              : 'Noch keine Textbausteine angelegt.\nKlicke "+ Neu" um einen zu erstellen.'}
          </div>
        )}
        {filtered.map(b => (
          <BausteinKarte
            key={b.id}
            b={b}
            briefEditor={briefEditor}
            emailEditor={emailEditor}
            withDojo={withDojo}
            onChanged={ladeBausteine}
          />
        ))}
      </div>

      <style>{`
        .tb-sidebar .ProseMirror {
          outline: none;
          min-height: 90px;
          color: var(--text-primary, #eee);
          font-size: 0.88rem;
          line-height: 1.55;
          padding: 8px 10px;
        }
        .tb-sidebar .ProseMirror p { margin: 0 0 0.35rem; }
        .tb-sidebar .ProseMirror ul,
        .tb-sidebar .ProseMirror ol { padding-left: 1.4rem; }
        .tb-inhalt-preview p { margin: 0 0 0.3rem; font-size: 0.83rem; line-height: 1.5; color: var(--text-secondary, #ccc); }
        .tb-inhalt-preview ul, .tb-inhalt-preview ol { padding-left: 1.2rem; font-size: 0.83rem; color: var(--text-secondary, #ccc); }
      `}</style>
    </div>
  );
}
