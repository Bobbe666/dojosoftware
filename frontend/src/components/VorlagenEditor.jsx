/**
 * VorlagenEditor.jsx
 * ===================
 * Modal-Editor für Dokument-Vorlagen mit TipTap WYSIWYG.
 * Features: Formatierung, Platzhalter-Toolbar, Live-Vorschau, Email + Brief-Modus.
 */

import '../styles/VorlagenEditor.css';
import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import axios from 'axios';
import {
  X, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, Link as LinkIcon, Eye, Save, Copy
} from 'lucide-react';

// ── Kategorien-Gruppen ─────────────────────────────────────────────────────────
const KATEGORIEN = [
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

// ── Platzhalter-Gruppen ────────────────────────────────────────────────────────
const PLATZHALTER = [
  { gruppe: 'Empfänger', items: [
    { key: '{{anrede}}', label: 'Anrede' },
    { key: '{{vorname}}', label: 'Vorname' },
    { key: '{{nachname}}', label: 'Nachname' },
    { key: '{{vollname}}', label: 'Vollname' },
    { key: '{{mitgliedsnummer}}', label: 'Mitgl.-Nr.' },
    { key: '{{email}}', label: 'E-Mail' },
    { key: '{{geburtstag}}', label: 'Geburtstag' },
    { key: '{{eintrittsdatum}}', label: 'Eintrittsdatum' },
  ]},
  { gruppe: 'Absender', items: [
    { key: '{{absender_name}}', label: 'Absender-Name' },
    { key: '{{absender_ort}}', label: 'Absender-Ort' },
    { key: '{{absender_telefon}}', label: 'Telefon' },
    { key: '{{absender_email}}', label: 'Abs. E-Mail' },
    { key: '{{absender_inhaber}}', label: 'Inhaber / Signatur' },
    { key: '{{bank_iban}}', label: 'IBAN' },
    { key: '{{bank_bic}}', label: 'BIC' },
  ]},
  { gruppe: 'Datum', items: [
    { key: '{{datum}}', label: 'Datum (kurz)' },
    { key: '{{datum_lang}}', label: 'Datum (lang)' },
    { key: '{{jahr}}', label: 'Jahr' },
    { key: '{{monat}}', label: 'Monat' },
  ]},
  { gruppe: 'Kontext', items: [
    { key: '{{betrag}}', label: 'Betrag' },
    { key: '{{faelligkeitsdatum}}', label: 'Fälligkeitsdatum' },
    { key: '{{kuendigungsdatum}}', label: 'Kündigungsdatum' },
    { key: '{{ruhezeitbeginn}}', label: 'Ruhezeit Beginn' },
    { key: '{{ruhezeitende}}', label: 'Ruhezeit Ende' },
    { key: '{{kurs_name}}', label: 'Kursname' },
    { key: '{{guertelstufe}}', label: 'Gürtelstufe' },
    { key: '{{lizenz_nummer}}', label: 'Lizenz-Nr.' },
    { key: '{{lizenz_ablauf}}', label: 'Lizenz-Ablauf' },
  ]},
];

// ── TipTap Toolbar ─────────────────────────────────────────────────────────────
function Toolbar({ editor, primaryColor }) {
  if (!editor) return null;

  const btn = (active, onClick, title, children) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`ve-toolbar-dyn-btn${active ? ' ve-toolbar-dyn-btn--active' : ''}`}
    >{children}</button>
  );

  return (
    <div className="ve-toolbar-container">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Fett', <Bold size={14} />)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Kursiv', <Italic size={14} />)}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Unterstrichen', <UnderlineIcon size={14} />)}
      <div className="ve-toolbar-separator" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Überschrift 1', <span className="ve-heading-label">H1</span>)}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Überschrift 2', <span className="ve-heading-label">H2</span>)}
      <div className="ve-toolbar-separator" />
      {btn(editor.isActive({ textAlign: 'left' }), () => editor.chain().focus().setTextAlign('left').run(), 'Links', <AlignLeft size={14} />)}
      {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), 'Mitte', <AlignCenter size={14} />)}
      {btn(editor.isActive({ textAlign: 'right' }), () => editor.chain().focus().setTextAlign('right').run(), 'Rechts', <AlignRight size={14} />)}
      <div className="ve-toolbar-separator" />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Aufzählung', <List size={14} />)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Nummeriert', <ListOrdered size={14} />)}
      <div className="ve-toolbar-separator" />
      {btn(editor.isActive('link'), () => {
        const url = window.prompt('URL eingeben:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else editor.chain().focus().unsetLink().run();
      }, 'Link', <LinkIcon size={14} />)}
    </div>
  );
}

