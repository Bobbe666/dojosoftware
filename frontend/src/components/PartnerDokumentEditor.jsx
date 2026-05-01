import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import axios from 'axios';
import {
  X, Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link as LinkIcon, FileText, Save,
} from 'lucide-react';
import '../styles/PartnerDokumentEditor.css';

const FARBEN = [
  { label: 'TDA Gold',    value: '#c9a227' },
  { label: 'Dunkelrot',   value: '#8B0000' },
  { label: 'Navy',        value: '#1e3a5f' },
  { label: 'Grün',        value: '#166534' },
  { label: 'Blau',        value: '#1d4ed8' },
  { label: 'Anthrazit',   value: '#1a1a2e' },
  { label: 'Schwarz',     value: '#111111' },
];

const KATEGORIEN = [
  { value: 'info',        label: 'Informationen' },
  { value: 'contract',    label: 'Verträge' },
  { value: 'application', label: 'Bewerbungsunterlagen' },
  { value: 'other',       label: 'Sonstiges' },
];

const PLATZHALTER = [
  { gruppe: 'Datum', items: [
    { key: '{{datum}}',      label: 'Datum (kurz)' },
    { key: '{{datum_lang}}', label: 'Datum (lang)' },
    { key: '{{jahr}}',       label: 'Jahr' },
  ]},
  { gruppe: 'Organisation', items: [
    { key: '{{organisation}}', label: 'TDA Organisation' },
    { key: '{{website}}',      label: 'Website' },
    { key: '{{email}}',        label: 'E-Mail' },
  ]},
  { gruppe: 'Repräsentant', items: [
    { key: '{{rep_name}}',  label: 'Rep. Name' },
    { key: '{{rep_email}}', label: 'Rep. E-Mail' },
    { key: '{{land_de}}',   label: 'Land (DE)' },
    { key: '{{land_en}}',   label: 'Land (EN)' },
  ]},
];

function Toolbar({ editor, primaryColor }) {
  if (!editor) return null;

  const btn = (active, onClick, title, children) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`pde-btn${active ? ' pde-btn--active' : ''}`}
      style={active ? { background: `${primaryColor}33`, color: primaryColor } : {}}
    >{children}</button>
  );

  return (
    <div className="pde-toolbar">
      {btn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),      'Fett',        <Bold size={14} />)}
      {btn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),    'Kursiv',      <Italic size={14} />)}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Unterstrichen', <UnderlineIcon size={14} />)}
      <div className="pde-sep" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1', <span className="pde-hl">H1</span>)}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2', <span className="pde-hl">H2</span>)}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3', <span className="pde-hl">H3</span>)}
      <div className="pde-sep" />
      {btn(editor.isActive({ textAlign: 'left' }),   () => editor.chain().focus().setTextAlign('left').run(),   'Links',  <AlignLeft size={14} />)}
      {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), 'Mitte',  <AlignCenter size={14} />)}
      {btn(editor.isActive({ textAlign: 'right' }),  () => editor.chain().focus().setTextAlign('right').run(),  'Rechts', <AlignRight size={14} />)}
      <div className="pde-sep" />
      {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  'Aufzählung', <List size={14} />)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Nummeriert', <ListOrdered size={14} />)}
      <div className="pde-sep" />
      {btn(editor.isActive('link'), () => {
        const url = window.prompt('URL:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else editor.chain().focus().unsetLink().run();
      }, 'Link', <LinkIcon size={14} />)}
    </div>
  );
}

