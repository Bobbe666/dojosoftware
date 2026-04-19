import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import axios from 'axios';
import {
  Bold, Italic, Underline, Strikethrough,
  Heading2, Heading3, Heading4, Pilcrow,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link2, Minus, Code, Undo2, Redo2, RemoveFormatting,
} from 'lucide-react';
import { FaInstagram, FaFacebook, FaWhatsapp, FaTelegram } from 'react-icons/fa';
import { FaTiktok, FaXTwitter } from 'react-icons/fa6';
import '../styles/News.css';

// ─── Toolbar-Helfer (außerhalb damit React nicht bei jedem Render remountet) ───
const RteBtn = ({ onClick, title, children }) => (
  <button type="button" className="rte-btn" onClick={onClick} title={title}>
    {children}
  </button>
);
const RteSep = () => <span className="rte-separator" />;

// ============================================================
// WYSIWYG Rich Text Editor
// ============================================================
function RichTextEditor({ value, onChange, placeholder = 'Der vollständige News-Artikel...', forceValue }) {
  const editorRef = useRef(null);
  const initialized = useRef(false);

  // Nur beim ersten Laden den Wert setzen (danach steuert der User)
  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value || '';
      initialized.current = true;
    }
  }, [value]);

  // forceValue: Vorlage wurde angewendet → Inhalt überschreiben
  useEffect(() => {
    if (forceValue !== undefined && editorRef.current) {
      editorRef.current.innerHTML = forceValue || '';
      onChange(forceValue || '');
    }
  }, [forceValue]); // eslint-disable-line

  const exec = (cmd, arg = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(editorRef.current?.innerHTML || '');
  };

  const handleInput = () => {
    onChange(editorRef.current?.innerHTML || '');
  };

  const insertLink = () => {
    const sel = window.getSelection();
    const selectedText = sel && sel.toString();
    const url = prompt('URL eingeben (z.B. https://tda-intl.org):');
    if (url) exec('createLink', url);
  };

  const insertCode = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      exec('insertHTML', `<code>${sel.toString()}</code>`);
    } else {
      exec('insertHTML', '<code>Code</code>');
    }
  };

  const SZ = 15;

  return (
    <div className="rte-wrapper">
      <div className="rte-toolbar">
        {/* Formatierung */}
        <RteBtn onClick={() => exec('bold')}          title="Fett (Strg+B)">        <Bold          size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('italic')}        title="Kursiv (Strg+I)">      <Italic        size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('underline')}     title="Unterstrichen (Strg+U)"><Underline     size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('strikeThrough')} title="Durchgestrichen">       <Strikethrough size={SZ} /></RteBtn>
        <RteSep />
        {/* Überschriften */}
        <RteBtn onClick={() => exec('formatBlock', 'h2')} title="Überschrift 2"><Heading2 size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('formatBlock', 'h3')} title="Überschrift 3"><Heading3 size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('formatBlock', 'h4')} title="Überschrift 4"><Heading4 size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('formatBlock', 'p')}  title="Absatz">        <Pilcrow  size={SZ} /></RteBtn>
        <RteSep />
        {/* Listen & Zitat */}
        <RteBtn onClick={() => exec('insertUnorderedList')}       title="Aufzählung">  <List        size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('insertOrderedList')}         title="Numm. Liste"> <ListOrdered size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('formatBlock', 'blockquote')} title="Blockzitat">  <Quote       size={SZ} /></RteBtn>
        <RteSep />
        {/* Ausrichtung */}
        <RteBtn onClick={() => exec('justifyLeft')}   title="Links">     <AlignLeft    size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('justifyCenter')} title="Zentriert"> <AlignCenter  size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('justifyRight')}  title="Rechts">    <AlignRight   size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('justifyFull')}   title="Blocksatz"> <AlignJustify size={SZ} /></RteBtn>
        <RteSep />
        {/* Einfügen */}
        <RteBtn onClick={insertLink}                         title="Link einfügen"><Link2 size={SZ} /></RteBtn>
        <RteBtn onClick={insertCode}                         title="Code inline">   <Code  size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('insertHorizontalRule')} title="Trennlinie">   <Minus size={SZ} /></RteBtn>
        <RteSep />
        {/* Undo / Redo */}
        <RteBtn onClick={() => exec('undo')} title="Rückgängig (Strg+Z)"><Undo2 size={SZ} /></RteBtn>
        <RteBtn onClick={() => exec('redo')} title="Wiederholen (Strg+Y)"><Redo2 size={SZ} /></RteBtn>
        <RteSep />
        {/* Format entfernen */}
        <RteBtn onClick={() => exec('removeFormat')} title="Formatierung entfernen"><RemoveFormatting size={SZ} /></RteBtn>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="rte-content"
        onInput={handleInput}
        data-placeholder={placeholder}
      />
    </div>
  );
}

