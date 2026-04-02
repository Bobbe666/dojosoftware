/**
 * TemplateEditorTipTap.jsx
 * =========================
 * TipTap-basierter Vertrag-Editor — Ersatz für GrapeJS TemplateEditor.
 * Gleiche Props-Schnittstelle: templateId, dojoId, onSave, onClose.
 * Speichert in tiptap_html + editor_version = 'tiptap'.
 */

import '../styles/TemplateEditorTipTap.css';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import axios from 'axios';
import {
  X, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, Link as LinkIcon, Save, Eye, FileText,
  Table as TableIcon, ArrowLeft
} from 'lucide-react';

// ── Vertrags-Platzhalter ───────────────────────────────────────────────────────
const PLATZHALTER = [
  { gruppe: 'Mitglied', items: [
    { key: '{{mitglied.anrede}}',          label: 'Anrede' },
    { key: '{{mitglied.vorname}}',         label: 'Vorname' },
    { key: '{{mitglied.nachname}}',        label: 'Nachname' },
    { key: '{{mitglied.mitgliedsnummer}}', label: 'Mitgl.-Nr.' },
    { key: '{{mitglied.geburtsdatum}}',    label: 'Geburtsdatum' },
    { key: '{{mitglied.email}}',           label: 'E-Mail' },
    { key: '{{mitglied.telefon}}',         label: 'Telefon' },
    { key: '{{mitglied.strasse}}',         label: 'Straße' },
    { key: '{{mitglied.hausnummer}}',      label: 'Hausnummer' },
    { key: '{{mitglied.plz}}',             label: 'PLZ' },
    { key: '{{mitglied.ort}}',             label: 'Ort' },
  ]},
  { gruppe: 'Vertrag', items: [
    { key: '{{vertrag.vertragsnummer}}',        label: 'Vertrags-Nr.' },
    { key: '{{vertrag.vertragsbeginn}}',        label: 'Beginn' },
    { key: '{{vertrag.vertragsende}}',          label: 'Ende' },
    { key: '{{vertrag.tarifname}}',             label: 'Tarif' },
    { key: '{{vertrag.monatsbeitrag}}',         label: 'Monatsbeitrag' },
    { key: '{{vertrag.mindestlaufzeit_monate}}',label: 'Mindestlaufzeit' },
    { key: '{{vertrag.kuendigungsfrist_monate}}',label: 'Kündigungsfrist' },
  ]},
  { gruppe: 'Dojo', items: [
    { key: '{{dojo.dojoname}}',    label: 'Dojo-Name' },
    { key: '{{dojo.strasse}}',     label: 'Straße' },
    { key: '{{dojo.plz}}',         label: 'PLZ' },
    { key: '{{dojo.ort}}',         label: 'Ort' },
    { key: '{{dojo.telefon}}',     label: 'Telefon' },
    { key: '{{dojo.email}}',       label: 'E-Mail' },
    { key: '{{dojo.internet}}',    label: 'Website' },
  ]},
  { gruppe: 'Datum', items: [
    { key: '{{system.datum}}',      label: 'Datum (kurz)' },
    { key: '{{system.datum_lang}}', label: 'Datum (lang)' },
    { key: '{{system.jahr}}',       label: 'Jahr' },
    { key: '{{system.monat}}',      label: 'Monat' },
  ]},
];

const TEMPLATE_TYPEN = [
  { value: 'vertrag',     label: 'Mitgliedsvertrag' },
  { value: 'sepa',        label: 'SEPA-Lastschrift' },
  { value: 'agb',         label: 'AGB' },
  { value: 'datenschutz', label: 'Datenschutz' },
  { value: 'custom',      label: 'Eigenes Dokument' },
];

// ── Standard-Inhalt für neue Vorlagen ─────────────────────────────────────────
const DEFAULT_CONTENT = `<h1>Mitgliedsvertrag</h1>
<p>Zwischen</p>
<p><strong>{{dojo.dojoname}}</strong><br>
{{dojo.strasse}}, {{dojo.plz}} {{dojo.ort}}<br>
Tel.: {{dojo.telefon}} | E-Mail: {{dojo.email}}</p>
<p>– nachfolgend „Verein" genannt –</p>
<p>und</p>
<p><strong>{{mitglied.vorname}} {{mitglied.nachname}}</strong><br>
{{mitglied.strasse}} {{mitglied.hausnummer}}, {{mitglied.plz}} {{mitglied.ort}}<br>
Geburtsdatum: {{mitglied.geburtsdatum}}</p>
<p>– nachfolgend „Mitglied" genannt –</p>
<h2>§ 1 Vertragsgegenstand</h2>
<p>Das Mitglied erhält ab dem <strong>{{vertrag.vertragsbeginn}}</strong> Zugang zu den Trainingsangeboten des Vereins gemäß dem gewählten Tarif <strong>{{vertrag.tarifname}}</strong>.</p>
<h2>§ 2 Beitrag und Zahlungsweise</h2>
<p>Der monatliche Mitgliedsbeitrag beträgt <strong>{{vertrag.monatsbeitrag}} €</strong> und wird monatlich im Lastschriftverfahren eingezogen.</p>
<h2>§ 3 Laufzeit und Kündigung</h2>
<p>Die Mindestlaufzeit beträgt <strong>{{vertrag.mindestlaufzeit_monate}} Monate</strong>. Die Kündigung ist mit einer Frist von <strong>{{vertrag.kuendigungsfrist_monate}} Monaten</strong> zum Vertragsende möglich.</p>
<p>Vertrags-Nr.: {{vertrag.vertragsnummer}}</p>`;