function PlatzhalterLeiste({ onInsert }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="pde-ph-bar">
      <span className="pde-ph-title">Platzhalter:</span>
      {PLATZHALTER.map(({ gruppe, items }) => (
        <div key={gruppe} className="pde-ph-group">
          <button className={`pde-ph-group-btn${open === gruppe ? ' pde-ph-group-btn--open' : ''}`}
            onClick={() => setOpen(open === gruppe ? null : gruppe)}>
            {gruppe} ▾
          </button>
          {open === gruppe && (
            <div className="pde-ph-dropdown">
              {items.map(({ key, label }) => (
                <button key={key} className="pde-ph-item" onClick={() => { onInsert(key); setOpen(null); }}>
                  <span>{label}</span>
                  <span className="pde-ph-key">{key}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PartnerDokumentEditor({ doc = null, onSaved, onClose }) {
  const isEdit = Boolean(doc?.id);

  const [form, setForm] = useState({
    name_de:        doc?.name_de        || '',
    name_en:        doc?.name_en        || '',
    description_de: doc?.description_de || '',
    description_en: doc?.description_en || '',
    category:       doc?.category       || 'info',
    is_public:      doc?.is_public !== undefined ? Boolean(doc.is_public) : true,
    primary_color:  doc?.primary_color  || '#c9a227',
  });

  const [showA4,   setShowA4]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [genPdf,   setGenPdf]   = useState(false);
  const [error,    setError]    = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content: doc?.content_html || '<p></p>',
  });

  const insertPlatzhalter = (key) => {
    editor?.chain().focus().insertContent(key).run();
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!form.name_de || !form.name_en) { setError('Name (DE + EN) erforderlich'); return; }
    setSaving(true); setError('');
    try {
      const body = { ...form, content_html: editor?.getHTML() || '' };
      if (isEdit) {
        await axios.put(`/partner/admin/documents/${doc.id}/editor`, body);
      } else {
        await axios.post('/partner/admin/documents/editor', body);
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!isEdit) { setError('Bitte zuerst speichern, dann PDF generieren.'); return; }
    setGenPdf(true);
    try {
      const res = await axios.get(`/partner/admin/documents/${doc.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.name_de.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('PDF-Generierung fehlgeschlagen');
    } finally {
      setGenPdf(false);
    }
  };

  const pc = form.primary_color;
  const today = new Date().toLocaleDateString('de-DE');

  return (
    <div className="pde-overlay">
      <div className="pde-dialog" style={{ '--pc': pc, '--pc33': `${pc}33` }}>

        {/* Header */}
        <div className="pde-header" style={{ borderTopColor: pc }}>
          <FileText size={18} style={{ color: pc }} />
          <span className="pde-header-title">{isEdit ? 'Dokument bearbeiten' : 'Neues Dokument'}</span>
          <button className="pde-close" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="pde-error">{error}</div>}

        {/* Meta */}
        <div className="pde-meta">
          <div className="pde-row-2">
            <div>
              <label className="pde-lbl">Name (Deutsch) *</label>
              <input name="name_de" value={form.name_de} onChange={handleChange} className="pde-input" placeholder="z.B. Partnerschaftsvertrag" />
            </div>
            <div>
              <label className="pde-lbl">Name (Englisch) *</label>
              <input name="name_en" value={form.name_en} onChange={handleChange} className="pde-input" placeholder="e.g. Partnership Agreement" />
            </div>
          </div>
          <div className="pde-row-2">
            <div>
              <label className="pde-lbl">Beschreibung (DE)</label>
              <input name="description_de" value={form.description_de} onChange={handleChange} className="pde-input" placeholder="Kurze Beschreibung..." />
            </div>
            <div>
              <label className="pde-lbl">Beschreibung (EN)</label>
              <input name="description_en" value={form.description_en} onChange={handleChange} className="pde-input" placeholder="Short description..." />
            </div>
          </div>
          <div className="pde-row-3">
            <div>
              <label className="pde-lbl">Kategorie</label>
              <select name="category" value={form.category} onChange={handleChange} className="pde-input">
                {KATEGORIEN.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label className="pde-lbl">Designfarbe</label>
              <div className="pde-color-row">
                {FARBEN.map(f => (
                  <button key={f.value} title={f.label}
                    className={`pde-color-swatch${form.primary_color === f.value ? ' pde-color-swatch--active' : ''}`}
                    style={{ background: f.value }}
                    onClick={() => setForm(x => ({ ...x, primary_color: f.value }))}
                  />
                ))}
                <input type="color" value={form.primary_color}
                  onChange={e => setForm(x => ({ ...x, primary_color: e.target.value }))}
                  className="pde-color-picker" title="Eigene Farbe" />
              </div>
            </div>
            <div className="pde-opts">
              <label className="pde-lbl">Optionen</label>
              <label className="pde-check">
                <input type="checkbox" name="is_public" checked={form.is_public} onChange={handleChange} />
                Öffentlich sichtbar
              </label>
            </div>
          </div>
        </div>

        {/* Editor toolbar */}
        <div className="pde-editor-wrap">
          <div className="pde-toolbar-row">
            <Toolbar editor={editor} primaryColor={pc} />
            <button
              className={`pde-a4-btn${showA4 ? ' pde-a4-btn--active' : ''}`}
              onClick={() => setShowA4(v => !v)}
              style={showA4 ? { borderColor: pc, color: pc } : {}}
            >
              <FileText size={13} /> A4-Vorschau
            </button>
          </div>
          <PlatzhalterLeiste onInsert={insertPlatzhalter} />

          {showA4 ? (
            <div className="pde-a4-wrap">
              <div className="pde-a4-page">
                <div className="pde-a4-top-bar" style={{ background: pc }} />
                <div className="pde-a4-header">
                  <div>
                    <div className="pde-a4-org" style={{ color: pc }}>Tiger &amp; Dragon Association e.V.</div>
                    <div className="pde-a4-sub">Deutschland · www.tda-intl.com</div>
                  </div>
                  <div className="pde-a4-date">{today}</div>
                </div>
                {form.name_de && (
                  <div className="pde-a4-title" style={{ color: pc, borderBottomColor: `${pc}44` }}>{form.name_de}</div>
                )}
                <div className="pde-a4-body">
                  <EditorContent editor={editor} className="pde-a4-content" />
                </div>
                <div className="pde-a4-footer">
                  <div className="pde-a4-footer-inner">
                    <span>Tiger &amp; Dragon Association e.V. · info@tda-intl.com</span>
                    <span>Seite 1</span>
                  </div>
                  <div className="pde-a4-bot-bar" style={{ background: pc }} />
                </div>
              </div>
            </div>
          ) : (
            <EditorContent editor={editor} className="pde-editor-content" />
          )}
        </div>

        {/* Footer */}
        <div className="pde-footer">
          <button className="pde-action-btn pde-action-btn--ghost" onClick={onClose}>Abbrechen</button>
          {isEdit && (
            <button className="pde-action-btn pde-action-btn--pdf" onClick={handleGeneratePdf} disabled={genPdf}
              title="Dokument als PDF herunterladen">
              {genPdf ? 'Generiere…' : '↓ PDF'}
            </button>
          )}
          <button className="pde-action-btn pde-action-btn--primary" onClick={handleSave} disabled={saving}
            style={{ background: pc, borderColor: pc }}>
            <Save size={14} /> {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