// ── Platzhalter-Leiste ─────────────────────────────────────────────────────────
function PlatzhalterLeiste({ onInsert }) {
  const [offeneGruppe, setOffeneGruppe] = useState(null);

  return (
    <div className="ve-platzhalter-bar-container">
      <span className="ve-platzhalter-title">
        Platzhalter:
      </span>
      {PLATZHALTER.map(({ gruppe, items }) => (
        <div key={gruppe} className="ve-platzhalter-group">
          <button
            onClick={() => setOffeneGruppe(offeneGruppe === gruppe ? null : gruppe)}
            className={`ve-platzhalter-group-btn${offeneGruppe === gruppe ? ' ve-platzhalter-group-btn--open' : ''}`}
          >{gruppe} ▾</button>
          {offeneGruppe === gruppe && (
            <div className="ve-platzhalter-dropdown">
              {items.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { onInsert(key); setOffeneGruppe(null); }}
                  title={key}
                  className="ve-platzhalter-item-btn"
                >
                  <span>{label}</span>
                  <span className="ve-platzhalter-key">{key}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function VorlagenEditor({ vorlage = null, profile = [], onClose, onSaved }) {
  const [form, setForm] = useState({
    name: vorlage?.name || '',
    kategorie: vorlage?.kategorie || 'sonstiges',
    absender_profil_id: vorlage?.absender_profil_id || '',
    email_betreff: vorlage?.email_betreff || '',
    brief_titel: vorlage?.brief_titel || '',
    mit_pdf_anhang: vorlage?.mit_pdf_anhang || 0,
  });

  const [gleicheTexte, setGleicheTexte] = useState(
    !vorlage?.id || vorlage?.email_html === vorlage?.brief_html
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aktiveTab, setAktiveTab] = useState('email'); // 'email' | 'brief'

  const briefEditor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content: vorlage?.brief_html || '<p></p>',
  });

  const emailEditor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content: vorlage?.email_html || '<p></p>',
  });

  // aktiver Editor für Platzhalter-Einfügen
  const aktiveEditor = aktiveTab === 'brief' ? briefEditor : emailEditor;

  function insertPlatzhalter(key) {
    if (aktiveEditor) {
      aktiveEditor.chain().focus().insertContent(key).run();
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? (checked ? 1 : 0) : value }));
  }

  async function handlePreview() {
    if (!vorlage?.id) {
      alert('Zuerst speichern, dann Vorschau öffnen.');
      return;
    }
    window.open(`/api/vorlagen/${vorlage.id}/preview-html`, '_blank');
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name ist Pflichtfeld'); return; }
    setSaving(true);
    setError('');
    try {
      const emailHtml = emailEditor?.getHTML() || '';
      const briefHtml = gleicheTexte ? emailHtml : (briefEditor?.getHTML() || '');

      const data = {
        ...form,
        email_html: emailHtml,
        brief_html: briefHtml,
      };

      if (vorlage?.id) {
        await axios.put(`/vorlagen/${vorlage.id}`, data);
      } else {
        await axios.post('/vorlagen', data);
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  // Primärfarbe vom gewählten Profil
  const gewaehltesProfilel = profile.find(p => p.id === Number(form.absender_profil_id));
  const primaryColor = gewaehltesProfilel?.farbe_primaer || '#8B0000';

  const isReadOnly = vorlage?.system_vorlage === 1;

  return (
    <div className="ve-overlay">
      <div className="ve-dialog" style={{ '--pc': primaryColor, '--pc33': `${primaryColor}33`, '--pc44': `${primaryColor}44` }}>
        {/* Header */}
        <div className="ve-modal-header-bar">
          <div className="ve-modal-title">
            {isReadOnly ? '📋 System-Vorlage (nur Lesezugriff)' : vorlage?.id ? '✏️ Vorlage bearbeiten' : '➕ Neue Vorlage'}
          </div>
          <button onClick={onClose} className="ve-close-btn">
            <X size={20} />
          </button>
        </div>

        {isReadOnly && (
          <div className="ve-warn-bar">
            ⚠️ System-Vorlagen können nicht bearbeitet werden. Erstellen Sie eine Kopie mit "Duplizieren".
          </div>
        )}

        {error && (
          <div className="ve-error-bar">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="ve-modal-body">

          {/* Name + Kategorie + Profil */}
          <div className="ve-grid-3">
            <div>
              <label className="ve-label">Name <span className="u-text-error">*</span></label>
              <input name="name" value={form.name} onChange={handleChange}
                disabled={isReadOnly} placeholder="z.B. Willkommensschreiben"
                className="ve-input" />
            </div>
            <div>
              <label className="ve-label">Kategorie</label>
              <select name="kategorie" value={form.kategorie} onChange={handleChange}
                disabled={isReadOnly} className="ve-input">
                {KATEGORIEN.map(({ gruppe, items }) => (
                  <optgroup key={gruppe} label={gruppe}>
                    {items.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="ve-label">Absender-Profil</label>
              <select name="absender_profil_id" value={form.absender_profil_id} onChange={handleChange}
                disabled={isReadOnly} className="ve-input">
                <option value="">— Kein Profil —</option>
                {profile.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.typ})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Betreff-Zeilen */}
          <div className="ve-grid-2">
            <div>
              <label className="ve-label">E-Mail-Betreff</label>
              <input name="email_betreff" value={form.email_betreff} onChange={handleChange}
                disabled={isReadOnly} placeholder="Betreff der E-Mail ({{vorname}} erlaubt)"
                className="ve-input" />
            </div>
            <div>
              <label className="ve-label">Brief-Betreff / Titel</label>
              <input name="brief_titel" value={form.brief_titel} onChange={handleChange}
                disabled={isReadOnly} placeholder="Betreffzeile im PDF-Brief"
                className="ve-input" />
            </div>
          </div>

          {/* Optionen */}
          <div className="ve-checkbox-row">
            <label className={`ve-platzhalter-btn`}>
              <input type="checkbox" checked={gleicheTexte}
                disabled={isReadOnly}
                onChange={e => setGleicheTexte(e.target.checked)} />
              E-Mail-Text = Brief-Text (gleicher Inhalt)
            </label>
            <label className={`ve-platzhalter-btn`}>
              <input type="checkbox" name="mit_pdf_anhang" checked={form.mit_pdf_anhang === 1}
                disabled={isReadOnly} onChange={handleChange} />
              PDF automatisch als E-Mail-Anhang
            </label>
          </div>

          {/* Editor-Tabs */}
          <div>
            <div className="ve-tab-bar">
              {!gleicheTexte && (
                <>
                  <button onClick={() => setAktiveTab('email')} className={`ve-tab-btn${aktiveTab === 'email' ? ' ve-tab-btn--active' : ''}`}>📧 E-Mail-Text</button>
                  <button onClick={() => setAktiveTab('brief')} className={`ve-tab-btn${aktiveTab === 'brief' ? ' ve-tab-btn--active' : ''}`}>📄 Brief-Text (PDF)</button>
                </>
              )}
              {gleicheTexte && (
                <div className="ve-tab-btn ve-tab-btn--active">
                  📧📄 E-Mail &amp; Brief-Text
                </div>
              )}
            </div>

            <div className="ve-editor-border">
              <Toolbar editor={aktiveEditor} primaryColor={primaryColor} />
              <PlatzhalterLeiste onInsert={insertPlatzhalter} />
              <EditorContent
                editor={aktiveEditor}
                className="ve-editor-content"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="ve-modal-footer-bar">
          <div className="u-flex-gap-sm">
            {vorlage?.id && (
              <button onClick={handlePreview} className="ve-preview-btn">
                <Eye size={14} /> Vorschau
              </button>
            )}
          </div>
          <div className="ve-footer-actions">
            <button onClick={onClose} className="ve-cancel-btn">Schließen</button>
            {!isReadOnly && (
              <button onClick={handleSave} disabled={saving} className="ve-save-btn">
                <Save size={14} /> {saving ? 'Speichern...' : 'Speichern'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TipTap-Editor-Styling */}
      <style>{`
        .ProseMirror {
          outline: none;
          min-height: 200px;
          color: var(--text-primary, #eee);
          font-size: 0.92rem;
          line-height: 1.6;
        }
        .ProseMirror p { margin-bottom: 0.5rem; }
        .ProseMirror h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 0.5rem; }
        .ProseMirror h2 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.4rem; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin-bottom: 0.5rem; }
        .ProseMirror li { margin-bottom: 0.2rem; }
        .ProseMirror a { color: #4a9eff; text-decoration: underline; }
        .ProseMirror strong { font-weight: 700; }
        .ProseMirror em { font-style: italic; }
      `}</style>
    </div>
  );
}