// ── Toolbar ────────────────────────────────────────────────────────────────────
function Toolbar({ editor }) {
  if (!editor) return null;

  const btn = (active, onClick, title, children) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`tet-toolbar-btn${active ? ' tet-toolbar-btn--active' : ''}`}
    >{children}</button>
  );

  return (
    <div className="tet-toolbar">
      {btn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),      'Fett',        <Bold size={14} />)}
      {btn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),    'Kursiv',      <Italic size={14} />)}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Unterstrichen', <UnderlineIcon size={14} />)}
      <div className="tet-separator" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1', <span className="tet-heading-label">H1</span>)}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2', <span className="tet-heading-label">H2</span>)}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3', <span className="tet-heading-label">H3</span>)}
      <div className="tet-separator" />
      {btn(editor.isActive({ textAlign: 'left' }),   () => editor.chain().focus().setTextAlign('left').run(),   'Links',  <AlignLeft size={14} />)}
      {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), 'Mitte',  <AlignCenter size={14} />)}
      {btn(editor.isActive({ textAlign: 'right' }),  () => editor.chain().focus().setTextAlign('right').run(),  'Rechts', <AlignRight size={14} />)}
      <div className="tet-separator" />
      {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  'Aufzählung', <List size={14} />)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Nummeriert', <ListOrdered size={14} />)}
      <div className="tet-separator" />
      {btn(editor.isActive('link'), () => {
        const url = window.prompt('URL eingeben:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else editor.chain().focus().unsetLink().run();
      }, 'Link', <LinkIcon size={14} />)}
      <button
        onMouseDown={e => {
          e.preventDefault();
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        }}
        title="Tabelle einfügen"
        className="tet-toolbar-btn"
      ><TableIcon size={14} /></button>
    </div>
  );
}