// ============================================================
// Tag Input
// ============================================================
function TagInput({ tags, onChange }) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const addTag = (val) => {
    const trimmed = val.trim().replace(/,+$/, '');
    if (!trimmed || tags.includes(trimmed)) { setInputValue(''); return; }
    onChange([...tags, trimmed]);
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="tags-input-wrapper" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag, i) => (
        <span key={i} className="tag-chip">
          {tag}
          <button
            type="button"
            className="tag-chip-remove"
            onClick={(e) => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i)); }}
          >✕</button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className="tags-input-field"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
        placeholder={tags.length === 0 ? 'Tags eingeben, Enter oder , zum Trennen…' : ''}
      />
    </div>
  );
}

// ============================================================
// Vorlagen-System
// ============================================================

// Gürtelfarbe → Emoji
function guertelEmoji(gurt) {
  if (!gurt) return '🥋';
  const g = gurt.toLowerCase();
  if (g.includes('weiß') || g.includes('weiss') || g.includes('white')) return '⬜';
  if (g.includes('gelb') || g.includes('yellow')) return '🟡';
  if (g.includes('orange')) return '🟠';
  if (g.includes('grün') || g.includes('gruen') || g.includes('green')) return '🟢';
  if (g.includes('blau') || g.includes('blue')) return '🔵';
  if (g.includes('braun') || g.includes('brown')) return '🟤';
  if (g.includes('schwarz') || g.includes('black')) return '⬛';
  if (g.includes('rot') || g.includes('red')) return '🔴';
  return '🥋';
}