// ── Platzhalter-Leiste ─────────────────────────────────────────────────────────
function PlatzhalterLeiste({ onInsert }) {
  const [offeneGruppe, setOffeneGruppe] = useState(null);

  return (
    <div className="tet-platzhalter-bar">
      <span className="tet-platzhalter-title">Platzhalter:</span>
      {PLATZHALTER.map(({ gruppe, items }) => (
        <div key={gruppe} className="tet-platzhalter-group">
          <button
            onClick={() => setOffeneGruppe(offeneGruppe === gruppe ? null : gruppe)}
            className={`tet-platzhalter-btn${offeneGruppe === gruppe ? ' tet-platzhalter-btn--open' : ''}`}
          >{gruppe} ▾</button>
          {offeneGruppe === gruppe && (
            <div className="tet-platzhalter-dropdown">
              {items.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { onInsert(key); setOffeneGruppe(null); }}
                  title={key}
                  className="tet-platzhalter-item"
                >
                  <span>{label}</span>
                  <span className="tet-platzhalter-key">{key}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── A4-Vorschau ────────────────────────────────────────────────────────────────
function A4Preview({ editor, templateName, dojoName }) {
  return (
    <div className="tet-a4-container">
      <div className="tet-a4-page">
        <div className="tet-a4-doc-header">
          <div className="tet-a4-doc-title">{templateName || 'Vertragsvorlage'}</div>
          <div className="tet-a4-doc-meta">
            <span>{dojoName || '— Dojo —'}</span>
            <span>Datum: {new Date().toLocaleDateString('de-DE')}</span>
          </div>
        </div>
        <div className="tet-a4-body">
          <EditorContent editor={editor} className="tet-editor-content-a4" />
        </div>
        <div className="tet-a4-signature">
          <div className="tet-a4-sig-col">
            <div className="tet-a4-sig-line"></div>
            <div className="tet-a4-sig-label">Ort, Datum</div>
          </div>
          <div className="tet-a4-sig-col">
            <div className="tet-a4-sig-line"></div>
            <div className="tet-a4-sig-label">Unterschrift Mitglied</div>
          </div>
          <div className="tet-a4-sig-col">
            <div className="tet-a4-sig-line"></div>
            <div className="tet-a4-sig-label">Unterschrift {dojoName || 'Dojo'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function TemplateEditorTipTap({ templateId, dojoId, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '',
    beschreibung: '',
    template_type: 'vertrag',
    is_default: false,
    aktiv: true,
  });
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showA4, setShowA4] = useState(false);
  const [dojoInfo, setDojoInfo] = useState(null);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: DEFAULT_CONTENT,
  });

  // Vorhandene Vorlage laden
  useEffect(() => {
    if (!templateId || !editor) return;
    setLoading(true);
    axios.get(`/vertragsvorlagen/${templateId}`)
      .then(res => {
        const d = res.data.data;
        setForm({
          name: d.name || '',
          beschreibung: d.beschreibung || '',
          template_type: d.template_type || 'vertrag',
          is_default: !!d.is_default,
          aktiv: d.aktiv !== 0,
        });
        // tiptap_html bevorzugen, sonst leerer Start
        const html = d.tiptap_html || DEFAULT_CONTENT;
        editor.commands.setContent(html);
      })
      .catch(() => setError('Vorlage konnte nicht geladen werden'))
      .finally(() => setLoading(false));
  }, [templateId, editor]);

  // Dojo-Info für A4-Vorschau laden
  useEffect(() => {
    if (!dojoId) return;
    axios.get(`/dojo/${dojoId}`)
      .then(res => setDojoInfo(res.data.data || res.data))
      .catch(() => {});
  }, [dojoId]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  function insertPlatzhalter(key) {
    editor?.chain().focus().insertContent(key).run();
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name ist Pflichtfeld'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        tiptap_html: editor?.getHTML() || '',
        editor_version: 'tiptap',
        dojo_id: dojoId,
        // GrapeJS-Felder leer lassen damit bestehende Struktur erhalten bleibt
        grapesjs_html: '',
        grapesjs_css: '',
      };

      if (templateId) {
        await axios.put(`/vertragsvorlagen/${templateId}`, payload);
      } else {
        await axios.post('/vertragsvorlagen', payload);
      }
      onSave && onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!templateId) {
      alert('Zuerst speichern, dann Vorschau öffnen.');
      return;
    }
    setPreviewLoading(true);
    setPreviewHtml(null);
    try {
      const res = await axios.get(`/vertragsvorlagen/${templateId}/preview`, { responseType: 'text' });
      setPreviewHtml(res.data);
    } catch (err) {
      setError('Vorschau konnte nicht geladen werden');
    } finally {
      setPreviewLoading(false);
    }
  }

  const dojoName = dojoInfo?.dojoname || dojoInfo?.name || '';

  if (loading) {
    return (
      <div className="tet-loading">
        <div className="loading-spinner"></div>
        <span>Vorlage wird geladen...</span>
      </div>
    );
  }

  return (
    <div className="tet-wrapper">
      {/* Header */}
      <div className="tet-header">
        <button onClick={onClose} className="tet-back-btn">
          <ArrowLeft size={16} /> Zurück
        </button>
        <div className="tet-header-title">
          {templateId ? '✏️ Vorlage bearbeiten' : '➕ Neue Vorlage'} — TipTap Editor
        </div>
        <div className="tet-header-actions">
          {templateId && (
            <button onClick={handlePreview} disabled={previewLoading} className="tet-preview-btn">
              <Eye size={14} /> {previewLoading ? 'Lädt…' : 'Vorschau'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="tet-save-btn">
            <Save size={14} /> {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {error && <div className="tet-error-bar">{error}</div>}

      {/* Meta-Felder */}
      <div className="tet-meta-grid">
        <div>
          <label className="tet-label">Name *</label>
          <input
            name="name" value={form.name} onChange={handleChange}
            className="tet-input" placeholder="z.B. Mitgliedsvertrag Standard"
          />
        </div>
        <div>
          <label className="tet-label">Typ</label>
          <select name="template_type" value={form.template_type} onChange={handleChange} className="tet-input">
            {TEMPLATE_TYPEN.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="tet-label">Beschreibung</label>
          <input
            name="beschreibung" value={form.beschreibung} onChange={handleChange}
            className="tet-input" placeholder="Kurze Beschreibung (optional)"
          />
        </div>
        <div className="tet-meta-checkboxes">
          <label className="tet-checkbox-label">
            <input type="checkbox" name="is_default" checked={form.is_default} onChange={handleChange} />
            Standard-Vorlage
          </label>
          <label className="tet-checkbox-label">
            <input type="checkbox" name="aktiv" checked={form.aktiv} onChange={handleChange} />
            Aktiv
          </label>
        </div>
      </div>

      {/* Editor-Bereich */}
      <div className="tet-editor-area">
        {/* Tab-Zeile mit A4-Toggle */}
        <div className="tet-editor-topbar">
          <span className="tet-editor-tab-active">📄 Vertragsinhalt</span>
          <button
            onClick={() => setShowA4(v => !v)}
            className={`tet-a4-toggle${showA4 ? ' tet-a4-toggle--active' : ''}`}
            title="A4-Vertragsvorschau"
          >
            <FileText size={13} /> A4-Vorschau
          </button>
        </div>

        <div className="tet-editor-border">
          <Toolbar editor={editor} />
          <PlatzhalterLeiste onInsert={insertPlatzhalter} />

          {showA4 ? (
            <A4Preview editor={editor} templateName={form.name} dojoName={dojoName} />
          ) : (
            <EditorContent editor={editor} className="tet-editor-content" />
          )}
        </div>
      </div>

      {/* TipTap-Basis-Styles */}
      <style>{`
        .tet-editor-content .ProseMirror,
        .tet-editor-content-a4 .ProseMirror {
          outline: none;
        }
        .tet-editor-content .ProseMirror {
          min-height: 350px;
          color: var(--text-primary, #eee);
          font-size: 0.92rem;
          line-height: 1.65;
          padding: 0.75rem 1rem;
        }
        .tet-editor-content .ProseMirror p  { margin-bottom: 0.5rem; }
        .tet-editor-content .ProseMirror h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 0.5rem; }
        .tet-editor-content .ProseMirror h2 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.4rem; }
        .tet-editor-content .ProseMirror h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.35rem; }
        .tet-editor-content .ProseMirror ul,
        .tet-editor-content .ProseMirror ol { padding-left: 1.5rem; margin-bottom: 0.5rem; }
        .tet-editor-content .ProseMirror li { margin-bottom: 0.2rem; }
        .tet-editor-content .ProseMirror a  { color: #4a9eff; text-decoration: underline; }
        .tet-editor-content .ProseMirror table {
          border-collapse: collapse; width: 100%; margin-bottom: 0.5rem;
        }
        .tet-editor-content .ProseMirror td,
        .tet-editor-content .ProseMirror th {
          border: 1px solid #444; padding: 4px 8px; min-width: 60px;
        }
        .tet-editor-content .ProseMirror th { background: #1a1a2a; font-weight: 700; }
        /* A4-Modus */
        .tet-editor-content-a4 .ProseMirror {
          min-height: 300px;
          color: #1a1a1a !important;
          background: transparent;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.6;
        }
        .tet-editor-content-a4 .ProseMirror p  { color: #1a1a1a; margin-bottom: 5pt; }
        .tet-editor-content-a4 .ProseMirror h1 { color: #1a1a1a; font-size: 13pt; margin-bottom: 5pt; }
        .tet-editor-content-a4 .ProseMirror h2 { color: #1a1a1a; font-size: 11pt; margin-bottom: 4pt; }
        .tet-editor-content-a4 .ProseMirror h3 { color: #1a1a1a; font-size: 10pt; margin-bottom: 3pt; }
        .tet-editor-content-a4 .ProseMirror strong { color: #1a1a1a; }
        .tet-editor-content-a4 .ProseMirror ul,
        .tet-editor-content-a4 .ProseMirror ol { padding-left: 14pt; margin-bottom: 5pt; }
        .tet-editor-content-a4 .ProseMirror li { color: #1a1a1a; }
        .tet-editor-content-a4 .ProseMirror table {
          border-collapse: collapse; width: 100%; margin-bottom: 6pt;
        }
        .tet-editor-content-a4 .ProseMirror td,
        .tet-editor-content-a4 .ProseMirror th {
          border: 0.5pt solid #999; padding: 3pt 5pt; color: #1a1a1a;
        }
        .tet-editor-content-a4 .ProseMirror th {
          background: #f0f0f0; font-weight: 700;
        }
      `}</style>

      {/* Vorschau-Modal via Portal — direkt in document.body, kein z-index-Konflikt */}
      {(previewLoading || previewHtml) && ReactDOM.createPortal(
        <div className="tet-preview-overlay" onClick={() => setPreviewHtml(null)}>
          <div className="tet-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="tet-preview-modal-bar">
              <span>Vorschau</span>
              <button onClick={() => setPreviewHtml(null)} className="tet-preview-modal-close">✕ Schließen</button>
            </div>
            {previewLoading
              ? <div className="tet-preview-modal-loading">Vorschau wird geladen…</div>
              : <iframe srcDoc={previewHtml} title="Vorschau" className="tet-preview-modal-iframe" sandbox="allow-scripts" />
            }
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