function VorlagenPicker({ onApply, token }) {
  const [open, setOpen] = useState(false);
  const [pruefungModal, setPruefungModal] = useState(false);
  const [termine, setTermine] = useState([]);
  const [selectedTermin, setSelectedTermin] = useState('');
  const [kandidaten, setKandidaten] = useState([]);
  const [loadingTermine, setLoadingTermine] = useState(false);
  const [loadingKandidaten, setLoadingKandidaten] = useState(false);

  const openPruefungModal = async () => {
    setOpen(false);
    setPruefungModal(true);
    setLoadingTermine(true);
    try {
      const res = await axios.get('/pruefungen/termine', { headers: { Authorization: `Bearer ${token}` } });
      const vergangen = (res.data || []).filter(t => new Date(t.pruefungsdatum) <= new Date())
        .sort((a, b) => new Date(b.pruefungsdatum) - new Date(a.pruefungsdatum))
        .slice(0, 10);
      setTermine(vergangen);
      if (vergangen.length > 0) {
        setSelectedTermin(String(vergangen[0].termin_id));
        await ladeKandidaten(vergangen[0].termin_id);
      }
    } catch { setTermine([]); }
    setLoadingTermine(false);
  };

  const ladeKandidaten = async (terminId) => {
    setLoadingKandidaten(true);
    setKandidaten([]);
    try {
      const res = await axios.get(`/pruefungen/termine/${terminId}/anmeldungen`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKandidaten(res.data.anmeldungen || []);
    } catch { setKandidaten([]); }
    setLoadingKandidaten(false);
  };

  const handleTerminChange = async (e) => {
    setSelectedTermin(e.target.value);
    await ladeKandidaten(e.target.value);
  };

  const applyPruefungsVorlage = () => {
    const termin = termine.find(t => String(t.termin_id) === selectedTermin);
    const datum = termin ? new Date(termin.pruefungsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
    const stil = termin?.stil_name || '';

    const bestanden = kandidaten.filter(k => k.bestanden === 1 || k.bestanden === true);
    const nichtBestanden = kandidaten.filter(k => k.bestanden === 0 || k.bestanden === false);
    const ohneErgebnis = kandidaten.filter(k => k.bestanden === null || k.bestanden === undefined);

    const kandidatenListe = bestanden.length > 0
      ? bestanden.map(k => {
          const neuerGurt = k.graduierung_nachher_name || k.angestrebter_gurt || '';
          return `<li><strong>${k.vorname} ${k.nachname}</strong>${neuerGurt ? ` – ${guertelEmoji(neuerGurt)} ${neuerGurt}` : ''}</li>`;
        }).join('\n')
      : ohneErgebnis.map(k => {
          const gurt = k.angestrebter_gurt || '';
          return `<li><strong>${k.vorname} ${k.nachname}</strong>${gurt ? ` – ${guertelEmoji(gurt)} ${gurt}` : ''}</li>`;
        }).join('\n');

    const inhalt = `<h2>🥋 Herzlichen Glückwunsch!</h2>
<p>Am <strong>${datum}</strong> fand${stil ? ` im Bereich <strong>${stil}</strong>` : ''} unsere Gürtelprüfung statt. Wir freuen uns, folgende Erfolge bekannt geben zu dürfen:</p>

<ul>
${kandidatenListe || '<li>Teilnehmer werden hier eingetragen</li>'}
</ul>

<p>Wir gratulieren herzlich zu dieser großartigen Leistung! Jede bestandene Prüfung ist ein wichtiger Meilenstein auf dem Weg in der Kampfkunst – und ein Zeugnis von Ausdauer, Disziplin und Hingabe.</p>

<p>Ein besonderer Dank gilt auch unseren Trainern und Kampfrichtern für die professionelle Durchführung der Prüfung.</p>

<p>Weiter so! 💪</p>`;

    const titel = `Gürtelprüfung${datum ? ' am ' + datum : ''}${bestanden.length > 0 ? ' – ' + bestanden.length + ' Erfolge' : ''}`;
    const kurz = `${bestanden.length > 0 ? bestanden.length : kandidaten.length} Teilnehmer${bestanden.length > 0 ? ' haben erfolgreich ihre Gürtelprüfung bestanden' : ' haben an der Gürtelprüfung teilgenommen'}.`;

    onApply({ titel, kurzbeschreibung: kurz, inhalt, kategorie: 'pruefungen', tags: ['Gürtelprüfung', stil].filter(Boolean) });
    setPruefungModal(false);
  };

  const applyStatischVorlage = (type) => {
    setOpen(false);
    const vorlagen = {
      turnier: {
        titel: 'Turnierbericht: [Turniername]',
        kurzbeschreibung: 'Unser Verein war beim [Turniername] vertreten und konnte großartige Ergebnisse erzielen.',
        inhalt: `<h2>🏆 Turnierbericht</h2>
<p>Am <strong>[Datum]</strong> nahmen wir am <strong>[Turniername]</strong> in <strong>[Ort]</strong> teil.</p>
<h3>Unsere Ergebnisse</h3>
<ul>
<li><strong>[Name]</strong> – 🥇 1. Platz – [Kategorie]</li>
<li><strong>[Name]</strong> – 🥈 2. Platz – [Kategorie]</li>
<li><strong>[Name]</strong> – 🥉 3. Platz – [Kategorie]</li>
</ul>
<p>Wir sind stolz auf unsere Athleten und danken allen Trainern und Begleitern für ihren Einsatz!</p>`,
        kategorie: 'turniere',
        tags: ['Turnier', 'Wettkampf'],
      },
      ankuendigung: {
        titel: '[Event-Name] – [Datum]',
        kurzbeschreibung: 'Wir laden herzlich ein zu [Event]. Alle Infos hier.',
        inhalt: `<h2>🎯 [Event-Name]</h2>
<p>Wir freuen uns, euch zu folgendem Event einzuladen:</p>
<ul>
<li>📅 <strong>Datum:</strong> [Datum]</li>
<li>🕐 <strong>Uhrzeit:</strong> [Uhrzeit] Uhr</li>
<li>📍 <strong>Ort:</strong> [Ort]</li>
</ul>
<p>[Beschreibung des Events]</p>
<p>Anmeldungen bitte bis <strong>[Anmeldeschluss]</strong> an [Kontakt].</p>`,
        kategorie: 'events',
        tags: ['Event', 'Ankündigung'],
      },
      training: {
        titel: 'Trainingsinfo: [Thema]',
        kurzbeschreibung: 'Aktuelle Informationen zum Training: [Kurzbeschreibung].',
        inhalt: `<h2>💪 Trainingsinfo</h2>
<p>[Freitext – z.B. Änderungen im Stundenplan, Sondertraining, Trainingslager-Ankündigung]</p>
<h3>Details</h3>
<ul>
<li>📅 <strong>Datum:</strong> [Datum]</li>
<li>🕐 <strong>Zeit:</strong> [Uhrzeit] Uhr</li>
<li>📍 <strong>Ort:</strong> [Ort / Halle]</li>
</ul>
<p>Bei Fragen meldet euch beim Trainer. Bis dann!</p>`,
        kategorie: 'training',
        tags: ['Training'],
      },
    };
    if (vorlagen[type]) onApply(vorlagen[type]);
  };

  return (
    <>
      <div className="vorlagen-picker">
        <button type="button" className="vorlagen-toggle-btn" onClick={() => setOpen(o => !o)}>
          📋 Vorlage verwenden {open ? '▲' : '▼'}
        </button>
        {open && (
          <div className="vorlagen-dropdown">
            <button type="button" className="vorlage-btn" onClick={openPruefungModal}>
              🥋 Gürtelprüfung <span className="vorlage-hint">lädt Prüflingsdaten automatisch</span>
            </button>
            <button type="button" className="vorlage-btn" onClick={() => applyStatischVorlage('turnier')}>
              🏆 Turnierbericht <span className="vorlage-hint">mit Platzierungen</span>
            </button>
            <button type="button" className="vorlage-btn" onClick={() => applyStatischVorlage('ankuendigung')}>
              🎯 Event-Ankündigung <span className="vorlage-hint">Datum, Ort, Details</span>
            </button>
            <button type="button" className="vorlage-btn" onClick={() => applyStatischVorlage('training')}>
              💪 Training-Update <span className="vorlage-hint">Stundenplan, Sondertraining</span>
            </button>
          </div>
        )}
      </div>

      {/* Prüfungs-Modal */}
      {pruefungModal && (
        <div className="vorlage-modal-overlay" onClick={() => setPruefungModal(false)}>
          <div className="vorlage-modal" onClick={e => e.stopPropagation()}>
            <div className="vorlage-modal-header">
              <h3>🥋 Gürtelprüfung – Vorlage</h3>
              <button type="button" onClick={() => setPruefungModal(false)} className="vorlage-modal-close">✕</button>
            </div>

            <div className="vorlage-modal-body">
              {loadingTermine ? (
                <p style={{ color: 'var(--text-4)' }}>⏳ Lade Prüfungstermine…</p>
              ) : termine.length === 0 ? (
                <p style={{ color: 'var(--text-4)' }}>Keine vergangenen Prüfungstermine gefunden.</p>
              ) : (
                <>
                  <div className="form-group">
                    <label>Prüfungstermin auswählen</label>
                    <select className="form-select" value={selectedTermin} onChange={handleTerminChange}>
                      {termine.map(t => (
                        <option key={t.termin_id} value={t.termin_id}>
                          {new Date(t.pruefungsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })} – {t.stil_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {loadingKandidaten ? (
                    <p style={{ color: 'var(--text-4)', fontSize: '0.875rem' }}>⏳ Lade Kandidaten…</p>
                  ) : kandidaten.length === 0 ? (
                    <p style={{ color: 'var(--text-4)', fontSize: '0.875rem' }}>Keine Anmeldungen für diesen Termin.</p>
                  ) : (
                    <div className="vorlage-kandidaten-liste">
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-4)', marginBottom: '0.5rem' }}>
                        {kandidaten.filter(k => k.bestanden).length > 0
                          ? `${kandidaten.filter(k => k.bestanden).length} bestanden`
                          : `${kandidaten.length} Teilnehmer`} werden in die Vorlage übernommen:
                      </p>
                      {kandidaten.map((k, i) => (
                        <div key={i} className="vorlage-kandidat-item">
                          <span>{k.bestanden === 1 ? '✅' : k.bestanden === 0 ? '❌' : '⏳'} {k.vorname} {k.nachname}</span>
                          <span style={{ color: 'var(--text-4)', fontSize: '0.8rem' }}>
                            {guertelEmoji(k.graduierung_nachher_name || k.angestrebter_gurt)} {k.graduierung_nachher_name || k.angestrebter_gurt || '–'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="vorlage-modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setPruefungModal(false)}>Abbrechen</button>
              <button
                type="button"
                className="btn-save"
                onClick={applyPruefungsVorlage}
                disabled={!selectedTermin || loadingKandidaten}
              >
                ✓ Vorlage anwenden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Main Component
// ============================================================
const KATEGORIEN = [
  { value: 'allgemein',  label: '📰 Allgemein' },
  { value: 'turniere',   label: '🏆 Turniere' },
  { value: 'events',     label: '🎯 Events' },
  { value: 'pruefungen', label: '🥋 Prüfungen' },
  { value: 'training',   label: '💪 Training' },
  { value: 'verband',    label: '🏛️ Verband' },
];

function NewsFormular({ mode = 'create' }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { token } = useAuth();
  const bildInputRef = useRef(null);

  const emptyForm = {
    titel: '',
    kurzbeschreibung: '',
    inhalt: '',
    zielgruppe: 'alle_dojos',
    auf_intl: false,
    status: 'entwurf',
    kategorie: 'allgemein',
    tags: [],
    featured: false,
    geplant_am: '',
    ablauf_am: '',
    meta_titel: '',
    meta_beschreibung: '',
    bilder: [],
    bild_captions: [],
  };

  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [seoOpen, setSeoOpen]   = useState(false);
  const [forceRteValue, setForceRteValue] = useState(undefined);

  // Vorlage anwenden
  const applyVorlage = useCallback(({ titel, kurzbeschreibung, inhalt, kategorie, tags }) => {
    setFormData(prev => ({
      ...prev,
      titel: titel || prev.titel,
      kurzbeschreibung: kurzbeschreibung || prev.kurzbeschreibung,
      inhalt: inhalt || prev.inhalt,
      kategorie: kategorie || prev.kategorie,
      tags: tags || prev.tags,
    }));
    // RTE zwingen den neuen Inhalt zu rendern
    if (inhalt) setForceRteValue(inhalt);
  }, []);

  useEffect(() => {
    if (mode === 'edit' && id) loadNews();
  }, [mode, id]); // eslint-disable-line

  // Datetime-local Format aus ISO-String
  const toLocalDt = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const loadNews = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/news/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = res.data;

      let bilder = [];
      if (d.bilder_json) { try { bilder = JSON.parse(d.bilder_json); } catch {} }
      else if (d.bild_url) { bilder = [d.bild_url]; }

      let bild_captions = [];
      if (d.bild_captions) { try { bild_captions = JSON.parse(d.bild_captions); } catch {} }
      // Sicherstellen dass bild_captions dieselbe Länge wie bilder hat
      while (bild_captions.length < bilder.length) bild_captions.push('');

      let tags = [];
      if (d.tags) { try { tags = JSON.parse(d.tags); } catch {} }

      const loaded = {
        titel: d.titel || '',
        kurzbeschreibung: d.kurzbeschreibung || '',
        inhalt: d.inhalt || '',
        zielgruppe: d.zielgruppe || 'alle_dojos',
        auf_intl: !!d.auf_intl,
        status: d.status || 'entwurf',
        kategorie: d.kategorie || 'allgemein',
        tags,
        featured: !!d.featured,
        geplant_am: toLocalDt(d.geplant_am),
        ablauf_am: toLocalDt(d.ablauf_am),
        meta_titel: d.meta_titel || '',
        meta_beschreibung: d.meta_beschreibung || '',
        bilder,
        bild_captions,
      };
      setFormData(loaded);
      if (d.meta_titel || d.meta_beschreibung) setSeoOpen(true);
    } catch (err) {
      setError('Fehler beim Laden: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleInhaltChange = useCallback((html) => {
    setFormData(prev => ({ ...prev, inhalt: html }));
  }, []);

  // Bilder hochladen
  const handleBildUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const neueUrls = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('bild', file);
        const res = await axios.post('/news/upload-bild', fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        neueUrls.push(res.data.bild_url);
      }
      setFormData(prev => ({
        ...prev,
        bilder: [...prev.bilder, ...neueUrls],
        bild_captions: [...prev.bild_captions, ...neueUrls.map(() => '')],
      }));
    } catch (err) {
      setError('Bild-Upload fehlgeschlagen: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      if (bildInputRef.current) bildInputRef.current.value = '';
    }
  };

  const handleBildEntfernen = (index) => {
    setFormData(prev => ({
      ...prev,
      bilder: prev.bilder.filter((_, i) => i !== index),
      bild_captions: prev.bild_captions.filter((_, i) => i !== index),
    }));
  };

  const handleCaptionChange = (index, value) => {
    setFormData(prev => {
      const caps = [...prev.bild_captions];
      caps[index] = value;
      return { ...prev, bild_captions: caps };
    });
  };

  const handleSubmit = async (e, overrideStatus) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!formData.titel.trim()) throw new Error('Titel ist erforderlich');
      const plainText = formData.inhalt.replace(/<[^>]*>/g, '').trim();
      if (!plainText) throw new Error('Inhalt ist erforderlich');

      const statusToSave = overrideStatus || formData.status;

      const payload = {
        titel: formData.titel,
        kurzbeschreibung: formData.kurzbeschreibung || null,
        inhalt: formData.inhalt,
        zielgruppe: formData.zielgruppe,
        auf_intl: formData.auf_intl ? 1 : 0,
        status: statusToSave,
        kategorie: formData.kategorie,
        tags: formData.tags.length > 0 ? JSON.stringify(formData.tags) : null,
        featured: formData.featured ? 1 : 0,
        geplant_am: formData.geplant_am || null,
        ablauf_am: formData.ablauf_am || null,
        meta_titel: formData.meta_titel || null,
        meta_beschreibung: formData.meta_beschreibung || null,
        bild_url: formData.bilder[0] || null,
        bilder_json: formData.bilder.length > 0 ? JSON.stringify(formData.bilder) : null,
        bild_captions: formData.bild_captions.some(c => c) ? JSON.stringify(formData.bild_captions) : null,
      };

      if (mode === 'edit' && id) {
        await axios.put(`/news/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        setSuccess('Gespeichert!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const res = await axios.post('/news', payload, { headers: { Authorization: `Bearer ${token}` } });
        setSuccess('News erstellt!');
        // Bei Entwurf: zur Bearbeiten-Seite wechseln
        setTimeout(() => navigate(`/dashboard/news/bearbeiten/${res.data.id}`), 800);
        return;
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async () => {
    setFormData(prev => ({ ...prev, status: 'veroeffentlicht' }));
    await handleSubmit(null, 'veroeffentlicht');
    setTimeout(() => navigate('/dashboard/news'), 1500);
  };

  if (loading) return <div className="news-formular"><div className="news-loading">Lädt…</div></div>;

  return (
    <div className="news-formular">
      <div className="news-header">
        <div className="news-header-left">
          <button className="btn-back" onClick={() => navigate('/dashboard/news')}>← Zurück</button>
          <h1>{mode === 'edit' ? 'News bearbeiten' : 'Neue News erstellen'}</h1>
        </div>
      </div>

      {error   && <div className="news-error">{error}</div>}
      {success && <div className="news-success">{success}</div>}

      {/* Vorlagen-Picker — nur beim Erstellen */}
      {mode === 'create' && (
        <VorlagenPicker onApply={applyVorlage} token={token} />
      )}

      <form onSubmit={handleSubmit}>
        <div className="news-form-grid">

          {/* ─── Hauptinhalt ─── */}
          <div className="news-form-card">

            {/* Titel */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="titel">Titel *</label>
              <input
                type="text" id="titel" name="titel"
                value={formData.titel} onChange={handleChange}
                placeholder="Titel der News" required className="form-input"
              />
            </div>

            {/* Kurzbeschreibung */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="kurzbeschreibung">
                Kurzbeschreibung
                <span className="char-count">({formData.kurzbeschreibung.length}/500)</span>
              </label>
              <textarea
                id="kurzbeschreibung" name="kurzbeschreibung"
                value={formData.kurzbeschreibung} onChange={handleChange}
                placeholder="Kurze Zusammenfassung für die Vorschau-Karte…"
                maxLength={500} rows={3} className="form-textarea"
              />
            </div>

            {/* WYSIWYG Inhalt */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Inhalt *</label>
              <RichTextEditor value={formData.inhalt} onChange={handleInhaltChange} forceValue={forceRteValue} />
            </div>

            {/* Tags */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tags / Schlagwörter</label>
              <TagInput
                tags={formData.tags}
                onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
              />
              <small className="form-hint">Enter oder Komma zum Bestätigen</small>
            </div>

            {/* Bilder */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>
                Bilder
                {formData.bilder.length > 0 && (
                  <span className="char-count">({formData.bilder.length})</span>
                )}
              </label>

              {formData.bilder.length > 0 && (
                <div className="news-bilder-grid">
                  {formData.bilder.map((url, i) => (
                    <div key={i} className="news-bild-item">
                      <div className="news-bild-thumb">
                        <img src={url} alt={`Bild ${i + 1}`} className="news-bild-thumb-img" />
                        {i === 0 && <span className="news-bild-primary-badge">Titelbild</span>}
                        <button
                          type="button"
                          className="news-bild-remove-thumb"
                          onClick={() => handleBildEntfernen(i)}
                        >✕</button>
                      </div>
                      <textarea
                        className="news-bild-caption"
                        placeholder="Bildunterschrift…"
                        value={formData.bild_captions[i] || ''}
                        onChange={(e) => handleCaptionChange(i, e.target.value)}
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="news-bild-upload">
                <input
                  ref={bildInputRef} type="file" id="bild" multiple
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleBildUpload} className="news-bild-input" disabled={uploading}
                />
                <label htmlFor="bild" className="news-bild-label">
                  {uploading ? '⏳ Wird hochgeladen…' : '📷 Bilder hinzufügen (JPG, PNG, WebP · max. 5 MB)'}
                </label>
              </div>
            </div>

            {/* SEO-Sektion */}
            <div style={{ marginBottom: 0 }}>
              <button type="button" className="seo-toggle-btn" onClick={() => setSeoOpen(o => !o)}>
                <span>🔍 SEO &amp; Meta-Daten</span>
                <span>{seoOpen ? '▲' : '▼'}</span>
              </button>
              {seoOpen && (
                <div className="seo-fields">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="meta_titel">
                      Meta-Titel
                      <span className="char-count">({formData.meta_titel.length}/60)</span>
                    </label>
                    <input
                      type="text" id="meta_titel" name="meta_titel"
                      value={formData.meta_titel} onChange={handleChange}
                      placeholder="Für Suchmaschinen (leer = Artikel-Titel wird verwendet)"
                      maxLength={60} className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="meta_beschreibung">
                      Meta-Beschreibung
                      <span className="char-count">({formData.meta_beschreibung.length}/160)</span>
                    </label>
                    <textarea
                      id="meta_beschreibung" name="meta_beschreibung"
                      value={formData.meta_beschreibung} onChange={handleChange}
                      placeholder="Google-Snippet (leer = Kurzbeschreibung wird verwendet)"
                      maxLength={160} rows={3} className="form-textarea"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Sidebar ─── */}
          <div className="news-form-sidebar">

            {/* Aktionen */}
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">Aktionen</span>
              </div>
              <div className="sidebar-section-body">
                <button type="submit" className="btn-save" style={{ width: '100%' }} disabled={saving || uploading}>
                  {saving ? '⏳ Speichert…' : (mode === 'edit' ? '💾 Speichern' : '💾 Als Entwurf speichern')}
                </button>
                <button
                  type="button"
                  className="btn-save"
                  style={{ width: '100%', background: 'var(--status-success-bg)', color: 'var(--status-success)', border: '1px solid var(--status-success)' }}
                  onClick={handlePublishNow}
                  disabled={saving || uploading}
                >
                  🚀 Jetzt veröffentlichen
                </button>
                <button type="button" className="btn-cancel" style={{ width: '100%' }} onClick={() => navigate('/dashboard/news')}>
                  Abbrechen
                </button>
              </div>
            </div>

            {/* Social Media */}
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">📱 Social Media</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-4)', fontStyle: 'italic' }}>Demnächst</span>
              </div>
              <div className="sidebar-section-body">
                <div className="social-media-grid">
                  {[
                    { icon: <FaInstagram size={16} />, label: 'Instagram', color: '#E1306C' },
                    { icon: <FaFacebook  size={16} />, label: 'Facebook',  color: '#1877F2' },
                    { icon: <FaTiktok    size={16} />, label: 'TikTok',    color: '#69C9D0' },
                    { icon: <FaXTwitter  size={16} />, label: 'X / Twitter', color: '#aaa' },
                    { icon: <FaWhatsapp  size={16} />, label: 'WhatsApp',  color: '#25D366' },
                    { icon: <FaTelegram  size={16} />, label: 'Telegram',  color: '#2CA5E0' },
                  ].map(({ icon, label, color }) => (
                    <button
                      key={label}
                      type="button"
                      className="social-btn"
                      disabled
                      title={`${label} – In Kürze verfügbar`}
                    >
                      <span style={{ color }}>{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <small className="form-hint" style={{ textAlign: 'center', display: 'block', marginTop: '0.25rem' }}>
                  API-Integration folgt in einer späteren Version
                </small>
              </div>
            </div>

            {/* Veröffentlichung */}
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">Veröffentlichung</span>
              </div>
              <div className="sidebar-section-body">

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="status">Status</label>
                  <select id="status" name="status" value={formData.status} onChange={handleChange} className="form-select">
                    <option value="entwurf">📝 Entwurf</option>
                    <option value="geplant">🕐 Geplant</option>
                    <option value="veroeffentlicht">✅ Veröffentlicht</option>
                    <option value="archiviert">📦 Archiviert</option>
                  </select>
                </div>

                {formData.status === 'geplant' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="geplant_am">Veröffentlichen am *</label>
                    <input
                      type="datetime-local" id="geplant_am" name="geplant_am"
                      value={formData.geplant_am} onChange={handleChange}
                      className="form-input"
                    />
                    <small className="form-hint">Geht automatisch online zu diesem Zeitpunkt.</small>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="ablauf_am">
                    Ablaufdatum
                    <span style={{ fontWeight: 400, color: 'var(--text-4)', fontSize: '0.8rem', marginLeft: '0.4rem' }}>optional</span>
                  </label>
                  <input
                    type="datetime-local" id="ablauf_am" name="ablauf_am"
                    value={formData.ablauf_am} onChange={handleChange}
                    className="form-input"
                  />
                  <small className="form-hint">Artikel wird danach automatisch ausgeblendet.</small>
                </div>

              </div>
            </div>

            {/* Kategorie & Sichtbarkeit */}
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">Kategorie &amp; Zielgruppe</span>
              </div>
              <div className="sidebar-section-body">

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="kategorie">Kategorie</label>
                  <select id="kategorie" name="kategorie" value={formData.kategorie} onChange={handleChange} className="form-select">
                    {KATEGORIEN.map(k => (
                      <option key={k.value} value={k.value}>{k.label}</option>
                    ))}
                  </select>
                </div>

                {/* tda-vib.de Checkbox */}
                <div className="news-oeffentlich-row">
                  <input
                    type="checkbox" id="news_oeffentlich_vib"
                    checked={formData.zielgruppe === 'homepage'}
                    onChange={(e) => setFormData(prev => ({
                      ...prev, zielgruppe: e.target.checked ? 'homepage' : 'alle_dojos'
                    }))}
                    className="news-oeffentlich-checkbox"
                  />
                  <label htmlFor="news_oeffentlich_vib" className="news-oeffentlich-label">
                    🏠 Auf tda-vib.de veröffentlichen
                  </label>
                </div>

                {/* tda-intl.com Checkbox */}
                <div className="news-oeffentlich-row">
                  <input
                    type="checkbox" id="news_oeffentlich_intl"
                    checked={formData.auf_intl}
                    onChange={(e) => setFormData(prev => ({ ...prev, auf_intl: e.target.checked }))}
                    className="news-oeffentlich-checkbox"
                  />
                  <label htmlFor="news_oeffentlich_intl" className="news-oeffentlich-label">
                    🌍 Auf tda-intl.com veröffentlichen
                  </label>
                </div>

                {/* Featured Toggle */}
                <label
                  className={`featured-toggle${formData.featured ? ' active' : ''}`}
                  htmlFor="featured-cb"
                >
                  <span className="featured-toggle-text">
                    <span className="featured-toggle-label">⭐ Hervorgehoben</span>
                    <span className="featured-toggle-hint">Erscheint groß oben auf der News-Seite</span>
                  </span>
                  <span className="toggle-switch">
                    <input
                      type="checkbox" id="featured-cb" name="featured"
                      checked={formData.featured} onChange={handleChange}
                    />
                    <span className="toggle-slider" />
                  </span>
                </label>

              </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}

export default NewsFormular;
